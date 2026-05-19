import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  IdCard,
  Import,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { ContactCard, ContactCardType } from "@/lib/types";

const stats = [
  { label: "Contact sources", value: "1", detail: "Google ready" },
  { label: "Profile status", value: "New", detail: "Set up next" },
  { label: "Privacy", value: "On", detail: "Cookie session" },
];

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

export default function DashboardPage() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCards = async () => {
      setIsLoadingCards(true);
      setCardsError(null);
      try {
        const data = await apiFetch<ContactCard[]>("/v1/cards");
        if (isMounted) {
          setCards(data);
        }
      } catch (error) {
        if (isMounted) {
          setCardsError(
            error instanceof Error ? error.message : "Could not load cards.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCards(false);
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
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Badge variant="success">MVP workspace</Badge>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Start with your contact profile, then bring Google contacts in.
            </h1>
            <p className="text-base text-muted-foreground">
              ContactBook keeps profile setup and contact import in one focused
              workflow, so the first useful action is always close at hand.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/onboarding/profile"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Complete profile
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/dashboard/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Import Google contacts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Recommended next steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: UserRound, label: "Complete profile", state: "Optional" },
              { icon: Import, label: "Connect Google", state: "Ready" },
              { icon: IdCard, label: "Create card", state: cards.length > 0 ? "Done" : "Next" },
              { icon: Sparkles, label: "Sync imports", state: "After connect" },
              { icon: ShieldCheck, label: "Review privacy", state: "Enabled" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.state}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">ContactBook cards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cards you can share from your saved profile details.
            </p>
          </div>
          <Link
            to="/onboarding/card"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Create card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoadingCards && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}
          </div>
        )}

        {!isLoadingCards && cardsError && (
          <Alert className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium">Could not load cards</p>
              <p className="mt-1 text-sm text-muted-foreground">{cardsError}</p>
            </div>
          </Alert>
        )}

        {!isLoadingCards && !cardsError && cards.length === 0 && (
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <IdCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-semibold">Create your first ContactBook card</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Turn your saved profile into a shareable card for personal,
                business, or custom use.
              </p>
              <Link
                to="/onboarding/card"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Start card
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoadingCards && !cardsError && cards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.id}>
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{card.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cardTypeLabels[card.type]} card
                        </p>
                      </div>
                      <IdCard className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
