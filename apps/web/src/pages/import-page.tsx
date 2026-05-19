import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { startGoogleImportConnection } from "@/lib/google-import";
import type {
  ContactImport,
  ContactImportSummary,
  GoogleSyncResponse,
} from "@/lib/types";

const GOOGLE_OAUTH_PENDING_KEY = "contactbook:google-oauth-pending";

function formatDate(value: string | null) {
  if (!value) {
    return "Not imported";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getImportDisplayName(item: ContactImport) {
  if (item.displayName?.trim()) {
    return item.displayName.trim();
  }
  const name = [item.firstName, item.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Unknown contact";
}

function getImportSearchText(item: ContactImport) {
  return [
    getImportDisplayName(item),
    item.primaryPhone?.value,
    item.primaryEmail?.value,
    item.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getPrimaryContact(item: ContactImport) {
  return item.primaryEmail?.value ?? item.primaryPhone?.value ?? "No phone or email";
}

export default function ImportPage() {
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<ContactImport[]>([]);
  const [summary, setSummary] = useState<ContactImportSummary | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return imports;
    }
    return imports.filter((item) => getImportSearchText(item).includes(q));
  }, [imports, query]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load imports.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncGoogle = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await apiFetch<GoogleSyncResponse>("/v1/integrations/google/sync");
      toast.success(`Synced ${result.processedCount} contacts.`);
      await loadImports();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync Google contacts.");
    } finally {
      setIsSyncing(false);
    }
  }, [loadImports]);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  useEffect(() => {
    const googleState = searchParams.get("google");
    const reason = searchParams.get("reason");
    if (googleState === "connected") {
      const shouldAutoSync =
        sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === "1";
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      if (shouldAutoSync) {
        toast.success("Google connected. Syncing contacts...");
        void syncGoogle();
      } else {
        toast.success("Google connected. You can sync contacts now.");
      }
    }
    if (googleState === "error") {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      toast.error(
        reason
          ? `Google connection failed. Reason: ${reason}.`
          : "Google connection failed.",
      );
    }
  }, [searchParams, syncGoogle]);

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

  const connectGoogle = async () => {
    setIsConnecting(true);
    try {
      const url = await startGoogleImportConnection("/dashboard/import");
      sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, "1");
      window.location.assign(url);
    } catch (err) {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      toast.error(err instanceof Error ? err.message : "Could not start Google connection.");
      setIsConnecting(false);
    }
  };

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
              Choose the Google account you want to connect, then sync contacts into
              your ContactBook import queue.
            </p>
          </div>
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => void syncGoogle()}
              disabled={isSyncing}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync contacts
            </Button>
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

      <ContactImportOptions
        onConnectGoogle={() => void connectGoogle()}
        isConnectingGoogle={isConnecting}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Imported contacts</CardTitle>
              <CardDescription>Review contacts brought in from Google.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search contacts"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <Alert className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">Could not load imports</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </Alert>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
              <CheckCircle2 className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold">No imported contacts yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Connect Google and run a sync to populate this list.
              </p>
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[1fr_220px_220px] border-b border-border bg-muted px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid">
                <span>Name</span>
                <span>Contact</span>
                <span>Imported</span>
              </div>
              {filtered.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1fr_220px_220px] md:items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {getImportDisplayName(item)}
                      </p>
                      <Badge variant="secondary" className="mt-1 w-fit">
                        {item.source.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getPrimaryContact(item)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
