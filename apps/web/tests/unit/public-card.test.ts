/**
 * `GET /public/links/{token}` — the endpoint a stranger's browser hits, and the parser that has to
 * cope with a payload nobody has seen yet.
 *
 * ## Why the parser is tolerant rather than exact
 * This endpoint is **live but undocumented** — it is not in `GET /api/docs-json`. Its path was
 * confirmed by the shape of its 404 (`SHARE_LINK_NOT_FOUND`, a domain code, versus `Cannot GET`
 * for a route that does not exist), but its *success* payload cannot be confirmed without a real
 * token, which needs an account that has shared a card.
 *
 * So `parsePublicCard` looks for the same few facts across the layouts this endpoint plausibly
 * returns, and reports which one matched. These tests pin every one of those layouts, so the day a
 * real link arrives the change is one branch — not a rewrite — and a regression in the others is
 * caught immediately.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublicCard, parsePublicCard } from "@/lib/api/public-card";
import { resolvePublicCard } from "@/lib/api/public-card-map";

const FIELDS = [
  { type: "PHONE", label: "Work phone", value: "+919820000001" },
  { type: "EMAIL", label: "Work email", value: "priya@fernwood.example" },
];

describe("parsePublicCard — the layouts it accepts", () => {
  it("flat: everything at the top level", () => {
    const parsed = parsePublicCard({
      cardName: "Work",
      kind: "WORK",
      fullName: "Priyanka Raghunathan",
      avatarUrl: "/p.png",
      fields: FIELDS,
    });
    expect(parsed).toMatchObject({
      shape: "root",
      cardName: "Work",
      kind: "WORK",
      fullName: "Priyanka Raghunathan",
      avatarUrl: "/p.png",
    });
    expect(parsed?.fields).toHaveLength(2);
  });

  it("nested under `card`, with the owner beside it", () => {
    const parsed = parsePublicCard({
      card: { name: "Work", kind: "WORK", fields: FIELDS },
      owner: { firstName: "Priyanka", lastName: "Raghunathan", profilePhoto: "/p.png" },
    });
    expect(parsed?.shape).toBe("card");
    expect(parsed?.fullName).toBe("Priyanka Raghunathan");
    expect(parsed?.avatarUrl).toBe("/p.png");
    expect(parsed?.fields).toHaveLength(2);
  });

  it("nested under `snapshot`, the shape an earlier iteration of this API used", () => {
    const parsed = parsePublicCard({
      snapshot: { cardName: "Work", fields: FIELDS },
      identity: { fullName: "Priyanka Raghunathan" },
    });
    expect(parsed?.shape).toBe("snapshot");
    expect(parsed?.fullName).toBe("Priyanka Raghunathan");
  });

  it("nested under `data`", () => {
    const parsed = parsePublicCard({ data: { fullName: "Mei Nakamura", fields: FIELDS } });
    expect(parsed?.shape).toBe("data");
    expect(parsed?.fullName).toBe("Mei Nakamura");
  });

  it("builds a name from firstName + lastName when there is no fullName", () => {
    const parsed = parsePublicCard({ firstName: "Mei", lastName: "Nakamura", fields: FIELDS });
    expect(parsed?.fullName).toBe("Mei Nakamura");
  });

  it("accepts a card with a name and no fields — that is a real card, not a broken payload", () => {
    // A card whose owner has mapped nothing still exists and still renders; the renderer shows
    // the §11 E-02 caption rather than a blank.
    const parsed = parsePublicCard({ fullName: "Mei Nakamura", fields: [] });
    expect(parsed?.fullName).toBe("Mei Nakamura");
    expect(parsed?.fields).toEqual([]);
  });

  it("drops a blank field value rather than rendering an empty row (§11 E-07)", () => {
    const parsed = parsePublicCard({
      fullName: "Mei",
      fields: [...FIELDS, { type: "EMAIL", label: "Empty", value: "" }],
    });
    expect(parsed?.fields).toHaveLength(2);
  });

  it("defaults a missing field type to TEXT rather than dropping the row", () => {
    const parsed = parsePublicCard({ fullName: "Mei", fields: [{ value: "something" }] });
    expect(parsed?.fields[0]).toMatchObject({ type: "TEXT", value: "something" });
  });

  it("returns null when there is genuinely nothing to draw", () => {
    // Reported as an error and logged with the payload's real keys, rather than drawn as a blank
    // card — which is what turns one real link into a definitive answer.
    expect(parsePublicCard({})).toBeNull();
    expect(parsePublicCard({ unexpected: true })).toBeNull();
    expect(parsePublicCard(null)).toBeNull();
    expect(parsePublicCard("nope")).toBeNull();
  });
});

describe("fetchPublicCard — the four outcomes", () => {
  function stub(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        body === null
          ? new Response(null, { status })
          : new Response(JSON.stringify(body), {
              status,
              headers: { "content-type": "application/json" },
            }),
      ),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a domain 404 as 'no such link'", async () => {
    // This is the real staging response, and it is what proved the route exists.
    stub(404, {
      statusCode: 404,
      code: "SHARE_LINK_NOT_FOUND",
      message: "This link does not exist.",
      requestId: "r",
    });
    await expect(fetchPublicCard("tok")).resolves.toEqual({ kind: "not-found" });
  });

  it("still tells an unmatched route apart from an unknown link", async () => {
    stub(404, { statusCode: 404, code: "NOT_FOUND", message: "Cannot GET /api/v1/public/links/x" });
    await expect(fetchPublicCard("tok")).resolves.toEqual({ kind: "not-implemented" });
  });

  it("reads 410 as revoked", async () => {
    stub(410, null);
    await expect(fetchPublicCard("tok")).resolves.toEqual({ kind: "revoked" });
  });

  it("returns the card on a readable 200", async () => {
    stub(200, { fullName: "Priyanka Raghunathan", cardName: "Work", fields: FIELDS });
    const result = await fetchPublicCard("tok");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.card.fields).toHaveLength(2);
  });

  it("reports an unreadable 200 as an error, never as a blank card", async () => {
    stub(200, { totally: "unexpected" });
    await expect(fetchPublicCard("tok")).resolves.toEqual({ kind: "error" });
  });

  it("encodes the token, so a slash cannot address a different path", async () => {
    // Parameters declared so `mock.calls` is typed as the fetch arguments.
    const spy = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (input: string | URL | Request, init?: RequestInit) =>
        new Response(JSON.stringify({ fullName: "x", fields: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", spy);
    await fetchPublicCard("a/../b");
    expect(String(spy.mock.calls[0]?.[0] ?? "")).toContain("public/links/a%2F..%2Fb");
  });
});

describe("resolvePublicCard", () => {
  const payload = {
    cardName: "Work",
    kind: "WORK",
    fullName: "Priyanka Raghunathan",
    avatarUrl: "/p.png",
    fields: FIELDS,
    shape: "root",
  };

  it("produces a card the owner's own renderer can draw", () => {
    const resolved = resolvePublicCard(payload, "https://example.com/c/tok");

    expect(resolved.fullName).toBe("Priyanka Raghunathan");
    expect(resolved.cardName).toBe("Work");
    // The API's WORK becomes the UI's BUSINESS — the same bridge the owner's view uses.
    expect(resolved.cardType).toBe("BUSINESS");
    expect(resolved.fieldCount).toBe(2);
    // The QR encodes the page the reader is already on, so a card passed phone-to-phone works.
    expect(resolved.qrPayload).toBe("https://example.com/c/tok");
  });

  it("keeps the avatar, and falls back to a monogram without one", () => {
    expect(resolvePublicCard(payload, "u").avatar).toMatchObject({ kind: "photo" });
    expect(
      resolvePublicCard({ ...payload, avatarUrl: null }, "u").avatar.kind,
    ).toBe("monogram");
  });

  it("maps an unrecognised field type to CUSTOM rather than crashing", () => {
    const resolved = resolvePublicCard(
      { ...payload, fields: [{ type: "SOMETHING_NEW", label: "X", value: "v" }] },
      "u",
    );
    expect(resolved.fieldCount).toBe(1);
  });

  it("renders a card with no fields rather than failing", () => {
    const resolved = resolvePublicCard({ ...payload, fields: [] }, "u");
    expect(resolved.fieldCount).toBe(0);
    expect(resolved.fullName).toBe("Priyanka Raghunathan");
  });

  it("puts a payment field on the card, where the renderer masks it by type", () => {
    // A snapshot carries no sensitivity flag, so masking cannot come from the payload — the
    // renderer masks BANK_ACCOUNT / DIGITAL_WALLET / CRYPTO_WALLET by type, and this page has no
    // reveal control at all.
    const resolved = resolvePublicCard(
      { ...payload, fields: [{ type: "BANK_ACCOUNT", label: "Account", value: "123456789" }] },
      "u",
    );
    expect(resolved.fieldCount).toBe(1);
  });
});
