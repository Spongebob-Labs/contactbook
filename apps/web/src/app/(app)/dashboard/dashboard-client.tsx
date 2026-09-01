"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { resolveCard } from "@/card/resolve-card";
import { CardThumbTile, ContactRow, StatRow, type StatSpec } from "@/components/app";
import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { buttonClassName } from "@/components/primitives/button";
import { useFixture } from "@/lib/fixture-gateway";
import type { Contact, ContactCard, ResolvedCard } from "@/types/domain";
import type { FixtureDb } from "@/fixtures";

/**
 * `/dashboard` — the owner's landing surface (spec §8D.3 dashboard row, §4.4 step 1,
 * AC-24, AC-16).
 *
 * Three totals, the card they touched last, and the five people who saved it most
 * recently. Nothing else: this screen exists to answer "what do I have and what did I
 * just do", and every extra tile on it would be a tile the reader has to skip.
 *
 * ── Four decisions that are contracts, not preferences ───────────────────────────────
 *
 * · **No `isFiltered`.** The dashboard has no search and no filter, so §8D.3's per-screen
 *   table marks its filtered-empty cell `n/a` and §11 E-09 says so twice over: a user with
 *   zero cards sees the **first-run** empty state here, never the filtered-to-nothing one.
 *   `resolveDataScreenState` defaults `isFiltered` to `false`, so the omission below is
 *   deliberate and load-bearing — passing anything truthy would swap the copy to
 *   "Clear filters" on a screen with no filters to clear. `EmptyFilteredState` is not
 *   imported at all, which makes the guarantee structural rather than conditional.
 *
 * · **`isEmpty` is this screen's own verdict.** Never `state === 'empty'`: §11 E-08 hands
 *   `?state=empty` seven field groups with no fields in them rather than zero groups, so
 *   only the screen knows what emptiness means for its own content. Here it is E-09's
 *   condition, literally — the owner has no cards, so there is no card to feature, no
 *   field to count into one, and nobody has scanned anything.
 *
 * · **The shell owns the page's one main landmark.** This root is a `section`.
 *   `ScreenStateRoot` will happily be told to render the landmark element instead, and it
 *   must not be: `AppShell` already renders it, and a second one fails axe's
 *   `landmark-unique` (AC-25).
 *
 * · **The `<h1>` lives in `page.tsx`.** `PageHeader` renders it, so every heading here
 *   starts at `h2` and the outline stays h1 → h2 → h3 (the tile's card name).
 *
 * ── The card this screen features is deliberately the worst one ──────────────────────
 * "Most recently updated" resolves to `card_empty_demo`, which maps **zero** fields — the
 * fixtures reproduce the old build's worst bug on purpose (§11.6). `CardThumbTile` carries
 * `FieldCountMeter`, which reads `canBuildVcf` and warns in words, so the dashboard shows
 * the warning on its most prominent object rather than hiding it three screens deep. Do
 * not "fix" the sort to skip it.
 */

/** §8D.3: "a 'Recent contacts' list of 5". */
const RECENT_CONTACT_COUNT = 5;

/**
 * Shared by the screen root and the Suspense fallback so the two occupy the same box and
 * nothing moves when the data arrives (§8D.1, AC-17).
 */
const SHELL_CLASS = "mt-10 flex flex-col gap-12 pb-16";

/**
 * ≥1024px: totals left, the featured card right (§8D.3). Below that it is one column and
 * the card comes **first**, which is why the card is first in the DOM and `order` moves it
 * right on a wide viewport rather than the other way round — the narrow layout is the one
 * where reading order and visual order have to agree.
 */
const GRID_CLASS =
  "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-14";

/**
 * Newest first, by the ISO timestamp. Never mutates the frozen fixture array.
 *
 * Three field names because three entities each carry their own: a card is `updatedAt`, and a
 * contact is `createdAt` — it used to be `savedAt`, which went with the saved-lead model.
 */
function byRecency<
  T extends {
    readonly updatedAt?: string;
    readonly createdAt?: string;
    readonly savedAt?: string;
  },
