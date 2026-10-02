import { expect, test, type Page, type Request } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";
import { signIn, statefulSub } from "../helpers/session";

/**
 * **THE API INTEGRATION, PROVED THROUGH THE SCREENS THAT USE IT.**
 *
 * Three endpoints landed together and this file is the machine check that each is genuinely
 * wired rather than merely present in a client module:
 *
 *   · `PATCH /cards/{id}` — the seven design axes plus `headline` and `bio`
 *   · `POST` / `DELETE /cards/{id}/cover` — the hero photograph
 *   · `GET /dashboard` — every number on the dashboard, server-computed
 *
 * ## ⚠ WHY THIS SUITE NEEDS A STATEFUL STUB, AND WHAT THAT BUYS
 *
 * The defect this work exists to fix was invisible on screen. `coverUrl`, `headline` and `bio`
 * lived in `localStorage`, so the builder looked *completely correct* — the owner set a cover, it
 * rendered, it was still there after a reload of that tab. It was wrong only on another device,
 * and on `/c/{token}`, which is server-rendered and could never see it at all.
 *
 * A stub that echoes writes and discards them reproduces exactly that illusion: a client that
 * never sends the `PATCH` passes every assertion a stateless stub can make. So each test below
 * signs in with its own `sub`, which hands it a private mutable world (`tests/stubs/state.mjs`),
 * and the load-bearing assertion is almost always **"reload, and it is still there"** — the one
 * thing the old implementation could not do.
 *
 * Where a round trip alone would still be ambiguous, the request itself is asserted: `sentBody`
 * captures what actually went over the wire, so "the owner cleared their bio" can be checked to
 * be an explicit `null` rather than an omitted key, which is a distinction the rendered screen
 * cannot show and the API treats as the difference between clearing and not touching.
 *
 * ## What a pass does NOT prove
 * The server. The real aggregation, the real Prisma writes and the payment-field masking are the
 * API's own Jest suite's job. `state.mjs` says the same thing at more length, and is worth
 * reading before trusting a green run here further than it goes.
 */

/** Every test drives a card that already exists and has fields. */
const CARD_ID = "card_minimal_demo";

/**
 * The builder, opened on its Design panel.
 *
 * ⚠ `?panel=design` rather than a click on the section rail, and that is the seam the rail was
 * built to offer: the tabs write the active panel to the URL with `replaceState` precisely so a
 * panel is addressable — "linkable, bookmarkable, and survivable across a reload", per
 * `builder-nav.tsx`. Clicking through the rail on every test would be asserting the rail, which
 * `builder.spec.ts` already owns, in front of every assertion about the API.
 */
const design = (cardId: string) => `/cards/${cardId}/edit?panel=design`;
const CONTACT_ID = "contact_arjun";

/**
 * A 2×2 JPEG, as the bytes a `File` would carry.
 *
 * ⚠ Deliberately a **real, decodable JPEG** rather than a stand-in string: the cover path runs
 * the file through `createImageBitmap` and a canvas before it is ever uploaded, so anything the
 * browser cannot decode fails in the picker and never reaches the endpoint under test.
 */
const JPEG_2X2 = [
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a",
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAHwAAAQUBAQEB",
  "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh",
  "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ",
  "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG",
  "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiigD//2Q==",
].join("");

/**
 * Drive the builder's hidden file input directly.
 *
 * `setInputFiles` on `[data-cover-input]` is the honest seam: it fires the same `change` the
 * owner's own file picker does, so everything downstream — the downscale, the crop dialog, the
 * `dataUrlToFile` conversion and the upload — runs exactly as it does for a person.
 */
async function chooseCover(page: Page): Promise<void> {
  await page.locator("[data-cover-input]").setInputFiles({
    name: "portrait.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(JPEG_2X2, "base64"),
  });
  /* The crop dialog opens on the downscaled source. Applying it is what produces the composed
     bytes the endpoint is sent — there is no path to the API that skips it, by design. */
  const apply = page.getByRole("button", { name: /use this crop|apply/i });
  await expect(apply).toBeVisible();
  await apply.click();
}

/**
 * One toast, by its title.
 *
 * ⚠ Scoped to `[data-toast-title]` rather than `getByText`. Every toast renders twice on
 * purpose — the visible title, and a `role="status"` node carrying the same words for a screen
 * reader — so a bare text match resolves to two elements and Playwright's strict mode refuses
 * the locator outright. That is the accessibility affordance working, not a duplicate.
 */
