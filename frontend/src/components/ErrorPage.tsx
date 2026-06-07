import { Link } from "react-router-dom";
import { useEffect } from "react";
import { logExecution } from "../utils/executionLogger";

interface ErrorPageProps {
  message?: string;
}

export default function ErrorPage({ message }: ErrorPageProps) {
  useEffect(() => {
    logExecution("ErrorPage", "rendered", {
      messageProvided: Boolean(message),
    });
  }, [message]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
      <div className="text-indigo-500 font-bold text-9xl mb-4 tracking-tighter mix-blend-screen">
        404
      </div>
      <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
        Page Not Found
      </h1>
      <p className="text-neutral-400 text-lg max-w-md mb-8">
        {message ||
          "The page you are looking for doesn't exist or has been moved."}
      </p>
      <Link
        to="/"
        className="bg-white text-neutral-950 font-semibold py-3 px-8 rounded-xl hover:bg-neutral-200 transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
