"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { resolveCard } from "@/card/resolve-card";
import { CardThumbTile } from "@/components/app";
import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { buttonClassName } from "@/components/primitives/button";
import { fetchDashboardData } from "@/lib/api/browser-loaders";
import { useApiResource } from "@/lib/use-api";
import { attention, cardReach, sharingByWeek, totals } from "@/lib/dashboard/metrics";
import type {
  Attention,
  CardReach,
  DashboardTotals,
  WeekBucket,
} from "@/lib/dashboard/metrics";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ReachBars } from "@/components/dashboard/reach-bars";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AttentionList } from "@/components/dashboard/attention-list";
import type { ContactCard, ResolvedCard } from "@/types/domain";

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
const ATTENTION_BONE_COUNT = 3;

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


/** What `fetchDashboardData` returns — named so `readDashboard` is not typed against a loader. */
type DashboardApiData = Awaited<ReturnType<typeof fetchDashboardData>>;

interface DashboardData {
  totals: DashboardTotals;
  weeks: readonly WeekBucket[];
  reach: readonly CardReach[];
  attention: readonly Attention[];
  featured: ResolvedCard | null;
  cards: readonly ContactCard[];
}

/**
 * Everything the success surface renders, derived once.
 *
 * `resolveCard` is pure (I-4) but not free, and the resource hook returns a **fresh result
 * object on every render** — so this is memoised on the loaded data itself, which the hook
 * keeps referentially stable between loads, and never on the result wrapper around it.
 */
function readDashboard(db: DashboardApiData): DashboardData {
  const metricCards = db.cards.map((card) => ({
    id: card.id,
    name: card.name,
    fieldIds: card.fieldIds,
  }));

  /* Newest first by `updatedAt` — the card the owner most recently touched, which is what
     "most recent" means to the person who touched it. */
  const featuredCard = [...db.cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  return {
    cards: db.cards,
    totals: totals({
      cards: metricCards,
      contactCount: db.contacts.length,
      fieldCount: db.fields.length,
      links: db.links,
      behind: db.behind,
    }),
    weeks: sharingByWeek(db.links, new Date()),
    reach: cardReach(metricCards, db.links),
    attention: attention(metricCards, db.links, db.behindByCardId),
    featured:
      featuredCard === undefined
        ? null
        : resolveCard(featuredCard, db.user, db.groups, db.fields),
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
      {/* The charts' box, reserved. The rule this column serves is that **nothing shifts**
          when the data lands, so the bones have to occupy the same two-up grid the charts
          will — a stats skeleton alone would let two figures appear under a settled layout,
          which is exactly the shift it forbids. */}
      <div data-dashboard-region="attention">
        <LoadingSkeleton variant="list" count={ATTENTION_BONE_COUNT} label="Loading what needs attention" />
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
  /* ⚠ `GET /cards` + `/contacts` + `/share-links` + the profile reads + one `/audience` per
     card — all visible in the Network tab. This screen ran on `useFixture` until now, which
     meant it reported the fixture set's 9 cards, 8 contacts and 35 fields to every owner and
     drew a card whose link pointed at `card.example`. Numbers on a dashboard are read as
     facts about the reader's own data; inventing them is worse than showing nothing. */
  const { state, data, error } = useApiResource(fetchDashboardData);

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
        {/* Row 1 — the five headline numbers. Discrete panels with gaps, deliberately not a
            `border-y` band: `PageHeader` already closes with a rule, so a banded row put two
            hairlines around forty pixels of empty space and read as a stray banner.

            Every tile carries a hint, including Cards. One tile without one left a hole in an
            otherwise even row — the raggedness was as much of the problem as the rules. */}
        {/* ⚠ **Five tiles, two columns on a phone — so the fifth spans the row rather than
            dangling beside a void.**
            5 into 2 leaves a half-empty third row, and a lone tile with an empty cell next to
            it reads as content that failed to load. `col-span-2` closes the row; the tile
            switches to its `row` layout at the same breakpoint, because a box twice as wide as
            it is tall cannot keep a stacked column without becoming mostly empty. From `sm` up
            the grid is 3 across (5 = 3 + 2, no orphan) and `xl` is 5 across, so neither the
            span nor the row layout applies above a phone. */}
        <div
          data-dashboard-region="stats"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
        >
          <StatTile label="Cards" value={dashboard.totals.cards} hint="Built so far" />
          <StatTile
            label="People reached"
            value={dashboard.totals.peopleReached}
            hint="Hold a live link"
          />
          <StatTile label="Opens" value={dashboard.totals.totalOpens} hint="Across every card" />
          <StatTile
            label="Not opened"
            value={dashboard.totals.neverOpened}
            hint="Sent, never viewed"
            actionable
          />
          <div className="col-span-2 sm:col-span-1">
            <StatTile
              label="Not told"
              value={dashboard.totals.behind}
              hint="Behind on a change"
              actionable
              row
            />
          </div>
        </div>

        {/* Row 2 — the two charts get the full width between them. Nested in the featured
            card's column they resolved to ~280px at a 1280px viewport, which puts twelve weekly
            columns at 21px each and truncates every card name in the reach list. A chart that
            has to be decoded is not doing its job. */}
        <div data-dashboard-region="charts" className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ActivityChart weeks={dashboard.weeks} />
          <ReachBars rows={dashboard.reach} />
        </div>

        {/* Row 3 — what to do, beside the card most recently touched. Pairing them fills the
            column the card would otherwise leave empty, and puts the actions next to the thing
            they act on. */}
        <div className={GRID_CLASS}>
          {dashboard.featured === null ? null : <RecentCard resolved={dashboard.featured} />}
          <div className="lg:order-1">
            <AttentionList rows={dashboard.attention} />
          </div>
        </div>
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
