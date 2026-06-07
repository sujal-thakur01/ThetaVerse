import { Activity, Target, Bot, LineChart } from "lucide-react";
import { useEffect } from "react";
import { logExecution } from "../utils/executionLogger";

export default function LandingPage() {
  useEffect(() => {
    logExecution("LandingPage", "rendered");
  }, []);

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex flex-col gap-12">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
          Mock Interview{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Simulation
          </span>
        </h1>
        <p className="text-neutral-400 text-lg max-w-2xl">
          Real-time evaluation of your technical depth, communication skills,
          and focus levels using advanced AI.
        </p>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-3xl p-6 flex flex-col gap-4 hover:bg-neutral-900/60 transition-colors group cursor-pointer">
          <div className="bg-emerald-500/10 p-3 rounded-2xl w-fit text-emerald-400 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-200">
              Session Locked Focus
            </h3>
            <p className="text-neutral-500 text-sm mt-1 leading-relaxed">
              Active distraction detection via MediaPipe tracking posture and
              gaze during your interview.
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-3xl p-6 flex flex-col gap-4 hover:bg-neutral-900/60 transition-colors group cursor-pointer relative overflow-hidden">
          <div className="bg-cyan-500/10 p-3 rounded-2xl w-fit text-cyan-400 group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-200">
              Adaptive Roadmap
            </h3>
            <p className="text-neutral-500 text-sm mt-1 leading-relaxed">
              Dynamic study syllabus tailored strictly to your target company,
              role, and timeline.
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-3xl p-6 flex flex-col gap-4 hover:bg-neutral-900/60 transition-colors group cursor-pointer">
          <div className="bg-rose-500/10 p-3 rounded-2xl w-fit text-rose-400 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-200">
              Persona Interviewer
            </h3>
            <p className="text-neutral-500 text-sm mt-1 leading-relaxed">
              Choose Strict, Medium, or Friendly interviewer moods to match your
              preparation needs.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interface Preview */}
      <div className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900/30 overflow-hidden relative shadow-2xl flex flex-col md:flex-row h-[600px]">
        {/* Interviewer side */}
        <div className="w-full md:w-2/3 border-r border-neutral-800 flex flex-col relative">
          <div className="absolute top-6 left-6 flex gap-2">
            <span className="px-3 py-1 bg-neutral-800/80 backdrop-blur-md rounded-full text-xs font-semibold text-neutral-300 border border-neutral-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Recording
            </span>
          </div>

          {/* Fake video feed */}
          <div className="flex-1 bg-gradient-to-b from-neutral-800 to-neutral-900 flex items-center justify-center">
            <Bot className="w-32 h-32 text-neutral-700" />
          </div>

          {/* Controls */}
          <div className="h-24 bg-neutral-950/80 backdrop-blur-md border-t border-neutral-800 flex items-center justify-center gap-6">
            <button className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 transition-colors cursor-pointer group">
              <Activity className="w-5 h-5 text-white group-hover:text-indigo-400 transition" />
            </button>
            <button className="px-8 h-12 rounded-full bg-rose-500/10 text-rose-500 font-semibold hover:bg-rose-500/20 transition-colors border border-rose-500/20 cursor-pointer">
              End Session
            </button>
          </div>
        </div>

        {/* Transcript / Feedback side */}
        <div className="w-full md:w-1/3 bg-neutral-900/50 flex flex-col">
          <div className="p-6 border-b border-neutral-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <LineChart className="w-4 h-4 text-indigo-400" />
              Live Analysis
            </h3>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                AI Interviewer
              </div>
              <div className="bg-neutral-800/50 p-4 rounded-2xl rounded-tl-sm text-sm text-neutral-300 leading-relaxed border border-neutral-700/50">
                Can you explain how you would design a rate limiter for a
                distributed API gateway? What algorithms would you consider?
              </div>
            </div>

            <div className="flex flex-col gap-2 relative">
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider text-right">
                You
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl rounded-tr-sm text-sm text-indigo-100 leading-relaxed self-end w-[90%]">
                I would start by considering the Token Bucket algorithm. It's
                memory efficient and allows for burst of traffic...
              </div>

              {/* Contextual Warning Overlay */}
              <div className="absolute -bottom-8 right-0 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-md">
                ⚠️ Distraction detected (Looking away)
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
