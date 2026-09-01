"use client";

/**
 * The `?state=` switch, over **real** data.
 *
 * ## What this replaces, and what it deliberately keeps
 * `fixture-gateway.tsx` was the only data source: it selected from a frozen database and its
 * header promised "no network call, no cache, no revalidation and no persistence here, and there
 * must never be". That wall is what is coming down, one screen at a time — but the `?state=`
 * switch on top of it is not, and it would have been easy to throw away by accident.
 *
 * That switch is load-bearing for review and for tests: **122 `?state=` URLs across the e2e
 * suite** address surfaces that are otherwise unreachable. A loading skeleton, an offline panel
 * and a first-run empty state cannot be produced on demand from a healthy server, so without the
 * override they stop being testable the moment the data becomes real.
 *
 * So this keeps the contract and swaps the source:
 *
 * | `?state=` | before | now |
 * | --- | --- | --- |
 * | absent / `success` | the fixture database | **the real API response** |
 * | `empty` | an empty fixture database | the real response, emptied by `makeEmpty` |
 * | `loading` / `error` / `offline` | a synthetic state | unchanged — still synthetic |
 *
 * ## Why `empty` needs a function rather than a second database
 * `EMPTY_FIXTURE_DB` was a hand-written sibling of the real one. With live data there is nothing
 * to hand-write, so the caller supplies the transform instead — and the transform encodes
 * something specific per screen. On the profile that is §11 E-08: an empty profile is *the
 * groups, with no fields*, not zero groups, because a screen showing nothing would be wrong
 * about the data and would offer the owner no way to start.
 *
 * Returns the same `FixtureResult<T>` shape as before, so `resolveDataScreenState`,
 * `ScreenStateRoot` and every error panel keep working untouched.
 */

import { useSearchParams } from "next/navigation";

import type { FixtureError, FixtureResult, ScreenState } from "@/types/domain";
import { parseScreenState, STATE_PARAM } from "@/lib/screen-state";

/**
 * The copy for the two synthetic error states.
 *
 * ⚠ These are for the **review override only** — `?state=error` and `?state=offline`. A real
 * failure carries a real `ApiError`, which `toScreenError` turns into copy specific to what went
 * wrong; that path never reaches these two. Keeping them means the override still renders an
 * honest-looking panel, written to the §6.10 rules like the rest.
 */
const OVERRIDE_ERRORS: Readonly<Record<"error" | "offline", FixtureError>> = {
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

/** The error a given override state surfaces, or `null` when the state carries data. */
export function overrideErrorFor(state: ScreenState): FixtureError | null {
  if (state === "error") return OVERRIDE_ERRORS.error;
  if (state === "offline") return OVERRIDE_ERRORS.offline;
  return null;
}

/**
 * Apply the `?state=` override to data fetched server-side.
 *
 * `real` has already been fetched by the time this runs — the override cannot un-fetch it, and
 * is not trying to. `?state=loading` shows what the loading surface looks like; it does not
 * simulate a slow request.
 *
 * An unrecognised value falls back to `success` rather than throwing (§11 E-34), so
 * `?state=banana` renders the page instead of a blank screen.
 */
export function useScreenData<T>(real: T, makeEmpty: (real: T) => T): FixtureResult<T> {
  const searchParams = useSearchParams();
  const state = parseScreenState(searchParams.get(STATE_PARAM));

  if (state === "success") return { state, data: real, error: null };
  if (state === "empty") return { state, data: makeEmpty(real), error: null };
  return { state, data: null, error: overrideErrorFor(state) };
}

/**
 * The same override, for a screen whose data arrived with a real failure attached.
 *
 * A server fetch that threw hands its `FixtureError` in as `failure`; the override still wins
 * when one is present, because a reviewer asking for `?state=loading` wants the loading surface
 * even on a screen that is currently broken.
 */
export function useScreenDataOrFailure<T>(
  real: T | null,
  failure: FixtureError | null,
  /**
   * May return `null`. On a detail route `?state=empty` means "no such record" rather than "an
   * emptied record", and the screen's own not-found panel is what should render — so the
   * transform is allowed to erase the data rather than being forced to fake a hollow version.
   */
  makeEmpty: (real: T) => T | null,
): FixtureResult<T> {
  const searchParams = useSearchParams();
  const state = parseScreenState(searchParams.get(STATE_PARAM));

  if (state !== "success") {
    if (state === "empty" && real !== null) {
      return { state, data: makeEmpty(real), error: null };
    }
    if (state === "empty") return { state, data: null, error: null };
    return { state, data: null, error: overrideErrorFor(state) };
  }

  // No override: report what actually happened.
  if (failure !== null) return { state: "error", data: null, error: failure };
  if (real === null) {
    return { state: "error", data: null, error: OVERRIDE_ERRORS.error };
  }
  return { state: "success", data: real, error: null };
}
