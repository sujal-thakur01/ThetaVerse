import { useEffect } from "react";
import { logExecution } from "../utils/executionLogger";

export default function AboutPage() {
  useEffect(() => {
    logExecution("AboutPage", "rendered");
  }, []);

  return (
    <div className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full flex flex-col gap-6">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
        About EDAI
      </h1>
      <p className="text-neutral-400 text-lg leading-relaxed">
        EDAI is a next-generation platform designed to prepare candidates for
        rigorous technical interviews through realistic, AI-driven simulations.
      </p>
      <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl mt-4">
        <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
        <p className="text-neutral-400 leading-relaxed">
          We aim to democratize access to high-quality interview preparation. By
          leveraging cutting-edge AI models, MediaPipe for behavior tracking,
          and dynamic learning roadmaps, we provide feedback that was previously
          only available through expensive coaching.
        </p>
      </div>
    </div>
  );
}
