import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "../helpers/render";
import { FIELD_CATEGORY_LABELS } from "@/components/app";
import {
  AddFieldDialog,
  type AddFieldDialogProps,
  type CreatedField,
} from "@/components/builder/add-field-dialog";
import { buildFieldRows, offerableRows } from "@/components/builder/field-rows";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";

/**
 * **"Add a field" — authoring, not only picking.**
 *
 * ## The behaviour this file exists to hold
 * The dialog used to offer exactly one route to a field the profile lacked: a deep link out to
 * `/profile`. That answer threw the builder session away — somebody mid-compose who notices a
 * missing number was told to leave, make it, come back and find their place. So the link is gone
 * and the same `POST /profile/fields` runs from here.
 *
 * Three assertions carry the change, and each one is a thing that broke or would break:
 *
 * 1. **The deep link is absent.** Asserted as "no anchor to /profile", not "the button exists" —
 *    a new control does not prove the old escape was removed.
 * 2. **The rail jumps to the created field's category.** A field made here is put on the card by
 *    the same action, and *Suggested* means "not on the card" computed from the baseline at open
 *    — so a new field can never appear there. Without the jump, pressing Add would look like
 *    nothing happened.
 * 3. **A failed create keeps the draft.** Clearing the form on failure makes somebody retype what
 *    they just lost, on top of whatever went wrong.
 */

const ROWS = offerableRows(buildFieldRows(fixtureGroups, fixtureFields));

type CreateHandler = NonNullable<AddFieldDialogProps["onCreateField"]>;

function openDialog(options: { onCreateField?: CreateHandler; creating?: boolean } = {}) {
  const onAdd = vi.fn<(fieldId: string) => void>();
  renderWithProviders(
    <AddFieldDialog
      open
      onOpenChange={() => {}}
      rows={ROWS}
      selected={[]}
      onAdd={onAdd}
      onCreateField={options.onCreateField}
      creating={options.creating ?? false}
    />,
  );
  return { onAdd };
}

function dialogBody(): HTMLElement {
  const body = document.querySelector("[data-add-field-dialog]");
  if (body === null) throw new Error("the add-field dialog did not render");
  return body as HTMLElement;
}

async function openComposer() {
  await userEvent.click(screen.getByRole("button", { name: /new field/i }));
}

describe("the route to a field the profile does not have", () => {
  it("offers no link out to /profile", () => {
    openDialog({ onCreateField: vi.fn() });

    expect(dialogBody().querySelector('a[href="/profile"]')).toBeNull();
    expect(screen.queryByText(/add a field in your profile/i)).not.toBeInTheDocument();
  });

  it("offers a New field button instead, collapsed until asked for", () => {
    openDialog({ onCreateField: vi.fn() });

    const button = dialogBody().querySelector("[data-add-field-new]");
    expect(button).not.toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(dialogBody().querySelector("[data-create-field-form]")).toBeNull();
  });

  it("withholds the control entirely on a surface that cannot write", () => {
    // Absent rather than present-and-broken — a control that can only fail is worse than none.
    openDialog({});

    expect(dialogBody().querySelector("[data-add-field-new]")).toBeNull();
    expect(dialogBody().querySelector('a[href="/profile"]')).toBeNull();
  });

  it("reveals the form when pressed", async () => {
    openDialog({ onCreateField: vi.fn() });
    await openComposer();

    expect(dialogBody().querySelector("[data-create-field-form]")).not.toBeNull();
    expect(dialogBody().querySelector("[data-add-field-new]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

describe("creating a field", () => {
  it("sends the typed value and defaults the label from the kind", async () => {
    const onCreateField = vi
      .fn()
      .mockResolvedValue({ fieldId: "new-1", category: "PERSONAL" } satisfies CreatedField);
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.type(screen.getByLabelText(/^value$/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /add to profile and card/i }));

    // "Phone" is the default kind, and its own label stands in for one nobody typed — one fewer
    // required box is one fewer reason to abandon this for /profile.
    expect(onCreateField).toHaveBeenCalledWith({
      type: "PHONE",
      label: "Phone",
      value: "+919820000000",
    });
  });

  it("keeps a label that was typed", async () => {
    const onCreateField = vi
      .fn()
      .mockResolvedValue({ fieldId: "new-1", category: "PERSONAL" } satisfies CreatedField);
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.type(screen.getByLabelText(/^label$/i), "Studio line");
    await userEvent.type(screen.getByLabelText(/^value$/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /add to profile and card/i }));

    expect(onCreateField).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Studio line", value: "+919820000000" }),
    );
  });

  it("refuses a blank value locally rather than spending a round trip to be told", async () => {
    const onCreateField = vi.fn();
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.click(screen.getByRole("button", { name: /add to profile and card/i }));

    expect(await screen.findByText(/give the field a value/i)).toBeInTheDocument();
    expect(onCreateField).not.toHaveBeenCalled();
  });

  /**
   * The one that makes the feature legible rather than merely wired.
   *
   * A created field is put on the card by the same action, and Suggested is "not on the card"
   * frozen at open — so it cannot show there. The rail has to move to where the field landed.
   */
  it("moves the rail to the category the field landed in, and closes the form", async () => {
    const onCreateField = vi
      .fn()
      .mockResolvedValue({ fieldId: "new-1", category: "WORK" } satisfies CreatedField);
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.type(screen.getByLabelText(/^value$/i), "Head of Ops");
    await userEvent.click(screen.getByRole("button", { name: /add to profile and card/i }));

    const rail = await screen.findByRole("navigation", { name: /field categories/i });
    const work = within(rail).getByRole("button", { name: FIELD_CATEGORY_LABELS.WORK });
    expect(work).toHaveAttribute("aria-current", "true");
    expect(
      within(rail).getByRole("button", { name: "Suggested" }),
    ).not.toHaveAttribute("aria-current");

    expect(dialogBody().querySelector("[data-create-field-form]")).toBeNull();
  });

  it("keeps the draft and stays open when the create fails", async () => {
    // `null` is the caller saying "I already told them what went wrong".
    const onCreateField = vi.fn().mockResolvedValue(null);
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.type(screen.getByLabelText(/^value$/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /add to profile and card/i }));

    expect(dialogBody().querySelector("[data-create-field-form]")).not.toBeNull();
    expect(screen.getByLabelText(/^value$/i)).toHaveValue("+919820000000");
  });

  it("closes the form without creating anything when cancelled", async () => {
    const onCreateField = vi.fn();
    openDialog({ onCreateField });
    await openComposer();

    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(dialogBody().querySelector("[data-create-field-form]")).toBeNull();
    expect(onCreateField).not.toHaveBeenCalled();
  });
});
