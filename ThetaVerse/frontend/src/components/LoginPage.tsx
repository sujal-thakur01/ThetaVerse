import { Link, useNavigate } from "react-router-dom";
import { useStoreContext } from "../contextApi/ContextApi";
import toast from "react-hot-toast";
import { useState } from "react";
import { api } from "../api/apiClient";
import { withExecutionLog } from "../utils/executionLogger";

export default function LoginPage() {
  const { setToken } = useStoreContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = withExecutionLog(
    "LoginPage.handleLogin",
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const response = await api.login({ email, password });
        setToken(response.data.token);
        toast.success("Successfully logged in!");
        navigate("/dashboard");
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Login failed");
      } finally {
        setLoading(false);
      }
    },
  );

  return (
    <div className="flex-1 flex items-center justify-center p-6 w-full">
      <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl w-full max-w-md shadow-xl backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Welcome back
        </h2>
        <p className="text-neutral-400 mb-8">
          Enter your details to access your account.
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-300">
              Email
            </label>
            <input
              type="email"
              className="bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-neutral-300">
                Password
              </label>
              <a
                href="#"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              className="bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
