/**
 * The API contract, as a machine check.
 *
 * ## What this file is for
 * "We integrated every endpoint" and "our enums match the spec" are both claims that rot the
 * moment the API ships a change. This test turns both into assertions against a committed
 * snapshot of `GET /api/docs-json`, so a spec drift fails the suite instead of surfacing as a
 * blank field or a 404 during a demo.
 *
 * ## Why a snapshot rather than a live fetch
 * A test that hits staging is a test that fails when staging is redeploying, and one that
 * quietly passes when somebody's laptop is offline and the fetch is caught. The snapshot is
 * committed at `src/lib/api/openapi.snapshot.json` and refreshed deliberately:
 *
 *     curl -s https://apistaging.getcontactbook.com/api/docs-json \
 *       > apps/web/src/lib/api/openapi.snapshot.json
 *
 * A refresh that breaks this suite is the signal — that is the whole point.
 *
 * ## How coverage is measured
 * By reading the endpoint modules' own source and extracting the `method`/`path` pairs they
 * pass to `transport`. Deriving it from the source rather than from a hand-kept list means a
 * new endpoint function is picked up automatically and a hand-kept list cannot drift.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import snapshot from "@/lib/api/openapi.snapshot.json";
import {
  API_CARD_KINDS,
  API_CONTACT_SOURCES,
  API_FIELD_CATEGORIES,
  API_FIELD_TYPES,
  API_GROUP_CATEGORIES,
  API_SHARE_LINK_STATUSES,
  API_TEMPLATE_APPROVALS,
  API_TEMPLATE_PURPOSES,
} from "@/lib/api/schema";

/**
 * Resolved from `process.cwd()` rather than `import.meta.url`: the happy-dom environment
 * gives modules an `http://localhost` base, so `fileURLToPath` throws on it. Vitest runs
 * with the package root as its cwd.
 */
const ENDPOINTS_DIR = resolve(process.cwd(), "src/lib/api/endpoints");

/** `"POST /auth/otp/verify"` — the comparable identity of one operation. */
type OperationKey = string;

/* ── The spec side ───────────────────────────────────────────────────────────────────── */

const SPEC_PREFIX = "/api/v1";

function specOperations(): OperationKey[] {
  const paths = (snapshot as { paths: Record<string, Record<string, unknown>> }).paths;
  const keys: OperationKey[] = [];
  for (const [path, operations] of Object.entries(paths)) {
    for (const method of Object.keys(operations)) {
      // Strip the version prefix: our client stores paths relative to it, so that the
      // version bumps in `config.ts` alone.
      const relative = path.startsWith(SPEC_PREFIX) ? path.slice(SPEC_PREFIX.length) : path;
      keys.push(`${method.toUpperCase()} ${relative}`);
    }
  }
  return keys.sort();
}

/* ── The client side ─────────────────────────────────────────────────────────────────── */

/**
 * Normalise a path expression from source into the spec's shape.
 *
 * `` `/profile/fields/${encodeURIComponent(id)}` `` → `/profile/fields/{id}`. The spec names
 * every path parameter `id`, so a single placeholder is enough; if that ever stops being true
 * the coverage assertion below fails loudly rather than matching the wrong operation.
 */
function normalisePath(raw: string): string {
  return raw.replace(/\$\{[^}]*\}/g, "{id}");
}

function clientOperations(): OperationKey[] {
  const keys: OperationKey[] = [];

  for (const file of readdirSync(ENDPOINTS_DIR).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(`${ENDPOINTS_DIR}/${file}`, "utf8");

    // Matches the object literal every endpoint function passes to `authed`/`anon`:
    //   { method: "GET", path: "/cards" }
    //   { method: "PUT", path: `/cards/${encodeURIComponent(id)}/fields`, body }
    const pattern = /method:\s*"(GET|POST|PATCH|PUT|DELETE)"\s*,\s*path:\s*(`[^`]*`|"[^"]*")/g;

    for (const match of source.matchAll(pattern)) {
      const method = match[1];
      const rawPath = match[2];
      if (method === undefined || rawPath === undefined) continue;
      keys.push(`${method} ${normalisePath(rawPath.slice(1, -1))}`);
    }
  }

  return keys.sort();
}

/* ── Coverage ────────────────────────────────────────────────────────────────────────── */

describe("API coverage", () => {
  const spec = specOperations();
  const client = clientOperations();

  it("the snapshot holds the 38 operations this integration was scoped against", () => {
    // A guard on the guard: if the snapshot is refreshed and the count moves, every
    // assertion below is measuring a different API than the one the UI was mapped to.
    // 36 -> 38 when card-update notifications landed: /cards/{id}/audience and /notify.
    expect(spec).toHaveLength(38);
  });

  it("implements every operation in the spec", () => {
    const missing = spec.filter((operation) => !client.includes(operation));
    expect(missing, `Not implemented in src/lib/api/endpoints:\n  ${missing.join("\n  ")}`).toEqual(
      [],
    );
  });

  it("implements nothing the spec does not define", () => {
    // Catches a typo'd path far more cheaply than a 404 at runtime does.
    const invented = client.filter((operation) => !spec.includes(operation));
    expect(invented, `Not present in the spec:\n  ${invented.join("\n  ")}`).toEqual([]);
  });
});

/* ── Enums ───────────────────────────────────────────────────────────────────────────── */

/**
 * Pull an enum out of the snapshot by schema name and property.
 *
 * Reading it from the schema rather than hard-coding the expected members is what makes this
 * a contract test: the expectation *is* the spec.
 */
function specEnum(schemaName: string, property: string): string[] {
  const schemas = (
    snapshot as {
      components: {
        schemas: Record<string, { properties?: Record<string, { enum?: string[] }> }>;
      };
    }
  ).components.schemas;

  const values = schemas[schemaName]?.properties?.[property]?.enum;
  if (values === undefined) {
    throw new Error(`No enum at ${schemaName}.${property} — the snapshot shape changed.`);
  }
  return [...values].sort();
}

describe("API enums match the spec", () => {
  const cases: ReadonlyArray<readonly [string, readonly string[], string, string]> = [
    ["field category", API_FIELD_CATEGORIES, "ProfileFieldResponseDto", "category"],
    ["field type", API_FIELD_TYPES, "ProfileFieldResponseDto", "type"],
    ["group category", API_GROUP_CATEGORIES, "ProfileFieldGroupResponseDto", "category"],
    ["card kind", API_CARD_KINDS, "CardResponseDto", "kind"],
    ["contact source", API_CONTACT_SOURCES, "ContactResponseDto", "source"],
    ["share link status", API_SHARE_LINK_STATUSES, "ShareLinkResponseDto", "status"],
    ["template purpose", API_TEMPLATE_PURPOSES, "WhatsAppTemplateResponseDto", "purpose"],
    ["template approval", API_TEMPLATE_APPROVALS, "WhatsAppTemplateResponseDto", "approvalStatus"],
  ];

  for (const [label, ours, schemaName, property] of cases) {
    it(`${label} has exactly the spec's members`, () => {
      expect([...ours].sort()).toEqual(specEnum(schemaName, property));
    });
  }

  it("card kind says WORK, and the UI's BUSINESS is a mapping rather than a match", () => {
    // The single most likely silent bug in this integration: the UI's `CardType` uses
    // BUSINESS where the API uses WORK. Pinned here so a mapper regression is a test
    // failure and not a card that renders under the wrong heading.
    expect(API_CARD_KINDS).toContain("WORK");
    expect(API_CARD_KINDS as readonly string[]).not.toContain("BUSINESS");
  });
});
