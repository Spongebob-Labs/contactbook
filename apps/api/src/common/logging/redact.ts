/**
 * Keys whose values must never reach a log line at any level.
 *
 * Exact matches only. The previous implementation matched substrings including
 * `key` and `card`, which redacted harmless fields like `cardId` and `objectKey`
 * — making debugging harder while protecting nothing.
 */
const DENY_KEYS = new Set([
  'value', // ProfileField.value — the user's actual contact data
  // NOT a bare 'code': that matched the error envelope's error code and logged
  // `"code":"[redacted]"` instead of NOT_FOUND, destroying the field's whole
  // purpose. Name the secret-bearing keys precisely.
  'otp',
  'otpcode',
  'verificationcode',
  'token',
  'password',
  'authorization',
  'accountnumber',
  'accesstoken',
  'refreshtoken',
  'body', // inbound WhatsApp message content
]);

/** Keys whose values are phone numbers and should be masked rather than dropped. */
const PHONE_KEYS = new Set([
  'phone',
  'phonee164',
  'to',
  'from',
  'toe164',
  'recipientphone',
]);

const MAX_DEPTH = 6;

export function maskPhone(e164: string): string {
  if (e164.length < 7) return '•'.repeat(e164.length);
  return `${e164.slice(0, 3)}${'•'.repeat(e164.length - 7)}${e164.slice(-4)}`;
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[depth-limit]';
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));

  if (input instanceof Error) {
    return { name: input.name, message: input.message, stack: input.stack };
  }

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (DENY_KEYS.has(key)) {
        out[k] = '[redacted]';
      } else if (PHONE_KEYS.has(key) && typeof v === 'string') {
        out[k] = maskPhone(v);
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }

  return input;
}
