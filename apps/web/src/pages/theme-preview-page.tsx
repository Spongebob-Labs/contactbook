import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ContactRound,
  CreditCard,
  FileText,
  Home,
  Import,
  MessageCircle,
  Moon,
  ShieldCheck,
  UserCircle,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const previewTheme = {
  "--preview-background": "#F7F1E6",
  "--preview-sidebar": "#EFE6D6",
  "--preview-card": "#FFFCF6",
  "--preview-raised": "#FFFFFF",
  "--preview-primary": "#0E5F4F",
  "--preview-primary-hover": "#0A4B3F",
  "--preview-active": "#DDF4E8",
  "--preview-foreground": "#14211C",
  "--preview-muted": "#65756D",
  "--preview-border": "#D8CCB9",
  "--preview-clay": "#D96C55",
  "--preview-amber": "#E8B44F",
} as CSSProperties;

const navItems = [
  { label: "Dashboard", icon: Home, active: true },
  { label: "Cards", icon: CreditCard },
  { label: "Contacts", icon: UsersRound },
  { label: "Import", icon: Import },
];

const onboardingCards = [
  {
    title: "Contacts imported",
    value: "0",
    description: "Start by connecting Google Contacts or uploading a CSV.",
    action: "Import contacts",
    icon: UsersRound,
    emphasis: "large",
  },
  {
    title: "Cards created",
    value: "0",
    description: "Cards decide what ContactBook remembers and how WhatsApp replies.",
    action: "Create first card",
    icon: CreditCard,
  },
  {
    title: "Privacy status",
    value: "Enabled",
    description: "Your contact memory stays private and controlled by you.",
    action: "Review settings",
    icon: ShieldCheck,
  },
];

const setupSteps = [
  { label: "Complete profile", state: "Optional", icon: UserRound },
  { label: "Connect Google", state: "Ready", icon: CheckCircle2, highlighted: true },
  { label: "Import contacts", state: "Next", icon: Import, primary: true },
  { label: "Create your first card", state: "After import", icon: CreditCard },
  { label: "Privacy controls", state: "Enabled", icon: ShieldCheck },
];

function PreviewButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <Button
      type="button"
      variant={variant === "primary" ? "default" : "outline"}
      className={cn(
        "h-10 rounded-full px-5 shadow-none",
        variant === "primary" &&
          "border border-[var(--preview-primary)] bg-[var(--preview-primary)] text-white hover:bg-[var(--preview-primary-hover)]",
        variant === "secondary" &&
          "border-[var(--preview-border)] bg-[var(--preview-raised)] text-[var(--preview-foreground)] hover:bg-[var(--preview-card)]",
        variant === "quiet" &&
          "border-[var(--preview-border)] bg-[var(--preview-card)] text-[var(--preview-muted)] hover:text-[var(--preview-foreground)]",
      )}
    >
      {children}
    </Button>
  );
}

function PreviewBadge({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: "mint" | "cream" | "clay" | "amber";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full border px-2.5 text-[11px] font-medium",
        tone === "mint" &&
          "border-[var(--preview-primary)]/15 bg-[var(--preview-active)] text-[var(--preview-primary)]",
        tone === "cream" &&
          "border-[var(--preview-border)] bg-[var(--preview-card)] text-[var(--preview-muted)]",
        tone === "clay" &&
          "border-[var(--preview-clay)]/20 bg-[var(--preview-clay)]/10 text-[var(--preview-clay)]",
        tone === "amber" &&
          "border-[var(--preview-amber)]/30 bg-[var(--preview-amber)]/15 text-[var(--preview-foreground)]",
      )}
    >
      {children}
    </Badge>
  );
}

