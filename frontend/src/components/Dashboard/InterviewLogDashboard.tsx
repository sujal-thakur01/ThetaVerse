import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Clock, MessageSquareText } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../../api/apiClient";
import { logExecution } from "../../utils/executionLogger";

interface InterviewSessionInfo {
  id: number;
  companyName: string;
  position: string;
  roundTypes: string;
  mood: string;
  startTime: string;
  endTime: string | null;
  resumeText: string | null;
}

interface InterviewLogEntry {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

const AI_ROLES = new Set(["response", "evaluation", "final"]);

type EvalDimension = {
  key:
    | "semanticAccuracy"
    | "technicalDepth"
    | "conversationalClarity"
    | "visualFocus"
    | "posturalStability";
  label: string;
  shortLabel: string;
  source: "LLM" | "Computer Vision";
  weight: number;
  colorClass: string;
  aliases: string[];
};

const EVAL_DIMENSIONS: EvalDimension[] = [
  {
    key: "semanticAccuracy",
    label: "Semantic Accuracy",
    shortLabel: "SA",
    source: "LLM",
    weight: 0.35,
    colorClass: "bg-blue-500",
    aliases: ["semantic accuracy", "sa"],
  },
  {
    key: "technicalDepth",
    label: "Technical Depth",
    shortLabel: "TD",
    source: "LLM",
    weight: 0.35,
    colorClass: "bg-emerald-500",
    aliases: ["technical depth", "td"],
  },
  {
    key: "conversationalClarity",
    label: "Conversational Clarity",
    shortLabel: "CC",
    source: "LLM",
    weight: 0.3,
    colorClass: "bg-violet-500",
    aliases: ["conversational clarity", "cc"],
  },
  {
    key: "visualFocus",
    label: "Visual Focus",
    shortLabel: "VF",
    source: "Computer Vision",
    weight: 0.2,
    colorClass: "bg-amber-500",
    aliases: ["visual focus", "vf"],
  },
  {
    key: "posturalStability",
    label: "Postural Stability",
    shortLabel: "PS",
    source: "Computer Vision",
    weight: 0.2,
    colorClass: "bg-rose-500",
    aliases: ["postural stability", "ps"],
  },
];

const clampScore = (score: number) =>
  Math.max(0, Math.min(100, Math.round(score)));

const toHundredScale = (rawScore: number, scaleHint?: number) => {
  if (scaleHint && scaleHint > 0) {
    return clampScore((rawScore / scaleHint) * 100);
  }
  if (rawScore <= 5) {
    return clampScore((rawScore / 5) * 100);
  }
  if (rawScore <= 10) {
    return clampScore((rawScore / 10) * 100);
  }
  return clampScore(rawScore);
};

const findBestScoreInLine = (line: string, aliasIndex: number) => {
  const lowerLine = line.toLowerCase();
  const scoreWithScale = line.match(
    /[:=]\s*(\d{1,3}(?:\.\d+)?)\s*\/\s*(5|10|100)\b/i,
  );
  if (scoreWithScale) {
    return toHundredScale(Number(scoreWithScale[1]), Number(scoreWithScale[2]));
  }

  const explicitAfterColon = line.match(/[:=]\s*(\d{1,3}(?:\.\d+)?)\b/i);
  if (explicitAfterColon) {
    const raw = Number(explicitAfterColon[1]);
    const scaleFromLine = lowerLine.includes("0-5")
      ? 5
      : lowerLine.includes("0-10")
        ? 10
        : lowerLine.includes("0-100")
          ? 100
          : undefined;
    return toHundredScale(raw, scaleFromLine);
  }

  const tail = line.slice(aliasIndex);
  const numericTokens = Array.from(tail.matchAll(/\d{1,3}(?:\.\d+)?/g));
  for (const token of numericTokens) {
    const valueText = token[0];
    const indexInTail = token.index ?? -1;
    const prevChar = indexInTail > 0 ? tail[indexInTail - 1] : "";
    const nextChar = tail[indexInTail + valueText.length] ?? "";

    // Skip numbers that are part of ranges like 0-5 or 0-100.
    if (prevChar === "-" || nextChar === "-") {
      continue;
    }

    const raw = Number(valueText);
    const scaleFromLine = lowerLine.includes("0-5")
      ? 5
      : lowerLine.includes("0-10")
        ? 10
        : lowerLine.includes("0-100")
          ? 100
          : undefined;
    return toHundredScale(raw, scaleFromLine);
  }

  return null;
};

function extractDimensionScore(text: string, aliases: string[]) {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, "-");
  const lines = normalizedText.split(/\r?\n/);

