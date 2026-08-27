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

import { NO_APPEARANCE, fetchPublicCard, parsePublicCard } from "@/lib/api/public-card";
import { resolvePublicCard } from "@/lib/api/public-card-map";
import { appearanceForKind } from "@/lib/api/map";
import { TEMPLATES } from "@/card/templates";

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

/**
 * The appearance columns, straight off the wire.
 *
 * ⚠ These use the **real staging payloads**, pasted verbatim, because two of the values the API
 * sends are not values this build knows — see the `finish`/`textureScale` case below. Testing
 * against an idealised payload would have hidden exactly the mismatch worth catching.
 */
/**
 * ⚠ The real staging payload, verbatim, and the two bugs it exposed.
 *
 * ```json
 * { "owner": { "name": "Vansh Mehta", "photoUrl": null },
 *   "card":  { "name": "Untitled card", "kind": "WORK", "updatedAt": "…" },
 *   "fields": [ … ] }
 * ```
 *
 * `fields` is a **root** key, so pass 1 matches shape `root` — and everything that describes
 * the card sits one level down under `card`, where nothing was reading it. Both failures were
 * live on every shared link:
 *
 *   1. `cardName` and `kind` came back `null`. `cardTypeOf(null)` defaults to `PERSONAL`, so
 *      **every** shared card rendered marigold + amber — golden — including WORK cards that
 *      should be meridian + sapphire.
 *   2. The owner's name came back `""`, because this API spells it `owner.name` and `nameOf`
 *      refused to read `name` at all.
 *
 * These assert the whole payload rather than one key each, because the two bugs were only
 * visible together: a nameless golden card looks like one broken thing, not two.
 */
describe("parsePublicCard — the live staging layout", () => {
  const LIVE = {
    owner: { name: "Vansh Mehta", photoUrl: null },
    card: { name: "Untitled card", kind: "WORK", updatedAt: "2026-08-27T03:57:13.606Z" },
    fields: [
      { type: "PHONE", label: "Vansh", value: "9953266232" },
      { type: "JOB_TITLE", label: "SDE", value: "SDE@gmail.com" },
    ],
  };

  it("reads the card's name and kind from `card` even though the rows matched at the root", () => {
    const parsed = parsePublicCard(LIVE);

    expect(parsed?.shape).toBe("root");
    expect(parsed?.cardName).toBe("Untitled card");
    expect(parsed?.kind).toBe("WORK");
    expect(parsed?.fields).toHaveLength(2);
  });

  it("reads the owner's name from `owner.name`, the only place this API puts it", () => {
    expect(parsePublicCard(LIVE)?.fullName).toBe("Vansh Mehta");
  });

  it("renders a WORK card blue, not golden (the reported bug, end to end)", () => {
    const parsed = parsePublicCard(LIVE);
    const resolved = resolvePublicCard(parsed!, "https://example.com/c/tok");

    expect(resolved.cardType).toBe("BUSINESS");
    expect(resolved.template.id).toBe("meridian");
    expect(resolved.palette.id).toBe("sapphire");
    expect(resolved.fullName).toBe("Vansh Mehta");
  });

  /**
   * ⚠ The guard on the fix for the fix.
   *
   * Allowing `name` as a person's name is what un-broke the owner — but a *flat* payload's
   * `name` is the card's label, and reading it as a person is the original bug this file's
   * `nameOf` note was written about. `allowName` is granted to identity objects only, and this
   * is what proves the root is not one of them.
   */
  it("never mistakes a flat payload's card name for the person", () => {
    const parsed = parsePublicCard({
      name: "Work",
      kind: "WORK",
      fields: [{ type: "PHONE", label: "Mobile", value: "+911234567890" }],
    });

    expect(parsed?.cardName).toBe("Work");
    expect(parsed?.fullName).toBe("");
  });
});

