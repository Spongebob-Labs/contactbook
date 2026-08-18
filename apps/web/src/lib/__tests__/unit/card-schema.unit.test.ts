import { describe, expect, it } from "vitest";
import {
  CARD_SNAPSHOT_VERSION,
  cardSnapshotSchema,
  emptyCardSnapshot,
  parseCardSnapshot,
  reorderBlocks,
  visibleBlocks,
  visibleContactMethods,
  visibleSocials,
  type CardSnapshot,
} from "@/lib/card-schema";

function validSnapshot(): CardSnapshot {
  return {
    ...emptyCardSnapshot("Vansh Mehta"),
    contact: [
      { id: "c1", type: "email", label: "Work", value: "v@x.com", visible: true },
      { id: "c2", type: "phone", label: "", value: "+971500000000", visible: false },
    ],
    socials: [
      { id: "s1", platform: "linkedin", url: "https://l.in/v", visible: true },
    ],
    blocks: [
      {
        type: "link",
        id: "b1",
        label: "Portfolio",
        url: "https://x.com",
        description: "",
        visible: true,
      },
      { type: "heading", id: "b2", text: "Elsewhere", visible: false },
    ],
  };
}

describe("emptyCardSnapshot", () => {
  it("produces a snapshot that satisfies its own schema", () => {
    expect(cardSnapshotSchema.safeParse(emptyCardSnapshot("Vansh")).success).toBe(
      true,
    );
  });

  it("falls back to a placeholder rather than an invalid empty name", () => {
    expect(emptyCardSnapshot("   ").identity.displayName).toBe("Untitled card");
  });
});

describe("parseCardSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    const result = parseCardSnapshot(validSnapshot());
    expect(result.ok).toBe(true);
  });

  it("flags a newer version distinctly from corruption", () => {
    const result = parseCardSnapshot({
      ...validSnapshot(),
      v: CARD_SNAPSHOT_VERSION + 1,
    });
    expect(result).toMatchObject({ ok: false, reason: "unsupported-version" });
  });

  it("reports malformed data instead of throwing", () => {
    for (const bad of [null, undefined, 42, "nope", {}, { v: 1 }]) {
      expect(parseCardSnapshot(bad)).toMatchObject({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("rejects a non-hex theme colour", () => {
    const snapshot = validSnapshot();
    const result = parseCardSnapshot({
      ...snapshot,
      theme: { ...snapshot.theme, accent: "rebeccapurple" },
    });
    expect(result).toMatchObject({ ok: false, reason: "malformed" });
  });

  it("rejects an unknown block type rather than rendering it blank", () => {
    const snapshot = validSnapshot();
    const result = parseCardSnapshot({
      ...snapshot,
      blocks: [{ type: "spotify", id: "b9", visible: true }],
    });
    expect(result).toMatchObject({ ok: false, reason: "malformed" });
  });
});

describe("reorderBlocks", () => {
  const blocks = validSnapshot().blocks;
  const ids = (list: typeof blocks) => list.map((b) => b.id);

  it("moves a block down to the target position", () => {
    expect(ids(reorderBlocks(blocks, "b1", "b2"))).toEqual(["b2", "b1"]);
  });

  it("moves a block up to the target position", () => {
    expect(ids(reorderBlocks(blocks, "b2", "b1"))).toEqual(["b2", "b1"]);
  });

  it("preserves every block — a reorder must never drop one", () => {
    const next = reorderBlocks(blocks, "b1", "b2");
    expect(next).toHaveLength(blocks.length);
    expect([...ids(next)].sort()).toEqual([...ids(blocks)].sort());
  });

  it("does not mutate the input", () => {
    const before = ids(blocks);
    reorderBlocks(blocks, "b1", "b2");
    expect(ids(blocks)).toEqual(before);
  });

  it("is a no-op for an unknown or identical id", () => {
    expect(reorderBlocks(blocks, "b1", "nope")).toBe(blocks);
    expect(reorderBlocks(blocks, "nope", "b1")).toBe(blocks);
    expect(reorderBlocks(blocks, "b1", "b1")).toBe(blocks);
  });

  it("reorders correctly across a longer list", () => {
    const long = ["a", "b", "c", "d", "e"].map((id) => ({
      type: "heading" as const,
      id,
      text: id,
      visible: true,
    }));
    expect(ids(reorderBlocks(long, "a", "d"))).toEqual([
      "b",
      "c",
      "d",
      "a",
      "e",
    ]);
    expect(ids(reorderBlocks(long, "e", "b"))).toEqual([
      "a",
      "e",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("visibility helpers", () => {
  const snapshot = validSnapshot();

  it("keeps only visible entries, in author order", () => {
    expect(visibleContactMethods(snapshot).map((m) => m.id)).toEqual(["c1"]);
    expect(visibleSocials(snapshot).map((s) => s.id)).toEqual(["s1"]);
    expect(visibleBlocks(snapshot).map((b) => b.id)).toEqual(["b1"]);
  });
});
