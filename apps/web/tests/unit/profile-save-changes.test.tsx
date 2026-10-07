/**
 * **Save changes** on the Profile & Cards workspace (client, 2026-10-07): *"Whenever the user is
 * adding or removing a field on the card, that button should pop up, and the auto-save
 * functionality should be removed."*
 *
 * The whole screen is rendered against a mocked API, so each test can say what was — and was not —
 * sent. What these pin, in the owner's terms:
 *
 * · ticking a field, renaming the card or choosing a look sends nothing; the card beside it
 *   changes, and Save changes appears;
 * · undoing the edit makes the button go away again;
 * · Save sends exactly the pending change, once, and the button goes; a failure keeps the draft
 *   and says why;
 * · Discard puts the card back; leaving asks first; switching between Fields, Design and Share
 *   keeps the draft; Send update waits until the draft is saved.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  act,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "../helpers/render";
import { ProfileClient } from "@/app/(app)/profile/profile-client";
import { ToastProvider } from "@/components/overlay/toast";
import { fixtureCards, fixtureFields, fixtureGroups, fixtureUser } from "@/fixtures";
import { ApiError } from "@/lib/api/errors";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/profile",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  };
});

const fetchCardsData = vi.fn();
vi.mock("@/lib/api/browser-loaders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/browser-loaders")>();
  return {
    ...actual,
    fetchCardsData: () => fetchCardsData(),
    /* The Share panel's own read. Left pending: these tests only pass through that panel. */
    fetchCardSharing: () => new Promise(() => {}),
  };
});

const update = vi.fn();
const setFields = vi.fn();
const audience = vi.fn();
vi.mock("@/lib/api/browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/browser")>();
  return {
    ...actual,
    cards: {
      ...actual.cards,
      update: (...args: unknown[]) => update(...args),
      setFields: (...args: unknown[]) => setFields(...args),
      audience: (...args: unknown[]) => audience(...args),
    },
  };
});

/** The first card in API order — what the workspace shows with no `?card=`. */
const WORK = fixtureCards[0]!;
const OTHER = fixtureCards[1]!;
/** On the profile, filled in, and not on the Work card. */
const MOBILE = "field_mobile";

function workspaceData() {
  return {
    user: fixtureUser,
    groups: [...fixtureGroups],
    fields: [...fixtureFields],
    cards: [WORK, OTHER],
  };
}

beforeEach(() => {
  fetchCardsData.mockReset().mockImplementation(async () => workspaceData());
  update.mockReset().mockResolvedValue({});
  setFields.mockReset().mockResolvedValue({});
  /* One person holds the card and is behind, so Send update would be live if it were allowed. */
  audience.mockReset().mockResolvedValue({
    currentVersion: 3,
    recipients: [
      {
        shareLinkId: "l1",
        contactId: "contact-l1",
        contactDisplayName: "Aayush",
        contactPhoneE164: "+919999900000",
        versionsBehind: 1,
        lastNotifiedVersion: 2,
      },
    ],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
});

async function mount() {
  const view = renderWithProviders(
    <ToastProvider>
      <ProfileClient />
    </ToastProvider>,
  );
  await screen.findByRole("checkbox", { name: `Show Mobile on ${WORK.name}` });
  await waitFor(() =>
    expect(document.querySelector("[data-send-update]")?.getAttribute("data-send-update-state")).toBe(
      "behind",
    ),
  );
  return view;
}

const toolbar = () => document.querySelector<HTMLElement>("[data-workspace-toolbar]")!;
/** The editor column's action bar: Save changes and Discard live here, not in the toolbar. */
const bar = () => document.querySelector<HTMLElement>("[data-save-bar]");
const saveButton = () => bar()?.querySelector<HTMLElement>("[data-save-changes-button]") ?? null;
const mobileToggle = () => screen.getByRole("checkbox", { name: `Show Mobile on ${WORK.name}` });
/** Longer than either debounce the autosave used (700ms ticks, 900ms design), with margin. */
const PAST_ANY_DEBOUNCE_MS = 1200;
const idle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, PAST_ANY_DEBOUNCE_MS));
  });

const previewHas = (fieldId: string) =>
  document.querySelector(`[data-builder-preview] [data-card-field="${fieldId}"]`) !== null;

