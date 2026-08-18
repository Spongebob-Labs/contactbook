import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Eye,
  Pencil,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CardQr, qrPngDataUrl } from "@/components/cards/card-qr";
import { CardRenderer } from "@/components/cards/card-renderer";
import {
  ShareSheet,
  type ShareSheetOptionId,
} from "@/components/ui/share-sheet";
import {
  downloadVcard,
  triggerDownload,
} from "@/lib/vcard-from-snapshot";
import { ContactSection } from "@/components/cards/builder/contact-section";
import { DesignSection } from "@/components/cards/builder/design-section";
import { IdentitySection } from "@/components/cards/builder/identity-section";
import { LinksSection } from "@/components/cards/builder/links-section";
import { PhoneFrame } from "@/components/cards/builder/phone-frame";
import { WalletBadge } from "@/components/cards/builder/wallet-badge";
import { isAppleDevice } from "@/lib/platform";
import { fetchWalletStatus } from "@/lib/wallet-api";
import {
  PublishBar,
  type PublishState,
} from "@/components/cards/builder/publish-bar";
import {
  hasUnpublishedChanges,
  markCardPublished,
  markCardUnpublished,
  readCardDraft,
  snapshotFingerprint,
  writeCardDraft,
} from "@/lib/card-draft";
import {
  cardSnapshotSchema,
  emptyCardSnapshot,
  parseCardSnapshot,
  type CardSnapshot,
} from "@/lib/card-schema";
import {
  cardShareUrl,
  getCard,
  publishCard,
  unpublishCard,
} from "@/lib/cards-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { ApiError } from "@/lib/api";
import type { ContactCard } from "@/lib/types";
import { cn } from "@/lib/utils";

type SectionKey = "identity" | "contact" | "links" | "design";

/**
 * No icons: four icon+label tabs truncate to "Ide… Co… Links De…" at 375px.
 * The words are unambiguous on their own, so the icons were costing legibility
 * without adding meaning.
 */
const SECTIONS = [
  { key: "identity" as const, label: "Identity" },
  { key: "contact" as const, label: "Contact" },
  { key: "links" as const, label: "Links" },
  { key: "design" as const, label: "Design" },
];

/** Keystrokes are cheap; localStorage writes with an inline photo are not. */
const DRAFT_SAVE_DELAY_MS = 400;

