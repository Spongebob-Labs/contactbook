import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CreditCard, IdCard, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockCards } from "@/lib/mock-data";
import type { ContactCard, ContactCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Custom",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function CardsPage() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ContactCard[]>("/v1/cards");
        if (isMounted) {
          setCards(data);
          setIsMockData(false);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load cards", err);
          setCards(mockCards);
          setIsMockData(true);
          setError(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCards();
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
          to="/dashboard?onboarding=card"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create card
        </Link>
      </section>

      {isLoading && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full" />
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
              Build a personal, business, payment, or custom card from the profile
              information you want to share.
            </p>
            <Link
              to="/dashboard?onboarding=card"
              className={cn(buttonVariants({ variant: "default" }), "mt-5")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create card
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{card.name}</CardTitle>
                      <CardDescription>
                        Updated {formatDate(card.updatedAt)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {cardTypeLabels[card.type]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border bg-muted/40 p-4">
                  <p className="truncate text-sm font-medium">{card.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {formatDate(card.createdAt)}
                  </p>
                </div>
                <Link
                  to={`/dashboard/cards/${card.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-4 w-full",
                  )}
                >
                  View details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </AppShell>
  );
}
