import { randomBytes } from "node:crypto";

const VANITY_MAX_LENGTH = 32;

/**
 * Crockford-flavoured base32: no 0/1/i/l/o, so a slug survives being read
 * aloud or copied off a printed card without ambiguity.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * 8 symbols over a 31-symbol alphabet is ~39.6 bits (~8.5e11 combinations).
 *
 * This is the whole reason slugs carry a suffix. A published card exposes a
 * real phone number and email, so a guessable URL is a harvesting vector — an
 * attacker who knows the vanity half must still brute-force the rest, and at
 * this width that is not worth attempting. Do not shorten it.
 */
const ENTROPY_LENGTH = 8;

/** Largest byte value that maps onto the alphabet without modulo bias. */
const UNBIASED_CEILING = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

/** "Vansh's Work Card!" -> "vansh-s-work-card" */
export function slugifyVanity(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, VANITY_MAX_LENGTH)
    .replace(/-+$/g, "");

  return cleaned || "card";
}

/** Cryptographically random suffix, rejection-sampled so every symbol is equally likely. */
export function randomSlugSuffix(length = ENTROPY_LENGTH): string {
  const out: string[] = [];

  while (out.length < length) {
    for (const byte of randomBytes((length - out.length) * 2)) {
      if (byte >= UNBIASED_CEILING) {
        continue;
      }
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === length) {
        break;
      }
    }
  }

  return out.join("");
}

/** "Work Card" -> "work-card-k7qm9x2r" */
export function buildCardSlug(cardName: string): string {
  return `${slugifyVanity(cardName)}-${randomSlugSuffix()}`;
}