describe("Save changes — editing sends nothing", () => {
  it("a tick changes the card at once, shows Save changes, and sends nothing", async () => {
    await mount();
    expect(saveButton()).toBeNull();
    expect(previewHas(MOBILE)).toBe(false);

    await userEvent.click(mobileToggle());

    expect(previewHas(MOBILE)).toBe(true);
    expect(saveButton()).not.toBeNull();
    expect(saveButton()?.textContent).toBe("Save changes");
    expect(within(bar()!).getByText("Unsaved changes")).toBeTruthy();
    // The bar sits in the same column as the toolbar (the editor column), pinned with `sticky`,
    // and its buttons read Discard then Save changes.
    expect(bar()!.parentElement!.contains(toolbar())).toBe(true);
    expect(bar()!.className).toContain("sticky");
    expect(
      [...bar()!.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Discard", "Save changes"]);
    // Not in the toolbar any more: that row is the tabs and Send update.
    expect(toolbar().querySelector("[data-save-changes-button]")).toBeNull();
    /* Not "not yet": nothing goes out however long the owner waits. */
    await idle();
    expect(setFields).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(saveButton()).not.toBeNull();
  });

  it("taking the field off again makes the button go away", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    expect(saveButton()).not.toBeNull();
    await userEvent.click(mobileToggle());
    expect(saveButton()).toBeNull();
    expect(document.querySelector("[data-save-bar]")).toBeNull();
  });

  it("a look chosen in Design is a draft too, and Save sends it as one PATCH", async () => {
    await mount();
    await userEvent.click(screen.getByRole("tab", { name: "Design" }));
    await userEvent.click(document.querySelector<HTMLElement>('[data-look-option="emerald-gradient"]')!);
    await userEvent.click(screen.getByRole("textbox", { name: "Card name" }));
    await userEvent.keyboard(" team");
    await idle();
    expect(update).not.toHaveBeenCalled();
    expect(saveButton()).not.toBeNull();

    await userEvent.click(saveButton()!);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]?.[0]).toBe(WORK.id);
    expect(update.mock.calls[0]?.[1]).toMatchObject({
      name: `${WORK.name} team`,
      paletteId: "emerald",
      finish: "gradient",
    });
    expect(update.mock.calls[0]?.[1]).not.toHaveProperty("coverUrl");
    expect(setFields).not.toHaveBeenCalled();
  });
});

describe("Save changes — saving", () => {
  it("sends the whole field set once, then the button goes and the save is announced", async () => {
    await mount();
    const before = fetchCardsData.mock.calls.length;
    await userEvent.click(mobileToggle());
    await userEvent.click(saveButton()!);

    await waitFor(() => expect(saveButton()).toBeNull());
    expect(setFields).toHaveBeenCalledTimes(1);
    const sent = (setFields.mock.calls[0]?.[1] as { fields: { fieldId: string }[] }).fields.map(
      (entry) => entry.fieldId,
    );
    expect(sent).toEqual([...WORK.fieldIds, MOBILE]);
    expect(update).not.toHaveBeenCalled();
    // In the action bar, not the toolbar: the toolbar must not change width when a save lands.
    expect(within(bar()!).getByText("All changes saved")).toBeTruthy();
    expect(within(toolbar()).queryByText("All changes saved")).toBeNull();
    // The toolbar is the tabs and Send update, and nothing else, in every save state — so Send update
    // never changes row when a save lands (client, 2026-10-07).
    expect(toolbar().querySelector("[data-save-changes-state], [data-save-changes]")).toBeNull();
    expect(toolbar().querySelector("[data-send-update]")).not.toBeNull();
    expect(document.querySelector("[data-save-announcer]")?.textContent).toContain("Changes saved.");
    /* Re-read so the rest of the page (and Send update) reflects the save. */
    await waitFor(() => expect(fetchCardsData.mock.calls.length).toBeGreaterThan(before));
    /* Still on the card, still ticked. */
    expect(mobileToggle().getAttribute("aria-checked") ?? mobileToggle().getAttribute("data-state")).toMatch(
      /true|checked/,
    );
  });

  it("a failed save keeps the draft, says why with the reference, and can be retried", async () => {
    setFields.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "DUPLICATE_FIELD_IN_CARD",
        rawMessage: "duplicate",
        requestId: "req-7f3a",
      }),
    );
    await mount();
    await userEvent.click(mobileToggle());
    await userEvent.click(saveButton()!);

    const error = await within(bar()!).findByText(/That field is already on this card/);
    expect(error.textContent).toContain("Reference: req-7f3a");
    expect(document.querySelector("[data-save-announcer]")?.textContent).toContain("Changes not saved.");
    expect(saveButton(), "the button stays so the owner can retry").not.toBeNull();
    expect(previewHas(MOBILE), "the draft is kept").toBe(true);

    await userEvent.click(saveButton()!);
    await waitFor(() => expect(saveButton()).toBeNull());
    expect(setFields).toHaveBeenCalledTimes(2);
  });

  it("on a partial failure says some changes were saved and keeps the rest unsaved", async () => {
    setFields.mockRejectedValueOnce(new ApiError({ status: 500, code: "UNKNOWN", rawMessage: "boom" }));
    await mount();
    await userEvent.click(screen.getByRole("tab", { name: "Design" }));
    await userEvent.click(document.querySelector<HTMLElement>('[data-look-option="emerald-gradient"]')!);
    await userEvent.click(screen.getByRole("tab", { name: "Fields" }));
    await userEvent.click(mobileToggle());
    await userEvent.click(saveButton()!);

    await within(bar()!).findByText(/Some changes were saved, but the fields on this card were not/);
    expect(update).toHaveBeenCalledTimes(1);
    expect(saveButton()).not.toBeNull();

    /* The retry sends only what did not land. */
    await userEvent.click(saveButton()!);
    await waitFor(() => expect(saveButton()).toBeNull());
    expect(update).toHaveBeenCalledTimes(1);
    expect(setFields).toHaveBeenCalledTimes(2);
  });
});

