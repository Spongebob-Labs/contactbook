import { describe, expect, it } from "vitest";

import * as cards from "@/fixtures/cards";
import * as contacts from "@/fixtures/contacts";
import * as extremes from "@/fixtures/extremes";
import * as marketing from "@/fixtures/marketing";
import * as profile from "@/fixtures/profile";
import * as user from "@/fixtures/user";
import { SOCIAL_PLATFORMS } from "@/lib/format";

/**
 * Fixture hygiene: no demo data may reference a real person, business or domain.
 *
 * Fixtures are the most-seen data in the product. They render in the template gallery, in
 * every screenshot, in the marketing hero, and in every design review — so a real company name
 * dropped into them once ends up quoted back in a dozen places and read as a real endorsement.
 * This repo had exactly that: the owner's own company and email address were the demo contact.
 *
 * ## Why this is an allowlist and not a denylist
 *
 * The obvious version of this test names the strings that must not appear. That version is
 * self-defeating: the denylist itself puts the offending brand back into the repository, in a
 * file that greps and audits will keep finding forever.
 *
 * So the rule is positive instead: every domain that appears anywhere in the fixtures must be
 * one that **cannot be registered by anybody**. RFC 2606 and RFC 6761 reserve `example.com`,
 * `example.org`, `example.net`, and the `.example`, `.test`, `.invalid` and `.localhost` TLDs
 * for exactly this purpose. That is strictly stronger than a denylist — it excludes every real
 * domain rather than the handful someone remembered — and it needs no maintenance.
 */

/* ── the reserved set (RFC 2606 §2–3, RFC 6761) ──────────────────────────────────────── */

const RESERVED_TLDS = ["example", "test", "invalid", "localhost"];
const RESERVED_SLDS = ["example.com", "example.org", "example.net"];

/**
 * The one exemption, and it is narrow.
 *
 * A social link has to name a real platform: `parseSocialLink` reads the hostname to decide
 * whether a link is LinkedIn or GitHub, so a fixture using `linkedin.example` would exercise
 * the *fallback* path and never the recognised one. Naming a platform is also not the problem
 * this suite exists to prevent — the problem is fixtures that look like a real business's own
 * identity.
 *
 * Derived from the product's own `SOCIAL_PLATFORMS` table rather than restated here, so the
 * exemption is exactly "hosts the parser recognises" and cannot quietly grow.
 */
const PLATFORM_HOSTS = new Set(Object.keys(SOCIAL_PLATFORMS));

function isPlatform(host: string): boolean {
  return PLATFORM_HOSTS.has(host.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, ""));
}

function isReserved(host: string): boolean {
  const lower = host.toLowerCase().replace(/:\d+$/, "");
  if (RESERVED_SLDS.includes(lower)) return true;
  return RESERVED_TLDS.some((tld) => lower === tld || lower.endsWith(`.${tld}`));
}

/** Reserved, or a platform the product parses by name. Nothing else is acceptable. */
function isAllowed(host: string): boolean {
  return isReserved(host) || isPlatform(host);
}

/* ── walk every string in every fixture module ───────────────────────────────────────── */

const MODULES: Record<string, unknown> = { cards, contacts, extremes, marketing, profile, user };

/**
 * One string found in the fixtures, with the `FieldType` of the nearest enclosing object.
 *
 * The field type is carried because a bare hostname is only *meaningful* on a `URL` or
 * `SOCIAL_LINK` field. Elsewhere a dot-separated token is something else entirely — a PayPal
 * handle (`prya.pays`), a UPI VPA, an account reference — and checking those against a domain
 * rule produces false positives, not findings.
 */
interface Found {
  path: string;
  value: string;
  /** `null` when the string is not inside anything that declares a `type`. */
  fieldType: string | null;
}

function collectStrings(
  value: unknown,
  path: string,
  fieldType: string | null,
  into: Found[],
  seen: Set<unknown>,
) {
  if (typeof value === "string") {
    into.push({ path, value, fieldType });
    return;
  }
  if (value === null || typeof value !== "object") return;
  /* Fixture graphs are small but `FIXTURE_DB` aggregates the others, so the same array is
     reachable by more than one path. Guarding is cheaper than de-duplicating findings. */
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, fieldType, into, seen));
    return;
  }
  const record = value as Record<string, unknown>;
  /* The nearest `type` wins, so a `detail` object inherits its parent field's type. */
  const nextType = typeof record.type === "string" ? record.type : fieldType;
  for (const [k, v] of Object.entries(record)) {
    collectStrings(v, `${path}.${k}`, nextType, into, seen);
  }
}

