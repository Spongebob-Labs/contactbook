import { afterEach, describe, expect, it, vi } from "vitest";

import { act, renderWithProviders, screen, userEvent } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import { CardLinkBlock, COPIED_FOR_MS } from "@/components/share/card-link-block";
import {
  cardShareMessage,
  whatsappAnyChatHref,
  whatsappShareHref,
} from "@/components/share/share-sheet";

/**
 * The card's link, and the ways it leaves the page — `/cards/[cardId]` block (c).
 *
 * The dialog these tests used to open is gone (one share UI; see `share-sheet.tsx`). What they
 * still prove is the part that was always load-bearing: the right URL is handed over, in one
 * spelling, by every route out — Copy, WhatsApp to any chat, WhatsApp to one number — and an
 * unsaved card offers no control that would hand over a dead one.
 */

const LIVE_URL = "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a";

function renderBlock(url: string | null = LIVE_URL) {
  renderWithProviders(
    <ToastProvider>
      <CardLinkBlock url={url} cardName="Work" />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("whatsappShareHref — the deep link aimed at one number", () => {
  it("strips the + , because wa.me takes bare digits and fails silently on one", () => {
    const href = whatsappShareHref("+919876543210", "Work", LIVE_URL);
    expect(href.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(href).not.toContain("wa.me/+");
  });

  it("carries the link through encoding intact", () => {
    const text = new URL(whatsappShareHref("+919876543210", "Work", LIVE_URL)).searchParams.get(
      "text",
    );
    expect(text).toContain(LIVE_URL);
  });

  it("survives a card name carrying characters that would truncate a raw query string", () => {
    const text =
      new URL(whatsappShareHref("+919876543210", "R&D #2", LIVE_URL)).searchParams.get("text") ??
      "";
    expect(text).toContain("R&D #2");
    expect(text).toContain(LIVE_URL);
  });
});

describe("whatsappAnyChatHref — WhatsApp's own chat picker", () => {
  it("names no number, so WhatsApp asks who to send it to", () => {
    const href = whatsappAnyChatHref("Work", LIVE_URL);
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(new URL(href).searchParams.get("text")).toBe(cardShareMessage("Work", LIVE_URL));
  });

  it("writes the message without an em-dash aside", () => {
    expect(cardShareMessage("Work", LIVE_URL)).not.toMatch(/—/);
  });
});

describe("the card link block", () => {
  it("shows the card's own URL in a read-only field with Copy right beside it", () => {
    renderBlock();

    const field = screen.getByRole("textbox", { name: "Card link" });
    expect(field).toHaveValue(LIVE_URL);
    expect(field).toHaveAttribute("readonly");

    const copy = screen.getByRole("button", { name: /^copy$/i });
    // Joined to the field: same row, next sibling.
    expect(field.parentElement).toBe(copy.parentElement);
  });

  it("copies exactly the URL the QR encodes, and says Copied for a moment", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderBlock();

    await userEvent.click(screen.getByRole("button", { name: /^copy$/i }));

    expect(writeText).toHaveBeenCalledWith(LIVE_URL);
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("goes back to Copy after the confirmation has been seen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderBlock();

    await userEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    await screen.findByRole("button", { name: /copied/i });
    await act(async () => {
      vi.advanceTimersByTime(COPIED_FOR_MS + 50);
    });

    expect(screen.getByRole("button", { name: /^copy$/i })).toBeInTheDocument();
  });

  it("offers WhatsApp to any chat, carrying the card's link", () => {
    renderBlock();

    const whatsapp = screen.getByRole("link", { name: /share on whatsapp/i });
    expect(whatsapp).toHaveAttribute("href", whatsappAnyChatHref("Work", LIVE_URL));
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says an unsaved card's link is not active yet and offers nothing to copy or send", () => {
    renderBlock(null);

    expect(screen.getByText(/activates when you save/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers no file at all — the recipient gets a link (§4.2)", () => {
    renderBlock();
    expect(document.body.textContent).not.toMatch(/\.vcf|BEGIN:VCARD|download/i);
  });
});
