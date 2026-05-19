import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, CreditCard, IdCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { ContactCard, ContactCardType } from "@/lib/types";

const cardTypeOptions: Array<{
  value: ContactCardType;
  label: string;
  description: string;
}> = [
  {
    value: "PERSONAL",
    label: "Personal",
    description: "Share your everyday profile details.",
  },
  {
    value: "BUSINESS",
    label: "Business",
    description: "Share work or business identity details.",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Start with a flexible card you can shape later.",
  },
];

type CardOnboardingModalProps = {
  mode?: "setup" | "create";
  onComplete: () => void;
  onSkip: () => void;
};

export function CardOnboardingModal({
  mode = "create",
  onComplete,
  onSkip,
}: CardOnboardingModalProps) {
  const isSetupMode = mode === "setup";
  const [name, setName] = useState(
    isSetupMode ? "My first ContactBook card" : "New ContactBook card",
  );
  const [type, setType] = useState<ContactCardType>("PERSONAL");
  const [isSaving, setIsSaving] = useState(false);

  const selectedType = cardTypeOptions.find((option) => option.value === type);

  const createCard = async () => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      toast.error("Enter a card name.");
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch<ContactCard>("/v1/cards", {
        method: "POST",
        body: {
          name: cleanedName,
          type,
        },
      });
      toast.success(isSetupMode ? "Your first card is ready." : "Card created.");
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create card.");
    } finally {
      setIsSaving(false);
    }
  };

  const skipCard = () => {
    if (isSetupMode) {
      toast.info("You can create your first card later.");
    }
    onSkip();
  };

  return (
      <section className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm md:px-6">
        <div className="grid max-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-xl lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-y-auto p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <Badge variant={isSetupMode ? "success" : "secondary"}>
                  {isSetupMode ? "Final setup step" : "Card"}
                </Badge>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal">
                  {isSetupMode
                    ? "Create your first ContactBook card."
                    : "Create a ContactBook card."}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isSetupMode
                    ? "Cards let you package the profile details you want to share for a specific context. Start simple now and refine the fields later."
                    : "Create another shareable card for a personal, business, payment, or custom context."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipCard}
                className="self-start"
              >
                Skip for now
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-6 grid gap-5">
              <div>
                <label className="text-sm font-medium" htmlFor="card-name">
                  Card name
                </label>
                <Input
                  id="card-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="My personal card"
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium" htmlFor="card-type">
                  Card type
                </label>
                <Select
                  id="card-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as ContactCardType)}
                  className="mt-2"
                >
                  {cardTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedType?.description}
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => void createCard()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  Create card
                </Button>
                <Button type="button" variant="outline" onClick={skipCard}>
                  Go to dashboard
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden border-l border-border bg-muted/40 p-5 lg:block">
            <Card className="h-full bg-card">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <IdCard className="h-5 w-5" aria-hidden="true" />
                </div>
                <CardTitle>{isSetupMode ? "First card preview" : "Card preview"}</CardTitle>
                <CardDescription>
                  This creates the card shell. Field selection can come next.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {name.trim() || "Untitled card"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedType?.label ?? "Custom"} card
                      </p>
                    </div>
                    <CreditCard className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p>Profile details are already saved from onboarding.</p>
                  <p>Imported contacts remain available from the contacts directory.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
  );
}

export default function CardOnboardingPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <CardOnboardingModal
        mode="create"
        onComplete={() => navigate("/dashboard", { replace: true })}
        onSkip={() => navigate("/dashboard", { replace: true })}
      />
    </AppShell>
  );
}
