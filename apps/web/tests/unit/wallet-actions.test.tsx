import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import {
  GOOGLE_SOON_NOTE,
  WALLET_NOT_IOS_NOTE,
  WALLET_UNAVAILABLE_NOTE,
  WalletActions,
  applePassHref,
  checkWalletPass,
  detectIOS,
} from "@/components/share/wallet-actions";
import { resolveCard } from "@/card/resolve-card";
import { cardLedgerDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/**
 * **Add to Apple Wallet · Add to Google Wallet · Save QR to phone.**
 *
 * Apple Wallet is wired to the real `GET /cards/{id}/wallet-pass`. What these hold:
 *
 * · the Apple control is a plain `<a href>` (never `fetch`, never a `download` attribute) so
 *   iOS Safari hands the response to Wallet;
 * · it is only a live link on iPhone/iPad AND only once the endpoint has actually answered a pass —
 *   a server without the signing secrets (`409 WALLET_NOT_CONFIGURED`) leaves it disabled with one
 *   line, never a link that lands on a JSON error page;
 * · elsewhere it stays visible and disabled, saying it works on iPhone;
 * · Google has no backend, so it is visible, disabled, and makes no request.
 */

const resolved = resolveCard(cardLedgerDemo, fixtureUser, fixtureGroups, fixtureFields);

const PKPASS = "application/vnd.apple.pkpass";

function pass(status: number, type: string): Response {
  return new Response(status === 200 ? new Uint8Array([1, 2, 3]) : JSON.stringify({ code: "X" }), {
    status,
    headers: { "content-type": type },
  });
}

function renderWallet(ios: boolean) {
  renderWithProviders(
    <ToastProvider>
      <WalletActions cardId="card-1" resolved={resolved} ios={ios} />
    </ToastProvider>,
  );
}

const apple = () => document.querySelector<HTMLElement>('[data-wallet-add="apple"]');
const section = () => document.querySelector<HTMLElement>("[data-wallet-actions]");

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pass(200, PKPASS)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectIOS", () => {
  const nav = (userAgent: string, platform = "", maxTouchPoints = 0) => ({ userAgent, platform, maxTouchPoints });

  it("recognises an iPhone and an older iPad by user agent", () => {
    expect(detectIOS(nav("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"))).toBe(true);
    expect(detectIOS(nav("Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)"))).toBe(true);
  });

  it("recognises iPadOS 13+, which reports itself as a Mac with a touch screen", () => {
    expect(detectIOS(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5))).toBe(true);
  });

  it("does not mistake a real Mac, Android or Windows for iOS", () => {
    expect(detectIOS(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0))).toBe(false);
    expect(detectIOS(nav("Mozilla/5.0 (Linux; Android 14; Pixel 8)", "Linux armv8l", 5))).toBe(false);
    expect(detectIOS(nav("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0))).toBe(false);
  });
});

describe("checkWalletPass", () => {
  it("is ready only for a 200 whose content type is a pkpass", async () => {
    await expect(checkWalletPass("card-1")).resolves.toBe("ready");
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toBe(applePassHref("card-1"));
  });

  it("is unavailable for 409 WALLET_NOT_CONFIGURED, 404, 401 and a network failure", async () => {
    for (const status of [409, 404, 401]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pass(status, "application/json")));
      await expect(checkWalletPass("card-1")).resolves.toBe("unavailable");
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(checkWalletPass("card-1")).resolves.toBe("unavailable");
  });

  it("is unavailable when a 200 is not a pass (a proxy that rewrote the type)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pass(200, "text/plain")));
    await expect(checkWalletPass("card-1")).resolves.toBe("unavailable");
  });
});

describe("on an iPhone", () => {
  it("becomes a plain link to the pass endpoint once the pass is available", async () => {
    renderWallet(true);

    const link = await screen.findByRole("link", { name: /add to apple wallet/i });
    expect(link).toHaveAttribute("href", applePassHref("card-1"));
    expect(link.getAttribute("href")).toMatch(/\/cards\/card-1\/wallet-pass$/);
    /* ⚠ A `download` attribute turns the tap into a file download instead of the Wallet sheet. */
    expect(link).not.toHaveAttribute("download");
    expect(section()).toHaveAttribute("data-wallet-state", "ready");
  });

  it("stays a disabled button with one line when the server cannot make a pass", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pass(409, "application/json")));
    renderWallet(true);

    expect(await screen.findByText(WALLET_UNAVAILABLE_NOTE)).toBeVisible();
    expect(screen.queryByRole("link", { name: /add to apple wallet/i })).not.toBeInTheDocument();
    expect(apple()).toHaveAttribute("aria-disabled", "true");
    expect(apple()).toHaveAccessibleDescription(WALLET_UNAVAILABLE_NOTE);
  });

  it("is disabled and busy (no link, no note) while it checks", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderWallet(true);

    expect(apple()).toHaveAttribute("aria-disabled", "true");
    expect(apple()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(WALLET_UNAVAILABLE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(WALLET_NOT_IOS_NOTE)).not.toBeInTheDocument();
  });
});

describe("anywhere that is not an iPhone", () => {
  it("keeps the button visible, disabled, saying it works on iPhone — and asks the server nothing", () => {
    renderWallet(false);

    expect(apple()).toBeVisible();
    expect(apple()).toHaveAttribute("aria-disabled", "true");
    expect(apple()).toHaveAccessibleDescription(WALLET_NOT_IOS_NOTE);
    expect(screen.getByText(WALLET_NOT_IOS_NOTE)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(section()).toHaveAttribute("data-wallet-state", "not-ios");
  });
});

describe("Google Wallet", () => {
  it("is visible, disabled and 'coming soon' — and never makes a request", async () => {
    renderWallet(true);
    await waitFor(() => expect(section()).toHaveAttribute("data-wallet-state", "ready"));

    const google = document.querySelector<HTMLElement>('[data-wallet-add="google"]');
    expect(google).toBeVisible();
    expect(google).toHaveAttribute("aria-disabled", "true");
    expect(google).toHaveAccessibleDescription(GOOGLE_SOON_NOTE);
    // The only request ever made is the pass probe.
    for (const call of (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      expect(String(call[0])).toMatch(/wallet-pass$/);
    }
  });
});

describe("Save QR to phone", () => {
  it("is still beside them and is never disabled", () => {
    renderWallet(false);
    const save = screen.getByRole("button", { name: /save qr to phone/i });
    expect(save).not.toHaveAttribute("aria-disabled");
    expect(save).toHaveAttribute("data-export-png");
  });
});
