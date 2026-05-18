import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactImportOptions } from "@/components/contact-import-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startGoogleImportConnection } from "@/lib/google-import";

const GOOGLE_OAUTH_PENDING_KEY = "contactbook:google-oauth-pending";

export default function ImportOnboardingPage() {
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const navigate = useNavigate();

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const url = await startGoogleImportConnection("/dashboard/import");
      sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, "1");
      window.location.assign(url);
    } catch (error) {
      sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      toast.error(
        error instanceof Error ? error.message : "Could not start Google connection.",
      );
      setIsConnectingGoogle(false);
    }
  };

  return (
    <AppShell>
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
                  Choose a source now, or skip and import contacts from the dashboard later.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/dashboard", { replace: true })}
                className="self-start"
              >
                Skip for now
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <ContactImportOptions
              onConnectGoogle={() => void connectGoogle()}
              isConnectingGoogle={isConnectingGoogle}
              compact
              featuredGoogle
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
