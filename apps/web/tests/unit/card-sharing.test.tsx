import { createRef } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import type { MintedLink } from "@/components/share/card-sharing";
import {
  SendToPhone,
  type SendCardOption,
  type SendToPhoneHandle,
} from "@/components/share/send-to-phone";
import { ApiError } from "@/lib/api/errors";
import { toContact } from "@/lib/api/map";
import type { ContactResponseDto, ShareLinkResponseDto } from "@/lib/api/schema";
import type { Contact } from "@/types/domain";

/**
 * Sending a card to a phone number — the two calls behind one button.
 *
 * `<SendToPhone>` is the primary share action on `/cards/[cardId]` and the whole of `/share`, so
 * the load-bearing assertions are ordering and payload: `contacts.upsert` **then** `cards.share`
 * with the id the first call returned, and a number built from the country select plus the typed
 * digits. Getting that backwards, or sending the raw typed string, are failures no type catches.
 *
 * Then the three outcomes, each shown in place of the form: sent; not sent because WhatsApp
 * sending is off (with a `wa.me` link aimed at THAT number, carrying THEIR link); and failed.
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

const TEMPLATE_MISSING = () =>
  new ApiError({
    status: 409,
    code: "CARD_SHARE_TEMPLATE_NOT_CONFIGURED",
    rawMessage: "No approved CARD_SHARE template.",
  });

const WORK: SendCardOption = { id: "card-1", name: "Work" };

function renderSend(
  options: {
    cards?: readonly SendCardOption[];
    defaultCardId?: string;
    contacts?: readonly Contact[];
    alreadySent?: (cardId: string, contactId: string) => boolean;
  } = {},
) {
  const onSent = vi.fn<(minted: MintedLink, cardId: string) => void>();
  const handle = createRef<SendToPhoneHandle>();
  renderWithProviders(
    <ToastProvider>
      <SendToPhone
        ref={handle}
        title="Send this card"
        cards={options.cards ?? [WORK]}
        defaultCardId={options.defaultCardId}
        contacts={options.contacts ?? []}
        alreadySent={options.alreadySent}
        onSent={onSent}
      />
    </ToastProvider>,
  );
  return { onSent, handle };
}

const numberField = () => screen.getByRole("textbox", { name: /^number$/i });
const nameField = () => screen.getByRole("textbox", { name: /^name/i });

/** Both are required, so almost every send types a name as well as the number. */
async function fill(number: string, name = "Priya"): Promise<void> {
  await userEvent.type(numberField(), number);
  await userEvent.type(nameField(), name);
}
const sendButton = () => screen.getByRole("button", { name: /send on whatsapp/i });