describe("parsePublicCard — the owner's saved design", () => {
  const base = {
    owner: { name: "Aayush Sharma", photoUrl: null },
    fields: [{ type: "EMAIL", label: "Personal email", value: "a@example.com" }],
  };

  it("reads every axis off the card object", () => {
    const parsed = parsePublicCard({
      ...base,
      card: {
        name: "Appearance test",
        kind: "WORK",
        templateId: "marigold",
        paletteId: "emerald",
        groundHex: "#1B4F72",
        texture: "none",
        texturePresence: "subtle",
        updatedAt: "2026-08-27T06:17:00.213Z",
      },
    });

    expect(parsed?.appearance).toMatchObject({
      templateId: "marigold",
      paletteId: "emerald",
      groundHex: "#1B4F72",
      texture: "none",
      texturePresence: "subtle",
    });
  });

  /**
   * ⚠ The live contract mismatch, pinned rather than papered over.
   *
   * The API's own example sends `finish: "matte"` and `textureScale: "1x"`. This build's
   * vocabulary is `flat | gradient | mesh` and `fine | regular | large`. Neither value exists
   * here, so both are dropped and those axes fall back — the card renders in its default finish
   * rather than throwing on a stranger's phone.
   *
   * When the backend switches to the real enum strings this test should be updated, not deleted:
   * the point it makes is that an unknown value degrades, and that stays worth asserting.
   */
  it("discards values this build does not know, rather than passing them to the renderer", () => {
    const parsed = parsePublicCard({
      ...base,
      card: { name: "X", kind: "WORK", finish: "matte", textureScale: "1x", paletteId: "emerald" },
    });

    expect(parsed?.appearance.finish).toBeNull();
    expect(parsed?.appearance.textureScale).toBeNull();
    // The axes that *were* valid are untouched — one bad value does not poison the rest.
    expect(parsed?.appearance.paletteId).toBe("emerald");
  });

  it("rejects a groundHex that is not #RRGGBB", () => {
    for (const bad of ["1B4F72", "#1B4F7", "#GGGGGG", "blue", ""]) {
      const parsed = parsePublicCard({ ...base, card: { name: "X", groundHex: bad } });
      expect(parsed?.appearance.groundHex, `accepted ${JSON.stringify(bad)}`).toBeNull();
    }
    expect(
      parsePublicCard({ ...base, card: { name: "X", groundHex: "#1b4f72" } })?.appearance.groundHex,
    ).toBe("#1b4f72");
  });

  it("treats all-null and absent-entirely as the same thing", () => {
    // Staging's real response for an un-customised card.
    const nulls = parsePublicCard({
      ...base,
      card: {
        name: "Staging test card", kind: "PERSONAL",
        templateId: null, paletteId: null, groundHex: null,
        finish: null, texture: null, texturePresence: null, textureScale: null,
        updatedAt: "2026-08-26T13:03:14.945Z",
      },
    });
    // What the API sent before the columns shipped — no keys at all.
    const absent = parsePublicCard({
      ...base,
      card: { name: "Staging test card", kind: "PERSONAL", updatedAt: "2026-08-26T13:03:14.945Z" },
    });

    expect(nulls?.appearance).toEqual(NO_APPEARANCE);
    expect(absent?.appearance).toEqual(NO_APPEARANCE);
  });

  /**
   * ⚠ The layout trap this integration nearly walked into.
   *
   * `fields` sits at the payload's root, so pass 1 of `parsePublicCard` matches shape `root` —
   * while the design sits one level down under `card`. Reading the appearance only off the
   * matched layout would find every field and silently drop every colour.
   */
  it("finds the design under `card` even when the rows matched at the root", () => {
    const parsed = parsePublicCard({
      ...base,
      card: { name: "Appearance test", kind: "WORK", paletteId: "oxblood" },
    });

    expect(parsed?.shape).toBe("root");
    expect(parsed?.appearance.paletteId).toBe("oxblood");
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
    // The default for these cases: a card that never chose, which is what every card sent
    // before the API grew its appearance columns looks like.
    appearance: NO_APPEARANCE,
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

  /**
   * ⚠ The recipient's card and the owner's card must be the *same* card.
   *
   * `resolvePublicCard` used to spell the appearance rule out inline — `"PERSONAL" ? marigold
   * : meridian`, with no `paletteId` — a second copy of a rule `map.ts` owns. The copies
   * disagreed on half the kinds: a CUSTOM card was marigold + pistachio for its owner and
   * meridian + sapphire for whoever opened the link, and a PAYMENT card lost its onyx.
   *
   * This walks all four kinds rather than spot-checking one, because the two that drifted were
   * exactly the two a single example would have missed.
   *
   * ⚠ It pins *agreement*, not a palette. Both sides still derive from `kind`, because the API
   * has no appearance columns — a card customised in the builder renders as its type on both
   * screens. When those columns land this test should keep passing, and a second one should
   * assert the owner's saved choice survives the round trip.
   */
  it("dresses the card exactly as the owner's own view does, for every kind (I-5)", () => {
    const kinds = ["WORK", "PERSONAL", "PAYMENT", "CUSTOM"] as const;

    for (const kind of kinds) {
      const resolved = resolvePublicCard({ ...payload, kind }, "u");
      const owner = appearanceForKind(kind);

      expect(resolved.template.id, `template drifted for ${kind}`).toBe(owner.templateId);
      // `undefined` means "whatever the template defaults to" — resolve it the same way
      // `resolveCard` does, so the comparison is over the palette actually painted.
      const expectedPalette = owner.paletteId ?? TEMPLATES[owner.templateId].paletteId;
      expect(resolved.palette.id, `palette drifted for ${kind}`).toBe(expectedPalette);
    }
  });

  /**
   * The design the owner actually saved, end to end — the bug this integration closes.
   *
   * A card built blue used to arrive golden, because the design was never stored and the look
   * was re-derived from `kind`. Now `GET /public/links/{token}` carries it, and these pin that
   * what the payload says is what the stranger sees.
   */
  describe("the owner's saved design", () => {
    it("renders the chosen template and palette instead of the kind's default", () => {
      // WORK would derive meridian + sapphire. This card chose otherwise, and the choice wins.
      const resolved = resolvePublicCard(
        {
          ...payload,
          kind: "WORK",
          appearance: { ...NO_APPEARANCE, templateId: "marigold", paletteId: "emerald" },
        },
        "u",
      );

      expect(resolved.template.id).toBe("marigold");
      expect(resolved.palette.id).toBe("emerald");
    });

    it("lets a free ground colour override the palette, per CardSurface's contract", () => {
      const resolved = resolvePublicCard(
        {
          ...payload,
          appearance: { ...NO_APPEARANCE, paletteId: "emerald", groundHex: "#1B4F72" },
        },
        "u",
      );

      // `groundHex` wins while it is set — the palette is derived from the hex, not looked up.
      expect(resolved.palette.ground.toLowerCase()).toContain("1b4f72");
    });

    it("keeps the axes independent — one choice does not reset the others", () => {
      // Chose a colour and nothing else. The template must still come from the kind, not
      // collapse to a global default because the other six axes were null.
      const resolved = resolvePublicCard(
        { ...payload, kind: "WORK", appearance: { ...NO_APPEARANCE, paletteId: "oxblood" } },
        "u",
      );

      expect(resolved.palette.id).toBe("oxblood");
      expect(resolved.template.id).toBe("meridian");
    });

    it("falls back to the kind's look when every axis is null (a card that never chose)", () => {
      // The exact payload staging returns for an un-customised card.
      const resolved = resolvePublicCard(
        { ...payload, kind: "PERSONAL", appearance: NO_APPEARANCE },
        "u",
      );

      const owner = appearanceForKind("PERSONAL");
      expect(resolved.template.id).toBe(owner.templateId);
      expect(resolved.palette.id).toBe(owner.paletteId ?? TEMPLATES[owner.templateId].paletteId);
    });
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
