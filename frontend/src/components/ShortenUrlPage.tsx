import { useParams } from "react-router-dom";

export default function ShortenUrlPage() {
  const { url } = useParams();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold text-white mb-4">Resolving URL...</h2>
      <p className="text-neutral-400">
        Redirecting to destination for: <span className="text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded">{url}</span>
      </p>
      
      <div className="mt-8 flex gap-2">
         <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
         <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
         <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}