export default function CardBuilderPage() {
  const { cardId } = useParams();

  const [card, setCard] = useState<ContactCard | null>(null);
  const [snapshot, setSnapshot] = useState<CardSnapshot | null>(null);
  const [publishedFingerprint, setPublishedFingerprint] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [section, setSection] = useState<SectionKey>("identity");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshot = useRef<CardSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!cardId) {
        setError("Card id is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getCard(cardId);
        if (!isMounted) {
          return;
        }
        setCard(data);

        // A local draft always wins: it is by definition newer than whatever
        // was last published, and clobbering it with server state would throw
        // away unpublished work the moment someone reloads the page.
        const draft = readCardDraft(cardId);
        if (draft) {
          setSnapshot(draft.snapshot);
          setPublishedFingerprint(draft.publishedFingerprint);
          return;
        }

        const parsed =
          data.publishedSnapshot != null
            ? parseCardSnapshot(data.publishedSnapshot)
            : null;

        if (parsed?.ok) {
          setSnapshot(parsed.snapshot);
          setPublishedFingerprint(snapshotFingerprint(parsed.snapshot));
          markCardPublished(cardId, parsed.snapshot);
          return;
        }

        const seed = emptyCardSnapshot(data.name);
        setSnapshot(seed);
        setPublishedFingerprint(null);
        writeCardDraft(cardId, seed);
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card for builder", err);
          setError(friendlyErrorMessages.load);
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
  }, [cardId]);

  // Flush any debounced draft on unmount so navigating away mid-edit does not
  // silently discard the last few keystrokes.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      if (cardId && pendingSnapshot.current) {
        writeCardDraft(cardId, pendingSnapshot.current);
      }
    };
  }, [cardId]);

  // Ask whether a pass can actually be issued rather than offering a badge
  // that would fail: until a Pass Type ID certificate exists, it cannot.
  useEffect(() => {
    let isMounted = true;
    void fetchWalletStatus()
      .then((status) => {
        if (isMounted) {
          setWalletConfigured(status.configured);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const currentFingerprint = useMemo(
    () => (snapshot ? snapshotFingerprint(snapshot) : null),
    [snapshot],
  );

  const handleChange = (next: CardSnapshot) => {
    setSnapshot(next);
    pendingSnapshot.current = next;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      if (!cardId) {
        return;
      }
      const stored = writeCardDraft(cardId, next);
      pendingSnapshot.current = null;
      if (!stored) {
        toast.error(
          "Could not save your draft — browser storage is full. Try a smaller photo.",
        );
      }
    }, DRAFT_SAVE_DELAY_MS);
  };

  const publishState: PublishState = useMemo(() => {
    if (!card?.publishedAt) {
      return card?.slug ? "offline" : "draft";
    }
    if (publishedFingerprint === null) {
      return "dirty";
    }
    return currentFingerprint === publishedFingerprint ? "live" : "dirty";
  }, [card?.publishedAt, card?.slug, currentFingerprint, publishedFingerprint]);

  const shareUrl = card?.slug ? cardShareUrl(card.slug) : null;

  const handlePublish = async () => {
    if (!cardId || !snapshot) {
      return;
    }

    // Validate before the round trip: the builder tolerates half-finished
    // input, the published card must not.
    const parsed = cardSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(
        issue
          ? `${issue.path.join(" › ") || "Card"}: ${issue.message}`
          : "This card isn't ready to publish yet.",
      );
      return;
    }

    setIsPublishing(true);
    try {
      const result = await publishCard(cardId, parsed.data);
      markCardPublished(cardId, parsed.data);
      setPublishedFingerprint(snapshotFingerprint(parsed.data));
      setCard((current) =>
        current
          ? {
              ...current,
              slug: result.slug ?? current.slug ?? null,
              publishedAt: result.publishedAt ?? new Date().toISOString(),
            }
          : current,
      );
      toast.success("Card published.");
    } catch (err) {
      logUiError("Could not publish card", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not publish this card.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!cardId) {
      return;
    }
    setIsUnpublishing(true);
    try {
      await unpublishCard(cardId);
      markCardUnpublished(cardId);
      setPublishedFingerprint(null);
      setCard((current) =>
        current ? { ...current, publishedAt: null } : current,
      );
      toast.success("Card taken offline. The link is still reserved.");
    } catch (err) {
      logUiError("Could not unpublish card", err);
      toast.error("Could not take this card offline.");
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      logUiError("Could not copy share link", err);
      toast.error("Could not copy the link.");
    }
  };

  const handleShareOption = async (option: ShareSheetOptionId) => {
    if (!snapshot) {
      return;
    }
    setShareOpen(false);
    try {
      if (option === "save-contact") {
        downloadVcard(snapshot, shareUrl ?? undefined);
        return;
      }
      if (option === "download-qr" && shareUrl) {
        triggerDownload(await qrPngDataUrl(shareUrl), `${card?.slug}-qr.png`);
        return;
      }
      if (option === "copy-link") {
        await handleCopyLink();
      }
    } catch (err) {
      logUiError("Builder share action failed", err);
      toast.error("That didn't work. Try another option.");
    }
  };

  const preview =
    snapshot != null ? (
      <PhoneFrame>
        <CardRenderer
          snapshot={snapshot}
          interactive={false}
          // Before the first publish there is no URL to encode. Showing a
          // placeholder rather than a QR of nothing keeps the preview honest —
          // a fake code here is exactly the bug we removed from the old mark.
          qr={
            shareUrl ? (
              <CardQr url={shareUrl} size={132} />
            ) : (
              <div className="flex h-[132px] w-[132px] items-center justify-center rounded-lg border border-dashed border-black/20 px-3 text-center text-[10px] leading-tight text-black/45">
                Your QR appears here once you publish
              </div>
            )
          }
          onSaveContact={() => undefined}
        />
      </PhoneFrame>
    ) : null;

  return (
    <AppShell>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={cardId ? `/dashboard/cards/${cardId}` : "/dashboard/cards"}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {card?.name ?? "Card"}
        </Link>

        <div className="flex items-center gap-2">
          {/* Apple devices only — Wallet does not exist elsewhere — and only
              once the card is published, since the pass barcode is its URL. */}
          {cardId && walletConfigured && card?.publishedAt && isAppleDevice() ? (
            <WalletBadge cardId={cardId} className="h-9 px-3 text-[13px]" />
          ) : null}
          {snapshot ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
          ) : null}
          {shareUrl && card?.publishedAt ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View live
            </a>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[520px] w-full rounded-xl" />
          <Skeleton className="hidden h-[640px] w-full rounded-[38px] lg:block" />
        </section>
      ) : error ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Could not load this card</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </Alert>
      ) : snapshot ? (
        <>
          <PublishBar
            state={publishState}
            shareUrl={shareUrl}
            isPublishing={isPublishing}
            isUnpublishing={isUnpublishing}
            onPublish={() => void handlePublish()}
            onUnpublish={() => void handleUnpublish()}
            onCopyLink={() => void handleCopyLink()}
            copied={copied}
          />

          <div className="mt-5 lg:hidden">
            <SegmentedTabs
              aria-label="Builder view"
              value={mobileView}
              onChange={setMobileView}
              items={[
                { key: "edit", label: "Edit", icon: Pencil },
                { key: "preview", label: "Preview", icon: Eye },
              ]}
            />
          </div>

          <section className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
            <div
              className={cn(
                "min-w-0 flex-col gap-5",
                mobileView === "edit" ? "flex" : "hidden lg:flex",
              )}
            >
              <SegmentedTabs
                aria-label="Card sections"
                value={section}
                onChange={setSection}
                items={SECTIONS}
              />

              <div className="rounded-xl border border-border bg-surface p-5">
                {section === "identity" ? (
                  <IdentitySection snapshot={snapshot} onChange={handleChange} />
                ) : null}
                {section === "contact" ? (
                  <ContactSection snapshot={snapshot} onChange={handleChange} />
                ) : null}
                {section === "links" ? (
                  <LinksSection snapshot={snapshot} onChange={handleChange} />
                ) : null}
                {section === "design" ? (
                  <DesignSection snapshot={snapshot} onChange={handleChange} />
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                "lg:sticky lg:top-6",
                mobileView === "preview" ? "block" : "hidden lg:block",
              )}
            >
              {preview}
              <p className="mt-3 text-center text-[12px] text-muted-foreground">
                Exactly what people see at your link.
              </p>
            </div>
          </section>
        </>
      ) : null}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSelect={(id) => void handleShareOption(id)}
        // Link and QR only exist once a slug does; saving the contact file
        // works from the draft at any point.
        options={
          shareUrl
            ? ["copy-link", "save-contact", "download-qr"]
            : ["save-contact"]
        }
      />
    </AppShell>
  );
}
