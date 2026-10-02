import type { ReactNode } from "react";

import {
  Activity,
  AtSign,
  Briefcase,
  Building2,
  Calendar,
  Coins,
  FileText,
  Hash,
  Landmark,
  Link as LinkGlyph,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Printer,
  Smartphone,
  Tag,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  formatAddressLines,
  formatAddressOneLine,
  formatEmailDisplay,
  formatLongDate,
  formatPhoneDisplay,
  formatUrlDisplay,
  mailtoHref,
  mapsHref,
  maskTail,
  parseSocialLink,
  telHref,
} from "@/lib/format";
import type { FieldType, ResolvedField } from "@/types/domain";

/**
 * The field renderer registry — spec §6.6, one entry per `FieldType`.
 *
 * **The registry is a total `Record<FieldType, FieldRenderer>` and there is no default
 * fallback anywhere in this module.** That is the whole point: a fallback would turn
 * "nobody handled this type" into "renders as plain text", which is exactly the failure
 * AC-21 exists to make impossible. Omit a member and `tsc --noEmit` stops the build with
 * TS2741 before a single pixel is drawn.
 *
 * A renderer answers one question — *what does this stored value look like to a human, and
 * where does tapping it go* — and answers it as **data**, not as markup. The row components
 * belong to their own tracks (`card-field-row.tsx`, `field-list.tsx`, the public card view);
 * this module decides content, they decide layout. The one piece of markup here is the icon
 * element, which is why the file is `.tsx`.
 *
 * Every display transform is imported from `@/lib/format`. Nothing is re-derived here: those
 * rules also feed the `.vcf`, so a second implementation would let the downloaded file and
 * the rendered card disagree — the exact class of bug this rebuild exists to close.
 *
 * ⚠ **Deliberately not `"use client"`.** Lucide's `Icon` already carries the directive, so
 * an icon element created here is a client reference Next serialises on its own, while
 * `renderFieldRow` stays a plain function a server component can call. Adding the directive
 * would turn these helpers into un-callable client proxies on the server.
 *
 * Security (§7.3, AC-32, AC-33) is enforced here rather than left to each screen:
 * masking, coordinate suppression, and href scheme validation are properties of the row, so
 * no consumer can forget one.
 */

/* ── The row contract (§6.6: `{ icon, label, display, href | null }`) ───────────────── */

/** §8.8: exactly three icon sizes exist in this product. The union is the enforcement. */
export type FieldIconSize = 16 | 20 | 24;

export const FIELD_ICON_SIZES = [16, 20, 24] as const satisfies readonly FieldIconSize[];

const DEFAULT_ICON_SIZE: FieldIconSize = 16;

/** §8.8: line icons, 1.5px stroke, `currentColor`, so a row inherits its ground's ink. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * §11 E-15: a single unbroken 60-character token must never scroll the page sideways.
 * Published as a constant so every consumer of `display` wraps it the same way and the
 * rule has one place to fail rather than four.
 */
export const FIELD_VALUE_CLASS = "[overflow-wrap:anywhere]";

/**
 * `status` is the §6.6 `LOCATION_TRACKING` chip; `address` is the only multi-line row.
 * A consumer that understands none of them can still render `display` and be correct.
 */
export type FieldRowVariant = "text" | "link" | "address" | "status";

export interface FieldRow {
  /** Decorative, `aria-hidden`, sized 16/20/24 (§8.8). Meaning never rests on it alone. */
  icon: ReactNode;
  /** The owner's own label for the field — never invented here. */
  label: string;
  /** The §6.6 display string. Masked for financial and sensitive fields (AC-33). */
  display: string;
  /** 1–2 lines for `ADDRESS`; `[display]` for every other type. */
  lines: readonly string[];
  /**
   * The untruncated text for a `title` attribute, so a CSS clamp never loses content
   * (E-11, E-12, E-15). **Equal to `display` whenever `masked` is true** — a `title` is
   * readable on hover and on copy, so a masked row that carried the raw value would be
   * masked in appearance only.
   */
  title: string;
  /**
   * Non-secret provenance the display line deliberately omits: the bank, the wallet
   * provider, the crypto network, the social platform (or the bare hostname, E-23).
   */
  context: string | null;
  /** `null` whenever the destination would be unsafe, unknown, or a masked value. */
  href: string | null;
  /** `href` leaves the app: the consumer must add `rel="noopener noreferrer"` (AC-32). */
  external: boolean;
  /** §7.3: masked on every public surface, and there is no reveal control on `/c/[slug]`. */
  masked: boolean;
  variant: FieldRowVariant;
}

