import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "../helpers/render";
import { FieldPicker } from "@/components/builder/field-picker";
import { PanelHead } from "@/components/builder/panel-head";
import { buildFieldRows } from "@/components/builder/field-rows";
import { ALL_OFFERS, FIELD_CATALOGUE } from "@/components/builder/field-catalogue";
import { FIXTURE_DB } from "@/fixtures";

/**
 * **The Fields panel — one ticked list, and a composer that is closed until it is asked for.**
 *
 * Fourth layout, fourth version of this file. It replaces the suite for the two-column build,
 * which replaced the one for a modal. Every rejection has been about one of two rules, and both
 * are asserted here rather than described:
 *
 *   1. **Tapping a field must change only that row, in place.**
 *   2. **Nothing on this panel may cost attention unless it is the work.** New with this build —
 *      the client's *"still quite noisy. I would remove the kind and the value. Also remove the
 *      search bar."*
 *
 * See `field-picker.tsx` for the measurements behind both.
 */

const rows = buildFieldRows(FIXTURE_DB.groups, FIXTURE_DB.fields);
const editable = rows.find((row) => row.editable)!;

function setup(
  selected: readonly string[] = [],
  opts: { onCreateField?: () => Promise<null> } = {},
) {
  const onToggle = vi.fn();
  const onEditValue = vi.fn();
  const view = renderWithProviders(
    <FieldPicker
      groups={FIXTURE_DB.groups}
      fields={FIXTURE_DB.fields}
      selected={selected}
      onToggle={onToggle}
      onEditValue={onEditValue}
      onCreateField={opts.onCreateField as never}
    />,
  );
  return { onToggle, onEditValue, ...view };
}

/** Open the composer and hand back its form. */
/** Open the composer. Leaves it on step 1 — the category and offer chooser. */
async function openComposer(container: HTMLElement) {
  await userEvent.click(container.querySelector("[data-field-new-open]")!);
  return container.querySelector("[data-field-choose]") as HTMLElement;
}

/**
 * Open it and walk to step 2 by choosing a category and an offer, exactly as an owner does.
 *
 * Driving the real chips rather than reaching into state is the point: an offer that is listed
 * in the catalogue but never wired to the value step fails here.
 */
async function chooseOffer(container: HTMLElement, category: string, offerId: string) {
  await userEvent.click(container.querySelector("[data-field-new-open]")!);
  await userEvent.click(container.querySelector(`[data-field-category="${category}"]`)!);
  await userEvent.click(container.querySelector(`[data-field-offer="${offerId}"]`)!);
  return container.querySelector("[data-create-field-form]") as HTMLElement;
}

