import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildContactImportSummary } from "@/lib/contact-summary";
import {
  fetchAllContacts,
  fetchImportSummary,
  googleSummaryHasConnection,
} from "@/lib/contacts-api";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { startGoogleImportConnection } from "@/lib/google-import";
import { mockContactsBySource } from "@/lib/mock-data";
import {
  GOOGLE_CONNECTED_KEY,
  GOOGLE_OAUTH_PENDING_KEY,
} from "@/lib/session-storage";
import {
  getContactImportCount,
  uploadVcfContacts,
  validateVcfFile,
} from "@/lib/vcf-import";
import { cn } from "@/lib/utils";
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

function hasGoogleConnectionEvidence(summary: ContactImportSummary) {
  return googleSummaryHasConnection(summary);
}

function getLastImportActivity(summary: ContactImportSummary | null) {
  return (
    summary?.bySource
      .map((item) => item.lastSync?.at ?? item.lastSyncAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] ??
    null
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
  const [isUploadingVcf, setIsUploadingVcf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vcfError, setVcfError] = useState<string | null>(null);
  const [hasConnectedGoogle, setHasConnectedGoogle] = useState(false);
  const [isMockData, setIsMockData] = useState(false);

  const loadImports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [contactsData, summaryData] = await Promise.all([
        fetchAllContacts({ sort: "updatedAt", sortOrder: "desc" }),
        fetchImportSummary(),
      ]);
      setImports(contactsData);
      setSummary(summaryData);
      setHasConnectedGoogle(hasGoogleConnectionEvidence(summaryData));
      setIsMockData(false);
    } catch (err) {
      logUiError("Could not load imports", err);
      const response = mockContactsBySource("GOOGLE");
      const contactsData = response.items;
      const summaryData = buildContactImportSummary(contactsData);
      const googleSummary = summaryData.bySource.find(
        (item) => item.source === "GOOGLE",
      );
      if (googleSummary) {
        googleSummary.activeCount = response.total;
        googleSummary.lastSyncAt = response.items[0]?.updatedAt ?? null;
      }
      summaryData.totalActive = response.total;
      setImports(contactsData);
      setSummary(summaryData);
      setIsMockData(true);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncGoogle = useCallback(async (nextPath?: string | null) => {
    setIsSyncing(true);
    try {
      const result = await apiFetch<GoogleSyncResponse>(
        "/v1/contacts/sync?source=GOOGLE",
      );
      toast.success(`Synced ${result.processedCount} contacts.`);
      await loadImports();
      setHasConnectedGoogle(true);
      if (nextPath) {
        navigate(nextPath, { replace: true });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : friendlyErrorMessages.sync;
      logUiError("Could not sync Google contacts", err);
      if (/authorization expired|revoked|reconnect/i.test(message)) {
        setHasConnectedGoogle(false);
      }
      toast.error(friendlyErrorMessages.sync);
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
      logUiError("Could not connect Google", err);
      toast.error(friendlyErrorMessages.connect);
      setIsConnectingGoogle(false);
    }
  }, []);

  const uploadVcf = useCallback(async (file: File) => {
    const validationError = validateVcfFile(file);
    if (validationError) {
      setVcfError(validationError);
      toast.error(validationError);
      return;
    }

    setIsUploadingVcf(true);
    setVcfError(null);
    try {
      const result = await uploadVcfContacts(file);
      const importedCount = getContactImportCount(result);
      toast.success(
        importedCount === null
          ? "VCF contacts imported."
          : `Imported ${importedCount} contacts from VCF.`,
      );
      await loadImports();
    } catch (err) {
      logUiError("Could not import VCF contacts", err);
      setVcfError("We couldn't import that VCF file. Please check the file and try again.");
      toast.error("We couldn't import that VCF file. Please check the file and try again.");
    } finally {
      setIsUploadingVcf(false);
    }
  }, [loadImports]);

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
      logUiError("Google connection failed", reason);
      toast.error(friendlyErrorMessages.connect);
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
  const vcfSummary = summary?.bySource.find((item) => item.source === "VCARD");

  return (
    <AppShell>
      {isMockData && <SampleDataNotice />}

      {/* Page header */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between app-fade-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Contacts
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Import</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {hasConnectedGoogle
              ? "Sync your Google account or upload a VCF file to add contacts."
              : "Connect a source to bring your existing contacts into ContactBook."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasConnectedGoogle && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void syncGoogle()}
              disabled={isSyncing}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {isSyncing ? "Syncing…" : "Sync now"}
            </Button>
          )}
          {!hasConnectedGoogle && (
            <Button
              type="button"
              onClick={() => void connectGoogle()}
              disabled={isConnectingGoogle}
            >
              {isConnectingGoogle ? "Connecting…" : "Connect Google"}
            </Button>
          )}
        </div>
      </section>

      {/* Import stats strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 app-fade-up">
        {[
          { label: "Total contacts", value: summary?.totalActive ?? imports.length },
          { label: "Google contacts", value: googleSummary?.activeCount ?? 0 },
          { label: "VCF contacts", value: vcfSummary?.activeCount ?? 0 },
          { label: "Last activity", value: formatDate(getLastImportActivity(summary)) },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </span>
            <span className="text-lg font-semibold tracking-tight">{item.value}</span>
          </div>
        ))}
      </section>

      {vcfError && (
        <Alert className="flex items-start gap-3 app-fade-up">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">VCF import failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{vcfError}</p>
          </div>
        </Alert>
      )}

      {/* Import options */}
      <section className="grid gap-4 lg:grid-cols-3 app-fade-up">
        <ContactImportOptions
          hideGoogle={hasConnectedGoogle}
          onConnectGoogle={connectGoogle}
          isConnectingGoogle={isConnectingGoogle}
          onUploadVcf={uploadVcf}
          isUploadingVcf={isUploadingVcf}
          className={hasConnectedGoogle ? "lg:contents" : "lg:col-span-3"}
        />

        {hasConnectedGoogle && (
          <Card>
            <CardHeader>
              <CardTitle>Contacts directory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <Alert className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div>
                    <p className="font-medium">Could not load import status</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {friendlyErrorMessages.load}
                    </p>
                  </div>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : `${summary?.totalActive ?? imports.length} contacts ready to review.`}
              </p>
              <Link
                to="/dashboard/contacts"
                className={cn(buttonVariants({ variant: "default" }), "w-full justify-center")}
              >
                View contacts
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
