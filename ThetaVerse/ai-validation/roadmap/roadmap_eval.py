from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

import requests
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parent
DEFAULT_SCHEMA = ROOT / "roadmap_schema.json"
DEFAULT_INPUTS = ROOT / "sample_inputs.json"
DEFAULT_OUT = ROOT / "runs"
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
DEFAULT_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1/chat/completions")
DEFAULT_TIMEOUT = float(os.getenv("GROQ_TIMEOUT", "90"))
DEFAULT_RUN_STARTED = time.time()
RETRY_BACKOFFS = (2, 4, 8)

REFERENCE_LINK_PATTERN = re.compile(r"^https://www\.google\.com/search\?q=.+")


@dataclass
class EvaluationResult:
    case_id: str
    ok: bool
    schema_ok: bool
    parse_ok: bool
    time_fit_ok: bool
    link_quality_ok: bool
    uniqueness_ok: bool
    total_hours: float | None
    target_hours: float | None
    mean_title_similarity: float | None
    prompt_hash: str
    response_file: str
    error: str | None = None


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def make_prompt(case: dict[str, Any]) -> str:
    expected_topics = max(5, int((case["days"] * case["hoursPerDay"]) / 10))
    schema_example = (
        '{"topics":[{"title":"...","estimatedHours":5,'
        '"priority":"High","referenceLinks":["https://www.google.com/search?q=..."],'
        '"subtopics":["..."]}]}'
    )
    return (
        "You are a senior interview roadmap generator.\n"
        f"Input:\n"
        f"- position: {case['position']}\n"
        f"- company: {case['company']}\n"
        f"- days: {case['days']}\n"
        f"- hoursPerDay: {case['hoursPerDay']}\n"
        f"- focus: {case.get('majorTopic', '')}\n\n"
        "Output only a valid JSON object matching this schema.\n"
        "Do not output markdown, prose, code fences, comments, or trailing text.\n"
        f"{schema_example}\n\n"
        f"Generate exactly {expected_topics} topics.\n"
        "Use clean Google Search URLs for referenceLinks.\n"
        "Do not wrap the JSON in markdown. Do not add explanation text."
    )


def call_groq(prompt: str) -> tuple[str, dict[str, Any], float]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You produce only valid JSON objects that exactly match the requested schema. "
                    "Never include markdown, code fences, or extra commentary."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 2600,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    started = time.time()
    for attempt, delay in enumerate((0, *RETRY_BACKOFFS), start=1):
        if delay:
            time.sleep(delay)
        try:
            response = requests.post(DEFAULT_BASE_URL, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
            raw = response.json()
            return extract_content(raw), raw, time.time() - started
        except requests.HTTPError as exc:
            last_error = exc
            status = getattr(exc.response, "status_code", None)
            if status not in {429, 500, 502, 503, 504} or attempt == len(RETRY_BACKOFFS) + 1:
                raise
        except requests.RequestException as exc:
            last_error = exc
            if attempt == len(RETRY_BACKOFFS) + 1:
                raise
    if last_error:
        raise last_error
    raise RuntimeError("Groq request failed unexpectedly")


def mock_groq(case: dict[str, Any]) -> tuple[str, dict[str, Any], float]:
    target_hours = float(case["days"]) * float(case["hoursPerDay"])
    topic_count = max(5, int(target_hours / 10))
    topics = []
    for index in range(topic_count):
        topics.append(
            {
                "title": f"{case['majorTopic']} focus area {index + 1}",
                "estimatedHours": round(target_hours / topic_count, 1),
                "priority": "High" if index < 2 else "Medium",
                "referenceLinks": [
                    f"https://www.google.com/search?q={case['company']}+{case['position']}+topic+{index + 1}"
                ],
                "subtopics": [
                    f"Core concept {index + 1}",
                    f"Interview practice {index + 1}",
                ],
            }
        )
    raw = {"choices": [{"message": {"content": json.dumps({"topics": topics})}}]}
    return json.dumps({"topics": topics}), raw, 0.0


def extract_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        message = first.get("message") if isinstance(first, dict) else None
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str):
                return content
        content = first.get("text") if isinstance(first, dict) else None
        if isinstance(content, str):
            return content
    content = payload.get("content")
    if isinstance(content, str):
        return content
    raise ValueError("Unable to extract text content from Groq response")