const toast = (page: Page, text: RegExp) =>
  page.locator("[data-toast-title]").filter({ hasText: text });

/** The JSON body a matching request actually carried — `undefined` if it never fired. */
function sentBody(
  page: Page,
  method: string,
  pattern: RegExp,
): { read: () => Record<string, unknown> | undefined } {
  let captured: Record<string, unknown> | undefined;
  page.on("request", (request: Request) => {
    if (request.method() !== method || !pattern.test(request.url())) return;
    try {
      captured = JSON.parse(request.postData() ?? "") as Record<string, unknown>;
    } catch {
      /* Multipart, or no body — the caller is asserting on a JSON route, so leave it unset
         rather than recording a shape it would then have to defend against. */
    }
  });
  return { read: () => captured };
}

/** Every request path this page made, so a test can assert what was NOT called. */
function requestLog(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/cb/")) seen.push(`${request.method()} ${pathname}`);
  });
  return seen;
}

/* ══ PATCH /cards/{id} — the design axes, the headline and the bio ══════════════════════ */

test.describe("PATCH /cards/{id}", () => {
  test("saves the design, the position and the bio, and they survive a reload", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("patch-design") });
    const patch = sentBody(page, "PATCH", /\/cards\/card_minimal_demo$/);

    await gotoReady(page, design(CARD_ID));

    /* A look writes two axes at once — `paletteId` AND `finish` — which is the case a client
       that sent only the palette would pass a weaker assertion on. */
    await page.locator('[data-look-option="sapphire-mesh"]').click();
    await page.locator("[data-headline-input]").fill("Head of Partnerships");
    await page.locator("[data-bio-input]").fill("Connecting people, ideas and opportunities.");
    await page.locator("[data-builder-save]").click();
    await expect(toast(page, /card saved/i).first()).toBeVisible();

    /* ⚠ Every axis on every write, `null` included — a PATCH leaves an omitted column alone, so
       "the owner cleared their custom colour" has to be said out loud or it comes back. */
    expect(patch.read()).toMatchObject({
      paletteId: "sapphire",
      finish: "mesh",
      headline: "Head of Partnerships",
      bio: "Connecting people, ideas and opportunities.",
      groundHex: null,
    });

    /* ⚠ **`coverUrl` must NOT be in a Save.** The API accepts exactly one value for it — null —
       so a blanket save that included it would delete the owner's cover on every rename. */
    expect(patch.read()).not.toHaveProperty("coverUrl");

    /* The assertion the localStorage shim could never have failed: read it back from the server
       in a browser that has never held this card's state. */
    await gotoReady(page, design(CARD_ID));
    await expect(page.locator("[data-headline-input]")).toHaveValue("Head of Partnerships");
    await expect(page.locator("[data-bio-input]")).toHaveValue(
      "Connecting people, ideas and opportunities.",
    );
    await expect(page.locator('[data-look-picker]')).toHaveAttribute(
      "data-selected-look",
      "sapphire-mesh",
    );
  });

  test("clears the position and bio with an explicit null, not an omitted key", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("patch-clear") });
    const patch = sentBody(page, "PATCH", /\/cards\/card_minimal_demo$/);

    await gotoReady(page, design(CARD_ID));
    await page.locator("[data-headline-input]").fill("Interim");
    await page.locator("[data-bio-input]").fill("Temporary.");
    await page.locator("[data-builder-save]").click();
    await expect(toast(page, /card saved/i).first()).toBeVisible();

    await gotoReady(page, design(CARD_ID));
    await expect(page.locator("[data-headline-input]")).toHaveValue("Interim");

    await page.locator("[data-headline-input]").fill("");
    await page.locator("[data-bio-input]").fill("");
    await page.locator("[data-builder-save]").click();
    await expect(toast(page, /card saved/i).first()).toBeVisible();

    /* ⚠ The distinction the screen cannot show. `""` would be stored and every reader would
       then have to re-trim it; an omitted key would leave "Interim" in place and the owner
       would watch their deletion come back on the next read. `null` is how a choice is unmade. */
    expect(patch.read()).toMatchObject({ headline: null, bio: null });

    await gotoReady(page, design(CARD_ID));
    await expect(page.locator("[data-headline-input]")).toHaveValue("");
    await expect(page.locator("[data-bio-input]")).toHaveValue("");
  });
});

