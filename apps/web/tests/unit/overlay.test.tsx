import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "../helpers/render";
import {
  Dialog,
  ELEVATION_CSS,
  OVERLAY_CSS,
  OVERLAY_STYLE_HREF,
  OverlayStyles,
} from "@/components/overlay/dialog";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { Sheet } from "@/components/overlay/sheet";
import { Popover } from "@/components/overlay/popover";
import { Tooltip, TooltipProvider } from "@/components/overlay/tooltip";
import { ToastProvider, useToast } from "@/components/overlay/toast";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/overlay/dropdown-menu";
import { Button } from "@/components/primitives/button";
import { Select } from "@/components/primitives/select";

/**
 * The overlay contract suite (T08).
 *
 * `src/components/overlay/**` is the only directory in the build permitted
 * `--elevation-1` / `--elevation-2` (F-09, spec §8.7), so the two things this file has
 * to prove are (a) elevation is declared here and reaches every `[data-elevation]`
 * carrier — including T05's portalled Select menu, which declares the §13.2 attribute
 * and deliberately no shadow — and (b) E-50: Escape closes a dismissible overlay and
 * focus lands back on the trigger.
 *
 * ⚠ happy-dom has no layout engine and no compiled Tailwind sheet: never assert geometry
 * or computed colour here (spec §14.6). What this file proves is behaviour, ARIA, and
 * the class/attribute contracts downstream tracks key off.
 */

function hoistedElevationSheet(): HTMLStyleElement | null {
  // React 19 hoists `<style href precedence>` into <head>, rewriting `href` to
  // `data-href` and deduping by it. That is the mechanism this directory uses to ship
  // one global rule from seven components without owning a `.css` file.
  return document.head.querySelector<HTMLStyleElement>(
    `style[data-href="${OVERLAY_STYLE_HREF}"]`,
  );
}

function toastRoots(): HTMLElement[] {
  // Radix renders TWO nodes per toast: a visually hidden `role="status"` announcer, and
  // the visible `<li>` root that carries our props. Assert against the root.
  return [...document.querySelectorAll<HTMLElement>("[data-overlay-toast]")];
}

async function findToastRoots(): Promise<HTMLElement[]> {
  return waitFor(() => {
    const roots = toastRoots();
    if (roots.length === 0) throw new Error("no toast rendered yet");
    return roots;
  });
}