>(a: T, b: T): number {
  const left = a.updatedAt ?? a.createdAt ?? a.savedAt ?? "";
  const right = b.updatedAt ?? b.createdAt ?? b.savedAt ?? "";
  return right.localeCompare(left);
}

interface DashboardData {
  stats: readonly StatSpec[];
  featured: ResolvedCard | null;
  cards: readonly ContactCard[];
  recentContacts: readonly Contact[];
}

/**
 * Everything the success surface renders, derived once.
 *
 * `resolveCard` is pure (I-4) but not free, and `useFixture` returns a **fresh result
 * object on every render** — so this is memoised on the fixture database itself, which is
 * a frozen module constant with a stable identity, and never on the result wrapper.
 */
function readDashboard(db: FixtureDb): DashboardData {
  const cards = db.cards;
  const newest = [...cards].sort(byRecency)[0];

  return {
    stats: [
      { id: "cards", label: "Cards", value: cards.length, href: "/cards" },
      { id: "contacts", label: "Contacts", value: db.contacts.length, href: "/contacts" },
      { id: "fields", label: "Fields", value: db.fields.length, href: "/profile" },
    ],
    featured:
      newest === undefined ? null : resolveCard(newest, db.user, db.groups, db.fields),
    cards,
    recentContacts: [...db.contacts].sort(byRecency).slice(0, RECENT_CONTACT_COUNT),
  };
}

/** The featured card, its caption and the one way into the builder. */
function RecentCard({ resolved }: { resolved: ResolvedCard }): ReactElement {
  return (
    <section data-dashboard-region="recent-card" className="lg:order-2">
      {/* A visible heading, not `aria-labelledby` on a landmark: an unnamed `section` is
          generic, so the outline gets its structure from the heading and the page gains no
          second named region to keep unique (AC-25). */}
      <h2 className="text-overline uppercase text-ink-3">Most recent card</h2>

      {/* The tile is `relative` and its title is a stretched link, so the builder link
          stays outside it — nested inside, the overlay would swallow every click. */}
      <div className="mt-5 max-w-[240px]">
        <CardThumbTile
          resolved={resolved}
          href={`/cards/${resolved.cardId}`}
          headingLevel={3}
        />
      </div>

      <Link
        href={`/cards/${resolved.cardId}/edit`}
        data-dashboard-builder-link=""
        className={buttonClassName({ variant: "secondary", className: "mt-5" })}
      >
        Open builder
      </Link>
    </section>
  );
}

