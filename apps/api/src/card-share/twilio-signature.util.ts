import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio's request-signing algorithm (https://www.twilio.com/docs/usage/webhooks/webhooks-security):
 * HMAC-SHA1 over the exact request URL concatenated with each POST param's key+value,
 * sorted by key, base64-encoded. This is a different scheme from the Meta/OpenWA webhook
 * signatures elsewhere in this codebase (HMAC-SHA256, hex, over the raw body) — Twilio
 * signs the *parsed params*, not the raw bytes, so it can't reuse that verifier.
 */
export function computeTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
): string {
  let data = fullUrl;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function isValidTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const expected = Buffer.from(
    computeTwilioSignature(authToken, fullUrl, params),
    "utf8",
  );
  const actual = Buffer.from(signatureHeader, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
