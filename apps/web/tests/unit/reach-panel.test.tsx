import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";

import { ReachPanel } from "@/components/dashboard/reach-panel";
import type { DashboardTotals } from "@/lib/dashboard/metrics";
import { reachScore } from "@/lib/dashboard/reach-score";

const TOTALS: DashboardTotals = {
  cards: 2,
  contacts: 2,
  fields: 11,
  peopleReached: 2,
  totalOpens: 20,
  neverOpened: 0,
  behind: 3,
};

/** The live account on 2026-09-19 — the same case the score module pins. */
const LIVE = reachScore({
  cards: [
    { id: "c1", name: "My Card", fieldIds: Array.from({ length: 11 }, (_, i) => `f${i}`) },
    { id: "c2", name: "Untitled card", fieldIds: Array.from({ length: 11 }, (_, i) => `g${i}`) },
  ],
  links: [
    { cardId: "c1", contactId: "p1", status: "ACTIVE", viewCount: 12, createdAt: "2026-09-01" },
    { cardId: "c2", contactId: "p2", status: "ACTIVE", viewCount: 8, createdAt: "2026-09-01" },
  ],
  behind: 3,
});

describe("ReachPanel", () => {
  it("draws the score once, as a labelled figure rather than loose SVG text", () => {
    renderWithProviders(<ReachPanel score={LIVE} totals={TOTALS} />);

    /* One accessible name for the whole dial. Two <text> nodes read in document order would
       announce "55" and "REACH SCORE" as unrelated strings. */
    expect(screen.getByRole("img", { name: "Reach score 55 out of 100" })).toBeInTheDocument();
    expect(document.querySelector("[data-reach-dial]")).toHaveAttribute("data-reach-dial", "55");
  });

  it("turns the incomplete levers into links, biggest win first", () => {
    renderWithProviders(<ReachPanel score={LIVE} totals={TOTALS} />);

    const levers = [...document.querySelectorAll("[data-reach-lever]")];
    expect(levers.map((l) => l.getAttribute("data-reach-lever"))).toEqual([
      "told",
      "ready",
      "opened",
    ]);

    /* The two open ones are real links to real routes; the finished one is not a link. */
    const told = document.querySelector('a[data-reach-lever="told"]');
    expect(told).toHaveAttribute("href", "/cards");
    /* ⚠ Three, not the clamped two. The score arithmetic clamps `behind` into range so it
       cannot go negative, but the instruction the owner reads must match the attention list
       below it, which names three recipients across the two cards. */
    expect(told).toHaveTextContent("Tell 3 people their card changed");
    expect(told).toHaveTextContent("+30");

    expect(document.querySelector('a[data-reach-lever="opened"]')).toBeNull();
  });

  /**
   * ⚠ The project's floor: "Status is never carried by colour alone." A finished lever must be
   * distinguishable from an unfinished one with colour removed — so it changes to the past tense
   * and carries a tick, and this asserts the words rather than the class.
   */
  it("says a finished lever is finished, in words", () => {
    renderWithProviders(<ReachPanel score={LIVE} totals={TOTALS} />);

    const done = document.querySelector("[data-reach-lever-done]");
    expect(done).toHaveTextContent("Everyone you reached opened it");
    expect(done).toHaveTextContent("40 pts");
  });

  it("keeps every count that the five tiles used to carry", () => {
    renderWithProviders(<ReachPanel score={LIVE} totals={TOTALS} />);

    const strip = document.querySelector("[data-reach-counts]")!;
    for (const [label, value] of [
      ["Cards", "2"],
      ["People reached", "2"],
      ["Opens", "20"],
      ["Contacts", "2"],
    ]) {
      const term = within(strip as HTMLElement).getByText(label);
      expect(term.parentElement).toHaveTextContent(value);
    }
  });

  /**
   * ⚠ The single most likely way to make this worse than the tiles it replaced: rendering a
   * brand-new owner's empty account as a big red 0. They have not scored zero, they have not
   * played — so the dial draws no arc and the panel invites rather than grades.
   */
  it("invites a new owner instead of grading them zero", () => {
    const empty = reachScore({ cards: [], links: [], behind: null });
    renderWithProviders(
      <ReachPanel
        score={empty}
        totals={{ ...TOTALS, cards: 0, contacts: 0, peopleReached: 0, totalOpens: 0, behind: null }}
      />,
    );

    expect(screen.getByRole("img", { name: "No reach score yet" })).toBeInTheDocument();
    expect(screen.getByText(/Build a card to start/i)).toBeInTheDocument();
    /* No arc, and no lever links to press. */
    expect(document.querySelector("[data-reach-lever]")).toBeNull();
    expect(document.querySelector("[data-reach-dial]")).toHaveAttribute("data-reach-dial", "");
    expect(document.querySelector("[data-reach-dial]")).toHaveTextContent("\u2014");
  });

  it("congratulates rather than nags when nothing is outstanding", () => {
    const perfect = reachScore({
      cards: [{ id: "c1", name: "My Card", fieldIds: ["f1"] }],
      links: [
        { cardId: "c1", contactId: "p1", status: "ACTIVE", viewCount: 3, createdAt: "2026-09-01" },
      ],
      behind: 0,
    });

    renderWithProviders(<ReachPanel score={perfect} totals={{ ...TOTALS, behind: 0 }} />);

    expect(screen.getByText("Nothing is holding it back")).toBeInTheDocument();
    expect(document.querySelectorAll("a[data-reach-lever]")).toHaveLength(0);
  });
});