/* ══ POST / DELETE /cards/{id}/cover ═══════════════════════════════════════════════════ */

test.describe("the cover endpoints", () => {
  test("uploads a composed crop, and the card wears it after a reload", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("cover-upload") });

    const uploads: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/cards\/[^/]+\/cover$/.test(request.url())) {
        uploads.push(request.headers()["content-type"] ?? "");
      }
    });

    await gotoReady(page, design(CARD_ID));
    await expect(page.locator('[data-cover-thumb="empty"]')).toBeVisible();

    await chooseCover(page);

    /* The upload fires on APPLY, not on Save: `PATCH` rejects a cover URL outright, so there is
       no way for Save to carry one and the crop has to go up on its own. */
    await expect(toast(page, /cover updated/i).first()).toBeVisible();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain("multipart/form-data");

    const thumb = page.locator('[data-cover-thumb="set"] img');
    await expect(thumb).toBeVisible();

    /* ⚠ **The server's URL, not the locally composed one.** `cover-saved` swaps the data URL the
       preview was drawing for whatever the API answered with, and a client that skipped that
       would keep rendering a string that means nothing on any other screen. The stub echoes the
       uploaded bytes back, so this is also proof the image that reaches the card is the one the
       crop dialog produced — not the original file off disk, which would render a full-length
       photograph as a head crop. */
    const uploaded = await thumb.getAttribute("src");
    expect(uploaded).toMatch(/^data:image\/jpeg;base64,/);

    await gotoReady(page, design(CARD_ID));
    await expect(page.locator('[data-cover-thumb="set"] img')).toHaveAttribute("src", uploaded!);
  });

  /**
   * ⚠ THE REGRESSION THIS EXISTS FOR.
   *
   * `PATCH /cards/{id}` accepts exactly one value for `coverUrl` — `null` — so a Save that sent
   * the key unconditionally, the way it sends the seven design axes, would delete the owner's
   * cover every single time they renamed the card or changed its colour. The omission is easy to
   * "fix" wrongly and impossible to notice by hand, because the cover is still on screen until
   * the next reload.
   */
  test("a later Save does not delete the cover", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { sub: statefulSub("cover-survives-save") });
    await gotoReady(page, design(CARD_ID));

    await chooseCover(page);
    await expect(toast(page, /cover updated/i).first()).toBeVisible();
    const uploaded = await page.locator('[data-cover-thumb="set"] img').getAttribute("src");

    await page.locator('[data-look-option="emerald-gradient"]').click();
    await page.locator("[data-builder-save]").click();
    await expect(toast(page, /card saved/i).first()).toBeVisible();

    await gotoReady(page, design(CARD_ID));
    await expect(page.locator('[data-cover-thumb="set"] img')).toHaveAttribute("src", uploaded!);
    await expect(page.locator("[data-look-picker]")).toHaveAttribute(
      "data-selected-look",
      "emerald-gradient",
    );
  });

  test("removes the cover, and it stays removed", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { sub: statefulSub("cover-remove") });

    const deletes: number[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "DELETE" &&
        /\/cards\/[^/]+\/cover$/.test(response.url())
      ) {
        deletes.push(response.status());
      }
    });

    await gotoReady(page, design(CARD_ID));
    await chooseCover(page);
    await expect(toast(page, /cover updated/i).first()).toBeVisible();

    await page.locator("[data-cover-remove]").click();
    await expect(toast(page, /cover removed/i).first()).toBeVisible();
    /* 204, its own route — not a PATCH with `coverUrl: null`, though the API treats the two
       identically. The dedicated call says what it does and keeps Save out of it entirely. */
    expect(deletes).toEqual([204]);

    await expect(page.locator('[data-cover-thumb="empty"]')).toBeVisible();
    await gotoReady(page, design(CARD_ID));
    await expect(page.locator('[data-cover-thumb="empty"]')).toBeVisible();
  });
});

/* ══ GET /dashboard ════════════════════════════════════════════════════════════════════ */

