import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ENVELOPE_PREFIX = 'cbf1'; // key-generation marker — see rotation note below

const FINANCIAL_TYPES = new Set([
  'BANK_ACCOUNT',
  'DIGITAL_WALLET',
  'CRYPTO_WALLET',
]);

export function isFinancialFieldType(type: string): boolean {
  return FINANCIAL_TYPES.has(type);
}

export class FieldEncryptionError extends Error {}

/**
 * AES-256-GCM, envelope `cbf1.<ivB64url>.<tagB64url>.<ciphertextB64url>`.
 *
 * The AAD binding is the part that actually matters here. Without it, a
 * ciphertext is portable: someone with write access to the DB could copy one
 * user's encrypted account number into another user's row and it would
 * decrypt cleanly, since GCM only authenticates the bytes you tell it to. AAD
 * bound to `${userId}:${fieldId}:${type}` makes a moved ciphertext fail
 * authentication instead of silently decrypting into the wrong person's data.
 *
 * Key rotation: `cbf1` is a key-generation marker in the envelope. Adding a
 * `cbf2` scheme lets both decrypt during a rolling re-encrypt; remove the old
 * key once no `cbf1` rows remain. There is no rotation tooling yet — this is
 * the hook for it.
 */
function getKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new FieldEncryptionError(
      `FIELD_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  return key;
}

function aadFor(userId: string, fieldId: string, type: string): Buffer {
  return Buffer.from(`${userId}:${fieldId}:${type}`, 'utf8');
}

export function encryptFieldValue(
  base64Key: string,
  ids: { userId: string; fieldId: string; type: string },
  plaintext: string,
): string {
  const key = getKey(base64Key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aadFor(ids.userId, ids.fieldId, ids.type));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptFieldValue(
  base64Key: string,
  ids: { userId: string; fieldId: string; type: string },
  envelope: string,
): string {
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
    throw new FieldEncryptionError(
      'Malformed or unrecognised encryption envelope.',
    );
  }
  const [, ivPart, tagPart, ciphertextPart] = parts;

  const key = getKey(base64Key);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  decipher.setAAD(aadFor(ids.userId, ids.fieldId, ids.type));

  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    // GCM auth failure — wrong key, tampered ciphertext, or (the case this
    // whole scheme exists to catch) a ciphertext moved to a different row.
    throw new FieldEncryptionError(
      'Failed to decrypt field value: authentication failed.',
    );
  }
}

export function isEncryptedEnvelope(value: string): boolean {
  return value.startsWith(`${ENVELOPE_PREFIX}.`);
}
