import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  IdCard,
  Import,
  Plus,
  Share2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { logUiError } from "@/lib/friendly-errors";
import { mockCards, mockContactListResponse, mockContactsBySource, mockProfile } from "@/lib/mock-data";
import type {
  ContactCard,
  ContactCardType,
  ContactImportSummary,
  ContactListResponse,
  ProfileMeResponse,
} from "@/lib/types";
import { CardOnboardingModal } from "@/pages/card-onboarding-page";
import { ImportOnboardingModal } from "@/pages/import-onboarding-page";
import {
  ProfileOnboardingModal,
  type ProfileOnboardingResult,
} from "@/pages/profile-onboarding-page";
import { cn } from "@/lib/utils";

type OnboardingStep = "profile" | "import" | "card";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Custom",
  CUSTOM: "Custom",
};

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
      profile.socials.length > 0,
  );
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasAddress(profile: ProfileMeResponse | null) {
  const address = profile?.personal.postalAddress;
  if (!address) {
    return false;
  }
  return [
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].some(hasText);
}

function hasSocialLink(profile: ProfileMeResponse | null) {
  return Boolean(
    profile?.socials.some((item) =>
      [
        item.facebook,
        item.website,
        item.linkedin,
        item.blog,
        item.twitter,
        item.whatsApp,
        item.custom?.instagram,
      ].some(hasText),
    ),
  );
}

