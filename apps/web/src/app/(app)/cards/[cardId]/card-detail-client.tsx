"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { buildVcf, canBuildVcf } from "@/card/build-vcf";
import { ShareFace } from "@/card/share-face";
import { resolveCard } from "@/card/resolve-card";
import { FieldList } from "@/components/app";
import {
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { Button, buttonClassName } from "@/components/primitives";
import { CardLinkBlock } from "@/components/share/card-link-block";
import { CardShares } from "@/components/share/card-sharing";
import { DeleteCardDialog } from "@/components/share/delete-card-dialog";
import { NotifyBanner } from "@/components/share/notify-recipients";
import { SendToPhone, type SendToPhoneHandle } from "@/components/share/send-to-phone";
import { WalletActions } from "@/components/share/wallet-actions";
import { WalletPassBlock } from "@/components/share/wallet-pass-block";
import { cards as api } from "@/lib/api/browser";
import { fetchCardDetail } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { useApiResource } from "@/lib/use-api";
import { useToast } from "@/components/overlay";
import { formatLongDate } from "@/lib/format";
import type {
  Contact,
  ContactCard,
  CardShareRow,
  FieldGroup,
  FixtureError,
  ProfileField,
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
 * those two values.** The renderer, the share panel and the PNG export all receive the *same*
 * `ResolvedCard` reference, and the one file a user can leave this screen with — the PNG — is
 * written from that object.
 *
 * ⚠ The `.vcf` is no longer *written* on this screen at all: the in-card "Save to contacts"
 * was removed (see the ⚠ on `<WalletPassBlock>` below), so `buildVcf` survives here purely as
 * E-01's gate — `vcf === null` is what "this card shares nothing" means to the empty state and
 * to the share panel. The bytes themselves are owned by `tests/unit/build-vcf.test.ts` (§6.7
 * and AC-22, set equality included) and the download path by `/c/{slug}`, where saving a card
 * to your contacts is something a person actually does.
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
 * ## ⚠ THIS SCREEN IS SHARE-FIRST (client review, 2026-09-28)
 *
 * *"Sharing view needs a redesign: core function is sharing, not showing fields again."* So the
 * page is, in order: **(a)** the card itself — the share face, in the card's own palette, with
 * the QR someone scans; **(b)** "Send this card" to a phone number, the primary action;
 * **(c)** the card's own link with Copy beside it, WhatsApp and the share sheet; **(d)** Wallet —
 * Apple and Google (flagged until the pass endpoints exist) and a working "Save QR to phone";
 * **(e)** who it was sent to. The field list is demoted to a closed "What's on this card"
 * disclosure at the foot. The template name and the field-count meter are gone from the page:
 * the client read "Meridian · Field count 5" as noise.
 *
 * On desktop (a)+(d) are the pinned left column and (b)(c)(e) the right. On a phone the two
 * column wrappers are `display: contents`, so their children join one flex column and `order`
 * puts them in a–e sequence — the wallet row lands after the link rather than between the
 * card and the phone field.
 *
 * There is ONE share UI. The header's Share button does not open a dialog any more; it scrolls to
 * and focuses the phone field. `share-sheet.tsx` explains what happened to the old dialog.
 *
 * Two links live here and must not be confused. The QR and the "Card link" block carry
 * `qrPayload` — the card's own public URL (`Card.publicToken`), one-to-many, never repointed by a
 * send. A send mints a per-recipient `ShareLink`, revocable for that one person, and shows it in
 * the send result only.
 *
 * **The face must keep rendering on this route, unscaled, in normal flow, and it must be the
 * first `[data-card-root]` in the document** — five QR suites measure it here via
 * `document.querySelector` and a strict locator. Do not tab it, dialog it, lazy-mount it, scale
 * it, or render a `<CardPage>` anywhere on this route.
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

/**
 * `?state=empty` for the loaded payload: the same card, over a profile with nothing to map.
 * Module-level so it is one stable reference. Without it the override had no data to render and
 * the screen fell back to `success` (AC-24's empty row was failing for that reason).
 */
function emptyCardDetail<T extends CardDetailData>(real: T | null): T | null {
  return real === null ? null : { ...real, ...emptyCardDetailData(real) };
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
  const result = useApiResource(load, emptyCardDetail);

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
  const { toast } = useToast();
  const [archiving, startArchive] = useTransition();
  const [deleted, setDeleted] = useState(false);

  /**
   * The one re-read every sharing affordance goes through — a send, a revoke/restore, a notify —
   * so "Sent to" always shows the server's answer rather than a local guess.
   *
   * ⚠ Nothing minted here is held in this component any more. A send shows its own result in
   * place of the form (with the recipient's link), and the QR never follows a send: it is
   * `card.publicUrl`, not a function of who has been sent the card.
   */
  const reloadShares = useCallback(() => {
    reload();
  }, [reload]);

  /** The header's Share button focuses the phone field — one share UI, not a second dialog. */
  const sendBlock = useRef<SendToPhoneHandle>(null);

  /** Who already holds this card, so a repeat send can say "Same link as before." */
  const holders = useMemo(() => new Set(shares.map((share) => share.contactId)), [shares]);

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
   * never called.
   *
   * ⚠ Nothing on this screen hands these bytes to a user any more; the owner's "Save to
   * contacts" was removed on 2026-09-20. What is left is the gate — `vcf === null` is this
   * screen's single definition of "this card shares nothing", read by the empty state and by
   * the share panel — and it is deliberately still `buildVcf`'s answer rather than a second
   * `canBuildVcf` call at each site, so the two can never disagree about an edge case.
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
                {/* Scrolls to the phone field and focuses it. There is no share dialog: the share
                    controls are this page, and a second copy of them in a modal is how the old
                    screen came to show the same link twice. */}
                <Button
                  variant="secondary"
                  data-card-detail-action="share"
                  onClick={() => sendBlock.current?.focus()}
                >
                  Share
                </Button>

                {/* An anchor wearing the button skin — never a `<button>` inside a link. */}
                <Link
                  href={editHref}
                  data-card-detail-action="edit"
                  className={buttonClassName({ variant: "secondary" })}
                >
                  Edit
                </Link>

                {/* ⚠ "Notify recipients" was removed from this row on 2026-09-03 (the prompt opens
                    after Save in the editor; the banner above "Sent to" is the recovery path).
                    "Export PNG" left it on 2026-09-28 and is "Save QR to phone" in the wallet
                    row now. */}

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

          <div
            data-card-detail-layout=""
            className="flex flex-col gap-8 lg:grid lg:grid-cols-[336px_minmax(0,1fr)] lg:items-start lg:gap-x-12"
          >
            {/* ── left on desktop: the card and its wallet row ─────────────────────────────
                `contents` below lg, so the two children join the outer column and `order`
                can put the wallet row after the link. `sticky` rather than `fixed` — §6.5
                forbids `position: fixed` inside the card root — and as an ANCESTOR of the
                plate it is excluded from qr-overlap's fixed/sticky sweep by construction. */}
            <div
              data-card-detail-preview=""
              className="contents lg:sticky lg:top-8 lg:flex lg:min-w-0 lg:flex-col lg:gap-8 lg:self-start"
            >
              {/* ⚠ THE FACE IS HANDED TO `<WalletPassBlock>` AS CHILDREN AND IS RENDERED BY IT
                  VERBATIM — unscaled, unclipped, untransformed, still at 336×500. Five contract
                  suites decode and measure this exact element on this exact route
                  (`tests/helpers/qr-surface.ts`). NOTHING MAY BE ADDED TO THIS SLOT: it is the
                  block's horizontal scroll rail, and a control inside it is sized by the rigid
                  face rather than the column. Controls go in `<WalletActions>` below. */}
              <div data-card-detail-face="" className="order-1 min-w-0">
                <WalletPassBlock>
                  <ShareFace resolved={resolved} mode="full" />
                </WalletPassBlock>
              </div>

              <div className="order-4 min-w-0">
                <WalletActions cardId={cardId} resolved={resolved} />
              </div>
            </div>

            {/* ── right on desktop: send, link, who has it, what is on it ──────────────── */}
            <div
              data-card-detail-body=""
              className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-8"
            >
              <div className="order-2 min-w-0">
                <SendToPhone
                  ref={sendBlock}
                  title="Send this card"
                  cards={[{ id: cardId, name: resolved.cardName }]}
                  contacts={contacts}
                  alreadySent={(_, contactId) => holders.has(contactId)}
                  onSent={() => {
                    // "Sent to" catches up a moment later; the block has already shown the result.
                    reloadShares();
                  }}
                  notice={
                    vcf === null ? (
                      /* §11 E-01's consequence, in the owner's language, before they send. */
                      <p data-share-empty-note="" className="text-sm text-warning-ink">
                        This card has no fields yet, so the link only shows your name.{" "}
                        <Link
                          href={editHref}
                          data-share-add-fields=""
                          className="font-medium underline underline-offset-4"
                        >
                          Add fields
                        </Link>
                      </p>
                    ) : undefined
                  }
                />
              </div>

              <div className="order-3 min-w-0">
                {/* The exact string the QR encodes (§8A.6), so the printed card and this block
                    can never publish two different URLs. */}
                <CardLinkBlock url={resolved.qrPayload ?? null} cardName={resolved.cardName} />
              </div>

              {/* Who has this card, and whether they opened it. Status, not an action — and
                  the only place every link is listed, so revoke and restore live here too. */}
              <section
                aria-labelledby="card-shares-heading"
                className="order-5 flex min-w-0 flex-col gap-4 border-t border-line pt-8"
              >
                <h2 id="card-shares-heading" className="text-overline uppercase text-ink-3">
                  Sent to
                </h2>
                {/* Only when somebody is actually behind; renders nothing otherwise. */}
                <NotifyBanner
                  cardId={cardId}
                  shares={shares}
                  contacts={contacts}
                  onChanged={reloadShares}
                />

                <CardShares cardId={cardId} shares={shares} onChanged={reloadShares} />
              </section>

              {/* ⚠ DEMOTED, NOT DELETED. The client does not want the fields shown again on a
                  sharing screen, so they sit behind a closed disclosure. A native `<details>`
                  keeps the rows in the DOM — T12's guarantees (AC-32 `rel`, AC-33 masking, §6.4
                  order) are still asserted against the rendered list — and needs no script. */}
              <details
                data-card-fields=""
                className="group order-6 min-w-0 border-t border-line pt-2"
              >
                <summary
                  data-card-fields-toggle=""
                  className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden"
                >
                  <h2 className="text-sm font-medium text-ink">What&apos;s on this card</h2>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] group-open:rotate-180"
                  />
                </summary>

                <div className="flex flex-col gap-4 pb-2 pt-2">
                  {vcf === null ? (
                    <p data-card-detail-empty-note="" className="text-sm text-ink-3">
                      No fields on this card yet.
                    </p>
                  ) : (
                    /* T12's rows, rendered verbatim: `context` reaches the DOM (E-23), every
                       external destination carries `rel="noopener noreferrer"` (AC-32), and a
                       masked row keeps no href, no raw title and no reveal control (AC-33). */
                    <FieldList fields={rows} headingLevel={3} />
                  )}
                  <div>
                    <Link href={editHref} className={buttonClassName({ variant: "text-link" })}>
                      {vcf === null ? "Add fields" : "Edit fields"}
                    </Link>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </>
      ) : null}
    </ScreenStateRoot>
  );
}
