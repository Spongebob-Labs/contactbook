import { describe, expect, it, vi } from "vitest";
import {
  CARD_TOUR_SEEN_KEY_PREFIX,
  CARD_TOUR_STEPS,
  clearAllCardTourSeen,
  hasSeenCardTour,
  markCardTourSeen,
  type TourStep,
} from "@/lib/product-tour";

/** The DOM hooks the card page renders; the tour may target nothing else. */
const PINNED_SELECTORS = [
  '[data-tour="card-share"]',
  '[data-tour="card-tabs"]',
  '[data-tour="card-shared-fields"]',
  '[data-tour="card-vcard-preview"]',
];

/** Words that leak how the system works rather than what the user can do. */
const INTERNAL_VOCABULARY = [
  /\bv-?cards?\b/i,
  /\bvcf\b/i,
  /\bfield types?\b/i,
  /\bmapping\b/i,
  /\bmapped\b/i,
  /\btemplate\b/i,
  /\bapi\b/i,
  /\bendpoint\b/i,
  /\blocalstorage\b/i,
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe("card tour seen flag", () => {
  it("is unseen for a user who has never opened a card", () => {
    expect(hasSeenCardTour("user-1")).toBe(false);
  });

  it("is seen once marked", () => {
    markCardTourSeen("user-1");
    expect(hasSeenCardTour("user-1")).toBe(true);
  });

  it("stores under the user-scoped key so the flag survives a reload", () => {
    markCardTourSeen("user-1");
    expect(localStorage.getItem(`${CARD_TOUR_SEEN_KEY_PREFIX}:user-1`)).toBe(
      "1",
    );
  });

  it("keeps two users on a shared browser independent", () => {
    markCardTourSeen("user-1");
    expect(hasSeenCardTour("user-1")).toBe(true);
    expect(hasSeenCardTour("user-2")).toBe(false);
  });

  it("reports seen without a user id, because a tour we cannot remember dismissing would reopen on every render", () => {
    expect(hasSeenCardTour(null)).toBe(true);
    expect(hasSeenCardTour("")).toBe(true);
    expect(hasSeenCardTour("   ")).toBe(true);
  });

  it("marks nothing without a user id rather than writing an unscoped key", () => {
    markCardTourSeen(null);
    markCardTourSeen("");
    expect(localStorage.length).toBe(0);
  });

  it("treats a blocked read as seen instead of crashing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => hasSeenCardTour("user-1")).not.toThrow();
    expect(hasSeenCardTour("user-1")).toBe(true);
  });

  it("survives a blocked write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => markCardTourSeen("user-1")).not.toThrow();
  });

  it("treats an unexpected stored value as seen, so a corrupt flag never replays the tour", () => {
    localStorage.setItem(`${CARD_TOUR_SEEN_KEY_PREFIX}:user-1`, "{oops}");
    expect(hasSeenCardTour("user-1")).toBe(true);
  });

  it("clears every tour key and leaves unrelated keys alone", () => {
    markCardTourSeen("user-1");
    markCardTourSeen("user-2");
    localStorage.setItem("contactbook:google-connected", "1");

    clearAllCardTourSeen();

    expect(hasSeenCardTour("user-1")).toBe(false);
    expect(hasSeenCardTour("user-2")).toBe(false);
    expect(localStorage.getItem("contactbook:google-connected")).toBe("1");
  });
});

describe("card tour steps", () => {
  it("walks the four pinned hooks in order", () => {
    expect(CARD_TOUR_STEPS.map((step) => step.element)).toEqual(
      PINNED_SELECTORS,
    );
  });

  it("targets only pinned selectors, so a renamed hook cannot silently break the tour", () => {
    for (const step of CARD_TOUR_STEPS) {
      expect(PINNED_SELECTORS).toContain(step.element);
    }
  });

  it("keeps copy short so the tour cannot silently grow verbose", () => {
    for (const step of CARD_TOUR_STEPS) {
      expect(wordCount(step.title)).toBeLessThanOrEqual(5);
      expect(wordCount(step.description)).toBeLessThanOrEqual(20);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("speaks plain English, not internal vocabulary", () => {
    for (const step of CARD_TOUR_STEPS) {
      const copy = `${step.title} ${step.description}`;
      for (const pattern of INTERNAL_VOCABULARY) {
        expect(copy).not.toMatch(pattern);
      }
    }
  });

  it("cannot be mutated by a consumer", () => {
    const steps = CARD_TOUR_STEPS as unknown as TourStep[];
    expect(() => steps.push(steps[0])).toThrow();
    expect(() => {
      steps[0].title = "hacked";
    }).toThrow();
    expect(CARD_TOUR_STEPS).toHaveLength(4);
  });
});
