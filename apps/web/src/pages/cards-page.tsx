import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, IdCard, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CardPairTile } from "@/components/cards/card-pair-tile";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { FilterTabBar } from "@/components/ui/filter-tab-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch } from "@/lib/api";
import { resolveTemplate } from "@/lib/card-maker";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { listLocalCards, USE_LOCAL_CARDS } from "@/lib/local-cards";
import type { ContactCard, ContactCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

type CardFilter =
  | "ALL"
  | "CONNECT"
  | "SCAN"
  | "PERSONAL"
  | "BUSINESS"
  | "CUSTOM";

const filterTabs: Array<{ key: CardFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "CONNECT", label: "Connect" },
  { key: "SCAN", label: "Scan" },
  { key: "PERSONAL", label: "Personal" },
  { key: "BUSINESS", label: "Business" },
  { key: "CUSTOM", label: "Custom" },
];

function matchesFilter(card: ContactCard, filter: CardFilter) {
  if (filter === "ALL") return true;
  if (filter === "CONNECT") {
    return resolveTemplate(card.template) === "connect";
  }
  if (filter === "SCAN") {
    return resolveTemplate(card.template) === "scan";
  }
  if (filter === "CUSTOM") {
    return card.type === "CUSTOM" || card.type === "PAYMENT";
  }
  return card.type === (filter as ContactCardType);
}

function matchesQuery(card: ContactCard, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    card.name,
    card.fields?.displayName,
    card.fields?.title,
    card.fields?.company,
    card.fields?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function CardsPage() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [filter, setFilter] = useState<CardFilter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);
      let usedMockData = false;

      try {
        if (USE_LOCAL_CARDS) {
          if (isMounted) {
            setCards(listLocalCards());
            setError(null);
          }
          usedMockData = true;
        } else {
          const data = await apiFetch<ContactCard[]>("/v1/cards");
          if (isMounted) {
            setCards(data);
          }
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load cards", err);
          setCards(listLocalCards());
          setError(null);
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
    () =>
      cards.filter(
        (card) => matchesFilter(card, filter) && matchesQuery(card, query),
      ),
    [cards, filter, query],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
              My cards
              <span className="ml-2 text-base font-medium text-muted-foreground">
                {cards.length}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create, manage and share your digital cards.
              {isMockData ? (
                <StatusBadge variant="neutral" className="ml-2 align-middle">
                  Sample data
                </StatusBadge>
              ) : null}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards..."
              containerClassName="w-full sm:w-56"
              aria-label="Search cards"
            />
            <Link
              to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
              className={cn(buttonVariants(), "shrink-0 justify-center")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create card
            </Link>
          </div>
        </div>

        {isLoading && (
          <section className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-72 w-full rounded-lg" />
            ))}
          </section>
        )}

        {!isLoading && error && (
          <Alert className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 text-destructive"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">Could not load cards</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {friendlyErrorMessages.load}
              </p>
            </div>
          </Alert>
        )}

        {!isLoading && !error && cards.length > 0 && (
          <FilterTabBar tabs={filterTabs} value={filter} onChange={setFilter} />
        )}

        {!isLoading && !error && cards.length === 0 && (
          <Panel className="border-dashed">
            <div className="flex min-h-56 flex-col items-center justify-center px-2 py-6 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground">
                <IdCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Create your first card
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Build a personal, business, or custom card from the profile
                information you want to share.
              </p>
              <Link
                to="/dashboard?onboarding=card&returnTo=/dashboard/cards"
                className={cn(buttonVariants(), "mt-5")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Create card
              </Link>
            </div>
          </Panel>
        )}

        {!isLoading &&
          !error &&
          cards.length > 0 &&
          filteredCards.length === 0 && (
            <Panel className="border-dashed">
              <div className="px-2 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No cards match
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another filter or search term.
                </p>
              </div>
            </Panel>
          )}

        {!isLoading && !error && filteredCards.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {filteredCards.map((card) => (
              <CardPairTile key={card.id} card={card} showName />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
