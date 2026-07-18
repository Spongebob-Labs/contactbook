import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Globe2,
  IdCard,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  QrCode,
  Share2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import CountUp from "@/components/ui/CountUp";
import SplitText from "@/components/ui/SplitText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { apiFetch } from "@/lib/api";
import { fetchImportSummary } from "@/lib/contacts-api";
import { getCardDisplayDetails } from "@/lib/card-display";
import { cardTypeStyles } from "@/lib/card-styles";
import { logUiError } from "@/lib/friendly-errors";
import { mockCards, mockContactListResponse, mockContactsBySource, mockProfile } from "@/lib/mock-data";
import type {
  ContactCard,
  ContactCardType,
  ContactImportSummary,
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
type DashboardNudgeId = "add-card" | "review-profile";

const DASHBOARD_NUDGE_IDS: DashboardNudgeId[] = ["add-card", "review-profile"];

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

function getInitialDashboardNudgeState(): Record<DashboardNudgeId, boolean> {
  return { "add-card": false, "review-profile": false };
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getMissingProfileSections(profile: ProfileMeResponse | null) {
  const missing: string[] = [];
  const hasIdentity = Boolean(
    hasText(profile?.identity.firstName) ||
      hasText(profile?.identity.lastName) ||
      hasText(profile?.identity.primaryEmail) ||
      hasText(profile?.identity.primaryPhone),
  );
  if (!hasIdentity) missing.push("Identity details");
  if (!hasInitializedProfile(profile)) missing.push("Profile records");
  if (!hasAddress(profile)) missing.push("Postal address");
  if (!(profile && (profile.work.length > 0 || profile.business.length > 0))) {
    missing.push("Work or business");
  }
  if (!hasSocialLink(profile)) missing.push("Social links");
  return missing;
}

function isDashboardNudgeEligible(id: DashboardNudgeId) {
  return id === "add-card" || id === "review-profile";
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

async function copyCardLink(card: ContactCard) {
  const url = `${window.location.origin}${getCardDetailPath(card.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Card link copied.");
  } catch (error) {
    logUiError("Could not copy card link", error);
    toast.error("We couldn't copy this link right now.");
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
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [activeShareCardIndex, setActiveShareCardIndex] = useState(0);
  const [dismissedNudges, setDismissedNudges] = useState<
    Record<DashboardNudgeId, boolean>
  >(getInitialDashboardNudgeState);
  const [isPostOnboardingNudgeSession, setIsPostOnboardingNudgeSession] =
    useState(false);
  const hasConsumedPostOnboardingRoute = useRef(false);
  const addCardNudgeRef = useRef<HTMLAnchorElement>(null);
  const reviewProfileNudgeRef = useRef<HTMLAnchorElement>(null);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const profileCompletion = getProfileCompletion(profile);
  const missingProfileSections = getMissingProfileSections(profile);
  const isPostOnboardingLanding = isSetupFlow && onboardingStep === null;
  const visibleCards = cards.slice(0, 4);
  const connectionCount = importSummary?.totalActive ?? 0;
  const firstName =
    profile?.identity.firstName?.trim() ||
    profile?.identity.primaryEmail?.split("@")[0] ||
    "there";
  const timeOfDay = getTimeOfDayGreeting();
  const shareCards = visibleCards.length > 0 ? visibleCards : cards.slice(0, 2);
  const activeShareCard = shareCards[activeShareCardIndex] ?? shareCards[0] ?? null;
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
    isPostOnboardingNudgeSession && onboardingStep === null
      ? dashboardNudges.find((nudge) => {
          if (dismissedNudges[nudge.id]) {
            return false;
          }

          return isDashboardNudgeEligible(nudge.id);
        }) ?? null
      : null;

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
      const [profileData, summaryData] = await Promise.all([
        apiFetch<ProfileMeResponse>("/v1/profile/me"),
        fetchImportSummary(),
      ]);
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

  useEffect(() => {
    if (!isPostOnboardingLanding || hasConsumedPostOnboardingRoute.current) {
      return;
    }

    hasConsumedPostOnboardingRoute.current = true;
    setDismissedNudges(getInitialDashboardNudgeState());
    setIsPostOnboardingNudgeSession(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("flow");
      return next;
    }, { replace: true });
  }, [isPostOnboardingLanding, setSearchParams]);

  const dismissDashboardNudge = useCallback((id: DashboardNudgeId) => {
    setDismissedNudges((current) => ({ ...current, [id]: true }));
  }, []);

  useEffect(() => {
    if (!isPostOnboardingNudgeSession) {
      return;
    }

    const hasRemainingNudge = DASHBOARD_NUDGE_IDS.some(
      (id) => !dismissedNudges[id] && isDashboardNudgeEligible(id),
    );
    if (!hasRemainingNudge) {
      setIsPostOnboardingNudgeSession(false);
    }
  }, [dismissedNudges, isPostOnboardingNudgeSession]);

  useEffect(() => {
    if (activeShareCardIndex >= shareCards.length) {
      setActiveShareCardIndex(0);
    }
  }, [activeShareCardIndex, shareCards.length]);

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
      {/* Header */}
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <SplitText
            text={`Good ${timeOfDay}, ${firstName}`}
            className="title-display"
            delay={80}
            animationFrom={{ opacity: 0, transform: "translateY(8px)" }}
            animationTo={{ opacity: 1, transform: "translateY(0)" }}
            tag="h1"
          />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#6B7280]">
            <span>
              {cards.length} cards · {connectionCount} connections
            </span>
            {isMockData && (
              <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                Sample data
              </span>
            )}
          </p>
        </div>
        <Link
          ref={addCardNudgeRef}
          to="/dashboard?onboarding=card&returnTo=/dashboard"
          className={cn(
            buttonVariants(),
            "shrink-0",
            activeNudge?.id === "add-card" &&
              "relative z-[60] outline outline-2 outline-dashed outline-primary outline-offset-4",
          )}
          onClick={() => {
            if (activeNudge?.id === "add-card") {
              dismissDashboardNudge("add-card");
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New card
        </Link>
      </section>

      {/* Slim stat strip */}
      <section className="mb-8 flex flex-wrap items-center gap-6 border-b border-white/[0.06] pb-6">
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-foreground">
            <CountUp from={0} to={connectionCount} duration={1.2} />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-[#6B7280]">
            connections
          </span>
        </div>
        <div className="hidden h-5 w-px bg-white/[0.08] sm:block" aria-hidden="true" />
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-foreground">
            <CountUp from={0} to={cards.length} duration={1} />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-[#6B7280]">
            cards
          </span>
        </div>
        <div className="hidden h-5 w-px bg-white/[0.08] sm:block" aria-hidden="true" />
        <div className="flex max-w-[220px] flex-1 items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-[#6B7280]">
            Profile
          </span>
          <div className="h-[2px] max-w-[120px] flex-1 rounded-full bg-white/[0.07]">
            <div
              className="h-[2px] rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          <span className="text-[11px] text-primary">{profileCompletion.percent}%</span>
        </div>
      </section>

      {/* Your cards */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="label-section">Your cards</span>
          <Link
            to="/dashboard/cards"
            className="flex items-center gap-1 text-[12px] text-primary transition-colors hover:text-[#D4C4A8]"
          >
            View all
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {visibleCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCards.map((card, index) => (
              <div
                key={card.id}
                className="app-fade-up"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <DashboardSpotlightCard
                  card={card}
                  featured={index === 0}
                  index={index}
                  profile={profile}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-border bg-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">No cards yet</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Create a personal or work card when you are ready.
                </p>
              </div>
              <Link
                to="/dashboard?onboarding=card&returnTo=/dashboard"
                className={cn(buttonVariants(), "shrink-0")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New card
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Bottom row */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[14px] border border-white/[0.07] bg-card p-5 app-fade-up">
          <p className="text-[13px] font-semibold text-foreground">Profile completion</p>
          <p className="mt-1 text-[11px] text-white/35">
            {profileCompletion.completed} of {profileCompletion.total} sections done
          </p>
          <div className="mb-4 mt-4 h-[3px] rounded-full bg-white/[0.07]">
            <div
              className="h-[3px] rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {(missingProfileSections.length > 0
              ? missingProfileSections
              : ["All core sections complete"]
            ).map((field) => (
              <div
                key={field}
                className="flex items-center gap-2 text-[11px] text-white/35"
              >
                <div
                  className={cn(
                    "h-1 w-1 rounded-full",
                    missingProfileSections.length > 0
                      ? "bg-primary opacity-50"
                      : "bg-primary",
                  )}
                />
                {field}
              </div>
            ))}
          </div>
          <Link
            ref={reviewProfileNudgeRef}
            to="/profile"
            className={cn(
              "mt-4 flex w-full items-center justify-center rounded-[7px] border border-accent-border py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-accent-subtle",
              activeNudge?.id === "review-profile" &&
                "relative z-[60] outline outline-2 outline-dashed outline-primary outline-offset-4",
            )}
            onClick={() => {
              if (activeNudge?.id === "review-profile") {
                dismissDashboardNudge("review-profile");
              }
            }}
          >
            {profileCompletion.percent === 100 ? "Review profile →" : "Complete profile →"}
          </Link>
        </div>

        <div className="rounded-[14px] border border-white/[0.07] bg-card p-5 app-fade-up">
          <p className="text-[13px] font-semibold text-foreground">Quick share</p>
          <p className="mt-1 text-[11px] text-white/35">
            Share your active card instantly
          </p>

          {shareCards.length > 0 ? (
            <>
              <div className="mb-4 mt-4 flex flex-wrap gap-2">
                {shareCards.map((card, index) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveShareCardIndex(index)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
                      activeShareCardIndex === index
                        ? "bg-accent-subtle text-primary"
                        : "bg-white/[0.05] text-white/30 hover:text-white/50",
                    )}
                  >
                    {cardTypeLabels[card.type]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]">
                  <QrCode className="h-8 w-8 text-white/20" aria-hidden="true" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    disabled={!activeShareCard}
                    onClick={() => {
                      if (activeShareCard) void shareCard(activeShareCard);
                    }}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "w-full justify-center",
                    )}
                  >
                    <Share2 className="h-3 w-3" aria-hidden="true" />
                    Share now
                  </button>
                  <button
                    type="button"
                    disabled={!activeShareCard}
                    onClick={() => {
                      if (activeShareCard) void copyCardLink(activeShareCard);
                    }}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full justify-center",
                    )}
                  >
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    Copy link
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[11px] text-white/35">
              Create a card to enable quick sharing.
            </p>
          )}
        </div>
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
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
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
        className="pointer-events-none fixed z-[70] w-full overflow-hidden rounded-2xl border border-border bg-card p-4 app-fade-up"
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
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
              Look here
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
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

function DashboardSpotlightCard({
  card,
  featured,
  profile,
}: {
  card: ContactCard;
  featured: boolean;
  index: number;
  profile: ProfileMeResponse | null;
}) {
  const details = getCardDisplayDetails(card, profile);
  const style = cardTypeStyles[card.type];
  const fields = [
    { icon: Building2, label: "Company", value: details.company },
    { icon: Phone, label: "Phone", value: details.phone },
    { icon: Mail, label: "Email", value: details.email },
    { icon: MapPin, label: "Location", value: details.location },
    { icon: Globe2, label: "Online", value: details.social },
  ].filter((field) => Boolean(field.value));

  return (
    <SpotlightCard
      className={cn(
        "group cursor-pointer rounded-[14px] border border-white/[0.07] bg-card p-5 transition-all duration-300 hover:border-white/[0.12] app-fade-up",
        featured && "border-t-2 border-t-primary border-accent-border",
      )}
      spotlightColor={
        featured ? "rgba(200,184,154,0.08)" : "rgba(255,255,255,0.03)"
      }
    >
      <Link to={getCardDetailPath(card.id)} className="block outline-none">
        <div className="mb-4 flex items-center justify-between">
          <span
            className={cn(
              "rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
              featured
                ? "bg-accent-subtle text-primary"
                : "bg-white/[0.06] text-white/30",
            )}
          >
            {cardTypeLabels[card.type]}
          </span>
          <span className="text-[9px] text-white/20">
            {formatDate(card.updatedAt)}
          </span>
        </div>

        <div className="mb-3 flex justify-center">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full text-[14px] font-bold",
              featured ? style.initialsClassName : style.initialsMutedClassName,
            )}
          >
            {details.initials}
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-foreground">
            {details.name}
          </p>
          {details.role && (
            <p className="mt-0.5 text-[11px] text-white/35">{details.role}</p>
          )}
        </div>

        <div className="mb-3 h-px bg-white/[0.06]" />

        <div className="grid grid-cols-2 gap-y-2">
          {fields.map((field) => (
            <div key={field.label} className="flex min-w-0 items-center gap-1.5">
              <field.icon
                className="h-2.5 w-2.5 shrink-0 text-primary opacity-60"
                aria-hidden="true"
              />
              <span className="truncate text-[10px] text-white/30">{field.value}</span>
            </div>
          ))}
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/[0.05] pt-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void shareCard(card);
          }}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary"
        >
          <Share2 className="h-2.5 w-2.5" aria-hidden="true" />
          Share card
        </button>
      </div>
    </SpotlightCard>
  );
}
