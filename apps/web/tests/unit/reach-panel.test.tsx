import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";

import { ReachPanel } from "@/components/dashboard/reach-panel";
import type { DashboardResponseDto } from "@/lib/api/schema";
import {
  readDashboardSummary,
  type DashboardSummary,
  type DashboardTotals,
} from "@/lib/dashboard/metrics";
import { reachScore } from "@/lib/dashboard/reach-score";

const TOTALS: DashboardTotals = {
  cards: 2,
  contacts: 2,
  fields: 11,
  peopleReached: 2,
  peopleOpened: 2,
  totalOpens: 20,
  neverOpened: 0,
  behind: 3,
};

/**
 * An account as `GET /dashboard` returns it — the shape `reachScore` now consumes.
 *
 * ⚠ States its totals rather than reducing a link list into them: that reduction is the API's,
 * computed in one pass so the client cannot hold a divergent copy. See `reach-score.test.ts`.
 */
function dto(
  totals: DashboardTotals,
  cards: ReadonlyArray<{ id: string; name: string }>,
): DashboardSummary {
  return {
    totals,
    cardReach: cards.map((c) => ({
      cardId: c.id,
      cardName: c.name,
      opens: 0,
      recipients: 0,
    })),
    attention: [],
    sharingActivity: [],
    groups: [],
  };
}

/** The live account on 2026-09-19 — the same case the score module pins. */
const LIVE = reachScore(
  dto(TOTALS, [
    { id: "c1", name: "My Card" },
    { id: "c2", name: "Untitled card" },
  ]),
);

describe("ReachPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const empty = reachScore(
      dto(
        { ...TOTALS, cards: 0, contacts: 0, peopleReached: 0, peopleOpened: 0, totalOpens: 0, behind: null },
        [],
      ),
    );
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

  /* ── a lagging API must never put NaN on the page ──────────────────────────────────── */

  /** Everything React complained about during the test — its "Received NaN" warnings included. */
  const reactErrors = () => vi.spyOn(console, "error").mockImplementation(() => {});

  /**
   * ⚠ The reported bug, at the component. `?? ""` and `?? "—"` catch only `null`, so a `NaN`
   * score reached the DOM as `data-reach-dial="NaN"` and a "NaN" in the dial. Whatever produced
   * it, a score that is not a finite number is drawn as no score.
   */
  it("draws a non-finite score as no score, never as NaN", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const errors = reactErrors();
      const { unmount } = renderWithProviders(
        <ReachPanel score={{ ...LIVE, score: bad }} totals={TOTALS} />,
      );

      const dial = document.querySelector("[data-reach-dial]")!;
      expect(dial, String(bad)).toHaveAttribute("data-reach-dial", "");
      expect(dial, String(bad)).toHaveAttribute("aria-label", "No reach score yet");
      expect(dial, String(bad)).toHaveTextContent("\u2014");
      expect(dial.querySelector("[data-reach-dial-arc]"), String(bad)).toBeNull();
      expect(dial.outerHTML, String(bad)).not.toMatch(/NaN|Infinity/);
      expect(errors.mock.calls.flat().join(" "), String(bad)).not.toMatch(/NaN/);

      unmount();
      vi.restoreAllMocks();
    }
  });

  /**
   * End to end, from the payload staging actually returned on 2026-09-23 — every total except
   * `peopleOpened` — through the wire validator and the score, into the panel.
   */
  it("renders a dashboard from an API build without peopleOpened, with no NaN anywhere", () => {
    const errors = reactErrors();
    const stagingTotals: Record<string, unknown> = { ...TOTALS };
    delete stagingTotals.peopleOpened;
    const summary = readDashboardSummary({
      ...dto(TOTALS, [
        { id: "c1", name: "My Card" },
        { id: "c2", name: "Untitled card" },
      ]),
      totals: stagingTotals as unknown as DashboardResponseDto["totals"],
    });

    renderWithProviders(<ReachPanel score={reachScore(summary)} totals={summary.totals} />);

    const panel = document.querySelector("[data-reach-panel]")!;
    expect(panel.outerHTML).not.toMatch(/NaN|Infinity|undefined|null/);
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/NaN/);
    /* A real score from the levers that can be measured — told 0/2 + ready 1/2 at 50 each —
       and no "opened" action, because nobody knows who opened it. */
    expect(screen.getByRole("img", { name: "Reach score 25 out of 100" })).toBeInTheDocument();
    expect(document.querySelector('[data-reach-lever="opened"]')).toBeNull();
  });

  it("prints a dash — never 0 — for a count the API did not send", () => {
    renderWithProviders(<ReachPanel score={LIVE} totals={{ ...TOTALS, totalOpens: null }} />);

    const strip = document.querySelector("[data-reach-counts]") as HTMLElement;
    const opens = within(strip).getByText("Opens").parentElement!;
    expect(opens).toHaveTextContent("\u2014");
    expect(opens).toHaveTextContent("Not available");
    expect(opens).not.toHaveTextContent(/\d/);
  });

  it("congratulates rather than nags when nothing is outstanding", () => {
    const perfect = reachScore(
      dto({ ...TOTALS, cards: 1, peopleReached: 1, peopleOpened: 1, behind: 0 }, [
        { id: "c1", name: "My Card" },
      ]),
    );

    renderWithProviders(<ReachPanel score={perfect} totals={{ ...TOTALS, behind: 0 }} />);

    expect(screen.getByText("Nothing is holding it back")).toBeInTheDocument();
    expect(document.querySelectorAll("a[data-reach-lever]")).toHaveLength(0);
  });
});
