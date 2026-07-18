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
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            ContactBook cards
          </h1>
        </div>
        <Link
          to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
          className={cn(buttonVariants({ variant: "default" }), "rounded-full")}
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
              className={cn(buttonVariants({ variant: "default" }), "mt-5 rounded-full")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create card
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <CardsPageContactCard key={card.id} card={card} profile={profile} />
          ))}
        </section>
      )}
    </AppShell>
  );
}

function CardsPageContactCard({
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
        <p className="mt-1 truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
