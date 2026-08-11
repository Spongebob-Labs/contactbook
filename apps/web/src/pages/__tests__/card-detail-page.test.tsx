/**
 * Card detail page: three tabs over one pinned vCard preview, plus the
 * per-card share-field selection that now survives a reload.
 *
 * The API layer is mocked wholesale — this asserts page structure and the
 * localStorage round-trip, not transport, which `card-share-api.integration`
 * already covers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  copyCardFieldMappings: vi.fn(),
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
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
  copyCardFieldMappings: mocks.copyCardFieldMappings,
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
  await screen.findByRole("tab", { name: /overview/i });
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
  mocks.updateCard.mockResolvedValue(CARD);
  mocks.deleteCard.mockResolvedValue(undefined);
  mocks.copyCardFieldMappings.mockResolvedValue({ copied: 2, total: 2 });
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
  it("renders the three tabs with Overview selected first", async () => {
    await renderLoadedPage();

    expect(
      screen.getByRole("tab", { name: /overview/i }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("tab", { name: /what's shared/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /history/i })).toBeTruthy();
    expect(screen.getByText("Card settings")).toBeTruthy();
  });

  it("shows the card settings on Overview and keeps Share and Delete in the header", async () => {
    await renderLoadedPage();

    expect(screen.getByText("Work card", { selector: "h1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /share/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
    // The details editor belongs to the "What's shared" tab, not Overview.
    expect(screen.queryByText("Card details")).toBeNull();
  });

  it("renders the details panel on the What's shared tab", async () => {
    await renderLoadedPage();
    await openTab(/what's shared/i);

    expect(await screen.findByText("Card details")).toBeTruthy();
    expect(
      await screen.findByLabelText("Include Mobile when sharing"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("tab", { name: /what's shared/i })
        .getAttribute("aria-selected"),
    ).toBe("true");
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
    await openTab(/what's shared/i);

    const mobile = await screen.findByLabelText<HTMLInputElement>(
      "Include Mobile when sharing",
    );
    expect(mobile.checked).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Include Email when sharing").checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Include Landline when sharing")
        .checked,
    ).toBe(false);
    expect(screen.getByText("2 of 12 selected")).toBeTruthy();
  });

  it("writes the selection back when the user changes it", async () => {
    writeCardFieldSelection(USER_ID, CARD_ID, ["PHONE"]);
    const user = userEvent.setup();

    await renderLoadedPage();
    await openTab(/what's shared/i);
    await user.click(await screen.findByLabelText("Include Email when sharing"));

    await waitFor(() => {
      expect(readCardFieldSelection(USER_ID, CARD_ID)).toEqual(["PHONE", "EMAIL"]);
    });
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

  it("offers the copy-details recovery flow on Overview for an empty card", async () => {
    mocks.getCard.mockResolvedValue({ ...CARD, mappedFieldIds: [] });
    mocks.listCardsWithFieldCounts.mockResolvedValue([
      CARD,
      {
        ...CARD,
        id: "card-2",
        name: "Personal card",
        mappedFieldIds: ["field-c"],
      },
    ]);
    const user = userEvent.setup();

    await renderLoadedPage();

    const copyButton = await screen.findByRole("button", {
      name: /copy details/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(mocks.copyCardFieldMappings).toHaveBeenCalledWith("card-2", CARD_ID);
    });
  });

  it("shows the not-found state when the card is missing", async () => {
    const { ApiError } = await import("@/lib/api");
    mocks.getCard.mockRejectedValue(new ApiError("Not found", 404, undefined));

    renderPage();

    expect(await screen.findByText("We couldn't find that card.")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /overview/i })).toBeNull();
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

  it("saves card settings from the Overview tab", async () => {
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
