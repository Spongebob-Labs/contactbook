import { maskPhone, redact } from './redact';

describe('redact', () => {
  it('drops secret-bearing values', () => {
    const out = redact({
      token: 'abc',
      password: 'p',
      otp: '123456',
      value: 'ada@acme.com',
    });
    expect(out).toEqual({
      token: '[redacted]',
      password: '[redacted]',
      otp: '[redacted]',
      value: '[redacted]',
    });
  });

  // Regression: a bare 'code' key in the deny list matched the error envelope's
  // error code and logged "[redacted]" instead of NOT_FOUND, which is exactly
  // the over-broad matching this module exists to avoid.
  it('keeps the error envelope code and other benign id-like keys', () => {
    const out = redact({
      code: 'NOT_FOUND',
      cardId: 'c1',
      objectKey: 'k',
      linkTokenPrefix: 'ab12cd',
    });
    expect(out).toEqual({
      code: 'NOT_FOUND',
      cardId: 'c1',
      objectKey: 'k',
      linkTokenPrefix: 'ab12cd',
    });
  });

  it('masks phone numbers rather than dropping them', () => {
    expect(maskPhone('+919876543210')).toBe('+91••••••3210');
    expect(
      (redact({ phoneE164: '+14155550142' }) as Record<string, string>)
        .phoneE164,
    ).toBe('+14•••••0142');
  });

  it('recurses into nested objects and arrays', () => {
    const out = redact({ items: [{ password: 'x', label: 'Work mobile' }] });
    expect(out).toEqual({
      items: [{ password: '[redacted]', label: 'Work mobile' }],
    });
  });

  it('stops at a depth limit rather than following a cycle forever', () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 20; i++) {
      cur.next = {};
      cur = cur.next as Record<string, unknown>;
    }
    expect(() => redact(deep)).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain('depth-limit');
  });

  it('serialises Errors without losing the stack', () => {
    const out = redact(new Error('boom')) as Record<string, unknown>;
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom');
    expect(typeof out.stack).toBe('string');
  });
});
