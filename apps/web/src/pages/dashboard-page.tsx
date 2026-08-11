import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Import,
  Plus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { AppShell } from "@/components/app-shell";
import { CardCreateModal } from "@/components/cards/card-create-modal";
import { CardTile } from "@/components/cards/card-tile";
import { ShareCardDialog } from "@/components/cards/share-card-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { shareSenderNameFrom } from "@/lib/card-share-types";
import { createCard, listCards } from "@/lib/cards-api";
import { fetchImportSummary } from "@/lib/contacts-api";
import {
  getMissingProfileSections,
  getProfileCompletion,
} from "@/lib/profile-completion";
import { logUiError } from "@/lib/friendly-errors";
import { fetchProfileMe } from "@/lib/profile-api";
import type {
  ContactCard,
  ContactCardType,
  ContactImportSummary,
  ProfileMeResponse,
} from "@/lib/types";
import { ImportOnboardingModal } from "@/pages/import-onboarding-page";
import {
  ProfileOnboardingModal,
  type ProfileOnboardingResult,
} from "@/pages/profile-onboarding-page";
import { cn } from "@/lib/utils";

type OnboardingStep = "profile" | "import" | "card";

function getOnboardingStep(value: string | null): OnboardingStep | null {
  if (value === "profile" || value === "import" || value === "card") {
    return value;
  }
  return null;
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
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
  const { profileIdentity } = useAuth();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [shareCard, setShareCard] = useState<ContactCard | null>(null);
  const hasConsumedPostOnboardingRoute = useRef(false);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const profileCompletion = getProfileCompletion(profile);
  const missingProfileSections = getMissingProfileSections(profile);
  const isPostOnboardingLanding = isSetupFlow && onboardingStep === null;
  const visibleCards = cards.slice(0, 6);
  const connectionCount = importSummary?.totalActive ?? 0;
  const firstName =
    profile?.identity.firstName?.trim() ||
    profile?.identity.primaryEmail?.split("@")[0] ||
    "there";
  const timeOfDay = getTimeOfDayGreeting();
  // Read from the auth context, not this page's `profile` state: that state is
  // null until the overview request lands (and again if it fails), which would
  // put "A ContactBook user" into a real WhatsApp message.
  const shareSenderName = shareSenderNameFrom(profileIdentity);

  const setOnboardingStep = useCallback(
    (step: OnboardingStep | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (step) {
            next.set("onboarding", step);
          } else {
            next.delete("onboarding");
          }
          return next;
        },
        { replace: true },
      );
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
      const liveCards = await listCards();
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

        const card = await createCard(starterCard);
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
        fetchProfileMe(),
        fetchImportSummary(),
      ]);
      if (shouldUpdate()) {
        setProfile(profileData);
        setImportSummary(summaryData);
      }
    } catch (error) {
      logUiError("Could not load dashboard overview", error);
      if (shouldUpdate()) {
        setProfile(null);
        setImportSummary(null);
      }
    }
  }, []);

  const loadCards = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    try {
      const data = await listCards();
      if (shouldUpdate()) {
        setCards(data);
      }
    } catch (error) {
      logUiError("Could not load dashboard cards", error);
      if (shouldUpdate()) {
        setCards([]);
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
          toast.error(
            "Your profile was saved, but we couldn't create your cards right now.",
          );
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
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("flow");
        return next;
      },
      { replace: true },
    );
  }, [isPostOnboardingLanding, setSearchParams]);

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
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="title-display">
            Good {timeOfDay}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s your networking snapshot.
          </p>
        </div>
        <Link
          to="/dashboard?onboarding=card"
          className={cn(buttonVariants(), "shrink-0 self-start")}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New card
        </Link>
      </section>

      <section className="mb-8">
        <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-surface">
          <div className="px-5 py-4">
            <p className="text-3xl font-bold tracking-[-0.01em] text-foreground">
              {cards.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Cards</p>
          </div>
          <div className="w-px self-stretch bg-border" aria-hidden="true" />
          <div className="px-5 py-4">
            <p className="text-3xl font-bold tracking-[-0.01em] text-foreground">
              {connectionCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Contacts</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="title-section">Your cards</h2>
          <Link
            to="/dashboard/cards"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {visibleCards.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                onShare={setShareCard}
                className="w-[320px] shrink-0"
              />
            ))}
          </div>
        ) : (
          <Panel className="border-dashed">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Create your first card
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with a personal or work card when you are ready.
                </p>
              </div>
              <Link
                to="/dashboard?onboarding=card"
                className={cn(buttonVariants(), "shrink-0")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Create card
              </Link>
            </div>
          </Panel>
        )}
      </section>

      {profileCompletion.percent < 100 ? (
        <section className="mb-8 overflow-hidden rounded-lg bg-primary px-5 py-4 text-primary-foreground sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Complete your profile to get the most out of ContactBook
              </p>
              <p className="mt-1 text-sm text-primary-foreground/70">
                {Math.max(profileCompletion.total - profileCompletion.completed, 0)}{" "}
                {profileCompletion.total - profileCompletion.completed === 1
                  ? "section"
                  : "sections"}{" "}
                left
                {missingProfileSections[0]
                  ? ` · Next: ${missingProfileSections[0]}`
                  : ""}
              </p>
            </div>
            <Link
              to="/profile"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "shrink-0 border-0 bg-white text-foreground hover:bg-white/90",
              )}
            >
              Complete profile
            </Link>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="title-section mb-4">Next steps</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/dashboard?onboarding=card"
            className="rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-bg-hover"
          >
            <CreditCard className="mb-3 h-5 w-5 text-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              Create your first card
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Send it on WhatsApp and people save you in one tap.
            </p>
          </Link>
          <Link
            to="/dashboard/import"
            className="rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-bg-hover"
          >
            <Import className="mb-3 h-5 w-5 text-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Import contacts</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sync Google Contacts or upload a VCF file.
            </p>
          </Link>
          <Link
            to="/profile"
            className="rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-bg-hover"
          >
            <UserRound className="mb-3 h-5 w-5 text-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Add profile photo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep the details that appear on your cards current.
            </p>
          </Link>
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
      <CardCreateModal
        open={onboardingStep === "card" && !isSetupFlow}
        onClose={() => setOnboardingStep(null)}
        onCreated={(card) => {
          setCards((current) =>
            current.some((item) => item.id === card.id)
              ? current
              : [card, ...current],
          );
          setOnboardingStep(null);
          navigate(`/dashboard/cards/${card.id}`, { replace: true });
          void Promise.all([loadCards(), loadOverview()]);
        }}
      />

      {shareCard ? (
        <ShareCardDialog
          open
          card={shareCard}
          senderName={shareSenderName}
          onClose={() => setShareCard(null)}
        />
      ) : null}
    </AppShell>
  );
}
