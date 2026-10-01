import { describe, expect, it } from "vitest";

import { mostRecentlySharedCardId } from "@/app/(app)/share/quick-share-client";

/**
 * `/share`'s default card: the one this owner sent most recently, else none (the form then
 * selects the first card). Someone sending the same card to person after person at an event
 * should not have to re-pick it every time.
 */
describe("the quick share's default card", () => {
  const cards = new Set(["work", "personal"]);

  it("is the card on the newest link", () => {
    expect(
      mostRecentlySharedCardId(
        [
          { cardId: "work", createdAt: "2026-09-01T10:00:00.000Z" },
          { cardId: "personal", createdAt: "2026-09-20T10:00:00.000Z" },
          { cardId: "work", createdAt: "2026-09-10T10:00:00.000Z" },
        ],
        cards,
      ),
    ).toBe("personal");
  });

  it("ignores a link whose card is no longer listed (archived)", () => {
    expect(
      mostRecentlySharedCardId(
        [
          { cardId: "archived", createdAt: "2026-09-27T10:00:00.000Z" },
          { cardId: "work", createdAt: "2026-09-01T10:00:00.000Z" },
        ],
        cards,
      ),
    ).toBe("work");
  });

  it("is undefined when nothing has been sent", () => {
    expect(mostRecentlySharedCardId([], cards)).toBeUndefined();
  });
});
