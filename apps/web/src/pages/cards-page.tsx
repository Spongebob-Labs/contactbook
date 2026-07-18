import { useEffect, useState } from "react";
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
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
import type { CardDisplayDetails } from "@/lib/card-display";
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

export default function CardsPage() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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

  return (
    <AppShell>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between app-fade-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sharing
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            ContactBook cards
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Your shareable identity packs — open one to refine what others see.
          </p>
        </div>
        <Link
          to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create card
        </Link>
      </section>

      {isLoading && (
        <section className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full" />
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

      {isMockData && <SampleDataNotice />}

      {!isLoading && !error && cards.length === 0 && (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <IdCard className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Create your first ContactBook card</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Build a personal, business, or custom card from the profile information
              you want to share.
            </p>
            <Link
              to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
              className={cn(buttonVariants({ variant: "default" }), "mt-5")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create card
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <section className="grid gap-5 md:grid-cols-2">
          {cards.map((card, index) => (
            <CardsPageContactCard
              key={card.id}
              card={card}
              profile={profile}
              featured={card.type === "PERSONAL" || index === 0}
            />
          ))}
        </section>
      )}
    </AppShell>
  );
}

function CardsPageCardBack({
  cardId,
  cardTypeLabel,
  details,
  style,
  onShare,
}: {
  cardId: string;
  cardTypeLabel: string;
  details: CardDisplayDetails;
  style: (typeof cardTypeStyles)[keyof typeof cardTypeStyles];
  onShare: () => void;
}) {
  return (
    <div className="card-face card-face-back flex flex-col overflow-hidden rounded-xl border-[0.5px] border-border bg-card">
      <div className="flex flex-1 flex-col items-center justify-between gap-4 px-5 py-5">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="label-section text-primary">ContactBook</p>
          <Badge variant="secondary" className={style.badgeClassName}>
            {cardTypeLabel}
          </Badge>
        </div>

        <div className="flex min-w-0 flex-col items-center text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold",
              style.initialsClassName,
            )}
          >
            {details.initials}
          </div>
          <h3 className="title-section mt-3 max-w-full truncate">{details.name}</h3>
          {details.role && (
            <p className="body mt-1 max-w-full truncate">{details.role}</p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2">
          <Link
            to={getCardDetailPath(cardId)}
            className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
          >
            Open card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onShare}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full justify-center",
            )}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share card
          </button>
        </div>
      </div>
    </div>
  );
}

function CardsPageContactCard({
  card,
  profile,
  featured = false,
}: {
  card: ContactCard;
  profile: ProfileMeResponse | null;
  featured?: boolean;
}) {
  const details = getCardDisplayDetails(card, profile);
  const style = cardTypeStyles[card.type];

  return (
    <div className="card-flip-scene h-[22rem] rounded-xl">
      <div className="card-flip-inner rounded-xl">
        <div
          className={cn(
            "card-face flex flex-col overflow-hidden rounded-xl border-[0.5px] p-5",
            style.faceClassName,
            featured && style.featuredBorderClassName,
          )}
        >
          <div className="relative flex items-center justify-between gap-3">
            <Badge variant="secondary" className={style.badgeClassName}>
              {cardTypeLabels[card.type]}
            </Badge>
            <p className="label-section">Updated {formatDate(card.updatedAt)}</p>
          </div>

          <div className="relative mt-5 flex flex-col items-center text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold",
                featured ? style.initialsClassName : style.initialsMutedClassName,
              )}
            >
              {details.initials}
            </div>
            <p className="title-section mt-3 max-w-full truncate text-[16px]">
              {details.name}
            </p>
            {details.role && (
              <p className="body mt-1 max-w-full truncate">{details.role}</p>
            )}
          </div>

          <div className="relative mt-5 grid gap-x-5 gap-y-3 border-y border-border py-4 text-sm sm:grid-cols-2">
            <CardPreviewLine icon={Building2} label="Company" value={details.company} />
            <CardPreviewLine icon={Phone} label="Phone" value={details.phone} />
            <CardPreviewLine icon={Mail} label="Email" value={details.email} />
            <CardPreviewLine icon={MapPin} label="Location" value={details.location} />
            <CardPreviewLine icon={Globe2} label="Online" value={details.social} />
          </div>

          <div className="relative mt-auto flex items-center justify-end gap-3 pt-4">
            <p className="shrink-0 text-[10px] text-text-muted">Hover to flip</p>
          </div>
        </div>

        <CardsPageCardBack
          cardId={card.id}
          cardTypeLabel={cardTypeLabels[card.type]}
          details={details}
          style={style}
          onShare={() => void shareCard(card)}
        />
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
  if (!value) {
    return null;
  }

  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
