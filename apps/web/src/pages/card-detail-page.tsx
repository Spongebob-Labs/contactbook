import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Globe2,
  Mail,
  MapPin,
  Phone,
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
import { mockCardDetail, mockProfile } from "@/lib/mock-data";
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

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState<ContactCard | null>(null);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCard = async () => {
      if (!cardId) {
        setError("Card id is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      let usedMockData = false;

      try {
        const data = await apiFetch<ContactCard>(`/v1/cards/${cardId}`);
        if (isMounted) {
          setCard(data);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card", err);
          setCard(mockCardDetail(cardId));
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
          logUiError("Could not load profile for card detail", err);
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

    void loadCard();
    return () => {
      isMounted = false;
    };
  }, [cardId]);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/dashboard/cards"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-2 rounded-full")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Cards
          </Link>
        </div>
        {card && (
          <Button
            type="button"
            variant="outline"
            className="self-start rounded-full"
            onClick={() => {
              void shareCard(card);
            }}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        )}
      </section>

      {isLoading && (
        <section>
          <Skeleton className="h-80 w-full" />
        </section>
      )}

      {!isLoading && error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load card</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {isMockData && <SampleDataNotice />}

      {!isLoading && !error && card && (
        <section>
          <CardDetailPreview card={card} profile={profile} />
        </section>
      )}
    </AppShell>
  );
}

function CardDetailPreview({
  card,
  profile,
}: {
  card: ContactCard;
  profile: ProfileMeResponse | null;
}) {
  const details = getCardDisplayDetails(card, profile);
  const style = cardTypeStyles[card.type];

  return (
    <Card className="relative overflow-hidden border-border/80 shadow-[0_24px_70px_rgba(20,52,48,0.11)]">
      <div className={cn("absolute inset-y-0 left-0 w-1.5", style.foilClassName)} />
      <CardContent className="p-0">
        <div
          className={cn(
            "relative min-h-[34rem] overflow-hidden p-6 pl-8 md:p-8 md:pl-10",
            style.faceClassName,
          )}
        >
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
          <div
            className={cn(
              "pointer-events-none absolute -right-8 top-4 text-[12rem] font-semibold leading-none tracking-normal md:text-[16rem]",
              style.watermarkClassName,
            )}
          >
            {details.initials}
          </div>
          <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-44 rounded-tl-full border-l border-t border-primary/10 bg-background/30" />

          <div className="relative flex min-w-0 flex-col">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_36px_rgba(20,52,48,0.14)]",
                    style.initialsClassName,
                  )}
                >
                  {details.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">
                    ContactBook
                  </p>
                  <h2 className="mt-4 max-w-5xl break-words text-4xl font-semibold tracking-normal text-foreground md:text-5xl">
                    {details.name}
                  </h2>
                  <p className="mt-3 truncate text-base font-medium text-muted-foreground">
                    {details.role}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn("w-fit shrink-0", style.badgeClassName)}>
                  {cardTypeLabels[card.type]}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full bg-background/70"
                  onClick={() => {
                    void shareCard(card);
                  }}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share card
                </Button>
              </div>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailTile icon={Building2} label="Company" value={details.company} />
              <DetailTile icon={Phone} label="Phone" value={details.phone} />
              <DetailTile icon={Mail} label="Email" value={details.email} />
              <DetailTile icon={MapPin} label="Location" value={details.location} />
              <DetailTile icon={Globe2} label="Online" value={details.social} />
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <MetadataChip
                icon={CalendarDays}
                label="Created"
                value={formatDate(card.createdAt)}
              />
              <MetadataChip
                icon={CalendarDays}
                label="Updated"
                value={formatDate(card.updatedAt)}
              />
              <MetadataChip
                icon={Share2}
                label="Share type"
                value={cardTypeLabels[card.type]}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-full border border-border bg-card p-4 pr-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function MetadataChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-full border border-border/80 bg-background/70 p-3 pr-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
