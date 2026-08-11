import { describe, expect, it } from "vitest";
import {
  SHAREABLE_FIELD_META,
  SHAREABLE_FIELD_TYPES,
  canResendRecipient,
  isBatchSettled,
  isDispatchSettled,
  isShareableFieldType,
  type CardShareBatch,
  type CardShareRecipient,
} from "@/lib/card-share-types";

function recipient(
  overrides: Partial<CardShareRecipient> = {},
): CardShareRecipient {
  return {
    id: "r1",
    countryCode: "+91",
    phone: "9347243575",
    contactId: null,
    dispatchStatus: "PENDING",
    deliveryStatus: null,
    lastDispatchError: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    createdAt: "2026-08-08T09:37:52.281Z",
    ...overrides,
  };
}

function batch(recipients: CardShareRecipient[]): CardShareBatch {
  return {
    id: "b1",
    cardId: "c1",
    cardName: "Personal",
    cardType: "PERSONAL",
    note: null,
    createdAt: "2026-08-08T09:37:52.240Z",
    recipients,
  };
}

describe("shareable field types", () => {
  it("covers every type with picker copy", () => {
    for (const type of SHAREABLE_FIELD_TYPES) {
      expect(SHAREABLE_FIELD_META[type]?.label).toBeTruthy();
      expect(SHAREABLE_FIELD_META[type]?.vcfProperty).toBeTruthy();
    }
  });

  it("rejects types the API would not accept", () => {
    expect(isShareableFieldType("PHONE")).toBe(true);
    expect(isShareableFieldType("BANK_ACCOUNT")).toBe(false);
    expect(isShareableFieldType("TEXT")).toBe(false);
  });
});

describe("dispatch settling", () => {
  it("keeps polling while a recipient is queued, sending, or retrying", () => {
    expect(isDispatchSettled(recipient({ dispatchStatus: "PENDING" }))).toBe(false);
    expect(isDispatchSettled(recipient({ dispatchStatus: "PROCESSING" }))).toBe(
      false,
    );
    expect(isDispatchSettled(recipient({ dispatchStatus: "RETRYING" }))).toBe(
      false,
    );
  });

  it("treats a hand-off to Twilio as unsettled until delivery lands", () => {
    expect(
      isDispatchSettled(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: null }),
      ),
    ).toBe(false);
    expect(
      isDispatchSettled(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: "SENT" }),
      ),
    ).toBe(false);
    expect(
      isDispatchSettled(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: "DELIVERED" }),
      ),
    ).toBe(true);
    expect(
      isDispatchSettled(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: "READ" }),
      ),
    ).toBe(true);
  });

  it("settles once dispatch has exhausted its retries", () => {
    expect(isDispatchSettled(recipient({ dispatchStatus: "FAILED" }))).toBe(true);
  });

  it("settles a batch only when every recipient has", () => {
    const delivered = recipient({
      dispatchStatus: "DISPATCHED",
      deliveryStatus: "DELIVERED",
    });
    expect(isBatchSettled(batch([delivered, delivered]))).toBe(true);
    expect(
      isBatchSettled(batch([delivered, recipient({ dispatchStatus: "PENDING" })])),
    ).toBe(false);
  });
});

describe("resend eligibility", () => {
  it("matches the states the API accepts a retry for", () => {
    expect(canResendRecipient(recipient({ dispatchStatus: "FAILED" }))).toBe(true);
    expect(
      canResendRecipient(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: "FAILED" }),
      ),
    ).toBe(true);
  });

  it("stays closed for anything the API would answer 409 to", () => {
    expect(canResendRecipient(recipient({ dispatchStatus: "PENDING" }))).toBe(
      false,
    );
    expect(canResendRecipient(recipient({ dispatchStatus: "RETRYING" }))).toBe(
      false,
    );
    expect(
      canResendRecipient(
        recipient({ dispatchStatus: "DISPATCHED", deliveryStatus: "DELIVERED" }),
      ),
    ).toBe(false);
  });
});
