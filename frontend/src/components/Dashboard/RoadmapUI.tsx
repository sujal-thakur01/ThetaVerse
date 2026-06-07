import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Map,
  Clock,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Target,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../../api/apiClient";
import { logExecution, withExecutionLog } from "../../utils/executionLogger";

interface RoadmapTopic {
  id: number;
  title: string;
  priority: string;
  estimatedHours: number;
  isCompleted: boolean;
  sequenceOrder: number;
  referenceLinks: string;
  subtopics?: { title: string; isCompleted: boolean }[];
}

export default function RoadmapUI() {
  const { roadmapId } = useParams();
  const [topics, setTopics] = useState<RoadmapTopic[]>([]);
  const [ghostData, setGhostData] = useState({
    ghostPace: 0.28,
    ghostScore: 0,
    userScore: 0,
    isBehind: false,
  });

  // In a real scenario we fetch the complete roadmap including topics and ghost profile.
  // For MVP we can just display the UI and try to load.
  // Actually, we should fetch it. Let's add a quick mock fallback if backend fails.
  useEffect(() => {
    apiClient
      .get(`/roadmaps/${roadmapId}`)
      .then((res) => {
        if (res.data.topics) setTopics(res.data.topics);
        logExecution("RoadmapUI.loadRoadmap", "roadmap loaded", {
          topics: res.data.topics?.length || 0,
        });
      })
      .catch(() => {
        toast.error("Could not load roadmap flow");
        logExecution("RoadmapUI.loadRoadmap", "roadmap load failed");
      });

    apiClient
      .get(`/ghosts/roadmap/${roadmapId}`)
      .then((res) => {
        setGhostData(res.data);
        logExecution("RoadmapUI.loadGhostData", "ghost pace loaded", {
          ghostScore: res.data.ghostScore,
        });
      })
      .catch((err) => console.log("Ghost score fetch failed", err));
  }, [roadmapId]);

  const handleCompleteTask = withExecutionLog(
    "RoadmapUI.handleCompleteTask",
    async (topicId: number) => {
      try {
        await apiClient.put(`/roadmaps/topics/${topicId}/complete`);
        setTopics((prev) =>
          prev.map((t) => (t.id === topicId ? { ...t, isCompleted: true } : t)),
        );
        toast.success("Topic marked as completed!");
        // Update ghost data optimistically
        setGhostData((prev) => ({
          ...prev,
          userScore: prev.userScore + 1,
          isBehind: prev.userScore + 1 < prev.ghostScore,
        }));
      } catch (err) {
        toast.error("Failed to update topic status");
      }
    },
  );

  const handleSubtopicComplete = withExecutionLog(
    "RoadmapUI.handleSubtopicComplete",
    async (topicId: number, subtopicTitle: string) => {
      try {
        await apiClient.put(
          `/roadmaps/topics/${topicId}/subtopics/complete?subtopicTitle=${encodeURIComponent(subtopicTitle)}`,
        );
        setTopics((prev) =>
          prev.map((t) => {
            if (t.id === topicId && t.subtopics) {
              return {
                ...t,
                subtopics: t.subtopics.map((sub) =>
                  sub.title === subtopicTitle
                    ? { ...sub, isCompleted: true }
                    : sub,
                ),
              };
            }
            return t;
          }),
        );
      } catch (err) {
        toast.error("Failed to update subtopic");
      }
    },
  );

  return (
    <div className="flex-1 max-w-full mx-auto w-full px-4 md:px-6 py-8 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 min-h-screen">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col gap-2 mb-10">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Your Learning Race
          </h1>
          <div className="px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border border-emerald-500/30 shadow-lg">
            <Sparkles className="w-4 h-4 animate-pulse" /> AI Powered
          </div>
        </div>
        <p className="text-neutral-300 text-base md:text-lg font-light">
          Beat the ghost pace and complete your roadmap on time.
        </p>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* ===== UNIFIED RACE VISUALIZATION ===== */}
        <div className="relative bg-gradient-to-br from-slate-900/80 via-neutral-900/80 to-slate-950/80 border border-emerald-500/20 rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-indigo-500" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(16,185,129,.05) 25%, rgba(16,185,129,.05) 26%, transparent 27%, transparent 74%, rgba(16,185,129,.05) 75%, rgba(16,185,129,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(16,185,129,.05) 25%, rgba(16,185,129,.05) 26%, transparent 27%, transparent 74%, rgba(16,185,129,.05) 75%, rgba(16,185,129,.05) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px'}}></div>
          </div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-500/20">
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                  The Race
                </h2>
                <p className="text-xs md:text-sm text-neutral-400">
                  {ghostData.isBehind 
                    ? "⚡ Falling behind! Push harder!" 
                    : "🔥 Ahead of pace! Keep momentum!"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl md:text-4xl font-bold">
                  <span className={ghostData.isBehind ? "text-rose-400" : "text-emerald-400"}>
                    {Math.round(((ghostData.userScore / (topics.length || 1)) * 100))}%
                  </span>
                </div>
                <p className="text-xs md:text-sm text-neutral-400">Your Progress</p>
              </div>
            </div>

            {/* Single Unified Track */}
            <div className="space-y-4">
              {/* Combined Race Track Visualization */}
              <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-700/30">
                <div className="relative w-full h-16 bg-neutral-800 rounded-lg overflow-hidden border border-emerald-500/20 shadow-inner">
                  {/* Track background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 to-neutral-800"></div>

                  {/* Ghost racer */}
                  <div
                    className="absolute top-1/4 h-1/2 w-12 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/50 transition-all duration-700 flex items-center justify-center text-lg font-bold animate-pulse z-20"
                    style={{
                      left: `calc(${Math.min(100, Math.max(5, (ghostData.ghostScore / (topics.length || 1)) * 100))}% - 24px)`,
                    }}
                    title="Ghost Pace"
                  >
                    👻
                  </div>

                  {/* User racer */}
                  <div
                    className="absolute top-1/4 h-1/2 w-12 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-lg shadow-emerald-500/50 transition-all duration-700 flex items-center justify-center text-lg font-bold z-30"
                    style={{
                      left: `calc(${Math.min(100, Math.max(5, (ghostData.userScore / (topics.length || 1)) * 100))}% - 24px)`,
                    }}
                    title="Your Pace"
                  >
                    🎯
                  </div>

                  {/* Finish line */}
                  <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-cyan-400 shadow-lg shadow-emerald-500/50"></div>
                </div>

                {/* Stats below track */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center">
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Your Pace</p>
                    <p className="text-lg md:text-xl font-bold text-emerald-400">
                      {ghostData.userScore}/{topics.length}
                    </p>
                  </div>
                  <div className="text-center border-l border-r border-neutral-700">
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Gap</p>
                    <p className={`text-lg md:text-xl font-bold ${ghostData.isBehind ? "text-rose-400" : "text-emerald-400"}`}>
                      {ghostData.isBehind 
                        ? `${Math.abs(ghostData.userScore - ghostData.ghostScore).toFixed(1)}↓` 
                        : `${(ghostData.userScore - ghostData.ghostScore).toFixed(1)}↑`}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Ghost Pace</p>
                    <p className="text-lg md:text-xl font-bold text-indigo-400">
                      {Math.floor(ghostData.ghostScore)}/{topics.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 md:p-4">
                  <p className="text-xs text-cyan-300 font-semibold uppercase mb-1">Daily Target</p>
                  <p className="text-lg md:text-xl font-bold text-cyan-400">{ghostData.ghostPace.toFixed(2)} topics/day</p>
                </div>
                <div className={`border rounded-lg p-3 md:p-4 ${ghostData.isBehind ? "bg-rose-500/10 border-rose-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                  <p className={`text-xs font-semibold uppercase mb-1 ${ghostData.isBehind ? "text-rose-300" : "text-emerald-300"}`}>Status</p>
                  <p className={`text-lg md:text-xl font-bold ${ghostData.isBehind ? "text-rose-400" : "text-emerald-400"}`}>
                    {ghostData.isBehind ? "Catch Up!" : "On Track! 🔥"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert - Only show when behind */}
        {ghostData.isBehind && (
          <div className="bg-gradient-to-r from-rose-500/20 to-orange-500/20 border border-rose-500/40 px-4 md:px-6 py-3 md:py-4 rounded-xl flex items-start gap-3 shadow-lg animate-pulse">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h3 className="text-sm md:text-base font-bold text-rose-300 mb-1">Behind Schedule</h3>
              <p className="text-xs md:text-sm text-rose-200/80">
                Speed up to complete {Math.ceil(Math.abs(ghostData.userScore - ghostData.ghostScore))} more topics today!
              </p>
            </div>
          </div>
        )}

        {/* ===== COMPACT TIMELINE ===== */}
        <div className="bg-gradient-to-br from-neutral-900/80 via-slate-900/80 to-neutral-950/80 border border-neutral-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-700/50">
            <Map className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
            <h2 className="text-xl md:text-2xl font-bold text-white">Roadmap</h2>
            <span className="text-xs font-semibold text-neutral-400 bg-neutral-800/60 px-2.5 py-1 rounded-full ml-auto">
              {topics.length} topics
            </span>
          </div>

          {/* Compact Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[24rem] overflow-y-auto pr-2 roadmap-scrollbar">
            {topics.map((topic) => {
              const isGhostHere = topic.sequenceOrder === Math.floor(ghostData.ghostScore) + 1;
              const isUserHere = topic.sequenceOrder === Math.ceil(ghostData.userScore);
              const topicProgress = topic.subtopics 
                ? Math.round((topic.subtopics.filter(s => s.isCompleted).length / topic.subtopics.length) * 100) 
                : 0;

              return (
                <div
                  key={topic.id}
                  className={`rounded-lg border p-4 transition-all duration-300 ${
                    topic.isCompleted
                      ? "bg-emerald-950/40 border-emerald-500/40"
                      : "bg-neutral-800/30 border-neutral-700/50 hover:border-neutral-600"
                  }`}
                >
                  {/* Top Badge Row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        topic.isCompleted
                          ? "bg-emerald-400 border-emerald-300 text-neutral-900"
                          : "bg-neutral-700 border-neutral-600 text-neutral-300"
                      }`}>
                        {topic.sequenceOrder}
                      </div>
                      <span className={`text-xs font-bold tracking-wider uppercase ${
                        topic.priority === "High" ? "text-rose-400" : "text-amber-400"
                      }`}>
                        {topic.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {topic.estimatedHours}h
                    </div>
                  </div>

                  {/* Indicators */}
                  {(isGhostHere || isUserHere) && (
                    <div className="flex gap-2 mb-2 text-sm">
                      {isUserHere && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-semibold">🎯 You</span>}
                      {isGhostHere && <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold">👻 Ghost</span>}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className={`font-semibold text-sm mb-2 line-clamp-2 ${
                    topic.isCompleted ? "text-emerald-200 line-through" : "text-white"
                  }`}>
                    {topic.title}
                  </h3>

                  {/* Progress bar */}
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <div className="mb-3">
                      <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                          style={{ width: `${topicProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{topicProgress}% ({topic.subtopics.filter(s => s.isCompleted).length}/{topic.subtopics.length})</p>
                    </div>
                  )}

                  {/* Action */}
                  <button
                    disabled={topic.isCompleted}
                    onClick={() => handleCompleteTask(topic.id)}
                    className={`w-full text-xs font-semibold py-2 rounded-lg transition-all ${
                      topic.isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg hover:shadow-emerald-500/50"
                    }`}
                  >
                    {topic.isCompleted ? "✓ Done" : "Complete"}
                  </button>

                  {/* Details Dropdown */}
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <details className="mt-3 cursor-pointer">
                      <summary className="text-xs text-neutral-400 hover:text-neutral-300 font-semibold uppercase">
                        Subtopics ({topic.subtopics.length})
                      </summary>
                      <ul className="text-xs space-y-1.5 mt-2 pl-2 border-l border-neutral-600">
                        {topic.subtopics.map((sub, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                !sub.isCompleted &&
                                handleSubtopicComplete(topic.id, sub.title)
                              }
                              disabled={sub.isCompleted}
                              className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                                sub.isCompleted
                                  ? "bg-emerald-500 border-emerald-400 text-neutral-900"
                                  : "border-neutral-600 hover:border-emerald-400"
                              }`}
                            >
                              {sub.isCompleted && "✓"}
                            </button>
                            <span className={sub.isCompleted ? "line-through text-neutral-600" : "text-neutral-300"}>
                              {sub.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Reference Link */}
                  {topic.referenceLinks && (
                    <a
                      href={topic.referenceLinks}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold mt-3 flex items-center gap-1 group/link"
                    >
                      Reference <ExternalLink className="w-2.5 h-2.5 group-hover/link:translate-x-0.5 transition-transform" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

}
