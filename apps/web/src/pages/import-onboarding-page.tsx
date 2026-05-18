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
      <section className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 md:flex-row md:items-start md:justify-between md:p-8">
          <div className="max-w-3xl">
            <Badge variant="secondary">Import contacts</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal md:text-4xl">
              Bring your contacts into ContactBook.
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Choose a source now, or skip and import contacts from the dashboard later.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard", { replace: true })}
          >
            Skip for now
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <ContactImportOptions
          onConnectGoogle={() => void connectGoogle()}
          isConnectingGoogle={isConnectingGoogle}
        />
      </section>
    </AppShell>
  );
}