const strings: Found[] = [];
const seen = new Set<unknown>();
for (const [name, mod] of Object.entries(MODULES)) {
  collectStrings(mod, name, null, strings, seen);
}

/* ── the rules ───────────────────────────────────────────────────────────────────────── */

/** `mailto:`-able addresses, and bare `user@host` values. */
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
/** Absolute URLs only. A protocol-less `example.com/press` is caught by the email/host sweep. */
const URL_RE = /\bhttps?:\/\/([^/\s"'<>)]+)/g;
/**
 * A bare hostname used as an ENTIRE field value — a `URL` field entered without a scheme, e.g.
 * `fernwood.example/press`.
 *
 * Anchored on purpose. An unanchored version matched substrings and produced only noise: the
 * `00.000Z` tail of an ISO timestamp, and the `mei.builds` path segment of an Instagram URL.
 */
const BARE_HOST_VALUE = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/\S*)?$/i;

describe("fixture data references no real domain", () => {
  it("uses only reserved domains in email addresses", () => {
    /* No platform exemption here. The exemption exists because a social LINK must name its
       platform; a mailbox never has to, so an email address must be reserved outright. */
    const offenders: string[] = [];
    for (const { path, value } of strings) {
      for (const [, host] of value.matchAll(EMAIL)) {
        if (!isReserved(host)) offenders.push(`${path}: ${host}`);
      }
    }
    expect(offenders, `real domains in fixture emails:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("uses only reserved domains in URLs", () => {
    const offenders: string[] = [];
    for (const { path, value } of strings) {
      for (const [, host] of value.matchAll(URL_RE)) {
        /* `localhost` and `127.0.0.1` are reserved and legitimately appear in a dev payload. */
        if (host.startsWith("127.0.0.1")) continue;
        if (!isAllowed(host)) offenders.push(`${path}: ${host}`);
      }
    }
    expect(offenders, `real domains in fixture URLs:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("uses only reserved domains in scheme-less hostnames", () => {
    /* Extensions that make a whole value a filename rather than a hostname — `logo.png` and
       `card.svg` both match a hostname shape, and an asset path is not a domain. */
    const FILE_EXT =
      /\.(png|jpe?g|gif|svg|webp|avif|ico|ttf|woff2?|css|js|tsx?|json|md|vcf|pdf|mp4|webm)$/i;
    /* Only these two field types can carry a hostname with no scheme. On anything else a
       dot-separated token is a wallet handle or an account reference — `prya.pays` is a PayPal
       handle, and matching it against a domain rule reports a problem that does not exist. */
    const HOST_BEARING = new Set(["URL", "SOCIAL_LINK"]);
    const offenders: string[] = [];
    for (const { path, value, fieldType } of strings) {
      if (fieldType !== null && !HOST_BEARING.has(fieldType)) continue;
      const trimmed = value.trim();
      if (FILE_EXT.test(trimmed)) continue;
      const match = BARE_HOST_VALUE.exec(trimmed);
      if (match === null) continue;
      const host = match[1];
      if (host.startsWith("127.0.0.1")) continue;
      if (!isAllowed(host)) offenders.push(`${path}: ${host}`);
    }
    expect(offenders, `real hostnames in fixture values:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("the reserved-domain check itself", () => {
  /* A hygiene test that cannot fail is worse than no hygiene test, so this proves the predicate
     actually rejects things. Without it, a broken `isReserved` would make every sweep above
     pass silently. */
  it("accepts the RFC-reserved names", () => {
    for (const host of [
      "example.com",
      "example.org",
      "example.net",
      "fernwood.example",
      "anything.test",
      "nope.invalid",
      "localhost",
      "localhost:3000",
      "SUB.Fernwood.EXAMPLE",
    ]) {
      expect(isReserved(host), host).toBe(true);
    }
  });

  it("exempts platform hosts, with and without a www prefix", () => {
    expect(isAllowed("linkedin.com")).toBe(true);
    expect(isAllowed("www.linkedin.com")).toBe(true);
    expect(isAllowed("github.com")).toBe(true);
    expect(isAllowed("facebook.com")).toBe(true); // in the table
    /* ...but the exemption IS the table, not a general amnesty for famous sites. */
    expect(isAllowed("mas.to")).toBe(false);
    expect(isAllowed("reddit.com")).toBe(false);
    expect(isAllowed("gmail.com")).toBe(false);
  });

  it("rejects real, registrable domains", () => {
    for (const host of [
      "acme.co",
      "google.com",
      "some-studio.ai",
      "exampled.com",
      "notexample.com",
      "example.co",
    ]) {
      expect(isReserved(host), host).toBe(false);
    }
  });
});