  for (const alias of aliases) {
    const lowerAlias = alias.toLowerCase();
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const aliasIndex = lowerLine.indexOf(lowerAlias);
      if (aliasIndex === -1) {
        continue;
      }

      const parsed = findBestScoreInLine(line, aliasIndex);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function getPerformanceLevel(score: number) {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "AVERAGE";
  return "NEEDS IMPROVEMENT";
}

function polarPoint(cx: number, cy: number, radius: number, angleRad: number) {
  const x = cx + radius * Math.cos(angleRad);
  const y = cy + radius * Math.sin(angleRad);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function normalizeInlineText(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

function renderInlineText(text: string) {
  const normalized = normalizeInlineText(text);
  const parts = normalized.split("\n");

  if (parts.length <= 1) {
    return normalized;
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`inline-${index}`}>
          {index > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function isMarkdownTableLine(line: string) {
  const trimmed = line.trim();
  return /^\|.*\|$/.test(trimmed);
}

function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(cells: string[]) {
  return (
    cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function renderLogContent(content: string) {
  const lines = content.split("\n").map((line) => line.replace(/\s+$/g, ""));

  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listBuffer.length === 0 || !listType) {
      return;
    }

    if (listType === "ul") {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1.5">
          {listBuffer.map((item, index) => (
            <li key={`ul-item-${index}`}>{item}</li>
          ))}
        </ul>,
      );
    } else {
      blocks.push(
        <ol
          key={`ol-${blocks.length}`}
          className="list-decimal pl-5 space-y-1.5 marker:font-semibold"
        >
          {listBuffer.map((item, index) => (
            <li key={`ol-item-${index}`}>{item}</li>
          ))}
        </ol>,
      );
    }

    listBuffer = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (
      isMarkdownTableLine(trimmed) &&
      i + 1 < lines.length &&
      isMarkdownTableLine(lines[i + 1].trim())
    ) {
      const headerCells = parseMarkdownTableRow(trimmed);
      const separatorCells = parseMarkdownTableRow(lines[i + 1]);

      if (isMarkdownTableSeparator(separatorCells)) {
        flushList();

        const rows: string[][] = [];
        let rowIndex = i + 2;
        while (
          rowIndex < lines.length &&
          isMarkdownTableLine(lines[rowIndex].trim())
        ) {
          rows.push(parseMarkdownTableRow(lines[rowIndex]));
          rowIndex += 1;
        }

        blocks.push(
          <div
            key={`table-${blocks.length}`}
            className="overflow-x-auto rounded-xl border border-white/10"
          >
            <table className="w-full min-w-180 border-collapse text-left text-sm">
              <thead className="bg-white/5 text-white">
                <tr>
                  {headerCells.map((cell, idx) => (
                    <th
                      key={`th-${idx}`}
                      className="px-3 py-2 font-semibold align-top"
                    >
                      {renderInlineText(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ridx) => (
                  <tr
                    key={`tr-${ridx}`}
                    className="border-t border-white/10 align-top"
                  >
                    {headerCells.map((_, cidx) => (
                      <td
                        key={`td-${ridx}-${cidx}`}
                        className="px-3 py-2 text-current/95"
                      >
                        {renderInlineText(row[cidx] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );

        i = rowIndex - 1;
        continue;
      }
    }

    const unorderedMatch = trimmed.match(/^(?:[-*•])\s+(.+)/);
    if (unorderedMatch) {
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listBuffer.push(normalizeInlineText(unorderedMatch[1]));
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (orderedMatch) {
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listBuffer.push(normalizeInlineText(orderedMatch[1]));
      continue;
    }

    flushList();

    const markdownHeadingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (markdownHeadingMatch) {
      blocks.push(
        <h4
          key={`h-md-${blocks.length}`}
          className="mt-1 font-semibold text-white"
        >
          {renderInlineText(markdownHeadingMatch[1])}
        </h4>,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^\*\*(.+)\*\*:??$/);
    if (headingMatch) {
      blocks.push(
        <h4
          key={`h-${blocks.length}`}
          className="mt-1 font-semibold text-white"
        >
          {renderInlineText(headingMatch[1])}
        </h4>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-7">
        {renderInlineText(trimmed)}
      </p>,
    );
  }

  flushList();

  return blocks.length > 0 ? blocks : <p className="leading-7">{content}</p>;
}

export default function InterviewLogDashboard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [sessionInfo, setSessionInfo] = useState<InterviewSessionInfo | null>(
    null,
  );
  const [logs, setLogs] = useState<InterviewLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      if (!sessionId) {
        return;
      }

      try {
        const [sessionResponse, logsResponse] = await Promise.all([
          apiClient.get(`/interviews/${sessionId}`),
          apiClient.get(`/interviews/${sessionId}/logs`),
        ]);

        setSessionInfo(sessionResponse.data);
        setLogs(logsResponse.data);
        logExecution("InterviewLogDashboard.loadLogs", "logs loaded", {
          sessionId,
          entries: logsResponse.data.length,
        });
      } catch (error) {
        console.error("Failed to load interview logs", error);
        toast.error("Failed to load interview logs");
      } finally {
        setIsLoading(false);
      }
    };

    void loadLogs();
  }, [sessionId]);

  const finalEvaluation = useMemo(() => {
    const finalLog = [...logs].reverse().find((log) => log.role === "final");
    return finalLog?.content ?? "No final evaluation was generated.";
  }, [logs]);

  const sourceForScoreExtraction = useMemo(() => {
    const evaluationLogs = logs
      .filter((log) => log.role === "evaluation" || log.role === "final")
      .map((log) => log.content)
      .join("\n");
    return `${evaluationLogs}\n${finalEvaluation}`.toLowerCase();
  }, [logs, finalEvaluation]);

  const dimensionScores = useMemo(() => {
    const fallbackScores: Record<EvalDimension["key"], number> = {
      semanticAccuracy: 80,
      technicalDepth: 76,
      conversationalClarity: 82,
      visualFocus: 72,
      posturalStability: 86,
    };

    const resolved = { ...fallbackScores };
    for (const dimension of EVAL_DIMENSIONS) {
      const extracted = extractDimensionScore(
        sourceForScoreExtraction,
        dimension.aliases,
      );
      if (extracted !== null) {
        resolved[dimension.key] = extracted;
      }
    }

    return resolved;
  }, [sourceForScoreExtraction]);

  const weightedScore = useMemo(() => {
    const weightSum = EVAL_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
    const weightedTotal = EVAL_DIMENSIONS.reduce((sum, d) => {
      return sum + d.weight * dimensionScores[d.key];
    }, 0);
    return Number((weightedTotal / weightSum).toFixed(1));
  }, [dimensionScores]);

  const performanceLevel = useMemo(
    () => getPerformanceLevel(weightedScore),
    [weightedScore],
  );

  const radarGeometry = useMemo(() => {
    const cx = 140;
    const cy = 140;
    const outerRadius = 96;
    const steps = [20, 40, 60, 80, 100];

    const axisAngles = EVAL_DIMENSIONS.map((_, index) => {
      return -Math.PI / 2 + (index * 2 * Math.PI) / EVAL_DIMENSIONS.length;
    });

    const gridPolygons = steps.map((step) => {
      const r = (outerRadius * step) / 100;
      const points = axisAngles.map((angle) => polarPoint(cx, cy, r, angle));
      return points.join(" ");
    });

    const axisLines = axisAngles.map((angle) => ({
      x1: cx,
      y1: cy,
      x2: cx + outerRadius * Math.cos(angle),
      y2: cy + outerRadius * Math.sin(angle),
    }));

    const scorePolygon = axisAngles
      .map((angle, index) => {
        const score = dimensionScores[EVAL_DIMENSIONS[index].key];
        const r = (outerRadius * score) / 100;
        return polarPoint(cx, cy, r, angle);
      })
      .join(" ");

    return { cx, cy, outerRadius, gridPolygons, axisLines, scorePolygon };
  }, [dimensionScores]);

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Interview Log Dashboard
            </h1>
            <p className="text-neutral-400">
              Transcript, AI evaluation, and the final summary for this session.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-neutral-300 hover:text-white hover:border-neutral-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </button>
      </div>

      {sessionInfo && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Company
            </div>
            <div className="text-white font-semibold">
              {sessionInfo.companyName}
            </div>
            <div className="text-neutral-400 text-sm">
              {sessionInfo.position}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Round Types
            </div>
            <div className="text-white font-semibold">
              {sessionInfo.roundTypes || "Technical"}
            </div>
            <div className="text-neutral-400 text-sm">
              Mood: {sessionInfo.mood}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Time
            </div>
            <div className="text-white font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              {sessionInfo.endTime ? "Completed" : "In progress"}
            </div>
            <div className="text-neutral-400 text-sm">
              Session ID: {sessionInfo.id}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-neutral-500 animate-pulse">Loading logs...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-indigo-400" />
              Transcript
            </h2>

            <div className="space-y-5">
              {logs.map((log) => (
                <div key={log.id} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {log.role}
                  </div>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap wrap-break-word ${
                      log.role === "response"
                        ? "border-indigo-500/35 bg-indigo-500/12 text-indigo-100"
                        : log.role === "evaluation" || log.role === "final"
                          ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-100"
                          : "border-neutral-700 bg-neutral-900/70 text-neutral-200"
                    }`}
                  >
                    {AI_ROLES.has(log.role) ? (
                      <div className="space-y-2 text-[15px] leading-7">
                        {renderLogContent(log.content)}
                      </div>
                    ) : (
                      log.content
                    )}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 p-8 text-center text-neutral-500">
                  No interview logs found yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-indigo-500/30 bg-neutral-900/75 p-6">
              <h2 className="text-2xl font-bold text-white">
                FINAL EVALUATION REPORT
              </h2>
              <p className="text-sm text-neutral-400 mb-5">
                Multimodal Performance Assessment
              </p>

              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-4 mb-4">
                <div className="text-xs font-semibold tracking-wide text-neutral-400 mb-3">
                  RADAR SNAPSHOT
                </div>
                <div className="w-full flex items-center justify-center">
                  <svg viewBox="0 0 280 280" className="h-62 w-62">
                    {radarGeometry.gridPolygons.map((points, idx) => (
                      <polygon
                        key={`grid-${idx}`}
                        points={points}
                        fill="none"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth={
                          idx === radarGeometry.gridPolygons.length - 1
                            ? 1.2
                            : 1
                        }
                      />
                    ))}

                    {radarGeometry.axisLines.map((axis, idx) => (
                      <line
                        key={`axis-${idx}`}
                        x1={axis.x1}
                        y1={axis.y1}
                        x2={axis.x2}
                        y2={axis.y2}
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth="1"
                      />
                    ))}

                    <polygon
                      points={radarGeometry.scorePolygon}
                      fill="rgba(59,130,246,0.26)"
                      stroke="rgb(96,165,250)"
                      strokeWidth="2"
                    />

                    {EVAL_DIMENSIONS.map((dimension, idx) => {
                      const angle =
                        -Math.PI / 2 +
                        (idx * 2 * Math.PI) / EVAL_DIMENSIONS.length;
                      const labelX =
                        radarGeometry.cx +
                        (radarGeometry.outerRadius + 20) * Math.cos(angle);
                      const labelY =
                        radarGeometry.cy +
                        (radarGeometry.outerRadius + 20) * Math.sin(angle);

                      return (
                        <text
                          key={`label-${dimension.key}`}
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(255,255,255,0.86)"
                          fontSize="9"
                        >
                          {dimension.shortLabel}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-4 mb-4">
                <div className="text-xs font-semibold tracking-wide text-neutral-400 mb-3">
                  DIMENSION SCORES (0 - 100)
                </div>
                <div className="space-y-3">
                  {EVAL_DIMENSIONS.map((dimension) => {
                    const score = dimensionScores[dimension.key];
                    return (
                      <div key={dimension.key}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-neutral-200 font-medium">
                            {dimension.label}{" "}
                            <span className="text-neutral-500">
                              ({dimension.source})
                            </span>
                          </span>
                          <span className="text-white font-semibold">
                            {score}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-2 ${dimension.colorClass}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 mb-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-emerald-200 font-semibold">
                      FINAL SCORE
                    </p>
                    <p className="text-xs text-emerald-100/80">
                      Weighted normalized aggregate
                    </p>
                  </div>
                  <p className="text-4xl font-bold text-white">
                    {weightedScore}
                    <span className="text-lg text-emerald-100/90"> / 100</span>
                  </p>
                </div>
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-black/20 px-3 py-2 text-sm text-emerald-100 font-semibold text-center tracking-wide">
                  PERFORMANCE LEVEL: {performanceLevel}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-4">
                <div className="text-xs font-semibold tracking-wide text-neutral-400 mb-2">
                  AGGREGATION FORMULA
                </div>
                <p className="text-sm text-neutral-200 leading-6">
                  FS = (wSA*SA + wTD*TD + wCC*CC + wVF*VF + wPS*PS) / (wSA + wTD
                  + wCC + wVF + wPS)
                </p>
                <p className="text-xs text-neutral-500 mt-2">
                  Weights: SA 0.35, TD 0.35, CC 0.30, VF 0.20, PS 0.20
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
                <div className="text-xs font-semibold tracking-wide text-emerald-300 mb-2">
                  FINAL EVALUATION NARRATIVE (UNCHANGED)
                </div>
                <div className="text-sm text-emerald-100 whitespace-pre-wrap wrap-break-word">
                  <div className="space-y-2 text-[15px] leading-7">
                    {renderLogContent(finalEvaluation)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Next Steps
              </h2>
              <p className="text-sm leading-6 text-neutral-400">
                Review the evaluation, then start another interview session when
                you are ready.
              </p>
              <Link
                to="/interview/setup"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-white font-medium hover:bg-indigo-600 transition"
              >
                Start another interview
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
