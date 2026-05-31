import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PACK_PREFIX = "cbfe:v1:";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;

export function parseFinancialEncryptionKeyBase64(raw: string): Buffer {
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `Financial field encryption key must decode to ${KEY_BYTES} bytes, got ${decoded.length}`,
    );
  }
  return decoded;
}

function loadKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }
  const raw = process.env.FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64;
  if (!raw) {
    throw new Error(
      "FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64 is required to encrypt financial profile fields",
    );
  }
  cachedKey = parseFinancialEncryptionKeyBase64(raw);
  return cachedKey;
}

export function isEncryptedFieldValue(
  stored: string | null | undefined,
): boolean {
  return typeof stored === "string" && stored.startsWith(PACK_PREFIX);
}

export function encryptFieldValue(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
  return `${PACK_PREFIX}${packed}`;
}

export function decryptFieldValue(packed: string): string {
  if (!packed.startsWith(PACK_PREFIX)) {
    return packed;
  }
  const key = loadKey();
  const body = packed.slice(PACK_PREFIX.length);
  const parts = body.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted field payload");
  }
  const [ivB64, tagB64, ciphertextB64] = parts;
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

export function decryptFieldValueIfNeeded(
  stored: string | null | undefined,
): string | null {
  if (stored == null || stored === "") {
    return stored ?? null;
  }
  if (!isEncryptedFieldValue(stored)) {
    return stored;
  }
  return decryptFieldValue(stored);
}

export const __fieldCryptoInternals = {
  resetKeyCache(): void {
    cachedKey = null;
  },
};
