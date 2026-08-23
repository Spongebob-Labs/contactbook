import {
  decryptFieldValue,
  encryptFieldValue,
  FieldEncryptionError,
  isEncryptedEnvelope,
  isFinancialFieldType,
} from './field-encryption.util';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const IDS = { userId: 'user-1', fieldId: 'field-1', type: 'BANK_ACCOUNT' };

describe('field-encryption.util', () => {
  it('round-trips a value through encrypt then decrypt', () => {
    const envelope = encryptFieldValue(KEY, IDS, '0123456789');
    expect(decryptFieldValue(KEY, IDS, envelope)).toBe('0123456789');
  });

  it('produces a distinct ciphertext each time (random IV)', () => {
    const a = encryptFieldValue(KEY, IDS, 'same-value');
    const b = encryptFieldValue(KEY, IDS, 'same-value');
    expect(a).not.toBe(b);
  });

  it('tags the envelope with the cbf1 key-generation marker', () => {
    const envelope = encryptFieldValue(KEY, IDS, 'x');
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(envelope.startsWith('cbf1.')).toBe(true);
  });

  // The whole reason AAD is bound to (userId, fieldId, type): a ciphertext
  // copied onto a different row must fail to decrypt, not silently succeed
  // against the wrong person's data.
  it('refuses to decrypt when the AAD (owning row) differs', () => {
    const envelope = encryptFieldValue(KEY, IDS, 'secret');
    const wrongRow = { ...IDS, fieldId: 'field-2' };
    expect(() => decryptFieldValue(KEY, wrongRow, envelope)).toThrow(
      FieldEncryptionError,
    );
  });

  it('refuses to decrypt with the wrong key', () => {
    const envelope = encryptFieldValue(KEY, IDS, 'secret');
    expect(() => decryptFieldValue(OTHER_KEY, IDS, envelope)).toThrow(
      FieldEncryptionError,
    );
  });

  it('rejects a malformed envelope rather than throwing an opaque crypto error', () => {
    expect(() => decryptFieldValue(KEY, IDS, 'not-an-envelope')).toThrow(
      FieldEncryptionError,
    );
    expect(() => decryptFieldValue(KEY, IDS, 'cbf1.only.two')).toThrow(
      FieldEncryptionError,
    );
  });

  it('rejects a key that is not exactly 32 bytes', () => {
    const shortKey = Buffer.alloc(16).toString('base64');
    expect(() => encryptFieldValue(shortKey, IDS, 'x')).toThrow(
      FieldEncryptionError,
    );
  });

  it('classifies exactly the three financial field types', () => {
    expect(isFinancialFieldType('BANK_ACCOUNT')).toBe(true);
    expect(isFinancialFieldType('DIGITAL_WALLET')).toBe(true);
    expect(isFinancialFieldType('CRYPTO_WALLET')).toBe(true);
    expect(isFinancialFieldType('PHONE')).toBe(false);
    expect(isFinancialFieldType('CUSTOM')).toBe(false);
  });
});
