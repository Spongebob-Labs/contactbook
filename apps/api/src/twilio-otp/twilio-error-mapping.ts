/**
 * Transport-level failure talking to Twilio. `httpStatus` is the status the API
 * should surface to the caller (already mapped from the Twilio error code), and
 * `twilioCode` is Twilio's numeric error code when one was returned.
 * See https://www.twilio.com/docs/api/errors for code meanings.
 *
 * Shared by every Twilio-backed sender (OTP templates, card-share templates, ...) so the
 * error-code-to-HTTP-status mapping lives in exactly one place.
 */
export class TwilioSendError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly twilioCode: number | null = null,
    readonly moreInfo?: string,
  ) {
    super(message);
    this.name = "TwilioSendError";
  }
}

/**
 * Twilio error codes that mean the request/recipient is at fault (bad number,
 * not a WhatsApp user, unverified trial recipient, opted out). These map to a
 * 4xx so the client can correct them; everything else is treated as an upstream
 * failure (502/503) since it is our configuration or Twilio's availability.
 */
export const CLIENT_ERROR_TWILIO_CODES = new Set<number>([
  21211, // Invalid 'To' phone number
  21408, // Permission to send to this region not enabled
  21608, // Recipient not verified (trial account)
  21610, // Recipient has opted out / unsubscribed
  21614, // 'To' number is not a valid mobile number
  63003, // Channel could not find the 'To' address (not on WhatsApp)
  63013, // Message blocked by WhatsApp policy
  63024, // Invalid message recipient
]);

/** Maps a Twilio HTTP status + error code to the status we surface to callers. */
export function mapHttpStatus(
  httpStatus: number,
  twilioCode: number | null,
): number {
  if (twilioCode !== null && CLIENT_ERROR_TWILIO_CODES.has(twilioCode)) {
    return 400;
  }
  // 401/403 mean OUR credentials/permissions are wrong — never blame the client.
  if (httpStatus === 401 || httpStatus === 403) {
    return 502;
  }
  return 502;
}

// Client-safe message text is intentionally NOT shared here: each caller (OTP, card-share, ...)
// surfaces this string directly to end users, so the wording is use-case-specific even though
// the underlying Twilio error-code classification (above) is the same. See each client's own
// `mapClientMessage` for its wording.
