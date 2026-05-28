import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe2,
  IdCard,
  Import,
  Mail,
  MapPin,
  Phone,
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
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
import { cardTypeStyles } from "@/lib/card-styles";
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
type DashboardMode = "classic" | "story";
type DashboardNudgeId = "add-card" | "review-profile";

const DASHBOARD_MODE_STORAGE_KEY = "contactbook:dashboard-mode";
const DASHBOARD_NUDGE_STORAGE_SUFFIXES: Record<DashboardNudgeId, string> = {
  "add-card": "add-card-dismissed",
  "review-profile": "review-profile-dismissed",
};

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

function getStoredDashboardMode(): DashboardMode {
  if (typeof window === "undefined") {
    return "classic";
  }

  return window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY) === "story"
    ? "story"
    : "classic";
}

function getDashboardNudgeStorageKey(userKey: string, id: DashboardNudgeId) {
  return `contactbook:nudge:${encodeURIComponent(userKey)}:${DASHBOARD_NUDGE_STORAGE_SUFFIXES[id]}`;
}

function getStoredDashboardNudges(userKey: string): Record<DashboardNudgeId, boolean> {
  if (typeof window === "undefined") {
    return { "add-card": false, "review-profile": false };
  }

  return {
    "add-card":
      window.localStorage.getItem(getDashboardNudgeStorageKey(userKey, "add-card")) ===
      "true",
    "review-profile":
      window.localStorage.getItem(
        getDashboardNudgeStorageKey(userKey, "review-profile"),
      ) === "true",
  };
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

function hasCardType(cards: ContactCard[], type: ContactCardType) {
  return cards.some((card) => card.type === type);
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
  const { profileIdentity, userId } = useAuth();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(
    getStoredDashboardMode,
  );
  const [dismissedNudges, setDismissedNudges] = useState<
    Record<DashboardNudgeId, boolean>
  >(() => getStoredDashboardNudges("anonymous"));
  const addCardNudgeRef = useRef<HTMLAnchorElement>(null);
  const reviewProfileNudgeRef = useRef<HTMLAnchorElement>(null);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const profileCompletion = getProfileCompletion(profile);
  const nudgeUserKey =
    userId ??
    profile?.identity.primaryEmail ??
    profileIdentity?.primaryEmail ??
    "anonymous";
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
      tone: "network",
    },
    {
      icon: IdCard,
      label: "Cards",
      value: String(cards.length),
      detail: hasCards ? "Personal sharing cards" : "No cards yet",
      to: "/dashboard/cards",
      action: "View cards",
      tone: "cards",
    },
    {
      icon: CheckCircle2,
      label: "Profile",
      value: `${profileCompletion.percent}%`,
      detail: `${profileCompletion.completed}/${profileCompletion.total} sections complete`,
      to: "/profile",
      action: "Review profile",
      tone: profileCompletion.percent === 100 ? "profileComplete" : "profile",
      progress: profileCompletion.percent,
    },
  ];
  const dashboardNudges: DashboardNudge[] = [
    {
      id: "add-card",
      icon: IdCard,
      targetRef: addCardNudgeRef,
      title: "Add another card",
      detail:
        "Create a separate card for another context, role, or way you share your details.",
      action: "Add card",
    },
    {
      id: "review-profile",
      icon: UserRound,
      targetRef: reviewProfileNudgeRef,
      title:
        profileCompletion.percent === 100
          ? "Review your profile details"
          : "Complete your profile details",
      detail:
        profileCompletion.percent === 100
          ? "Check saved fields and edit anything that should stay current across your cards."
          : "Add the missing details so every card can stay accurate.",
      action: profileCompletion.percent === 100 ? "Review profile" : "Update profile",
    },
  ];
  const activeNudge =
    onboardingStep === null
      ? dashboardNudges.find((nudge) => {
          if (dismissedNudges[nudge.id]) {
            return false;
          }

          return nudge.id === "add-card" || dashboardMode === "classic";
        }) ?? null
      : null;
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

  const completeSetupStarterCards = useCallback(
    async (identity: ProfileOnboardingResult["identity"]) => {
      const liveCards = await apiFetch<ContactCard[]>("/v1/cards");
      const starterCards = getStarterCardRequests(identity);
      const createdCards: ContactCard[] = [];

      for (const starterCard of starterCards) {
        const alreadyExists = hasCardType(
          [...liveCards, ...createdCards],
          starterCard.type,
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
          await completeSetupStarterCards(result.identity);
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
      completeSetupStarterCards,
      finishProfileStep,
      isSetupFlow,
      loadCards,
      loadOverview,
    ],
  );

  const dismissDashboardNudge = useCallback((id: DashboardNudgeId) => {
    window.localStorage.setItem(
      getDashboardNudgeStorageKey(nudgeUserKey, id),
      "true",
    );
    setDismissedNudges((current) => ({ ...current, [id]: true }));
  }, [nudgeUserKey]);

  useEffect(() => {
    setDismissedNudges(getStoredDashboardNudges(nudgeUserKey));
  }, [nudgeUserKey]);

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

  const toggleDashboardMode = () => {
    setDashboardMode((current) => {
      const nextMode = current === "story" ? "classic" : "story";
      window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, nextMode);
      return nextMode;
    });
  };

  const isStoryDashboard = dashboardMode === "story";

  return (
    <AppShell
      headerActions={
        <DashboardModeSwitch
          mode={dashboardMode}
          onChange={toggleDashboardMode}
        />
      }
    >
      {isMockData && <SampleDataNotice />}

      {isStoryDashboard ? (
        <DashboardOverviewPanel
          cardsCount={cards.length}
          connectionsCount={importSummary?.totalActive ?? 0}
          hasCards={hasCards}
          hasGoogleImport={hasGoogleImport}
          profileCompletion={profileCompletion}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <DashboardStatCard
              key={stat.label}
              isTargetHighlighted={
                stat.label === "Profile" && activeNudge?.id === "review-profile"
              }
              onTargetClick={
                stat.label === "Profile"
                  ? () => dismissDashboardNudge("review-profile")
                  : undefined
              }
              stat={stat}
              targetRef={stat.label === "Profile" ? reviewProfileNudgeRef : undefined}
            />
          ))}
        </section>
      )}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Your cards</h2>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard/cards"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0 rounded-full")}
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              ref={addCardNudgeRef}
              to="/dashboard?onboarding=card&returnTo=/dashboard"
              className={cn(
                buttonVariants(),
                "shrink-0 rounded-full",
                activeNudge?.id === "add-card" &&
                  "relative z-[60] outline outline-2 outline-dashed outline-primary outline-offset-4 ring-4 ring-primary/10",
              )}
              onClick={() => {
                if (activeNudge?.id === "add-card") {
                  dismissDashboardNudge("add-card");
                }
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add card
            </Link>
          </div>
        </div>

        {visibleCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCards.map((card) => (
              <DashboardContactCard key={card.id} card={card} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-border p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">No cards yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a personal or work card when you are ready.
                </p>
              </div>
              <Link
                to="/dashboard?onboarding=card&returnTo=/dashboard"
                className={cn(buttonVariants(), "shrink-0 rounded-full")}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add card
              </Link>
            </div>
          </div>
        )}
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
                to="/profile"
                className={cn(buttonVariants({ variant: "outline" }), "shrink-0 rounded-full")}
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
              <div key={item.title} className="flex gap-3 rounded-full border border-border p-3 pr-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
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
          onSkip={(result) => finishSetupProfileStep(result)}
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
      {activeNudge && (
        <DashboardNudgeOverlay
          nudge={activeNudge}
          onDismiss={dismissDashboardNudge}
        />
      )}
    </AppShell>
  );
}

function DashboardModeSwitch({
  mode,
  onChange,
}: {
  mode: DashboardMode;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={
        mode === "story"
          ? "Switch to classic dashboard"
          : "Switch to story dashboard"
      }
      className="hidden h-10 items-center rounded-full border border-border bg-background p-0.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted sm:inline-flex"
      onClick={onChange}
    >
      <span
        className={cn(
          "rounded-full px-3.5 py-2 transition-colors",
          mode === "classic"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground",
        )}
      >
        Classic
      </span>
      <span
        className={cn(
          "rounded-full px-3.5 py-2 transition-colors",
          mode === "story"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground",
        )}
      >
        Story
      </span>
    </button>
  );
}

type DashboardStat = {
  action: string;
  detail: string;
  icon: typeof UsersRound;
  label: string;
  progress?: number;
  to: string;
  tone: string;
  value: string;
};

type DashboardNudge = {
  action: string;
  detail: string;
  icon: typeof IdCard;
  id: DashboardNudgeId;
  targetRef: RefObject<HTMLElement | null>;
  title: string;
};

type SpotlightTargetRect = {
  bottom: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

const statToneStyles: Record<
  string,
  {
    accentClassName: string;
    iconClassName: string;
  }
> = {
  network: {
    accentClassName: "bg-primary",
    iconClassName: "bg-primary text-primary-foreground",
  },
  cards: {
    accentClassName: "bg-primary",
    iconClassName: "bg-secondary text-secondary-foreground",
  },
  profile: {
    accentClassName: "bg-accent",
    iconClassName: "bg-accent text-accent-foreground",
  },
  profileComplete: {
    accentClassName: "bg-primary",
    iconClassName: "bg-primary text-primary-foreground",
  },
};

function DashboardStatCard({
  isTargetHighlighted = false,
  onTargetClick,
  stat,
  targetRef,
}: {
  isTargetHighlighted?: boolean;
  onTargetClick?: () => void;
  stat: DashboardStat;
  targetRef?: RefObject<HTMLAnchorElement | null>;
}) {
  const style = statToneStyles[stat.tone];

  return (
    <Card className="group relative overflow-hidden border-border/80 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_100%)] shadow-[0_12px_32px_rgba(20,52,48,0.07)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(20,52,48,0.11)]">
      <div className={cn("absolute inset-x-0 top-0 h-1", style.accentClassName)} />
      <CardContent className="relative flex min-h-40 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-3 text-4xl font-semibold tracking-normal text-foreground">
              {stat.value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
              style.iconClassName,
            )}
          >
            <stat.icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        {typeof stat.progress === "number" && (
          <div className="mt-4 h-2 rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${stat.progress}%` }}
            />
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <p className="max-w-[12rem] text-sm leading-5 text-muted-foreground">
            {stat.detail}
          </p>
          <Link
            ref={targetRef}
            to={stat.to}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80",
              isTargetHighlighted &&
                "relative z-[60] bg-background outline outline-2 outline-dashed outline-primary outline-offset-4 ring-4 ring-primary/10",
            )}
            onClick={onTargetClick}
          >
            {stat.action}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardNudgeOverlay({
  nudge,
  onDismiss,
}: {
  nudge: DashboardNudge;
  onDismiss: (id: DashboardNudgeId) => void;
}) {
  const Icon = nudge.icon;
  const [targetRect, setTargetRect] = useState<SpotlightTargetRect | null>(null);

  useEffect(() => {
    const measureTarget = () => {
      const target = nudge.targetRef.current;
      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      });
    };

    measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [nudge.targetRef]);

  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const calloutWidth = Math.min(360, Math.max(280, viewportWidth - 32));
  const targetCenter = targetRect
    ? targetRect.left + targetRect.width / 2
    : viewportWidth / 2;
  const calloutLeft = Math.min(
    Math.max(16, targetCenter - calloutWidth / 2),
    Math.max(16, viewportWidth - calloutWidth - 16),
  );
  const calloutTop = targetRect ? targetRect.bottom + 28 : 140;
  const arrowLeft = Math.min(
    Math.max(24, targetCenter - calloutLeft),
    calloutWidth - 24,
  );

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Dismiss dashboard nudge"
        className="absolute inset-0 bg-background/75 backdrop-blur-[2px]"
        onClick={() => onDismiss(nudge.id)}
      />
      {targetRect && (
        <div
          className="pointer-events-none fixed z-[65] rounded-full border-2 border-dashed border-primary/80"
          style={{
            height: targetRect.height + 18,
            left: targetRect.left - 9,
            top: targetRect.top - 9,
            width: targetRect.width + 18,
          }}
        />
      )}
      <div
        className="pointer-events-none fixed z-[70] w-full overflow-hidden rounded-[24px] border border-border bg-card p-4 shadow-[0_24px_80px_rgba(20,52,48,0.18)]"
        style={{
          left: calloutLeft,
          top: calloutTop,
          width: calloutWidth,
        }}
      >
        <div
          className="absolute -top-3 h-6 w-6 rotate-45 border-l border-t border-border bg-card"
          style={{ left: arrowLeft - 12 }}
        />
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full border border-primary/10" />
        <div className="pointer-events-none absolute right-12 top-8 h-2 w-2 rounded-full bg-primary/35" />
        <div className="pointer-events-none absolute right-24 top-16 h-px w-24 rotate-[-22deg] bg-primary/15" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <Badge className="rounded-full" variant="secondary">
              Look here
            </Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-normal text-foreground">
              {nudge.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {nudge.detail}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">
              Click the highlighted {nudge.action} button to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardOverviewPanel({
  cardsCount,
  connectionsCount,
  hasCards,
  hasGoogleImport,
  profileCompletion,
}: {
  cardsCount: number;
  connectionsCount: number;
  hasCards: boolean;
  hasGoogleImport: boolean;
  profileCompletion: { completed: number; percent: number; total: number };
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_72%,hsl(var(--secondary))_100%)] p-5 shadow-[0_16px_44px_rgba(20,52,48,0.08)]">
      <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute right-16 top-8 h-2 w-2 rounded-full bg-primary/35" />
      <div className="pointer-events-none absolute right-32 top-20 h-2 w-2 rounded-full bg-primary/20" />
      <div className="pointer-events-none absolute right-24 top-10 h-px w-24 rotate-[-22deg] bg-primary/15" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)_minmax(260px,0.55fr)] xl:items-center">
        <div>
          <Badge variant="secondary">Overview</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground">
            Your ContactBook
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {connectionsCount} connections, {cardsCount} cards, and{" "}
            {profileCompletion.percent}% of your profile ready for cleaner sharing.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/dashboard/contacts"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View contacts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/dashboard/cards"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View cards
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/profile"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              Review profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <OverviewMetric
            detail={hasGoogleImport ? "Google connected" : "Ready to connect"}
            icon={UsersRound}
            label="Connections"
            value={String(connectionsCount)}
          />
          <OverviewMetric
            detail={hasCards ? "Sharing cards ready" : "Create your first card"}
            icon={IdCard}
            label="Cards"
            value={String(cardsCount)}
          />
          <OverviewMetric
            detail={`${profileCompletion.completed}/${profileCompletion.total} sections complete`}
            icon={CheckCircle2}
            label="Profile"
            value={`${profileCompletion.percent}%`}
          />
        </div>

        <div className="rounded-[24px] border border-border/80 bg-background/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Profile readiness</p>
              <p className="mt-2 text-3xl font-semibold tracking-normal">
                {profileCompletion.percent}%
              </p>
            </div>
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${profileCompletion.percent}%, hsl(var(--border)) 0)`,
                }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-background text-sm font-semibold">
                {profileCompletion.completed}/{profileCompletion.total}
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-border/70">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            Complete the details you want available across your contact cards.
          </p>
        </div>
      </div>
    </section>
  );
}

function OverviewMetric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/80 bg-background/70 p-3 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function DashboardContactCard({
  card,
  profile,
}: {
  card: ContactCard;
  profile: ProfileMeResponse | null;
}) {
  const details = getCardDisplayDetails(card, profile);
  const style = cardTypeStyles[card.type];

  return (
    <div className="group rounded-lg bg-background shadow-[0_18px_48px_rgba(20,52,48,0.08)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_64px_rgba(20,52,48,0.12)]">
      <div
        className={cn(
          "relative flex min-h-[17.5rem] flex-col overflow-hidden rounded-md border border-border/80 p-5 pl-6",
          style.faceClassName,
        )}
      >
        <div className={cn("absolute inset-y-0 left-0 w-1.5", style.foilClassName)} />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div
          className={cn(
            "pointer-events-none absolute -right-4 top-2 text-[8rem] font-semibold leading-none tracking-normal",
            style.watermarkClassName,
          )}
        >
          {details.initials}
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 rounded-tl-full border-l border-t border-primary/10 bg-background/30" />

        <div className="relative flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
              ContactBook
            </p>
            <p className="mt-5 truncate text-2xl font-semibold tracking-normal text-foreground">
              {details.name}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-muted-foreground">
              {details.role}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_rgba(20,52,48,0.13)]",
                style.initialsClassName,
              )}
            >
              {details.initials}
            </div>
            <Badge variant="secondary" className={cn("mt-3", style.badgeClassName)}>
              {cardTypeLabels[card.type]}
            </Badge>
          </div>
        </div>

        <div className="relative mt-8 grid gap-x-5 gap-y-3 border-y border-border/70 py-4 text-sm sm:grid-cols-2">
          <CardPreviewLine icon={Building2} label="Company" value={details.company} />
          <CardPreviewLine icon={Phone} label="Phone" value={details.phone} />
          <CardPreviewLine icon={Mail} label="Email" value={details.email} />
          <CardPreviewLine icon={MapPin} label="Location" value={details.location} />
          <CardPreviewLine icon={Globe2} label="Online" value={details.social} />
        </div>

        <div className="relative mt-auto flex items-center justify-between gap-3 pt-6">
          <p className="truncate text-xs font-medium text-muted-foreground">
            Updated {formatDate(card.updatedAt)}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={getCardDetailPath(card.id)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
            >
              Open
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
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
      </div>
    </div>
  );
}

function CardPreviewLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate font-medium text-foreground/85">{value}</p>
      </div>
    </div>
  );
}
