/**
 * One card's details, settings, and delivery history.
 *
 * Two tabs, not three. "Overview" and "What's shared" used to split one
 * question — what does this card say about me? — so a value was typed on one
 * screen and switched on from another, with nothing to connect the two. They are
 * now one tab; History stays separate because delivery status is a different
 * question and sat unreachable below a twelve-row editor.
 *
 * The vCard preview stays pinned beside both tabs: it is the only honest answer
 * to "what will they actually get".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  History,
  IdCard,
  Settings2,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CardDetailsPanel } from "@/components/cards/card-details-panel";
import { ShareBatchStatus } from "@/components/cards/share-batch-status";
import { ShareCardDialog } from "@/components/cards/share-card-dialog";
import { VcardPreview } from "@/components/cards/vcard-preview";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { EditableSection, ViewField } from "@/components/ui/editable-section";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import {
  dropCardFieldSelection,
  readCardFieldSelection,
  writeCardFieldSelection,
} from "@/lib/card-field-selection";
import { listCardShares } from "@/lib/card-share-api";
import { shareSenderNameFrom } from "@/lib/card-share-types";
import type { CardShareBatch, ShareableFieldType } from "@/lib/card-share-types";
import { deleteCard, getCard, updateCard } from "@/lib/cards-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { useCardTour } from "@/lib/use-card-tour";
import type { ContactCard, ContactCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Friendly labels for the API's card types — "Work" reads better than "Business" here. */
const CARD_TYPE_OPTIONS: Array<{ value: ContactCardType; label: string }> = [
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Work" },
  { value: "CUSTOM", label: "Custom" },
];

const CARD_TYPE_LABELS: Record<ContactCardType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Work",
  CUSTOM: "Custom",
};

type CardTab = "card" | "history";

/**
 * Two tabs, not three. "Overview" and "What's shared" split one question —
 * what this card says about me — across two screens, so a value was edited in
 * one place and switched on in another with nothing to connect them.
 */
const CARD_TABS: Array<SegmentedTabItem<CardTab>> = [
  { key: "card", label: "Card", icon: Settings2, dataTour: "card-shared-fields" },
  { key: "history", label: "History", icon: History },
];

