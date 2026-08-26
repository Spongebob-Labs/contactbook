"use client";

/**
 * The fixture gateway — **the only data source in the application** (spec §3.1, §6.3).
 *
 * ⚠ TWO THINGS EVERY CONSUMER MUST KNOW
 *
 * 1. `useFixture` reads `?state=` through `useSearchParams()`, which makes any component
 *    calling it client-side and **requires a `<Suspense>` boundary above it** in the App
 *    Router. Without one, `next build` fails on prerender. Every data route is therefore a
 *    two-file pair — a server `page.tsx` rendering `<Suspense fallback={…}>` around a
 *    `'use client'` child that calls this hook. Plan §0.5 has the pattern to copy.
 *
 * 2. It returns **synchronously**. No promises, no timers, no artificial latency (§6.3). A
 *    simulated delay would make every downstream test flaky for no benefit, and
 *    `?state=loading` already provides a loading surface that is deterministic.
 *
 * There is no network call, no cache, no revalidation and no persistence here, and there
 * must never be: AC-06 is the machine check on that wall.
 */

import { useSearchParams } from "next/navigation";

import type { FixtureError, FixtureResult, ScreenState } from "@/types/domain";
import { EMPTY_FIXTURE_DB, FIXTURE_DB, type FixtureDb } from "@/fixtures";
import { parseScreenState, STATE_PARAM } from "@/lib/screen-state";

/**
 * The copy for the two error states, written to the §6.10 rules: human, sentence case, no
 * jargon, no error codes, and a detail line that says what the reader can do next.
 */
const FIXTURE_ERRORS: Readonly<Record<"error" | "offline", FixtureError>> = {
  error: {
    kind: "unknown",
    title: "Something went wrong",
    detail: "We couldn't load this just now. Try again in a moment.",
    retryable: true,
  },
  offline: {
    kind: "network",
    title: "You're offline",
    detail: "Check your connection and try again.",
    retryable: true,
  },
};

/** The error a given screen state surfaces, or `null` when the state carries data. */
export function fixtureErrorFor(state: ScreenState): FixtureError | null {
  if (state === "error") return FIXTURE_ERRORS.error;
  if (state === "offline") return FIXTURE_ERRORS.offline;
  return null;
}

/**
 * Select from the fixture database, through the `?state=` switch.
 *
 * `select` is only called on the two states that carry data (`success`, `empty`) — the
 * others return `data: null`, so a selector must never be relied on for a side effect.
 */
export function useFixture<T>(select: (db: FixtureDb) => T): FixtureResult<T> {
  const searchParams = useSearchParams();
  const state = parseScreenState(searchParams.get(STATE_PARAM));

  if (state === "success") {
    return { state, data: select(FIXTURE_DB), error: null };
  }
  if (state === "empty") {
    // Empty is *data*, not absence: the screen renders its first-run empty state, which is
    // a different component from the filtered-to-nothing one (§8D.1).
    return { state, data: select(EMPTY_FIXTURE_DB), error: null };
  }
  // loading | error | offline — nothing to select from.
  return { state, data: null, error: fixtureErrorFor(state) };
}

export type { FixtureDb };
