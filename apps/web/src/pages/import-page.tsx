import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  disconnectGoogle,
  fetchAllContacts,
  fetchImportSummary,
  googleSummaryHasConnection,
  icloudSummaryHasConnection,
  importGoogleContacts,
  importIcloudContacts,
  syncContacts,
} from "@/lib/contacts-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { startGoogleImportConnection } from "@/lib/google-import";
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
  const [isFullImportingGoogle, setIsFullImportingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [isUploadingVcf, setIsUploadingVcf] = useState(false);
  const [isImportingIcloud, setIsImportingIcloud] = useState(false);
  const [isSyncingIcloud, setIsSyncingIcloud] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vcfError, setVcfError] = useState<string | null>(null);
  const [hasConnectedGoogle, setHasConnectedGoogle] = useState(false);

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
    } catch (err) {
      logUiError("Could not load imports", err);
      setImports([]);
      setSummary(null);
      setError(friendlyErrorMessages.load);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncGoogle = useCallback(async (nextPath?: string | null) => {
    setIsSyncing(true);
    try {
      const result = await syncContacts("GOOGLE");
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

  const fullImportGoogle = useCallback(async () => {
    setIsFullImportingGoogle(true);
    try {
      const result = await importGoogleContacts();
      const importedCount = getContactImportCount(result);
      toast.success(
        importedCount === null
          ? "Google full import completed."
          : `Full import: ${importedCount} contacts processed.`,
      );
      await loadImports();
      setHasConnectedGoogle(true);
    } catch (err) {
      logUiError("Could not run Google full import", err);
      toast.error(friendlyErrorMessages.sync);
    } finally {
      setIsFullImportingGoogle(false);
    }
  }, [loadImports]);

  const disconnectGoogleAccount = useCallback(async () => {
    const confirmed = window.confirm(
      "Disconnect Google? Sync and import will stop until you reconnect.",
    );
    if (!confirmed) {
      return;
    }
    setIsDisconnectingGoogle(true);
    try {
      await disconnectGoogle();
      localStorage.removeItem(GOOGLE_CONNECTED_KEY);
      setHasConnectedGoogle(false);
      toast.success("Google disconnected.");
      await loadImports();
    } catch (err) {
      logUiError("Could not disconnect Google", err);
      toast.error("We couldn't disconnect Google. Please try again.");
    } finally {
      setIsDisconnectingGoogle(false);
    }
  }, [loadImports]);

  const syncIcloud = useCallback(async () => {
    setIsSyncingIcloud(true);
    try {
      const result = await syncContacts("ICLOUD");
      toast.success(`Synced ${result.processedCount} iCloud contacts.`);
      await loadImports();
    } catch (err) {
      logUiError("Could not sync iCloud contacts", err);
      toast.error(friendlyErrorMessages.sync);
    } finally {
      setIsSyncingIcloud(false);
    }
  }, [loadImports]);

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

  const importIcloud = useCallback(
    async (input: { appleId: string; appSpecificPassword: string }) => {
      setIsImportingIcloud(true);
      try {
        const result = await importIcloudContacts(input);
        const importedCount = getContactImportCount(result);
        toast.success(
          importedCount === null || importedCount === 0
            ? "iCloud import completed."
            : `Imported ${importedCount} contacts from iCloud.`,
        );
        await loadImports();
      } catch (err) {
        logUiError("Could not import iCloud contacts", err);
        toast.error(
          "We couldn't import your iCloud contacts. Check your credentials and try again.",
        );
        throw err;
      } finally {
        setIsImportingIcloud(false);
      }
    },
    [loadImports],
  );

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
  const icloudSummary = summary?.bySource.find((item) => item.source === "ICLOUD");
  const icloudCount = icloudSummary?.activeCount ?? 0;
  const hasConnectedIcloud = icloudSummaryHasConnection(summary);
  const lastActivity = formatDate(getLastImportActivity(summary));
  const googleLastSync = formatDate(
    googleSummary?.lastSync?.at ?? googleSummary?.lastSyncAt ?? null,
  );
  const icloudLastSync = formatDate(
    icloudSummary?.lastSync?.at ?? icloudSummary?.lastSyncAt ?? null,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Import"
          subtitle={
            <span>
              {hasConnectedGoogle
                ? "Sync Google or upload a VCF to add contacts."
                : "Connect a source to bring contacts into ContactBook."}
            </span>
          }
          actions={
            <Link
              to="/dashboard/contacts"
              className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")}
            >
              View contacts
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />

        <section className="inline-flex flex-wrap items-stretch overflow-hidden rounded-lg border border-border bg-surface">
          <div className="px-5 py-4">
            <p className="text-3xl font-bold tracking-[-0.01em] text-foreground">
              {isLoading ? "—" : totalContacts}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Total</p>
          </div>
          <div className="w-px self-stretch bg-border" aria-hidden="true" />
          <div className="px-5 py-4">
            <p className="text-3xl font-bold tracking-[-0.01em] text-foreground">
              {isLoading ? "—" : googleCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Google</p>
          </div>
          <div className="w-px self-stretch bg-border" aria-hidden="true" />
          <div className="px-5 py-4">
            <p className="text-3xl font-bold tracking-[-0.01em] text-foreground">
              {isLoading ? "—" : vcfCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">VCF</p>
          </div>
          <div className="flex items-center border-t border-border px-5 py-3 text-xs text-muted-foreground sm:border-l sm:border-t-0">
            Last activity · {lastActivity}
          </div>
        </section>

      {error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load import status</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {vcfError && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">VCF import failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{vcfError}</p>
          </div>
        </Alert>
      )}

      <ContactImportOptions
        onConnectGoogle={connectGoogle}
        isConnectingGoogle={isConnectingGoogle}
        googleConnected={hasConnectedGoogle}
        onSyncGoogle={() => void syncGoogle()}
        isSyncingGoogle={isSyncing}
        onFullImportGoogle={() => void fullImportGoogle()}
        isFullImportingGoogle={isFullImportingGoogle}
        onDisconnectGoogle={() => void disconnectGoogleAccount()}
        isDisconnectingGoogle={isDisconnectingGoogle}
        googleMeta={
          hasConnectedGoogle
            ? `${googleCount} contacts · Last sync ${googleLastSync}`
            : undefined
        }
        onUploadVcf={uploadVcf}
        isUploadingVcf={isUploadingVcf}
        onImportIcloud={importIcloud}
        isImportingIcloud={isImportingIcloud}
        onSyncIcloud={() => void syncIcloud()}
        isSyncingIcloud={isSyncingIcloud}
        icloudConnected={hasConnectedIcloud}
        icloudMeta={
          hasConnectedIcloud
            ? `${icloudCount} contacts · Last sync ${icloudLastSync}`
            : undefined
        }
        vcfMeta={
          vcfCount > 0
            ? `${vcfCount} contacts · Last activity ${formatDate(
                vcfSummary?.lastSync?.at ?? vcfSummary?.lastSyncAt ?? null,
              )}`
            : undefined
        }
      />
      </div>
    </AppShell>
  );
}
