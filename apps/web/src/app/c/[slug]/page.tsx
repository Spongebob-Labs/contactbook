import type { Metadata } from "next";
import Link from "next/link";

import { fetchPublicCard, type PublicCardResult } from "@/lib/api/public-card";
import { resolvePublicCard } from "@/lib/api/public-card-map";

import { PublicCardClient } from "./public-card-client";

/**
 * `/c/[slug]` — the page a stranger lands on (spec §6.1 R-18, §8D.5, plan T18).
 *
 * ## The whole point of the product, from the other side
 * Somebody taps a WhatsApp link, lands here, and sees the card its owner built — the fields they
 * chose, in the design they chose — and can save it straight to their phone. No session, no
 * account: the token in the URL is the entire input.
 *
 * `GET /api/v1/public/links/{token}` is what turns that token into a card. It is the other half of
 * `POST /cards/{id}/share`, which mints the link.
 *
 * ## It renders the real card, through the owner's own renderer
 * The payload is mapped into domain shapes (`resolvePublicCard`) and handed to the same
 * `resolveCard` + `<CardPage>` the owner sees on `/cards/[cardId]`. One rendering path, so the
 * stranger's view cannot drift from the owner's — and the design, the ordering and the masking
 * rules all come along without being re-implemented.
 *
 * `<CardPage>` is mobile-first by construction. As of 2026-09-09 the card is no longer the page:
 * it is an **inset, rounded object floating on the page**, in the share face's own radius, border
 * and elevation — see `card.css` §1b for the client's reasoning and the numbers. The actions sit
 * beneath the identity, inside it.
 *
 * ## ⚠ One unverified detail, and how to settle it in one page-load
 * The endpoint is **undocumented in Swagger**, so its exact response field names are unconfirmed —
 * that needs a real token, which needs an account that has shared a card. `parsePublicCard` is
 * therefore shape-tolerant: it looks for the name and the field list across the layouts this
 * endpoint plausibly returns, and reports which one matched.
 *
 * Open one real link and the answer is in two places: the `[api]` server log line
 * (`ok shape=… fields=…`) and `data-public-shape` on the rendered `<main>`. If it logs
 * `UNREADABLE_SHAPE keys=…`, those keys are the real payload's top level and this parser needs one
 * more branch.
 *
 * ## Three Next 16 facts this file depends on
 * - **`params` is a `Promise`** and is awaited.
 * - **`PageProps<'/c/[slug]'>` is globally generated and must never be imported.**
 * - `generateMetadata` runs for unknown slugs too, so it answers without throwing.
 *
 * ## No `notFound()` here, deliberately
 * Every outcome is a *panel on this route* rather than the not-found boundary, because the states
 * are genuinely different and only one of them is "no such card": a revoked link and an
 * undeployed endpoint both need their own sentence. §11's rule is that the reader never meets a
 * raw 404, and a panel that names the real situation satisfies it better than a generic one.
 */

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicCard(slug);

  if (result.kind !== "ok") {
    // No name to publish, and nothing about the failure belongs in a title (§6.10).
    return { title: "Contact card", robots: { index: false } };
  }

  return {
    title: result.card.fullName.length > 0 ? result.card.fullName : result.card.cardName,
    description: "Save these details straight to your phone.",
    // Not indexable either way: a share link is addressed to one person.
    robots: { index: false },
  };
}

/** The copy for each non-`ok` outcome. Written to §6.10 — no codes, no jargon, a way forward. */
function panelFor(kind: Exclude<PublicCardResult["kind"], "ok">) {
  switch (kind) {
    case "not-implemented":
      // Should be unreachable now the path is `/public/links/{token}`. Kept distinct because
      // "the endpoint is gone" and "this link is unknown" need different sentences.
      return {
        overline: "Not available yet",
        title: "This link isn't live yet",
        detail:
          "Shared cards are still being switched on. Ask whoever sent this to share their details another way for now.",
      };
    case "revoked":
      return {
        overline: "Turned off",
        title: "This link has been turned off",
        detail:
          "The person who sent it stopped sharing this card. Ask them for a new link if you still need their details.",
      };
    case "not-found":
      // The API keeps "unknown token" and "card unpublished" indistinguishable, so this sentence
      // covers both without guessing which.
      return {
        overline: "Not found",
        title: "We couldn't find that card",
        detail: "This link may be wrong, or the card behind it may have been removed.",
      };
    case "error":
      return {
        overline: "Something went wrong",
        title: "We couldn't open this card",
        detail: "Try again in a moment.",
      };
  }
}

