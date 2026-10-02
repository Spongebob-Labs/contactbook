import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `createCardAction` — the atomic create.
 *
 * `POST /cards` now accepts `fieldIds`, so the card and its `CardField` rows land in one server
 * transaction. This action used to make two calls (`createCard` then `setCardFields`) and could
 * half-fail, leaving an empty card behind. The assertion that matters is therefore the shape of
 * the call: `fieldIds` must ride the create, and **no second `setCardFields` may be made**.
 *
 * The transport serialization of that array (repeated multipart parts) is pinned separately in
 * `api-browser-routing.test.ts`; this file pins the action's decision to send it at all.
 */

const mocks = vi.hoisted(() => ({
  createCard: vi.fn(),
  setCardFields: vi.fn(),
  updateCard: vi.fn(),
  updateField: vi.fn(),
  updateShareLink: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { createCard, setCardFields, revalidatePath } = mocks;

vi.mock("@/lib/api", () => ({
  cards: {
    createCard: mocks.createCard,
    setCardFields: mocks.setCardFields,
    updateCard: mocks.updateCard,
    archiveCard: vi.fn(),
    shareCard: vi.fn(),
  },
  profile: { updateField: mocks.updateField },
  shareLinks: { updateShareLink: mocks.updateShareLink },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createCardAction } from "@/lib/actions/cards";

beforeEach(() => {
  createCard.mockReset().mockResolvedValue({ id: "card_1" });
  setCardFields.mockReset();
  revalidatePath.mockReset();
});

describe("createCardAction", () => {
  it("carries fieldIds on the create and makes no second field call", async () => {
    const result = await createCardAction({
      name: "  Work  ",
      type: "BUSINESS",
      fieldIds: ["a", "b"],
    });

    expect(result).toMatchObject({ ok: true, data: { cardId: "card_1" } });
    expect(createCard).toHaveBeenCalledTimes(1);
    expect(createCard).toHaveBeenCalledWith({
      name: "Work",
      kind: "WORK",
      fieldIds: ["a", "b"],
    });
    // The whole point: no non-atomic follow-up.
    expect(setCardFields).not.toHaveBeenCalled();
  });

  it("omits fieldIds entirely when there are none", async () => {
    await createCardAction({ name: "Work", type: "CUSTOM", fieldIds: [] });
    expect(createCard).toHaveBeenCalledWith({ name: "Work", kind: "CUSTOM" });
  });

  it("refuses a blank name without spending a request", async () => {
    const result = await createCardAction({ name: "   ", type: "CUSTOM", fieldIds: [] });
    expect(result).toMatchObject({ ok: false });
    expect(createCard).not.toHaveBeenCalled();
  });
});