describe("the fields panel", () => {
  it("has a profile big enough for these assertions to mean something", () => {
    /* A guard on the fixture, not the component: several tests below are vacuous on a tiny
       profile, and a silently vacuous suite is worse than no suite. */
    expect(rows.length).toBeGreaterThan(9);
  });

  /**
   * ⚠ THE RULE. Every previous layout broke it, so it is asserted on positions rather than on
   * "it rendered": the row's index in the list must be identical ticked and unticked.
   */
  it("does not move a row when it is ticked", () => {
    const order = () =>
      [...document.querySelectorAll("[data-field-row]")].map((n) =>
        n.getAttribute("data-field-row"),
      );

    const { unmount } = setup([]);
    const before = order();
    unmount();

    setup([editable.field.id]);
    expect(order(), "ticking a field re-sorted the list").toEqual(before);
  });

  it("shows every profile field once, ticked or not — no second list", () => {
    const { container } = setup([editable.field.id]);

    /* One row per field. The old layout printed on-card fields twice: once in its own list and
       once in the offer column. */
    expect(container.querySelectorAll("[data-field-row]").length).toBe(rows.length);
    expect(
      container.querySelectorAll(`[data-field-row="${editable.field.id}"]`).length,
      "a field on the card appears in two places",
    ).toBe(1);
  });

  /** The one scroll container is the panel's. This list must not add a second. */
  it("adds no nested scroll container", () => {
    const { container } = setup();
    const scrollers = [...container.querySelectorAll("*")].filter((n) =>
      /overflow-y-auto|overflow-auto|overflow-scroll/.test(n.className?.toString() ?? ""),
    );
    expect(scrollers.map((n) => n.getAttribute("data-field-list") ?? n.tagName)).toEqual([]);
  });

  it("reports a tick to the caller, which is what renders it on the card", async () => {
    const { onToggle } = setup([]);
    await userEvent.click(
      screen.getByRole("checkbox", { name: new RegExp(editable.field.label, "i") }),
    );
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(editable.field.id, true);
  });

  it("reports an untick too", async () => {
    const { onToggle } = setup([editable.field.id]);
    await userEvent.click(
      screen.getByRole("checkbox", { name: new RegExp(editable.field.label, "i") }),
    );
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(editable.field.id, false);
  });

  /**
   * The height saving, and the reason the panel now fits: an unticked row is a line of text,
   * not a form. 35 inputs is what made the old rows ~105px tall.
   */
  it("gives a value editor only to ticked rows", () => {
    const { container, unmount } = setup([]);
    expect(container.querySelector(`[data-field-row-input="${editable.field.id}"]`)).toBeNull();
    unmount();

    const next = setup([editable.field.id]);
    expect(
      next.container.querySelector(`[data-field-row-input="${editable.field.id}"]`),
    ).not.toBeNull();
  });

  it("edits a value live, with no per-row commit", async () => {
    const { onEditValue, container } = setup([editable.field.id]);
    const input = container.querySelector(
      `[data-field-row-input="${editable.field.id}"]`,
    ) as HTMLInputElement;

    await userEvent.type(input, "x");

    expect(onEditValue).toHaveBeenCalled();
    expect(
      within(container.querySelector(`[data-field-row="${editable.field.id}"]`)!).queryByRole(
        "button",
        { name: /save|apply|done/i },
      ),
      "a per-row commit button appeared — the value belongs to the profile, not this card",
    ).toBeNull();
  });

  it("groups the list under the profile's own category names", () => {
    const { container } = setup();
    expect(container.querySelectorAll("[data-field-group]").length).toBeGreaterThan(1);
  });

  /**
   * ⚠ The group labels are `<h3>`s under the panel head's `sr-only` `<h2>`, so the outline runs
   * 1 → 2 → 3. They were `<h4>`s under a column heading that no longer exists, which would leave
   * the document skipping a level — the thing axe's `heading-order` rule fails on.
   */
  it("labels each group with an h3, so the outline skips no level", () => {
    const { container } = setup();
    const headings = [...container.querySelectorAll("[data-field-group] > *:first-child")];
    expect(headings.length).toBeGreaterThan(1);
    expect([...new Set(headings.map((n) => n.tagName))]).toEqual(["H3"]);
    expect(container.querySelectorAll("h4").length, "an h4 survived the head's removal").toBe(0);
  });

  /* ── rule 2: the resting panel is a list and nothing else ─────────────────────── */

  /**
   * ⚠ **NO SEARCH BOX.** Client, 2026-09-07: *"remove the search bar (won't be too many
   * fields)"*. It was the heaviest object in the column and it sat above the list it filtered.
   */
  it("has no search box, at any profile size", () => {
    const { container } = setup();
    expect(container.querySelector("[data-field-search]")).toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  /**
   * ⚠ **THE COMPOSER IS CLOSED, SO AT REST THE ONLY INPUTS ARE THE TICKED ROWS' OWN.**
   *
   * This is the assertion the noise complaint turns into: with a field ticked, the panel holds
   * exactly one input — that row's value — and no form, no select and no second submit.
   */
  it("opens with no form on it — the composer is closed", () => {
    const { container } = setup([editable.field.id], {
      onCreateField: () => Promise.resolve(null),
    });

    expect(container.querySelector("[data-create-field-form]")).toBeNull();
    expect(container.querySelectorAll("form").length).toBe(0);
    expect(container.querySelectorAll('button[type="submit"]').length).toBe(0);
    expect(container.querySelectorAll("select, [role='combobox']").length).toBe(0);

    const inputs = [...container.querySelectorAll("input:not([type='checkbox'])")];
    expect(inputs.map((n) => n.getAttribute("data-field-row-input"))).toEqual([
      editable.field.id,
    ]);
  });

  /**
   * ⚠ **THE HEAD IS NOT IN HERE.** It is the card's *name*, rendered once by
   * `builder-client.tsx` above the tab panels — the same string on both tabs, so a copy inside
   * each panel would unmount and remount on every tab switch and drop the caret mid-rename.
   */
  it("renders no panel head of its own", () => {
    const { container } = setup();
    expect(container.querySelector("[data-panel-head]")).toBeNull();
    expect(container.querySelector("[data-builder-name]")).toBeNull();
    expect(container.querySelectorAll("h2").length).toBe(0);
  });

  /** The one sentence that left the intro when the head became the card's name. */
  it("keeps the shared-value consequence as a footnote under the list", () => {
    const { container } = setup();
    const note = container.querySelector("[data-field-picker-note]");
    expect(note?.textContent).toMatch(/every card that uses it/i);
    /* After the list, not before it — it is about the values, not an instruction for picking. */
    expect(
      container
        .querySelector("[data-field-list-card]")!
        .compareDocumentPosition(note!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /* ── the composer ─────────────────────────────────────────────────────────────── */

  /**
   * ⚠ **ANCHORED TO THE TOP OF THE LIST, NOT THE END OF IT.** Its distance from the reader may
   * not grow with the field count — the defect the client reported twice: *"the user will be
   * scrolling up and up… he has to scroll down and go on to the new field."*
   */
  it("puts the composer row above the fields, not below them", () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });

    const composer = container.querySelector("[data-field-new]")!;
    const list = container.querySelector("[data-field-list]")!;
    expect(composer, "there is no way to author a field").not.toBeNull();
    expect(
      composer.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the composer renders after the list — it would be a scroll away on a long profile",
    ).toBeTruthy();
  });

  it("opens and closes from one control, wired to aria-expanded", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    const toggle = () => container.querySelector("[data-field-new-open]")!;

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    /* ⚠ Open lands on the CHOOSER, not on a form. The composer used to open straight onto
       `[ Kind ▾ ] [ value ] [ Add ]`; it now asks where the field goes first. */
    expect(container.querySelector("[data-field-choose]")).not.toBeNull();
    expect(container.querySelector("[data-create-field-form]")).toBeNull();

    await userEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-field-choose]")).toBeNull();
  });

  /**
   * ⚠ **THE CATEGORY IS CHOSEN, AND IT REACHES THE CREATE CALL.**
   *
   * This is the whole redesign in one assertion. The composer used to send a type and let
   * `builder-client.tsx` guess the category from it, so every `PHONE` became `PERSONAL` and a
   * work mobile landed in the wrong section of the card. A guess reinstated anywhere fails here.
   */
  it("sends the category the owner picked, not one inferred from the type", async () => {
    const onCreateField = vi.fn(() => Promise.resolve({ fieldId: "f1", category: "WORK" }));
    const { container } = setup([], { onCreateField: onCreateField as never });

    await chooseOffer(container, "WORK", "work-mobile");
    await userEvent.type(
      container.querySelector("[data-create-field-value]")!,
      "+91 98201 15577",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onCreateField).toHaveBeenCalledWith({
      type: "PHONE",
      label: "Work mobile",
      value: "+91 98201 15577",
      /* A PHONE filed under WORK — the exact pair the deleted guess table could not express. */
      category: "WORK",
    });
  });

  /** Six chips, exactly one chosen, typed as a radio group so arrow keys and "2 of 6" are free. */
  it("offers the categories as a radiogroup with exactly one chosen", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    await openComposer(container);

    const chips = [...container.querySelectorAll("[data-field-category]")];
    expect(chips.length).toBe(FIELD_CATALOGUE.length);
    expect(chips.filter((c) => c.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByRole("radiogroup", { name: /field category/i })).toBeInTheDocument();
  });

  /** Choosing a category swaps the offers beneath it, and nothing else moves. */
  it("shows only the chosen category's offers", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    await openComposer(container);

    const shown = () =>
      [...container.querySelectorAll("[data-field-offer]")].map((e) =>
        e.getAttribute("data-field-offer"),
      );

    expect(shown()).toEqual(FIELD_CATALOGUE[0].offers.map((o) => o.id));

    await userEvent.click(container.querySelector('[data-field-category="SOCIAL"]')!);
    expect(shown()).toEqual(
      FIELD_CATALOGUE.find((s) => s.category === "SOCIAL")!.offers.map((o) => o.id),
    );
    expect(shown(), "the social section must offer LinkedIn by name").toContain("linkedin");
  });

  /**
   * ⚠ **THE LABELS ARE OFF THE SCREEN, NOT OUT OF THE ACCESSIBILITY TREE.**
   *
   * "Remove the kind and the value" is about printed form labels on a panel whose subject is
   * picking fields. AC-25 sweeps every route with axe and an unlabelled control is a serious
   * violation, so `hideLabel` is the mechanism: the names survive, the ink does not.
   */
  it("asks for a value with no printed labels", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    const form = await chooseOffer(container, "PERSONAL", "mobile");

    /* Named, and reachable by that name — the offer's own label is the control's name now. */
    expect(within(form).getByLabelText(/mobile/i)).toBeInTheDocument();

    /* But nothing prints it: every label in the composer is screen-reader-only. */
    const visibleLabels = [...form.querySelectorAll("label")].filter(
      (label) => !label.className.includes("sr-only"),
    );
    expect(
      visibleLabels.map((label) => label.textContent),
      "a printed form label came back onto the panel",
    ).toEqual([]);

    /* Exactly one text input. A reinstated "Label" box would fail here. */
    expect(form.querySelectorAll("input:not([type='hidden'])").length).toBe(1);
  });

  it("refuses a blank value locally rather than round-tripping to be told", async () => {
    const onCreateField = vi.fn(() => Promise.resolve(null));
    const { container } = setup([], { onCreateField: onCreateField as never });
    await chooseOffer(container, "PERSONAL", "mobile");

    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onCreateField, "a blank value reached the API").not.toHaveBeenCalled();
    expect(container.querySelector("[data-create-field-form]")?.textContent).toMatch(
      /enter a value/i,
    );
  });

  /**
   * ⚠ THE VALUE BOX MUST SAY WHAT GOES IN IT, FOR THE OFFER THAT WAS CHOSEN — and with the label
   * hidden this is the *only* thing that says it, which promotes the placeholder from a nicety
   * to the control's name in ink.
   *
   * It is also where the catalogue earns its keep: LinkedIn and "Other profile" are the same
   * `FieldType` and must not share a placeholder, because the whole reason they are two offers
   * is that `linkedin.com/in/…` is a question an owner can answer without thinking.
   */
  it("shows the chosen offer's own example, even between offers of one type", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    const value = () => container.querySelector("[data-create-field-value]") as HTMLInputElement;

    await chooseOffer(container, "SOCIAL", "linkedin");
    expect(value().placeholder).toMatch(/linkedin\.com/i);
    expect(value().inputMode).toBe("url");

    await userEvent.click(container.querySelector("[data-field-offer-back]")!);
    await userEvent.click(container.querySelector('[data-field-offer="github"]')!);
    expect(
      value().placeholder,
      "the value box kept LinkedIn's example after a different offer of the same type",
    ).toMatch(/github\.com/i);
  });

  /**
   * Every offer needs an example and a unique id. The ids are React keys and test handles, and a
   * duplicate would silently make one offer unreachable.
   */
  it("has a non-empty example and a unique id for every offer it lists", () => {
    const ids = ALL_OFFERS.map((offer) => offer.id);
    expect(new Set(ids).size, `duplicate offer ids: ${ids.join(", ")}`).toBe(ids.length);

    const blank = ALL_OFFERS.filter((offer) => offer.placeholder.trim() === "");
    expect(blank.map((o) => o.id), "offers with no example value").toEqual([]);
  });

  /**
   * ⚠ `inputMode`, never `type="email"` / `type="url"`. Those bring native constraint
   * validation, which would block a submit this form validates itself — and the two disagree:
   * the form's rule is "not blank", the browser's is a full grammar.
   */
  it("uses inputMode for the keyboard, not a validating input type", async () => {
    const { container } = setup([], { onCreateField: () => Promise.resolve(null) });
    await chooseOffer(container, "PERSONAL", "personal-email");
    const value = container.querySelector("[data-create-field-value]") as HTMLInputElement;
    expect(["text", "tel", "search"], `value input is type=${value.type}`).toContain(value.type);
    expect(value.inputMode).toBe("email");
  });

  /** After a successful add the composer returns to the chooser, category intact. */
  it("returns to the chooser after an add, keeping the category", async () => {
    const onCreateField = vi.fn(() => Promise.resolve({ fieldId: "f1", category: "SOCIAL" }));
    const { container } = setup([], { onCreateField: onCreateField as never });

    await chooseOffer(container, "SOCIAL", "linkedin");
    await userEvent.type(
      container.querySelector("[data-create-field-value]")!,
      "linkedin.com/in/maya",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    /* ⚠ `waitFor`: the return to step 1 happens in the `.then` of the create promise, one
       microtask after the click resolves. Asserting synchronously reads the DOM before React
       has re-rendered — green or red depending on scheduling, which is worse than red. */
    await waitFor(() =>
      expect(container.querySelector("[data-field-choose]")).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-field-category="SOCIAL"]')?.getAttribute("aria-checked"),
      "the owner was thrown back to Personal after adding a social link",
    ).toBe("true");
  });

  it("omits the composer entirely when there is no API to write to", () => {
    const { container } = setup();
    expect(
      container.querySelector("[data-field-new]"),
      "a surface with no create handler must not offer to author a field",
    ).toBeNull();
  });
});

