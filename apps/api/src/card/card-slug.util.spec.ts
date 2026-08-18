import {
  buildCardSlug,
  randomSlugSuffix,
  slugifyVanity,
} from "./card-slug.util";

describe("slugifyVanity", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyVanity("Vansh Work Card")).toBe("vansh-work-card");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyVanity("Vansh's  Work / Card!!")).toBe("vansh-s-work-card");
  });

  it("folds accents rather than dropping the whole word", () => {
    expect(slugifyVanity("Café Zürich")).toBe("cafe-zurich");
  });

  it("never returns an empty or edge-hyphenated slug", () => {
    expect(slugifyVanity("!!!")).toBe("card");
    expect(slugifyVanity("   ")).toBe("card");
    expect(slugifyVanity("--hi--")).toBe("hi");
  });

  it("truncates long names without leaving a trailing hyphen", () => {
    const slug = slugifyVanity(`${"a".repeat(30)} ${"b".repeat(30)}`);
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("randomSlugSuffix", () => {
  it("uses the requested length and the unambiguous alphabet only", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(randomSlugSuffix()).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
    }
  });

  it("honours an explicit length", () => {
    expect(randomSlugSuffix(4)).toHaveLength(4);
    expect(randomSlugSuffix(16)).toHaveLength(16);
  });

  it("excludes characters that are ambiguous when read aloud", () => {
    const sample = Array.from({ length: 500 }, () => randomSlugSuffix()).join("");
    for (const ambiguous of ["0", "1", "i", "l", "o"]) {
      expect(sample).not.toContain(ambiguous);
    }
  });

  it("does not repeat — this is the whole point of the suffix", () => {
    const seen = new Set(
      Array.from({ length: 2000 }, () => randomSlugSuffix()),
    );
    expect(seen.size).toBe(2000);
  });
});

describe("buildCardSlug", () => {
  it("joins vanity and entropy", () => {
    expect(buildCardSlug("Work Card")).toMatch(/^work-card-[2-9a-hjkmnp-z]{8}$/);
  });

  it("stays within the pattern the public route accepts", () => {
    expect(buildCardSlug("Vansh's Work / Card")).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  it("produces a different slug for the same name every time", () => {
    expect(buildCardSlug("Work")).not.toBe(buildCardSlug("Work"));
  });
});
