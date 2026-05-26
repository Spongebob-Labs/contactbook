import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Globe2,
  IdCard,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
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
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-2")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Cards
          </Link>
          <Badge variant="secondary">Card details</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            {card?.name ?? "ContactBook card"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review the shareable card preview composed from the card shell and your saved profile details.
          </p>
        </div>
        {card && (
          <Button
            type="button"
            variant="outline"
            className="self-start"
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <CardDetailPreview card={card} profile={profile} />

          <Card>
            <CardHeader>
              <CardTitle>Card record</CardTitle>
              <CardDescription>
                The backend card shell currently stores only supported card fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RecordLine icon={IdCard} label="Type" value={cardTypeLabels[card.type]} />
              <RecordLine
                icon={CalendarDays}
                label="Created"
                value={formatDate(card.createdAt)}
              />
              <RecordLine
                icon={CalendarDays}
                label="Updated"
                value={formatDate(card.updatedAt)}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => {
                  void shareCard(card);
                }}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share card
              </Button>
            </CardContent>
          </Card>
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

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-2 bg-gradient-to-r", details.accentClassName)} />
      <CardContent className="p-0">
        <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={cn(
                    "flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-2xl font-semibold text-white",
                    details.accentClassName,
                  )}
                >
                  {details.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-3xl font-semibold tracking-normal">
                    {details.name}
                  </p>
                  <p className="mt-2 truncate text-base text-muted-foreground">
                    {details.role}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit shrink-0">
                {cardTypeLabels[card.type]}
              </Badge>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <DetailTile icon={Building2} label="Company" value={details.company} />
              <DetailTile icon={Phone} label="Phone" value={details.phone} />
              <DetailTile icon={Mail} label="Email" value={details.email} />
              <DetailTile icon={MapPin} label="Location" value={details.location} />
              <DetailTile icon={Globe2} label="Online" value={details.social} />
            </div>

            <div className="mt-auto pt-8">
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Shareable card preview</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This preview is composed in the frontend from your card name,
                  card type, and saved profile details.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between border-t border-border bg-muted/30 p-6 lg:border-l lg:border-t-0">
            <div>
              <p className="text-sm font-medium text-muted-foreground">ContactBook</p>
              <p className="mt-3 text-4xl font-semibold tracking-normal">
                {details.initials}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep this card current and share the details that fit this relationship.
              </p>
            </div>
            <div className="mt-8 space-y-2 text-sm">
              <p className="font-medium">{details.name}</p>
              <p className="text-muted-foreground">{details.email}</p>
              <p className="text-muted-foreground">{details.phone}</p>
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
    <div className="flex min-w-0 gap-3 rounded-md border border-border bg-card p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function RecordLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IdCard;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
