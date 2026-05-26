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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
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
          <Badge variant="secondary">Cards</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            ContactBook cards
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage the shareable cards created from your saved profile details.
          </p>
        </div>
        <Link
          to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
          className={buttonVariants({ variant: "default" })}
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
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
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

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-2 bg-gradient-to-r", details.accentClassName)} />
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-lg font-semibold text-white",
                details.accentClassName,
              )}
            >
              {details.initials}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{details.name}</CardTitle>
              <CardDescription className="mt-1 truncate">
                {details.role}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {cardTypeLabels[card.type]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 text-sm">
          <CardPreviewLine icon={Building2} value={details.company} />
          <CardPreviewLine icon={Phone} value={details.phone} />
          <CardPreviewLine icon={Mail} value={details.email} />
          <CardPreviewLine icon={MapPin} value={details.location} />
          <CardPreviewLine icon={Globe2} value={details.social} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            <p>Created {formatDate(card.createdAt)}</p>
            <p className="mt-1">Updated {formatDate(card.updatedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={getCardDetailPath(card.id)}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              View details
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
      </CardContent>
    </Card>
  );
}

function CardPreviewLine({
  icon: Icon,
  value,
}: {
  icon: typeof Building2;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate text-muted-foreground">{value}</span>
    </div>
  );
}
