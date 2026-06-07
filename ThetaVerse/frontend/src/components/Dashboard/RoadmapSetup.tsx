import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { Target, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useStoreContext } from "../../contextApi/ContextApi";
import { withExecutionLog } from "../../utils/executionLogger";

export default function RoadmapSetup() {
  const [companyName, setCompanyName] = useState("Google");
  const [position, setPosition] = useState("Frontend Engineer");
  const [majorTopic, setMajorTopic] = useState("React Performance");
  const [targetDays, setTargetDays] = useState(30);
  const [dailyHourLimit, setDailyHourLimit] = useState(4.0);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { currentUserId } = useStoreContext();

  const handleGenerate = withExecutionLog(
    "RoadmapSetup.handleGenerate",
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        if (!currentUserId) {
          toast.error("Please sign in again to generate a flow");
          return;
        }

        const res = await apiClient.post("/roadmaps/generate", {
          companyName,
          position,
          majorTopic,
          targetDays,
          dailyHourLimit,
          userId: currentUserId,
        });

        toast.success("Roadmap Flow Generated!");
        navigate(`/roadmap/${res.data.id}`);
      } catch (err) {
        toast.error("Failed to generate flow");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
  );

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Generate a Flow</h1>
            <p className="text-neutral-400">
              Create an AI-driven adaptive roadmap
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-300">
                Target Company
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-300">
                Target Position
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-300">
              Major Focus Topic
            </label>
            <input
              type="text"
              required
              value={majorTopic}
              onChange={(e) => setMajorTopic(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
              placeholder="e.g. System Design, React Performance"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-300">
                Target Days to Prepare
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                value={targetDays}
                onChange={(e) => setTargetDays(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-300">
                Daily Hours Available
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={dailyHourLimit}
                onChange={(e) => setDailyHourLimit(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            {isLoading ? "Generating syllabus with AI..." : "Generate Flow"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
