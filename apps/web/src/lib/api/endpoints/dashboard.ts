/**
 * `dashboard` — one endpoint, and the reason it exists is worth more than the saved requests.
 *
 * `GET /dashboard` replaces the screen's old client-side assembly: `GET /cards` +
 * `GET /contacts` + `GET /share-links` + one `GET /cards/{id}/audience` **per card**. That was
 * an N+1 on every load, but the defect that actually shipped was arithmetic — `peopleReached`
 * and `behind` were reduced from two different collections, so a contact behind on two cards
 * was counted once in one and twice in the other, and `behind` could exceed `peopleReached`.
 * One server-side pass over one query cannot disagree with itself.
 *
 * See `DashboardResponseDto` for what each number means, and in particular why `behind: null`
 * is not `behind: 0`.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type { DashboardResponseDto } from "@/lib/api/schema";

/** No parameters, no options. Everything is scoped to the caller's own non-archived cards. */
export function getDashboard(): Promise<DashboardResponseDto> {
  return authed({ method: "GET", path: "/dashboard" });
}
