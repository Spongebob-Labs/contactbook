/**
 * The route manifest — a verbatim transcription of spec §6.1, one entry per row.
 *
 * T30 (`tests/contract/routes.test.ts`) and T31 (`tests/e2e/routes.spec.ts`) read this and
 * nothing else. If a row here disagrees with the spec table, the row is wrong.
 *
 * Deliberately free of product imports: this module must be readable before any of
 * `src/**` exists.
 */

/** `?state=` values accepted by `useFixture` (spec §6.3). Anything else falls back to `success`. */
export const STATE_QUERIES = ["success", "loading", "empty", "error", "offline"] as const;
export type StateQuery = (typeof STATE_QUERIES)[number];

/**
 * Values of the `data-screen-state` attribute (spec §13.2). Note this is the §6.3 set plus
 * `empty-filtered`, which is reached by an actual filter/search query rather than `?state=`.
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

/** "all 4" in the §6.1 States column expands to every reachable `?state=` value. */
export const ALL_STATES: readonly StateQuery[] = STATE_QUERIES;

export type RouteGroup = "(marketing)" | "(auth)" | "(app)" | "root";
export type RouteRender = "static" | "dynamic";

export interface RouteRow {
  /** The spec's own row id, e.g. `R-12`. */
  id: string;
  /** URL pattern, Next segment syntax. */
  path: string;
  group: RouteGroup;
  /** Dynamic segment names, in order. Empty for static routes. */
  params: readonly string[];
  render: RouteRender;
  /** §6.1 `loading.tsx` column. */
  hasLoading: boolean;
  /** §6.1 `error.tsx` column. */
  hasError: boolean;
  /** Whether the row's States cell carries the "+ not-found" suffix. */
  hasNotFound: boolean;
  /** Reachable `?state=` values for this route. */
  states: readonly StateQuery[];
  /** The §6.1 States cell, verbatim, so a test can cite the spec rather than paraphrase it. */
  statesLabel: string;
  /** Directory under `apps/web/src/app/` that holds this route's files. `""` = app root. */
  dir: string;
}

export const ROUTE_MANIFEST: readonly RouteRow[] = [
  {
    id: "R-01",
    path: "/",
    group: "(marketing)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success"],
    statesLabel: "success only",
    dir: "(marketing)",
  },
  {
    id: "R-02",
    path: "/templates",
    group: "(marketing)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(marketing)/templates",
  },
  {
    id: "R-03",
    path: "/signin/phone",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success", "error"],
    statesLabel: "success, error",
    dir: "(auth)/signin/phone",
  },
  {
    id: "R-04",
    path: "/signin/otp",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success", "error", "loading"],
    statesLabel: "success, error, loading",
    dir: "(auth)/signin/otp",
  },
  {
    id: "R-05",
    path: "/signup/first-name",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success", "error"],
    statesLabel: "success, error",
    dir: "(auth)/signup/first-name",
  },
  {
    id: "R-06",
    path: "/signup/last-name",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success", "error"],
    statesLabel: "success, error",
    dir: "(auth)/signup/last-name",
  },
  {
    id: "R-07",
    path: "/signup/email",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success", "error"],
    statesLabel: "success, error",
    dir: "(auth)/signup/email",
  },
  {
    id: "R-08",
    path: "/signup/done",
    group: "(auth)",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: true,
    hasNotFound: false,
    states: ["success"],
    statesLabel: "success",
    dir: "(auth)/signup/done",
  },
  {
    id: "R-09",
    path: "/dashboard",
    group: "(app)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(app)/dashboard",
  },
  {
    id: "R-10",
    path: "/cards",
    group: "(app)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(app)/cards",
  },
  {
    id: "R-11",
    path: "/cards/new",
    group: "(app)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(app)/cards/new",
  },
  {
    id: "R-12",
    path: "/cards/[cardId]",
    group: "(app)",
    params: ["cardId"],
    render: "dynamic",
    hasLoading: true,
    hasError: true,
    hasNotFound: true,
    states: ALL_STATES,
    statesLabel: "all 4 + not-found",
    dir: "(app)/cards/[cardId]",
  },
  {
    id: "R-13",
    path: "/cards/[cardId]/edit",
    group: "(app)",
    params: ["cardId"],
    render: "dynamic",
    hasLoading: true,
    hasError: true,
    hasNotFound: true,
    states: ALL_STATES,
    statesLabel: "all 4 + not-found",
    dir: "(app)/cards/[cardId]/edit",
  },
  {
    id: "R-14",
    path: "/contacts",
    group: "(app)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(app)/contacts",
  },
  {
    id: "R-15",
    path: "/contacts/[contactId]",
    group: "(app)",
    params: ["contactId"],
    render: "dynamic",
    hasLoading: true,
    hasError: true,
    hasNotFound: true,
    states: ALL_STATES,
    statesLabel: "all 4 + not-found",
    dir: "(app)/contacts/[contactId]",
  },
  {
    id: "R-16",
    path: "/profile",
    group: "(app)",
    params: [],
    render: "static",
    hasLoading: true,
    hasError: true,
    hasNotFound: false,
    states: ALL_STATES,
    statesLabel: "all 4",
    dir: "(app)/profile",
  },
  {
    id: "R-17",
    path: "/profile/groups/[groupId]",
    group: "(app)",
    params: ["groupId"],
    render: "dynamic",
    hasLoading: true,
    hasError: true,
    hasNotFound: true,
    states: ALL_STATES,
    statesLabel: "all 4 + not-found",
    dir: "(app)/profile/groups/[groupId]",
  },
  {
    id: "R-18",
    path: "/c/[slug]",
    group: "root",
    params: ["slug"],
    render: "dynamic",
    hasLoading: true,
    hasError: true,
    hasNotFound: true,
    states: ALL_STATES,
    statesLabel: "all 4 + not-found",
    dir: "c/[slug]",
  },
  {
    // The root `not-found.tsx` convention, not an addressable directory. Rendered for any
    // unmatched URL; `dir: ""` means the file is `src/app/not-found.tsx`.
    id: "R-19",
    path: "/not-found",
    group: "root",
    params: [],
    render: "static",
    hasLoading: false,
    hasError: false,
    hasNotFound: false,
    states: [],
    statesLabel: "—",
    dir: "",
  },
];

