import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { startGoogleImportConnection } from "@/lib/google-import";
import {
  GOOGLE_OAUTH_PENDING_KEY,
  IMPORT_ONBOARDING_GOOGLE_DONE_KEY,
  IMPORT_ONBOARDING_VCF_DONE_KEY,
} from "@/lib/session-storage";
import type { GoogleSyncResponse } from "@/lib/types";
import {
  getContactImportCount,
  uploadVcfContacts,
  validateVcfFile,
} from "@/lib/vcf-import";

type ImportOnboardingModalProps = {
  mode?: "setup" | "create";
  onContinue?: () => void;
  onSkip: () => void;
};

export function ImportOnboardingModal({
  mode = "create",
  onContinue,
  onSkip,
}: ImportOnboardingModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isUploadingVcf, setIsUploadingVcf] = useState(false);
  const [hasImportedGoogle, setHasImportedGoogle] = useState(
    () => sessionStorage.getItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY) === "1",
  );
  const [hasUploadedVcf, setHasUploadedVcf] = useState(
    () => sessionStorage.getItem(IMPORT_ONBOARDING_VCF_DONE_KEY) === "1",
  );
  const [vcfError, setVcfError] = useState<string | null>(null);
  const hasProcessedGoogleResult = useRef(false);
  const canContinue = hasImportedGoogle && hasUploadedVcf;

  const clearProgressAndContinue = () => {
    sessionStorage.removeItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY);
    sessionStorage.removeItem(IMPORT_ONBOARDING_VCF_DONE_KEY);
    (onContinue ?? onSkip)();
  };

  const clearProgressAndSkip = () => {
    sessionStorage.removeItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY);
    sessionStorage.removeItem(IMPORT_ONBOARDING_VCF_DONE_KEY);
    onSkip();
  };

  const clearGoogleResultParams = () => {
    setSearchParams((current) => {
      current.delete("google");
      current.delete("reason");
      return current;
    }, { replace: true });
  };

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const nextPath =
        mode === "setup"
          ? "/dashboard?onboarding=import&flow=setup"
          : "/dashboard?onboarding=import";
      const url = await startGoogleImportConnection(
        nextPath,
      );
      sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, "1");
      window.location.assign(url);
    } catch (error) {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      logUiError("Could not start Google connection", error);
      toast.error(friendlyErrorMessages.connect);
      setIsConnectingGoogle(false);
    }
  };

  const uploadVcf = async (file: File) => {
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
      sessionStorage.setItem(IMPORT_ONBOARDING_VCF_DONE_KEY, "1");
      setHasUploadedVcf(true);
      toast.success(
        importedCount === null
          ? "VCF contacts imported."
          : `Imported ${importedCount} contacts from VCF.`,
      );
    } catch (error) {
      logUiError("Could not import onboarding VCF contacts", error);
      setVcfError("We couldn't import that VCF file. Please check the file and try again.");
      toast.error("We couldn't import that VCF file. Please check the file and try again.");
    } finally {
      setIsUploadingVcf(false);
    }
  };

  useEffect(() => {
    if (hasProcessedGoogleResult.current) {
      return;
    }

    const googleState = searchParams.get("google");
    const reason = searchParams.get("reason");
    if (!googleState) {
      return;
    }

    hasProcessedGoogleResult.current = true;
    if (googleState === "error") {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      logUiError("Google onboarding connection failed", reason);
      toast.error(friendlyErrorMessages.connect);
      clearGoogleResultParams();
      return;
    }

    if (googleState !== "connected") {
      return;
    }

    const shouldSync =
      sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === "1";
    sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);

    const syncGoogle = async () => {
      setIsSyncingGoogle(true);
      try {
        if (shouldSync) {
          const result = await apiFetch<GoogleSyncResponse>(
            "/v1/contacts/sync?source=GOOGLE",
          );
          toast.success(`Synced ${result.processedCount} Google contacts.`);
        } else {
          toast.success("Google connected.");
        }
        sessionStorage.setItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY, "1");
        setHasImportedGoogle(true);
      } catch (error) {
        logUiError("Could not sync onboarding Google contacts", error);
        toast.error(friendlyErrorMessages.sync);
      } finally {
        setIsSyncingGoogle(false);
        clearGoogleResultParams();
      }
    };

    void syncGoogle();
  }, [searchParams]);

  return (
      <section className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm md:px-6">
        <div className="flex max-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <Badge variant="secondary">Import contacts</Badge>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal">
                  Bring your contacts into ContactBook.
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a source now, or continue setup and import contacts later.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start">
                <Button type="button" variant="ghost" onClick={clearProgressAndSkip}>
                  Skip for now
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                {canContinue && (
                  <Button type="button" onClick={clearProgressAndContinue}>
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
            {vcfError && (
              <Alert className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium">VCF import failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">{vcfError}</p>
                </div>
              </Alert>
            )}
            {canContinue && (
              <Alert className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
                <div>
                  <p className="font-medium">Import options completed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Continue when you are ready to move to the next setup step.
                  </p>
                </div>
              </Alert>
            )}
            <ContactImportOptions
              onConnectGoogle={() => void connectGoogle()}
              isConnectingGoogle={isConnectingGoogle || isSyncingGoogle}
              onUploadVcf={(file) => void uploadVcf(file)}
              isUploadingVcf={isUploadingVcf}
              compact
              featuredGoogle
            />
          </div>
        </div>
      </section>
  );
}

export default function ImportOnboardingPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <ImportOnboardingModal
        mode="setup"
        onSkip={() => navigate("/dashboard", { replace: true })}
      />
    </AppShell>
  );
}
