import { Navigate } from "react-router-dom";
import { useStoreContext } from "./contextApi/ContextApi";
import { logExecution } from "./utils/executionLogger";

interface PrivateRouteProps {
  children: React.ReactNode;
  publicPage?: boolean;
}

export default function PrivateRoute({
  children,
  publicPage,
}: PrivateRouteProps) {
  const { isAuthenticated, authLoading } = useStoreContext();

  logExecution("PrivateRoute", "evaluating access", {
    publicPage: Boolean(publicPage),
    authenticated: isAuthenticated,
    authLoading,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center text-neutral-400">
        Validating session...
      </div>
    );
  }

  if (publicPage) {
    return isAuthenticated ? <Navigate to="/dashboard" /> : <>{children}</>;
  }

  return !isAuthenticated ? <Navigate to="/login" /> : <>{children}</>;
}
