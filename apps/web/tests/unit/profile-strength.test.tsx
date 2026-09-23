import { describe, expect, it } from "vitest";

import { cleanup, renderWithProviders, screen, within } from "../helpers/render";

import {
  ProfileStrength,
  type ProfileGroupSummary,
} from "@/components/dashboard/profile-strength";

/**
 * The profile-strength tile.
 *
 * ⚠ **What this file is really guarding is the denominator**, not the markup. The tile reports a
 * ratio, and the failure mode for a ratio on a dashboard is not that it renders wrong — it is
 * that it renders *plausibly*: "62% complete" against a maximum nobody defined looks exactly like
 * a measured figure and cannot be told from one by looking. So the first test asserts what the
 * numbers mean, the last asserts the arithmetic survives an empty account, and both are written
 * against text the owner can read rather than against classes that change with the design.
 *
 * happy-dom has no layout engine, so nothing here asserts geometry (vitest.config.ts, spec
 * §14.6). Truncation is checked by the property that actually matters to a reader — that the full
 * name stays reachable — not by measuring a box that is a vacuous zero in this environment.
 */

/**
 * ⚠ `querySelector` returns the FIRST match, and `cleanup` only runs between tests — so a second
 * `render` inside one test appends a second tile and every assertion goes on reading the first.
 * That is a silently passing test, not a failing one, which is why `showing` tears the previous
 * render down rather than trusting the query to find the newest tile.
 */
const root = () => document.querySelector("[data-profile-strength]")!;
function showing(ui: Parameters<typeof renderWithProviders>[0]): Element {
  cleanup();
  renderWithProviders(ui);
  return root();
}
const groups = (...spec: [name: string, fieldCount: number][]): ProfileGroupSummary[] =>
  spec.map(([name, fieldCount], i) => ({ id: `g${i}`, name, fieldCount }));

/** Three of seven groups carrying something, twelve fields between them. */
const MIXED = groups(
  ["Contact", 4],
  ["Work", 0],
  ["Social", 5],
  ["Addresses", 0],
  ["Payment", 3],
  ["Documents", 0],
  ["Notes", 0],
);