export interface FieldRenderOptions {
  iconSize?: FieldIconSize;
}

/** `null` means "this type contributes no row" — today only `PHOTO`, plus blank values. */
export type FieldRenderer = (
  field: ResolvedField,
  options?: FieldRenderOptions,
) => FieldRow | null;

/* ── Masking (§6.6 security rule, §7.3, AC-33) ──────────────────────────────────────── */

/**
 * Masked whatever the owner marked them, because the owner is not the threat model here:
 * `/c/[slug]` is unauthenticated by design, so an account number is public the moment it
 * renders. `isSensitive` adds to this set; it can never subtract from it.
 */
export const ALWAYS_MASKED_TYPES = [
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
] as const satisfies readonly FieldType[];

const ALWAYS_MASKED: ReadonlySet<FieldType> = new Set(ALWAYS_MASKED_TYPES);

export function isMaskedField(field: Pick<ResolvedField, "type" | "isSensitive">): boolean {
  return ALWAYS_MASKED.has(field.type) || field.isSensitive;
}

/* ── which fields the builder may edit in place ──────────────────────────────────────── */

/**
 * Types whose `value` is **not** the whole truth, so a single-line editor would lose something.
 *
 * · `ADDRESS` carries a seven-component `AddressDetail`. Editing it as one string would either
 *   discard the components or force this file to invent a parser for postal addresses, and a
 *   lossy round-trip through an input is worse than not offering the input.
 * · `PHOTO` is not text at all — §6.6 feeds it to the avatar slot and it renders no row.
 * · `LOCATION_TRACKING` collapses to a status by §7.3 and must never put a coordinate on a
 *   surface. An input holds the raw value by definition, so offering one would put the
 *   coordinate straight back into the DOM that rule exists to keep it out of.
 *
 * The other three structured types — bank, digital wallet, crypto — are excluded by
 * {@link isMaskedField} below rather than by being listed here, because masking is the stronger
 * reason and it should be the one that shows up in a stack trace.
 */
const UNEDITABLE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "ADDRESS",
  "PHOTO",
  "LOCATION_TRACKING",
]);

/**
 * May the builder let the owner change this field's value **in place**, in the Fields panel?
 *
 * ⚠ **A masked field is never editable here, and that is a §7.3 rule rather than a UX
 * preference.** "A masked value must not reach the DOM — not as text, not in an attribute" is
 * absolute on every surface that is not `/profile`, and an `<input value={…}>` is exactly the
 * attribute the rule names. So the three financial types, plus anything the owner marked
 * sensitive, keep their marker and link out. Reveal lives in one place and this is not it.
 *
 * Everything else — a phone, an email, a URL, a job title — is a plain string whose whole
 * meaning is the string, and those the owner edits without leaving the card they are building.
 */
export function isInlineEditable(
  field: Pick<ResolvedField, "type" | "isSensitive">,
): boolean {
  return !isMaskedField(field) && !UNEDITABLE_TYPES.has(field.type);
}

/* ── §7.3: `LOCATION_TRACKING` never renders a coordinate, on any surface ───────────── */

/** Two numbers separated by `,` `;` or `/` — the shape every coordinate pair takes. */
const COORDINATE_PATTERN = /-?\d{1,3}(?:\.\d+)?\s*[,;/]\s*-?\d{1,3}(?:\.\d+)?/;

/** What a coordinate-shaped value collapses to. A status, exactly as §6.6 requires. */
export const LOCATION_STATUS_FALLBACK = "Location sharing on";

