import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { withDemoFill } from "@/lib/card-demo-fill";
import { cardLedgerDemo } from "@/fixtures/cards";

describe("the demo fill", () => {
  it("fills a bio only when the card has none", () => {
    expect(withDemoFill({ ...cardLedgerDemo, bio: null }).bio).toBeTruthy();
    expect(withDemoFill({ ...cardLedgerDemo, bio: "  " }).bio).toBeTruthy();
  });

  it("never overwrites a bio the owner wrote", () => {
    expect(withDemoFill({ ...cardLedgerDemo, bio: "Mine." }).bio).toBe("Mine.");
  });

  /**
   * ⚠ `undefined`, not a string. `resolveHeadline` falls back to the first mapped `JOB_TITLE` —
   * a real value the owner typed — and any string here would win over it, replacing something
   * true with a placeholder.
   */
  it("leaves the headline undefined so the job-title fallback still wins", () => {
    expect(withDemoFill({ ...cardLedgerDemo, headline: null }).headline).toBeUndefined();
    expect(withDemoFill({ ...cardLedgerDemo, headline: "Founder" }).headline).toBe("Founder");
  });

  it("returns the same object when there is nothing to fill", () => {
    const complete = { ...cardLedgerDemo, headline: "Founder", bio: "Mine." };
    expect(withDemoFill(complete)).toBe(complete);
  });

  /**
   * ⚠ **THE GUARD THAT MATTERS.** This writes words the owner did not write. On their own
   * screens that is a replaceable placeholder; on a card they hand to somebody at an event it
   * would be a stranger reading an invented sentence as the owner's own.
   *
   * The public route is server-rendered and resolves through `parsePublicCard`, so the guard is
   * structural — but "structural" decays the moment somebody adds an import. This asserts the
   * absence directly, on the files, which is the only way to catch that.
   */
  it("is imported by no surface a recipient can open", () => {
    const forbidden = [
      "src/app/c/[slug]/page.tsx",
      "src/app/c/[slug]/public-card-client.tsx",
      "src/lib/api/public-card.ts",
      "src/components/public-card/public-card-view.tsx",
    ];

    for (const file of forbidden) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} must not import the demo fill`).not.toContain("card-demo-fill");
      /* The local draft store is browser-only and equally must not reach a server surface. */
      expect(source, `${file} must not import the local draft store`).not.toContain(
        "card-local-draft",
      );
    }
  });
});
