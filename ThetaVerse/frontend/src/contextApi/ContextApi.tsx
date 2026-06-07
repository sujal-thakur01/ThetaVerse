import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import apiClient from "../api/apiClient";
import { logExecution } from "../utils/executionLogger";

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface StoreContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  currentUser: CurrentUser | null;
  currentUserId: number | null;
  isAuthenticated: boolean;
  authLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("token");
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(Boolean(token));

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("token", newToken);
      logExecution("StoreProvider.setToken", "token stored", {
        hasToken: true,
      });
    } else {
      localStorage.removeItem("token");
      logExecution("StoreProvider.setToken", "token cleared", {
        hasToken: false,
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      if (!token) {
        if (!isMounted) {
          return;
        }

        setCurrentUser(null);
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);

      try {
        const response = await apiClient.get("/auth/me");
        if (!isMounted) {
          return;
        }

        setCurrentUser(response.data);
        setIsAuthenticated(true);
        logExecution("StoreProvider.validateSession", "session validated", {
          userId: response.data.id,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        logExecution("StoreProvider.validateSession", "session invalidated");
        setCurrentUser(null);
        setIsAuthenticated(false);
        setToken(null);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <StoreContext.Provider
      value={{
        token,
        setToken,
        currentUser,
        currentUserId: currentUser?.id ?? null,
        isAuthenticated,
        authLoading,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useStoreContext = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStoreContext must be used within a StoreProvider");
  }
  return context;
};
