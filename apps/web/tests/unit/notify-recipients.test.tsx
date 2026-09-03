import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import {
  NotifyBanner,
  NotifyRecipients,
  behindRows,
  notifiableRows,
} from "@/components/share/notify-recipients";
import { ApiError } from "@/lib/api/errors";
import type { CardShareRow } from "@/types/domain";

const notify = vi.fn();
const audience = vi.fn();

vi.mock("@/lib/api/browser", () => ({
  cards: {
    notify: (...args: unknown[]) => notify(...args),
    audience: (...args: unknown[]) => audience(...args),
  },
}));

const CARD_ID = "9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c";

function row(over: Partial<CardShareRow> & { shareLinkId: string }): CardShareRow {
  return {
    cardId: CARD_ID,
    cardName: "Work",
    url: "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a",
    status: "ACTIVE",
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    createdAt: "2026-08-23T18:00:00.000Z",
    contactId: `contact-${over.shareLinkId}`,
    contactLabel: `Person ${over.shareLinkId}`,
    versionsBehind: 0,
    lastNotifiedVersion: 3,
    ...over,
  };
}

const BEHIND = row({ shareLinkId: "a", versionsBehind: 2, lastNotifiedVersion: 1 });
const CAUGHT_UP = row({ shareLinkId: "b", versionsBehind: 0, lastNotifiedVersion: 3 });
/** Revoked: no `audience` entry, so `versionsBehind` is `null` — not notifiable at all. */
const REVOKED = row({ shareLinkId: "c", status: "REVOKED", versionsBehind: null, lastNotifiedVersion: null });

/**
 * ⚠ Radix locks the document while a dialog is open — `pointer-events: none` and
 * `data-scroll-locked` on `<body>`. A test that ends with its dialog still open unmounts before
 * the close transition releases that lock, and it then persists across `cleanup()` for the rest
 * of the file: every later dialog silently refuses to open, and the failure surfaces as
 * "unable to find" a button in a test that has nothing wrong with it.
 *
 * Cleared here so the file is order-independent, rather than requiring every test to remember to
 * close what it opened.
 */
afterEach(() => {
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
  document.body.removeAttribute("aria-hidden");
});

beforeEach(() => {
  notify.mockReset().mockResolvedValue([
    { shareLinkId: "a", outboxMessageId: "out-1", status: "ENQUEUED" },
  ]);
  audience.mockReset().mockResolvedValue({ currentVersion: 3, recipients: [] });
});

/* ── the row selectors, which every affordance below turns on ─────────────────────── */

describe("notifiableRows / behindRows", () => {
  it("excludes a revoked link, whose versionsBehind is null rather than 0", () => {
    /* ⚠ The distinction that matters. `audience` returns ACTIVE links only, so a revoked share
       has no entry — `null` means "cannot be notified", never "caught up". Reading it as 0 would
       silently put a revoked recipient in the picker, and one bad id 404s the WHOLE call. */
    expect(notifiableRows([BEHIND, CAUGHT_UP, REVOKED]).map((r) => r.shareLinkId)).toEqual(["a", "b"]);
    expect(behindRows([BEHIND, CAUGHT_UP, REVOKED]).map((r) => r.shareLinkId)).toEqual(["a"]);
  });

  it("treats a link minted before this feature (lastNotifiedVersion null) as behind", () => {
    const legacy = row({ shareLinkId: "d", versionsBehind: 3, lastNotifiedVersion: null });
    expect(behindRows([legacy]).map((r) => r.shareLinkId)).toEqual(["d"]);
  });
});

/* ── the banner: a signal, not a fixture ──────────────────────────────────────────── */

describe("NotifyBanner", () => {
  it("renders nothing when everyone is caught up", () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyBanner cardId={CARD_ID} shares={[CAUGHT_UP]} onChanged={() => {}} />
      </ToastProvider>,
    );
    /* Not greyed out, not a zero count — absent. A permanent banner trains the eye to skip it. */
    expect(document.querySelector("[data-notify-banner]")).toBeNull();
  });

  it("renders nothing when the card has no recipients at all", () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyBanner cardId={CARD_ID} shares={[]} onChanged={() => {}} />
      </ToastProvider>,
    );
    expect(document.querySelector("[data-notify-banner]")).toBeNull();
  });

  it("counts only the recipients actually behind, and says the details still resolve", () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyBanner cardId={CARD_ID} shares={[BEHIND, CAUGHT_UP, REVOKED]} onChanged={() => {}} />
      </ToastProvider>,
    );
    const banner = document.querySelector("[data-notify-banner]");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("1 recipient hasn't been told");
    /* The mental model, in the copy: editing already propagated. This is only the telling. */
    expect(banner?.textContent).toContain("they still see your latest details");
  });
});

/* ── the picker ───────────────────────────────────────────────────────────────────── */

