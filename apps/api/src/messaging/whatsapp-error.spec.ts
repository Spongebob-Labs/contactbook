import { classifyTwilioError, TwilioSendError } from './whatsapp-error';

function err(httpStatus: number, twilioCode: number | null, isTimeout = false) {
  return new TwilioSendError('test', httpStatus, twilioCode, isTimeout);
}

describe('classifyTwilioError', () => {
  it.each([
    [21211, 'PERMANENT'], // invalid To
    [21610, 'PERMANENT'], // opted out
    [63003, 'PERMANENT'], // not on WhatsApp
  ])(
    'classifies code %d as %s — fails once, never retried to exhaustion',
    (code, expected) => {
      expect(classifyTwilioError(err(400, code))).toBe(expected);
    },
  );

  it.each([
    [63018, 'THROTTLED'], // WhatsApp rate limit
    [20429, 'THROTTLED'], // Twilio API rate limit
  ])('classifies code %d as %s', (code, expected) => {
    expect(classifyTwilioError(err(429, code))).toBe(expected);
  });

  // CONFIG must stay distinct from PERMANENT: a config error means EVERY send
  // is broken and should page someone, not be treated as one bad recipient.
  it.each([
    [20003, 'CONFIG'], // auth failed
    [63005, 'CONFIG'], // template not approved
    [63007, 'CONFIG'], // bad From sender
  ])(
    'classifies code %d as %s, distinct from a per-recipient PERMANENT failure',
    (code, expected) => {
      expect(classifyTwilioError(err(400, code))).toBe(expected);
    },
  );

  it('classifies a 429 with no known code as THROTTLED', () => {
    expect(classifyTwilioError(err(429, 99999))).toBe('THROTTLED');
  });

  it('classifies 401/403 as CONFIG even without a Twilio error code', () => {
    expect(classifyTwilioError(err(401, null))).toBe('CONFIG');
    expect(classifyTwilioError(err(403, null))).toBe('CONFIG');
  });

  it('classifies a 5xx or a timeout as TRANSIENT', () => {
    expect(classifyTwilioError(err(502, null))).toBe('TRANSIENT');
    expect(classifyTwilioError(err(0, null, true))).toBe('TRANSIENT');
  });

  it('gives an unrecognised code the benefit of the doubt (TRANSIENT, not PERMANENT)', () => {
    expect(classifyTwilioError(err(400, 999999))).toBe('TRANSIENT');
  });
});
