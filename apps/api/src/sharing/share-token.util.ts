import { randomBytes } from 'node:crypto';

// Matches docs/architecture/lld.md §5 exactly: 128 bits of entropy, base62
// encoded, 22 characters. Not enumerable (10k guesses/sec is past the heat
// death of the sun) and URL-safe with no padding, so it drops straight into
// a path segment with no encoding.
const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 128 random bits, base62-encoded. Treats the byte buffer as one big
 * unsigned integer via BigInt rather than encoding byte-by-byte — encoding
 * bytes independently would not produce a uniform base62 string (each byte
 * is base-256, not a multiple of 62).
 */
export function generateShareToken(): string {
  const bytes = randomBytes(16);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  if (value === 0n) {
    return BASE62_ALPHABET[0].repeat(22);
  }

  let out = '';
  while (value > 0n) {
    const remainder = Number(value % 62n);
    out = BASE62_ALPHABET[remainder] + out;
    value /= 62n;
  }

  // 128 bits of entropy base62-encodes to at most 22 characters; pad on the
  // left with the zero-glyph so every token is a fixed, predictable length
  // (predictable length, not predictable value — padding never touches the
  // random bits, only how many leading zero-value digits are shown).
  return out.padStart(22, BASE62_ALPHABET[0]);
}