/* ── Link safety (§7.4, AC-32) ──────────────────────────────────────────────────────── */

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * A stored value becomes an `href` only if it is genuinely an http(s) address.
 *
 * Two failures this closes. A protocol-less `fernwood.example` used verbatim resolves as a
 * *same-origin path* and silently navigates into the app. A `javascript:` value is an XSS
 * vector React does not block. Both arrive as ordinary field values, so neither is
 * hypothetical; an unusable value renders as text with no link rather than as a hazard.
 */
function safeHttpHref(raw: string): string | null {
  const trimmed = raw.trim();
  const candidate = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return SAFE_SCHEMES.has(new URL(candidate).protocol) ? candidate : null;
  } catch {
    return null;
  }
}

/* ── The renderer factory ───────────────────────────────────────────────────────────── */

/** What an individual renderer decides. Everything else is applied uniformly below. */
interface FieldBody {
  display: string;
  lines?: readonly string[];
  title?: string;
  context?: string | null;
  href?: string | null;
  external?: boolean;
  variant?: FieldRowVariant;
}

/**
 * Wraps a per-type rule with the three things that must hold for all of them: a blank value
 * is not a row (E-07), an icon is always present (E-23), and a masked field surrenders its
 * display, its title and its link together (AC-33).
 *
 * Masking last is load-bearing. Each renderer produces its *safe* display first — a scrubbed
 * location status, a composed address — and the mask is applied to that, never to the raw
 * value, so masking a coordinate cannot leak half of one.
 */
