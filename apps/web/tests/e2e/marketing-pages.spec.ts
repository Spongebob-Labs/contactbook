import { expect, test } from "@playwright/test";

import { corporate } from "@/fixtures/marketing";
import { contactDetails } from "@/lib/site";

import { gotoReady } from "../helpers/e2e";

/**
 * The brief's three extra pages — `/corporate`, `/waitlist`, `/contact` — and the one route
 * behind both forms.
 *
 * ## ⚠ THE MOST IMPORTANT TEST IN THIS FILE IS THE ONE THAT ASSERTS A FAILURE
 * Where a form submission goes is configuration (`LEAD_WEBHOOK_URL`; see `src/lib/leads.ts`),
 * and in this suite it is deliberately NOT set — which is also how the site runs until somebody
 * chooses a destination. So the property under test is that a submission nobody received is
 * never shown as a success: the route answers 503 and the form offers a real email address
 * instead of a tick. A waitlist that shows a tick and drops the row is worse than one that
 * admits it is not wired up, because the visitor is gone either way and only one of those tells
 * you it happened.
 *
 * If a future change makes these two tests fail because the form now succeeds, the right fix is
 * to set the env var in the suite and assert the success path as well — not to relax the
 * honesty assertion.
 */

test.describe("/api/leads — the one route behind both forms", () => {
  test("refuses a body that is not a lead, with a message per field", async ({ request }) => {
    const res = await request.post("/api/leads", { data: { kind: "waitlist" } });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { problems: { field: string }[] };
    /* Field-level, so each message can sit against its own input rather than as one banner
       telling somebody to go and find the problem themselves. */
    expect(body.problems.map((p) => p.field).sort()).toEqual(["email", "name"]);
  });

  test("refuses an address that is not one", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: { kind: "waitlist", name: "Ada", email: "ada@nowhere" },
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { problems: { field: string }[] };
    expect(body.problems.map((p) => p.field)).toEqual(["email"]);
  });

  test("an enquiry needs a message, a waitlist entry does not", async ({ request }) => {
    const base = { name: "Ada", email: "ada@example.com" };
    const enquiry = await request.post("/api/leads", { data: { ...base, kind: "enquiry" } });
    expect(enquiry.status(), "an enquiry with no message was accepted").toBe(422);

    const waitlist = await request.post("/api/leads", { data: { ...base, kind: "waitlist" } });
    /* 503, not 422: the body was fine and there is simply nowhere configured to send it. The
       distinction is the whole point — one is the visitor's problem to fix, the other is ours. */
    expect(waitlist.status()).toBe(503);
    expect((await waitlist.json()).reason).toBe("unconfigured");
  });

  test("never reports success for a submission it did not deliver", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: { kind: "waitlist", name: "Ada Lovelace", email: "ada@example.com" },
    });
    expect(res.ok(), "a lead with no destination was reported as delivered").toBe(false);
    expect(res.status()).toBe(503);
  });

  test("swallows a honeypot submission and says nothing about it", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: {
        kind: "waitlist",
        name: "Ada",
        email: "ada@example.com",
        company_website: "http://spam.example",
      },
    });
    /* A plain 200 on purpose: a 4xx tells a scraper it was detected, which is information there
       is no reason to hand over. Nothing was forwarded. */
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test("rejects a malformed body and an oversized one", async ({ request }) => {
    /* A Buffer is sent as-is. Passing a STRING here does not test what it looks like it tests:
       Playwright serialises it, so `"not json at all"` arrives as a valid JSON string, parses
       cleanly, and the route answers 422 for a body that is well-formed and simply not a lead.
       That is correct behaviour and a different assertion. Raw bytes are the only way to
       exercise the parse failure. */
    const malformed = await request.post("/api/leads", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{ this is not json"),
    });
    expect(malformed.status()).toBe(400);

    const huge = await request.post("/api/leads", {
      data: { kind: "enquiry", name: "Ada", email: "ada@example.com", message: "x".repeat(20_000) },
    });
    expect(huge.status(), "a 20KB body was not refused before parsing").toBe(413);
  });
});

