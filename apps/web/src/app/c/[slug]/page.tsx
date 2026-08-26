import type { Metadata } from "next";

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
 * `<CardPage>` is mobile-first by construction: the card is the page on a phone, full-bleed, with
 * the actions beneath it.
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
      className="flex min-h-full flex-1 flex-col bg-canvas"
    >
      <PublicCardClient resolved={resolved} />
    </main>
  );
}
