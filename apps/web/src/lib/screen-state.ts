/**
 * The `?state=` switch of spec §6.3 — parsing only, no React.
 *
 * ⚠ This is a **contract**, not dead code and not a dev affordance (plan §7 X-8). It ships
 * in production builds because it is how Vansh reviews the loading / empty / error /
 * offline surfaces of an application that has no network, and it is how AC-24, AC-25 and
 * most of §11 reach those surfaces at all. Deleting it fails AC-24 the same day.
 */

import type { ScreenState } from "@/types/domain";

/** The five states reachable through `?state=` (spec §6.3). Declaration order is the table's. */
export const SCREEN_STATES = ["success", "loading", "empty", "error", "offline"] as const;

/** The query parameter the switch is read from. */
export const STATE_PARAM = "state";

const KNOWN: ReadonlySet<string> = new Set<string>(SCREEN_STATES);

export function isScreenState(value: unknown): value is ScreenState {
  return typeof value === "string" && KNOWN.has(value);
}

/**
 * §11 E-34: **any** unrecognised value falls back to `success`, and this never throws.
 * `?state=` is a public URL parameter — a throw here is a live white screen for anyone who
 * mistypes it.
 *
 * Case and surrounding whitespace are tolerated: `?state=Loading` is a hand-typed review
 * URL, not an attack, and treating it as unrecognised would only be surprising.
 */
export function parseScreenState(raw: string | null | undefined): ScreenState {
  if (typeof raw !== "string") return "success";
  const normalised = raw.trim().toLowerCase();
  return isScreenState(normalised) ? normalised : "success";
}

/**
 * The values of the `data-screen-state` attribute (spec §13.2). This is the §6.3 set **plus
 * `empty-filtered`**, which is reached by an actual filter or search query rather than by
 * `?state=` — a first-run empty and a filtered-to-nothing empty are different screens with
 * different copy and different actions, and conflating them is explicitly banned (§8D.1).
 *
 * Exported here so the data-state components and the state sweeps share one list.
 */
export const DATA_SCREEN_STATES = [
  "loading",
  "empty",
  "empty-filtered",
  "error",
  "offline",
  "success",
] as const;

export type DataScreenState = (typeof DATA_SCREEN_STATES)[number];
