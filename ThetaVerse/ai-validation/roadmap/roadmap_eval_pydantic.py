#!/usr/bin/env python3
"""
Improved roadmap evaluation with Pydantic V2 validation, mock fallback, and safe printing.
"""

import json
import hashlib
import os
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import requests
from pydantic import BaseModel, Field, field_validator, ValidationError, ConfigDict
from dotenv import load_dotenv

load_dotenv()


# ========== SAFE PRINTING FOR WINDOWS ==========

def safe_print(text: str, *args, **kwargs):
    """Print text safely, encoding characters when the terminal doesn't support them."""
    try:
        print(text, *args, **kwargs)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or 'ascii'
        encoded = text.encode(encoding, errors='replace')
        print(encoded.decode(encoding), *args, **kwargs)


# ========== PYDANTIC V2 MODELS ==========

class Topic(BaseModel):
    """Validated topic model using Pydantic V2 syntax."""
    model_config = ConfigDict(extra='forbid')
    
    title: str = Field(..., min_length=5, max_length=150, description="Topic title")
    estimatedHours: float = Field(..., gt=0, le=200, description="Estimated hours (0-200)")
    priority: str = Field(default="High", description="Priority level")
    referenceLinks: List[str] = Field(..., min_length=1, description="Reference URLs")
    subtopics: List[str] = Field(..., min_length=1, description="Subtopics (≥1)")
    
    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in ["High", "Medium", "Low"]:
            raise ValueError(f"Priority must be High/Medium/Low, got {v}")
        return v
    
    @field_validator('referenceLinks')
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        for url in v:
            if not url.startswith(('http://', 'https://')):
                raise ValueError(f"Invalid URL: {url}")
        return v
    
    @field_validator('subtopics')
    @classmethod
    def validate_subtopic(cls, v: List[str]) -> List[str]:
        cleaned = []
        for sub in v:
            if not isinstance(sub, str) or len(sub.strip()) < 2:
                raise ValueError(f"Subtopic too short: {sub}")
            cleaned.append(sub.strip())
        return cleaned


class Roadmap(BaseModel):
    """Validated roadmap model using Pydantic V2."""
    model_config = ConfigDict(extra='forbid')
    
    topics: List[Topic] = Field(..., min_length=1, description="Topics (≥1)")


# ========== GROQ API CLIENT & MOCK ==========

def get_groq_config():
    """Get Groq configuration from environment."""
    return {
        'api_key': os.getenv('GROQ_API_KEY'),
        'model': os.getenv('GROQ_MODEL', 'openai/gpt-oss-20b'),
        'base_url': os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1/chat/completions'),
        'timeout': int(os.getenv('GROQ_TIMEOUT', '60')),
        'mock': os.getenv('GROQ_MOCK', '0') == '1'
    }


