import { Link } from "react-router-dom";
import { useEffect } from "react";
import { logExecution } from "../utils/executionLogger";

export default function Footer() {
  useEffect(() => {
    logExecution("Footer", "rendered");
  }, []);

  return (
    <footer className="border-t border-neutral-800 bg-neutral-900/50 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-neutral-500 text-sm">
        <p>&copy; {new Date().getFullYear()} EDAI. All rights reserved.</p>
        <div className="flex gap-4 mt-4">
          <Link to="/about" className="hover:text-white transition-colors">
            About
          </Link>
          <a href="#" className="hover:text-white transition-colors">
            Terms
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}
