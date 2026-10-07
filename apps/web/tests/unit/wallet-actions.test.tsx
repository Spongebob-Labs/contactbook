import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import {
  GOOGLE_WALLET_ERROR_NOTE,
  GOOGLE_WALLET_NOT_CONFIGURED_NOTE,
  GOOGLE_WALLET_ON_DESKTOP,
  WALLET_NOT_IOS_NOTE,
  WALLET_UNAVAILABLE_NOTE,
  WalletActions,
  applePassHref,
  checkWalletPass,
  detectAndroid,
  detectIOS,
  isGoogleSaveUrl,
} from "@/components/share/wallet-actions";

/**
 * **Add to Apple Wallet** and **Add to Google Wallet** — the two controls in the block. (Both
 * Google Wallet and Save QR to phone were removed 2026-10-06; Google Wallet returned 2026-10-07,
 * functional. Save QR to phone did not, and the last suite here holds that.)
 *
 * The Google half is at the bottom of this file.
 *
 * Apple Wallet is wired to the real `GET /cards/{id}/wallet-pass`. What these hold:
 *
 * · the Apple control is a plain `<a href>` (never `fetch`, never a `download` attribute) so
 *   iOS Safari hands the response to Wallet;
 * · it is only a live link on iPhone/iPad AND only once the endpoint has actually answered a pass —
 *   a server without the signing secrets (`409 WALLET_NOT_CONFIGURED`) leaves it disabled with one
 *   line, never a link that lands on a JSON error page;
 * · elsewhere it stays visible and disabled, saying it works on iPhone;
 * · nothing else is rendered beside it.
 */

const PKPASS = "application/vnd.apple.pkpass";

function pass(status: number, type: string): Response {
  return new Response(status === 200 ? new Uint8Array([1, 2, 3]) : JSON.stringify({ code: "X" }), {
    status,
    headers: { "content-type": type },
  });
}

function renderWallet(ios: boolean, android = false) {
  return renderWithProviders(
    <ToastProvider>
      <WalletActions cardId="card-1" ios={ios} android={android} />
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
  vi.restoreAllMocks();
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

describe("the rest of the block", () => {
  it("on an iPhone is Apple Wallet alone — no Google button, no Save QR — and asks only for the pass", async () => {
    renderWallet(true);
    await waitFor(() => expect(section()).toHaveAttribute("data-wallet-state", "ready"));

    expect(google()).not.toBeInTheDocument();
    expect(screen.queryByText(/google wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save qr to phone/i })).not.toBeInTheDocument();
    for (const call of (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      expect(String(call[0])).toMatch(/\/wallet-pass$/);
    }
  });

  it("never brings back Save QR to phone, on any platform", () => {
    for (const [ios, android] of [
      [true, false],
      [false, true],
      [false, false],
    ] as const) {
      const { unmount } = renderWallet(ios, android);
      expect(screen.queryByRole("button", { name: /save qr/i })).not.toBeInTheDocument();
      unmount();
    }
  });
});

/* ── Add to Google Wallet ────────────────────────────────────────────────────────────── */

const SAVE_URL = "https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiJ9.eyJ0eXAiOiJzYXZldG93YWxsZXQifQ.c2ln";
const GOOGLE_ENDPOINT = /\/api\/cb\/cards\/card-1\/google-wallet-pass$/;

const google = () => document.querySelector<HTMLElement>('[data-wallet-add="google"]');
const googleNote = () => document.querySelector<HTMLElement>("[data-wallet-google-note]");

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "req-1" },
  });
}

function apiError(status: number, code: string): Response {
  return json(status, { statusCode: status, code, message: "developer text", requestId: "req-1" });
}

type FetchCall = [input: string | URL | Request, init?: RequestInit];