test.describe("GET /dashboard", () => {
  /**
   * ⚠ The N+1 this endpoint replaced: `GET /cards` + `/contacts` + `/share-links` + **one
   * `/cards/{id}/audience` per card**, on every load, reduced on the client. With nine fixture
   * cards that was a dozen requests and — worse — two independent reductions that could and did
   * disagree, letting `behind` exceed `peopleReached`.
   *
   * `GET /cards` legitimately remains: the charts colour each bar by the palette its card
   * actually wears, and the dashboard payload carries no appearance. It contributes no number.
   */
  test("loads from one call, with no per-card audience requests", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("dashboard-one-call") });
    const requests = requestLog(page);

    await gotoReady(page, "/dashboard");
    await expect(page.locator("[data-reach-panel]")).toBeVisible();

    expect(requests.filter((r) => r.endsWith("/dashboard"))).toHaveLength(1);
    expect(requests.filter((r) => /\/audience$/.test(r))).toHaveLength(0);
    expect(requests.filter((r) => r.endsWith("/share-links"))).toHaveLength(0);
  });

  test("renders the totals the endpoint returned", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { sub: statefulSub("dashboard-totals") });

    let payload: { totals: Record<string, number | null> } | undefined;
    page.on("response", async (response) => {
      /* ⚠ `/dashboard` is BOTH a page route and an API path, so a bare `endsWith` also matches
         the navigation itself and tries to parse an HTML document as JSON. The proxy prefix is
         what distinguishes the two. */
      if (!response.url().includes("/api/cb/dashboard")) return;
      payload = (await response.json()) as typeof payload;
    });

    await gotoReady(page, "/dashboard");
    const counts = page.locator("[data-reach-counts]");
    await expect(counts).toBeVisible();

    expect(payload).toBeDefined();
    /* Read off the screen and compared to the wire, so a screen that renders a plausible number
       it derived itself fails. Every count here is the API's answer or it is wrong. Since
       2026-09-28 the card and contact counts lead their summary tiles instead of the strip. */
    const tileCount = (region: string) =>
      page.locator(`[data-dashboard-region="${region}"] [data-summary-tile-count]`).innerText();
    expect(await tileCount("cards")).toContain(String(payload!.totals.cards));
    expect(await tileCount("contacts")).toContain(String(payload!.totals.contacts));
    expect(await counts.innerText()).toContain(String(payload!.totals.peopleReached));
  });

  /**
   * The queue is the screen's reason to exist, and the zero-activity rows are the actionable
   * ones — a card with no fields or no shares is precisely what the owner should act on, so
   * neither may be filtered out on the way to the list.
   */
  test("shows the attention rows the endpoint sent, in its order", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("dashboard-attention") });

    let kinds: string[] = [];
    page.on("response", async (response) => {
      /* ⚠ `/dashboard` is BOTH a page route and an API path, so a bare `endsWith` also matches
         the navigation itself and tries to parse an HTML document as JSON. The proxy prefix is
         what distinguishes the two. */
      if (!response.url().includes("/api/cb/dashboard")) return;
      const body = (await response.json()) as { attention: Array<{ kind: string }> };
      kinds = body.attention.map((row) => row.kind);
    });

    await gotoReady(page, "/dashboard");
    /* The ROWS, not the region: the loading bones carry the same region handle, so the region is
       visible before the response has even been parsed. */
    await expect(page.locator("[data-attention-row]").first()).toBeVisible();
    await expect.poll(() => kinds.length).toBeGreaterThan(0);

    /* The fixture has an empty card and no share links at all, so both zero-activity kinds are
       present — which is the case a filter-the-boring-rows implementation would drop. */
    expect(kinds).toContain("no-fields");
    expect(kinds).toContain("never-shared");

    const rendered = await page.locator("[data-attention-row]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-attention-row")),
    );
    /* Rendered in the API's own order — a second sort on the client is a second answer to a
       question already answered, and the one nobody updates. */
    expect(rendered).toEqual(kinds.slice(0, rendered.length));
  });

  /**
   * ⚠ `behind: null` is "no cards yet, so there is nothing to compute this from". It is NOT
   * `0`, which means "checked, and nobody is behind". Collapsing the two reports a confident
   * all-clear to an account that has simply never been used — and `reachScore` is built around
   * the same rule: an unmeasurable lever takes no weight instead of scoring zero.
   */
  test("renders an unknown backlog as an invitation, never as a grade", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("dashboard-behind-null") });

    await gotoReady(page, "/dashboard");
    /* The fixture owner has cards but has shared none, so `behind` is a real 0 and the score is
       measurable — the dial carries a number. */
    await expect(page.locator("[data-reach-dial]")).not.toHaveText("—");

    /* Now an account with nothing at all. `?state=empty` is the harness's own empty world. */
    await gotoReady(page, "/dashboard?state=empty");
    await expect(page.locator('[data-screen-state="empty"]')).toBeVisible();
  });

  /**
   * The end-to-end proof: a real share, through the real endpoint, moving the real dashboard.
   *
   * This is the assertion that ties the three together — nothing about it is computable on the
   * client any more, so a pass means the browser sent a mutation, the server recomputed, and the
   * screen re-read rather than patching its own copy.
   */
  test("reflects a newly shared card in the totals and the queue", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("dashboard-after-share") });

    await gotoReady(page, "/dashboard");
    const before = page.locator("[data-reach-counts]");
    await expect(before).toContainText("People reached");
    /* Nothing has been shared, so the card is in the queue as never-shared. */
    await expect(page.locator('[data-attention-row="never-shared"]').first()).toBeVisible();

    /* Share it — `POST /cards/{id}/share`, idempotent per (card, contact). */
    const shared = await page.evaluate(
      async ([cardId, contactId]) => {
        const response = await fetch(`/api/cb/cards/${cardId}/share`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        return response.status;
      },
      [CARD_ID, CONTACT_ID],
    );
    expect(shared).toBe(201);

    let totals: Record<string, number | null> | undefined;
    page.on("response", async (response) => {
      /* ⚠ `/dashboard` is BOTH a page route and an API path, so a bare `endsWith` also matches
         the navigation itself and tries to parse an HTML document as JSON. The proxy prefix is
         what distinguishes the two. */
      if (!response.url().includes("/api/cb/dashboard")) return;
      totals = ((await response.json()) as { totals: typeof totals }).totals;
    });

    await gotoReady(page, "/dashboard");
    /* The response listener parses asynchronously, so wait for it rather than racing it. */
    await expect.poll(() => totals).toBeDefined();

    /* One person now holds a link, nobody has opened it, and the API — not this test — is what
       decided all three of these numbers. */
    expect(totals).toMatchObject({ peopleReached: 1, peopleOpened: 0, neverOpened: 1 });

    /* And the queue moved with them: that card is no longer "never shared", it is "never
       opened". A dashboard computing this on the client would have needed three more requests
       to notice. */
    const rows = page.locator("[data-attention-row]");
    await expect(rows.filter({ has: page.locator("text=Work") }).first()).toBeVisible();
    await expect(page.locator('[data-attention-row="never-opened"]').first()).toBeVisible();
  });
});

