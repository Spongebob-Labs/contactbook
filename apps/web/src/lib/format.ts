/**
 * The display rules of spec §6.6 — the single place a stored value becomes something a
 * human reads.
 *
 * Pure functions only: no React, no DOM, no `Intl` locale sniffing beyond the fixed
 * `en-GB` formatter below. Everything here is consumed by the field renderer registry
 * (§6.6), the vCard builder (§6.7) and the public card actions (§6.9), so a change here
 * changes a downloaded `.vcf` — treat it as contract surface, not as presentation sugar.
 */

import type { AddressDetail } from "@/types/domain";

/** §6.6 URL row: "hostname + path, protocol stripped, clamped to 34 chars". */
export const URL_DISPLAY_MAX = 34;

/**
 * The masking run for the three financial types and any `isSensitive` field (§6.6, §7.3).
 * A fixed-length run, deliberately: a per-character mask leaks the length of the secret.
 */
export const MASK_RUN = "••••";

const ELLIPSIS = "…";

/** Clamp to `max` characters *including* the ellipsis, so a layout can size on `max`. */
export function clampText(value: string, max: number): string {
  if (max <= 0) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - ELLIPSIS.length)}${ELLIPSIS}`;
}

/* ── PHONE · LANDLINE · FAX ─────────────────────────────────────────────────────────── */

/**
 * Dialling plans we group for display. Ordered longest-prefix-first so `+971` is matched
 * before `+97`-shaped neighbours.
 *
 * Deliberately small: an unknown country returns the E.164 ungrouped rather than inventing
 * a grouping that would be wrong in that country.
 */
const DIALLING_PLANS: readonly {
  readonly code: string;
  /** Only numbers whose national part starts with this use the row. */
  readonly nationalPrefix?: string;
  readonly groups: readonly number[];
}[] = [
  { code: "+971", groups: [2, 3, 4] },
  // UAE fixed lines are one digit shorter than mobiles: `4` is Dubai, then 3-4.
  { code: "+971", groups: [1, 3, 4] },
  { code: "+91", groups: [5, 5] },
  { code: "+65", groups: [4, 4] },
  { code: "+61", groups: [3, 3, 3] },
  // London's `020` is written 20 xxxx xxxx; the 4-6 row below is the mobile/other shape.
  { code: "+44", nationalPrefix: "20", groups: [2, 4, 4] },
  { code: "+44", groups: [4, 6] },
  { code: "+1", groups: [3, 3, 4] },
];

/** Strip everything a human might type around the digits, keeping one leading `+`. */
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function formatPhoneDisplay(raw: string): string {
  const e164 = toE164(raw);
  // A country can have more than one shape (UK London vs. mobile, UAE fixed vs. mobile). The
  // first row whose prefix AND digit count both fit wins; a number no row fits is shown
  // ungrouped — forcing it into a plan it contradicts would be wrong, not just ugly.
  const plan = DIALLING_PLANS.find((candidate) => {
    if (!e164.startsWith(candidate.code)) return false;
    const national = e164.slice(candidate.code.length);
    const expected = candidate.groups.reduce((sum, size) => sum + size, 0);
    return national.length === expected && national.startsWith(candidate.nationalPrefix ?? "");
  });
  if (plan === undefined) return e164;

  const national = e164.slice(plan.code.length);

  let cursor = 0;
  const parts = plan.groups.map((size) => {
    const part = national.slice(cursor, cursor + size);
    cursor += size;
    return part;
  });
  return `${plan.code} ${parts.join(" ")}`;
}

export function telHref(raw: string): string {
  return `tel:${toE164(raw)}`;
}

/** §6.9: `https://wa.me/{e164 without +}`. */
export function whatsappHref(raw: string): string {
  return `https://wa.me/${toE164(raw).replace(/^\+/, "")}`;
}

/* ── EMAIL ──────────────────────────────────────────────────────────────────────────── */

export function formatEmailDisplay(raw: string): string {
  return raw.trim().toLowerCase();
}

export function mailtoHref(raw: string): string {
  return `mailto:${formatEmailDisplay(raw)}`;
}

/* ── URL ────────────────────────────────────────────────────────────────────────────── */

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