const TAB_LABELS: Record<CardTab, string> = {
  card: "Card",
  history: "History",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

/** One card's settings, sharing configuration, and delivery history. */
export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { profileIdentity, userId } = useAuth();

  const [card, setCard] = useState<ContactCard | null>(null);
  const [activeTab, setActiveTab] = useState<CardTab>("card");
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fieldTypes, setFieldTypes] = useState<ShareableFieldType[]>([]);
  /** Bumped after a profile save so the vCard preview re-generates. */
  const [previewKey, setPreviewKey] = useState(0);

  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<ContactCardType>("PERSONAL");
  const [draftSensitive, setDraftSensitive] = useState(false);

  const [shareBatches, setShareBatches] = useState<CardShareBatch[]>([]);
  const [sharesPage, setSharesPage] = useState(1);
  const [sharesTotalPages, setSharesTotalPages] = useState(1);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);

  const senderName = useMemo(() => {
    return shareSenderNameFrom(profileIdentity);
  }, [profileIdentity]);

  // Armed only once the card has rendered — the tour anchors do not exist while
  // the page is still skeletons, and a tour with nothing to point at gives up.
  useCardTour({ userId, enabled: Boolean(card) && !isLoading });

  const loadShares = useCallback(async (id: string, page: number) => {
    setIsLoadingShares(true);
    setSharesError(null);
    try {
      const response = await listCardShares(id, { page, limit: 10 });
      setShareBatches(response.items);
      setSharesPage(response.page);
      setSharesTotalPages(response.totalPages);
    } catch (error) {
      logUiError("Could not load share history", error);
      setShareBatches([]);
      setSharesError(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.load,
      );
    } finally {
      setIsLoadingShares(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!cardId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setNotFound(false);
      setLoadError(null);
      try {
        const data = await getCard(cardId);
        if (!isMounted) {
          return;
        }
        setCard(data);
        void loadShares(cardId, 1);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        logUiError("Could not load card", error);
        setCard(null);
        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 403)
        ) {
          setNotFound(true);
        } else {
          setLoadError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [cardId, loadShares]);

  /**
   * The share filter lives in the browser, not on the card, so it has to be
   * re-read here. `userId` is a dependency because auth resolves after the
   * first paint — reading before it lands would return an empty selection and
   * silently widen what the card shares.
   */
  useEffect(() => {
    if (!cardId) {
      return;
    }
    setFieldTypes(readCardFieldSelection(userId, cardId));
  }, [cardId, userId]);

  const handleFieldTypesChange = useCallback(
    (next: ShareableFieldType[]) => {
      setFieldTypes(next);
      if (cardId) {
        writeCardFieldSelection(userId, cardId, next);
      }
    },
    [cardId, userId],
  );

  const startEditSettings = () => {
    if (!card) {
      return;
    }
    setDraftName(card.name);
    setDraftType(card.type);
    setDraftSensitive(Boolean(card.isSensitive));
    setEditingSettings(true);
  };

  const cancelEditSettings = () => setEditingSettings(false);

  const saveSettings = async () => {
    if (!card || !cardId) {
      return;
    }
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      toast.error("Enter a card name.");
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await updateCard(cardId, {
        name: trimmedName,
        type: draftType,
        isSensitive: draftSensitive,
      });
      setCard((current) =>
        current ? { ...updated, mappedFieldIds: current.mappedFieldIds } : updated,
      );
      toast.success("Card updated.");
      setEditingSettings(false);
    } catch (error) {
      logUiError("Could not update card", error);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    if (!card || !cardId) {
      return;
    }
    const confirmed = window.confirm(
      `Delete "${card.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteCard(cardId);
      // The stored selection would otherwise outlive the card forever, and a
      // recycled id would inherit a stranger's filter.
      dropCardFieldSelection(userId, cardId);
      toast.success("Card deleted.");
      navigate("/dashboard/cards", { replace: true });
    } catch (error) {
      logUiError("Could not delete card", error);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrevPage = () => {
    if (!cardId || sharesPage <= 1) {
      return;
    }
    void loadShares(cardId, sharesPage - 1);
  };

  const handleNextPage = () => {
    if (!cardId || sharesPage >= sharesTotalPages) {
      return;
    }
    void loadShares(cardId, sharesPage + 1);
  };

  const handleBatchChange = (batchId: string, updated: CardShareBatch) => {
    setShareBatches((current) =>
      current.map((batch) => (batch.id === batchId ? updated : batch)),
    );
  };

  /**
   * Leaves the dialog open on its confirmation screen — that is where the user
   * watches delivery land. History only takes the new batch when page 1 is on
   * screen; otherwise it would show a page-1 row inside page 3 and push that
   * page's oldest entry out of view.
   */
  const handleShared = (batch: CardShareBatch) => {
    if (!cardId) {
      return;
    }
    if (sharesPage === 1) {
      setShareBatches((current) => [batch, ...current].slice(0, 10));
      return;
    }
    void loadShares(cardId, 1);
  };

  const mappedFieldCount = card?.mappedFieldIds?.length ?? 0;

  /**
   * A save can change which profile fields the card carries — the server attaches
   * unmapped fields on every patch — so the card is re-read, not just the preview.
   * That is what clears the "only get your name" state without a manual reload.
   */
  const handleDetailsSaved = useCallback(async () => {
    setPreviewKey((value) => value + 1);
    if (!cardId) {
      return;
    }
    try {
      const refreshed = await getCard(cardId);
      setCard(refreshed);
    } catch (error) {
      logUiError("Could not refresh the card after saving", error);
    }
  }, [cardId]);

  const headerActions = card ? (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-tour="card-share"
          onClick={() => setShareOpen(true)}
          disabled={card.isSensitive}
          title={
            card.isSensitive
              ? "Private cards can't be shared over WhatsApp."
              : undefined
          }
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
      {card.isSensitive ? (
        <p className="text-xs text-muted-foreground">
          Private cards can't be shared over WhatsApp.
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={card?.name ?? "Card"}
          subtitle={
            card
              ? `${CARD_TYPE_LABELS[card.type]} card · Updated ${formatDate(card.updatedAt)}`
              : undefined
          }
          actions={headerActions}
        />

        {isLoading ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-6">
            <div className="space-y-6">
              <Skeleton className="h-10 w-72 rounded-xl" />
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-56 w-full rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-96 w-full rounded-lg lg:mt-0" />
          </div>
        ) : null}

        {!isLoading && notFound ? (
          <Panel className="border-dashed">
            <div className="flex min-h-56 flex-col items-center justify-center px-2 py-6 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground">
                <IdCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                We couldn't find that card.
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                It may have been deleted, or you might not have access to it.
              </p>
              <Link to="/dashboard/cards" className={cn(buttonVariants(), "mt-5")}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to cards
              </Link>
            </div>
          </Panel>
        ) : null}

        {!isLoading && !notFound && loadError ? (
          <Alert className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium">Could not load card</p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </div>
          </Alert>
        ) : null}

        {!isLoading && !notFound && !loadError && card ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-6">
            <div className="min-w-0 space-y-6">
              <div data-tour="card-tabs">
                <SegmentedTabs
                  items={CARD_TABS}
                  value={activeTab}
                  onChange={setActiveTab}
                  aria-label="Card sections"
                />
              </div>

              {activeTab === "card" ? (
                <div
                  role="tabpanel"
                  aria-label={TAB_LABELS.card}
                  className="space-y-6"
                >
                  <CardDetailsPanel
                    cardId={card.id}
                    cardType={card.type}
                    selectedTypes={fieldTypes}
                    onSelectedTypesChange={handleFieldTypesChange}
                    isEmpty={mappedFieldCount === 0}
                    onSaved={() => void handleDetailsSaved()}
                  />

                  <EditableSection
                    title="Card settings"
                    description="Name, type, and whether this card can be shared over WhatsApp."
                    editing={editingSettings}
                    saving={savingSettings}
                    onEdit={startEditSettings}
                    onCancel={cancelEditSettings}
                    onSave={() => void saveSettings()}
                  >
                    {editingSettings ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="text-sm font-medium" htmlFor="card-name">
                            Name
                          </label>
                          <Input
                            id="card-name"
                            className="mt-2"
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            disabled={savingSettings}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium" htmlFor="card-type">
                            Type
                          </label>
                          <select
                            id="card-type"
                            className="mt-2 flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                            value={draftType}
                            onChange={(event) =>
                              setDraftType(event.target.value as ContactCardType)
                            }
                            disabled={savingSettings}
                          >
                            {CARD_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draftSensitive}
                              onChange={(event) =>
                                setDraftSensitive(event.target.checked)
                              }
                              disabled={savingSettings}
                            />
                            Keep this card private — don't allow WhatsApp sharing
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ViewField label="Name" value={card.name} />
                        <ViewField label="Type" value={CARD_TYPE_LABELS[card.type]} />
                        <ViewField
                          label="Sharing"
                          value={
                            card.isSensitive
                              ? "Private — WhatsApp sharing off"
                              : "Shareable"
                          }
                        />
                      </div>
                    )}
                  </EditableSection>
                </div>
              ) : null}

              {activeTab === "history" ? (
                <div role="tabpanel" aria-label={TAB_LABELS.history}>
                  <Panel className="space-y-4 p-5">
                    <PanelHeader title="Share history" />

                    {isLoadingShares ? (
                      <div className="space-y-3">
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                      </div>
                    ) : null}

                    {!isLoadingShares && sharesError ? (
                      <Alert className="flex items-start gap-3">
                        <AlertCircle
                          className="mt-0.5 h-4 w-4 text-destructive"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium">Could not load share history</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {sharesError}
                          </p>
                        </div>
                      </Alert>
                    ) : null}

                    {!isLoadingShares && !sharesError && shareBatches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No one has been sent this card yet.
                      </p>
                    ) : null}

                    {!isLoadingShares && !sharesError && shareBatches.length > 0 ? (
                      <>
                        <div className="space-y-4">
                          {/*
                            Every row may poll: ShareBatchStatus only starts a timer
                            while a batch is unsettled, so finished history is inert
                            and a resend on any row picks its status back up.
                          */}
                          {shareBatches.map((batch) => (
                            <div
                              key={batch.id}
                              className="rounded-lg border border-border p-4"
                            >
                              <ShareBatchStatus
                                batch={batch}
                                onChange={(updated) =>
                                  handleBatchChange(batch.id, updated)
                                }
                              />
                            </div>
                          ))}
                        </div>
                        {sharesTotalPages > 1 ? (
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={sharesPage <= 1 || isLoadingShares}
                              onClick={handlePrevPage}
                            >
                              Previous
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Page {sharesPage} of {sharesTotalPages}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                sharesPage >= sharesTotalPages || isLoadingShares
                              }
                              onClick={handleNextPage}
                            >
                              Next
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </Panel>
                </div>
              ) : null}
            </div>

            <div
              data-tour="card-vcard-preview"
              className="mt-6 lg:sticky lg:top-6 lg:mt-0 lg:self-start"
            >
              {/* Remounted after a save or a copy so it re-reads the vCard. */}
              <VcardPreview
                key={previewKey}
                cardId={card.id}
                fieldTypes={fieldTypes}
                cardName={card.name}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/*
        `defaultFieldTypes` is passed explicitly, empty included: this page's live
        state is ahead of the store between a toggle and its write, and an empty
        list means the same "share everything" here that it means everywhere else.
      */}
      {card ? (
        <ShareCardDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          card={card}
          senderName={senderName}
          defaultFieldTypes={fieldTypes}
          onShared={handleShared}
        />
      ) : null}
    </AppShell>
  );
}
