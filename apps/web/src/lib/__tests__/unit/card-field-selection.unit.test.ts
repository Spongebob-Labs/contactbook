import { describe, expect, it, vi } from "vitest";
import {
  CARD_FIELD_SELECTION_KEY_PREFIX,
  cardFieldSelectionKey,
  clearAllCardFieldSelections,
  dropCardFieldSelection,
  readAllCardFieldSelections,
  readCardFieldSelection,
  writeCardFieldSelection,
} from "@/lib/card-field-selection";
import type { ShareableFieldType } from "@/lib/card-share-types";

const USER_A = "user-a";
const USER_B = "user-b";
const CARD = "card-1";

/** Lets a test store a shape the module's own writer would never produce. */
function seed(userId: string, raw: string): void {
  localStorage.setItem(cardFieldSelectionKey(userId), raw);
}

/** Unknown/removed field types only ever arrive as raw strings from storage. */
function asTypes(values: string[]): ShareableFieldType[] {
  return values as ShareableFieldType[];
}

describe("card field selection key", () => {
  it("scopes storage to a single user", () => {
    expect(cardFieldSelectionKey(USER_A)).toBe(
      `${CARD_FIELD_SELECTION_KEY_PREFIX}:${USER_A}`,
    );
    expect(cardFieldSelectionKey(USER_A)).not.toBe(cardFieldSelectionKey(USER_B));
  });
});

describe("round-trip", () => {
  it("reads back what it wrote", () => {
    writeCardFieldSelection(USER_A, CARD, ["PHONE", "EMAIL"]);
    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["PHONE", "EMAIL"]);
  });

  it("normalises to canonical SHAREABLE_FIELD_TYPES order", () => {
    writeCardFieldSelection(USER_A, CARD, ["COMPANY", "EMAIL", "PHONE", "PHOTO"]);
    expect(readCardFieldSelection(USER_A, CARD)).toEqual([
      "PHONE",
      "EMAIL",
      "PHOTO",
      "COMPANY",
    ]);
  });

  it("dedupes repeated types", () => {
    writeCardFieldSelection(USER_A, CARD, ["EMAIL", "PHONE", "EMAIL", "PHONE"]);
    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["PHONE", "EMAIL"]);
  });

  it("keeps several cards side by side under one user", () => {
    writeCardFieldSelection(USER_A, "card-1", ["PHONE"]);
    writeCardFieldSelection(USER_A, "card-2", ["EMAIL"]);
    expect(readAllCardFieldSelections(USER_A)).toEqual({
      "card-1": ["PHONE"],
      "card-2": ["EMAIL"],
    });
  });

  it("treats an empty selection as a stored value, not a missing one", () => {
    // Empty means "share everything mapped to the card" — an inverted default
    // that must survive the round-trip as [] rather than collapsing to undefined.
    writeCardFieldSelection(USER_A, CARD, []);
    const all = readAllCardFieldSelections(USER_A);
    expect(CARD in all).toBe(true);
    expect(all[CARD]).toEqual([]);
    expect(readCardFieldSelection(USER_A, CARD)).toEqual([]);
  });

  it("reports a never-written card as absent, while still reading []", () => {
    writeCardFieldSelection(USER_A, "card-1", ["PHONE"]);
    expect("card-2" in readAllCardFieldSelections(USER_A)).toBe(false);
    expect(readCardFieldSelection(USER_A, "card-2")).toEqual([]);
  });
});

describe("user isolation", () => {
  it("never lets one account read another's selections", () => {
    writeCardFieldSelection(USER_A, CARD, ["PHONE", "EMAIL"]);
    writeCardFieldSelection(USER_B, CARD, ["COMPANY"]);

    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["PHONE", "EMAIL"]);
    expect(readCardFieldSelection(USER_B, CARD)).toEqual(["COMPANY"]);
    expect(readAllCardFieldSelections(USER_B)).toEqual({ [CARD]: ["COMPANY"] });
  });

  it("leaves the other account untouched when one card is dropped", () => {
    writeCardFieldSelection(USER_A, CARD, ["PHONE"]);
    writeCardFieldSelection(USER_B, CARD, ["EMAIL"]);

    dropCardFieldSelection(USER_A, CARD);

    expect(readCardFieldSelection(USER_A, CARD)).toEqual([]);
    expect(readCardFieldSelection(USER_B, CARD)).toEqual(["EMAIL"]);
  });
});

