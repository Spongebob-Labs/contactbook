import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, IdCard, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CardCreateModal } from "@/components/cards/card-create-modal";
import { CardTile } from "@/components/cards/card-tile";
import { ShareCardDialog } from "@/components/cards/share-card-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FilterTabBar } from "@/components/ui/filter-tab-bar";
import { Panel } from "@/components/ui/panel";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { shareSenderNameFrom } from "@/lib/card-share-types";
import { listCards } from "@/lib/cards-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import type { ContactCard, ContactCardType } from "@/lib/types";

type CardFilter = "ALL" | ContactCardType;

const filterTabs: Array<{ key: CardFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PERSONAL", label: "Personal" },
  { key: "BUSINESS", label: "Work" },
  { key: "CUSTOM", label: "Custom" },
];

function matchesFilter(card: ContactCard, filter: CardFilter) {
  return filter === "ALL" || card.type === filter;
}

function matchesQuery(card: ContactCard, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || card.name.toLowerCase().includes(normalized);
}

/**
 * Card list. A card is now a name, a type, and whether it can be shared over
 * WhatsApp — this page's job is to get the user to share, not admire a design.
 */
export default function CardsPage() {
  const navigate = useNavigate();
  const { profileIdentity } = useAuth();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>("ALL");
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shareCard, setShareCard] = useState<ContactCard | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await listCards();
        if (isMounted) {
          setCards(data);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load cards", err);
          setCards([]);
          setError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) {
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

  const senderName = useMemo(() => {
    return shareSenderNameFrom(profileIdentity);
  }, [profileIdentity]);

  const handleCreated = (card: ContactCard) => {
    setIsCreateOpen(false);
    navigate(`/dashboard/cards/${card.id}`);
  };

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
              Share a card on WhatsApp and the person taps one button to save
              you straight to their contacts.
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
            <Button
              type="button"
              className="shrink-0 justify-center"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create card
            </Button>
          </div>
        </div>

        {isLoading && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
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
                Build a card from your profile information, then share it on
                WhatsApp so people can save you to their phone with one tap.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Create card
              </Button>
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => (
              <CardTile key={card.id} card={card} onShare={setShareCard} />
            ))}
          </section>
        )}
      </div>

      <CardCreateModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      {shareCard ? (
        <ShareCardDialog
          open
          onClose={() => setShareCard(null)}
          card={shareCard}
          senderName={senderName}
        />
      ) : null}
    </AppShell>
  );
}