/**
 * ⚠ SPEC ⟷ PLAN CROSS-REFERENCE, read before writing `routes.test.ts` (T30).
 *
 * §6.1 marks `error.tsx` ✓ for every row below, but the plan's `owns_files` assign no
 * route-level `error.tsx` to them — the boundary is provided one level up by the route
 * group's own `error.tsx` (T09 `(app)/error.tsx`, T14 `(marketing)/error.tsx`,
 * T16 `(auth)/error.tsx`), which is what Next.js actually uses to catch those routes.
 *
 * A file-existence assertion keyed on `hasError` will therefore fail on these rows unless it
 * accepts an inherited group boundary. That is a plan/spec reconciliation, not a bug in the
 * screen — escalate rather than adding files nobody owns.
 */
export const ROUTES_WITH_INHERITED_ERROR_BOUNDARY: readonly string[] = [
  "R-03",
  "R-04",
  "R-05",
  "R-06",
  "R-07",
  "R-08",
  "R-11",
  "R-13",
];

/** Same shape of gap for `not-found.tsx`: §6.1 wants one on R-13, no track owns it. */
export const ROUTES_WITH_INHERITED_NOT_FOUND: readonly string[] = ["R-13"];

export function routeById(id: string): RouteRow {
  const row = ROUTE_MANIFEST.find((r) => r.id === id);
  if (row === undefined) throw new Error(`routeById: no route "${id}" in the manifest`);
  return row;
}

export function routesInGroup(group: RouteGroup): readonly RouteRow[] {
  return ROUTE_MANIFEST.filter((r) => r.group === group);
}

/** Rows that carry `loading.tsx` + `error.tsx` and the four state families — the data screens. */
export function dataRoutes(): readonly RouteRow[] {
  return ROUTE_MANIFEST.filter((r) => r.states.length === STATE_QUERIES.length);
}

/** `/cards/[cardId]` + `{ cardId: 'card_x' }` → `/cards/card_x`. Throws on a missing param. */
export function fillParams(path: string, values: Record<string, string>): string {
  return path.replace(/\[(\.{3})?([^\]]+)\]/g, (_match, _spread, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`fillParams: no value for "${name}" in "${path}"`);
    return value;
  });
}

/** Append the `?state=` switch (spec §6.3), preserving any query already on the path. */
export function withState(path: string, state: StateQuery): string {
  const [base, existing = ""] = path.split("?");
  const params = new URLSearchParams(existing);
  params.set("state", state);
  return `${base}?${params.toString()}`;
}
