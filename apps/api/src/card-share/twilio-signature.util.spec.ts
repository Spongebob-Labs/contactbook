import { createHmac } from "node:crypto";
import {
  computeTwilioSignature,
  isValidTwilioSignature,
} from "./twilio-signature.util";

const AUTH_TOKEN = "test-auth-token";
const URL = "https://api.example.com/api/v1/webhooks/twilio/status";
const PARAMS = { MessageSid: "SM123", MessageStatus: "delivered" };

function referenceSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

describe("computeTwilioSignature", () => {
  it("matches a from-scratch HMAC-SHA1 reference implementation", () => {
    expect(computeTwilioSignature(AUTH_TOKEN, URL, PARAMS)).toBe(
      referenceSignature(AUTH_TOKEN, URL, PARAMS),
    );
  });

  it("sorts params by key regardless of input order", () => {
    const a = computeTwilioSignature(AUTH_TOKEN, URL, {
      MessageStatus: "delivered",
      MessageSid: "SM123",
    });
    const b = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    expect(a).toBe(b);
  });

  it("changes when any param value changes", () => {
    const changed = computeTwilioSignature(AUTH_TOKEN, URL, {
      ...PARAMS,
      MessageStatus: "failed",
    });
    expect(changed).not.toBe(computeTwilioSignature(AUTH_TOKEN, URL, PARAMS));
  });
});

describe("isValidTwilioSignature", () => {
  it("accepts a correctly computed signature", () => {
    const sig = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, sig)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const sig = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    const tampered = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, tampered)).toBe(
      false,
    );
  });

  it("rejects a signature computed against different params (replay from another payload)", () => {
    const sig = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    expect(
      isValidTwilioSignature(AUTH_TOKEN, URL, { ...PARAMS, ErrorCode: "63003" }, sig),
    ).toBe(false);
  });

  it("rejects when the header is missing", () => {
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, undefined)).toBe(
      false,
    );
  });
});
