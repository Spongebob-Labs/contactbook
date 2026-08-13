/**
 * `GET /v1/dashboard/stats` — the per-user aggregates the dashboard metrics render.
 *
 * Added by `apps/api/src/dashboard` and confirmed live on production
 * 2026-08-13: the route answers 401 unauthenticated, while a sibling path that
 * does not exist (`/v1/dashboard/nope`) answers 404 — so routing, not the guard,
 * is what distinguishes them.
 *
 * Every field is coerced rather than trusted. The endpoint is days old, its
 * numbers go straight into headline tiles, and one missing key would otherwise
 * render `NaN` or throw inside `.map()`. A zero is a much better failure than a
 * blank dashboard.
 */
import { apiFetch } from "@/lib/api";
import type {
  DashboardStats,
  DashboardTopCard,
  DashboardTopContact,
  ShareDeliveryBreakdown,
} from "@/lib/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Non-negative integer, or 0. Guards against null, strings, and NaN alike. */
function count(value: unknown): number {
  const next = typeof value === "string" ? Number(value) : value;
  if (typeof next !== "number" || !Number.isFinite(next) || next < 0) {
    return 0;
  }
  return Math.round(next);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  const next = text(value);
  return next || null;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function normalizeBreakdown(value: unknown): ShareDeliveryBreakdown {
  const raw = record(value);
  return {
    pending: count(raw.pending),
    dispatched: count(raw.dispatched),
    delivered: count(raw.delivered),
    read: count(raw.read),
    failed: count(raw.failed),
  };
}

function normalizeTopContact(raw: Record<string, unknown>): DashboardTopContact {
  const countryCode = text(raw.countryCode);
  const phone = text(raw.phone);
  return {
    contactId: nullableText(raw.contactId),
    // The API already falls back to the number when no contact is linked; this
    // covers the case where it sends neither.
    displayName: text(raw.displayName) || [countryCode, phone].filter(Boolean).join(" ") || "Unknown",
    countryCode,
    phone,
    timesSharedWith: count(raw.timesSharedWith),
    lastSharedAt: text(raw.lastSharedAt),
  };
}

function normalizeTopCard(raw: Record<string, unknown>): DashboardTopCard {
  return {
    cardId: nullableText(raw.cardId),
    cardName: text(raw.cardName) || "Untitled card",
    cardType: text(raw.cardType),
    timesShared: count(raw.timesShared),
    recipientCount: count(raw.recipientCount),
  };
}

export function normalizeDashboardStats(value: unknown): DashboardStats {
  const raw = record(value);
  return {
    totalCards: count(raw.totalCards),
    totalContacts: count(raw.totalContacts),
    totalShareBatches: count(raw.totalShareBatches),
    totalRecipientsReached: count(raw.totalRecipientsReached),
    deliveryBreakdown: normalizeBreakdown(raw.deliveryBreakdown),
    topContacts: list(raw.topContacts).map(normalizeTopContact),
    topCards: list(raw.topCards).map(normalizeTopCard),
    sharesLast7Days: count(raw.sharesLast7Days),
    sharesLast30Days: count(raw.sharesLast30Days),
    contactsAddedLast30Days: count(raw.contactsAddedLast30Days),
    newCardsLast30Days: count(raw.newCardsLast30Days),
  };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const raw = await apiFetch<unknown>("/v1/dashboard/stats");
  return normalizeDashboardStats(raw);
}
