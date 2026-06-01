import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PACK_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;

export function parseOAuthEncryptionKeyBase64(raw: string): Buffer {
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `OAUTH token encryption key must decode to ${KEY_BYTES} bytes, got ${decoded.length}`,
    );
  }
  return decoded;
}

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64;
  if (!raw) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY_BASE64 is required to encrypt OAuth tokens",
    );
  }

  cachedKey = parseOAuthEncryptionKeyBase64(raw);
  return cachedKey;
}

export function encryptOAuthTokenWithKey(
  plaintext: string,
  key: Buffer,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PACK_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function encryptOAuthToken(plaintext: string): string {
  return encryptOAuthTokenWithKey(plaintext, loadKey());
}

export function decryptOAuthTokenWithKey(packed: string, key: Buffer): string {
  const parts = packed.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted OAuth token payload");
  }

  const [version, ivB64, tagB64, ciphertextB64] = parts;
  if (version !== PACK_VERSION) {
    throw new Error(`Unsupported encrypted token version: ${version}`);
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/** Decrypt v1 ciphertext, or return legacy plaintext tokens stored before encryption. */
export function decryptOAuthTokenStoredWithKey(
  stored: string,
  key: Buffer,
): string {
  if (!stored.startsWith(`${PACK_VERSION}.`)) {
    return stored;
  }
  return decryptOAuthTokenWithKey(stored, key);
}

/** Decrypt v1 ciphertext, or return legacy plaintext tokens stored before encryption. */
export function decryptOAuthTokenStored(stored: string): string {
  return decryptOAuthTokenStoredWithKey(stored, loadKey());
}

export function decryptOAuthToken(packed: string): string {
  return decryptOAuthTokenWithKey(packed, loadKey());
}

// Exposed only for tests; do not use in application code.
export const __cryptoInternals = {
  resetKeyCache(): void {
    cachedKey = null;
  },
};