def call_groq(prompt: str, config: dict, retries: int = 3) -> Optional[str]:
    """Call Groq API with retry logic."""
    import time
    
    headers = {
        'Authorization': f'Bearer {config["api_key"]}',
        'Content-Type': 'application/json',
    }
    
    payload = {
        'model': config['model'],
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.3,
        'max_tokens': 4096,
    }
    
    for attempt in range(retries):
        try:
            response = requests.post(
                config['base_url'],
                headers=headers,
                json=payload,
                timeout=config['timeout']
            )
            response.raise_for_status()
            
            content = response.json()['choices'][0]['message']['content']
            return content
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429 and attempt < retries - 1:
                wait_time = 10 * (attempt + 1)
                safe_print(f"  Rate limited. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
        except Exception as e:
            safe_print(f"  Error: {e}")
            if attempt == retries - 1:
                raise
            time.sleep(2 ** (attempt + 1))
    
    return None


def mock_groq(case: dict) -> str:
    """Mock Groq response for testing without API keys."""
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
    return json.dumps({"topics": topics})


# ========== JSON EXTRACTION & REPAIR ==========

def extract_json_from_text(text: str) -> Optional[dict]:
    """Extract JSON from text (handles markdown wrapping and outermost braces)."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    if '```json' in text:
        try:
            start = text.find('```json') + 7
            end = text.find('```', start)
            if end > start:
                json_text = text[start:end].strip()
                return json.loads(json_text)
        except:
            pass
    
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    if start_idx >= 0 and end_idx > start_idx:
        try:
            candidate = text[start_idx:end_idx + 1]
            return json.loads(candidate)
        except:
            pass
    
    return None


def repair_json_with_pydantic(raw_text: str, case: dict, config: dict) -> Optional[dict]:
    """Repair malformed JSON using Pydantic + LLM."""
    data = extract_json_from_text(raw_text)
    if data:
        try:
            roadmap = Roadmap(**data)
            return roadmap.model_dump()
        except ValidationError:
            pass
    
    if config['mock']:
        return json.loads(mock_groq(case))

    repair_prompt = f"""This JSON is incomplete or malformed. Fix it.

BROKEN JSON (first 1500 chars):
{raw_text[:1500]}

REQUIREMENTS:
1. Must be valid JSON with "topics" array
2. Each topic needs: title (string), estimatedHours (number), referenceLinks (array of URLs), subtopics (array of strings), priority (High/Medium/Low)
3. At least {max(5, len(raw_text.split('title')) - 1)} topics
4. estimatedHours sum ≈ {case.get('days', 30) * case.get('hoursPerDay', 4)}
5. NO markdown, NO extra text. ONLY JSON.

Response format:
{{"topics": [...]}}"""
    
    try:
        repaired_text = call_groq(repair_prompt, config, retries=2)
        if repaired_text:
            data = extract_json_from_text(repaired_text)
            if data:
                roadmap = Roadmap(**data)
                return roadmap.model_dump()
    except Exception as e:
        safe_print(f"  Repair failed: {e}")
    
    return None


# ========== MAIN EVALUATION ==========

def make_prompt(case: dict) -> str:
    """Create evaluation prompt."""
    return f"""Generate a structured learning roadmap.

**Position:** {case['position']}
**Company:** {case['company']}
**Duration:** {case['days']} days, {case['hoursPerDay']} hours/day (Total: {case['days'] * case['hoursPerDay']} hours)
**Focus:** {case['majorTopic']}

Create {max(8, (case['days'] * case['hoursPerDay']) // 15)}-{min(15, (case['days'] * case['hoursPerDay']) // 10)} topics.

CRITICAL: Respond with ONLY valid JSON. No markdown. No text.

Format:
{{
  "topics": [
    {{
      "title": "Topic Name",
      "estimatedHours": 20,
      "priority": "High",
      "referenceLinks": ["https://www.google.com/search?q=topic"],
      "subtopics": ["Subtopic 1", "Subtopic 2"]
    }}
  ]
}}"""


def validate_roadmap(roadmap: dict, case: dict) -> dict:
    """Validate roadmap against requirements."""
    try:
        # Pydantic validation
        roadmap_obj = Roadmap(**roadmap)
        topics = roadmap_obj.topics
        
        # Time-fit check
        total_hours = sum(t.estimatedHours for t in topics)
        target_hours = case['days'] * case['hoursPerDay']
        tolerance = target_hours * 0.20
        time_fit_ok = abs(total_hours - target_hours) <= tolerance
        
        return {
            'parse_ok': True,
            'schema_ok': True,
            'time_fit_ok': time_fit_ok,
            'total_hours': total_hours,
            'target_hours': target_hours,
            'num_topics': len(topics),
            'error': None
        }
    except ValidationError as e:
        return {
            'parse_ok': False,
            'schema_ok': False,
            'time_fit_ok': False,
            'total_hours': None,
            'target_hours': case['days'] * case['hoursPerDay'],
            'num_topics': 0,
            'error': str(e)[:200]
        }


def run_case(case: dict, case_id: str, output_dir: str, config: dict) -> dict:
    """Run single evaluation case."""
    
    safe_print(f"[{case_id}] {case['position']} @ {case['company']}...", end=" ", flush=True)
    
    prompt = make_prompt(case)
    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
    
    try:
        if config['mock']:
            response_text = mock_groq(case)
        else:
            response_text = call_groq(prompt, config)
            
        if not response_text:
            raise Exception("No response from API")
        
        # Try to extract and validate JSON
        raw_data = extract_json_from_text(response_text)
        if not raw_data:
            safe_print("Extracting JSON...", end=" ")
            raw_data = repair_json_with_pydantic(response_text, case, config)
        
        if not raw_data:
            raise Exception("Could not extract JSON")
        
        # Validate with Pydantic
        validation = validate_roadmap(raw_data, case)
        
        if validation['schema_ok']:
            safe_print(f"ok - {validation['num_topics']} topics, {validation['total_hours']}h")
            result_file = f"{output_dir}/{case_id}.json"
        else:
            safe_print(f"fail - Schema error: {validation['error'][:50]}")
            result_file = f"{output_dir}/{case_id}.failed.json"
        
        # Save response
        response_data = {
            'meta': {
                'case': case,
                'prompt_hash': prompt_hash,
                'model': config['model'] if not config['mock'] else 'mock',
                'timestamp': datetime.now().isoformat(),
            },
            'raw': {
                'content': response_text,
            },
            'parsed': raw_data,
            'validation': validation
        }
        
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(response_data, f, indent=2, ensure_ascii=False)
        
        return {
            'case_id': case_id,
            'ok': validation['schema_ok'] and validation['time_fit_ok'],
            'schema_ok': validation['schema_ok'],
            'parse_ok': validation['parse_ok'],
            'time_fit_ok': validation['time_fit_ok'],
            'total_hours': validation['total_hours'],
            'target_hours': validation['target_hours'],
            'prompt_hash': prompt_hash,
            'response_file': result_file,
            'error': validation['error']
        }
    
    except Exception as e:
        safe_print(f"fail - Error: {str(e)[:50]}")
        return {
            'case_id': case_id,
            'ok': False,
            'schema_ok': False,
            'parse_ok': False,
            'time_fit_ok': False,
            'total_hours': None,
            'target_hours': case['days'] * case['hoursPerDay'],
            'prompt_hash': prompt_hash,
            'response_file': None,
            'error': str(e)[:200]
        }


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Evaluate roadmap generation with Pydantic validation')
    parser.add_argument('--input', default='sample_inputs_15.json', help='Input cases file')
    parser.add_argument('--out', default='runs_pydantic', help='Output directory')
    args = parser.parse_args()
    
    # Load config
    config = get_groq_config()
    safe_print(f"\nRoadmap Evaluation (Pydantic V2 + {config['model']})")
    safe_print(f"   API: {config['base_url']}")
    safe_print(f"   Mock Mode: {config['mock']}")
    
    # Create output directory
    Path(args.out).mkdir(exist_ok=True)
    
    # Load cases
    with open(args.input, 'r', encoding='utf-8') as f:
        cases = json.load(f)
    
    # Run evaluation
    safe_print(f"   Running {len(cases)} cases...\n")
    results = {
        'run_started': datetime.now().isoformat(),
        'model': config['model'] if not config['mock'] else 'mock',
        'base_url': config['base_url'],
        'results': []
    }
    
    for i, case in enumerate(cases, 1):
        case_id = f"case_{i:03d}"
        result = run_case(case, case_id, args.out, config)
        results['results'].append(result)
        if not config['mock'] and i < len(cases):
            import time
            time.sleep(5)
    
    # Summary
    passed = sum(1 for r in results['results'] if r['ok'])
    safe_print(f"\n{'='*60}")
    safe_print(f"Results: {passed}/{len(cases)} passed ({passed/len(cases)*100:.0f}%)")
    safe_print(f"{'='*60}\n")
    
    # Save manifest
    results['summary'] = {
        'total': len(cases),
        'passed': passed,
        'failed': len(cases) - passed
    }
    
    manifest_file = f"{args.out}/manifest_pydantic.json"
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    safe_print(f"Results saved to {manifest_file}")


if __name__ == '__main__':
    main()