describe("the [data-elevation] rule — F-09's single declaration point (spec §8.7, §13.2)", () => {
  it("declares elevation 1 and 2 against the tokens, never a literal", () => {
    expect(ELEVATION_CSS).toMatch(/\[data-elevation="1"\]/);
    expect(ELEVATION_CSS).toMatch(/\[data-elevation="2"\]/);
    expect(ELEVATION_CSS).toMatch(/box-shadow:\s*var\(--elevation-1\)/);
    expect(ELEVATION_CSS).toMatch(/box-shadow:\s*var\(--elevation-2\)/);

    // F-01: no colour may be written outside `tokens.css`, comments included.
    expect(ELEVATION_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
    // F-05: `backdrop-filter` is forbidden everywhere, not just in cards.
    expect(ELEVATION_CSS).not.toMatch(/backdrop-(filter|blur)/);
  });

  it("keeps the selector at zero specificity so T02's :focus-visible ring always wins", () => {
    // Both this sheet and the global focus rule are unlayered, so specificity decides.
    // `:where()` pins the elevation rule at (0,0,0); `:focus-visible` is (0,1,0) and
    // therefore never loses its ring to a shadow (AC-26).
    expect(ELEVATION_CSS).toMatch(/:where\(\[data-elevation="1"\]\)/);
    expect(ELEVATION_CSS).toMatch(/:where\(\[data-elevation="2"\]\)/);
  });

  it("hoists exactly one stylesheet into <head> however many overlays render it", () => {
    renderWithProviders(
      <>
        <OverlayStyles />
        <OverlayStyles />
        <OverlayStyles />
      </>,
    );

    expect(
      document.head.querySelectorAll(`style[data-href="${OVERLAY_STYLE_HREF}"]`),
    ).toHaveLength(1);
    expect(hoistedElevationSheet()?.textContent).toBe(OVERLAY_CSS);
    expect(OVERLAY_CSS).toContain(ELEVATION_CSS);
  });

  it("covers a [data-elevation] carrier that is NOT an overlay component (T05's Select menu)", () => {
    // T05 could not declare a shadow on `select.tsx` without failing AC-15, so it shipped
    // the §13.2 attribute and left the styling to this directory. This asserts the seam.
    renderWithProviders(
      <>
        <OverlayStyles />
        <div data-testid="foreign-menu" data-elevation="1" />
      </>,
    );

    const sheet = hoistedElevationSheet();
    expect(sheet).not.toBeNull();
    expect(screen.getByTestId("foreign-menu")).toHaveAttribute("data-elevation", "1");
    // The rule is an attribute selector, not a class — so it reaches a node this
    // directory never rendered.
    expect(sheet?.textContent).toContain('[data-elevation="1"]');
  });
});

describe("the elevation rule applies, end to end — the T05 handoff", () => {
  function stubElevationTokens(): () => void {
    // Length-only shadow values: distinctive enough that a match cannot be coincidence,
    // and no colour literal enters this file (F-01). The real values are T02's, in
    // `tokens.css`, and happy-dom has no stylesheet of its own to supply them.
    const style = document.createElement("style");
    style.textContent =
      ":root { --elevation-0: none; --elevation-1: 1px 2px 3px 4px; --elevation-2: 5px 6px 7px 8px; }";
    document.head.appendChild(style);
    return () => style.remove();
  }

  it("gives T05's portalled Select menu a real shadow — the reason this rule exists", async () => {
    const restore = stubElevationTokens();
    try {
      renderWithProviders(
        <>
          {/* Whatever mounts this directory's stylesheet. Inside `(app)` it is T09's
              `ToastProvider`, already in the layout, so nothing has to remember. */}
          <OverlayStyles />
          <Select label="Country code" items={[{ value: "in", label: "India +91" }]} />
        </>,
      );

      const trigger = screen.getByRole("combobox", { name: /Country code/ });
      trigger.focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("option", { name: "India +91" });

      const menu = document.querySelector<HTMLElement>('[data-elevation="1"]');
      expect(menu).not.toBeNull();
      // Prove the elevated node really is T05's menu and not something this directory
      // rendered: it holds the options, and it carries none of our `data-overlay-*` marks.
      expect(within(menu as HTMLElement).getByRole("option", { name: "India +91" }))
        .toBeInTheDocument();
      expect((menu as HTMLElement).getAttributeNames()).not.toContain("data-overlay-scrim");

      // Without this rule the menu computes to no shadow at all and floats flat against
      // the page — an opaque rectangle with a hairline and no separation. T05 shipped the
      // §13.2 attribute and could not ship the shadow without failing AC-15; this is the
      // other half of that contract.
      expect(getComputedStyle(menu as HTMLElement).boxShadow).toBe("1px 2px 3px 4px");
    } finally {
      restore();
    }
  });

  it("lifts a Dialog to --elevation-2 while its scrim stays flat", async () => {
    const restore = stubElevationTokens();
    try {
      renderWithProviders(
        <Dialog open title="Share this card">
          <p>Body.</p>
        </Dialog>,
      );

      const content = await screen.findByRole("dialog");
      const scrim = document.querySelector<HTMLElement>("[data-overlay-scrim]");

      expect(getComputedStyle(content).boxShadow).toBe("5px 6px 7px 8px");
      expect(getComputedStyle(scrim as HTMLElement).boxShadow).toBe("none");
    } finally {
      restore();
    }
  });
});

describe("Dialog (spec §8D.7, §8.7 — the --elevation-2 surface)", () => {
  it("stays closed until its trigger is used", () => {
    renderWithProviders(
      <Dialog trigger={<Button>Share card</Button>} title="Share this card">
        <p>Anyone with the link can view it.</p>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share card" })).toBeInTheDocument();
  });

  it("opens carrying data-elevation=2 and ships the elevation sheet", async () => {
    renderWithProviders(
      <Dialog trigger={<Button>Share card</Button>} title="Share this card">
        <p>Anyone with the link can view it.</p>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share card" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-elevation", "2");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(dialog).toHaveAccessibleName("Share this card");
    expect(hoistedElevationSheet()).not.toBeNull();
  });

  it("is genuinely modal: the page behind is hidden from AT and scroll is locked", async () => {
    // This Radix version expresses modality by marking every sibling of the portal
    // `aria-hidden` rather than by setting `aria-modal` on the content, and locks scroll
    // through `data-scroll-locked` on <body>. Assert what it does, not what we assumed.
    renderWithProviders(
      <div>
        <p data-testid="page-behind">Your cards</p>
        <Dialog trigger={<Button>Share card</Button>} title="Share this card">
          <p>Body.</p>
        </Dialog>
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share card" }));
    await screen.findByRole("dialog");

    expect(screen.getByTestId("page-behind").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(document.body).toHaveAttribute("data-scroll-locked");
  });

  it("wires aria-describedby only when a description is supplied", async () => {
    const { unmount } = renderWithProviders(
      <Dialog open title="Share this card" description="Anyone with the link can view it.">
        <p>Body.</p>
      </Dialog>,
    );

    const described = await screen.findByRole("dialog");
    expect(described).toHaveAccessibleDescription("Anyone with the link can view it.");
    unmount();

    renderWithProviders(
      <Dialog open title="Share this card">
        <p>Body.</p>
      </Dialog>,
    );
    // Left dangling, Radix's default `aria-describedby` points at an element that was
    // never rendered — a broken reference on every dialog without a description line.
    expect(await screen.findByRole("dialog")).not.toHaveAttribute("aria-describedby");
  });

  it("names itself from a visually hidden title when the header is suppressed", async () => {
    renderWithProviders(
      <Dialog trigger={<Button>Open</Button>} title="Template picker" hideTitle>
        <p>Pick a template.</p>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Template picker");
  });

  it("E-50 — Escape closes it and focus returns to the trigger", async () => {
    renderWithProviders(
      <Dialog trigger={<Button>Share card</Button>} title="Share this card">
        <p>Anyone with the link can view it.</p>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Share card" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("reports closing through onOpenChange so a caller can drive it controlled", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <Dialog
        trigger={<Button>Share card</Button>}
        title="Share this card"
        onOpenChange={onOpenChange}
      >
        <p>Body.</p>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share card" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("renders a labelled close control and a footer slot", async () => {
    renderWithProviders(
      <Dialog
        open
        title="Share this card"
        footer={<Button variant="secondary">Copy link</Button>}
      >
        <p>Body.</p>
      </Dialog>,
    );

    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("carries no backdrop-filter and puts data-elevation=0 on the scrim (F-05, §8.7)", async () => {
    renderWithProviders(
      <Dialog open title="Share this card">
        <p>Body.</p>
      </Dialog>,
    );

    await screen.findByRole("dialog");
    const scrim = document.querySelector("[data-overlay-scrim]");
    expect(scrim).not.toBeNull();
    expect(scrim).toHaveAttribute("data-elevation", "0");
    expect(scrim?.className).not.toMatch(/backdrop-(blur|filter)/);
  });
});

describe("ConfirmDialog (spec §6.10 shape, §8D.1 — destructive actions confirm inline)", () => {
  it("renders the §6.10 anatomy: overline, title, detail", async () => {
    renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this card?"
        detail="The QR stops resolving and anyone holding it lands on a not-found page."
        confirmLabel="Delete card"
        onConfirm={() => {}}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-elevation", "2");
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("Delete this card?");
    expect(
      screen.getByText(
        "The QR stops resolving and anyone holding it lands on a not-found page.",
      ),
    ).toBeInTheDocument();
  });

  it("states the blast radius before a destructive confirm (E-41)", async () => {
    // T25 deletes a profile field and must say how many cards map it, in words, before
    // the user commits. The count is the caller's string; the slot is the contract.
    renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this field?"
        detail="It is removed from your profile."
        consequence="3 cards use this field. They will lose it."
        confirmLabel="Delete field"
        onConfirm={() => {}}
      />,
    );

    const consequence = await screen.findByText("3 cards use this field. They will lose it.");
    expect(consequence).toHaveAttribute("data-confirm-consequence");
  });

  it("gives the destructive confirm the destructive button and defaults focus to Cancel", async () => {
    renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this card?"
        detail="This cannot be undone."
        confirmLabel="Delete card"
        onConfirm={() => {}}
      />,
    );

    const confirm = await screen.findByRole("button", { name: "Delete card" });
    expect(confirm).toHaveAttribute("data-variant", "destructive");

    // A destructive dialog that lands focus on its destructive button turns one stray
    // Enter into data loss. Focus starts on the safe choice.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("uses the primary button and no danger wash when the action is not destructive", async () => {
    renderWithProviders(
      <ConfirmDialog
        open
        tone="default"
        title="Discard changes?"
        detail="Your edits are not saved yet."
        confirmLabel="Discard"
        onConfirm={() => {}}
      />,
    );

    expect(await screen.findByRole("button", { name: "Discard" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });

  it("calls onConfirm then closes; Cancel closes without confirming", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    const { unmount } = renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this card?"
        detail="This cannot be undone."
        confirmLabel="Delete card"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Delete card" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();

    const onConfirm2 = vi.fn();
    const onOpenChange2 = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this card?"
        detail="This cannot be undone."
        confirmLabel="Delete card"
        onConfirm={onConfirm2}
        onOpenChange={onOpenChange2}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onConfirm2).not.toHaveBeenCalled();
    expect(onOpenChange2).toHaveBeenCalledWith(false);
  });

  it("swallows a second click while the confirm is in flight (E-43's shape)", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        busy
        title="Delete this card?"
        detail="This cannot be undone."
        confirmLabel="Delete card"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    const confirm = await screen.findByRole("button", { name: "Delete card" });
    expect(confirm).toHaveAttribute("aria-busy", "true");

    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    // …and the dialog stays put, so the in-flight action keeps its surface.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("E-50 — Escape closes it, focus returns to the trigger, nothing is confirmed", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        trigger={<Button variant="destructive">Delete</Button>}
        title="Delete this card?"
        detail="This cannot be undone."
        confirmLabel="Delete card"
        onConfirm={onConfirm}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("Sheet — the mobile bottom sheet, and the only F-10 exemption", () => {
  it("opens as an --elevation-2 layer with the sanctioned oversized top radius", async () => {
    renderWithProviders(
      <Sheet trigger={<Button>Share</Button>} title="Share this card">
        <p>Body.</p>
      </Sheet>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAttribute("data-elevation", "2");
    expect(sheet).toHaveAttribute("data-overlay-sheet");
    expect(sheet).toHaveAccessibleName("Share this card");
    // `--radius-2xl` (28px) is legal here and nowhere else in the codebase (F-10, §8.6).
    expect(sheet.className).toMatch(/rounded-t-2xl/);
  });

  it("E-50 — Escape closes it and focus returns to the trigger", async () => {
    renderWithProviders(
      <Sheet trigger={<Button>Share</Button>} title="Share this card">
        <p>Body.</p>
      </Sheet>,
    );

    const trigger = screen.getByRole("button", { name: "Share" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("refuses to stack a Dialog on top of an open Sheet, and says so", async () => {
    // Nested modals trap focus twice, need two Escapes and double-lock scroll. The plan
    // requires this to be unreachable rather than merely undocumented.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(
      <Sheet open title="Share this card">
        <Dialog open title="Nested dialog">
          <p>Should never mount.</p>
        </Dialog>
      </Sheet>,
    );

    await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByText("Should never mount.")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("[contactbook]", {
      scope: "overlay",
      problem: "nested-modal-blocked",
      component: "Dialog",
    });

    consoleError.mockRestore();
  });
});

describe("Popover (spec §8D.7 — an --elevation-1 layer)", () => {
  it("stays closed until the trigger is used, then floats at elevation 1", async () => {
    renderWithProviders(
      <Popover trigger={<Button>Add field</Button>} title="Add a field">
        <p>Pick a field type.</p>
      </Popover>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add field" }));

    const content = await screen.findByRole("dialog");
    expect(content).toHaveAttribute("data-elevation", "1");
    expect(content).toHaveAccessibleName("Add a field");
    expect(screen.getByText("Pick a field type.")).toBeInTheDocument();
  });

  it("leaves the page behind live — a popover is not a modal", async () => {
    renderWithProviders(
      <div>
        <p data-testid="page-behind">Your profile</p>
        <Popover trigger={<Button>Add field</Button>} title="Add a field">
          <p>Body.</p>
        </Popover>
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await screen.findByRole("dialog");

    // No scroll lock, no aria-hidden sweep: the field list underneath stays readable
    // and operable while the "Add field" popover is open (§8D.3 profile screen).
    expect(screen.getByTestId("page-behind").closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("E-50 — Escape closes it and focus returns to the trigger", async () => {
    renderWithProviders(
      <Popover trigger={<Button>Add field</Button>} title="Add a field">
        <p>Body.</p>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Add field" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("still names itself when the heading is visually suppressed", async () => {
    renderWithProviders(
      <Popover open trigger={<Button>Add field</Button>} title="Add a field" hideTitle>
        <p>Body.</p>
      </Popover>,
    );

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Add a field");
  });
});

describe("DropdownMenu (spec §8D.7 — an --elevation-1 layer)", () => {
  const items = (
    <>
      <DropdownMenuLabel>Card</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => {}}>Edit</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => {}}>Export PNG</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem tone="destructive" onSelect={() => {}}>
        Delete
      </DropdownMenuItem>
    </>
  );

  it("opens a menu at elevation 1 with real menu semantics", async () => {
    renderWithProviders(
      <DropdownMenu trigger={<Button iconOnly aria-label="Card actions">…</Button>}>
        {items}
      </DropdownMenu>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Card actions" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("data-elevation", "1");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("marks the destructive row so it never reads like the other three", async () => {
    renderWithProviders(
      <DropdownMenu trigger={<Button iconOnly aria-label="Card actions">…</Button>}>
        {items}
      </DropdownMenu>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Card actions" }));

    expect(await screen.findByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-tone",
      "destructive",
    );
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("data-tone", "default");
  });

  it("opens and traverses from the keyboard, and selecting runs the item's action", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DropdownMenu trigger={<Button iconOnly aria-label="Card actions">…</Button>}>
        <DropdownMenuItem onSelect={onSelect}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {}}>Export PNG</DropdownMenuItem>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Card actions" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");

    await screen.findByRole("menu");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus(),
    );

    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("E-50 — Escape closes it and focus returns to the trigger", async () => {
    renderWithProviders(
      <DropdownMenu trigger={<Button iconOnly aria-label="Card actions">…</Button>}>
        {items}
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Card actions" });
    await userEvent.click(trigger);
    await screen.findByRole("menu");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("Tooltip (spec §8D.7, §8.8 — never the only carrier of meaning)", () => {
  it("works with no provider mounted, and floats at elevation 1 on focus", async () => {
    // T09's collapsed 68px rail hangs a tooltip off every nav icon. A component that
    // throws unless someone remembered a provider is a trap, so `Tooltip` supplies its
    // own when it is not inside a `TooltipProvider` group.
    renderWithProviders(
      <Tooltip content="Dashboard">
        <Button iconOnly aria-label="Dashboard">
          <span aria-hidden="true">◻</span>
        </Button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Dashboard" });
    trigger.focus();

    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Dashboard");
    expect(document.querySelector("[data-overlay-tooltip]")).toHaveAttribute(
      "data-elevation",
      "1",
    );
  });

  it("leaves the trigger's own accessible name intact (§8.8 — no meaning by icon alone)", async () => {
    renderWithProviders(
      <TooltipProvider>
        <Tooltip content="Dashboard">
          <Button iconOnly aria-label="Dashboard">
            <span aria-hidden="true">◻</span>
          </Button>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Dashboard" });
    trigger.focus();
    await screen.findByRole("tooltip");

    // The tooltip describes; the `aria-label` names. Strip the tooltip and the control
    // is still announced — which is the whole point of §8.8's rule.
    expect(trigger).toHaveAccessibleName("Dashboard");
  });

  it("E-50 — Escape dismisses it while the trigger keeps focus", async () => {
    renderWithProviders(
      <Tooltip content="Dashboard">
        <Button iconOnly aria-label="Dashboard">
          <span aria-hidden="true">◻</span>
        </Button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Dashboard" });
    trigger.focus();
    await screen.findByRole("tooltip");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("Toast (spec §8D.1 — the reversible-action affordance)", () => {
  function Harness({ options }: { options: Parameters<ReturnType<typeof useToast>["toast"]>[0] }) {
    const { toast } = useToast();
    return <Button onClick={() => toast(options)}>Delete card</Button>;
  }

  it("refuses to be used without its provider, and says where the provider lives", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithProviders(<Harness options={{ title: "x" }} />)).toThrow(
      /ToastProvider/,
    );
    consoleError.mockRestore();
  });

  it("pushes a toast at elevation 1 that states the outcome in words", async () => {
    renderWithProviders(
      <ToastProvider>
        <Harness options={{ title: "Card deleted", description: "Ledger — prya-hq" }} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete card" }));

    const [toast] = await findToastRoots();
    expect(toast).toHaveAttribute("data-elevation", "1");
    // §8D.1: "Every action's outcome is stated in words, never only by an icon."
    expect(toast).toHaveTextContent("Card deleted");
    expect(toast).toHaveTextContent("Ledger — prya-hq");
    // …and it is announced, not merely painted.
    expect(screen.getByRole("status")).toHaveTextContent("Card deleted");
  });

  it("carries the reversing action a reversible outcome needs (§8D.1)", async () => {
    const onUndo = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <Harness
          options={{ title: "Card deleted", action: { label: "Undo", onClick: onUndo } }}
        />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete card" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastRoots()).toHaveLength(0));
  });

  it("offers a labelled dismiss control and removes the toast when used", async () => {
    renderWithProviders(
      <ToastProvider>
        <Harness options={{ title: "Card deleted" }} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete card" }));
    await findToastRoots();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(toastRoots()).toHaveLength(0));
  });

  it("supports the failure tone E-44 needs, with a retry action", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <Harness
          options={{
            title: "Export failed",
            description: "The image could not be generated.",
            tone: "danger",
            action: { label: "Try again", onClick: onRetry },
          }}
        />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete card" }));

    const [toast] = await findToastRoots();
    expect(toast).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("stacks several toasts and dismisses them independently", async () => {
    function Multi() {
      const { toast } = useToast();
      return (
        <>
          <Button onClick={() => toast({ title: "First" })}>Push first</Button>
          <Button onClick={() => toast({ title: "Second" })}>Push second</Button>
        </>
      );
    }

    renderWithProviders(
      <ToastProvider>
        <Multi />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Push first" }));
    await userEvent.click(screen.getByRole("button", { name: "Push second" }));

    await waitFor(() => expect(toastRoots()).toHaveLength(2));

    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    await waitFor(() => expect(toastRoots()).toHaveLength(1));
    expect(toastRoots()[0]).toHaveTextContent("Second");
  });
});

describe("E-50 across the whole directory — Escape dismisses every dismissible overlay", () => {
  it("dismisses a focused toast", async () => {
    function Harness() {
      const { toast } = useToast();
      return <Button onClick={() => toast({ title: "Card deleted" })}>Delete card</Button>;
    }

    renderWithProviders(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete card" }));
    const [toast] = await findToastRoots();

    toast.focus();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(toastRoots()).toHaveLength(0));
  });

  it("leaves nothing mounted after Escape on any of the five portalled layers", async () => {
    // Belt-and-braces on the individual E-50 assertions above: a portal that survives its
    // own dismissal is invisible in a screenshot and fatal to the next Escape press.
    const cases = [
      <Dialog key="dialog" trigger={<Button>Open</Button>} title="Dialog" />,
      <Sheet key="sheet" trigger={<Button>Open</Button>} title="Sheet" />,
      <Popover key="popover" trigger={<Button>Open</Button>} title="Popover" />,
      <DropdownMenu key="menu" trigger={<Button>Open</Button>}>
        <DropdownMenuItem onSelect={() => {}}>Edit</DropdownMenuItem>
      </DropdownMenu>,
    ];

    for (const overlay of cases) {
      const { unmount } = renderWithProviders(overlay);
      const trigger = screen.getByRole("button", { name: "Open" });

      await userEvent.click(trigger);
      await waitFor(() =>
        expect(document.querySelector("[data-elevation='1'], [data-elevation='2']")).not.toBeNull(),
      );

      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(document.querySelector("[data-elevation='1'], [data-elevation='2']")).toBeNull(),
      );
      expect(trigger).toHaveFocus();

      unmount();
    }
  });
});

describe("the barrel — what other tracks are allowed to import", () => {
  it("re-exports all seven components, the toast hook and the elevation stylesheet", async () => {
    const barrel = await import("@/components/overlay");

    for (const name of [
      "Dialog",
      "ConfirmDialog",
      "Popover",
      "DropdownMenu",
      "Tooltip",
      "ToastProvider",
      "Sheet",
      "useToast",
      "OverlayStyles",
      "OVERLAY_STYLE_HREF",
    ]) {
      expect(barrel, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});

describe("AC-15 local lock — this directory's licence, and its limits", () => {
  // vitest runs with cwd = apps/web (see vitest.config.ts).
  const DIR = join(process.cwd(), "src", "components", "overlay");
  const FILES = readdirSync(DIR).filter((name) => /\.tsx?$/.test(name));
  const source = (name: string) => readFileSync(join(DIR, name), "utf8");

  it("contains exactly the eight files this track owns", () => {
    expect([...FILES].sort()).toEqual([
      "confirm-dialog.tsx",
      "dialog.tsx",
      "dropdown-menu.tsx",
      "index.ts",
      "popover.tsx",
      "sheet.tsx",
      "toast.tsx",
      "tooltip.tsx",
    ]);
  });

  it("F-09 — declares box-shadow in one place only, and only as an --elevation token", () => {
    // The licence is real but narrow: `box-shadow` lives in the one hoisted stylesheet,
    // keyed on `[data-elevation]`. Seven components' worth of ad-hoc shadows is exactly
    // the "shadow on every surface" fingerprint the rule exists to prevent.
    const owners = FILES.filter((name) => /box-shadow/.test(source(name)));
    expect(owners).toEqual(["dialog.tsx"]);

    for (const declaration of source("dialog.tsx").match(/box-shadow:[^;]+;/g) ?? []) {
      expect(declaration).toMatch(/box-shadow:\s*var\(--elevation-[012]\);/);
    }
  });

  it("F-09 — never reaches for a shadow-* utility (globals.css §2 says so explicitly)", () => {
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(/\bshadow-(?!offset)[a-z0-9[]/);
    }
  });

  it("F-10 — the oversized radius appears in sheet.tsx and nowhere else", () => {
    const owners = FILES.filter((name) => /rounded-(t-|b-|l-|r-)?[23]xl/.test(source(name)));
    expect(owners).toEqual(["sheet.tsx"]);
  });

  it("F-05 — no backdrop-filter anywhere; the scrim is an opaque tint", () => {
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(/backdrop-(filter|blur)/);
    }
  });

  it("F-01 — no colour literal, comments included", () => {
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
    }
  });

  it("F-11 — no type weight above 500", () => {
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(/font-(semibold|bold|extrabold|black)/);
    }
  });

  it("§8.3 — reimplements no part of the single global focus ring", () => {
    // A per-component ring is precisely how the AA guarantee on accent fills breaks.
    // T05 added zero; so does T08.
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(/focus-visible:|ring-|outline-[a-z]/);
    }
  });

  it("§3.1 — no network call, no persistence, no route awareness", () => {
    for (const name of FILES) {
      expect(source(name), name).not.toMatch(
        /fetch\(|axios|useSWR|useQuery|localStorage|sessionStorage|document\.cookie/,
      );
    }
  });

  it("§13.2 — every component that renders a floating layer declares its elevation", () => {
    for (const name of ["dialog.tsx", "popover.tsx", "dropdown-menu.tsx", "tooltip.tsx", "toast.tsx", "sheet.tsx"]) {
      expect(source(name), name).toMatch(/data-elevation="[012]"/);
    }
  });
});
