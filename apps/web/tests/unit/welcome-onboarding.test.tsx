import { describe, expect, it, vi } from "vitest";

import { TEMPLATE_PALETTES } from "@/card/template-palettes";
import { CoverEditButton, InlineText } from "@/components/onboarding/card-edit-regions";
import {
  BIO_MAX,
  HEADLINE_MAX,
  STARTER_CARD_NAME,
  WELCOME_PALETTES,
  WELCOME_STEPS,
  pickStarterCard,
  textPatchValue,
  welcomeHref,
  welcomeStepFor,
} from "@/components/onboarding/welcome-steps";
import { fixtureCards } from "@/fixtures/cards";
import type { ContactCard } from "@/types/domain";

import { fireEvent, render, screen, userEvent } from "../helpers/render";

/**
 * The `/welcome` walkthrough's rules and its on-card controls.
 *
 * The screen itself needs a session and the API, so its full walk is checked against the stub in
 * a browser; what is pinned here is everything that can be wrong without one — which step a URL
 * means, which card is edited, what a commit sends, and that every control has a name.
 */

describe("steps", () => {
  it("is three steps, numbered from 1", () => {
    expect(WELCOME_STEPS.map((step) => step.index)).toEqual([1, 2, 3]);
    expect(WELCOME_STEPS.map((step) => step.id)).toEqual(["photo", "about", "colour"]);
  });

  it("reads ?step= and lands anything unreadable on step 1", () => {
    expect(welcomeStepFor("2").id).toBe("about");
    expect(welcomeStepFor("3").id).toBe("colour");
    for (const junk of [null, undefined, "", "0", "9", "banana", "1.5"]) {
      expect(welcomeStepFor(junk).id).toBe("photo");
    }
  });

  it("round-trips a step through its href", () => {
    for (const step of WELCOME_STEPS) {
      const href = welcomeHref(step);
      const param = new URL(href, "https://x.example").searchParams.get("step");
      expect(welcomeStepFor(param)).toBe(step);
    }
    expect(welcomeHref(WELCOME_STEPS[0])).toBe("/welcome");
  });
});

describe("the starter card", () => {
  const named = (name: string, id: string): ContactCard => ({ ...fixtureCards[0], id, name });

  it("prefers the card onboarding made, by its name", () => {
    const cards = [named("Work", "a"), named(STARTER_CARD_NAME, "b"), named("Side", "c")];
    expect(pickStarterCard(cards)?.id).toBe("b");
    expect(pickStarterCard([named("  my card ", "d")])?.id).toBe("d");
  });

  it("falls back to the first card, and to null when there is none", () => {
    expect(pickStarterCard([named("Work", "a"), named("Side", "c")])?.id).toBe("a");
    expect(pickStarterCard([])).toBeNull();
  });
});

describe("what a text commit sends", () => {
  it("sends nothing when the text did not change", () => {
    expect(textPatchValue("Founder", "Founder", "Founder")).toBeUndefined();
    expect(textPatchValue("  Founder ", "Founder", "Founder")).toBeUndefined();
  });

  it("does not pin a derived line as the owner's own words", () => {
    /* The line showed a mapped JOB_TITLE; the owner tapped in and out. */
    expect(textPatchValue("Head of Partnerships", "Head of Partnerships", null)).toBeUndefined();
  });

  it("sends the trimmed text on a change", () => {
    expect(textPatchValue("  Founder & CEO  ", "Founder", "Founder")).toBe("Founder & CEO");
    expect(textPatchValue("Founder", "", null)).toBe("Founder");
  });

  it("clears with null, and only when there is something of the owner's to clear", () => {
    expect(textPatchValue("   ", "Founder", "Founder")).toBeNull();
    expect(textPatchValue("", "Head of Partnerships", null)).toBeUndefined();
  });

  it("uses the API's own caps", () => {
    expect(HEADLINE_MAX).toBe(80);
    expect(BIO_MAX).toBe(280);
  });
});

describe("the colour row", () => {
  it("offers six real palettes, the starter card's default among them, and no greens", () => {
    expect(WELCOME_PALETTES).toHaveLength(6);
    for (const id of WELCOME_PALETTES) expect(TEMPLATE_PALETTES[id]).toBeDefined();
    /* A PERSONAL card — the kind onboarding makes — wears Marigold's Amber by default. */
    expect(WELCOME_PALETTES).toContain("amber");
    for (const green of ["emerald", "pistachio", "mint"]) {
      expect(WELCOME_PALETTES).not.toContain(green);
    }
  });
});

describe("<CoverEditButton>", () => {
  it("says what a tap does, in each state", () => {
    const onPick = vi.fn();
    const { rerender } = render(<CoverEditButton hasPhoto={false} busy={false} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    expect(onPick).toHaveBeenCalledTimes(1);

    rerender(<CoverEditButton hasPhoto busy={false} onPick={onPick} />);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();

    rerender(<CoverEditButton hasPhoto busy onPick={onPick} />);
    const busy = screen.getByRole("button", { name: "Uploading…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    fireEvent.click(busy);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe("<InlineText>", () => {
  const base = {
    region: "bio" as const,
    label: "Bio",
    hint: "Add a short bio",
    placeholder: "A line about you",
    maxLength: BIO_MAX,
    multiline: true,
    onEdit: () => {},
    onCommit: () => {},
    onCancel: () => {},
  };

  it("shows a named 'tap to add' button when empty", () => {
    const onEdit = vi.fn();
    render(<InlineText {...base} value="" editing={false} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a short bio" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("names a filled line by its label and its text", () => {
    render(<InlineText {...base} value="Coffee and maps." editing={false} />);
    expect(screen.getByRole("button", { name: "Edit bio: Coffee and maps." })).toBeInTheDocument();
  });

  it("opens focused on the current text, and Enter commits what was typed", async () => {
    const onCommit = vi.fn();
    render(<InlineText {...base} value="Coffee" editing onCommit={onCommit} />);
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Coffee");
    expect(field).toHaveAttribute("maxlength", String(BIO_MAX));

    await userEvent.type(field, " and maps{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Coffee and maps");
  });

  it("commits once on blur, and Escape cancels instead", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <InlineText {...base} value="Coffee" editing onCommit={onCommit} onCancel={onCancel} />,
    );
    const field = screen.getByRole("textbox", { name: "Bio" });
    fireEvent.blur(field);
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount();

    render(<InlineText {...base} value="Coffee" editing onCommit={onCommit} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Bio" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("uses a single-line input for the role", () => {
    render(
      <InlineText
        {...base}
        region="headline"
        label="Role"
        hint="Add your role"
        multiline={false}
        maxLength={HEADLINE_MAX}
        value=""
        editing
      />,
    );
    const field = screen.getByRole("textbox", { name: "Role" });
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("maxlength", String(HEADLINE_MAX));
  });
});