/** Answers the Google endpoint from `google`, and every other call (the session refresh) from `other`. */
function stubFetch(googleAnswer: () => Response | Promise<Response>, other?: () => Response) {
  const mock = vi.fn(async (...[input]: FetchCall) => {
    if (GOOGLE_ENDPOINT.test(new URL(String(input), window.location.origin).pathname)) return googleAnswer();
    return (other ?? (() => apiError(401, "REFRESH_MISSING")))();
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const googleCalls = (mock: ReturnType<typeof vi.fn>) =>
  (mock.mock.calls as FetchCall[]).filter(([input]) =>
    GOOGLE_ENDPOINT.test(new URL(String(input), window.location.origin).pathname),
  );

function spyOnAssign() {
  return vi.spyOn(window.location, "assign").mockImplementation(() => undefined);
}

async function press() {
  await userEvent.click(screen.getByRole("button", { name: "Add to Google Wallet" }));
}

describe("detectAndroid", () => {
  it("recognises Android, and nothing else", () => {
    expect(detectAndroid({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile" })).toBe(true);
    expect(detectAndroid({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe(false);
    expect(detectAndroid({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" })).toBe(false);
    expect(detectAndroid({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe(false);
  });
});

describe("isGoogleSaveUrl", () => {
  it("accepts Google's save link", () => {
    expect(isGoogleSaveUrl(SAVE_URL)).toBe(true);
  });

  it("refuses anything that is not exactly that — the browser is about to be sent there", () => {
    for (const bad of [
      "http://pay.google.com/gp/v/save/x",
      "https://pay.google.com.evil.example/gp/v/save/x",
      "https://evil.example/gp/v/save/x",
      "https://pay.google.com/somewhere/else",
      "javascript:alert(1)",
      "/gp/v/save/x",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isGoogleSaveUrl(bad)).toBe(false);
    }
  });
});

describe("Add to Google Wallet — where it shows", () => {
  it("is a real, enabled button on Android, beside the Apple one, and asks the server nothing until pressed", () => {
    const mock = stubFetch(() => json(200, { url: SAVE_URL }));
    renderWallet(false, true);

    const button = screen.getByRole("button", { name: "Add to Google Wallet" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toBeVisible();
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toHaveAttribute("data-wallet-google-state", "idle");
    expect(button.parentElement).toBe(apple()?.parentElement);
    expect(googleNote()).toBeEmptyDOMElement();
    /* The call CREATES the pass on Google's side, so it is never fired as a probe. */
    expect(mock).not.toHaveBeenCalled();
  });

  /* ⚠ The deviation from the build guide (Android only), held on purpose: the owner tests from
     the desktop dashboard. Flipping `GOOGLE_WALLET_ON_DESKTOP` is meant to fail this test. */
  it("is also enabled on a desktop browser", () => {
    expect(GOOGLE_WALLET_ON_DESKTOP).toBe(true);
    renderWallet(false, false);

    expect(google()).toBeVisible();
    expect(google()).not.toHaveAttribute("aria-disabled");
    /* The Apple button's own desktop state is untouched by its new neighbour. */
    expect(apple()).toHaveAttribute("aria-disabled", "true");
    expect(apple()).toHaveAccessibleDescription(WALLET_NOT_IOS_NOTE);
  });

  it("is not rendered at all on iPhone or iPad, and nothing mentions Google", async () => {
    const mock = stubFetch(() => json(200, { url: SAVE_URL }), () => pass(200, PKPASS));
    renderWallet(true);
    await waitFor(() => expect(section()).toHaveAttribute("data-wallet-state", "ready"));

    expect(google()).not.toBeInTheDocument();
    expect(googleNote()).not.toBeInTheDocument();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(googleCalls(mock)).toHaveLength(0);
  });

  it("detects the platform itself when nothing is injected (happy-dom is a desktop browser)", async () => {
    renderWithProviders(<WalletActions cardId="card-1" />);
    expect(await screen.findByRole("button", { name: "Add to Google Wallet" })).toBeVisible();
  });
});

describe("Add to Google Wallet — pressing it", () => {
  it("fetches the card's save link through the proxy, then sends the browser to it", async () => {
    const assign = spyOnAssign();
    const mock = stubFetch(() => json(200, { url: SAVE_URL }));
    renderWallet(false, true);

    await press();

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAVE_URL));
    expect(assign).toHaveBeenCalledTimes(1);

    const calls = googleCalls(mock);
    expect(calls).toHaveLength(1);
    const [input, init] = calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/cb/cards/card-1/google-wallet-pass");
    expect(init?.method).toBe("GET");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.cache).toBe("no-store");

    /* Live again afterwards: a page restored from the back/forward cache must not be stuck. */
    expect(google()).not.toHaveAttribute("aria-busy");
    expect(googleNote()).toBeEmptyDOMElement();
  });

  it("is disabled and busy, with a busy label, while the link is being fetched — and ignores a second press", async () => {
    const assign = spyOnAssign();
    let answer: (response: Response) => void = () => undefined;
    const mock = stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderWallet(false, true);

    await press();

    const button = google()!;
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("data-wallet-google-state", "loading");
    expect(button).toHaveTextContent("Opening Google Wallet…");

    await userEvent.click(button);
    expect(googleCalls(mock)).toHaveLength(1);
    expect(assign).not.toHaveBeenCalled();

    answer(json(200, { url: SAVE_URL }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAVE_URL));
    expect(google()).toHaveTextContent("Add to Google Wallet");
  });

  it("goes disabled with one inline line on 409 GOOGLE_WALLET_NOT_CONFIGURED — never a toast, never a redirect", async () => {
    const assign = spyOnAssign();
    const mock = stubFetch(() => apiError(409, "GOOGLE_WALLET_NOT_CONFIGURED"));
    renderWallet(false, true);

    await press();

    expect(await screen.findByText(GOOGLE_WALLET_NOT_CONFIGURED_NOTE)).toBeVisible();
    expect(GOOGLE_WALLET_NOT_CONFIGURED_NOTE).toMatch(/^Google Wallet isn't set up on this server yet/);
    expect(google()).toHaveAttribute("aria-disabled", "true");
    expect(google()).not.toHaveAttribute("aria-busy");
    expect(google()).toHaveAttribute("data-wallet-google-state", "not-configured");
    expect(google()).toHaveAccessibleDescription(GOOGLE_WALLET_NOT_CONFIGURED_NOTE);
    expect(googleNote()).toHaveAttribute("role", "status");
    /* The line is inside the wallet block, not in the toast viewport. */
    expect(section()).toContainElement(screen.getByText(GOOGLE_WALLET_NOT_CONFIGURED_NOTE));
    expect(screen.queryByText("developer text")).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    /* Pressing again cannot help, so it asks nothing. */
    await userEvent.click(google()!);
    expect(googleCalls(mock)).toHaveLength(1);
  });

  it.each([
    ["404 CARD_NOT_FOUND", () => apiError(404, "CARD_NOT_FOUND")],
    ["a 500", () => apiError(500, "INTERNAL")],
    ["a 502 from the proxy", () => apiError(502, "NETWORK")],
    ["a body that is not JSON", () => new Response("<html>", { status: 200 })],
  ])("shows a quiet inline error on %s and leaves the button live", async (_, answer) => {
    const assign = spyOnAssign();
    stubFetch(answer);
    renderWallet(false, true);

    await press();

    expect(await screen.findByText(GOOGLE_WALLET_ERROR_NOTE)).toBeVisible();
    expect(google()).not.toHaveAttribute("aria-disabled");
    expect(google()).not.toHaveAttribute("aria-busy");
    expect(google()).toHaveAttribute("data-wallet-google-state", "error");
    expect(google()).toHaveAccessibleDescription(GOOGLE_WALLET_ERROR_NOTE);
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows the same quiet error when the network fails, and a second press retries and succeeds", async () => {
    const assign = spyOnAssign();
    let attempt = 0;
    stubFetch(() => {
      attempt += 1;
      if (attempt === 1) throw new TypeError("Failed to fetch");
      return json(200, { url: SAVE_URL });
    });
    renderWallet(false, true);

    await press();
    expect(await screen.findByText(GOOGLE_WALLET_ERROR_NOTE)).toBeVisible();

    await press();
    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAVE_URL));
    expect(screen.queryByText(GOOGLE_WALLET_ERROR_NOTE)).not.toBeInTheDocument();
  });

  it("refuses to follow a 200 whose link is not Google's", async () => {
    const assign = spyOnAssign();
    stubFetch(() => json(200, { url: "https://evil.example/gp/v/save/x" }));
    renderWallet(false, true);

    await press();

    expect(await screen.findByText(GOOGLE_WALLET_ERROR_NOTE)).toBeVisible();
    expect(assign).not.toHaveBeenCalled();
  });

  it("on 401 refreshes once and retries — the app's standard handling — and carries on if that works", async () => {
    const assign = spyOnAssign();
    let attempt = 0;
    const mock = stubFetch(
      () => (++attempt === 1 ? apiError(401, "UNAUTHENTICATED") : json(200, { url: SAVE_URL })),
      () => json(200, {}),
    );
    renderWallet(false, true);

    await press();

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAVE_URL));
    expect(googleCalls(mock)).toHaveLength(2);
    const refresh = (mock.mock.calls as FetchCall[]).filter(([input]) => String(input).endsWith("/auth/refresh"));
    expect(refresh).toHaveLength(1);
  });

  it("on a 401 the refresh cannot fix, ends the session and returns here after sign-in", async () => {
    const assign = spyOnAssign();
    stubFetch(() => apiError(401, "UNAUTHENTICATED"));
    renderWallet(false, true);

    await press();

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const target = new URL(String(assign.mock.calls[0][0]), window.location.origin);
    expect(target.pathname).toBe("/api/session/end");
    expect(target.searchParams.get("next")).toBe(`${window.location.pathname}${window.location.search}`);
    expect(screen.queryByText(GOOGLE_WALLET_ERROR_NOTE)).not.toBeInTheDocument();
  });
});

describe("Add to Google Wallet — switching cards", () => {
  it("does not carry one card's not-configured answer or error over to the next card", async () => {
    stubFetch(() => apiError(404, "CARD_NOT_FOUND"));
    const { rerender } = renderWithProviders(<WalletActions cardId="card-1" ios={false} android />);
    await press();
    expect(await screen.findByText(GOOGLE_WALLET_ERROR_NOTE)).toBeVisible();

    rerender(<WalletActions cardId="card-2" ios={false} android />);

    expect(screen.queryByText(GOOGLE_WALLET_ERROR_NOTE)).not.toBeInTheDocument();
    expect(google()).toHaveAttribute("data-wallet-google-state", "idle");
  });
});