function getProfileCompletion(profile: ProfileMeResponse | null) {
  const items = [
    Boolean(
      hasText(profile?.identity.firstName) ||
        hasText(profile?.identity.lastName) ||
        hasText(profile?.identity.primaryEmail) ||
        hasText(profile?.identity.primaryPhone),
    ),
    hasInitializedProfile(profile),
    hasAddress(profile),
    Boolean(profile && (profile.work.length > 0 || profile.business.length > 0)),
    hasSocialLink(profile),
  ];
  const completed = items.filter(Boolean).length;
  const total = items.length;

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

function getGoogleImportSummary(summary: ContactImportSummary | null) {
  return summary?.bySource.find((item) => item.source === "GOOGLE") ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getCardDetailPath(cardId: string) {
  return `/dashboard/cards/${cardId}`;
}

async function shareCard(card: ContactCard) {
  const url = `${window.location.origin}${getCardDetailPath(card.id)}`;
  const shareData = {
    title: card.name,
    text: `Open ${card.name} in ContactBook.`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Card link copied.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    logUiError("Could not share card", error);
    toast.error("We couldn't share this card right now.");
  }
}

type StarterCardRequest = {
  name: string;
  type: ContactCardType;
};

function normalizeCardName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function fullNameFromIdentity(identity: ProfileOnboardingResult["identity"]) {
  const fullName = [identity.firstName, identity.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  if (fullName) {
    return fullName;
  }

  return identity.primaryEmail.trim().split("@")[0] || "My ContactBook";
}

function getStarterCardRequests(
  identity: ProfileOnboardingResult["identity"],
): StarterCardRequest[] {
  const fullName = fullNameFromIdentity(identity);
  return [
    { name: fullName, type: "PERSONAL" },
    { name: `${fullName} - Work`, type: "BUSINESS" },
  ];
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const profileCompletion = getProfileCompletion(profile);
  const googleSummary = getGoogleImportSummary(importSummary);
  const hasGoogleImport = Boolean(
    googleSummary?.hasSyncToken ||
      googleSummary?.lastSyncAt ||
      googleSummary?.activeCount,
  );
  const hasCards = cards.length > 0;
  const visibleCards = cards.slice(0, 4);
  const stats = [
    {
      icon: UsersRound,
      label: "Connections",
      value: String(importSummary?.totalActive ?? 0),
      detail: hasGoogleImport ? "Google contacts connected" : "No contacts connected",
      to: "/dashboard/contacts",
      action: "View contacts",
    },
    {
      icon: IdCard,
      label: "Cards",
      value: String(cards.length),
      detail: hasCards ? "Personal sharing cards" : "No cards yet",
      to: "/dashboard/cards",
      action: "View cards",
    },
    {
      icon: CheckCircle2,
      label: "Profile",
      value: `${profileCompletion.percent}%`,
      detail: `${profileCompletion.completed}/${profileCompletion.total} sections complete`,
      to: "/dashboard/profile",
      action: "Review profile",
    },
  ];
  const guidanceItems = [
    {
      icon: UserRound,
      title: "Keep your personal card current",
      detail:
        profileCompletion.percent === 100
          ? "Your core profile details are ready."
          : "Add the details friends and family should have.",
    },
    {
      icon: Import,
      title: "Bring your contacts together",
      detail: hasGoogleImport
        ? "Your connection list is ready to review."
        : "Connect contacts when you are ready.",
    },
    {
      icon: ShieldCheck,
      title: "Share the right card",
      detail: hasCards
        ? "Open a card to review what you share."
        : "Create personal and work cards first.",
    },
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

  const createMissingStarterCards = useCallback(
    async (identity: ProfileOnboardingResult["identity"]) => {
      const starterCards = getStarterCardRequests(identity);
      const liveCards = await apiFetch<ContactCard[]>("/v1/cards");
      const createdCards: ContactCard[] = [];

      for (const starterCard of starterCards) {
        const alreadyExists = [...liveCards, ...createdCards].some(
          (card) =>
            card.type === starterCard.type &&
            normalizeCardName(card.name) === normalizeCardName(starterCard.name),
        );

        if (alreadyExists) {
          continue;
        }

        const card = await apiFetch<ContactCard>("/v1/cards", {
          method: "POST",
          body: starterCard,
        });
        createdCards.push(card);
      }

      if (createdCards.length > 0) {
        setCards((current) => {
          const nextCards = [...createdCards];
          current.forEach((card) => {
            if (!nextCards.some((createdCard) => createdCard.id === card.id)) {
              nextCards.push(card);
            }
          });
          return nextCards;
        });
        toast.success(
          createdCards.length === 1
            ? "Starter card created."
            : "Starter cards created.",
        );
      }
    },
    [],
  );

  const loadOverview = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    try {
      const [profileData, contactsData, googleContactsData] = await Promise.all([
        apiFetch<ProfileMeResponse>("/v1/profile/me"),
        apiFetch<ContactListResponse>("/v1/contacts?limit=1"),
        apiFetch<ContactListResponse>(
          "/v1/contacts?source=GOOGLE&limit=1&sort=updatedAt&sortOrder=desc",
        ),
      ]);
      const summaryData: ContactImportSummary = {
        totalActive: contactsData.total,
        totalDeleted: 0,
        bySource:
          googleContactsData.total > 0
            ? [
                {
                  source: "GOOGLE",
                  activeCount: googleContactsData.total,
                  deletedCount: 0,
                  lastSyncAt: googleContactsData.items[0]?.updatedAt ?? null,
                },
              ]
            : [],
      };
      if (shouldUpdate()) {
        setProfile(profileData);
        setImportSummary(summaryData);
        setIsMockData(false);
      }
    } catch (error) {
      logUiError("Could not load dashboard overview", error);
      if (shouldUpdate()) {
        const googleContactsData = mockContactsBySource("GOOGLE");
        setProfile(mockProfile);
        setImportSummary({
          totalActive: mockContactListResponse.total,
          totalDeleted: 0,
          bySource: [
            {
              source: "GOOGLE",
              activeCount: googleContactsData.total,
              deletedCount: 0,
              lastSyncAt: googleContactsData.items[0]?.updatedAt ?? null,
            },
          ],
        });
        setIsMockData(true);
      }
    }
  }, []);

  const loadCards = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    try {
      const data = await apiFetch<ContactCard[]>("/v1/cards");
      if (shouldUpdate()) {
        setCards(data);
      }
    } catch (error) {
      logUiError("Could not load dashboard cards", error);
      if (shouldUpdate()) {
        setCards(mockCards);
        setIsMockData(true);
      }
    }
  }, []);

  const finishSetupProfileStep = useCallback(
    async (result: ProfileOnboardingResult) => {
      if (isSetupFlow) {
        try {
          await createMissingStarterCards(result.identity);
        } catch (error) {
          logUiError("Could not create starter cards", error);
          toast.error("Your profile was saved, but we couldn't create your cards right now.");
        }
      }

      await loadOverview();
      if (isSetupFlow) {
        await loadCards();
      }
      finishProfileStep();
    },
    [
      createMissingStarterCards,
      finishProfileStep,
      isSetupFlow,
      loadCards,
      loadOverview,
    ],
  );

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

  useEffect(() => {
    if (onboardingStep === "card" && isSetupFlow) {
      setOnboardingStep(null);
    }
  }, [isSetupFlow, onboardingStep, setOnboardingStep]);

  return (
    <AppShell>
      {isMockData && <SampleDataNotice />}

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardDescription>{stat.label}</CardDescription>
                <stat.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{stat.detail}</p>
              <Link
                to={stat.to}
                className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
              >
                {stat.action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Your cards</CardTitle>
                <CardDescription>Visible cards created for sharing</CardDescription>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/dashboard/cards"
                  className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
                >
                  View all
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/dashboard?onboarding=card&returnTo=/dashboard"
                  className={cn(buttonVariants(), "shrink-0")}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add card
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleCards.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleCards.map((card) => (
                  <div
                    key={card.id}
                    className="group flex min-h-48 flex-col rounded-md border border-border bg-muted/30 p-5 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <CreditCard className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {cardTypeLabels[card.type]}
                      </Badge>
                    </div>
                    <div className="mt-6 min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold">{card.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Updated {formatDate(card.updatedAt)}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between gap-3">
                      <Link
                        to={getCardDetailPath(card.id)}
                        className={cn(buttonVariants({ variant: "outline" }), "min-w-0 flex-1")}
                      >
                        Open
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Share ${card.name}`}
                        title={`Share ${card.name}`}
                        onClick={() => {
                          void shareCard(card);
                        }}
                      >
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">No cards yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a personal or work card when you are ready.
                    </p>
                  </div>
                  <Link
                    to="/dashboard?onboarding=card&returnTo=/dashboard"
                    className={cn(buttonVariants(), "shrink-0")}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add card
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <Card>
          <CardHeader>
            <CardTitle>Profile completion</CardTitle>
            <CardDescription>
              {profileCompletion.completed} of {profileCompletion.total} sections complete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${profileCompletion.percent}%` }}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Complete the details you want available across your contact cards.
              </p>
              <Link
                to="/dashboard/profile"
                className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
              >
                Review profile
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Helpful tips</CardTitle>
            <CardDescription>Small checks for cleaner sharing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {guidanceItems.map((item) => (
              <div key={item.title} className="flex gap-3 rounded-md border border-border p-3">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {onboardingStep === "profile" && (
        <ProfileOnboardingModal
          onComplete={(result) => finishSetupProfileStep(result)}
          onSkip={finishProfileStep}
        />
      )}
      {onboardingStep === "import" && (
        <ImportOnboardingModal
          mode={isSetupFlow ? "setup" : "create"}
          onSkip={() => {
            if (isSetupFlow) {
              setOnboardingStep(null);
              return;
            }
            setOnboardingStep("card");
          }}
        />
      )}
      {onboardingStep === "card" && !isSetupFlow && (
        <CardOnboardingModal
          mode="create"
          onComplete={(card) => {
            setCards((current) =>
              current.some((item) => item.id === card.id) ? current : [card, ...current],
            );
            navigate(returnTo ?? "/dashboard", {
              replace: true,
            });
            void Promise.all([loadCards(), loadOverview()]);
          }}
          onSkip={() => setOnboardingStep(null)}
        />
      )}
    </AppShell>
  );
}
