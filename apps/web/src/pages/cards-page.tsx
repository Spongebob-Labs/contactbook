import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Globe2,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Plus,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import CountUp from "@/components/ui/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import SplitText from "@/components/ui/SplitText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
import { cardTypeStyles } from "@/lib/card-styles";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockCards, mockProfile } from "@/lib/mock-data";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Custom",
  CUSTOM: "Custom",
};

type CardFilter = "ALL" | ContactCardType;

const filterChips: Array<{ key: CardFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PERSONAL", label: "Personal" },
  { key: "BUSINESS", label: "Business" },
  { key: "CUSTOM", label: "Custom" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getCardDetailPath(cardId: string) {
  return `/dashboard/cards/${cardId}`;
}

function matchesFilter(card: ContactCard, filter: CardFilter) {
  if (filter === "ALL") return true;
  if (filter === "CUSTOM") {
    return card.type === "CUSTOM" || card.type === "PAYMENT";
  }
  return card.type === filter;
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

export default function CardsPage() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [filter, setFilter] = useState<CardFilter>("ALL");

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);
      let usedMockData = false;

      try {
        const data = await apiFetch<ContactCard[]>("/v1/cards");
        if (isMounted) {
          setCards(data);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load cards", err);
          setCards(mockCards);
          setError(null);
        }
        usedMockData = true;
      }

      try {
        const profileData = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (isMounted) {
          setProfile(profileData);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load profile for card previews", err);
          setProfile(mockProfile);
        }
        usedMockData = true;
      } finally {
        if (isMounted) {
          setIsMockData(usedMockData);
          setIsLoading(false);
        }
      }
    };

    void loadPageData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCards = useMemo(
    () => cards.filter((card) => matchesFilter(card, filter)),
    [cards, filter],
  );

  return (
    <AppShell>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SplitText text="Your cards" className="title-display" delay={70} tag="h1" />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>
              <CountUp from={0} to={cards.length} duration={1} className="font-semibold text-foreground" />
              {" "}
              shareable packs
            </span>
            {isMockData && (
              <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                Sample data
              </span>
            )}
          </p>
        </div>
        <Link
          to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
          className={cn(buttonVariants(), "shrink-0")}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Create card
        </Link>
      </section>

      {isLoading && (
        <section className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full rounded-[14px]" />
          ))}
        </section>
      )}

      {!isLoading && error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load cards</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
                filter === chip.key
                  ? "bg-accent-subtle text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {!isLoading && !error && cards.length === 0 && (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-card px-6 py-12 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-primary">
            <IdCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="title-section">Create your first card</h2>
          <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
            Build a personal, business, or custom card from the profile information
            you want to share.
          </p>
          <Link
            to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
            className={cn(buttonVariants(), "mt-5")}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create card
          </Link>
        </div>
      )}

      {!isLoading && !error && cards.length > 0 && filteredCards.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">No cards in this filter</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try another type or create a new card.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredCards.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {filteredCards.map((card, index) => (
            <div
              key={card.id}
              className="app-fade-up"
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              <CardsGalleryCard
                card={card}
                featured={index === 0 || card.type === "PERSONAL"}
                profile={profile}
              />
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function CardsGalleryCard({
  card,
  featured,
  profile,
}: {
  card: ContactCard;
  featured: boolean;
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
        "group rounded-[14px] border border-border bg-card p-5 transition-all duration-300 hover:border-border-strong",
        featured && "border-t-2 border-t-primary border-accent-border",
      )}
      spotlightColor={
        featured ? "rgba(200,184,154,0.08)" : "rgba(255,255,255,0.03)"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span
          className={cn(
            "rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
            featured
              ? "bg-accent-subtle text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {cardTypeLabels[card.type]}
        </span>
        <span className="text-[9px] text-muted-foreground/60">
          Updated {formatDate(card.updatedAt)}
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
          <p className="mt-0.5 text-[11px] text-muted-foreground">{details.role}</p>
        )}
      </div>

      <div className="mb-3 h-px bg-muted" />

      <div className="grid grid-cols-2 gap-y-2">
        {fields.map((field) => (
          <div key={field.label} className="flex min-w-0 items-center gap-1.5">
            <field.icon
              className="h-2.5 w-2.5 shrink-0 text-primary opacity-60"
              aria-hidden="true"
            />
            <span className="truncate text-[10px] text-muted-foreground">{field.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 opacity-80 transition-opacity duration-200 group-hover:opacity-100">
        <Link
          to={getCardDetailPath(card.id)}
          className={cn(buttonVariants({ size: "sm" }), "flex-1 justify-center")}
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => void shareCard(card)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1 justify-center",
          )}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Share
        </button>
      </div>
    </SpotlightCard>
  );
}