describe("signed-out / unknown user", () => {
  it("no-ops on a null userId", () => {
    expect(() => writeCardFieldSelection(null, CARD, ["PHONE"])).not.toThrow();
    expect(readCardFieldSelection(null, CARD)).toEqual([]);
    expect(readAllCardFieldSelections(null)).toEqual({});
    expect(() => dropCardFieldSelection(null, CARD)).not.toThrow();
    expect(localStorage.length).toBe(0);
  });

  it("no-ops on a blank userId rather than writing a shared key", () => {
    writeCardFieldSelection("   ", CARD, ["PHONE"]);
    expect(readCardFieldSelection("   ", CARD)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});

describe("corrupt storage", () => {
  it("degrades to [] on non-JSON", () => {
    seed(USER_A, "not json at all");
    expect(readCardFieldSelection(USER_A, CARD)).toEqual([]);
    expect(readAllCardFieldSelections(USER_A)).toEqual({});
  });

  it("degrades to [] when the stored root is not an object map", () => {
    for (const raw of ['["PHONE"]', '"PHONE"', "42", "null", "true"]) {
      seed(USER_A, raw);
      expect(readCardFieldSelection(USER_A, CARD)).toEqual([]);
      expect(readAllCardFieldSelections(USER_A)).toEqual({});
    }
  });

  it("drops a card entry that is not an array but keeps its neighbours", () => {
    seed(USER_A, JSON.stringify({ "card-1": "PHONE", "card-2": ["EMAIL"] }));
    expect(readCardFieldSelection(USER_A, "card-1")).toEqual([]);
    expect(readAllCardFieldSelections(USER_A)).toEqual({ "card-2": ["EMAIL"] });
  });

  it("overwrites a corrupt blob instead of throwing on the next write", () => {
    seed(USER_A, "{{{");
    writeCardFieldSelection(USER_A, CARD, ["EMAIL"]);
    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["EMAIL"]);
  });
});

describe("unknown field types", () => {
  it("filters types a later deploy removed", () => {
    seed(
      USER_A,
      JSON.stringify({ [CARD]: ["PHONE", "BANK_ACCOUNT", "EMAIL", 7, null] }),
    );
    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["PHONE", "EMAIL"]);
  });

  it("refuses to persist a type the share API would reject", () => {
    writeCardFieldSelection(USER_A, CARD, asTypes(["PHONE", "TEXT"]));
    expect(readCardFieldSelection(USER_A, CARD)).toEqual(["PHONE"]);
  });
});

describe("clearing", () => {
  it("drops one card and leaves the rest of the user's map", () => {
    writeCardFieldSelection(USER_A, "card-1", ["PHONE"]);
    writeCardFieldSelection(USER_A, "card-2", ["EMAIL"]);

    dropCardFieldSelection(USER_A, "card-1");

    expect(readAllCardFieldSelections(USER_A)).toEqual({ "card-2": ["EMAIL"] });
  });

  it("removes every user's selections on logout, sparing unrelated keys", () => {
    writeCardFieldSelection(USER_A, CARD, ["PHONE"]);
    writeCardFieldSelection(USER_B, CARD, ["EMAIL"]);
    localStorage.setItem("contactbook:google-connected", "1");

    clearAllCardFieldSelections();

    expect(localStorage.getItem(cardFieldSelectionKey(USER_A))).toBeNull();
    expect(localStorage.getItem(cardFieldSelectionKey(USER_B))).toBeNull();
    expect(localStorage.getItem("contactbook:google-connected")).toBe("1");
  });
});

describe("blocked storage", () => {
  it("survives a SecurityError on read", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    expect(readCardFieldSelection(USER_A, CARD)).toEqual([]);
    expect(readAllCardFieldSelections(USER_A)).toEqual({});

    spy.mockRestore();
  });

  it("survives a SecurityError on write and clear", () => {
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    const removeSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    expect(() => writeCardFieldSelection(USER_A, CARD, ["PHONE"])).not.toThrow();
    expect(() => dropCardFieldSelection(USER_A, CARD)).not.toThrow();
    expect(() => clearAllCardFieldSelections()).not.toThrow();

    setSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
