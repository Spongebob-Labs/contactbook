import { beforeEach, describe, expect, it } from "vitest";

import { saveLocalCardDraft, withLocalCardDraft } from "@/lib/card-local-draft";
import { cardLedgerDemo } from "@/fixtures/cards";

/**
 * The temporary store that holds the three slots the API has no column for.
 *
 * Its whole job is to be invisible when the API catches up, so the assertions that matter are
 * the ones about **not** taking over: the card's own value must win, and a storage failure must
 * degrade the card rather than break the screen.
 */
describe("the local card draft store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the three slots for one card", () => {
    saveLocalCardDraft(cardLedgerDemo.id, {
      coverUrl: "data:image/jpeg;base64,AAAA",
      headline: "Founder & CEO",
      bio: "Connecting people.",
    });

    const merged = withLocalCardDraft(cardLedgerDemo);
    expect(merged.coverUrl).toBe("data:image/jpeg;base64,AAAA");
    expect(merged.headline).toBe("Founder & CEO");
    expect(merged.bio).toBe("Connecting people.");
  });

  it("keys by card, so one card's cover never leaks onto another", () => {
    saveLocalCardDraft("card_a", { headline: "A" });
    expect(withLocalCardDraft({ ...cardLedgerDemo, id: "card_b" }).headline ?? null).toBeNull();
  });

  /**
   * ⚠ **The card's own value wins.** This is the property that makes the module safe to leave in
   * place while the backend catches up: the day the wire starts carrying `coverUrl`, the server
   * becomes the source of truth on its own and a stale local copy cannot override it.
   */
  it("never overrides a value the card already carries", () => {
    saveLocalCardDraft(cardLedgerDemo.id, { headline: "stale local", bio: "stale local" });

    const merged = withLocalCardDraft({
      ...cardLedgerDemo,
      headline: "from the server",
      bio: "from the server",
    });
    expect(merged.headline).toBe("from the server");
    expect(merged.bio).toBe("from the server");
  });

  /** Blank is "not set", so clearing a field removes it rather than storing an empty string. */
  it("treats a blank value as cleared", () => {
    saveLocalCardDraft(cardLedgerDemo.id, { headline: "Founder" });
    saveLocalCardDraft(cardLedgerDemo.id, { headline: "   " });
    expect(withLocalCardDraft(cardLedgerDemo).headline ?? null).toBeNull();
  });

  it("returns the same object when there is nothing stored", () => {
    /* Identity, not equality: a consumer memoising on the card object must not be defeated by a
       call that had nothing to add. */
    expect(withLocalCardDraft(cardLedgerDemo)).toBe(cardLedgerDemo);
  });

  /**
   * ⚠ A card renders without its cover; it never throws while rendering. `localStorage` throws
   * in a private window, with site data blocked, and on quota — and quota is reachable here
   * because a cover is a base64 image.
   */
  it("survives storage that throws on write and on read", () => {
    /* ⚠ The whole `localStorage` object is replaced, not spied through `Storage.prototype`.
       happy-dom defines the accessors on the instance, so a prototype spy never intercepts —
       the first version of this test passed the write half while the real storage quietly did
       the write, and then failed the read half for the wrong reason. */
    const real = window.localStorage;
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    Object.defineProperty(window, "localStorage", { value: throwing, configurable: true });

    expect(() => saveLocalCardDraft(cardLedgerDemo.id, { bio: "x" })).not.toThrow();
    expect(withLocalCardDraft(cardLedgerDemo)).toBe(cardLedgerDemo);

    Object.defineProperty(window, "localStorage", { value: real, configurable: true });
  });

  /** The stored string is user-writable — devtools, a stale build — so its shape is checked. */
  it("ignores a stored value of the wrong shape", () => {
    window.localStorage.setItem(`cb:card-draft:${cardLedgerDemo.id}`, '{"headline":42}');
    expect(withLocalCardDraft(cardLedgerDemo).headline ?? null).toBeNull();

    window.localStorage.setItem(`cb:card-draft:${cardLedgerDemo.id}`, "not json at all");
    expect(withLocalCardDraft(cardLedgerDemo)).toBe(cardLedgerDemo);
  });
});
