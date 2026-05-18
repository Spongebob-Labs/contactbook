import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/alert";
import { PageLoader } from "@/components/page-loader";

type CallbackState = "loading" | "success" | "error";

function buildGoogleResultUrl(next: string, state: "connected" | "error") {
  const safeNext = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard/import";
  return `${safeNext}${safeNext.includes("?") ? "&" : "?"}google=${state}`;
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Connecting your Google account.");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    const run = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/dashboard/import";
      if (!code || !isSupabaseConfigured || !supabase) {
        setState("error");
        setMessage("Google could not be connected. Please try again.");
        navigate(buildGoogleResultUrl(next, "error"), { replace: true });
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setState("error");
        setMessage("Google could not be connected. Please try again.");
        navigate(buildGoogleResultUrl(next, "error"), { replace: true });
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const providerAccessToken = session?.provider_token;
      const providerRefreshToken = session?.provider_refresh_token;
      const providerScope = (session as unknown as { provider_scope?: string })
        ?.provider_scope;
      const expiresAt =
        typeof session?.expires_at === "number"
          ? new Date(session.expires_at * 1000).toISOString()
          : undefined;

      if (!providerAccessToken || !providerRefreshToken) {
        setState("error");
        setMessage("Google did not provide the required access. Please reconnect.");
        navigate(buildGoogleResultUrl(next, "error"), { replace: true });
        return;
      }

      try {
        await apiFetch<{ ok: true }>("/v1/integrations/google/link-provider", {
          method: "POST",
          body: {
            providerAccessToken,
            providerRefreshToken,
            expiresAt,
            scope: providerScope,
          },
        });
        await supabase.auth.signOut().catch(() => undefined);
        setState("success");
        setMessage("Google is connected.");
        navigate(buildGoogleResultUrl(next, "connected"), { replace: true });
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Google could not be linked to ContactBook.",
        );
        navigate(buildGoogleResultUrl(next, "error"), { replace: true });
      }
    };

    void run();
  }, [navigate, searchParams]);

  if (state === "loading") {
    return <PageLoader />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Alert className="max-w-md">
        <div className="flex gap-3">
          {state === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          )}
          <div>
            <h1 className="font-semibold">
              {state === "success" ? "Google connected" : "Connection failed"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </Alert>
    </main>
  );
}