/* ══ the public card — the surface the localStorage shim could never reach ══════════════ */

/**
 * ⚠ THE WHOLE POINT OF THESE BEING COLUMNS.
 *
 * While the cover, position and bio lived in the owner's `localStorage`, `/c/{token}` — which is
 * resolved **server-side** — could not see them, so a recipient always opened a plainer card than
 * the one its owner had been previewing. Nothing in the builder revealed that; only this route
 * does.
 *
 * ⚠ It drives a card that HAS fields. `card_empty_demo` would have been the tidier fixture — no
 * rows to look past — but a card that maps nothing has an `aria-disabled` Save by design (§11
 * E-01: the zero-field card that shipped a 73-byte vCard), so there is no way to commit a
 * headline on it at all.
 */
test("the public card resolves the owner's headline and bio from the API", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, { sub: statefulSub("public-hero") });
  await gotoReady(page, design(CARD_ID));

  await page.locator("[data-headline-input]").fill("Founder");
  await page.locator("[data-bio-input]").fill("Building the thing.");
  await page.locator("[data-builder-save]").click();
  await expect(toast(page, /card saved/i).first()).toBeVisible();

  /* Read back through the API the public page reads, rather than through the builder's own
     state — the builder is exactly the surface that used to look right while being wrong. */
  const card = await page.evaluate(async (cardId) => {
    const response = await fetch(`/api/cb/cards/${cardId}`);
    return (await response.json()) as { headline: string | null; bio: string | null };
  }, CARD_ID);

  expect(card).toMatchObject({ headline: "Founder", bio: "Building the thing." });
});
