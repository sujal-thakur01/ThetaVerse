import { Link, useNavigate } from "react-router-dom";
import { BrainCircuit, User, LogOut } from "lucide-react";
import { useStoreContext } from "../contextApi/ContextApi";
import { withExecutionLog } from "../utils/executionLogger";

export default function Navbar() {
  const { token, setToken, currentUser } = useStoreContext();
  const isInterviewer = currentUser?.role === "INTERVIEWER";
  const navigate = useNavigate();

  const handleSignOut = withExecutionLog("Navbar.handleSignOut", () => {
    setToken(null);
    navigate("/login");
  });

  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              EDAI<span className="text-indigo-400">.</span>
            </span>
          </Link>
        </div>
        <div className="flex gap-6 text-sm font-medium text-neutral-400">
          <Link to="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          {!isInterviewer && (
            <Link
              to="/roadmap/user"
              className="hover:text-white transition-colors"
            >
              Roadmap
            </Link>
          )}
          <Link
            to="/interview/setup"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Interview
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {token ? (
            <>
              <Link
                to="/dashboard"
                className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 transition hover:bg-neutral-700"
                title="Profile"
              >
                <User className="w-4 h-4 text-neutral-400" />
              </Link>
              <button
                onClick={handleSignOut}
                className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 transition hover:bg-red-500/20"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 transition hover:bg-neutral-700"
              title="Sign In"
            >
              <User className="w-4 h-4 text-neutral-400" />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
