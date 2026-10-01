"use client";

import {
  cards as cardsApi,
  contacts as contactsApi,
  dashboard as dashboardApi,
} from "@/lib/api/browser";
import { fetchProfileData } from "@/lib/api/browser-loaders";
import { toContact, toContactCard } from "@/lib/api/map";
import { readDashboardSummary, type DashboardSummary } from "@/lib/dashboard/metrics";
import type { Contact, ContactCard, FieldGroup, ProfileField, User } from "@/types/domain";

/**
 * Everything `/dashboard` reads, in one loader.
 *
 * ## Why this is not `fetchDashboardData`
 *
 * `fetchDashboardData` (GET /dashboard + GET /cards) still serves the numbers, and nothing
 * about how they are computed changed: every count on this screen is `GET /dashboard`'s, read
 * through `readDashboardSummary`. What the summary tiles add is identity and recency, which that
 * endpoint does not carry:
 *
 *   GET /dashboard          every number (totals, reach, attention, activity)     required
 *   GET /profile/me  ┐
 *   POST /auth/me    ├      the Profile tile, and what a card thumbnail resolves   required
 *   GET /profile/fields     against (a card owns no data)
 *   GET /profile/groups ┘
 *   GET /cards              thumbnails + chart colours                              optional
 *   GET /contacts           the three most recent contacts                          optional
 *
 * Seven requests where there were two. The backend ask in the report is for `GET /dashboard` to
 * carry the owner's name, photo and completeness, and the three recent cards and contacts, so
 * this can go back to one call. Until then these run concurrently.
 *
 * ## Which reads may fail
 *
 * The dashboard's numbers and the profile are required: without the profile there is no Profile
 * tile and no card can be resolved into a thumbnail. The card and contact LISTS are optional. A
 * failure there costs the thumbnails, the chart colours or the recent rows, never the counts,
 * which come from `GET /dashboard` whatever happens. `null` means "could not be read", so a
 * tile can tell that apart from an empty list.
 *
 * `GET /share-links` and `/cards/{id}/audience` are deliberately absent; the e2e suite asserts
 * neither is requested.
 */

export interface DashboardProfile {
  user: User;
  groups: readonly FieldGroup[];
  fields: readonly ProfileField[];
}

export interface DashboardHomeData {
  summary: DashboardSummary;
  profile: DashboardProfile;
  /** `null` when `GET /cards` failed. */
  cards: readonly ContactCard[] | null;
  /** `null` when `GET /contacts` failed. */
  contacts: readonly Contact[] | null;
}

export async function fetchDashboardHome(): Promise<DashboardHomeData> {
  const [dto, profile, cardDtos, contactDtos] = await Promise.all([
    dashboardApi.get(),
    fetchProfileData(),
    cardsApi.list().catch(() => null),
    contactsApi.list().catch(() => null),
  ]);

  /* Validated where the response enters the app, exactly as `fetchDashboardData` does: a count
     the deployed API did not send reads `null`, never 0. */
  const rejected: string[] = [];
  const summary = readDashboardSummary(dto, rejected);
  if (rejected.length > 0) console.warn("[contactbook] dashboard.totals.unreadable", { rejected });

  const ownerId = profile.user.id;
  return {
    summary,
    profile,
    cards: cardDtos === null ? null : cardDtos.map((card) => toContactCard(card, ownerId)),
    contacts: contactDtos === null ? null : contactDtos.map((c) => toContact(c, ownerId)),
  };
}

/**
 * The `?state=empty` world: the same owner on their first day, with no cards, no contacts and
 * nothing on their profile beyond what onboarding asks for (name, verified phone, email).
 *
 * It keeps the real identity so the Profile tile is still theirs, and zeroes everything else.
 * `behind: null` keeps its wire meaning, "no cards, so nothing to compute", not "nobody behind".
 */
export function emptyDashboardHome(real: DashboardHomeData): DashboardHomeData {
  return {
    summary: {
      totals: {
        cards: 0,
        contacts: 0,
        fields: 0,
        peopleReached: 0,
        peopleOpened: 0,
        totalOpens: 0,
        neverOpened: 0,
        behind: null,
      },
      cardReach: [],
      attention: [],
      sharingActivity: real.summary.sharingActivity.map((week) => ({ ...week, count: 0 })),
      groups: [],
    },
    profile: { user: { ...real.profile.user, avatarUrl: null }, groups: [], fields: [] },
    cards: [],
    contacts: [],
  };
}
