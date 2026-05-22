import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CreditCard, IdCard } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockCardDetail } from "@/lib/mock-data";
import type { ContactCard, ContactCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Custom",
};

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState<ContactCard | null>(null);
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
      try {
        const data = await apiFetch<ContactCard>(`/v1/cards/${cardId}`);
        if (isMounted) {
          setCard(data);
          setIsMockData(false);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card", err);
          setCard(mockCardDetail(cardId));
          setIsMockData(true);
          setError(null);
        }
      } finally {
        if (isMounted) {
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
            Basic card information for this ContactBook card.
          </p>
        </div>
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
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate">{card.name}</CardTitle>
                    <CardDescription>
                      {cardTypeLabels[card.type]} card
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {cardTypeLabels[card.type]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border bg-muted/40 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{card.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Shareable card shell
                    </p>
                  </div>
                  <IdCard className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </AppShell>
  );
}
