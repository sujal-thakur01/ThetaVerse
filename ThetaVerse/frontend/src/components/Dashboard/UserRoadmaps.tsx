import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Map, ArrowRight, Clock, Target } from "lucide-react";
import apiClient from "../../api/apiClient";
import { useStoreContext } from "../../contextApi/ContextApi";
import toast from "react-hot-toast";
import { logExecution } from "../../utils/executionLogger";

export default function UserRoadmaps() {
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();
  const { currentUserId } = useStoreContext();

  useEffect(() => {
    if (!currentUserId) {
      setIsLoading(false);
      setRoadmaps([]);
      logExecution("UserRoadmaps.loadRoadmaps", "skipped without user session");
      return;
    }

    apiClient
      .get(`/roadmaps/user/${currentUserId}`)
      .then((res) => {
        setRoadmaps(res.data);
        logExecution("UserRoadmaps.loadRoadmaps", "roadmaps loaded", {
          count: res.data.length,
        });
      })
      .catch((err) => {
        console.error("Failed to fetch roadmaps:", err);
        toast.error("Failed to load your flows");
        logExecution("UserRoadmaps.loadRoadmaps", "roadmaps load failed");
      })
      .finally(() => {
        setIsLoading(false);
        logExecution("UserRoadmaps.loadRoadmaps", "loading finished");
      });
  }, [currentUserId]);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">My Syllabus Flows</h1>
          <p className="text-neutral-400">
            Review your generated AI learning tracks
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-neutral-500 animate-pulse">Loading flows...</div>
      ) : roadmaps.length === 0 ? (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center max-w-2xl mx-auto">
          <Map className="w-16 h-16 text-neutral-700 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No Flows Yet
          </h3>
          <p className="text-neutral-400 mb-8">
            You haven't generated any learning roadmaps.
          </p>
          <button
            onClick={() => navigate("/roadmap/setup")}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition inline-flex items-center gap-2"
          >
            Generate a Flow <Target className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roadmaps.map((roadmap) => (
            <div
              key={roadmap.id}
              className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 hover:border-emerald-500/30 transition group flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                  {roadmap.targetProfile?.roleName || "Software Engineer"}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <Clock className="w-3.5 h-3.5" />
                  {roadmap.topics ? roadmap.topics.length : 0} Topics
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                {roadmap.targetProfile?.companyName || "Tech Company"}
              </h3>
              <p className="text-sm text-neutral-400 mb-6 flex-1">
                Started: {new Date(roadmap.createdAt).toLocaleDateString()}
              </p>

              <button
                onClick={() => navigate(`/roadmap/${roadmap.id}`)}
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition group-hover:bg-emerald-500/10 group-hover:text-emerald-400"
              >
                Resume Flow{" "}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
