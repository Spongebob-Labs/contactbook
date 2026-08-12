import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardCreateModal } from "@/components/cards/card-create-modal";
import {
  readCardFieldSelection,
  writeCardFieldSelection,
} from "@/lib/card-field-selection";
import {
  copyCardFieldMappings,
  createCard,
  listCardsWithFieldCounts,
} from "@/lib/cards-api";
import { syncCardFieldMappings } from "@/lib/card-field-sync";
import { useAuth } from "@/context/auth-context";
import { fetchProfileMe } from "@/lib/profile-api";
import { toast } from "sonner";
import type { ContactCard, ProfileMeResponse } from "@/lib/types";

vi.mock("@/lib/cards-api", () => ({
  createCard: vi.fn(),
  listCardsWithFieldCounts: vi.fn(),
  copyCardFieldMappings: vi.fn(),
}));

vi.mock("@/lib/card-field-sync", () => ({
  syncCardFieldMappings: vi.fn(),
}));

vi.mock("@/lib/profile-api", () => ({
  fetchProfileMe: vi.fn(),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const USER_ID = "user-1";

/** Landline is deliberately unfilled, so the "no value yet" row is a real case. */
const profile = {
  identity: {
    firstName: "Aayush",
    lastName: "Sharma",
    primaryPhone: "+919347243575",
    primaryEmail: "as@example.com",
    profilePhoto: "https://cdn.example.com/me.png",
  },
  personal: {
    groupId: "personal-1",
    tag: "Personal",
    mobile: "+919347243575",
    landline: null,
    email: "as@example.com",
    dateOfBirth: "1998-04-02",
    postalAddress: {
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pincode: "560001",
      country: "IN",
    },
  },
  work: [],
  business: [],
  socials: [{ groupId: "social-1", tag: "Social", twitter: "https://x.com/aayush" }],
  financial: { bankAccounts: [], digitalWallets: [], cryptoWallets: [] },
} as unknown as ProfileMeResponse;

function makeCard(overrides: Partial<ContactCard>): ContactCard {
  return {
    id: "card-1",
    userId: USER_ID,
    name: "Card",
    type: "PERSONAL",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

const workCard = makeCard({
  id: "card-work",
  name: "Work card",
  type: "BUSINESS",
  updatedAt: "2026-08-01T10:00:00.000Z",
});
const personalCard = makeCard({
  id: "card-personal",
  name: "Personal card",
  type: "PERSONAL",
  updatedAt: "2026-08-09T10:00:00.000Z",
});
const createdCard = makeCard({ id: "card-new", name: "Client card" });

const onClose = vi.fn();
const onCreated = vi.fn();

type User = ReturnType<typeof userEvent.setup>;

function renderModal(): void {
  render(<CardCreateModal open onClose={onClose} onCreated={onCreated} />);
}

function nameInput(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>("Card name");
}

function button(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name });
}

function checkbox(name: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("checkbox", { name });
}

/** Renders and advances to "Start from", waiting for the preset list to arrive. */
async function goToPresets(user: User): Promise<void> {
  renderModal();
  await user.click(button("Next"));
  await screen.findByRole("radio", { name: /Personal card/ });
}

/**
 * Renders and advances to "What it shares" **having picked the personal-card
 * preset**. The preset has to be chosen explicitly: the wizard defaults to Start
 * blank so that no card the user did not pick can seed a new one.
 */
async function goToFields(user: User): Promise<void> {
  await goToPresets(user);
  await user.click(screen.getByRole("radio", { name: /Personal card/ }));
  await user.click(button("Next"));
  await screen.findByRole("button", { name: "Create card" });
}

beforeEach(() => {
  // `restoreMocks` strips the implementations between tests, so re-arm them here.
  vi.mocked(useAuth).mockReturnValue({
    userId: USER_ID,
    profileIdentity: profile.identity,
    profileOnboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(async () => undefined),
    markAuthenticated: vi.fn(),
    logout: vi.fn(async () => undefined),
  });
  // Returned oldest-first so "newest first" cannot pass by accident.
  vi.mocked(listCardsWithFieldCounts).mockResolvedValue([workCard, personalCard]);
  vi.mocked(fetchProfileMe).mockResolvedValue(profile);
  vi.mocked(createCard).mockResolvedValue(createdCard);
  vi.mocked(copyCardFieldMappings).mockResolvedValue({ copied: 2, total: 2 });
  vi.mocked(syncCardFieldMappings).mockResolvedValue({
    added: 2,
    alreadyMapped: 0,
    candidates: 2,
  });

  // The preset advertises exactly three types, one of which has no value.
  writeCardFieldSelection(USER_ID, personalCard.id, ["PHONE", "LANDLINE", "EMAIL"]);
});

describe("step 1 — Card", () => {
  it("prefills the name from the signed-in profile identity", () => {
    renderModal();
    expect(nameInput().value).toBe("Aayush Sharma");
  });

  it("blocks Next until the card has a name", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(button("Next").disabled).toBe(false);

    await user.clear(nameInput());
    expect(button("Next").disabled).toBe(true);

    await user.type(nameInput(), "Client card");
    expect(button("Next").disabled).toBe(false);
  });

  it("offers the three card types with Personal selected", () => {
    renderModal();
    expect(
      screen.getByRole("radio", { name: "Personal" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByRole("radio", { name: "Work" })).not.toBeNull();
    expect(screen.queryByRole("radio", { name: "Custom" })).not.toBeNull();
  });
});

describe("step 2 — Start from", () => {
  it("lists the user's cards newest first, with Start blank last", async () => {
    const user = userEvent.setup();
    await goToPresets(user);

    const options = screen.getAllByRole("radio").map((option) => option.textContent ?? "");
    expect(options).toHaveLength(3);
    expect(options[0]).toContain("Personal card");
    expect(options[1]).toContain("Work card");
    expect(options[2]).toContain("Start blank");
  });

  /*
    Defaulting to the newest card meant opening the wizard and pressing Next
    silently seeded the new card from the last one made, with its details already
    ticked on step 3 — indistinguishable from choices the user had made.
  */
  it("preselects Start blank, never one of the user's cards", async () => {
    const user = userEvent.setup();
    await goToPresets(user);

    expect(
      screen.getByRole("radio", { name: /Start blank/ }).getAttribute("aria-checked"),
    ).toBe("true");
    for (const name of [/Personal card/, /Work card/]) {
      expect(screen.getByRole("radio", { name }).getAttribute("aria-checked")).toBe(
        "false",
      );
    }
  });

  it("arrives at step 3 with nothing ticked when left on Start blank", async () => {
    const user = userEvent.setup();
    await goToPresets(user);
    await user.click(button("Next"));
    await screen.findByRole("button", { name: "Create card" });

    expect(
      screen.queryAllByRole<HTMLInputElement>("checkbox").filter((box) => box.checked),
    ).toHaveLength(0);
  });

  /*
    Blank still has to offer the choices. Leaving them behind "Add more fields"
    made the step look like it had nothing on it, so "I pick the fields" was not
    actually available.
  */
  it("lists every field of the card's type to pick from when blank", async () => {
    const user = userEvent.setup();
    await goToPresets(user);
    await user.click(button("Next"));
    await screen.findByRole("button", { name: "Create card" });

    expect(checkbox("Mobile").checked).toBe(false);
    expect(checkbox("Email").checked).toBe(false);
    expect(screen.queryByRole("button", { name: /Add more fields/ })).toBeNull();
  });

  it("shows each preset's type badge and the fields it gives", async () => {
    const user = userEvent.setup();
    await goToPresets(user);

    const personal = screen.getByRole("radio", { name: /Personal card/ });
    expect(personal.textContent).toContain("Personal");
    expect(personal.textContent).toContain("Mobile");
    expect(personal.textContent).toContain("Landline");
    expect(personal.textContent).toContain("Email");

    expect(screen.getByRole("radio", { name: /Work card/ }).textContent).toContain("Work");
  });

  it("warns that Start blank shares only the name", async () => {
    const user = userEvent.setup();
    await goToPresets(user);

    expect(screen.getByRole("radio", { name: /Start blank/ }).textContent).toContain(
      "Shares only your name until you add details.",
    );
  });

  it("explains the name-only outcome and still lets a card-less user continue", async () => {
    vi.mocked(listCardsWithFieldCounts).mockResolvedValue([]);
    const user = userEvent.setup();
    renderModal();
    await user.click(button("Next"));

    expect(await screen.findByText(/only your name/i)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(button("Next").disabled).toBe(false);
  });

  it("surfaces a load failure instead of a silently empty list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(listCardsWithFieldCounts).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderModal();
    await user.click(button("Next"));

    expect(await screen.findByText("Could not load your cards")).toBeTruthy();
  });
});

describe("step 3 — What it shares", () => {
  it("renders only the preset's fields, ticked, with their profile values", async () => {
    const user = userEvent.setup();
    await goToFields(user);

    expect(checkbox("Mobile").checked).toBe(true);
    expect(checkbox("Email").checked).toBe(true);
    expect(screen.queryByText("+919347243575")).not.toBeNull();
    expect(screen.queryByText("as@example.com")).not.toBeNull();

    // In the profile, but not offered by this preset.
    expect(screen.queryByRole("checkbox", { name: "Birthday" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Address" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Photo" })).toBeNull();
  });

  it("disables a field with no profile value and says where to add it", async () => {
    const user = userEvent.setup();
    await goToFields(user);

    expect(checkbox("Landline").disabled).toBe(true);
    expect(checkbox("Landline").checked).toBe(false);
    expect(
      screen.queryByText("Not added yet — add it on your profile."),
    ).not.toBeNull();
  });

  it("reveals the remaining fields behind Add more fields", async () => {
    const user = userEvent.setup();
    await goToFields(user);
    expect(screen.queryByRole("checkbox", { name: "Birthday" })).toBeNull();

    await user.click(button(/Add more fields/));

    expect(checkbox("Birthday").checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: "Address" })).not.toBeNull();
  });

  it("lets the user untick a field before creating", async () => {
    const user = userEvent.setup();
    await goToFields(user);

    await user.click(checkbox("Email"));
    expect(checkbox("Email").checked).toBe(false);
  });
});

describe("creating the card", () => {
  /*
    The preset chooses the share selection, never the mappings. Copying a preset
    card's `fieldId`s verbatim gave a Work card the personal group's phone and
    email and none of the workplace's company or job title, because a field
    belongs to exactly one group — a 149-byte VCF under "6 of 6 shared".
  */
  it("creates, attaches the card's own type's fields, then saves the selection — in that order", async () => {
    const order: string[] = [];
    vi.mocked(createCard).mockImplementation(async () => {
      order.push("createCard");
      return createdCard;
    });
    vi.mocked(syncCardFieldMappings).mockImplementation(async () => {
      order.push("syncCardFieldMappings");
      // The selection must not be persisted before the attach has run.
      expect(readCardFieldSelection(USER_ID, createdCard.id)).toEqual([]);
      return { added: 2, alreadyMapped: 0, candidates: 2 };
    });

    const user = userEvent.setup();
    await goToFields(user);
    await user.click(button("Create card"));

    expect(order).toEqual(["createCard", "syncCardFieldMappings"]);
    expect(createCard).toHaveBeenCalledWith({ name: "Aayush Sharma", type: "PERSONAL" });
    expect(syncCardFieldMappings).toHaveBeenCalledWith("card-new", "PERSONAL");
    expect(copyCardFieldMappings).not.toHaveBeenCalled();
    expect(readCardFieldSelection(USER_ID, "card-new")).toEqual(["PHONE", "EMAIL"]);
    expect(onCreated).toHaveBeenCalledWith(createdCard);
    expect(onClose).toHaveBeenCalled();
  });

  it("attaches by the card's own type, not the preset card's type", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(nameInput());
    await user.type(nameInput(), "Work card");
    await user.click(screen.getByRole("radio", { name: "Work" }));
    await user.click(button("Next"));
    await screen.findByRole("radio", { name: /Start blank/ });
    await user.click(button("Next"));
    await screen.findByRole("button", { name: "Create card" });
    await user.click(button("Create card"));

    expect(syncCardFieldMappings).toHaveBeenCalledWith("card-new", "BUSINESS");
  });

  it("uses the name and type chosen on step 1", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(nameInput());
    await user.type(nameInput(), "Client card");
    await user.click(screen.getByRole("radio", { name: "Custom" }));
    await user.click(button("Next"));
    await screen.findByRole("radio", { name: /Personal card/ });
    await user.click(button("Next"));
    await screen.findByRole("button", { name: "Create card" });
    await user.click(button("Create card"));

    expect(createCard).toHaveBeenCalledWith({ name: "Client card", type: "CUSTOM" });
  });

  it("reports the real number of attached details, never just 'done'", async () => {
    vi.mocked(syncCardFieldMappings).mockResolvedValue({
      added: 3,
      alreadyMapped: 0,
      candidates: 5,
    });
    const user = userEvent.setup();
    await goToFields(user);
    await user.click(button("Create card"));

    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toContain("3");
  });

  /*
    "Start blank" used to mean permanently blank — `POST /cards` creates no field
    mappings, so the card could only ever send a bare name.
  */
  it("still attaches the profile's fields when starting blank", async () => {
    const user = userEvent.setup();
    await goToPresets(user);
    await user.click(screen.getByRole("radio", { name: /Start blank/ }));
    await user.click(button("Next"));
    await screen.findByRole("button", { name: "Create card" });

    // Directly visible now — blank lists the choices instead of hiding them.
    await user.click(checkbox("Mobile"));
    await user.click(button("Create card"));

    expect(createCard).toHaveBeenCalledTimes(1);
    expect(syncCardFieldMappings).toHaveBeenCalledWith("card-new", "PERSONAL");
    expect(copyCardFieldMappings).not.toHaveBeenCalled();
    expect(readCardFieldSelection(USER_ID, "card-new")).toEqual(["PHONE"]);
  });

  it("still creates the card and warns when attaching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(syncCardFieldMappings).mockRejectedValue(new Error("boom"));

    const user = userEvent.setup();
    await goToFields(user);
    await user.click(button("Create card"));

    expect(toast.warning).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(createdCard);
    expect(readCardFieldSelection(USER_ID, "card-new")).toEqual(["PHONE", "EMAIL"]);
  });

  it("stores the selection under the signed-in user, not browser-wide", async () => {
    const user = userEvent.setup();
    await goToFields(user);
    await user.click(button("Create card"));

    expect(readCardFieldSelection(USER_ID, "card-new")).toEqual(["PHONE", "EMAIL"]);
    expect(readCardFieldSelection("someone-else", "card-new")).toEqual([]);
  });

  it("keeps the modal open and reports the failure when creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createCard).mockRejectedValue(new Error("nope"));

    const user = userEvent.setup();
    await goToFields(user);
    await user.click(button("Create card"));

    expect(toast.error).toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("the steps that were removed", () => {
  it("has three steps and never shows the profile editor or the message picker", async () => {
    const user = userEvent.setup();
    await goToFields(user);

    expect(screen.queryByText("Step 3 of 3")).not.toBeNull();
    expect(screen.queryByText("Card details")).toBeNull();
    expect(screen.queryByText(/WhatsApp approves/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
  });
});

describe("CardCreateModal preset loading", () => {
  it("starts loading when the modal opens, not when step 2 is reached", async () => {
    renderModal();

    // The user spends step 1 typing a name; the requests should already be in
    // flight by then, so step 2 is not a cold wait behind two round-trips.
    await vi.waitFor(() => {
      expect(vi.mocked(listCardsWithFieldCounts)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(fetchProfileMe)).toHaveBeenCalledTimes(1);
  });

  it("still offers the presets when the profile request fails", async () => {
    // The profile only enriches the descriptions and step 3's values. Letting it
    // take the card list down with it strands the user on an empty step 2.
    vi.mocked(fetchProfileMe).mockRejectedValue(new Error("profile down"));
    const user = userEvent.setup();

    renderModal();
    await user.click(button("Next"));

    expect(await screen.findByRole("radio", { name: /Personal card/ })).toBeTruthy();
    expect(screen.queryByText("Could not load your cards")).toBeNull();
  });

  it("surfaces a retry when the card list itself fails", async () => {
    vi.mocked(listCardsWithFieldCounts).mockRejectedValue(new Error("cards down"));
    const user = userEvent.setup();

    renderModal();
    await user.click(button("Next"));

    expect(await screen.findByText("Could not load your cards")).toBeTruthy();
    expect(button("Retry")).toBeTruthy();
  });

  it("never leaves step 2 on skeletons once the card list settles", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(button("Next"));

    await screen.findByRole("radio", { name: /Personal card/ });
    expect(screen.queryByText(/^Loading/)).toBeNull();
    expect(button("Next").hasAttribute("disabled")).toBe(false);
  });
});

describe("CardCreateModal slow network", () => {
  it("turns an indefinite wait into a retryable error instead of endless skeletons", async () => {
    vi.useFakeTimers();
    try {
      // A request that never settles: nothing in the fetch layer times out, so
      // without a watchdog step 2 sits on skeletons with Next disabled forever.
      vi.mocked(listCardsWithFieldCounts).mockReturnValue(new Promise<ContactCard[]>(() => {}));

      renderModal();
      // fireEvent, not userEvent: userEvent schedules its own real timers and
      // deadlocks against vi's fake ones.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      fireEvent.click(button("Next"));

      expect(screen.queryByText("Could not load your cards")).not.toBeNull();
      expect(button("Retry")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CardCreateModal preset quality", () => {
  /*
    Nothing is preselected any more, so this is about *order*: the card that
    actually carries details has to be the first one offered, ahead of a newer
    empty one, or the obvious pick is the one that copies nothing.
  */
  it("offers a card that has details ahead of a newer empty one", async () => {
    vi.mocked(listCardsWithFieldCounts).mockResolvedValue([
      makeCard({
        id: "card-empty",
        name: "Empty newest",
        updatedAt: "2026-08-09T17:00:00.000Z",
        mappedFieldIds: [],
      }),
      makeCard({
        id: "card-full",
        name: "Onboarding card",
        updatedAt: "2026-08-01T07:00:00.000Z",
        mappedFieldIds: ["f1", "f2", "f3"],
      }),
    ]);
    const user = userEvent.setup();

    renderModal();
    await user.click(button("Next"));
    await screen.findByRole("radio", { name: /Onboarding card/ });

    const options = screen.getAllByRole("radio").map((option) => option.textContent ?? "");
    expect(options[0]).toContain("Onboarding card");
    expect(options[1]).toContain("Empty newest");
    // Still nothing chosen for the user.
    expect(
      screen.getByRole("radio", { name: /Start blank/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("says plainly that an empty card would share only a name", async () => {
    vi.mocked(listCardsWithFieldCounts).mockResolvedValue([
      makeCard({ id: "card-empty", name: "Empty card", mappedFieldIds: [] }),
    ]);
    const user = userEvent.setup();

    renderModal();
    await user.click(button("Next"));

    expect(await screen.findByText(/no details yet/i)).toBeTruthy();
  });
});
