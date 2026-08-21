export type WhatsappErrorClass =
  | 'PERMANENT'
  | 'THROTTLED'
  | 'TRANSIENT'
  | 'CONFIG';

export class TwilioSendError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly twilioCode: number | null,
    readonly isTimeout = false,
  ) {
    super(message);
    this.name = 'TwilioSendError';
  }
}

// Recipient's problem, not ours. Fails once; no retry burns attempts against a
// number that will never receive a WhatsApp message.
const PERMANENT_CODES = new Set([
  21211, // invalid To number
  21408, // permission not enabled for region
  21610, // recipient opted out (STOP)
  21614, // not a mobile number
  21608, // unverified number on a trial account
  63003, // recipient not on WhatsApp
  63013, // blocked by WhatsApp policy
  63016, // free-form outside the 24h window — a template was required
  63024, // invalid recipient
]);

// WhatsApp/Twilio-side rate limiting. Back off; the same send will likely
// succeed shortly.
const THROTTLED_CODES = new Set([
  63018, // WhatsApp rate limit
  20429, // Twilio API rate limit
]);

// EVERY send is broken — credentials, sender, or template. Distinct from
// PERMANENT (which is normal, per-recipient background noise) because this
// class should page someone; see docs/architecture/observability.md §5.
const CONFIG_CODES = new Set([
  20003, // authentication failed
  20404, // resource not found — bad Account SID or ContentSid
  63005, // template not approved
  63007, // From number is not a valid WhatsApp sender
]);

export function classifyTwilioError(err: TwilioSendError): WhatsappErrorClass {
  if (err.twilioCode && PERMANENT_CODES.has(err.twilioCode)) return 'PERMANENT';
  if (err.twilioCode && THROTTLED_CODES.has(err.twilioCode)) return 'THROTTLED';
  if (err.twilioCode && CONFIG_CODES.has(err.twilioCode)) return 'CONFIG';
  if (err.httpStatus === 429) return 'THROTTLED';
  if (err.httpStatus === 401 || err.httpStatus === 403) return 'CONFIG';
  if (err.httpStatus >= 500 || err.isTimeout) return 'TRANSIENT';
  // Unknown errors get the benefit of the doubt, capped by the outbox's max
  // attempt count rather than treated as permanent on the first failure.
  return 'TRANSIENT';
}
