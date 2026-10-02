import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import {
  WALLET_OFF_NOTE,
  WalletActions,
  applePassHref,
  walletPassesEnabled,
} from "@/components/share/wallet-actions";
import { resolveCard } from "@/card/resolve-card";
import { cardLedgerDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/**
 * **Add to Apple Wallet · Add to Google Wallet · Save QR to phone.**
 *
 * Client review 2026-09-28: *"'Add to Wallet' must be functional and visible."* The API has no
 * pass endpoint yet, so these tests hold the honest version of that: with the flag off the two
 * pass buttons are visible, disabled, and explained in one line, and the one control that works
 * today — the QR image — is right beside them. With the flag on they reach the intended
 * endpoints and nothing else.
 */

const resolved = resolveCard(cardLedgerDemo, fixtureUser, fixtureGroups, fixtureFields);

function renderWallet(enabled: boolean) {
  renderWithProviders(
    <ToastProvider>
      <WalletActions cardId="card-1" resolved={resolved} enabled={enabled} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the flag", () => {
  it("is off unless NEXT_PUBLIC_WALLET_PASSES is set", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLET_PASSES", "");
    expect(walletPassesEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_WALLET_PASSES", "1");
    expect(walletPassesEnabled()).toBe(true);
  });
});

describe("while the passes are off", () => {
  it("shows both wallet buttons, disabled, with one line saying why", () => {
    renderWallet(false);

    const apple = screen.getByRole("button", { name: /add to apple wallet/i });
    const google = screen.getByRole("button", { name: /add to google wallet/i });
    expect(apple).toBeVisible();
    expect(google).toBeVisible();
    expect(apple).toHaveAttribute("aria-disabled", "true");
    expect(google).toHaveAttribute("aria-disabled", "true");

    // One visible line, and the disabled buttons are described by it.
    const note = screen.getByText(WALLET_OFF_NOTE);
    expect(apple).toHaveAccessibleDescription(WALLET_OFF_NOTE);
    expect(google).toHaveAccessibleDescription(WALLET_OFF_NOTE);
    expect(note).toBeVisible();
  });

  it("does nothing when a disabled pass button is pressed", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWallet(false);

    await userEvent.click(screen.getByRole("button", { name: /add to google wallet/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a working Save QR to phone beside them", () => {
    renderWallet(false);

    const save = screen.getByRole("button", { name: /save qr to phone/i });
    expect(save).not.toHaveAttribute("aria-disabled");
    expect(save).toHaveAttribute("data-export-png");
  });
});

describe("once the passes are on", () => {
  it("sends Apple Wallet to the pkpass endpoint with a plain navigation", () => {
    renderWallet(true);

    const apple = screen.getByRole("link", { name: /add to apple wallet/i });
    expect(apple).toHaveAttribute("href", applePassHref("card-1"));
    expect(apple.getAttribute("href")).toMatch(/\/cards\/card-1\/wallet\/apple$/);
    expect(screen.queryByText(WALLET_OFF_NOTE)).not.toBeInTheDocument();
  });

  it("asks the API for Google's save URL and opens it", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ saveUrl: "https://pay.google.com/gp/v/save/abc" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderWallet(true);

    await userEvent.click(screen.getByRole("button", { name: /add to google wallet/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://pay.google.com/gp/v/save/abc"));
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/cards\/card-1\/wallet\/google$/);
  });

  it("reports a failure instead of navigating anywhere", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 404, code: "NOT_FOUND", message: "Cannot GET" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderWallet(true);

    await userEvent.click(screen.getByRole("button", { name: /add to google wallet/i }));

    expect(await screen.findByText(/couldn't open google wallet/i)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
