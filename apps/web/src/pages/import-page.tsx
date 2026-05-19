import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { startGoogleImportConnection } from "@/lib/google-import";
import {
  GOOGLE_CONNECTED_KEY,
  GOOGLE_OAUTH_PENDING_KEY,
} from "@/lib/session-storage";
import type {
  ContactImport,
  ContactImportSummary,
  GoogleSyncResponse,
} from "@/lib/types";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not imported";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasGoogleConnectionEvidence(
  summary: ContactImportSummary,
  contacts: ContactImport[],
) {
  const googleSummary = summary.bySource.find((item) => item.source === "GOOGLE");
  return Boolean(
    googleSummary?.hasSyncToken ||
      googleSummary?.lastSyncAt ||
      googleSummary?.activeCount ||
      contacts.length > 0,
  );
}

export default function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [imports, setImports] = useState<ContactImport[]>([]);
  const [summary, setSummary] = useState<ContactImportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConnectedGoogle, setHasConnectedGoogle] = useState(false);

  const loadImports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, contactsData] = await Promise.all([
        apiFetch<ContactImportSummary>("/v1/contacts/import"),
        apiFetch<ContactImport[]>("/v1/contacts?source=GOOGLE"),
      ]);
      setSummary(summaryData);
      setImports(contactsData);
      setHasConnectedGoogle(hasGoogleConnectionEvidence(summaryData, contactsData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load imports.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncGoogle = useCallback(async (nextPath?: string | null) => {
    setIsSyncing(true);
    try {
      const result = await apiFetch<GoogleSyncResponse>(
        "/v1/contacts/sync?source=GOOGLE",
        { method: "POST" },
      );
      setHasConnectedGoogle(true);
      toast.success(`Synced ${result.processedCount} contacts.`);
      await loadImports();
      if (nextPath) {
        navigate(nextPath, { replace: true });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sync Google contacts.";
      if (/authorization expired|revoked|reconnect/i.test(message)) {
        setHasConnectedGoogle(false);
      }
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [loadImports, navigate]);

  const connectGoogle = useCallback(async () => {
    setIsConnectingGoogle(true);
    try {
      const url = await startGoogleImportConnection("/dashboard/import");
      sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, "1");
      window.location.assign(url);
    } catch (err) {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      toast.error(err instanceof Error ? err.message : "Could not connect Google.");
      setIsConnectingGoogle(false);
    }
  }, []);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  useEffect(() => {
    const googleState = searchParams.get("google");
    const reason = searchParams.get("reason");
    const nextPath = getSafeNextPath(searchParams.get("next"));
    if (googleState === "connected") {
      setHasConnectedGoogle(true);
      const shouldAutoSync =
        sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === "1";
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      if (shouldAutoSync) {
        toast.success("Google connected. Syncing contacts...");
        void syncGoogle(nextPath);
      } else {
        toast.success("Google connected. You can sync contacts now.");
        if (nextPath) {
          navigate(nextPath, { replace: true });
        }
      }
    }
    if (googleState === "error") {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      localStorage.removeItem(GOOGLE_CONNECTED_KEY);
      toast.error(
        reason
          ? `Google connection failed. Reason: ${reason}.`
          : "Google connection failed.",
      );
    }
  }, [navigate, searchParams, syncGoogle]);

  useEffect(() => {
    const reloadIfReturnedFromFailedGoogleOAuth = (event: PageTransitionEvent) => {
      const hasPendingGoogleOAuth =
        sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === "1";
      if (!hasPendingGoogleOAuth) {
        return;
      }

      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const restoredFromHistory = event.persisted || navigation?.type === "back_forward";
      if (!restoredFromHistory) {
        return;
      }

      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      window.location.reload();
    };

    window.addEventListener("pageshow", reloadIfReturnedFromFailedGoogleOAuth);
    return () => {
      window.removeEventListener("pageshow", reloadIfReturnedFromFailedGoogleOAuth);
    };
  }, []);

  const googleSummary = summary?.bySource.find((item) => item.source === "GOOGLE");

  return (
    <AppShell>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Badge variant="secondary">Google import</Badge>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Bring your Google contacts into ContactBook.
            </h1>
            <p className="text-base text-muted-foreground">
              {hasConnectedGoogle
                ? "Sync contacts from your connected Google account into your ContactBook import queue."
                : "Sync your Google contacts into your ContactBook import queue."}
            </p>
          </div>
          <div className="mt-6">
            {hasConnectedGoogle ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void syncGoogle()}
                disabled={isSyncing}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Sync contacts
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void connectGoogle()}
                disabled={isConnectingGoogle}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {isConnectingGoogle ? "Connecting" : "Connect Google"}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import status</CardTitle>
            <CardDescription>Current Google import snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-muted-foreground">Imported contacts</span>
              <span className="text-lg font-semibold">
                {summary?.totalActive ?? imports.length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-muted-foreground">Google contacts</span>
              <span className="text-lg font-semibold">
                {googleSummary?.activeCount ?? imports.length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-muted-foreground">Last sync</span>
              <span className="text-sm font-medium">
                {formatDate(googleSummary?.lastSyncAt ?? null)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ContactImportOptions
          hideGoogle={hasConnectedGoogle}
          onConnectGoogle={connectGoogle}
          isConnectingGoogle={isConnectingGoogle}
          className={hasConnectedGoogle ? "lg:contents" : "lg:col-span-3"}
        />

        {hasConnectedGoogle && (
          <Card className="min-h-64">
            <CardHeader>
              <CardTitle>Contacts directory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div>
                    <p className="font-medium">Could not load import status</p>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  </div>
                </Alert>
              )}
              <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">
                    {isLoading
                      ? "Loading contacts status"
                      : `${summary?.totalActive ?? imports.length} contacts`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the Contacts page to search and inspect contacts.
                  </p>
                </div>
                <Link
                  to="/dashboard/contacts"
                  className={buttonVariants({ variant: "default" })}
                >
                  View contacts
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