describe("ProfileStrength", () => {
  /**
   * ⚠ THE ONE THIS COMPONENT EXISTS FOR.
   *
   * The ratio is **groups that carry a field, over groups that exist** — a true fraction of the
   * owner's own structure. It is not fields over a target, because no target exists: a profile
   * has no defined maximum number of fields, so every "N% complete" figure on this screen would
   * be a number the product made up. `fieldCount` is present as a plain total and must never
   * acquire a denominator.
   */
  it("reports groups filled over groups that exist, and invents no other denominator", () => {
    renderWithProviders(<ProfileStrength fieldCount={12} groups={MIXED} />);

    expect(root()).toHaveTextContent("3 of 7 groups filled");

    /* The field total is context, not progress: it is reported, never divided. */
    expect(root()).toHaveTextContent("12 fields in all");
    expect(root()).not.toHaveTextContent("of 12");

    /* No percentage anywhere in the copy. The meter's own width is a style, not a reading. */
    expect(root().textContent).not.toMatch(/%/);
  });

  it("counts a lone group in the singular", () => {
    expect(showing(<ProfileStrength fieldCount={2} groups={groups(["Contact", 2])} />)).toHaveTextContent(
      "1 of 1 group filled",
    );

    /* And the same group with nothing in it is a shortfall, not an error. */
    expect(showing(<ProfileStrength fieldCount={0} groups={groups(["Contact", 0])} />)).toHaveTextContent(
      "0 of 1 group filled",
    );
  });

  /**
   * The empty groups are the actionable half of the claim. "4 groups are empty" is a statistic;
   * "Work is empty" is a decision the owner can make, so every one of them is named and every
   * name is a link.
   */
  it("names every empty group and makes each name a way to act", () => {
    renderWithProviders(<ProfileStrength fieldCount={12} groups={MIXED} />);

    const list = root().querySelector("[data-profile-strength-empty]")!;
    const rows = [...list.querySelectorAll("li")];
    expect(rows.map((li) => within(li as HTMLElement).getByRole("link").textContent)).toEqual([
      "Work",
      "Addresses",
      "Documents",
      "Notes",
    ]);

    for (const li of rows) {
      const link = within(li as HTMLElement).getByRole("link");
      /* `/profile`, never `/profile/groups/<id>`: a synthetic section's id is not a real group id
         upstream and would land the owner on a not-found page. */
      expect(link).toHaveAttribute("href", "/profile");
      expect(li).toHaveTextContent("is empty");
    }

    /* The three that carry fields are not listed — the tile names what is missing, not what is
       already done. */
    for (const done of ["Contact", "Social", "Payment"]) {
      expect(within(list as HTMLElement).queryByText(done)).toBeNull();
    }
  });

  /**
   * ⚠ A name long enough to ellipse must still be readable, and happy-dom cannot tell us whether
   * it ellipsed. What it can tell us is the property that makes truncation safe: the full string
   * is still on the element, so a reader who sees "Professional creden…" can recover the rest.
   */
  it("keeps a long group name reachable once it truncates", () => {
    const long = "Professional credentials and certifications";
    renderWithProviders(<ProfileStrength fieldCount={1} groups={groups(["Contact", 1], [long, 0])} />);

    expect(screen.getByRole("link", { name: long })).toHaveAttribute("title", long);
  });

  /**
   * ⚠ A finished profile is congratulated and then left alone. The tempting addition — "add
   * another group to get further" — makes the meter unwinnable, because the denominator is the
   * owner's own structure and inviting them to grow it guarantees the tile is never full.
   */
  it("congratulates a complete profile instead of nagging it", () => {
    renderWithProviders(
      <ProfileStrength fieldCount={9} groups={groups(["Contact", 4], ["Work", 3], ["Social", 2])} />,
    );

    expect(root()).toHaveTextContent("3 of 3 groups filled");
    expect(screen.getByText(/Nothing here is waiting on you/)).toBeInTheDocument();

    /* Nothing is named as outstanding, because nothing is. */
    expect(root().querySelector("[data-profile-strength-empty]")).toBeNull();
    expect(root()).not.toHaveTextContent("is empty");

    /* Still a door, just not an instruction. */
    expect(screen.getByRole("link", { name: "Open your profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  /**
   * ⚠ `0 / 0` is `NaN`, and a `NaN` width is not an error anywhere in the stack: React writes
   * `width: NaN%`, the browser drops the declaration, and the meter renders as an empty track
   * that is indistinguishable from the legitimate zero state. A brand-new account is the most
   * common way this tile is first seen, so its only arithmetic edge is the one every new owner
   * would hit.
   */
  it("does not divide by zero when the profile has no groups", () => {
    renderWithProviders(<ProfileStrength fieldCount={0} groups={[]} />);

    expect(root().textContent).not.toMatch(/NaN|Infinity|undefined/);
    expect(root()).toHaveTextContent("No groups yet");

    const fill = root().querySelector("[data-profile-strength-fill]") as HTMLElement;
    expect(fill.style.width).toBe("0%");

    /* Invited, not graded — and there is still something to press. */
    expect(screen.getByRole("link", { name: "Open your profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  /**
   * `fieldCount` comes from `GET /dashboard`'s totals, and a deployed API that lags the DTO can
   * omit a count — which `readDashboardTotals` reads as `null`. The tile then says nothing about
   * the total rather than "0 fields" (a false measurement) or "null fields" (a leak).
   */
  it("leaves the field total out when the API did not send one", () => {
    renderWithProviders(<ProfileStrength fieldCount={null} groups={MIXED} />);

    expect(root().querySelector("[data-profile-strength-fields]")).toBeNull();
    expect(root().textContent).not.toMatch(/NaN|null|undefined|\bfields? in all/);
    /* The group ratio does not depend on the total, so it still stands. */
    expect(root()).toHaveTextContent("3 of 7 groups filled");
  });

  /**
   * ⚠ The project floor: status is never carried by colour alone. The meter's fill is the second
   * encoding and the weakest one — at zero filled groups it has no width at all, so "not started"
   * and "failed to render" look identical. The word is the first encoding, and it is asserted as
   * text so the claim survives greyscale, monochrome and every form of colour blindness.
   */
  it("says the meter's state in a word, not only in the fill", () => {
    const read = (el: Element) => [
      el.querySelector("[data-profile-strength-meter]")!.getAttribute("data-profile-strength-meter"),
      el.querySelector("[data-profile-strength-word]")!.textContent,
    ];

    expect(read(showing(<ProfileStrength fieldCount={0} groups={[]} />))).toEqual([
      "no-groups",
      "Empty",
    ]);
    expect(
      read(showing(<ProfileStrength fieldCount={0} groups={groups(["Work", 0], ["Social", 0])} />)),
    ).toEqual(["not-started", "Not started"]);
    expect(
      read(showing(<ProfileStrength fieldCount={3} groups={groups(["Work", 3], ["Social", 0])} />)),
    ).toEqual(["in-progress", "In progress"]);
    expect(read(showing(<ProfileStrength fieldCount={3} groups={groups(["Work", 3])} />))).toEqual([
      "complete",
      "Complete",
    ]);
  });

  /**
   * The fill tracks the ratio and nothing else — in particular not `fieldCount`, which would make
   * a profile with many fields in one group look fuller than the sentence beside it claims.
   */
  it("fills the meter from the group ratio, never from the field total", () => {
    renderWithProviders(<ProfileStrength fieldCount={400} groups={MIXED} />);
    const fill = root().querySelector("[data-profile-strength-fill]") as HTMLElement;
    expect(fill.style.width).toBe("43%"); // 3/7, rounded — not a function of 400 fields
  });
});
