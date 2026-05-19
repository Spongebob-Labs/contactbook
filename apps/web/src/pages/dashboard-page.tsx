import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  IdCard,
  Import,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type {
  ContactCard,
  ContactCardType,
  ContactImportSummary,
  ProfileMeResponse,
} from "@/lib/types";
import { CardOnboardingModal } from "@/pages/card-onboarding-page";
import { ImportOnboardingModal } from "@/pages/import-onboarding-page";
import { ProfileOnboardingModal } from "@/pages/profile-onboarding-page";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Custom",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

type OnboardingStep = "profile" | "import" | "card";

function getOnboardingStep(value: string | null): OnboardingStep | null {
  if (value === "profile" || value === "import" || value === "card") {
    return value;
  }
  return null;
}

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

function hasInitializedProfile(profile: ProfileMeResponse | null) {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.personal.groupId ||
      profile.work.length > 0 ||
      profile.business.length > 0 ||
      profile.socials.length > 0 ||
      profile.financial.bankAccounts.length > 0 ||
      profile.financial.digitalWallets.length > 0 ||
      profile.financial.cryptoWallets.length > 0,
  );
}

function getGoogleImportSummary(summary: ContactImportSummary | null) {
  return summary?.bySource.find((item) => item.source === "GOOGLE") ?? null;
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const hasProfileDetails = hasInitializedProfile(profile);
  const googleSummary = getGoogleImportSummary(importSummary);
  const hasGoogleImport = Boolean(
    googleSummary?.hasSyncToken ||
      googleSummary?.lastSyncAt ||
      googleSummary?.activeCount,
  );
  const hasCards = cards.length > 0;
  const isWorkspaceStarted = hasGoogleImport || hasCards;
  const nextStep = isWorkspaceStarted
    ? !hasCards
      ? "card"
      : null
    : !hasProfileDetails
      ? "profile"
      : !hasGoogleImport
        ? "import"
        : "card";
  const stats = [
    {
      label: "Imported contacts",
      value: String(importSummary?.totalActive ?? 0),
      detail: hasGoogleImport ? "Google import active" : "No imports yet",
    },
    {
      label: "Cards",
      value: String(cards.length),
      detail: hasCards ? "Ready to share" : "Create your first card",
    },
    {
      label: "Profile",
      value: hasProfileDetails ? "Started" : "Basic",
      detail: hasProfileDetails ? "Profile details saved" : "Registration details only",
    },
  ];
  const todayItems = [
    {
      icon: UserRound,
      label: hasProfileDetails ? "Profile details" : "Complete profile",
      state: hasProfileDetails ? "Started" : "Optional",
    },
    {
      icon: Import,
      label: hasGoogleImport ? "Google import" : "Connect Google",
      state: hasGoogleImport ? "Active" : "Ready",
    },
    {
      icon: IdCard,
      label: hasCards ? "Cards" : "Create card",
      state: hasCards ? "Done" : "Next",
    },
    {
      icon: Sparkles,
      label: "Sync imports",
      state: hasGoogleImport ? "Available" : "After connect",
    },
    { icon: ShieldCheck, label: "Privacy", state: "Enabled" },
  ];

  const setOnboardingStep = useCallback(
    (step: OnboardingStep | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (step) {
          next.set("onboarding", step);
        } else {
          next.delete("onboarding");
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const finishProfileStep = useCallback(() => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (!isSetupFlow) {
      setOnboardingStep(null);
      return;
    }
    setOnboardingStep("import");
  }, [isSetupFlow, navigate, returnTo, setOnboardingStep]);

  const loadOverview = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const [profileData, summaryData] = await Promise.all([
        apiFetch<ProfileMeResponse>("/v1/profile/me"),
        apiFetch<ContactImportSummary>("/v1/contacts/import"),
      ]);
      if (shouldUpdate()) {
        setProfile(profileData);
        setImportSummary(summaryData);
      }
    } catch (error) {
      if (shouldUpdate()) {
        setOverviewError(
          error instanceof Error
            ? error.message
            : "Could not load workspace overview.",
        );
      }
    } finally {
      if (shouldUpdate()) {
        setIsLoadingOverview(false);
      }
    }
  }, []);

  const loadCards = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    setIsLoadingCards(true);
    setCardsError(null);
    try {
      const data = await apiFetch<ContactCard[]>("/v1/cards");
      if (shouldUpdate()) {
        setCards(data);
      }
    } catch (error) {
      if (shouldUpdate()) {
        setCardsError(
          error instanceof Error ? error.message : "Could not load cards.",
        );
      }
    } finally {
      if (shouldUpdate()) {
        setIsLoadingCards(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      loadCards(() => isMounted),
      loadOverview(() => isMounted),
    ]);
    return () => {
      isMounted = false;
    };
  }, [loadCards, loadOverview]);

  return (
    <AppShell>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Badge variant={isWorkspaceStarted ? "success" : "secondary"}>
            {isWorkspaceStarted ? "Workspace active" : "MVP workspace"}
          </Badge>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              {isWorkspaceStarted
                ? "Your ContactBook workspace is taking shape."
                : "Start with your contact profile, then bring Google contacts in."}
            </h1>
            <p className="text-base text-muted-foreground">
              {isWorkspaceStarted
                ? "Review imported contacts, manage cards, and keep your shareable details current from one place."
                : "ContactBook keeps profile setup and contact import in one focused workflow, so the first useful action is always close at hand."}
            </p>
          </div>
          {overviewError && (
            <Alert className="mt-5 flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium">Could not load workspace overview</p>
                <p className="mt-1 text-sm text-muted-foreground">{overviewError}</p>
              </div>
            </Alert>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {isLoadingOverview ? (
              <>
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-40" />
              </>
            ) : (
              <>
                {nextStep === "profile" && (
                  <Link
                    to="/dashboard?onboarding=profile"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Complete profile
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {nextStep === "import" && (
                  <Link
                    to="/dashboard?onboarding=import"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Import Google contacts
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {nextStep === "card" && (
                  <Link
                    to="/dashboard?onboarding=card"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Create card
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {isWorkspaceStarted && (
                  <>
                    <Link
                      to="/dashboard/cards"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View cards
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to="/dashboard/import"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Review imports
                      <Import className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {isWorkspaceStarted ? "Workspace status" : "Recommended next steps"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.state}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">ContactBook cards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cards you can share from your saved profile details.
            </p>
          </div>
          <Link
            to="/dashboard?onboarding=card"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Create card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoadingCards && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}
          </div>
        )}

        {!isLoadingCards && cardsError && (
          <Alert className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium">Could not load cards</p>
              <p className="mt-1 text-sm text-muted-foreground">{cardsError}</p>
            </div>
          </Alert>
        )}

        {!isLoadingCards && !cardsError && cards.length === 0 && (
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <IdCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-semibold">Create your first ContactBook card</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Turn your saved profile into a shareable card for personal,
                business, or custom use.
              </p>
              <Link
                to="/dashboard?onboarding=card"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Start card
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoadingCards && !cardsError && cards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <CreditCard className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate">{card.name}</CardTitle>
                        <CardDescription>
                          Updated {formatDate(card.updatedAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {cardTypeLabels[card.type]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-border bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{card.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cardTypeLabels[card.type]} card
                        </p>
                      </div>
                      <IdCard className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {onboardingStep === "profile" && (
        <ProfileOnboardingModal
          onComplete={() => {
            void loadOverview();
            finishProfileStep();
          }}
          onSkip={finishProfileStep}
        />
      )}
      {onboardingStep === "import" && (
        <ImportOnboardingModal onSkip={() => setOnboardingStep("card")} />
      )}
      {onboardingStep === "card" && (
        <CardOnboardingModal
          onComplete={() => {
            setOnboardingStep(null);
            void Promise.all([loadCards(), loadOverview()]);
          }}
          onSkip={() => setOnboardingStep(null)}
        />
      )}
    </AppShell>
  );
}
