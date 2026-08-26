import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import { SendToContact, type MintedLink } from "@/components/share/card-sharing";
import { ApiError } from "@/lib/api/errors";
import type { ContactResponseDto, ShareLinkResponseDto } from "@/lib/api/schema";
import type { Contact } from "@/types/domain";

/**
 * Minting a link — the two calls behind one button.
 *
 * ## What this file is really guarding
 * The panel used to render a **dead end** on a new account: *"You have no contacts yet"*, an empty
 * state standing in front of the one action the panel exists to perform, on exactly the accounts
 * most likely to be trying it for the first time. Since `POST /contacts` upserts, that was never
 * a real constraint — a typed number is a contact id one call later.
 *
 * So the load-bearing assertions here are ordering and payload: `contacts.upsert` **then**
 * `cards.share` with the id the first call returned. Getting that backwards, or sending the raw
 * typed string as a `contactId`, are both failures no type would catch.
 */

const { upsert, share, listLinks } = vi.hoisted(() => ({
  upsert: vi.fn(),
  share: vi.fn(),
  listLinks: vi.fn(),
}));

vi.mock("@/lib/api/browser", () => ({
  contacts: { upsert },
  cards: { share },
  shareLinks: { list: listLinks },
}));

const CONTACT: ContactResponseDto = {
  id: "b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c",
  phoneE164: "+919820000000",
  displayName: "Priya",
  notes: null,
  source: "MANUAL",
  optedOutAt: null,
  createdAt: "2026-08-23T18:00:00.000Z",
};

const LINK: ShareLinkResponseDto = {
  id: "9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c",
  url: "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a",
  cardId: "card-1",
  cardName: "Work",
  contactId: CONTACT.id,
  contactPhoneE164: CONTACT.phoneE164,
  contactDisplayName: "Priya",
  status: "ACTIVE",
  viewCount: 0,
  firstViewedAt: null,
  lastViewedAt: null,
  createdAt: "2026-08-23T18:00:00.000Z",
};

function renderSend(options: { contacts?: readonly Contact[] } = {}) {
  const onShared = vi.fn<(minted: MintedLink) => void>();
  renderWithProviders(
    <ToastProvider>
      <SendToContact
        cardId="card-1"
        contacts={options.contacts ?? []}
        alreadySentTo={new Set()}
        onShared={onShared}
      />
    </ToastProvider>,
  );
  return onShared;
}

beforeEach(() => {
  upsert.mockReset().mockResolvedValue(CONTACT);
  share.mockReset().mockResolvedValue(LINK);
  listLinks.mockReset().mockResolvedValue([LINK]);
});

describe("an account with no contacts", () => {
  it("offers a number field rather than an empty state", () => {
    renderSend({});

    expect(screen.getByLabelText(/their number/i)).toBeInTheDocument();
    expect(screen.queryByText(/you have no contacts yet/i)).not.toBeInTheDocument();
  });

  it("does not offer a picker there is nothing to pick from", () => {
    renderSend({});

    expect(screen.queryByRole("button", { name: /pick from contacts/i })).not.toBeInTheDocument();
  });
});

describe("minting from a typed number", () => {
  it("upserts the contact, then shares the card to the id that came back", async () => {
    const onShared = renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "+91 98200 00000");
    await userEvent.type(screen.getByLabelText(/^name$/i), "Priya");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => expect(share).toHaveBeenCalled());

    // Normalised before it left — the API validates strict E.164 and a 400 here is unactionable.
    expect(upsert).toHaveBeenCalledWith({ phoneE164: "+919820000000", displayName: "Priya" });
    // ⚠ The id from the response, never the typed string.
    expect(share).toHaveBeenCalledWith("card-1", { contactId: CONTACT.id });
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0]);

    expect(onShared).toHaveBeenCalledWith(
      expect.objectContaining({
        url: LINK.url,
        recipientLabel: "Priya",
        recipientPhoneE164: CONTACT.phoneE164,
        templateMissing: false,
      }),
    );
  });

  it("omits an empty name rather than sending a blank one", async () => {
    renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledWith({ phoneE164: "+919820000000", displayName: undefined });
  });

  it("refuses a number with no country code without spending a round trip on it", async () => {
    renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "9820000000");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    expect(await screen.findByText(/include the country code/i)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });
});

describe("the failure that is not a failure", () => {
  /**
   * `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` means the WhatsApp send could not be enqueued — but the
   * API mints the link *before* it tries, so a live link exists that the error body does not
   * carry. It is read back from `GET /share-links`, matched on the pair, and handed over.
   */
  it("recovers the minted link and reports success with the send flagged as missed", async () => {
    share.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CARD_SHARE_TEMPLATE_NOT_CONFIGURED",
        rawMessage: "No approved CARD_SHARE template.",
      }),
    );
    const onShared = renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => expect(onShared).toHaveBeenCalled());
    expect(onShared).toHaveBeenCalledWith(
      expect.objectContaining({ url: LINK.url, templateMissing: true }),
    );
  });

  it("matches the pair rather than the card, so another recipient's link is never handed over", async () => {
    share.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CARD_SHARE_TEMPLATE_NOT_CONFIGURED",
        rawMessage: "No approved CARD_SHARE template.",
      }),
    );
    // Same card, someone else, listed first — a `find` on cardId alone would return this one.
    listLinks.mockResolvedValue([
      { ...LINK, id: "other", url: "https://cards.contactbook.app/c/someone-else", contactPhoneE164: "+919999999999" },
      LINK,
    ]);
    const onShared = renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => expect(onShared).toHaveBeenCalled());
    expect(onShared).toHaveBeenCalledWith(expect.objectContaining({ url: LINK.url }));
  });

  it("reports the error honestly when the link cannot be read back", async () => {
    share.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CARD_SHARE_TEMPLATE_NOT_CONFIGURED",
        rawMessage: "No approved CARD_SHARE template.",
      }),
    );
    listLinks.mockRejectedValue(new Error("network"));
    const onShared = renderSend({});

    await userEvent.type(screen.getByLabelText(/their number/i), "+919820000000");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    // No link to show, so nothing is claimed — the panel must not publish a URL it never got.
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(onShared).not.toHaveBeenCalled();
  });
});
