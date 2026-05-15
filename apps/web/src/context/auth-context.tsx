import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getCookie } from "@/lib/api";

type AuthContextValue = {
  userId: string | null;
  isAuthenticated: boolean;
  refreshUser: () => void;
  markAuthenticated: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getCookie("cb_user_id"));
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(getCookie("cb_user_id")),
  );

  const refreshUser = useCallback(() => {
    const nextUserId = getCookie("cb_user_id");
    setUserId(nextUserId);
    setIsAuthenticated(Boolean(nextUserId));
  }, []);

  const markAuthenticated = useCallback(() => {
    setUserId(getCookie("cb_user_id"));
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ ok: true }>("/v1/auth/logout", {
        method: "POST",
        body: {},
        retry: false,
      });
    } finally {
      setUserId(null);
      setIsAuthenticated(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      isAuthenticated,
      refreshUser,
      markAuthenticated,
      logout,
    }),
    [isAuthenticated, logout, markAuthenticated, refreshUser, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
