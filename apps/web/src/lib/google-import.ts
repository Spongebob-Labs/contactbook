import { GOOGLE_OAUTH_SCOPES } from "@/lib/google-oauth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function startGoogleImportConnection(next = "/dashboard/import") {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Google connection is not configured.");
  }

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    next,
  )}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: GOOGLE_OAUTH_SCOPES,
      queryParams: {
        access_type: "offline",
        prompt: "consent select_account",
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
