import { GOOGLE_OAUTH_SCOPES } from "@/lib/google-oauth";
import { GOOGLE_IMPORT_NEXT_KEY } from "@/lib/session-storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function startGoogleImportConnection(next = "/dashboard/import") {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Google connection is not configured.");
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard/import";
  sessionStorage.setItem(GOOGLE_IMPORT_NEXT_KEY, safeNext);

  const redirectTo = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent select_account",
        scope: GOOGLE_OAUTH_SCOPES,
      },
    },
  });

  if (error) {
    throw error;
  }
  if (!data.url) {
    throw new Error("Could not start Google connection.");
  }

  return data.url;
}