beforeAll(() => {
  /* Radix Select reaches for pointer capture and `scrollIntoView`, which happy-dom does not
     implement. */
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

beforeEach(() => {
  upsert.mockReset().mockResolvedValue(CONTACT);
  share.mockReset().mockResolvedValue(LINK);
  listLinks.mockReset().mockResolvedValue([LINK]);
});

describe("the phone number comes first", () => {
  it("renders the country code and number before anything else, with one send button", () => {
    renderSend();

    expect(screen.getByRole("group", { name: /phone number/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /country code/i })).toHaveTextContent("+91");
    expect(numberField()).toBeInTheDocument();
    expect(sendButton()).toBeInTheDocument();
  });

  it("does not offer a contact picker when there is nothing to pick from", () => {
    renderSend();
    expect(screen.queryByRole("button", { name: /choose from contacts/i })).not.toBeInTheDocument();
  });

  it("does not show a card picker when there is only one card", () => {
    renderSend();
    expect(screen.queryByRole("combobox", { name: /^card$/i })).not.toBeInTheDocument();
  });

  it("focuses the number field when the header's Share asks it to", () => {
    const { handle } = renderSend();
    handle.current?.focus();
    expect(numberField()).toHaveFocus();
  });
});

describe("sending to a typed number", () => {
  it("upserts the contact, then shares the card to the id that came back", async () => {
    const { onSent } = renderSend();

    await fill("98200 00000");
    await userEvent.click(sendButton());

    await waitFor(() => expect(share).toHaveBeenCalled());

    // Country select + digits, joined into strict E.164 before it left.
    expect(upsert).toHaveBeenCalledWith({ phoneE164: "+919820000000", displayName: "Priya" });
    // ⚠ The id from the response, never the typed string.
    expect(share).toHaveBeenCalledWith("card-1", { contactId: CONTACT.id });
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0]);

    expect(onSent).toHaveBeenCalledWith(
      expect.objectContaining({ url: LINK.url, recipientLabel: "Priya", templateMissing: false }),
      "card-1",
    );
  });

  it("replaces the form with 'Sent to …' and the recipient's own link", async () => {
    renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("heading", { name: "Sent to Priya" })).toBeInTheDocument();
    expect(screen.getByText(/saved to your contacts/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /priya's link/i })).toHaveValue(LINK.url);
    expect(screen.queryByRole("button", { name: /send on whatsapp/i })).not.toBeInTheDocument();
  });

  it("names an unnamed recipient by their formatted number", async () => {
    share.mockResolvedValue({ ...LINK, contactDisplayName: null });
    renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    expect(
      await screen.findByRole("heading", { name: "Sent to +91 98200 00000" }),
    ).toBeInTheDocument();
  });

  it("goes back to an empty form for the next person", async () => {
    renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());
    await userEvent.click(await screen.findByRole("button", { name: /send to someone else/i }));

    expect(numberField()).toHaveValue("");
    expect(sendButton()).toBeInTheDocument();
  });

  it("requires a name: a valid number alone is refused, with no round trip", async () => {
    renderSend();

    await userEvent.type(numberField(), "9820000000");
    await userEvent.click(sendButton());

    expect(await screen.findByText("Enter their name.")).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(nameField()).toHaveFocus();
    expect(upsert).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it("treats a name of only spaces as missing", async () => {
    renderSend();

    await userEvent.type(numberField(), "9820000000");
    await userEvent.type(nameField(), "   ");
    await userEvent.click(sendButton());

    expect(await screen.findByText("Enter their name.")).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("shows the number and the name problems together, and focuses the number first", async () => {
    renderSend();

    await userEvent.click(sendButton());

    expect(await screen.findByText("Enter a phone number.")).toBeInTheDocument();
    expect(screen.getByText("Enter their name.")).toBeInTheDocument();
    expect(numberField()).toHaveFocus();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("clears the name error as soon as they start typing", async () => {
    renderSend();

    await userEvent.type(numberField(), "9820000000");
    await userEvent.click(sendButton());
    expect(await screen.findByText("Enter their name.")).toBeInTheDocument();

    await userEvent.type(nameField(), "P");
    expect(screen.queryByText("Enter their name.")).not.toBeInTheDocument();
  });

  it("marks both fields required", () => {
    renderSend();
    expect(numberField()).toBeRequired();
    expect(nameField()).toBeRequired();
  });

  it("sends the name trimmed", async () => {
    renderSend();

    await fill("9820000000", "  Priya  ");
    await userEvent.click(sendButton());

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledWith({ phoneE164: "+919820000000", displayName: "Priya" });
  });

  it("drops a trunk zero, the way the number is dialled at home", async () => {
    renderSend();

    await fill("09820000000");
    await userEvent.click(sendButton());

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ phoneE164: "+919820000000" }));
  });

  it("splits a pasted international number into the country and the digits", async () => {
    renderSend();

    await userEvent.click(numberField());
    await userEvent.paste("+44 7979 080009");

    expect(screen.getByRole("combobox", { name: /country code/i })).toHaveTextContent("+44");
    expect(numberField()).toHaveValue("7979080009");

    await userEvent.type(nameField(), "Priya");
    await userEvent.click(sendButton());
    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ phoneE164: "+447979080009" }));
  });

  it("refuses an empty or short number without spending a round trip on it", async () => {
    renderSend();

    await userEvent.click(sendButton());
    expect(await screen.findByText("Enter a phone number.")).toBeInTheDocument();

    await userEvent.type(numberField(), "123");
    await userEvent.type(nameField(), "Priya");
    await userEvent.click(sendButton());
    expect(await screen.findByText(/too short/i)).toBeInTheDocument();

    expect(upsert).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it("reports an API failure under the button and keeps what was typed", async () => {
    share.mockRejectedValue(
      new ApiError({ status: 404, code: "CARD_NOT_FOUND", rawMessage: "No card." }),
    );
    const { onSent } = renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(numberField()).toHaveValue("9820000000");
    expect(onSent).not.toHaveBeenCalled();
  });
});

describe("when WhatsApp sending is not switched on", () => {
  it("says plainly the message did not go out, and offers wa.me aimed at that number", async () => {
    share.mockRejectedValue(TEMPLATE_MISSING());
    const { onSent } = renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("heading", { name: "Not sent to Priya" })).toBeInTheDocument();
    expect(screen.getByText(/no message went out/i)).toBeInTheDocument();

    const whatsapp = screen.getByRole("link", { name: /open whatsapp/i });
    const href = whatsapp.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/919820000000?text=")).toBe(true);
    // THEIR link, not the card's public one.
    expect(new URL(href).searchParams.get("text")).toContain(LINK.url);
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("textbox", { name: /priya's link/i })).toHaveValue(LINK.url);
    expect(onSent).toHaveBeenCalledWith(
      expect.objectContaining({ templateMissing: true }),
      "card-1",
    );
  });

  it("matches the pair rather than the card, so another recipient's link is never handed over", async () => {
    share.mockRejectedValue(TEMPLATE_MISSING());
    // Same card, someone else, listed first — a `find` on cardId alone would return this one.
    listLinks.mockResolvedValue([
      {
        ...LINK,
        id: "other",
        url: "https://cards.contactbook.app/c/someone-else",
        contactId: "someone-else",
        contactPhoneE164: "+919999999999",
      },
      LINK,
    ]);
    const { onSent } = renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ url: LINK.url }), "card-1");
  });

  it("reports the error honestly when the link cannot be read back", async () => {
    share.mockRejectedValue(TEMPLATE_MISSING());
    listLinks.mockRejectedValue(new Error("network"));
    const { onSent } = renderSend();

    await fill("9820000000");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // No link to show, so nothing is claimed.
    expect(onSent).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /not sent to/i })).not.toBeInTheDocument();
  });
});