function renderer(Icon: LucideIcon, build: (field: ResolvedField) => FieldBody): FieldRenderer {
  return (field, options) => {
    if (field.value.trim().length === 0) return null;

    const body = build(field);
    const icon = (
      <Icon
        aria-hidden="true"
        size={options?.iconSize ?? DEFAULT_ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    );

    if (isMaskedField(field)) {
      const display = maskTail(body.display);
      return {
        icon,
        label: field.label,
        display,
        lines: [display],
        title: display,
        context: body.context ?? null,
        href: null,
        external: false,
        masked: true,
        variant: body.variant === "status" ? "status" : "text",
      };
    }

    const href = body.href ?? null;
    return {
      icon,
      label: field.label,
      display: body.display,
      lines: body.lines ?? [body.display],
      title: body.title ?? body.display,
      context: body.context ?? null,
      href,
      external: href !== null && (body.external ?? false),
      masked: false,
      variant: body.variant ?? (href === null ? "text" : "link"),
    };
  };
}

/** §6.6's "verbatim, clamped" row. The clamp is CSS — the string is never truncated here. */
function verbatim(Icon: LucideIcon): FieldRenderer {
  return renderer(Icon, (field) => ({ display: field.value, href: null }));
}

/** §6.6's `tel:` row, shared by the three voice/fax types. */
function dialled(Icon: LucideIcon): FieldRenderer {
  return renderer(Icon, (field) => ({
    display: formatPhoneDisplay(field.value),
    href: telHref(field.value),
    external: false,
  }));
}

/* ── The registry ───────────────────────────────────────────────────────────────────── */

/**
 * All 22 members of `FieldType`, in §5.1 declaration order (AC-21).
 *
 * The annotation is the contract. Do not replace it with `satisfies`, do not add an index
 * signature, and never introduce a `?? FALLBACK` at the lookup: each of those quietly
 * restores the runtime blank this type exists to prevent.
 */
export const FIELD_RENDERERS: Record<FieldType, FieldRenderer> = {
  PHONE: dialled(Smartphone),
  LANDLINE: dialled(Phone),
  FAX: dialled(Printer),

  EMAIL: renderer(Mail, (field) => ({
    display: formatEmailDisplay(field.value),
    href: mailtoHref(field.value),
    external: false,
  })),

  ADDRESS: renderer(MapPin, (field) => {
    const detail = field.detail?.kind === "ADDRESS" ? field.detail : null;
    // A malformed ADDRESS still renders — degraded to its raw line, with no map link,
    // rather than throwing a card away over one field (§9.4's posture, applied locally).
    if (detail === null) {
      return { display: field.value, lines: [field.value], href: null, variant: "address" };
    }
    return {
      display: formatAddressOneLine(detail),
      lines: formatAddressLines(detail),
      href: mapsHref(detail),
      external: true,
      variant: "address",
    };
  }),

  URL: renderer(LinkGlyph, (field) => ({
    display: formatUrlDisplay(field.value),
    title: field.value.trim(),
    href: safeHttpHref(field.value),
    external: true,
  })),

  SOCIAL_LINK: renderer(AtSign, (field) => {
    const { platform, handle } = parseSocialLink(field.value);
    // E-23: an unrecognised hostname keeps its icon and surfaces the host as `context`,
    // so the row is never an empty slot and never a crash.
    return {
      display: handle ?? platform,
      context: platform,
      title: field.value.trim(),
      href: safeHttpHref(field.value),
      external: true,
    };
  }),

  // §6.6: consumed by the avatar slot. Emitting a row here would give the card two avatars.
  PHOTO: () => null,

  // The card's own logo slot consumes the profile-level mark; emitting a row would show the
  // mark twice (once in the badge, once as a URL row). Never a text row.
  COMPANY_LOGO: () => null,

  TEXT: verbatim(FileText),

  DATE: renderer(Calendar, (field) => ({
    display: formatLongDate(field.value),
    href: null,
  })),

  JOB_TITLE: verbatim(Briefcase),
  COMPANY: verbatim(Building2),
  REG_NUMBER: verbatim(Hash),
  DEPARTMENT: verbatim(Users),
  RELATION: verbatim(User),
  STATUS: verbatim(Activity),

  LOCATION_TRACKING: renderer(Navigation, (field) => {
    // §7.3: a status chip, never a coordinate — including when the stored value *is* one.
    const status = COORDINATE_PATTERN.test(field.value) ? LOCATION_STATUS_FALLBACK : field.value;
    return { display: status, href: null, variant: "status" };
  }),

  BANK_ACCOUNT: renderer(Landmark, (field) => {
    const detail = field.detail?.kind === "BANK_ACCOUNT" ? field.detail : null;
    return {
      display: detail?.accountNumber ?? field.value,
      context: detail?.bankName ?? null,
      href: null,
    };
  }),

  DIGITAL_WALLET: renderer(Wallet, (field) => {
    const detail = field.detail?.kind === "DIGITAL_WALLET" ? field.detail : null;
    return {
      display: detail?.handle ?? field.value,
      context: detail?.provider ?? null,
      href: null,
    };
  }),

  CRYPTO_WALLET: renderer(Coins, (field) => {
    const detail = field.detail?.kind === "CRYPTO_WALLET" ? field.detail : null;
    return {
      display: detail?.address ?? field.value,
      context: detail?.network ?? null,
      href: null,
    };
  }),

  CUSTOM: verbatim(Tag),
};

/* ── Dispatch ───────────────────────────────────────────────────────────────────────── */

/**
 * The only lookup in the codebase. It is total by construction — `field.type` is a
 * `FieldType` and every `FieldType` has an entry — so it needs no guard and must not grow
 * one.
 */
export function renderFieldRow(
  field: ResolvedField,
  options?: FieldRenderOptions,
): FieldRow | null {
  return FIELD_RENDERERS[field.type](field, options);
}

/**
 * Input order preserved — `resolveCard` already applied the §6.4 ordering rule, and a
 * second sort here would let the card and the `.vcf` diverge. Only rows that must not
 * render are dropped: `PHOTO` (the avatar owns it) and blank values (E-07).
 */
export function renderFieldRows(
  fields: readonly ResolvedField[],
  options?: FieldRenderOptions,
): FieldRow[] {
  const rows: FieldRow[] = [];
  for (const field of fields) {
    const row = renderFieldRow(field, options);
    if (row !== null) rows.push(row);
  }
  return rows;
}
