import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalJson,
  hasUnpublishedChanges,
  markCardPublished,
  markCardUnpublished,
  readCardDraft,
  removeCardDraft,
  snapshotFingerprint,
  writeCardDraft,
} from "@/lib/card-draft";
import { emptyCardSnapshot, type CardSnapshot } from "@/lib/card-schema";

function snapshotWithBlocks(): CardSnapshot {
  return {
    ...emptyCardSnapshot("Vansh"),
    blocks: [
      {
        type: "link",
        id: "a",
        label: "One",
        url: "https://one.com",
        description: "",
        visible: true,
      },
      {
        type: "link",
        id: "b",
        label: "Two",
        url: "https://two.com",
        description: "",
        visible: true,
      },
    ],
  };
}

describe("canonicalJson", () => {
  it("sorts object keys at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("preserves array order — position is meaning, not incidental", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("drops undefined values so optional keys do not shift the hash", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("handles null without treating it as an object", () => {
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
  });
});

describe("snapshotFingerprint", () => {
  it("ignores key insertion order", () => {
    const base = emptyCardSnapshot("Vansh");
    const reordered = {
      blocks: base.blocks,
      socials: base.socials,
      contact: base.contact,
      identity: base.identity,
      theme: base.theme,
      layout: base.layout,
      v: base.v,
    } as CardSnapshot;

    expect(snapshotFingerprint(reordered)).toBe(snapshotFingerprint(base));
  });

  it("changes when any value changes", () => {
    const base = emptyCardSnapshot("Vansh");
    const edited = {
      ...base,
      identity: { ...base.identity, title: "Designer" },
    };
    expect(snapshotFingerprint(edited)).not.toBe(snapshotFingerprint(base));
  });

  it("changes when blocks are reordered", () => {
    const base = snapshotWithBlocks();
    const swapped = { ...base, blocks: [base.blocks[1], base.blocks[0]] };
    expect(snapshotFingerprint(swapped)).not.toBe(snapshotFingerprint(base));
  });
});

describe("draft lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a draft", () => {
    const snapshot = emptyCardSnapshot("Vansh");
    expect(writeCardDraft("card-1", snapshot)).toBe(true);
    expect(readCardDraft("card-1")?.snapshot).toEqual(snapshot);
  });

  it("treats a never-published draft as having unpublished changes", () => {
    writeCardDraft("card-1", emptyCardSnapshot("Vansh"));
    expect(hasUnpublishedChanges(readCardDraft("card-1"))).toBe(true);
  });

  it("settles once published, and dirties again on the next edit", () => {
    const snapshot = emptyCardSnapshot("Vansh");
    markCardPublished("card-1", snapshot);
    expect(hasUnpublishedChanges(readCardDraft("card-1"))).toBe(false);

    writeCardDraft("card-1", {
      ...snapshot,
      identity: { ...snapshot.identity, title: "Designer" },
    });
    expect(hasUnpublishedChanges(readCardDraft("card-1"))).toBe(true);
  });

  it("keeps the published fingerprint across an unrelated edit and back", () => {
    const snapshot = emptyCardSnapshot("Vansh");
    markCardPublished("card-1", snapshot);

    writeCardDraft("card-1", {
      ...snapshot,
      identity: { ...snapshot.identity, title: "Designer" },
    });
    writeCardDraft("card-1", snapshot);

    // Editing and undoing should leave nothing to publish.
    expect(hasUnpublishedChanges(readCardDraft("card-1"))).toBe(false);
  });

  it("marks everything unpublished after taking a card offline", () => {
    const snapshot = emptyCardSnapshot("Vansh");
    markCardPublished("card-1", snapshot);
    markCardUnpublished("card-1");
    expect(hasUnpublishedChanges(readCardDraft("card-1"))).toBe(true);
  });

  it("keeps drafts isolated per card", () => {
    writeCardDraft("card-1", emptyCardSnapshot("One"));
    writeCardDraft("card-2", emptyCardSnapshot("Two"));
    expect(readCardDraft("card-1")?.snapshot.identity.displayName).toBe("One");
    expect(readCardDraft("card-2")?.snapshot.identity.displayName).toBe("Two");

    removeCardDraft("card-1");
    expect(readCardDraft("card-1")).toBeNull();
    expect(readCardDraft("card-2")).not.toBeNull();
  });

  it("reports no changes for a card with no draft at all", () => {
    expect(hasUnpublishedChanges(null)).toBe(false);
  });
});
