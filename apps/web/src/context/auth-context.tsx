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
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getCookie("cb_user_id"));

  const refreshUser = useCallback(() => {
    setUserId(getCookie("cb_user_id"));
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
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      isAuthenticated: Boolean(userId),
      refreshUser,
      logout,
    }),
    [logout, refreshUser, userId],
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
