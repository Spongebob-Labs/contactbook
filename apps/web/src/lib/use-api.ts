"use client";

/**
 * Fetch from the browser, in the state shape every screen already renders.
 *
 * ## Why screens fetch client-side now
 * They used to fetch in a Server Component and receive the result as props. That worked, and the
 * API was called correctly — but the calls happened in Node, so **the browser's Network tab never
 * showed one.** Being able to inspect the real request and response from the browser is a
 * requirement, not a convenience: it is how the integration gets reviewed and signed off.
 *
 * So the read moves to the client, through `/api/cb/*`, which passes the API's status and body
 * through verbatim. Every call is now a row in the Network tab whose response is exactly what
 * Swagger returns.
 *
 * ## What is kept, deliberately
 * The return type is the same `FixtureResult<T>` the fixture gateway produced and the server-prop
 * version produced — `{ state, data, error }`. That is why converting a screen touches its data
 * source and nothing else: `resolveDataScreenState`, `ScreenStateRoot`, every skeleton and every
 * error panel keep working untouched.
 *
 * The `?state=` override is kept too, for the same reason it always was: a loading skeleton, an
 * offline panel and a first-run empty state cannot be produced on demand from a healthy server,
 * and 122 e2e URLs address them. `success` means the real response; the other four are synthetic.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { toScreenError } from "@/lib/api/errors";
import { parseScreenState, STATE_PARAM } from "@/lib/screen-state";
import { overrideErrorFor } from "@/lib/screen-data";
import type { FixtureError, FixtureResult } from "@/types/domain";

export interface ApiResource<T> extends FixtureResult<T> {
  /** Re-run the read. What a retry button and a post-mutation refresh both call. */
  reload: () => void;
  /** True while a reload is in flight over data that is already on screen. */
  refreshing: boolean;
}

/**
 * Run `load` on mount and expose it as a screen state.
 *
 * @param load the read. **Must be stable** — wrap it in `useCallback`, or pass a module-level
 * function. An inline arrow re-creates on every render and would refetch forever.
 * @param makeEmpty how `?state=empty` derives an empty version of the real data. May return
 * `null` on a detail route, where "empty" means "no such record" rather than "an emptied record".
 */
export function useApiResource<T>(
  load: () => Promise<T>,
  makeEmpty?: (real: T) => T | null,
): ApiResource<T> {
  const searchParams = useSearchParams();
  const override = parseScreenState(searchParams.get(STATE_PARAM));

  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<FixtureError | null>(null);
  const [settled, setSettled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Guards against a resolved promise from a previous `load` overwriting a newer one, and
  // against setting state after unmount.
  const runId = useRef(0);

  /**
   * The read. Deliberately writes no state **synchronously** — every `setState` below happens
   * after an `await`.
   *
   * That is not stylistic: `react-hooks/set-state-in-effect` flags a synchronous state write
   * reached from an effect, and it cannot see past a function boundary. `setRefreshing(true)`
   * therefore lives in `reload`, which is an event handler, rather than in here.
   */
  const run = useCallback(
    async () => {
      const ticket = ++runId.current;

      try {
        const result = await load();
        if (runId.current !== ticket) return;
        setData(result);
        setFailure(null);
      } catch (thrown) {
        if (runId.current !== ticket) return;
        setData(null);
        setFailure(toScreenError(thrown));
      } finally {
        if (runId.current === ticket) {
          setSettled(true);
          setRefreshing(false);
        }
      }
    },
    [load],
  );

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
       `run()` writes no state synchronously — every `setState` inside it happens after `await
       load()`, i.e. in a later microtask, so the cascading-render the rule guards against cannot
       occur. The rule flags this because it cannot follow the call into an async function; it sees
       a function that eventually calls `setState` and stops there.

       The alternatives are worse. Inlining the body here does not satisfy it either (same
       reasoning), and the genuinely rule-clean approach — React 19's `use()` with a promise
       created outside render — needs a promise cache keyed per screen to avoid refetching on
       every render, which is more machinery than a mount-time fetch warrants.

       Fetch-on-mount is what this hook is for, and this is the shape of it. */
    void run();
    return () => {
      // Invalidate anything in flight, so a late response cannot write to an unmounted screen.
      runId.current += 1;
    };
  }, [run]);

  const reload = useCallback(() => {
    // Safe here, and not in the effect: this is an event handler, not a render-time path.
    setRefreshing(true);
    void run();
  }, [run]);

  // ── The `?state=` override ─────────────────────────────────────────────────────────
  if (override !== "success") {
    if (override === "empty") {
      const empty = data === null || makeEmpty === undefined ? null : makeEmpty(data);
      return { state: "empty", data: empty, error: null, reload, refreshing };
    }
    return { state: override, data: null, error: overrideErrorFor(override), reload, refreshing };
  }

  // ── The real thing ────────────────────────────────────────────────────────────────
  if (!settled) return { state: "loading", data: null, error: null, reload, refreshing };
  if (failure !== null) return { state: "error", data: null, error: failure, reload, refreshing };
  return { state: "success", data, error: null, reload, refreshing };
}
