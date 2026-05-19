import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getCookie } from "@/lib/api";
import {
  clearContactBookSessionState,
  GOOGLE_CONNECTED_KEY,
} from "@/lib/session-storage";
import { supabase } from "@/lib/supabase";
import type { ProfileMeResponse } from "@/lib/types";

type AuthContextValue = {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => void;
  markAuthenticated: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getCookie("cb_user_id"));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const profile = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (!isMounted) {
          return;
        }
        setUserId(getCookie("cb_user_id") ?? profile.identity.primaryEmail);
        setIsAuthenticated(true);
      } catch {
        if (!isMounted) {
          return;
        }
        clearContactBookSessionState();
        setUserId(null);
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshUser = useCallback(() => {
    const nextUserId = getCookie("cb_user_id");
    setUserId(nextUserId);
    setIsAuthenticated(Boolean(nextUserId));
    setIsLoading(false);
  }, []);

  const markAuthenticated = useCallback(() => {
    localStorage.removeItem(GOOGLE_CONNECTED_KEY);
    setUserId(getCookie("cb_user_id"));
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ ok: true }>("/v1/auth/logout", {
        method: "POST",
        body: {},
        retry: false,
      });
    } finally {
      clearContactBookSessionState();
      await supabase?.auth.signOut().catch(() => undefined);
      setUserId(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      isAuthenticated,
      isLoading,
      refreshUser,
      markAuthenticated,
      logout,
    }),
    [isAuthenticated, isLoading, logout, markAuthenticated, refreshUser, userId],
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