/* ── choosing from contacts ─────────────────────────────────────────────────────────── */

describe("choosing from contacts", () => {
  const UNNAMED: ContactResponseDto = {
    ...CONTACT,
    id: "5d2c9e1f-0000-4a5b-8c6d-000000000001",
    phoneE164: "+447979080009",
    displayName: null,
  };
  const registry = [toContact(CONTACT, "owner-1"), toContact(UNNAMED, "owner-1")];

  async function openPicker(): Promise<HTMLElement[]> {
    await userEvent.click(screen.getByRole("button", { name: /choose from contacts/i }));
    await userEvent.click(screen.getByRole("combobox", { name: /^contact$/i }));
    return screen.findAllByRole("option");
  }

  /** ⚠ The reported bug: an unnamed contact read "+447979080009 · +44 7979 080009". */
  it("writes an unnamed contact's number once, formatted, and a named one as name · number", async () => {
    renderSend({ contacts: registry });

    const labels = (await openPicker()).map((option) => option.textContent ?? "");

    expect(labels).toContain("Priya · +91 98200 00000");
    expect(labels.find((label) => label.includes("7979"))).toBe("+44 7979 080009");
    expect(labels.join(" ")).not.toContain("+447979080009");
  });

  it("sends to the picked contact without an upsert, and says when it is the same link again", async () => {
    renderSend({ contacts: registry, alreadySent: (_, id) => id === CONTACT.id });

    await openPicker();
    await userEvent.click(screen.getByRole("option", { name: /priya/i }));
    await userEvent.click(sendButton());

    await waitFor(() => expect(share).toHaveBeenCalledWith("card-1", { contactId: CONTACT.id }));
    expect(upsert).not.toHaveBeenCalled();
    expect(await screen.findByText(/same link as before/i)).toBeInTheDocument();
  });

  it("can send to the same person again and again", async () => {
    renderSend({ contacts: registry, alreadySent: () => true });

    for (let i = 0; i < 3; i += 1) {
      await openPicker();
      await userEvent.click(screen.getByRole("option", { name: /priya/i }));
      await userEvent.click(sendButton());
      await waitFor(() => expect(share).toHaveBeenCalledTimes(i + 1));
      await userEvent.click(await screen.findByRole("button", { name: /send to someone else/i }));
    }
  });
});

/* ── the quick-share card picker ───────────────────────────────────────────────────── */

describe("which card", () => {
  const CARDS: SendCardOption[] = [WORK, { id: "card-2", name: "Personal" }];

  it("selects the default card and sends whichever card is picked", async () => {
    renderSend({ cards: CARDS, defaultCardId: "card-2" });

    const picker = screen.getByRole("combobox", { name: /^card$/i });
    expect(picker).toHaveTextContent("Personal");

    await userEvent.click(picker);
    await userEvent.click(await screen.findByRole("option", { name: "Work" }));

    await fill("9820000000");
    await userEvent.click(sendButton());

    await waitFor(() => expect(share).toHaveBeenCalledWith("card-1", { contactId: CONTACT.id }));
  });

  it("falls back to the first card when the default is not one of them", () => {
    renderSend({ cards: CARDS, defaultCardId: "archived" });
    expect(screen.getByRole("combobox", { name: /^card$/i })).toHaveTextContent("Work");
  });
});