test.describe("/waitlist", () => {
  test("collects a lead and tells the truth when it cannot record one", async ({ page }) => {
    await gotoReady(page, "/waitlist");

    await expect(page.locator("h1")).toHaveCount(1);
    const form = page.locator("[data-lead-form]");
    await expect(form).toHaveCount(1);

    await page.fill("#lead-name", "Ada Lovelace");
    await page.fill("#lead-email", "ada@example.com");
    await page.getByRole("button", { name: /waitlist/i }).click();

    /* No destination configured, so the honest state — and it carries a real address rather
       than an apology. */
    const failed = page.locator('[data-lead-state="failed"]');
    await expect(failed).toBeVisible();
    await expect(failed.getByRole("link")).toHaveAttribute(
      "href",
      `mailto:${contactDetails.email}`,
    );

    /* And crucially: no success state anywhere. */
    await expect(page.locator('[data-lead-state="done"]')).toHaveCount(0);
  });

  test("puts a problem against the field it belongs to", async ({ page }) => {
    await gotoReady(page, "/waitlist");
    await page.fill("#lead-name", "Ada");
    await page.fill("#lead-email", "ada@nowhere");
    await page.getByRole("button", { name: /waitlist/i }).click();

    const email = page.locator("#lead-email");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    /* Described by its own message, so a screen reader reads the problem with the field rather
       than leaving it to be discovered. */
    await expect(email).toHaveAttribute("aria-describedby", "lead-email-problem");
    await expect(page.locator("#lead-email-problem")).toBeVisible();
  });

  test("keeps the honeypot away from every keyboard and screen reader", async ({ page }) => {
    await gotoReady(page, "/waitlist");
    const trap = page.locator("#company_website");
    await expect(trap).toHaveCount(1);
    await expect(trap).toHaveAttribute("tabindex", "-1");
    /* Off-screen rather than `display: none` — some bots skip hidden inputs and fill positioned
       ones — but hidden from assistive technology, which is what matters for a person. */
    await expect(trap).not.toBeInViewport();
    const hidden = await trap.evaluate((n) => n.closest("[aria-hidden='true']") !== null);
    expect(hidden, "the honeypot is reachable by a screen reader").toBe(true);
  });
});

test.describe("/contact", () => {
  test("offers the form and the address, and needs a message", async ({ page }) => {
    await gotoReady(page, "/contact");
    await expect(page.locator("h1")).toHaveCount(1);

    /* The address is printed as well as the form: somebody who will not use a form, or who
       wants to attach something, should not have to guess. */
    await expect(
      page.getByRole("link", { name: contactDetails.email }).first(),
    ).toHaveAttribute("href", `mailto:${contactDetails.email}`);

    await page.fill("#lead-name", "Ada");
    await page.fill("#lead-email", "ada@example.com");
    await page.getByRole("button", { name: /send/i }).click();

    const message = page.locator("#lead-message");
    await expect(message).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("/corporate", () => {
  test("dates every statistic it cites", async ({ page }) => {
    await gotoReady(page, "/corporate");

    /**
     * ⚠ THIS IS THE POINT OF THE PAGE HAVING A TEST AT ALL.
     *
     * The figures are the client's, from a 2018 investor deck, and their own sources are from
     * 2013–2015. A decade-old number printed bare reads as a current one — that is misleading
     * rather than persuasive, and it is the kind of thing that gets quietly "tidied up" into an
     * undated claim by a later hand who thinks the citation is clutter.
     *
     * So every stat must carry a source, and every source must carry a four-digit year.
     */
    for (const stat of corporate.stats) {
      const block = page.locator("dl > div", { hasText: stat.figure }).first();
      await expect(block, `${stat.figure} is not on the page`).toBeVisible();
      const text = (await block.innerText()).trim();
      expect(text, `the ${stat.figure} figure cites no source`).toContain(stat.source);
      expect(text, `the ${stat.figure} source carries no year`).toMatch(/\b(19|20)\d{2}\b/);
    }
  });

  test("ships no pricing, and sends an enquiry to the contact page", async ({ page }) => {
    await gotoReady(page, "/corporate");

    /* The deck describes a per-user fee plus installation and maintenance. That is a commercial
       decision the client has not published, and every figure on the old homepage was invented.
       "Sold per user and set up with you" is as specific as this page goes. */
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/[£$€]\s?\d/);
    expect(body.toLowerCase()).not.toContain("per month");
    expect(body.toLowerCase()).not.toContain("free trial");

    const cta = page.getByRole("link", { name: corporate.closeCta.label }).last();
    await expect(cta).toHaveAttribute("href", "/contact");
  });
});