export function formatUrlDisplay(raw: string, max: number = URL_DISPLAY_MAX): string {
  // Defensive, and earned: an absent `publicUrl` from an API deployment predating the column
  // reached `raw.trim()` here as `undefined` and took the whole card list down with a TypeError.
  // A formatter is the wrong place to end a render — the caller decides what an absent URL means.
  if (raw == null) return "";
  const url = parseUrl(raw);
  if (url === null) return clampText(raw.trim(), max);

  const path = `${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "");
  return clampText(`${url.host}${path}`, max);
}

/* ── SOCIAL_LINK ────────────────────────────────────────────────────────────────────── */

/**
 * Hostname → product name. An unrecognised hostname falls back to the hostname itself:
 * §11 E-23 wants "a generic link glyph plus the hostname", never an empty icon slot.
 */
/**
 * Third-party platform hosts the product recognises by name, so a social link renders as
 * "LinkedIn" rather than as "linkedin.com".
 *
 * Exported because `tests/contract/fixture-hygiene.test.ts` derives its one exemption from it:
 * fixtures may reference these real hosts, because naming a platform is not impersonating a
 * business and the parser genuinely needs the real hostname to identify it. Deriving the
 * exemption from this table rather than restating it means the two cannot drift apart.
 */
export const SOCIAL_PLATFORMS: Readonly<Record<string, string>> = {
  "linkedin.com": "LinkedIn",
  "x.com": "X",
  "twitter.com": "X",
  "instagram.com": "Instagram",
  "github.com": "GitHub",
  "facebook.com": "Facebook",
  "youtube.com": "YouTube",
  "threads.net": "Threads",
  "tiktok.com": "TikTok",
  "dribbble.com": "Dribbble",
  "behance.net": "Behance",
  "medium.com": "Medium",
  "substack.com": "Substack",
  "t.me": "Telegram",
  "wa.me": "WhatsApp",
};

export interface SocialLinkParts {
  /** Product name when we recognise the host, else the bare hostname (E-23). */
  platform: string;
  /** `@handle` when the path carries one, else `null`. */
  handle: string | null;
}

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,30}$/;

export function parseSocialLink(raw: string): SocialLinkParts {
  const url = parseUrl(raw);
  if (url === null) return { platform: raw.trim(), handle: null };

  const host = url.hostname.replace(/^www\./, "");
  const platform = SOCIAL_PLATFORMS[host] ?? host;

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const last = segments.at(-1) ?? "";
  const candidate = last.replace(/^@/, "");
  const handle = HANDLE_PATTERN.test(candidate) ? `@${candidate}` : null;

  return { platform, handle };
}

/** The handle when we can parse one, the platform otherwise (§6.6 SOCIAL_LINK row). */
export function formatSocialDisplay(raw: string): string {
  const { platform, handle } = parseSocialLink(raw);
  return handle ?? platform;
}

/* ── ADDRESS ────────────────────────────────────────────────────────────────────────── */

/** §6.6: composed to 1–2 lines. Street on the first, locality on the second. */
export function formatAddressLines(detail: AddressDetail): string[] {
  const street = [detail.line1, detail.line2].filter(isNonEmpty).join(", ");
  const locality = [detail.city, detail.region, detail.postalCode, detail.country]
    .filter(isNonEmpty)
    .join(", ");
  return [street, locality].filter(isNonEmpty);
}

export function formatAddressOneLine(detail: AddressDetail): string {
  return formatAddressLines(detail).join(", ");
}

/** The maps deep link of the §6.6 ADDRESS row. Always rendered with `rel="noopener noreferrer"`. */
export function mapsHref(detail: AddressDetail): string {
  const query = encodeURIComponent(formatAddressOneLine(detail));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* ── DATE ───────────────────────────────────────────────────────────────────────────── */

/**
 * `timeZone: "UTC"` is load-bearing, not decoration: a date-only value parses as UTC
 * midnight, so formatting it in a timezone behind UTC would render the previous day and
 * the failure would only appear on machines west of Greenwich.
 */
const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLongDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return LONG_DATE.format(parsed);
}

/* ── Masking (§6.6 financial row, §7.3, AC-33) ──────────────────────────────────────── */

/** Last `visible` characters shown, everything before them replaced by one fixed run. */
export function maskTail(value: string, visible = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= visible) return MASK_RUN;
  return `${MASK_RUN}${trimmed.slice(-visible)}`;
}

/* ── Monogram (§5.3a, E-19) ─────────────────────────────────────────────────────────── */

export function initialsFor(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

/* ── the card's own link, as shown on the share face ────────────────────────────────────── */

/**
 * Hosts that mean "this is a development machine", and must never appear on a rendered card.
 *
 * `resolveCard` builds `qrPayload` from `NEXT_PUBLIC_SITE_URL`, falling back to
 * `http://localhost:3000` so that a QR scanned off a dev screen actually resolves. That is
 * right for the payload and wrong for the caption beneath it: a template gallery showing
 * `localhost:3000/c/prya-hq` eight times is judged as a broken design, not a dev artefact.
 */
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** The domain shown in place of a dev host. Display only — it is never fetched or encoded. */
export const CARD_LINK_DISPLAY_HOST = "contactbook.app";

/**
 * The share face's link line: the card URL with the protocol stripped, and a dev host swapped
 * for the product domain.
 *
 * **This only ever changes what is displayed.** The QR still encodes `resolved.qrPayload`
 * verbatim, so a card scanned in development still opens on the dev server — the symbol and
 * the caption are deliberately allowed to disagree in that one respect, because the alternative
 * is either a QR that does not work locally or a card that reads as broken.
 */
export const CARD_LINK_PENDING = "Activates when you save";

export function formatCardLink(
  payload: string | null | undefined,
  max: number = URL_DISPLAY_MAX,
): string {
  // No server row yet, so no token and no URL. One sentence, defined once, rather than each
  // surface inventing its own way of saying "not yet".
  // `== null`, catching undefined too: see `formatUrlDisplay` below for why that distinction
  // stopped being theoretical.
  if (payload == null) return CARD_LINK_PENDING;
  let host: string;
  let rest: string;
  try {
    const url = new URL(payload);
    host = DEV_HOSTS.has(url.hostname) ? CARD_LINK_DISPLAY_HOST : url.host;
    rest = `${url.pathname}${url.search}`;
  } catch {
    // Not a parseable URL — fall back to the generic formatter rather than throwing on a card.
    return formatUrlDisplay(payload, max);
  }
  return clampText(`${host}${rest === "/" ? "" : rest}`, max);
}