/**
 * The origin the card's QR points at — this app's own, because the reader is already on it.
 *
 * Read at module scope: Next inlines `NEXT_PUBLIC_*` at build time, so this is a constant rather
 * than a per-request lookup.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export default async function PublicCardPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const result = await fetchPublicCard(slug);

  if (result.kind !== "ok") {
    const panel = panelFor(result.kind);
    return (
      <main
        id="main"
        data-public-card-state={result.kind}
        className="flex min-h-full flex-1 flex-col items-center justify-center bg-canvas p-6"
      >
        {/* ⚠ Written out rather than reusing `<NotFoundPanel>`, and the reason is a real bug this
            replaced: that component is a **client** component (it calls `buttonClassName`), and
            calling it from this Server Component throws at request time — "Attempted to call
            buttonClassName() from the server". Neither `tsc` nor `next build` catches it; only
            loading the page does.

            A stranger's landing page has nothing to click in any of these states, so there is no
            interactivity to justify a client boundary here. Plain markup is both correct and
            lighter. */}
        <div
          data-public-card-panel=""
          className="flex w-full max-w-[480px] flex-col gap-2 rounded-lg border border-line bg-surface p-8"
        >
          <p className="text-overline uppercase text-ink-3">{panel.overline}</p>
          <h1 className="text-h2 text-ink">{panel.title}</h1>
          <p data-prose className="text-base text-ink-3">
            {panel.detail}
          </p>
        </div>
      </main>
    );
  }

  /* The QR on the card encodes the page the reader is already on, rather than a fabricated
     origin — so a card passed phone-to-phone keeps working. */
  const resolved = resolvePublicCard(result.card, `${SITE_URL}/c/${slug}`);

  return (
    <main
      id="main"
      data-public-card-state="ok"
      // The layout the parser matched, so one real link identifies the payload's real shape.
      data-public-shape={result.card.shape}
      // The two card typefaces are opted into only by routes that draw a card (§8.4, AC-17).
      data-card-fonts=""
      /* ⚠ **THE OPT-IN THAT MAKES THE CARD AN OBJECT — the only route that sets it.**

         `card.css` §1b keys the whole treatment off this attribute: the page's gutter, the
         card's `max-width`, its radius, its `--c-face-border` hairline, its `--elevation-card`,
         the `flex: 1` that makes its ground independent of the field count, and the arrival
         animation. Without it `<CardPage>` renders exactly as it does inside the builder's
         preview and the marketing tiles, which is what those two surfaces need — they are
         already inside frames of their own and must not gain a second inset.

         ⚠ **What this attribute used to do, and why the change matters here.** It promoted
         `[data-card-ground]` to `position: fixed`, so the ground painted the whole viewport and
         a one-field card could not draw a short band of colour with white below it. That
         invariant is unchanged and still asserted; only its mechanism moved, because a fixed
         layer cannot be inset or rounded (`inset: 0` on it resolves against the initial
         containing block). §1b holds it with `flex: 1` on the article instead.

         The marker lives on the route that actually draws the card, not on a component: it went
         missing once already because it sat on `<PublicCardView>`, which this route does not
         render. `tests/e2e/public-card.spec.ts` asserts it. */
      data-card-page-surface=""
      className="flex min-h-full flex-1 flex-col bg-canvas"
    >
      <PublicCardClient resolved={resolved} token={slug} />

      {/* ⚠ **§8D.5's caption, restored — it had been orphaned, and now it has a home.**

          One line, ≥768px only: below that the viewport belongs to the card and the fields are
          what the reader came for. (They arrived *by* a QR, which is why there is deliberately
          no second QR on this page — see the head of `card-page.tsx`.)

          It went missing the same way the `data-card-page-surface` marker did: it lived inside
          `<PublicCardView>`, which this route does not render. `public-card.spec.ts` has been
          asserting it on every project since, and failing.

          ⚠ **It sits OUTSIDE the card, and that is the improvement.** In the old component it
          was the last line *inside* a full-bleed card, printed on the owner's palette — our
          mark on their surface. Now that the card is an inset object (`card.css` §1b) there is
          a real page underneath it, and a caption on that page is what it always wanted to be:
          the floor the card is standing on, in the app's own ink, not a footer the owner
          appears to have written. The card's `flex: 1` yields the line's height to it. */}
      <p
        data-public-card-made-with=""
        className="hidden shrink-0 pt-3 text-center text-xs text-ink-3 md:block"
      >
        {/* No underline-offset utility: `card.css` states the offset and the thickness for
            every link on this surface, so this one cannot disagree with the field rows. */}
        <Link href="/" className="underline">
          Made with Contact Book
        </Link>
      </p>
    </main>
  );
}