describe("NotifyRecipients", () => {
  it("offers no control at all when nobody can be notified", () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients cardId={CARD_ID} shares={[REVOKED]} onChanged={() => {}} />
      </ToastProvider>,
    );
    expect(screen.queryByRole("button", { name: /notify/i })).toBeNull();
  });

  it("preselects EVERY active recipient, not only the ones behind", async () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients cardId={CARD_ID} shares={[BEHIND, CAUGHT_UP, REVOKED]} onChanged={() => {}} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));

    /* Mirrors the original share flow: an owner may always deliberately re-notify somebody
       already caught up, and doing so is a server-side no-op rather than a duplicate message.
       So the owner deselects — we do not pre-filter for them. */
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).toBeChecked();
    expect(document.querySelector(`[data-notify-row="${REVOKED.shareLinkId}"]`)).toBeNull();
  });

  it("accounts for contacts this card was never sent to, rather than silently omitting them", async () => {
    /* ⚠ The confusion this exists to kill. An owner with ten contacts and one recipient opened
       this dialog, saw one row, and reasonably read it as broken. Notify carries a link to THIS
       card, so somebody who never received it has nothing to open — the action for them is
       Share. The dialog now says so instead of leaving the gap unexplained. */
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND]}
          contacts={[{ id: BEHIND.contactId }, { id: "other-1" }, { id: "other-2" }]}
          onChanged={() => {}}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));

    const note = await screen.findByText(/other contacts/i);
    expect(note.textContent).toContain("2 other contacts");
    expect(note.textContent).toMatch(/don't have this card yet/i);
    /* And it points at the action that actually works for them. */
    expect(note.textContent).toContain("Share");
  });

  it("says nothing about other contacts when everyone already has the card", async () => {
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND]}
          contacts={[{ id: BEHIND.contactId }]}
          onChanged={() => {}}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));
    await screen.findAllByRole("checkbox");
    expect(document.querySelector("[data-notify-not-recipients]")).toBeNull();
  });

  it("sends only the selected ids, taken straight off the rows", async () => {
    const onChanged = vi.fn();
    renderWithProviders(
      <ToastProvider>
        {/* ⚠ Every test that reaches a successful send must shorten this. The production default
            is 4s, and a test that ends with that timer pending unmounts mid-transition — which
            wedges the dialog for the REST OF THE FILE and fails a later, innocent test. */}
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND, CAUGHT_UP]}
          onChanged={onChanged}
          reconcileDelayMs={10}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));

    const boxes = await screen.findAllByRole("checkbox");
    await userEvent.click(boxes[1]!); // deselect the caught-up one
    await userEvent.click(screen.getByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify).toHaveBeenCalledWith(CARD_ID, { shareLinkIds: ["a"] });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("never says 'sent' — the response is a queue receipt, not a delivery", async () => {
    const onChanged = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND]}
          onChanged={onChanged}
          reconcileDelayMs={10}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send 1 update/i }));

    /* ⚠ `status: 'ENQUEUED'` comes back before the WhatsApp send is even attempted, and returns
       identically whether it later succeeds or fails. Copy that claimed delivery here would be
       wrong on every failed send, and there is no callback to correct it with. */
    /* `findAllByText`: a toast renders twice by design — once visibly and once in the polite
       aria-live region — so a single-match query is ambiguous here, not absent. */
    expect(await screen.findAllByText(/sending one update/i)).not.toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/\bsent\b/i);
    expect(document.body.textContent).toContain("happens in the background");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("reconciles by re-reading the card, because notify cannot report the outcome", async () => {
    const onChanged = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND]}
          onChanged={onChanged}
          /* Real delay, shortened. `vi.useFakeTimers` here leaked into the next test in this
             file and timed out an unrelated assertion — the seam keeps the wait genuine. */
          reconcileDelayMs={10}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));

    /* ⚠ The whole point: `notify` answering 201/ENQUEUED proves nothing about delivery, so the
       screen must go back to `audience` to find out. Without this re-read a failed send would
       leave the banner claiming everyone was told. */
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("does not reconcile instantly — an immediate read would always look like a failure", async () => {
    const onChanged = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients
          cardId={CARD_ID}
          shares={[BEHIND]}
          onChanged={onChanged}
          reconcileDelayMs={300}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    /* The send is a queue hop. Reading the audience back in the same tick would show the
       recipient still behind every single time, and report a false failure. */
    expect(onChanged).not.toHaveBeenCalled();

    /* ⚠ Awaited rather than left pending. Ending the test here unmounted the dialog mid-close,
       which left Radix's scroll lock (`pointer-events: none` on <body>) stuck for the whole
       file — the next test's dialog then silently refused to open. */
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("reports a failed call and does not close, so the selection survives a retry", async () => {
    notify.mockRejectedValueOnce(
      new ApiError({
        status: 404,
        code: "SHARE_LINK_NOT_FOUND",
        rawMessage: "This link does not exist.",
        requestId: "req-1",
      }),
    );
    renderWithProviders(
      <ToastProvider>
        <NotifyRecipients cardId={CARD_ID} shares={[BEHIND]} onChanged={() => {}} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /notify recipients/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    /* All-or-nothing upstream: one bad id fails the whole call, so the dialog must stay open
       with the selection intact rather than implying a partial send. */
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send 1 update/i })).toBeInTheDocument(),
    );
    expect(document.querySelector("[data-notify-picker]")).not.toBeNull();
    /* And the failure is reported in words the owner can act on, not a bare code. */
    expect(await screen.findAllByText(/couldn't find that link/i)).not.toHaveLength(0);
  });
});
