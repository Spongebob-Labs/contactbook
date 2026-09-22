"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { cardPalettes } from "@/card/card-palette";
import type { TemplatePalette } from "@/card/template-palettes";
import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { fetchDashboardData } from "@/lib/api/browser-loaders";
import { useApiResource } from "@/lib/use-api";
import { attention, cardReach, sharingByWeek, totals } from "@/lib/dashboard/metrics";
import type {
  Attention,
  CardReach,
  DashboardTotals,
  WeekBucket,
} from "@/lib/dashboard/metrics";
import { reachScore, type ReachScore } from "@/lib/dashboard/reach-score";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ReachBars } from "@/components/dashboard/reach-bars";
import { ReachPanel } from "@/components/dashboard/reach-panel";
import { AttentionList } from "@/components/dashboard/attention-list";
import { ProfileStrength, type ProfileGroupSummary } from "@/components/dashboard/profile-strength";
import type { ContactCard } from "@/types/domain";

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
 * ── What this screen deliberately does NOT show ──────────────────────────────────────
 * A thumbnail of the most recently edited card used to sit in the bottom-right slot. It was
 * removed 2026-09-20: it is the largest object on the screen the owner lands on when they leave
 * the builder, and it shows them the card they were just looking at. The slot carries
 * `<ProfileStrength>` instead — every card is a filter over the profile, so an empty group is a
 * gap in every card at once, which is the one thing the rest of this page cannot say.
 */

/** §8D.3: "a 'Recent contacts' list of 5". */
const ATTENTION_BONE_COUNT = 3;

/**
 * Shared by the screen root and the Suspense fallback so the two occupy the same box and
 * nothing moves when the data arrives (§8D.1, AC-17).
 */
const SHELL_CLASS = "mt-10 flex flex-col gap-12 pb-16";

/**
 * ≥1024px: the wide column takes the queue and the 18rem column takes profile strength. Below
 * that it collapses to one column in DOM order — queue first, which is the order that matters
 * on a phone, so no `order` is needed and none may be added. See the note on the stats region
 * about what an `order` does inside this page's flex column.
 */
const GRID_CLASS =
  "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-14";


/** What `fetchDashboardData` returns — named so `readDashboard` is not typed against a loader. */
type DashboardApiData = Awaited<ReturnType<typeof fetchDashboardData>>;

interface DashboardData {
  totals: DashboardTotals;
  /** The headline. Derived here with everything else so the panel re-computes nothing. */
  score: ReachScore;
  /**
   * `cardId` → the colour that card actually wears.
   *
   * Derived once here and handed down, rather than each chart looking a card up for itself: the
   * bars and the attention rows must agree about what colour a card is, and two independent
   * lookups is two chances to drift.
   */
  palettes: ReadonlyMap<string, TemplatePalette>;
  weeks: readonly WeekBucket[];
  reach: readonly CardReach[];
  attention: readonly Attention[];
  /** Every profile group with its field count — what `<ProfileStrength>` reads. */
  groups: readonly ProfileGroupSummary[];
  cards: readonly ContactCard[];
}

/**
 * Everything the success surface renders, derived once.
 *
 * Memoised on the loaded data itself — which the resource hook keeps referentially stable
 * between loads — and never on the result wrapper, which is a fresh object every render.
 */
function readDashboard(db: DashboardApiData): DashboardData {
  const metricCards = db.cards.map((card) => ({
    id: card.id,
    name: card.name,
    fieldIds: card.fieldIds,
  }));

  return {
    cards: db.cards,
    score: reachScore({ cards: metricCards, links: db.links, behind: db.behind }),
    palettes: cardPalettes(db.cards),
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
    /* ⚠ Every group, including the empty ones — they are the whole point. A summary that
       dropped them would report a profile as complete precisely when it is not. */
    groups: db.groups.map((g) => ({ id: g.id, name: g.name, fieldCount: g.fieldIds.length })),
  };
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
      {/* ⚠ The bones mirror the ARRIVED layout row for row, and that is the whole contract:
          score first at full width, then the two charts, then the queue beside the profile.
          When these disagreed — bones in a two-column grid, content in a stack — the page
          visibly re-flowed on every load, which is the shift §8D.1 and AC-17 forbid. */}
      <div data-dashboard-region="stats">
        <LoadingSkeleton variant="stats" label="Loading your reach score" />
      </div>

      <div data-dashboard-region="charts" className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <LoadingSkeleton variant="list" count={3} label="Loading your sharing activity" />
        <LoadingSkeleton variant="list" count={3} label="Loading your cards by opens" />
      </div>

      <div className={GRID_CLASS}>
        <div data-dashboard-region="attention">
          <LoadingSkeleton
            variant="list"
            count={ATTENTION_BONE_COUNT}
            label="Loading what needs attention"
          />
        </div>
        <div data-dashboard-region="profile-strength">
          <LoadingSkeleton variant="list" count={2} label="Loading your profile strength" />
        </div>
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
        {/* ⚠ **The score sits FIRST, and `lg:order-1` must never come back here.**
            `SHELL_CLASS` is a flex COLUMN, so an `order` on one child does not arrange columns —
            it reorders the page. `lg:order-1` against the default `order-0` of its siblings sent
            the headline panel to the BOTTOM of the dashboard on every desktop viewport, under
            the charts and the queue, which is where the client found it. The panel answers "how
            am I doing" and "what next", so it belongs directly under the page title; nothing here
            takes an `order` unless it is inside a grid that has columns to order. */}
        <div data-dashboard-region="stats">
          <ReachPanel score={dashboard.score} totals={dashboard.totals} />
        </div>

        {/* Row 2 — the two charts get the full width between them. Nested in a side column they
            resolved to ~280px at a 1280px viewport, which puts twelve weekly columns at 21px
            each and truncates every card name in the reach list. A chart that has to be decoded
            is not doing its job. */}
        <div data-dashboard-region="charts" className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ActivityChart weeks={dashboard.weeks} />
          <ReachBars rows={dashboard.reach} palettes={dashboard.palettes} />
        </div>

        {/* Row 3 — the queue, beside the profile it all draws from.

            ⚠ **The featured-card thumbnail used to sit here and is deliberately gone.** It was a
            picture of one card the owner had just been editing, on the screen they land on after
            leaving the builder — it told them something they already knew, and it was the single
            largest object on the page. The slot now carries profile strength, which is the one
            relevant thing the rest of the dashboard cannot show: every card is a filter over the
            profile, so an empty group is a gap in every card at once. */}
        <div className={GRID_CLASS}>
          {/* ⚠ **No wrapper `data-dashboard-region="attention"` here.** `<AttentionList>` puts
              that handle on its own `<section>` (attention-list.tsx), so wrapping it in a div
              carrying the same attribute rendered the region TWICE — every strict Playwright
              locator on it throws, and the bones render one where the content rendered two.
              The component is the grid item. `<ProfileStrength>` names itself
              `[data-profile-strength]` instead, so that one genuinely needs the wrapper. */}
          <AttentionList rows={dashboard.attention} palettes={dashboard.palettes} />
          <div data-dashboard-region="profile-strength">
            <ProfileStrength fieldCount={dashboard.totals.fields} groups={dashboard.groups} />
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