describe("Save changes — discarding, leaving and the rest of the screen", () => {
  it("Discard puts a single change back at once", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    await userEvent.click(within(bar()!).getByRole("button", { name: "Discard" }));
    expect(saveButton()).toBeNull();
    expect(previewHas(MOBILE)).toBe(false);
    expect(setFields).not.toHaveBeenCalled();
  });

  it("Discard asks first when there is more than one change", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    await userEvent.click(screen.getByRole("checkbox", { name: `Show Role on ${WORK.name}` }));
    await userEvent.click(within(bar()!).getByRole("button", { name: "Discard" }));

    const dialog = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
    expect(dialog.textContent).toContain("2 unsaved changes will be lost.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(saveButton()).toBeNull());
    expect(previewHas(MOBILE)).toBe(false);
  });

  it("registers the leave warning only while there are unsaved changes", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    await mount();
    const registered = () => add.mock.calls.filter(([type]) => type === "beforeunload").length;
    expect(registered()).toBe(0);

    await userEvent.click(mobileToggle());
    expect(registered()).toBe(1);

    await userEvent.click(mobileToggle());
    expect(remove.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
  });

  it("asks before following a link away with unsaved changes, and stays when told to", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    /* happy-dom has no `confirm`; the browser's is synchronous and this stands in for "Cancel". */
    const confirm = vi.fn(() => false);
    Object.defineProperty(window, "confirm", { value: confirm, configurable: true, writable: true });
    const link = document.createElement("a");
    link.href = "/dashboard";
    link.textContent = "Dashboard";
    document.body.appendChild(link);
    const followed = vi.fn((event: MouseEvent) => event.defaultPrevented);
    link.addEventListener("click", followed);

    await userEvent.click(link);
    expect(confirm).toHaveBeenCalledTimes(1);
    /* Stopped in the capture phase: the link's own handler (where `<Link>` navigates) never ran. */
    expect(followed).not.toHaveBeenCalled();
    link.remove();
  });

  it("keeps Send update disabled with the reason while the card has unsaved changes", async () => {
    await mount();
    const send = () => document.querySelector<HTMLElement>("[data-send-update]")!;
    await userEvent.click(mobileToggle());
    expect(send().getAttribute("data-send-update-state")).toBe("blocked");
    expect(send().getAttribute("aria-disabled")).toBe("true");
    expect(send().getAttribute("title")).toBe("Save your changes first, then send the update.");
    await userEvent.click(send());
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(saveButton()!);
    await waitFor(() => expect(send().getAttribute("data-send-update-state")).not.toBe("blocked"));
  });

  it("keeps the draft across Fields, Design and Share, without saving it", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    await userEvent.click(screen.getByRole("tab", { name: "Design" }));
    expect(saveButton()).not.toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Share" }));
    expect(saveButton()).not.toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Fields" }));

    expect(mobileToggle().getAttribute("data-state")).toBe("checked");
    expect(previewHas(MOBILE)).toBe(true);
    expect(setFields).not.toHaveBeenCalled();
  });

  it("asks before switching cards with unsaved changes — Stay keeps them, Discard switches", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    const otherPill = () => document.querySelector<HTMLElement>(`[data-card-switch="${OTHER.id}"]`)!;

    await userEvent.click(otherPill());
    let dialog = await screen.findByRole("dialog", { name: `Save changes to ${WORK.name}?` });
    await userEvent.click(within(dialog).getByRole("button", { name: "Stay" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(otherPill().getAttribute("aria-checked")).toBe("false");
    expect(saveButton()).not.toBeNull();

    await userEvent.click(otherPill());
    dialog = await screen.findByRole("dialog", { name: `Save changes to ${WORK.name}?` });
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(otherPill().getAttribute("aria-checked")).toBe("true"));
    expect(setFields).not.toHaveBeenCalled();
  });

  it("Save and switch saves first, then opens the other card", async () => {
    await mount();
    await userEvent.click(mobileToggle());
    await userEvent.click(document.querySelector<HTMLElement>(`[data-card-switch="${OTHER.id}"]`)!);
    const dialog = await screen.findByRole("dialog", { name: `Save changes to ${WORK.name}?` });
    await act(async () => {
      await userEvent.click(within(dialog).getByRole("button", { name: "Save and switch" }));
    });
    await waitFor(() =>
      expect(
        document.querySelector(`[data-card-switch="${OTHER.id}"]`)?.getAttribute("aria-checked"),
      ).toBe("true"),
    );
    expect(setFields).toHaveBeenCalledTimes(1);
    expect(setFields.mock.calls[0]?.[0]).toBe(WORK.id);
  });
});