export default function ThemePreviewPage() {
  return (
    <div
      style={previewTheme}
      className="min-h-screen bg-[var(--preview-background)] p-4 text-[var(--preview-foreground)] md:p-6"
    >
      <style>
        {`@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap");`}
      </style>
      <div
        className="mx-auto overflow-hidden rounded-[28px] border border-[var(--preview-border)] bg-[var(--preview-background)] shadow-[0_24px_70px_rgba(20,33,28,0.12)]"
      >
        <div className="grid min-h-[760px] lg:grid-cols-[256px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--preview-border)] bg-[var(--preview-sidebar)] p-4 lg:border-b-0 lg:border-r">
            <div className="flex h-full flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--preview-primary)] text-white shadow-[0_10px_24px_rgba(14,95,79,0.18)]">
                  <ContactRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-['Fraunces'] text-lg font-semibold leading-tight">
                    ContactBook
                  </p>
                  <p className="text-xs font-medium text-[var(--preview-muted)]">
                    Private contact memory
                  </p>
                </div>
              </div>

              <nav className="grid gap-1.5">
                {navItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-[var(--preview-muted)]",
                      item.active &&
                        "bg-[var(--preview-active)] font-semibold text-[var(--preview-primary)]",
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </div>
                ))}
              </nav>

              <div className="mt-auto rounded-[22px] border border-[var(--preview-border)] bg-[var(--preview-card)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4 text-[var(--preview-primary)]" />
                  WhatsApp daily layer
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--preview-muted)]">
                  The web app sets up memory. WhatsApp is where contacts become useful every day.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-w-0 p-4 md:p-6 lg:p-8">
            <header className="mb-6 flex flex-col gap-4 border-b border-[var(--preview-border)] pb-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <PreviewBadge tone="mint">Setup workspace</PreviewBadge>
                <h1 className="mt-4 font-['Fraunces'] text-4xl font-semibold leading-tight md:text-5xl">
                  Set up your contact memory
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-[var(--preview-muted)]">
                  Import once, manage your profile here, and use ContactBook from WhatsApp
                  every day.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PreviewButton variant="secondary">
                  <Import className="h-4 w-4" aria-hidden="true" />
                  Import contacts
                </PreviewButton>
                <PreviewButton>
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Create card
                </PreviewButton>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--preview-border)] bg-[var(--preview-card)] text-[var(--preview-muted)]"
                  aria-label="Theme"
                >
                  <Moon className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--preview-border)] bg-[var(--preview-card)] text-[var(--preview-muted)]"
                  aria-label="Profile"
                >
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  {onboardingCards.map((card) => (
                    <Card
                      key={card.title}
                      className={cn(
                        "rounded-[24px] border-[var(--preview-border)] bg-[var(--preview-card)] shadow-[0_14px_34px_rgba(20,33,28,0.07)]",
                        card.emphasis === "large" && "lg:row-span-2",
                      )}
                    >
                      <CardHeader className="p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardDescription className="text-[var(--preview-muted)]">
                              {card.title}
                            </CardDescription>
                            <CardTitle
                              className={cn(
                                "mt-3 font-['Fraunces'] font-semibold tracking-normal",
                                card.emphasis === "large" ? "text-6xl" : "text-4xl",
                              )}
                            >
                              {card.value}
                            </CardTitle>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--preview-active)] text-[var(--preview-primary)]">
                            <card.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex h-full flex-col justify-end gap-5 p-5 pt-0 md:p-6 md:pt-0">
                        <p className="max-w-sm text-sm leading-6 text-[var(--preview-muted)]">
                          {card.description}
                        </p>
                        <PreviewButton
                          variant={card.emphasis === "large" ? "primary" : "secondary"}
                        >
                          {card.action}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </PreviewButton>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="rounded-[24px] border-[var(--preview-border)] bg-[var(--preview-card)] shadow-[0_14px_34px_rgba(20,33,28,0.07)]">
                  <CardHeader className="p-5 md:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <CardTitle className="font-['Fraunces'] text-2xl font-semibold tracking-normal">
                          Today's setup
                        </CardTitle>
                        <CardDescription className="mt-1 text-[var(--preview-muted)]">
                          Recommended next steps
                        </CardDescription>
                      </div>
                      <PreviewBadge tone="amber">Import contacts is next</PreviewBadge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-5 pt-0 md:p-6 md:pt-0">
                    {setupSteps.map((step, index) => (
                      <div
                        key={step.label}
                        className={cn(
                          "grid gap-3 rounded-[18px] border border-[var(--preview-border)] bg-[var(--preview-raised)] p-4 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center",
                          step.highlighted &&
                            "border-[var(--preview-primary)]/25 bg-[var(--preview-active)]",
                          step.primary &&
                            "border-[var(--preview-clay)]/40 bg-[var(--preview-clay)]/10",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--preview-card)] text-[var(--preview-muted)]",
                            (step.highlighted || step.primary) &&
                              "bg-white text-[var(--preview-primary)]",
                          )}
                        >
                          <step.icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {index + 1}. {step.label}
                          </p>
                        </div>
                        <PreviewBadge
                          tone={step.primary ? "clay" : step.highlighted ? "mint" : "cream"}
                        >
                          {step.state}
                        </PreviewBadge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <aside className="space-y-6">
                <Card className="rounded-[24px] border-[var(--preview-border)] bg-[var(--preview-raised)] shadow-[0_18px_42px_rgba(20,33,28,0.08)]">
                  <CardHeader className="p-5 md:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle className="font-['Fraunces'] text-2xl font-semibold tracking-normal">
                          Try it in WhatsApp
                        </CardTitle>
                        <CardDescription className="mt-1 text-[var(--preview-muted)]">
                          A soft preview of the daily interaction layer.
                        </CardDescription>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--preview-active)] text-[var(--preview-primary)]">
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 pt-0 md:p-6 md:pt-0">
                    <div className="rounded-[22px] border border-[var(--preview-border)] bg-[var(--preview-card)] p-4">
                      <div className="ml-auto max-w-[86%] rounded-[18px] rounded-br-md bg-[var(--preview-active)] px-4 py-3 text-sm leading-6">
                        Who did I meet from Razorpay last month?
                        <p className="mt-1 text-right text-[11px] text-[var(--preview-muted)]">
                          9:41 AM
                        </p>
                      </div>
                      <div className="mt-3 max-w-[92%] rounded-[18px] rounded-bl-md border border-[var(--preview-border)] bg-white px-4 py-3 text-sm leading-6">
                        <p className="font-medium">You saved 3 people:</p>
                        <ul className="mt-2 space-y-1 text-[var(--preview-muted)]">
                          <li>Ananya - Partnerships</li>
                          <li>Rohit - Product</li>
                          <li>Mehul - Founder's office</li>
                        </ul>
                        <p className="mt-2 text-[11px] text-[var(--preview-muted)]">
                          9:41 AM
                        </p>
                      </div>
                    </div>
                    <PreviewButton>
                      Connect WhatsApp
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </PreviewButton>
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-[var(--preview-border)] bg-[var(--preview-card)] shadow-[0_14px_34px_rgba(20,33,28,0.07)]">
                  <CardHeader className="p-5 md:p-6">
                    <CardTitle className="font-['Fraunces'] text-xl font-semibold tracking-normal">
                      Memory controls
                    </CardTitle>
                    <CardDescription className="text-[var(--preview-muted)]">
                      Private by default, explicit when shared.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-5 pt-0 md:p-6 md:pt-0">
                    <div className="flex items-center justify-between rounded-[18px] border border-[var(--preview-border)] bg-white p-3">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-[var(--preview-primary)]" />
                        <span className="text-sm font-medium">Privacy controls</span>
                      </div>
                      <PreviewBadge tone="mint">Enabled</PreviewBadge>
                    </div>
                    <div className="flex items-center justify-between rounded-[18px] border border-[var(--preview-border)] bg-white p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[var(--preview-clay)]" />
                        <span className="text-sm font-medium">Card replies</span>
                      </div>
                      <PreviewBadge tone="cream">After import</PreviewBadge>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
