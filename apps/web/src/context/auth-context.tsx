import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiFetch, getCookie } from "@/lib/api";
import {
  clearContactBookSessionState,
  GOOGLE_CONNECTED_KEY,
} from "@/lib/session-storage";
import { clearSessionTokens, hasClientSessionHint } from "@/lib/session-tokens";
import { supabase } from "@/lib/supabase";
import type { ProfileMeResponse } from "@/lib/types";

type AuthContextValue = {
  userId: string | null;
  profileIdentity: ProfileMeResponse["identity"] | null;
  profileOnboardingCompletedAt: string | null;
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
  const [profileOnboardingCompletedAt, setProfileOnboardingCompletedAt] =
    useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const currentPath = window.location.pathname;
      const isPublicRoute =
        currentPath === "/" ||
        currentPath === "/about" ||
        currentPath === "/contact" ||
        currentPath === "/privacy" ||
        currentPath === "/terms" ||
        currentPath === "/auth" ||
        currentPath === "/auth/callback";
      const cookieUserId = getCookie("cb_user_id");

      if (isPublicRoute && !cookieUserId && !hasClientSessionHint()) {
        if (!isMounted) {
          return;
        }
        setUserId(null);
        setProfileIdentity(null);
        setProfileOnboardingCompletedAt(null);
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
        setProfileOnboardingCompletedAt(
          profile.profileOnboardingCompletedAt ?? null,
        );
        setIsAuthenticated(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        // Only the API rejecting the session ends it. A network blip or a 5xx
        // must not discard tokens that are still valid — the next load retries.
        if (error instanceof ApiError && error.status === 401) {
          clearContactBookSessionState();
        }
        setUserId(null);
        setProfileIdentity(null);
        setProfileOnboardingCompletedAt(null);
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
    try {
      const profile = await apiFetch<ProfileMeResponse>("/v1/profile/me");
      setUserId(getCookie("cb_user_id") ?? profile.identity.primaryEmail);
      setProfileIdentity(profile.identity);
      setProfileOnboardingCompletedAt(
        profile.profileOnboardingCompletedAt ?? null,
      );
      setIsAuthenticated(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearContactBookSessionState();
        setUserId(null);
        setProfileIdentity(null);
        setProfileOnboardingCompletedAt(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAuthenticated = useCallback(() => {
    localStorage.removeItem(GOOGLE_CONNECTED_KEY);
    setUserId(getCookie("cb_user_id"));
    setProfileIdentity(null);
    setProfileOnboardingCompletedAt(null);
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
      clearSessionTokens();
      clearContactBookSessionState();
      await supabase?.auth.signOut().catch(() => undefined);
      setUserId(null);
      setProfileIdentity(null);
      setProfileOnboardingCompletedAt(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      profileIdentity,
      profileOnboardingCompletedAt,
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
      profileOnboardingCompletedAt,
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
