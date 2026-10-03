import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { act, renderWithProviders, screen, userEvent, waitFor } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import { SendUpdateButton } from "@/components/profile/send-update-button";
import { totalBehind, useCardAudience } from "@/components/profile/use-card-audience";
import { initialSelection, type NotifyTarget } from "@/components/share/notify-recipients";
import type { CardSyncStatus } from "@/components/profile/use-card-field-sync";

/**
 * The workspace's **Send update** button, and the hook that decides when it lights up.
 *
 * What these pin, in the owner's terms:
 *
 * · it is ALWAYS there — one button whether the card is new, everyone is caught up, or somebody
 *   is behind — so it never pops in while the owner is editing; the quiet states are disabled
 *   "All up to date";
 * · when somebody is behind it is a live button whose badge counts unshared CHANGES, and
 *   pressing it opens the picker
 *   with **only the people who are behind ticked**, so "Send 3 updates" never delivers one;
 * · it never opens or sends by itself — the jitter is a `data-nudge` attribute, nothing more;
 * · the jitter fires for a change that lands while the button is on screen, never on arrival.
 */

const notify = vi.fn();
const audience = vi.fn();

vi.mock("@/lib/api/browser", () => ({
  cards: {
    notify: (...args: unknown[]) => notify(...args),
    audience: (...args: unknown[]) => audience(...args),
  },
}));

const CARD_ID = "9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c";

function target(shareLinkId: string, over: Partial<NotifyTarget> = {}): NotifyTarget {
  return {
    shareLinkId,
    contactId: `contact-${shareLinkId}`,
    contactLabel: `Person ${shareLinkId}`,
    status: "ACTIVE",
    versionsBehind: 0,
    lastNotifiedVersion: 3,
    ...over,
  };
}

const BEHIND_A = target("a", { versionsBehind: 2, lastNotifiedVersion: 1 });
const BEHIND_B = target("b", { versionsBehind: 1, lastNotifiedVersion: 2 });
const CAUGHT_UP = target("c");
const REVOKED = target("d", { status: "REVOKED", versionsBehind: null, lastNotifiedVersion: null });

/* Radix locks the document while a dialog is open; clear it so the file is order-independent
   (the same reason notify-recipients.test.tsx does). */
afterEach(() => {
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
  document.body.removeAttribute("aria-hidden");
});

beforeEach(() => {
  notify.mockReset().mockResolvedValue([]);
  audience.mockReset().mockResolvedValue({ currentVersion: 3, recipients: [] });
});

function mount(
  targets: readonly NotifyTarget[],
  over: { nudge?: number; onChanged?: () => void; ready?: boolean } = {},
) {
  return renderWithProviders(
    <ToastProvider>
      <SendUpdateButton
        cardId={CARD_ID}
        targets={targets}
        ready={over.ready ?? true}
        nudge={over.nudge ?? 0}
        onChanged={over.onChanged ?? (() => {})}
        reconcileDelayMs={0}
      />
    </ToastProvider>,
  );
}

const slot = () => document.querySelector("[data-send-update]");

