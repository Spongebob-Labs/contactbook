"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { buildVcf, canBuildVcf } from "@/card/build-vcf";
import { ShareFace } from "@/card/share-face";
import { resolveCard } from "@/card/resolve-card";
import { CardTypeChip, FieldCountMeter, FieldList } from "@/components/app";
import {
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { Button, buttonClassName } from "@/components/primitives";
import { DeleteCardDialog } from "@/components/share/delete-card-dialog";
import { ExportPngButton } from "@/components/share/export-png-button";
import { ShareSheet, useVcfDownload } from "@/components/share/share-sheet";
import { WalletPassBlock } from "@/components/share/wallet-pass-block";
import { CardShares, SendToContact, type MintedLink } from "@/components/share/card-sharing";
import { NotifyBanner, NotifyRecipients } from "@/components/share/notify-recipients";
import { cards as api } from "@/lib/api/browser";
import { fetchCardDetail } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { useApiResource } from "@/lib/use-api";
import { useToast } from "@/components/overlay";
import { CARD_LINK_PENDING, formatLongDate } from "@/lib/format";
import type {
  Contact,
  ContactCard,
  CardShareRow,
  FieldGroup,
  FixtureError,
  ProfileField,
  ResolvedCard,
  ResolvedField,
  ScreenState,
  User,
} from "@/types/domain";

/**
 * `/cards/[cardId]` — the owner's view of one card (spec §8D.3, plan T22).
 *
 * ## ⚠ THE ONE ARCHITECTURAL RULE THIS FILE EXISTS TO KEEP — invariant I-5
 *
 * **`resolveCard` is called once. `buildVcf` is called once. Everything downstream is handed
 * those two values.** The renderer, the share panel's preview, the share panel's download,
 * the in-card "Save to contacts" control and the PNG export all receive the *same*
 * `ResolvedCard` reference, and the two files a user can leave this screen with are written
 * from that one object.
 *
 * That is not tidiness. The old build's recorded bug was that the card a user previewed and
 * the file they sent came from two separate derivations which merely usually agreed (§6.4).
 * `resolveCard` returns a **fresh object on every call**, so identity has to be *carried*
 * down the tree — it cannot be recovered later by resolving again and comparing values.
 * A second `resolveCard(...)` anywhere below this line kills I-5 even though every field
 * would still match today, and AC-29 is asserted at exactly that seam.
 *
 * The two `useMemo`s below are therefore load-bearing rather than an optimisation:
 * `FIXTURE_DB` is a frozen module constant, so `data` is referentially stable and the
 * resolved card survives a re-render. Without them, opening the share sheet would hand the
 * preview a different object from the one the card was drawn with.
 *
 * ## ⚠ THIS SCREEN SHOWS TWO DIFFERENT THINGS AND MUST SAY WHICH IS WHICH
 *
 * The product has two verticals and only one of them used to be legible here.
 *
 * · **The pass.** The rigid 336×500 `<ShareFace>` in the left column, with its QR. It exists
 *   to be added to Apple Wallet or Google Wallet and held up to be scanned. Its QR encodes
 *   `qrPayload` — the card's **own public URL**, minted by the API as `Card.publicToken` when
 *   the card is created. ⚠ This is NOT the link the Share action sends: Share mints a
 *   per-recipient `ShareLink`, revocable for that one person. A QR is one-to-many and gets
 *   printed, so it must not carry a token that revoking one contact would kill.
 * · **The card.** The page either link opens, at `/c/{token}`, which the builder previews.
 *
 * Until `<WalletPassBlock>` landed, the face was painted here with no caption and no
 * explanation, so it read as an unexplained smaller drawing of the same card, and nobody
 * could tell from the UI that a Contact Book card goes in a wallet at all. Every sentence
 * that would have said so lived in doc comments (`share-face.tsx`, `template-types.ts`). The
 * block owns that copy now; the reasoning, and the five QR contract suites that constrain how
 * it may touch the face, are recorded at its head. **The face must keep rendering on this
 * route, unscaled, in normal flow — do not tab it, dialog it, lazy-mount it or scale it.**
 *
 * ## What "empty" means on this screen
 * §8D.3's card-detail row puts *not-found* where other screens put a first-run empty, and
 * that decision belongs to the server: an id that does not resolve never reaches this
 * component (`page.tsx` calls `notFound()`, §11 E-36). So the empty **family** here means
 * what it means on the public card — *this card shares nothing*. Two routes reach it and
 * both are correct: `card_empty_demo` maps no fields, and `?state=empty` empties the profile
 * the card filters (§11 E-08), which produces the same card with the same consequence.
 * `canBuildVcf` — T11's single definition — decides it, never an inline field count.
 *
 * ## Delete is confirmed inline, not by a toast
 * §8D.1: a destructive action is confirmed *before* the fact by `ConfirmDialog` and reported
 * *after* it inline, because a "Card deleted" toast with no Undo is the worst of both. The
 * deletion itself is React state and nothing else (§10.1, §5.7) — this run has no
 * persistence layer, by design.
 */

/* ── the data this screen renders ─────────────────────────────────────────────────────── */

/**
 * The profile this card filters.
 *
 * The *card* itself arrives separately, resolved by the server half so an unknown id reaches the
 * not-found boundary rather than a client-side empty state (§11 E-36).
 */
export interface CardDetailData {
  user: User;
  groups: FieldGroup[];
  fields: ProfileField[];
}

/** One share link on this card, with the recipient's name already resolved for display. */
/** Re-exported so existing importers of this screen keep working. */
export type { CardShareRow };

/**
 * `?state=empty` — the profile has nothing to map.
 *
 * That is what "empty" means on *this* screen, and it is deliberately not "this card maps
 * nothing": a card that shares nothing on a healthy profile is a card with a problem, which
 * `canBuildVcf` announces separately.
 */
export function emptyCardDetailData(real: CardDetailData): CardDetailData {
  return { ...real, groups: real.groups.map((group) => ({ ...group, fieldIds: [] })), fields: [] };
}

export interface CardDetailClientProps {
  /**
   * The card the id addresses, resolved on the server so the not-found decision and the
   * page's metadata agree with what renders here (§11 E-36).
   */
  /** Straight from the awaited `params` in `page.tsx`. */
  cardId: string;
}

export function CardDetailClient({ cardId }: CardDetailClientProps) {
  // `useCallback` because `useApiResource` re-runs on loader identity change.
  const load = useCallback(() => fetchCardDetail(cardId)(), [cardId]);
  const result = useApiResource(load);

  return (
    <CardDetailScreen
      key={result.state}
      cardId={cardId}
      state={result.state}
      card={result.data?.card ?? null}
      data={
        result.data === null || result.data === undefined
          ? null
          : { user: result.data.user, groups: result.data.groups, fields: result.data.fields }
      }
      shares={result.data?.shares ?? []}
      contacts={result.data?.contacts ?? []}
      error={result.error}
      reload={result.reload}
    />
  );
}

function CardDetailScreen({
  cardId,
  card,
  state,
  data,
  shares,
  contacts,
  error,
  reload,
}: {
  cardId: string;
  card: ContactCard | null;
  state: ScreenState;
  data: CardDetailData | null;
  shares: readonly CardShareRow[];
  contacts: readonly Contact[];
  error: FixtureError | null;
  reload: () => void;
}) {
  const router = useRouter();
  const { savePending, downloadVcf } = useVcfDownload();
  const { toast } = useToast();
  const [archiving, startArchive] = useTransition();
  const [deleted, setDeleted] = useState(false);

  /**
   * The link minted in this session, held locally so the panel publishes it immediately.
   *
   * `reload()` re-reads `GET /share-links` and would eventually produce the same URL, but a
   * network round trip between pressing "Create link" and seeing one is exactly the gap the old
   * panel left — the user pressed a button and the link area did not change. This closes it, and
   * the re-read then confirms it.
   *
   * It takes precedence over the list below rather than merely filling a hole, so the panel
   * always shows the most recent recipient rather than the first one.
   *
   * ⚠ It no longer moves the QR. Minting used to rewrite `qrPayload`, which meant sharing with
   * one person repointed the printed symbol at their private, individually-revocable token.
   * The QR is now `card.publicUrl` and is not a function of who has been sent the card.
   */
  const [minted, setMinted] = useState<MintedLink | null>(null);

  /**
   * The one re-read every sharing affordance goes through.
   *
   * ⚠ `setMinted(null)` matters here as much as the reload: a link minted this session is held
   * locally so the panel can publish it immediately, and after any change to the share set the
   * server's answer is the only honest source. Shared by revoke/restore and by notify, so a
   * notify's reconcile cannot drift from what a revoke does.
   */
  const reloadShares = useCallback(() => {
    setMinted(null);
    reload();
  }, [reload]);



  const resolved = useMemo(
    // `card` is null while the read is in flight and on a failure — both are states this screen
    // already renders, so there is nothing to resolve yet.
    () =>
      card === null || data === null
        ? null
        /* ⚠ No per-recipient link is passed, deliberately. `resolveCard` used to take the
           newest ACTIVE ShareLink URL, which meant the moment an owner shared with one person
           this card's QR silently switched to advertising that person's private, individually
           revocable token. It now reads `card.publicUrl` — the card's own one-to-many link —
           so the symbol is stable no matter who has been sent the card. A per-recipient link
           still exists and still matters; it just belongs to the send flow, not to the QR. */
        : resolveCard(card, data.user, data.groups, data.fields),
    [card, data],
  );

  /**
   * ⚠ THE ONE vCARD, written from the object above and from nothing else.
   *
   * `null` is the E-01 gate: `canBuildVcf` says the card shares nothing, so `buildVcf` — which
   * throws `EmptyCardError` rather than writing the old build's 73-byte name-only file — is
   * never called, and no control that would call it is rendered.
   */
  const vcf = useMemo(
    () => (resolved !== null && canBuildVcf(resolved) ? buildVcf(resolved) : null),
    [resolved],
  );

  /**
   * The rows the screen lists — `fields` then `socialFields`, exactly the set `buildVcf`
   * writes, which is what makes AC-22's "visible set === file set" provable here rather than
   * aspirational. `FieldList` groups by the same `FieldCategory` table `resolveCard` sorted
   * on and never re-sorts inside a group, so concatenating restores §6.4's order rather than
   * inventing a second one.
   */
  const rows = useMemo<readonly ResolvedField[]>(
    () => (resolved === null ? [] : [...resolved.fields, ...resolved.socialFields]),
    [resolved],
  );

  /**
   * The in-card primary action. It receives the renderer's own `resolved` — the same
   * reference this component memoised — and pairs it with the one `vcf` string, so the file
   * the card offers and the file the share panel previews cannot be two different documents.
   */
  const onSaveToContacts = useCallback(
    (target: ResolvedCard) => {
      downloadVcf(target, vcf);
    },
    [downloadVcf, vcf],
  );

  const screenState = resolveDataScreenState({
    state,
    // See the module note: "empty" here is a card that shares nothing, not a short list.
    isEmpty: resolved !== null && vcf === null,
  });

  const showCard =
    resolved !== null && (screenState === "success" || screenState === "empty");

  const editHref = `/cards/${cardId}/edit`;

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label="Card detail"
      data-card-detail={cardId}
      className="flex flex-col gap-8 pb-16"
    >
      {screenState === "loading" ? (
        <LoadingSkeleton variant="card-detail" label="Loading this card" />
      ) : null}

      {screenState === "error" || screenState === "offline" ? (
        <div className="py-12">
          <ErrorPanel
            error={error}
            headingLevel={1}
            onRetry={() => {
              router.refresh();
            }}
            homeHref="/cards"
            homeLabel="Go to cards"
          />
        </div>
      ) : null}

      {showCard && resolved !== null && deleted ? (
        /* §8D.1's inline confirmation for a destructive action. It replaces the card rather
           than sitting beside it: leaving a deleted card on screen with a banner over it is
           how a user ends up handing out something they thought was gone. */
        <section
          data-card-deleted=""
          className="mx-auto mt-12 w-full max-w-[480px] rounded-lg border border-line bg-surface px-8 py-10"
        >
          <div data-prose className="flex flex-col gap-3">
            <p className="text-overline uppercase text-ink-3">Deleted</p>
            <h1 className="text-h3 text-ink">{`"${resolved.cardName}" was deleted`}</h1>
            <p className="text-base text-ink-3">
              {`Its QR code and ${resolved.qrPayload} no longer resolve. The profile fields it mapped are untouched.`}
            </p>
            <div className="mt-3 flex">
              <Link href="/cards" className={buttonClassName({ variant: "secondary" })}>
                Go to cards
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {showCard && resolved !== null && !deleted ? (
        <>
          <PageHeader
            overline="Card"
            title={resolved.cardName}
            subtitle={card === null ? undefined : `Updated ${formatLongDate(card.updatedAt)}`}
            actions={
              <div data-card-detail-actions="" className="flex flex-wrap items-center gap-3">
                {/* An anchor wearing the button skin — never a `<button>` inside a link. */}
                <Link
                  href={editHref}
                  data-card-detail-action="edit"
                  className={buttonClassName()}
                >
                  Edit
                </Link>

                {/* Renders nothing when this card has no active recipients — an owner with
                    nobody to notify gets no control, not a disabled one. */}
                <NotifyRecipients
                  cardId={cardId}
                  shares={shares}
                  contacts={contacts}
                  onChanged={reloadShares}
                />

                <ShareSheet
                  resolved={resolved}
                  sharesNothing={vcf === null}
                  editHref={editHref}
                  sendSlot={
                    <SendToContact
                      cardId={cardId}
                      contacts={contacts}
                      alreadySentTo={new Set(shares.map((share) => share.contactId))}
                      onShared={(link) => {
                        // Local first, then the re-read: the panel updates on the press, and
                        // "who has it" catches up a moment later.
                        setMinted(link);
                        reload();
                      }}
                    />
                  }
                  lastSent={minted ?? undefined}
                  trigger={
                    <Button variant="secondary" data-card-detail-action="share">
                      Share
                    </Button>
                  }
                />

                <ExportPngButton resolved={resolved} />

                <DeleteCardDialog
                  resolved={resolved}
                  busy={archiving}
                  // Archiving revokes every active link, so the number of people affected is
                  // the fact the owner is actually deciding about.
                  shareCount={shares.filter((share) => share.status === "ACTIVE").length}
                  onConfirm={() => {
                    startArchive(async () => {
                      try {
                        await api.archive(cardId);
                      } catch (thrown) {
                        const shown = toScreenError(thrown);
                        toast({ title: shown.title, description: shown.detail, tone: "danger" });
                        return;
                      }
                      // The local flag drives this screen's own "deleted" surface; the push is
                      // what takes the owner somewhere that still exists.
                      setDeleted(true);
                      toast({ title: `Archived ${resolved.cardName}`, tone: "danger" });
                      router.push("/cards");
                    });
                  }}
                  trigger={
                    <Button variant="secondary" data-card-detail-action="delete">
                      Delete
                    </Button>
                  }
                />
              </div>
            }
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
            {/* §8D.3: the card is pinned on desktop and first in the stack on mobile. It is
                `sticky` rather than `fixed` — §6.5 forbids `position: fixed` anywhere inside
                the card root, and a fixed wrapper would take the same behaviour with it. */}
            <div
              data-card-detail-preview=""
              /* Fluid. The one rigid object on this screen is the share face, and the rail that
                 lets it overhang a 320px viewport lives around the face itself inside
                 `<WalletPassBlock>` — not here. Scoping it to this column instead made the
                 block's own prose 336px wide in a 296px box, so the wallet-pass copy needed a
                 sideways nudge to be read, which is a worse bug than the one it fixed. */
              className="min-w-0 lg:sticky lg:top-8 lg:self-start"
            >
              {/* ⚠ The face is handed to `<WalletPassBlock>` as children and is rendered by
                  it verbatim — unscaled, unclipped, untransformed, still at 336×500. That is
                  not a stylistic preference: five contract suites decode and measure this
                  exact element on this exact route (`tests/helpers/qr-surface.ts`), and this
                  is the only surface in the product that paints it at the size every constant
                  in `qr-geometry.ts` was derived from. The block adds copy above it and
                  controls beneath it, in normal flow, and nothing else. */}
              <WalletPassBlock
                resolved={resolved}
                /*
                  ⚠ THE SAVE ACTION IS AN APP BUTTON AND IT IS PASSED AS `action`, NOT CHILDREN.

                  Both halves of that were bugs, and both produced the same report — *"what is
                  this glitch onto the UI"*:

                    1. **It was a `<CardActionButton surface="canvas">`.** For every deep
                       palette `canvasActionBg` IS the palette's own ground (see
                       `derive-palette.ts`), so on a Sapphire card this rendered a Sapphire
                       block, one card wide, sixteen pixels below a Sapphire card. The two
                       fused and the card's own bottom edge stopped being readable. It was
                       never a contrast failure — `PALETTE_CONTRACT` proves that fill against
                       the white canvas and passes; nothing measured it against the card above
                       it. The block's other two controls were already plain `<Button>`s, so
                       this was the only control on the canvas dressed as the card.
                    2. **It was `children`.** `children` is rendered inside the block's
                       `overflow-x-auto` rail, which exists to let the rigid 336px face
                       overhang a 296px column without scrolling the document. The button went
                       into the scroller with it and was sized by the rail instead of the
                       block.

                  `fullWidth` rather than a `w-full` wrapper: the block already owns the
                  column's width, and the primitive has the prop.
                */
                action={
                  vcf === null ? null : (
                    <Button
                      variant="primary"
                      fullWidth
                      data-card-save-contacts=""
                      onClick={() => onSaveToContacts(resolved)}
                      /* The primitive owns the in-flight state: `loading` sets `aria-busy`,
                         swaps the label and really swallows the click (a bare `disabled` is
                         advisory to the browser). The old call hand-rolled all three with
                         `disabled` + `busy` + a label ternary, and `busy` is not even a prop
                         on this component — it was silently doing nothing. */
                      loading={savePending}
                      loadingLabel="Saving…"
                    >
                      Save to contacts
                    </Button>
                  )
                }
              >
                {/* ⚠ The face is handed to `<WalletPassBlock>` as children and is rendered by
                    it verbatim — unscaled, unclipped, untransformed, still at 336×500. That is
                    not a stylistic preference: five contract suites decode and measure this
                    exact element on this exact route (`tests/helpers/qr-surface.ts`), and this
                    is the only surface in the product that paints it at the size every constant
                    in `qr-geometry.ts` was derived from. The block adds copy above it, the
                    owner's action beneath it and its own controls below that, in normal flow,
                    and nothing else.

                    ⚠ NOTHING ELSE MAY BE ADDED HERE. This slot is inside the horizontal scroll
                    rail; anything but the face belongs in `action` or in the block itself. */}
                <ShareFace resolved={resolved} mode="full" />
              </WalletPassBlock>
            </div>

            <div data-card-detail-body="" className="flex min-w-0 flex-col gap-8">
              <div
                data-card-meta=""
                className="flex flex-col gap-3 border-b border-line pb-6"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <CardTypeChip type={resolved.cardType} size="md" />
                  <span data-card-meta-template="" className="text-sm text-ink-3">
                    {resolved.template.name}
                  </span>
                  {/* AC-36's meter, reading T11's `canBuildVcf` — never a local count. */}
                  <FieldCountMeter resolved={resolved} variant="meter" />
                </div>

                {/* The exact string the QR encodes (§8A.6), so the printed card and this
                    screen can never publish two different URLs. Absent until the card is
                    saved — stated rather than rendered as a link to nowhere. */}
                <p data-card-meta-link="" className="text-machine text-sm break-all text-ink-3">
                  {resolved.qrPayload == null ? (
                    <span className="text-ink-3">{CARD_LINK_PENDING}</span>
                  ) : (
                    /* 44px on touch. This is the card's own public URL and the one link on
                       this screen a reader taps to check what the QR opens; `--text-sm` gives
                       it a 20px line box. `inline-block` is required for the padding to affect
                       the hit area, and the negative margin keeps the meta block's rhythm. */
                    <Link
                      href={resolved.qrPayload}
                      className={cn(
                        "text-ink underline underline-offset-4",
                        "max-md:-my-3 max-md:inline-block max-md:py-3",
                      )}
                    >
                      {resolved.qrPayload}
                    </Link>
                  )}
                </p>
              </div>

              {vcf === null ? (
                <div className="flex flex-col gap-3">
                  <h2 className="text-overline uppercase text-ink-3">Fields</h2>
                  {/* The consequence itself — "anyone who scans it will only get your name"
                      — is stated once, by the meter above, which is the single owner of that
                      sentence (T17). Repeating it here would put the same warning on the
                      screen twice and make neither copy the authority. */}
                  <p data-card-detail-empty-note="" className="text-base text-ink-3">
                    This card maps no profile fields, so there is nothing to list here.
                  </p>
                  <div className="flex">
                    <Link href={editHref} className={buttonClassName()}>
                      Add fields
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <h2 className="text-overline uppercase text-ink-3">Fields</h2>
                  {/* T12's rows, rendered verbatim by T17: `context` reaches the DOM (E-23),
                      every external destination carries `rel="noopener noreferrer"` (AC-32),
                      and a masked row keeps no href, no raw title and no reveal control
                      (AC-33) — all four are defeatable only at the consumer. */}
                  <FieldList fields={rows} headingLevel={3} />
                </div>
              )}

              {/* Who has this card, and whether they opened it.
                  It lives below the field list rather than in the share dialog because it is
                  *status*, not an action: a dialog you have to open to find out whether anybody
                  read your card is a dialog nobody opens. Revoke and restore are here too —
                  both address one link, and this is the only place every link is listed. */}
              <section
                aria-labelledby="card-shares-heading"
                className="flex flex-col gap-4 border-t border-line pt-8"
              >
                <h2 id="card-shares-heading" className="text-overline uppercase text-ink-3">
                  Sent to
                </h2>
                {/* ⚠ Above the list, and only when somebody is actually behind.

                    It belongs here rather than in the header because it is a fact about *these
                    recipients*, and this is already documented as the only place every link is
                    listed. It renders nothing at all when everyone is caught up — a permanent
                    zero-count banner trains the eye to skip the row it needs to notice. */}
                <NotifyBanner
                  cardId={cardId}
                  shares={shares}
                  contacts={contacts}
                  onChanged={reloadShares}
                />

                <CardShares
                  cardId={cardId}
                  shares={shares}
                  onChanged={reloadShares}
                />
              </section>
            </div>
          </div>
        </>
      ) : null}
    </ScreenStateRoot>
  );
}