/**
 * **The panel's head — the card's name, and the section as an `sr-only` heading.**
 *
 * Covered here rather than in its own file because it is the other half of the same client
 * note: *"make the title of the card more prominent — perhaps where 'Fields' is, we can put the
 * title of the card. Then simply 'Choose the fields for your card'."*
 */
describe("the panel head", () => {
  function head(name = "Untitled card") {
    const onRename = vi.fn();
    const view = renderWithProviders(
      <PanelHead
        section="Fields"
        name={name}
        onRename={onRename}
        intro="Choose the fields for your card."
      />,
    );
    return { onRename, ...view };
  }

  it("titles the panel with the card's name, editable in place", async () => {
    const { onRename, container } = head();
    const input = container.querySelector("[data-builder-name]") as HTMLInputElement;

    expect(input, "the head has no card-name input").not.toBeNull();
    expect(input.value).toBe("Untitled card");
    expect(input, "the name must be reachable by its accessible name").toBe(
      screen.getByLabelText(/card name/i),
    );

    await userEvent.type(input, "!");
    expect(onRename).toHaveBeenCalled();
  });

  /**
   * ⚠ The section keeps the `<h2>` so the outline is 1 → 2 → 3 whichever tab is open, but it is
   * `sr-only`: the rail already shows which section is selected, and a visible heading repeating
   * it is the line of chrome this change removed.
   */
  it("keeps the section as the panel's h2, unprinted", () => {
    const { container } = head();
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent).toBe("Fields");
    expect(h2.className).toContain("sr-only");
  });

  it("prints the section's one-line intro", () => {
    head();
    expect(screen.getByText("Choose the fields for your card.")).toBeInTheDocument();
  });

  /**
   * ⚠ A RESTING BOUNDARY. There is no hover on a touch screen, so a title-shaped input whose
   * fill only appears on `hover:`/`focus:` is why cards shipped called "Untitled card".
   */
  it("gives the title a resting border, not a hover-only one", () => {
    const { container } = head();
    const input = container.querySelector("[data-builder-name]")!;
    expect(input.className).toMatch(/(^|\s)border(\s|$)/);
    expect(input.className).toContain("border-line");
  });

  /** Selecting only the exact default: a name somebody chose is never one keystroke from gone. */
  it("selects the untouched default on focus and nothing else", () => {
    const { container, unmount } = head();
    const input = container.querySelector("[data-builder-name]") as HTMLInputElement;
    input.focus();
    expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe(
      "Untitled card",
    );
    unmount();

    const chosen = head("Work — Kestrel");
    const named = chosen.container.querySelector("[data-builder-name]") as HTMLInputElement;
    named.focus();
    expect((named.selectionEnd ?? 0) - (named.selectionStart ?? 0)).toBe(0);
  });
});
