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
  profileIdentity: ProfileMeResponse["identity"] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  markAuthenticated: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getCookie("cb_user_id"));
  const [profileIdentity, setProfileIdentity] = useState<
    ProfileMeResponse["identity"] | null
  >(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const currentPath = window.location.pathname;
      const isPublicRoute =
        currentPath === "/" ||
        currentPath === "/auth" ||
        currentPath === "/auth/callback";
      const cookieUserId = getCookie("cb_user_id");

      if (isPublicRoute && !cookieUserId) {
        setUserId(null);
        setProfileIdentity(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (!isMounted) {
          return;
        }
        setUserId(getCookie("cb_user_id") ?? profile.identity.primaryEmail);
        setProfileIdentity(profile.identity);
        setIsAuthenticated(true);
      } catch {
        if (!isMounted) {
          return;
        }
        clearContactBookSessionState();
        setUserId(null);
        setProfileIdentity(null);
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

  const refreshUser = useCallback(async () => {
    const nextUserId = getCookie("cb_user_id");

    if (!nextUserId) {
      setUserId(null);
      setProfileIdentity(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await apiFetch<ProfileMeResponse>("/v1/profile/me");
      setUserId(getCookie("cb_user_id") ?? profile.identity.primaryEmail);
      setProfileIdentity(profile.identity);
      setIsAuthenticated(true);
    } catch {
      setUserId(nextUserId);
      setProfileIdentity(null);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAuthenticated = useCallback(() => {
    localStorage.removeItem(GOOGLE_CONNECTED_KEY);
    setUserId(getCookie("cb_user_id"));
    setProfileIdentity(null);
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
      setProfileIdentity(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      profileIdentity,
      isAuthenticated,
      isLoading,
      refreshUser,
      markAuthenticated,
      logout,
    }),
    [
      isAuthenticated,
      isLoading,
      logout,
      markAuthenticated,
      profileIdentity,
      refreshUser,
      userId,
    ],
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