/** The five most recently saved contacts, and the way to the rest of them. */
function RecentContacts({
  contacts,
  cards,
}: {
  contacts: readonly Contact[];
  cards: readonly ContactCard[];
}): ReactElement {
  return (
    <section data-dashboard-region="recent-contacts">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
        <h2 className="text-lg text-ink">Recent contacts</h2>
        <Link href="/contacts" className={buttonClassName({ variant: "text-link" })}>
          All contacts
        </Link>
      </div>

      {contacts.length === 0 ? (
        // Unreachable with the shipped fixtures — the whole screen is empty before this
        // is — but a heading with nothing under it is worse than a sentence.
        <p data-prose className="mt-6 text-base text-ink-3">
          No contacts yet. Import your address book and they will appear here.
        </p>
      ) : (
        <ul data-dashboard-contact-list="">
          {contacts.map((contact) => (
            // `cards` is gone: a contact no longer has a source card, so there is nothing for
            // the row to resolve a slug against.
            <ContactRow
              key={contact.id}
              contact={contact}
              href={`/contacts/${contact.id}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The loading family: layout-matched bones, never a spinner (§8D.1).
 *
 * §8D.3 specifies "3 stat skeletons + one card-shaped skeleton"; the contact bones are
 * here as well because the rule the column serves is that **nothing shifts** when the data
 * lands, and five rows appearing under a settled layout is exactly the shift it forbids.
 *
 * Each region is its own `LoadingSkeleton`, so the page carries three polite `role="status"`
 * nodes while it waits. That is intentional — each one names what it is waiting for — and
 * it is why every query against them is scoped by region rather than by a bare role.
 *
 * The bones wear the same `data-dashboard-region` handles the real content does, so the
 * "nothing moves" claim is measurable: the same selector addresses the same box before and
 * after the data lands.
 */
function DashboardBones(): ReactElement {
  return (
    <>
      <div className={GRID_CLASS}>
        <div data-dashboard-region="recent-card" className="lg:order-2">
          <LoadingSkeleton
            variant="card"
            label="Loading your most recent card"
            className="max-w-[200px]"
          />
        </div>
        <div data-dashboard-region="stats" className="lg:order-1">
          <LoadingSkeleton variant="stats" label="Loading your totals" />
        </div>
      </div>
      <div data-dashboard-region="recent-contacts">
        <LoadingSkeleton
          variant="list"
          count={RECENT_CONTACT_COUNT}
          label="Loading recent contacts"
        />
      </div>
    </>
  );
}

/**
 * The `<Suspense>` fallback for `page.tsx` and the body of `loading.tsx`.
 *
 * It carries **no `data-screen-state`** on purpose, for two reasons and the second one is
 * the load-bearing one:
 *
 * 1. The attribute is the client screen's report of what it resolved. A fallback claiming
 *    `loading` would be read by the T29 sweeps as a screen that never finished.
 * 2. A fallback that carried it would put **two** `[data-screen-state]` elements on the
 *    page for as long as it takes React to swap the boundary out — and a strict Playwright
 *    locator does not retry a strict-mode violation, so every suite that addresses this
 *    screen by that attribute would flake at the swap. C2 diagnosed exactly that on
 *    `/c/[slug]` during wave 7. Here the count goes 0 → 1 and never 2.
 *
 * `aria-busy` is the honest signal while it waits.
 */
export function DashboardSkeleton(): ReactElement {
  return (
    <div data-dashboard-skeleton="" aria-busy="true" className={SHELL_CLASS}>
      <DashboardBones />
    </div>
  );
}

export function DashboardClient(): ReactElement {
  const router = useRouter();
  // The identity selector: `FIXTURE_DB` and `EMPTY_FIXTURE_DB` are frozen module
  // constants, so `data` is referentially stable and safe to memoise on — unlike the
  // result wrapper around it, which is new on every render.
  const { state, data, error } = useFixture((db) => db);

  const dashboard = useMemo(() => (data === null ? null : readDashboard(data)), [data]);

  const screenState = resolveDataScreenState({
    state,
    // E-09's condition, and this screen's own verdict — never `state === 'empty'`.
    isEmpty: dashboard === null || dashboard.cards.length === 0,
    // No `isFiltered`: there is no filter and no search on this screen (§8D.3).
  });

  let body: ReactElement;
  if (screenState === "loading") {
    body = <DashboardBones />;
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <ErrorPanel
        error={error}
        // No boundary caught this — the screen is healthy and only its data failed — so
        // the retry re-renders the route rather than resetting a tree that never threw.
        onRetry={() => router.refresh()}
        homeHref="/cards"
        homeLabel="Go to your cards"
      />
    );
  } else if (screenState === "empty" || dashboard === null) {
    body = (
      <EmptyState
        overline="Nothing here yet"
        title="Start with a card"
        description="A card is a filter over your profile: tick the fields you want to share, and the QR code carries exactly those and nothing else."
        action={{ label: "Create your first card", href: "/cards/new" }}
        secondaryAction={{ label: "Browse templates", href: "/templates" }}
      />
    );
  } else {
    body = (
      <>
        <div className={GRID_CLASS}>
          {dashboard.featured === null ? null : (
            <RecentCard resolved={dashboard.featured} />
          )}
          <div data-dashboard-region="stats" className="lg:order-1">
            <StatRow stats={dashboard.stats} />
          </div>
        </div>
        <RecentContacts contacts={dashboard.recentContacts} cards={dashboard.cards} />
      </>
    );
  }

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label="Dashboard overview"
      className={SHELL_CLASS}
    >
      {body}
    </ScreenStateRoot>
  );
}
