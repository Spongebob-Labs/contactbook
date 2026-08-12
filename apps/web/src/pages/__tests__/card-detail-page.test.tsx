/**
 * Card detail page: two tabs over one pinned vCard preview, plus the per-card
 * share-field selection that survives a reload.
 *
 * Details and their share switches live together on the Card tab — they were
 * split across two tabs, which read as two unrelated jobs.
 *
 * The API layer is mocked wholesale — this asserts page structure and the
 * localStorage round-trip, not transport, which `card-share-api.integration`
 * already covers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import CardDetailPage from "@/pages/card-detail-page";
import {
  readCardFieldSelection,
  writeCardFieldSelection,
} from "@/lib/card-field-selection";
import type { CardShareBatch } from "@/lib/card-share-types";
import type { ContactCard, ProfileMeResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getCard: vi.fn(),
  listCardsWithFieldCounts: vi.fn(),
  listCardFieldMappings: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  copyCardFieldMappings: vi.fn(),
  addCardFieldMapping: vi.fn(),
  listProfileFields: vi.fn(),
  listCardShares: vi.fn(),
  generateCardVcard: vi.fn(),
  getCardShareBatch: vi.fn(),
  resendShareRecipient: vi.fn(),
  listShareTemplates: vi.fn(),
  shareCard: vi.fn(),
  fetchProfileMe: vi.fn(),
  patchProfileMe: vi.fn(),
  uploadProfilePhoto: vi.fn(),
}));

vi.mock("@/context/auth-context", () => ({ useAuth: mocks.useAuth }));

// The tour is covered by its own suite. Left live it would mount driver.js over
// this page and its popover controls would collide with the page's own buttons.
vi.mock("@/lib/use-card-tour", () => ({ useCardTour: () => {} }));

vi.mock("@/lib/cards-api", () => ({
  getCard: mocks.getCard,
  listCardsWithFieldCounts: mocks.listCardsWithFieldCounts,
  listCardFieldMappings: mocks.listCardFieldMappings,
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
  copyCardFieldMappings: mocks.copyCardFieldMappings,
  addCardFieldMapping: mocks.addCardFieldMapping,
}));

vi.mock("@/lib/card-share-api", () => ({
  listCardShares: mocks.listCardShares,
  generateCardVcard: mocks.generateCardVcard,
  getCardShareBatch: mocks.getCardShareBatch,
  resendShareRecipient: mocks.resendShareRecipient,
  listShareTemplates: mocks.listShareTemplates,
  shareCard: mocks.shareCard,
  renderTemplateBody: (body: string) => body,
}));

vi.mock("@/lib/profile-api", () => ({
  fetchProfileMe: mocks.fetchProfileMe,
  patchProfileMe: mocks.patchProfileMe,
  uploadProfilePhoto: mocks.uploadProfilePhoto,
  listProfileFields: mocks.listProfileFields,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const USER_ID = "user-1";
const CARD_ID = "card-1";

const CARD: ContactCard = {
  id: CARD_ID,
  userId: USER_ID,
  name: "Work card",
  type: "PERSONAL",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
  isSensitive: false,
  mappedFieldIds: ["field-a", "field-b"],
};

const PROFILE: ProfileMeResponse = {
  identity: {
    firstName: "Aayush",
    lastName: "Sharma",
    primaryPhone: "+919876543210",
    primaryEmail: "aayush@example.com",
    profilePhoto: null,
  },
  personal: {
    groupId: "group-personal",
    tag: "Personal",
    mobile: "+919876543210",
    email: "aayush@example.com",
  },
  work: [],
  business: [],
  socials: [],
  financial: { bankAccounts: [], digitalWallets: [], cryptoWallets: [] },
};

/** Fully delivered so `ShareBatchStatus` never starts its poll timer. */
const BATCH: CardShareBatch = {
  id: "batch-1",
  cardId: CARD_ID,
  cardName: "Work card",
  cardType: "PERSONAL",
  note: "Great meeting you",
  createdAt: "2026-08-06T09:00:00.000Z",
  recipients: [
    {
      id: "recipient-1",
      countryCode: "+91",
      phone: "9876543210",
      contactId: null,
      dispatchStatus: "DISPATCHED",
      deliveryStatus: "DELIVERED",
      lastDispatchError: null,
      sentAt: "2026-08-06T09:00:05.000Z",
      deliveredAt: "2026-08-06T09:00:09.000Z",
      readAt: null,
      failedAt: null,
      createdAt: "2026-08-06T09:00:00.000Z",
    },
  ],
};

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/dashboard/cards/${CARD_ID}`]}>
      <Routes>
        <Route path="/dashboard/cards/:cardId" element={<CardDetailPage />} />
        <Route path="/dashboard/cards" element={<p>Cards list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Resolves once the card has loaded and the tab bar is on screen. */
async function renderLoadedPage(): Promise<void> {
  renderPage();
  await screen.findByRole("tab", { name: /^card$/i });
}

/** A share switch, which replaced the old per-field "Include" checkbox. */
function shareSwitch(name: string): HTMLElement {
  return screen.getByRole("switch", { name: `Share ${name}` });
}

async function openTab(name: RegExp): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name }));
}

beforeEach(() => {
  mocks.useAuth.mockReturnValue({
    userId: USER_ID,
    profileIdentity: PROFILE.identity,
    profileOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
    markAuthenticated: vi.fn(),
    logout: vi.fn(),
  });
  mocks.getCard.mockResolvedValue(CARD);
  mocks.listCardsWithFieldCounts.mockResolvedValue([CARD]);
  // The ids have to be the same ones `listProfileFields` returns below: the panel
  // joins the two to work out which types the card really carries, and a mapping
  // pointing at no known field reads as "not attached".
  mocks.listCardFieldMappings.mockResolvedValue([
    { fieldId: "pf-mobile" },
    { fieldId: "pf-email" },
  ]);
  mocks.updateCard.mockResolvedValue(CARD);
  mocks.deleteCard.mockResolvedValue(undefined);
  mocks.copyCardFieldMappings.mockResolvedValue({ copied: 2, total: 2 });
  mocks.addCardFieldMapping.mockResolvedValue({ cardId: "card-1", fieldId: "field-1" });
  // Real ids off `GET /v1/profile/me/fields` — the only endpoint that exposes
  // them, and what makes attaching possible from the client at all.
  mocks.listProfileFields.mockResolvedValue([
    {
      id: "pf-mobile",
      type: "PHONE",
      label: null,
      value: "9953266232",
      groupId: PROFILE.personal.groupId,
    },
    {
      id: "pf-email",
      type: "EMAIL",
      label: null,
      value: "vansh@example.com",
      groupId: PROFILE.personal.groupId,
    },
  ]);
  mocks.listCardShares.mockResolvedValue({
    items: [BATCH],
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  });
  mocks.generateCardVcard.mockResolvedValue({
    objectKey: "vcf/card-1.vcf",
    url: "https://cdn.example.com/vcf/card-1.vcf",
    fieldTypes: [],
    sizeBytes: 512,
  });
  mocks.listShareTemplates.mockResolvedValue([]);
  mocks.fetchProfileMe.mockResolvedValue(PROFILE);

  // VcardPreview re-fetches the generated file to parse it; keep it off the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("BEGIN:VCARD\r\nFN:Aayush Sharma\r\nEND:VCARD")),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CardDetailPage tabs", () => {
  it("renders two tabs with Card selected first", async () => {
    await renderLoadedPage();

    expect(
      screen.getByRole("tab", { name: /^card$/i }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("tab", { name: /history/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /what's shared/i })).toBeNull();
  });

  it("puts the details, their switches, and card settings on one tab", async () => {
    await renderLoadedPage();

    expect(screen.getByText("Work card", { selector: "h1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /share/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
    // Editing a value and choosing whether it is shared are one screen now.
    expect(await screen.findByText("Details")).toBeTruthy();
    expect(shareSwitch("Mobile")).toBeTruthy();
    expect(screen.getByText("Card settings")).toBeTruthy();
  });

  it("lists share batches on the History tab", async () => {
    await renderLoadedPage();
    await openTab(/history/i);

    expect(await screen.findByText("1 of 1 delivered")).toBeTruthy();
    expect(screen.getByText("+91 9876543210")).toBeTruthy();
    // Share history is only fetched once, on load — not per tab visit.
    expect(mocks.listCardShares).toHaveBeenCalledTimes(1);
  });

  it("keeps the Share and Delete buttons across every tab", async () => {
    await renderLoadedPage();
    await openTab(/history/i);

    expect(screen.getByRole("button", { name: /share/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
  });

  it("renders every tour anchor the product tour targets", async () => {
    await renderLoadedPage();

    // All four must exist on the landing tab without any navigation: the tour
    // waits for every anchor before it starts, so one that only appears after
    // a tab switch would stall it until it silently gives up.
    expect(document.querySelector('[data-tour="card-share"]')).toBeTruthy();
    expect(document.querySelector('[data-tour="card-tabs"]')).toBeTruthy();
    expect(document.querySelector('[data-tour="card-vcard-preview"]')).toBeTruthy();
    expect(document.querySelector('[data-tour="card-shared-fields"]')).toBeTruthy();
  });
});

describe("CardDetailPage field selection", () => {
  it("restores the saved selection from localStorage on mount", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE", "EMAIL"]);

    await renderLoadedPage();
    await screen.findByText("Details");

    expect(shareSwitch("Mobile").getAttribute("aria-checked")).toBe("true");
    expect(shareSwitch("Email").getAttribute("aria-checked")).toBe("true");
    // Only what is filled in can be counted, and the profile has no landline.
    expect(screen.getByText("2 of 2 shared")).toBeTruthy();
  });

  /*
    A detail with no value cannot be shared, so its switch is inert rather than
    offering a choice that the generated file would silently ignore.
  */
  it("cannot switch on a detail that has no value", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE", "EMAIL"]);

    await renderLoadedPage();
    await screen.findByText("Details");

    const landline = shareSwitch("Landline") as HTMLButtonElement;
    expect(landline.disabled).toBe(true);
    expect(landline.getAttribute("aria-checked")).toBe("false");
  });

  it("writes the selection back when the user changes it", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE"]);
    const user = userEvent.setup();

    await renderLoadedPage();
    await screen.findByText("Details");
    await user.click(shareSwitch("Email"));

    await waitFor(() => {
      expect(readCardFieldSelection(USER_ID, CARD_ID)).toEqual(["PHONE", "EMAIL"]);
    });
  });

  /*
    An empty stored selection means "everything" to the API, so it has to be
    drawn as every switch on — and switching one off has to materialise the list
    rather than leaving the empty array in place.

    Materialised from every detail on screen, not only the filled ones: switching
    Email off says "everything except email", so a landline added later should
    still go out.
  */
  it("draws a never-narrowed card as sharing everything", async () => {
    const user = userEvent.setup();

    await renderLoadedPage();
    await screen.findByText("Details");

    expect(shareSwitch("Mobile").getAttribute("aria-checked")).toBe("true");
    expect(shareSwitch("Email").getAttribute("aria-checked")).toBe("true");

    await user.click(shareSwitch("Email"));

    await waitFor(() => {
      const stored = readCardFieldSelection(USER_ID, CARD_ID);
      expect(stored).not.toContain("EMAIL");
      expect(stored).toContain("PHONE");
      expect(stored).toContain("LANDLINE");
    });
  });

  it("keeps the last shared detail on, so the card cannot silently share everything", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE"]);

    await renderLoadedPage();
    await screen.findByText("Details");

    const mobile = shareSwitch("Mobile") as HTMLButtonElement;
    expect(mobile.getAttribute("aria-checked")).toBe("true");
    expect(mobile.disabled).toBe(true);
    expect(mobile.getAttribute("title")).toBe(
      "At least one detail has to be shared.",
    );
  });

  it("forgets the card's selection once the card is deleted", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE"]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(mocks.deleteCard).toHaveBeenCalledWith(CARD_ID);
    });
    await waitFor(() => {
      expect(readCardFieldSelection(USER_ID, CARD_ID)).toEqual([]);
    });
  });

  it("keeps the selection untouched when the delete is cancelled", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE"]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(mocks.deleteCard).not.toHaveBeenCalled();
    expect(readCardFieldSelection(USER_ID, CARD_ID)).toEqual(["PHONE"]);
  });
});

describe("CardDetailPage states", () => {
  it("blocks sharing on a private card and says why", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, isSensitive: true });

    await renderLoadedPage();

    const share = screen.getByRole("button", { name: /share/i });
    expect((share as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Private cards can't be shared over WhatsApp."),
    ).toBeTruthy();
  });

  /*
    An empty card is one click from working: the server attaches unmapped fields
    on any profile patch, so saving an unchanged profile is the whole fix. The
    old flow sent the user to a different tab to copy from another card, which
    only worked if such a card happened to exist.
  */
  it("offers a one-click fix for a card that carries nothing", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, mappedFieldIds: [] });
    const user = userEvent.setup();

    await renderLoadedPage();

    expect(
      await screen.findByText("Recipients would only get your name"),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /add my details to this card/i }),
    );

    await waitFor(() => {
      expect(mocks.patchProfileMe).toHaveBeenCalled();
    });
    // The card is re-read, so the empty state can clear without a reload.
    await waitFor(() => {
      expect(mocks.getCard).toHaveBeenCalledTimes(2);
    });
  });

  /*
    The patch only attaches fields where the server's card-mapping backfill is
    deployed. Against an API without it the patch returns 200 and the card stays
    name-only — announcing success there is what made a broken share look like a
    working one.
  */
  /*
    The fix for empty contacts. `PATCH /profile/me` only stores values as profile
    fields; a card's content is `CardFieldMapping` rows, so the ids from
    `GET /v1/profile/me/fields` have to be posted to
    `POST /cards/:id/field-mappings` or the card keeps sending a bare name.
  */
  it("maps the profile's own field ids onto an empty card", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, mappedFieldIds: [] });
    mocks.listCardFieldMappings.mockResolvedValue([]);
    const user = userEvent.setup();

    await renderLoadedPage();
    await screen.findByText("Recipients would only get your name");
    await user.click(
      screen.getByRole("button", { name: /add my details to this card/i }),
    );

    await waitFor(() => {
      expect(mocks.addCardFieldMapping).toHaveBeenCalledWith("card-1", "pf-mobile");
      expect(mocks.addCardFieldMapping).toHaveBeenCalledWith("card-1", "pf-email");
    });
  });

  /*
    The "6 of 6 shared, 149-byte VCF" bug. A Work card built from a personal
    card's preset held the personal group's fields, so the editor drew Company
    and Job title from `work[0]` with their switches on while the card carried no
    such mapping and the file no ORG line. A switch only filters what is
    attached, so it must not offer a detail the card does not hold.
  */
  it("will not show a detail as shared when the card does not carry it", async () => {
    mocks.listCardFieldMappings.mockResolvedValue([{ fieldId: "pf-email" }]);
    await renderLoadedPage();

    const mobile = await screen.findByRole("switch", { name: "Share Mobile" });
    expect(mobile.getAttribute("aria-checked")).toBe("false");
    expect(mobile.hasAttribute("disabled")).toBe(true);
    expect(mobile.getAttribute("title")).toContain("Not on this card yet");
    // The attached one still reads as shared.
    expect(
      screen.getByRole("switch", { name: "Share Email" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("names the details that would silently stay out of the file", async () => {
    mocks.listCardFieldMappings.mockResolvedValue([{ fieldId: "pf-email" }]);
    await renderLoadedPage();

    expect(await screen.findByText("1 detail below won't be sent")).toBeTruthy();
    expect(screen.getByText(/Mobile has a value on your profile/)).toBeTruthy();
  });

  it("does not claim success when there was nothing to attach", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, mappedFieldIds: [] });
    mocks.listCardFieldMappings.mockResolvedValue([]);
    mocks.listProfileFields.mockResolvedValue([]);
    const user = userEvent.setup();

    await renderLoadedPage();
    await screen.findByText("Recipients would only get your name");
    await user.click(
      screen.getByRole("button", { name: /add my details to this card/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Nothing could be attached"),
      );
    });
    expect(mocks.addCardFieldMapping).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith("Your details are on this card.");
  });

  /*
    A field that only starts existing when the profile is saved still has to reach
    the card in the same action — otherwise "Save details" silently leaves the new
    landline off every share.
  */
  it("attaches newly saved values without a second click", async () => {
    // Email is on the card, mobile is not — the state a first-time value is in.
    mocks.listCardFieldMappings.mockResolvedValue([{ fieldId: "pf-email" }]);
    const user = userEvent.setup();

    await renderLoadedPage();
    // Awaited: the Details panel fetches the profile after the tab bar mounts, so
    // the inputs are not there on the first paint.
    const input = await screen.findByRole("textbox", { name: /^mobile$/i });
    await user.clear(input);
    await user.type(input, "9347243575");
    await user.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => {
      expect(mocks.patchProfileMe).toHaveBeenCalled();
      expect(mocks.addCardFieldMapping).toHaveBeenCalledWith("card-1", "pf-mobile");
    });
  });

  /*
    Copying posts real field ids read off another card, so it works whether or not
    the server backfills mappings on patch — the recovery path that always exists.
  */
  it("offers copying from a card that does carry details", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, mappedFieldIds: [] });
    mocks.listCardsWithFieldCounts.mockResolvedValue([
      { ...CARD, mappedFieldIds: [] },
      { ...CARD, id: "card-2", name: "Personal", mappedFieldIds: ["f1", "f2"] },
    ]);
    const user = userEvent.setup();

    await renderLoadedPage();

    const copyButton = await screen.findByRole("button", {
      name: /copy details from "Personal"/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(mocks.copyCardFieldMappings).toHaveBeenCalledWith("card-2", CARD.id);
    });
  });

  it("says nothing about being empty once the card carries details", async () => {
    await renderLoadedPage();
    await screen.findByText("Details");

    expect(screen.queryByText("Recipients would only get your name")).toBeNull();
  });

  it("shows the not-found state when the card is missing", async () => {
    const { ApiError } = await import("@/lib/api");
    mocks.getCard.mockRejectedValue(new ApiError("Not found", 404, undefined));

    renderPage();

    expect(await screen.findByText("We couldn't find that card.")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /^card$/i })).toBeNull();
  });

  it("shows a load error when the card cannot be fetched", async () => {
    const { ApiError } = await import("@/lib/api");
    mocks.getCard.mockRejectedValue(new ApiError("Boom", 500, undefined));

    renderPage();

    expect(await screen.findByText("Could not load card")).toBeTruthy();
  });

  it("surfaces a share-history error on the History tab", async () => {
    mocks.listCardShares.mockRejectedValue(new Error("nope"));

    await renderLoadedPage();
    await openTab(/history/i);

    const panel = await screen.findByText("Could not load share history");
    expect(panel).toBeTruthy();
  });

  it("pages through share history", async () => {
    mocks.listCardShares.mockResolvedValue({
      items: [BATCH],
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    const user = userEvent.setup();

    await renderLoadedPage();
    await openTab(/history/i);

    const next = await screen.findByRole("button", { name: "Next" });
    await user.click(next);

    await waitFor(() => {
      expect(mocks.listCardShares).toHaveBeenLastCalledWith(CARD_ID, {
        page: 2,
        limit: 10,
      });
    });
  });

  it("saves card settings from the Card tab", async () => {
    const user = userEvent.setup();
    mocks.updateCard.mockResolvedValue({ ...CARD, name: "Renamed card" });

    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed card");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateCard).toHaveBeenCalledWith(CARD_ID, {
        name: "Renamed card",
        type: "PERSONAL",
        isSensitive: false,
      });
    });
  });

  it("pins the vCard preview beside every tab", async () => {
    await renderLoadedPage();

    const preview = document.querySelector('[data-tour="card-vcard-preview"]');
    expect(preview).toBeTruthy();
    expect(within(preview as HTMLElement).getByText("What they'll save")).toBeTruthy();

    await openTab(/history/i);
    expect(document.querySelector('[data-tour="card-vcard-preview"]')).toBeTruthy();
  });

  /*
    The bucket serves no CORS headers, so reading `asset.url` from the browser is
    always blocked and the preview silently degrades to field-type badges — the
    values never render. It has to go through the API's VCF proxy instead.
  */
  it("reads the generated VCF through the API proxy, not the bucket URL", async () => {
    await renderLoadedPage();

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    const requested = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input));
    expect(
      requested.some((url) => url.endsWith("/v1/vcards/download/vcf/card-1.vcf")),
    ).toBe(true);
    expect(requested).not.toContain("https://cdn.example.com/vcf/card-1.vcf");
  });
});
