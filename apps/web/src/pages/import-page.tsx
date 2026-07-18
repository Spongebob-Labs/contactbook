import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import CountUp from "@/components/ui/CountUp";
import SplitText from "@/components/ui/SplitText";
import SpotlightCard from "@/components/ui/SpotlightCard";
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
  const totalContacts = summary?.totalActive ?? imports.length;
  const googleCount = googleSummary?.activeCount ?? 0;
  const vcfCount = vcfSummary?.activeCount ?? 0;
  const lastActivity = formatDate(getLastImportActivity(summary));
  const googleLastSync = formatDate(
    googleSummary?.lastSync?.at ?? googleSummary?.lastSyncAt ?? null,
  );

  return (
    <AppShell>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SplitText text="Import" className="title-display" delay={70} tag="h1" />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>
              {hasConnectedGoogle
                ? "Sync Google or upload a VCF to add contacts."
                : "Connect a source to bring contacts into ContactBook."}
            </span>
            {isMockData && (
              <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                Sample data
              </span>
            )}
          </p>
          {hasConnectedGoogle && (
            <p className="mt-2 text-[11px] text-primary">
              Google connected · Last sync {googleLastSync}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasConnectedGoogle ? (
            <Button
              type="button"
              onClick={() => void syncGoogle()}
              disabled={isSyncing}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {isSyncing ? "Syncing…" : "Sync now"}
            </Button>
          ) : (
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

      <section className="mb-8 flex flex-wrap items-center gap-6 border-b border-border pb-6">
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-foreground">
            <CountUp from={0} to={totalContacts} duration={1.2} />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            total
          </span>
        </div>
        <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-foreground">
            <CountUp from={0} to={googleCount} duration={1} />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            google
          </span>
        </div>
        <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-foreground">
            <CountUp from={0} to={vcfCount} duration={1} />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            vcf
          </span>
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          Last activity · {lastActivity}
        </div>
      </section>

      {vcfError && (
        <Alert className="mb-4 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">VCF import failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{vcfError}</p>
          </div>
        </Alert>
      )}

      <section
        className={cn(
          "grid gap-4",
          hasConnectedGoogle ? "lg:grid-cols-2" : "lg:grid-cols-1",
        )}
      >
        <ContactImportOptions
          hideGoogle={hasConnectedGoogle}
          onConnectGoogle={connectGoogle}
          isConnectingGoogle={isConnectingGoogle}
          onUploadVcf={uploadVcf}
          isUploadingVcf={isUploadingVcf}
        />

        {hasConnectedGoogle && (
          <SpotlightCard
            className="rounded-[14px] border border-border bg-card"
            spotlightColor="rgba(200,184,154,0.06)"
          >
            <div className="flex h-full min-h-52 flex-col p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-primary">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-5 flex-1">
                <h2 className="text-lg font-semibold tracking-normal">
                  Contacts directory
                </h2>
                {error ? (
                  <Alert className="mt-3 flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-medium">Could not load import status</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {friendlyErrorMessages.load}
                      </p>
                    </div>
                  </Alert>
                ) : (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    {isLoading
                      ? "Loading…"
                      : `${totalContacts} contacts ready to review.`}
                  </p>
                )}
              </div>
              <Link
                to="/dashboard/contacts"
                className={cn(buttonVariants(), "mt-5 w-full justify-center")}
              >
                View contacts
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </SpotlightCard>
        )}
      </section>
    </AppShell>
  );
}
