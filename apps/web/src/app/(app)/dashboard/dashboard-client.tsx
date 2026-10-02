"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { cardPalettes } from "@/card/card-palette";
import { resolveCard } from "@/card/resolve-card";
import type { TemplatePalette } from "@/card/template-palettes";
import {
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { Skeleton } from "@/components/primitives/skeleton";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { AttentionList } from "@/components/dashboard/attention-list";
import { CARD_THUMB_LIMIT, CardsTile } from "@/components/dashboard/cards-tile";
import { ContactsTile, RECENT_CONTACT_LIMIT } from "@/components/dashboard/contacts-tile";
import { profileCompleteness } from "@/components/dashboard/profile-completeness";
import { ProfileTile, roleLine, type ProfileTileProps } from "@/components/dashboard/profile-tile";
import { ReachBars } from "@/components/dashboard/reach-bars";
import { ReachPanel } from "@/components/dashboard/reach-panel";
import { useApiResource } from "@/lib/use-api";
import { toDashboardView, type DashboardView } from "@/lib/dashboard/metrics";
import { reachScore, type ReachScore } from "@/lib/dashboard/reach-score";
import type { Contact, ResolvedCard } from "@/types/domain";

import {
  emptyDashboardHome,
  fetchDashboardHome,
  type DashboardHomeData,
} from "./dashboard-data";

/**
 * `/dashboard` — the owner's landing surface.
 *
 * ## Reading order (client feedback, 2026-09-28)
 *
 * "Proposed order: Profile, Cards, Contacts (logical onboarding flow)". So the page opens on
 * three summary tiles in exactly that order, one row of three from `lg`, stacked below it, all
 * the same weight. Each one leads with what the owner has and ends on the next action; an empty
 * tile prompts the action rather than explaining the product ("Create your first card").
 *
 * The sharing analytics (reach score, needs attention, links shared per week, opens by card)
 * are kept and moved below the tiles under one "Sharing" heading. They are secondary: flat on
 * the canvas, with the tiles as the only lifted objects.
 *
 * The old "Profile strength" region is gone. It folded into the Profile tile, whose
 * completeness is measured against a named key set rather than a group count.
 *
 * ## Contracts kept from the previous build
 *
 * · **No `isFiltered`.** The dashboard has no search and no filter, so a user with zero cards
 *   gets the first-run state, never the filtered-to-nothing one.
 * · **`isEmpty` is this screen's own verdict**: the owner has no cards. The empty state still
 *   renders the three tiles (the owner still has a profile); it drops the sharing section,
 *   because there is nothing to measure yet.
 * · **The shell owns the page's one `<main>`.** This root is a `section`.
 * · **The `<h1>` lives in `page.tsx`**, so headings here start at `h2`: the three tiles and
 *   "Sharing" are `h2`, everything inside the sharing section is `h3`.
 * · **`order` utilities are banned in `SHELL_CLASS`.** It is a flex column, so an `order` there
 *   reorders the page rather than arranging columns. `lg:order-1` once sent the score panel to
 *   the bottom of every desktop viewport.
 * · **Every number comes from `GET /dashboard`.** The card and contact lists are read for
 *   thumbnails, colour and recency, never for a count. See `dashboard-data.ts`.
 */

/**
 * Shared by the screen root and the Suspense fallback so the two occupy the same box and
 * nothing moves when the data arrives.
 */
const SHELL_CLASS = "mt-10 flex flex-col gap-12 pb-16";

/** The three summary tiles: stacked, then one row of three from `lg`, stretched to one height. */
const TILES_CLASS = "grid gap-4 lg:grid-cols-3";

/** The sharing section's first row: score beside the queue from `lg`, score first below it. */
const SHARING_ROW_CLASS = "grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14";

/** The two charts, side by side from `lg`. */
const CHARTS_ROW_CLASS = "grid gap-10 lg:grid-cols-2 lg:gap-14";

/** The tile frame, restated for the bones so waiting and arrived occupy the same box. */
const TILE_FRAME_CLASS = "flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-5";

interface DashboardModel extends DashboardView {
  score: ReachScore;
  /** `cardId` → the colour that card wears. Empty when `GET /cards` failed; charts fall back. */
  palettes: ReadonlyMap<string, TemplatePalette>;
  /** Whether the owner has any cards. Unknown (`null` count) is treated as yes. */
  hasCards: boolean;
  profile: ProfileTileProps;
  recentCards: readonly ResolvedCard[];
  recentContacts: readonly Contact[];
  /** The card "Share your card" opens: the most recently updated one. */
  shareCardId: string | null;
}

/**
 * Everything the success surface renders.
 *
 * ⚠ **No arithmetic on the numbers.** Every count, bucket and queue row arrives computed by
 * `GET /dashboard`; this reshapes it and derives the score, as before. The only client-side work
 * is presentational: which three cards and contacts are most recent, and whether each profile
 * key item is present.
 */
function readDashboard(data: DashboardHomeData): DashboardModel {
  const { summary, profile } = data;
  const cards = data.cards ?? [];
  const byRecent = [...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const recentCards: ResolvedCard[] = [];
  for (const card of byRecent) {
    if (recentCards.length === CARD_THUMB_LIMIT) break;
    try {
      recentCards.push(resolveCard(card, profile.user, profile.groups, profile.fields));
    } catch {
      /* A card whose template or palette no longer resolves costs its thumbnail, not the
         dashboard. The id is logged; nothing from the card's fields is. */
      console.warn("[contactbook] dashboard.thumb.unresolved", { cardId: card.id });
    }
  }

  const recentContacts = [...(data.contacts ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_CONTACT_LIMIT);

  const { user } = profile;
  const photoField = profile.fields.find(
    (field) => field.type === "PHOTO" && field.value.trim().length > 0,
  );

  return {
    ...toDashboardView(summary),
    /* The RAW response, not the view: `toDashboardView` caps `cardReach` for chart width, and
       the "ready" lever has to count every card the owner has. */
    score: reachScore(summary),
    palettes: cardPalettes(cards),
    /* An unreadable `cards` (null) is not "no cards": treating it as zero would show an owner who
       has cards the first-run state. */
    hasCards: summary.totals.cards === null || summary.totals.cards > 0,
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleLine(profile.fields),
      phone: user.phone,
      email: user.email,
      photoUrl: user.avatarUrl ?? photoField?.value ?? null,
      completeness: profileCompleteness(profile),
    },
    recentCards,
    recentContacts,
    shareCardId: byRecent[0]?.id ?? null,
  };
}

/* ── loading ────────────────────────────────────────────────────────────────────────────── */

/**
 * One tile's bones, inside the tile's own frame, carrying the tile's region handle so the same
 * selector addresses the same box before and after the data lands.
 */
function TileBones({ region, label }: { region: string; label: string }): ReactElement {
  return (
    <div data-dashboard-region={region} className={TILE_FRAME_CLASS}>
      <div role="status" aria-busy="true" data-loading-skeleton="tile">
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" data-skeleton-bones="" className="flex flex-col gap-5">
          <Skeleton className="h-3 w-20 rounded-xs" />
          <div className="flex items-center gap-4">
            <Skeleton variant="circle" className="size-16 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3 rounded-xs" />
              <Skeleton className="h-3 w-1/2 rounded-xs" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * The loading family: layout-matched bones, never a spinner. Row for row the arrived layout:
 * three tiles, the sharing heading, score beside the queue, the two charts.
 */
function DashboardBones(): ReactElement {
  return (
    <>
      <div className={TILES_CLASS}>
        <TileBones region="profile" label="Loading your profile" />
        <TileBones region="cards" label="Loading your cards" />
        <TileBones region="contacts" label="Loading your contacts" />
      </div>

      <div data-dashboard-region="sharing" className="flex flex-col gap-8">
        <Skeleton className="h-6 w-24 rounded-xs" />
        <div className={SHARING_ROW_CLASS}>
          <div data-dashboard-region="stats">
            <LoadingSkeleton variant="stats" label="Loading your reach score" />
          </div>
          <div data-dashboard-region="attention">
            <LoadingSkeleton variant="list" count={3} label="Loading what needs attention" />
          </div>
        </div>
        <div data-dashboard-region="charts" className={CHARTS_ROW_CLASS}>
          <LoadingSkeleton variant="list" count={3} label="Loading links shared per week" />
          <LoadingSkeleton variant="list" count={3} label="Loading your cards by opens" />
        </div>
      </div>
    </>
  );
}

/**
 * The `<Suspense>` fallback for `page.tsx` and the body of `loading.tsx`.
 *
 * It carries **no `data-screen-state`** on purpose: the attribute is the client screen's report
 * of what it resolved, and a fallback carrying it would put two `[data-screen-state]` elements on
 * the page for the length of the swap, which a strict Playwright locator cannot survive.
 * `aria-busy` is the honest signal while it waits.
 */
export function DashboardSkeleton(): ReactElement {
  return (
    <div data-dashboard-skeleton="" aria-busy="true" className={SHELL_CLASS}>
      <DashboardBones />
    </div>
  );
}

/* ── the screen ─────────────────────────────────────────────────────────────────────────── */

function SummaryTiles({ model }: { model: DashboardModel }): ReactElement {
  return (
    <div data-dashboard-tiles="" className={TILES_CLASS}>
      <ProfileTile {...model.profile} />
      <CardsTile count={model.totals.cards} recent={model.recentCards} />
      <ContactsTile
        count={model.totals.contacts}
        recent={model.recentContacts}
        shareCardId={model.shareCardId}
        hasCards={model.hasCards}
      />
    </div>
  );
}

function SharingSection({ model }: { model: DashboardModel }): ReactElement {
  return (
    <section
      data-dashboard-region="sharing"
      aria-labelledby="dashboard-sharing-heading"
      className="flex flex-col gap-8"
    >
      <h2 id="dashboard-sharing-heading" className="text-h3 text-ink">
        Sharing
      </h2>

      <div className={SHARING_ROW_CLASS}>
        <div data-dashboard-region="stats">
          <ReachPanel score={model.score} totals={model.totals} headingLevel={3} />
        </div>
        {/* No wrapper here: `<AttentionList>` carries `data-dashboard-region="attention"` on its
            own section, and a wrapper with the same handle would put it on the page twice. */}
        <AttentionList rows={model.attention} palettes={model.palettes} headingLevel={3} />
      </div>

      {/* Full width between them: nested in a side column the charts resolved to ~280px, which
          truncates every card name in the reach list. */}
      <div data-dashboard-region="charts" className={CHARTS_ROW_CLASS}>
        <ActivityChart weeks={model.weeks} />
        <ReachBars rows={model.reach} palettes={model.palettes} />
      </div>
    </section>
  );
}

export function DashboardClient(): ReactElement {
  const router = useRouter();
  const { state, data, error } = useApiResource(fetchDashboardHome, emptyDashboardHome);

  const model = useMemo(() => (data === null ? null : readDashboard(data)), [data]);

  const screenState = resolveDataScreenState({
    state,
    // This screen's own verdict: the owner has no cards. Never `state === 'empty'`.
    isEmpty: model !== null && !model.hasCards,
    // No `isFiltered`: there is no filter and no search on this screen.
  });

  let body: ReactElement;
  if (screenState === "error" || screenState === "offline") {
    body = (
      <ErrorPanel
        error={error}
        // The screen is healthy and only its data failed, so the retry re-renders the route
        // rather than resetting a tree that never threw.
        onRetry={() => router.refresh()}
        homeHref="/cards"
        homeLabel="Go to your cards"
      />
    );
  } else if (model === null) {
    /* Still loading — or `?state=empty` before the real data it is derived from has arrived. */
    body = <DashboardBones />;
  } else {
    body = (
      <>
        <SummaryTiles model={model} />
        {model.hasCards ? <SharingSection model={model} /> : null}
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
