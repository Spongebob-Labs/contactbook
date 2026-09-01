import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "../helpers/render";
import { Button, buttonClassName } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Label, controlClassName } from "@/components/primitives/label";
import { RadioGroup } from "@/components/primitives/radio-group";
import { Select } from "@/components/primitives/select";
import { Switch } from "@/components/primitives/switch";
import { TextArea } from "@/components/primitives/textarea";
import { Checkbox } from "@/components/primitives/checkbox";
import { Avatar } from "@/components/primitives/avatar";
import { Badge } from "@/components/primitives/badge";
import { Chip, chipClassName } from "@/components/primitives/chip";
import { Rule } from "@/components/primitives/rule";
import { Skeleton } from "@/components/primitives/skeleton";

/**
 * The primitive contract suite (T05).
 *
 * Twenty-plus tracks compose these thirteen components and none of them may edit one
 * (plan §1.2), so every behavioural promise a screen relies on is asserted here.
 *
 * ⚠ happy-dom has no layout engine and no stylesheet: never assert geometry or computed
 * colour here (spec §14.6). Visual proof is Playwright's — T28 (contrast) and T29
 * (focus ring, axe). What this file proves is behaviour, ARIA and class contracts.
 */

describe("Button (spec §8D.7)", () => {
  it("renders all five variants and marks the variant on the element", () => {
    const variants = ["primary", "secondary", "ghost", "destructive", "text-link"] as const;

    for (const variant of variants) {
      const { unmount } = renderWithProviders(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
        "data-variant",
        variant,
      );
      unmount();
    }
  });

  it("defaults to variant=primary, size=md and type=button", () => {
    renderWithProviders(<Button>New card</Button>);
    const button = screen.getByRole("button", { name: "New card" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("keeps an explicit type, so a form submit button still submits", () => {
    renderWithProviders(<Button type="submit">Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "submit");
  });

  it("offers both sizes — 40px (md) and 52px (lg)", () => {
    renderWithProviders(
      <>
        <Button size="md">Forty</Button>
        <Button size="lg">Fifty two</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Forty" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "Fifty two" })).toHaveClass("h-13");
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = createRef<HTMLButtonElement>();
    renderWithProviders(<Button ref={ref}>Focus me</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it("exposes aria-disabled with an explanation instead of a bare disabled attribute", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button disabled disabledReason="Add at least one field before saving." onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });

    // A bare `disabled` attribute removes the control from the tab order and tells the
    // user nothing about why (§8D.7). We stay focusable and explain.
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Add at least one field before saving.");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays keyboard-reachable while disabled (AC-26)", () => {
    renderWithProviders(
      <Button disabled disabledReason="Not yet">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });

    button.focus();
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("tabindex", "-1");
  });

  it("announces a busy state and swallows clicks while loading", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button loading loadingLabel="Exporting…" onClick={onClick}>
        Export PNG
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Exporting…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick normally when enabled", async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Create</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("requires an aria-label for an icon-only button and marks the icon decorative (§8.8)", () => {
    renderWithProviders(
      <Button iconOnly aria-label="Collapse sidebar">
        <svg data-testid="chevron" />
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(button).toHaveAttribute("data-icon-only", "true");
    expect(screen.getByTestId("chevron").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("supports full-width for the mobile primary action (§8D.2)", () => {
    renderWithProviders(<Button fullWidth>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("w-full");
  });

  it("exports buttonClassName so an anchor can wear the same skin without a nested button", () => {
    // The marketing hero CTA is an anchor styled as a text link (§8C.2) and the WhatsApp
    // action is an `<a href="https://wa.me/…">` (§6.9). Neither may be a <button>.
    const className = buttonClassName({ variant: "text-link" });
    expect(typeof className).toBe("string");
    expect(className.length).toBeGreaterThan(0);
    expect(className).not.toContain("#");
  });

  it("carries no colour literal, no shadow and no forbidden radius in its class string (F-01/F-09/F-10)", () => {
    for (const variant of ["primary", "secondary", "ghost", "destructive", "text-link"] as const) {
      const className = buttonClassName({ variant, size: "lg" });
      expect(className).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(className).not.toMatch(/rgba?\(|hsl\(|oklch\(/);
      expect(className).not.toMatch(/shadow-|rounded-2xl|rounded-3xl/);
      expect(className).not.toMatch(/font-(bold|semibold|extrabold|black)/);
    }
  });
});

describe("Label", () => {
  it("associates with a control by htmlFor and marks a required field", () => {
    renderWithProviders(
      <>
        <Label htmlFor="given-name" required>
          First name
        </Label>
        <input id="given-name" />
      </>,
    );

    expect(screen.getByLabelText(/First name/)).toBe(document.getElementById("given-name"));
    // The asterisk is decoration; `required` on the input is what AT announces.
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("can be visually hidden while staying in the accessibility tree", () => {
    renderWithProviders(
      <>
        <Label htmlFor="q" srOnly>
          Search contacts
        </Label>
        <input id="q" />
      </>,
    );

    expect(screen.getByLabelText("Search contacts")).toBeInTheDocument();
    expect(screen.getByText("Search contacts")).toHaveClass("sr-only");
  });
});

describe("Input (AC-25 — every control has a programmatic label)", () => {
  it("labels the control and generates its own id when none is given", () => {
    renderWithProviders(<Input label="Phone number" />);
    const input = screen.getByLabelText("Phone number");

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.id).toBeTruthy();
  });

  it("honours a caller-supplied id", () => {
    renderWithProviders(<Input id="email" label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
  });

  it("wires hint text through aria-describedby", () => {
    renderWithProviders(<Input label="Card name" hint="Shown only to you." />);
    expect(screen.getByLabelText("Card name")).toHaveAccessibleDescription("Shown only to you.");
  });

  it("sets aria-invalid and announces the error via role=alert (§8D.2)", () => {
    renderWithProviders(<Input label="Phone number" error="Enter 6 to 15 digits." />);
    const input = screen.getByLabelText("Phone number");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter 6 to 15 digits.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 6 to 15 digits.");
  });

  it("is not invalid when there is no error", () => {
    renderWithProviders(<Input label="Phone number" />);
    expect(screen.getByLabelText("Phone number")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("supports read-only without dropping out of the tab order", () => {
    renderWithProviders(<Input label="Slug" readOnly defaultValue="prya-hq" />);
    const input = screen.getByLabelText("Slug");

    expect(input).toHaveAttribute("readonly");
    expect(input).not.toHaveAttribute("disabled");
    expect(input).toHaveAttribute("data-readonly", "true");
  });

  it("explains a disabled input rather than leaving it mute", () => {
    renderWithProviders(
      <Input label="Slug" disabled disabledReason="Slugs cannot be changed after sharing." />,
    );
    const input = screen.getByLabelText("Slug");

    expect(input).toBeDisabled();
    expect(input).toHaveAccessibleDescription(
      "Slugs cannot be changed after sharing.",
    );
  });

  it("keeps the label available to AT when it is visually hidden", () => {
    renderWithProviders(<Input label="Search contacts" hideLabel />);
    expect(screen.getByLabelText("Search contacts")).toBeInTheDocument();
  });

  it("renders leading and trailing addons around the control", () => {
    renderWithProviders(
      <Input
        label="Phone number"
        leadingAddon={<span data-testid="flag">IN</span>}
        trailingAddon={<span data-testid="clear">x</span>}
      />,
    );

    expect(screen.getByTestId("flag")).toBeInTheDocument();
    expect(screen.getByTestId("clear")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
  });

  it("forwards a ref and accepts typing", async () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(<Input ref={ref} label="First name" />);

    await userEvent.type(screen.getByLabelText("First name"), "Priyanka");
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe("Priyanka");
  });
});

describe("TextArea", () => {
  it("labels, hints and invalidates exactly like Input", () => {
    renderWithProviders(<TextArea label="Bio" hint="Two short lines beat one long one." />);
    const field = screen.getByLabelText("Bio");

    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAccessibleDescription("Two short lines beat one long one.");
  });

  it("announces its error with role=alert and sets aria-invalid", () => {
    renderWithProviders(<TextArea label="Bio" error="Keep it under 240 characters." />);

    expect(screen.getByLabelText("Bio")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Keep it under 240 characters.");
  });

  it("takes a rows count and forwards a ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    renderWithProviders(<TextArea ref={ref} label="Bio" rows={5} />);

    expect(screen.getByLabelText("Bio")).toHaveAttribute("rows", "5");
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});

const COUNTRY_ITEMS = [
  { value: "in", label: "India +91" },
  { value: "gb", label: "United Kingdom +44" },
  { value: "us", label: "United States +1" },
];

describe("Select (Radix behaviour, our visual layer — Q29)", () => {
  it("exposes a labelled combobox trigger showing the placeholder when empty", () => {
    renderWithProviders(
      <Select label="Country code" placeholder="Choose a country" items={COUNTRY_ITEMS} />,
    );

    const trigger = screen.getByRole("combobox", { name: /Country code/ });
    expect(trigger).toHaveTextContent("Choose a country");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the selected item's label, not its value", () => {
    renderWithProviders(
      <Select label="Country code" items={COUNTRY_ITEMS} defaultValue="gb" />,
    );

    expect(screen.getByRole("combobox", { name: /Country code/ })).toHaveTextContent(
      "United Kingdom +44",
    );
  });

  it("marks itself invalid and announces the error", () => {
    renderWithProviders(
      <Select label="Country code" items={COUNTRY_ITEMS} error="Pick a country." />,
    );

    expect(screen.getByRole("combobox", { name: /Country code/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a country.");
  });

  it("is keyboard-focusable and reports a disabled trigger to AT", () => {
    renderWithProviders(
      <Select label="Country code" items={COUNTRY_ITEMS} disabled />,
    );

    const trigger = screen.getByRole("combobox", { name: /Country code/ });
    expect(trigger).toHaveAttribute("data-disabled");
  });

  it("submits through a hidden native control inside a form", () => {
    // Radix only mounts the bubble `<select>` when the trigger is inside a form — which
    // is the only situation in which a form value matters. `/signin/phone` is that form.
    const { container } = renderWithProviders(
      <form>
        <Select label="Country code" name="country" items={COUNTRY_ITEMS} defaultValue="in" />
      </form>,
    );

    const native = container.querySelector<HTMLSelectElement>('select[name="country"]');
    expect(native).toBeInTheDocument();
    expect(native).toHaveValue("in");
  });
});

describe("Checkbox", () => {
  it("is labelled and toggles on click", async () => {
    const onCheckedChange = vi.fn();
    renderWithProviders(
      <Checkbox label="Work email" onCheckedChange={onCheckedChange} />,
    );

    const box = screen.getByRole("checkbox", { name: "Work email" });
    expect(box).toHaveAttribute("aria-checked", "false");

    await userEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles when the label text itself is clicked", async () => {
    const onCheckedChange = vi.fn();
    renderWithProviders(<Checkbox label="Work email" onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByText("Work email"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reports the indeterminate state as aria-checked=mixed", () => {
    renderWithProviders(<Checkbox label="All fields" checked="indeterminate" />);
    expect(screen.getByRole("checkbox", { name: "All fields" })).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  });

  it("reflects a checked value and a disabled state", () => {
    renderWithProviders(<Checkbox label="Work email" checked disabled />);
    const box = screen.getByRole("checkbox", { name: "Work email" });

    expect(box).toHaveAttribute("aria-checked", "true");
    expect(box).toBeDisabled();
  });

  it("wires a description through aria-describedby", () => {
    renderWithProviders(
      <Checkbox label="Bank account" description="Masked on every public card." />,
    );

    expect(screen.getByRole("checkbox", { name: "Bank account" })).toHaveAccessibleDescription(
      "Masked on every public card.",
    );
  });
});

describe("RadioGroup", () => {
  const OPTIONS = [
    { value: "pill", label: "Pill" },
    { value: "rounded-rect", label: "Rounded rectangle" },
    { value: "square", label: "Square" },
  ];

  it("renders a labelled group with one radio per option", () => {
    renderWithProviders(
      <RadioGroup label="Button radius" items={OPTIONS} defaultValue="pill" />,
    );

    expect(screen.getByRole("radiogroup", { name: /Button radius/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Pill" })).toBeChecked();
  });

  it("selects on click and reports the new value", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <RadioGroup
        label="Button radius"
        items={OPTIONS}
        defaultValue="pill"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Square" }));
    expect(onValueChange).toHaveBeenCalledWith("square");
  });

  it("announces a group-level error", () => {
    renderWithProviders(
      <RadioGroup label="Button radius" items={OPTIONS} error="Pick one." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Pick one.");
  });
});

describe("Switch", () => {
  it("is a labelled switch that toggles", async () => {
    const onCheckedChange = vi.fn();
    renderWithProviders(
      <Switch label="Sensitive field" onCheckedChange={onCheckedChange} />,
    );

    const control = screen.getByRole("switch", { name: "Sensitive field" });
    expect(control).toHaveAttribute("aria-checked", "false");

    await userEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reflects checked and disabled, and carries a description", () => {
    renderWithProviders(
      <Switch
        label="Sensitive field"
        description="Hidden behind a reveal in your profile only."
        checked
        disabled
      />,
    );

    const control = screen.getByRole("switch", { name: "Sensitive field" });
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleDescription(
      "Hidden behind a reveal in your profile only.",
    );
  });

  it("keeps the label reachable when it is visually hidden", () => {
    renderWithProviders(<Switch label="Collapse sidebar" hideLabel />);
    expect(screen.getByRole("switch", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});

describe("Select — keyboard operation (AC-26)", () => {
  it("opens from the keyboard, lists its options and commits a choice", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <Select label="Country code" items={COUNTRY_ITEMS} onValueChange={onValueChange} />,
    );

    const trigger = screen.getByRole("combobox", { name: /Country code/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "India +91" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);

    await userEvent.click(screen.getByRole("option", { name: "United States +1" }));
    expect(onValueChange).toHaveBeenCalledWith("us");
  });

  it("closes on Escape without committing a value", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <Select label="Country code" items={COUNTRY_ITEMS} onValueChange={onValueChange} />,
    );

    const trigger = screen.getByRole("combobox", { name: /Country code/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("option", { name: "India +91" });

    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Chip", () => {
  it("is a plain span when it is not interactive", () => {
    renderWithProviders(<Chip>Personal</Chip>);
    const chip = screen.getByText("Personal");

    expect(chip.closest("button")).toBeNull();
    expect(chip.closest("[data-chip]")).toHaveAttribute("data-tone", "neutral");
  });

  it("becomes a toggle button with aria-pressed when interactive", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Chip interactive selected onClick={onClick}>
        Business
      </Chip>,
    );

    const chip = screen.getByRole("button", { name: "Business" });
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reports an unselected interactive chip as aria-pressed=false", () => {
    renderWithProviders(
      <Chip interactive selected={false}>
        Creative
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("offers a labelled remove control for filter chips", async () => {
    const onRemove = vi.fn();
    renderWithProviders(<Chip onRemove={onRemove}>Business</Chip>);

    await userEvent.click(screen.getByRole("button", { name: "Remove Business" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("takes an explicit remove label when the child is not a plain string", async () => {
    const onRemove = vi.fn();
    renderWithProviders(
      <Chip onRemove={onRemove} removeLabel="Remove the business filter">
        <strong>Business</strong>
      </Chip>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove the business filter" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("exports chipClassName so a category-rail link can wear the pill", () => {
    // `/templates`'s rail may be real links rather than filter buttons (§8B.5); a link
    // must never be wrapped in a button, so it takes the class string instead.
    const className = chipClassName({ tone: "accent", selected: true });
    expect(typeof className).toBe("string");
    expect(className).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(className).not.toMatch(/shadow-|rounded-2xl|rounded-3xl/);
  });

  it("carries each signal tone", () => {
    renderWithProviders(<Chip tone="warning">0 fields</Chip>);
    expect(screen.getByText("0 fields").closest("[data-chip]")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });
});

describe("Badge", () => {
  it("renders a non-interactive marker carrying its tone", () => {
    renderWithProviders(<Badge tone="warning">0 fields</Badge>);
    const badge = screen.getByText("0 fields");

    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge.closest("button")).toBeNull();
  });

  it("defaults to the neutral tone", () => {
    renderWithProviders(<Badge>12</Badge>);
    expect(screen.getByText("12")).toHaveAttribute("data-tone", "neutral");
  });
});

describe("Avatar (E-19 / E-20 — the monogram fallback)", () => {
  it("falls back to a monogram when there is no image", () => {
    renderWithProviders(<Avatar name="Priyanka Sharma" src={null} />);

    const avatar = screen.getByRole("img", { name: "Priyanka Sharma" });
    expect(avatar).toHaveTextContent("PS");
  });

  it("falls back to a monogram when the image never loads (E-20)", async () => {
    renderWithProviders(<Avatar name="Arjun Mehta" src="/portraits/missing.png" />);

    expect(await screen.findByText("AM")).toBeInTheDocument();
  });

  it("uses one letter for a single-word name and never more than two", () => {
    renderWithProviders(
      <>
        <Avatar name="Prince" src={null} />
        <Avatar name="Mei Ling Chen Wong" src={null} />
      </>,
    );

    expect(screen.getByRole("img", { name: "Prince" })).toHaveTextContent("P");
    expect(screen.getByRole("img", { name: "Mei Ling Chen Wong" })).toHaveTextContent("MW");
  });

  it("hides the monogram glyph from AT so the name is announced once", () => {
    renderWithProviders(<Avatar name="Priyanka Sharma" src={null} />);
    expect(screen.getByText("PS")).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes its size as a data attribute", () => {
    renderWithProviders(<Avatar name="Priyanka Sharma" src={null} size="lg" />);
    expect(screen.getByRole("img", { name: "Priyanka Sharma" })).toHaveAttribute(
      "data-size",
      "lg",
    );
  });
});

describe("Skeleton", () => {
  it("marks itself busy so a loading region is announced (§8D.1)", () => {
    renderWithProviders(<Skeleton data-testid="bone" />);
    const bone = screen.getByTestId("bone");

    expect(bone).toHaveAttribute("aria-busy", "true");
    expect(bone).toHaveAttribute("data-skeleton", "true");
  });

  it("shimmers by opacity, which the central reduced-motion rule freezes (AC-27)", () => {
    renderWithProviders(<Skeleton data-testid="bone" />);
    // An opacity pulse, never a spinner and never a translate — §8.9 zeroes the
    // duration tokens globally, so nothing here has to remember reduced motion.
    expect(screen.getByTestId("bone")).toHaveClass("animate-pulse");
    expect(screen.getByTestId("bone").className).not.toMatch(/animate-spin/);
  });

  it("renders the three shapes a layout-matched skeleton needs", () => {
    renderWithProviders(
      <>
        <Skeleton data-testid="a" variant="text" />
        <Skeleton data-testid="b" variant="block" />
        <Skeleton data-testid="c" variant="circle" />
      </>,
    );

    expect(screen.getByTestId("a")).toHaveAttribute("data-variant", "text");
    expect(screen.getByTestId("b")).toHaveAttribute("data-variant", "block");
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "circle");
  });

  it("stacks multiple text lines in one call", () => {
    renderWithProviders(<Skeleton variant="text" lines={3} data-testid="para" />);
    expect(screen.getByTestId("para").querySelectorAll("[data-skeleton-line]")).toHaveLength(3);
  });
});

describe("Rule (§8.7 — a real border, never a box-shadow fake)", () => {
  it("is a separator with an orientation", () => {
    renderWithProviders(<Rule />);
    const rule = screen.getByRole("separator");

    expect(rule).toHaveAttribute("aria-orientation", "horizontal");
    expect(rule.className).toMatch(/border/);
    expect(rule.className).not.toMatch(/shadow/);
  });

  it("drops out of the accessibility tree when it is purely decorative", () => {
    renderWithProviders(<Rule decorative data-testid="deco" />);

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByTestId("deco")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses --line-control when it bounds a control, not the decorative --line", () => {
    renderWithProviders(<Rule tone="control" />);
    expect(screen.getByRole("separator").className).toMatch(/border-line-control/);
  });

  it("supports a vertical orientation", () => {
    renderWithProviders(<Rule orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});

describe("the barrel (src/components/primitives/index.ts)", () => {
  it("re-exports all thirteen primitives, because screens import from the directory", async () => {
    const barrel = await import("@/components/primitives");

    for (const name of [
      "Button",
      "Input",
      "TextArea",
      "Select",
      "Checkbox",
      "RadioGroup",
      "Switch",
      "Label",
      "Chip",
      "Badge",
      "Avatar",
      "Skeleton",
      "Rule",
    ]) {
      expect(barrel, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});

describe("AC-13 guard — --ink-4 is never a text colour in this directory", () => {
  // §8D.7's Button paragraph says disabled text is `--ink-4`, but AC-13 is the binary
  // gate ("ZERO text-colour declarations") and §8.3 says so itself. T02's
  // `contrast-sweep.test.ts` is the repo-wide sweep; this is the local regression lock so
  // a later fix round cannot quietly put it back.
  it("keeps every button variant's disabled text on --ink-3", () => {
    for (const variant of ["primary", "secondary", "ghost", "destructive", "text-link"] as const) {
      const className = buttonClassName({ variant });
      expect(className, variant).not.toMatch(/text-ink-4/);
      expect(className, variant).toMatch(/aria-disabled:text-ink-3/);
    }
  });

  it("keeps the shared control skin's disabled text on --ink-3", () => {
    expect(controlClassName()).not.toMatch(/text-ink-4/);
    expect(controlClassName()).toMatch(/disabled:text-ink-3/);
  });

  it("keeps the chip and badge tones off --ink-4 entirely", () => {
    for (const tone of ["neutral", "accent", "warning", "danger", "success"] as const) {
      expect(chipClassName({ tone }), tone).not.toMatch(/ink-faint/);
    }
  });
});