describe("SendUpdateButton — what it shows", () => {
  it("is there for a card nobody holds yet, disabled and saying so", () => {
    mount([]);
    const button = screen.getByRole("button", { name: /all up to date/i });
    expect(button.getAttribute("data-send-update-state")).toBe("empty");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.body.textContent).toContain("No one has this card yet");
  });

  it("treats a card whose only link is revoked as having no recipients", () => {
    mount([REVOKED]);
    expect(slot()?.getAttribute("data-send-update-state")).toBe("empty");
  });

  it("says 'All up to date', not a sentence, when everyone has been told", () => {
    mount([CAUGHT_UP]);
    const button = screen.getByRole("button", { name: /all up to date/i });
    expect(button.getAttribute("data-send-update-state")).toBe("idle");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.textContent).toBe("All up to date");
    expect(document.body.textContent).not.toContain("Everyone has your latest");
  });

  it("does not claim 'up to date' before the first read has landed", () => {
    mount([], { ready: false });
    const button = screen.getByRole("button", { name: /send update/i });
    expect(button.getAttribute("data-send-update-state")).toBe("loading");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("All up to date")).toBeNull();
  });

  it("badges the number of unshared CHANGES, not the number of people", () => {
    /* A is two changes behind, B one: three people-ish rows, two people, but the most anyone
       is missing is 2 changes. */
    mount([BEHIND_A, BEHIND_B, CAUGHT_UP, REVOKED]);
    const button = screen.getByRole("button", { name: /send update: 2 changes not yet shared with 2 people/i });
    expect(button.getAttribute("data-send-update-state")).toBe("behind");
    expect(button.querySelector("[data-send-update-count]")?.textContent).toBe("2");
  });

  it("uses the singular for one change and one person", () => {
    mount([BEHIND_B]);
    expect(
      screen.getByRole("button", { name: /send update: 1 change not yet shared with 1 person$/i }),
    ).toBeTruthy();
  });

  it("is the SAME button element in every state — it never appears or vanishes while editing", () => {
    const ui = (targets: NotifyTarget[]) => (
      <ToastProvider>
        <SendUpdateButton cardId={CARD_ID} targets={targets} ready nudge={0} onChanged={() => {}} />
      </ToastProvider>
    );
    const { rerender } = renderWithProviders(ui([CAUGHT_UP]));
    const before = slot();
    expect(before?.getAttribute("data-send-update-state")).toBe("idle");

    /* An edit lands: the audience now reports somebody behind. */
    rerender(ui([target("c", { versionsBehind: 1, lastNotifiedVersion: 2 })]));
    expect(slot()).toBe(before);
    expect(slot()?.getAttribute("data-send-update-state")).toBe("behind");
  });

  it("does not turn live (or open the picker) when pressed while up to date", async () => {
    mount([CAUGHT_UP]);
    await userEvent.click(screen.getByRole("button", { name: /all up to date/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SendUpdateButton — the jitter", () => {
  it("does not jitter on arrival, even into a non-zero counter", () => {
    /* A card switch remounts the button; a stale counter must not shake it on the way in. */
    mount([BEHIND_A], { nudge: 3 });
    expect(slot()?.getAttribute("data-nudge")).toBeNull();
  });

  it("jitters when a change lands while it is on screen, alternating the animation name", () => {
    const ui = (nudge: number) => (
      <ToastProvider>
        <SendUpdateButton cardId={CARD_ID} targets={[BEHIND_A]} ready nudge={nudge} onChanged={() => {}} />
      </ToastProvider>
    );
    const { rerender } = renderWithProviders(ui(0));
    expect(slot()?.getAttribute("data-nudge")).toBeNull();

    rerender(ui(1));
    /* `b` then `a`: a CSS animation only restarts when its name changes. */
    expect(slot()?.getAttribute("data-nudge")).toBe("b");
    rerender(ui(2));
    expect(slot()?.getAttribute("data-nudge")).toBe("a");
    rerender(ui(3));
    expect(slot()?.getAttribute("data-nudge")).toBe("b");
  });

  it("never opens the picker by itself", () => {
    const ui = (nudge: number) => (
      <ToastProvider>
        <SendUpdateButton cardId={CARD_ID} targets={[BEHIND_A]} ready nudge={nudge} onChanged={() => {}} />
      </ToastProvider>
    );
    const { rerender } = renderWithProviders(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("SendUpdateButton — the picker", () => {
  it("ticks only the people who are behind", async () => {
    mount([BEHIND_A, BEHIND_B, CAUGHT_UP]);
    await userEvent.click(screen.getByRole("button", { name: /send update: 2 changes/i }));

    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    const state = (id: string) =>
      (document.querySelector(`[data-notify-row="${id}"] [role="checkbox"]`) as HTMLElement | null)?.getAttribute(
        "aria-checked",
      );
    expect(state("a")).toBe("true");
    expect(state("b")).toBe("true");
    /* Listed, so the owner can add them — but not ticked, because re-telling is a no-op. */
    expect(state("c")).toBe("false");
  });

  it("sends to exactly the people the owner leaves ticked", async () => {
    mount([BEHIND_A, BEHIND_B]);
    await userEvent.click(screen.getByRole("button", { name: /send update: 2 changes/i }));
    await screen.findAllByRole("checkbox");

    /* Two contacts behind, the owner chooses one. */
    await userEvent.click(
      document.querySelector(`[data-notify-row="b"] [role="checkbox"]`) as HTMLElement,
    );
    await userEvent.click(screen.getByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify).toHaveBeenCalledWith(CARD_ID, { shareLinkIds: ["a"] });
  });

  it("says 'Sending…' as soon as the queue accepts it, then re-arms if the re-read still shows them behind", async () => {
    const onChanged = vi.fn();
    mount([BEHIND_A], { onChanged });
    await userEvent.click(screen.getByRole("button", { name: /send update: 2 changes/i }));
    await screen.findAllByRole("checkbox");
    await userEvent.click(screen.getByRole("button", { name: /send 1 update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalled());
    /* Reconcile ran (delay 0): the hold is dropped and the audience is re-read. A send that
       failed leaves `versionsBehind` unchanged, so the button is back rather than hidden. */
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(slot()?.getAttribute("data-send-update-state")).toBe("behind"));
  });

  it("does not call notify when the owner unticks everybody", async () => {
    mount([BEHIND_A]);
    await userEvent.click(screen.getByRole("button", { name: /send update: 2 changes/i }));
    await screen.findAllByRole("checkbox");
    await userEvent.click(
      document.querySelector(`[data-notify-row="a"] [role="checkbox"]`) as HTMLElement,
    );
    const send = screen.getByRole("button", { name: /send 0 updates/i });
    expect(send.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(send);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("initialSelection", () => {
  it("ticks only who is behind, and falls back to everyone when nobody is", () => {
    expect([...initialSelection([BEHIND_A, CAUGHT_UP], "behind")]).toEqual(["a"]);
    expect([...initialSelection([CAUGHT_UP], "behind")]).toEqual(["c"]);
    /* The default keeps the builder and the Share banner exactly as they were. */
    expect([...initialSelection([BEHIND_A, CAUGHT_UP], "all")].sort()).toEqual(["a", "c"]);
  });
});

/* ── the hook ─────────────────────────────────────────────────────────────────────── */

function recipient(id: string, versionsBehind: number) {
  return {
    shareLinkId: id,
    contactId: `contact-${id}`,
    contactDisplayName: `Person ${id}`,
    contactPhoneE164: "+919999900000",
    versionsBehind,
    lastNotifiedVersion: 1,
  };
}

function Probe({ cardId, status }: { cardId: string | null; status: CardSyncStatus }) {
  /* A stand-in for the workspace's `data`: bumping it is "a field edit just landed". */
  const [data, setData] = useState({});
  const result = useCardAudience(cardId, data, status);
  return (
    <div>
      <button type="button" onClick={() => setData({})}>
        edit landed
      </button>
      <output data-targets>{result.targets.map((t) => t.shareLinkId).join(",")}</output>
      <output data-nudge-count>{result.nudge}</output>
    </div>
  );
}

const read = (selector: string) => document.querySelector(selector)?.textContent;

describe("useCardAudience", () => {
  it("totalBehind sums every gap and ignores null (revoked)", () => {
    expect(totalBehind([BEHIND_A, BEHIND_B, CAUGHT_UP, REVOKED])).toBe(3);
  });

  it("does not nudge on the first read, then nudges only when the total GROWS", async () => {
    audience.mockResolvedValue({ currentVersion: 3, recipients: [recipient("a", 1)] });
    renderWithProviders(<Probe cardId={CARD_ID} status="idle" />);
    await waitFor(() => expect(read("[data-targets]")).toBe("a"));
    expect(read("[data-nudge-count]")).toBe("0");

    /* An edit lands and the server now says they are further behind → one nudge. */
    audience.mockResolvedValue({ currentVersion: 4, recipients: [recipient("a", 2)] });
    await userEvent.click(screen.getByText("edit landed"));
    await waitFor(() => expect(read("[data-nudge-count]")).toBe("1"));

    /* The same gap re-read (an edit the server ignored) is not news. */
    audience.mockResolvedValue({ currentVersion: 4, recipients: [recipient("a", 2)] });
    await userEvent.click(screen.getByText("edit landed"));
    await waitFor(() => expect(audience).toHaveBeenCalledTimes(3));
    expect(read("[data-nudge-count]")).toBe("1");

    /* A send shrinking it is not news either. */
    audience.mockResolvedValue({ currentVersion: 4, recipients: [recipient("a", 0)] });
    await userEvent.click(screen.getByText("edit landed"));
    await waitFor(() => expect(audience).toHaveBeenCalledTimes(4));
    expect(read("[data-nudge-count]")).toBe("1");
  });

  it("waits while the card's field selection is still saving, and reads once it has saved", async () => {
    audience.mockResolvedValue({ currentVersion: 3, recipients: [recipient("a", 1)] });
    const { rerender } = renderWithProviders(<Probe cardId={CARD_ID} status="pending" />);
    /* A read now would report the OLD version — the PUT has not landed. */
    await act(async () => {});
    expect(audience).not.toHaveBeenCalled();

    rerender(<Probe cardId={CARD_ID} status="saving" />);
    await act(async () => {});
    expect(audience).not.toHaveBeenCalled();

    rerender(<Probe cardId={CARD_ID} status="saved" />);
    await waitFor(() => expect(audience).toHaveBeenCalledTimes(1));
  });

  it("never shows another card's recipients while this card's read is in flight", async () => {
    audience.mockResolvedValue({ currentVersion: 3, recipients: [recipient("a", 1)] });
    const { rerender } = renderWithProviders(<Probe cardId="card-1" status="idle" />);
    await waitFor(() => expect(read("[data-targets]")).toBe("a"));

    audience.mockReturnValue(new Promise(() => {})); // card-2's read never resolves
    rerender(<Probe cardId="card-2" status="idle" />);
    expect(read("[data-targets]")).toBe("");
  });

  it("swallows a failed read — the edit already saved, so no error and no button change", async () => {
    audience.mockRejectedValue(new Error("network"));
    renderWithProviders(<Probe cardId={CARD_ID} status="idle" />);
    await waitFor(() => expect(audience).toHaveBeenCalled());
    expect(read("[data-targets]")).toBe("");
  });
});