def extract_json_block(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        return stripped[start : end + 1]
    raise ValueError("No JSON object found in model output")


def repair_json_with_groq(raw_text: str, case: dict[str, Any]) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    repair_prompt = (
        "Fix the following roadmap output so it becomes one valid JSON object only. "
        "Preserve the meaning, make it schema-compatible, and output no markdown or explanation.\n\n"
        f"Case:\n"
        f"- position: {case['position']}\n"
        f"- company: {case['company']}\n"
        f"- days: {case['days']}\n"
        f"- hoursPerDay: {case['hoursPerDay']}\n"
        f"- focus: {case.get('majorTopic', '')}\n\n"
        f"Broken output:\n{raw_text}"
    )
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "Return only valid JSON and nothing else.",
            },
            {"role": "user", "content": repair_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 2600,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(DEFAULT_BASE_URL, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()
    raw = response.json()
    return extract_content(raw)


def normalize_topics(topics: list[dict[str, Any]]) -> list[str]:
    titles: list[str] = []
    for topic in topics:
        title = topic.get("title")
        if isinstance(title, str) and title.strip():
            titles.append(title.strip().lower())
    return titles


def cosine_similarity_from_sets(a: str, b: str) -> float:
    a_tokens = set(re.findall(r"[a-z0-9]+", a.lower()))
    b_tokens = set(re.findall(r"[a-z0-9]+", b.lower()))
    if not a_tokens or not b_tokens:
        return 0.0
    intersection = len(a_tokens & b_tokens)
    union = len(a_tokens | b_tokens)
    return intersection / union if union else 0.0


def mean_pairwise_similarity(titles: list[str]) -> float:
    if len(titles) < 2:
        return 0.0
    similarities: list[float] = []
    for index, title in enumerate(titles):
        for other in titles[index + 1 :]:
            similarities.append(cosine_similarity_from_sets(title, other))
    return float(sum(similarities) / len(similarities)) if similarities else 0.0


def reference_links_ok(topics: Iterable[dict[str, Any]]) -> bool:
    for topic in topics:
        links = topic.get("referenceLinks", [])
        if not isinstance(links, list) or not links:
            return False
        for link in links:
            if not isinstance(link, str) or not REFERENCE_LINK_PATTERN.match(link):
                return False
    return True


def validate_response_schema(parsed: Any, schema: dict[str, Any]) -> tuple[bool, list[str]]:
    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(parsed), key=lambda item: item.path)
    if not errors:
        return True, []
    return False, [error.message for error in errors]


def time_fit_ok(topics: list[dict[str, Any]], requested_hours: float, tolerance: float = 0.2) -> tuple[bool, float]:
    total_hours = 0.0
    for topic in topics:
        hours = topic.get("estimatedHours", 0)
        try:
            total_hours += float(hours)
        except (TypeError, ValueError):
            continue
    if requested_hours <= 0:
        return False, total_hours
    lower = requested_hours * (1 - tolerance)
    upper = requested_hours * (1 + tolerance)
    return lower <= total_hours <= upper, total_hours


def run_case(case: dict[str, Any], schema: dict[str, Any], out_dir: Path, index: int) -> EvaluationResult:
    prompt = make_prompt(case)
    prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    response_path = out_dir / f"case_{index:03d}.json"
    failed_path = out_dir / f"case_{index:03d}.failed.json"

    try:
        if os.getenv("GROQ_MOCK", "0") == "1":
            content, raw_payload, duration = mock_groq(case)
        else:
            content, raw_payload, duration = call_groq(prompt)
        try:
            parsed_block = extract_json_block(content)
        except Exception:
            repaired = repair_json_with_groq(content, case)
            raw_payload = {
                "original": raw_payload,
                "repaired": True,
            }
            parsed_block = extract_json_block(repaired)
        parsed = json.loads(parsed_block)
        schema_ok, schema_errors = validate_response_schema(parsed, schema)
        topics = parsed.get("topics") if isinstance(parsed, dict) else []
        topics = topics if isinstance(topics, list) else []
        titles = normalize_topics(topics)
        time_ok, total_hours = time_fit_ok(topics, float(case["days"]) * float(case["hoursPerDay"]))
        link_ok = reference_links_ok(topics)
        uniqueness = mean_pairwise_similarity(titles)
        uniqueness_ok = uniqueness < 0.85
        ok = schema_ok and time_ok and link_ok and uniqueness_ok

        result = {
            "meta": {
                "case": case,
                "prompt_hash": prompt_hash,
                "duration_sec": round(duration, 3),
                "model": DEFAULT_MODEL,
                "base_url": DEFAULT_BASE_URL,
                "time": time.time(),
            },
            "raw": raw_payload,
            "parsed": parsed,
            "checks": {
                "schema_ok": schema_ok,
                "schema_errors": schema_errors,
                "time_fit_ok": time_ok,
                "total_hours": total_hours,
                "target_hours": float(case["days"]) * float(case["hoursPerDay"]),
                "link_quality_ok": link_ok,
                "mean_title_similarity": uniqueness,
                "uniqueness_ok": uniqueness_ok,
            },
        }
        save_json(response_path, result)
        if not ok:
            save_json(failed_path, result)
        return EvaluationResult(
            case_id=f"case_{index:03d}",
            ok=ok,
            schema_ok=schema_ok,
            parse_ok=True,
            time_fit_ok=time_ok,
            link_quality_ok=link_ok,
            uniqueness_ok=uniqueness_ok,
            total_hours=total_hours,
            target_hours=float(case["days"]) * float(case["hoursPerDay"]),
            mean_title_similarity=uniqueness,
            prompt_hash=prompt_hash,
            response_file=str(response_path),
            error=None if ok else "; ".join(schema_errors) if not schema_ok else "quality_gate_failed",
        )
    except Exception as exc:  # noqa: BLE001
        payload = {
            "meta": {
                "case": case,
                "prompt_hash": prompt_hash,
                "model": DEFAULT_MODEL,
                "base_url": DEFAULT_BASE_URL,
                "time": time.time(),
            },
            "error": str(exc),
        }
        save_json(failed_path, payload)
        return EvaluationResult(
            case_id=f"case_{index:03d}",
            ok=False,
            schema_ok=False,
            parse_ok=False,
            time_fit_ok=False,
            link_quality_ok=False,
            uniqueness_ok=False,
            total_hours=None,
            target_hours=float(case["days"]) * float(case["hoursPerDay"]),
            mean_title_similarity=None,
            prompt_hash=prompt_hash,
            response_file=str(failed_path),
            error=str(exc),
        )


def load_cases(path: Path) -> list[dict[str, Any]]:
    data = load_json(path)
    if not isinstance(data, list):
        raise ValueError("Input file must contain a JSON array of cases")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Standalone roadmap evaluation pipeline for Groq")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUTS)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if any case fails")
    args = parser.parse_args()

    schema = load_json(args.schema)
    cases = load_cases(args.input)
    args.out.mkdir(parents=True, exist_ok=True)

    results: list[EvaluationResult] = []
    for index, case in enumerate(cases, start=1):
        results.append(run_case(case, schema, args.out, index))

    manifest = {
        "run_started": DEFAULT_RUN_STARTED,
        "model": DEFAULT_MODEL,
        "base_url": DEFAULT_BASE_URL,
        "results": [asdict(result) for result in results],
        "summary": {
            "total": len(results),
            "passed": sum(1 for result in results if result.ok),
            "failed": sum(1 for result in results if not result.ok),
        },
    }
    save_json(args.out / "manifest.json", manifest)

    print(json.dumps(manifest["summary"], indent=2))
    if args.strict and manifest["summary"]["failed"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
