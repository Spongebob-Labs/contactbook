/**
 * **Maya Laurent — the one person the landing page is about.**
 *
 * Client feedback, 2026-09-28: the hero, the animated card and how-it-works all move from the
 * app's fixture user (an Indian number, a Mumbai address) to one invented person, with contact
 * details in **London, Dubai, New York and Singapore** — the page should read as international.
 *
 * 2026-09-29: that person is now the hero's — the client's reference card, Maya Laurent, Founder
 * & CEO of Maya Partners, at home in Lisbon — so the page is one woman top to bottom (she was
 * Maya Lauren of Kestrel Telecom). Her own number, mailbox and site are the ones that card
 * prints; the four cities are Maya Partners' offices.
 *
 * This file exists so every landing section draws the same person from one place. It holds the
 * facts (name, company, cities, numbers, addresses, emails) and nothing about
 * how a section presents them — beats, row order and copy stay in `fixtures/marketing.ts`.
 *
 * ⚠ NUMBERS. The UK numbers use Ofcom's drama ranges (`020 7946 0000–0999`, `07700 900000–
 * 900999`) and New York the NANP fiction block (`555-0100–0199`); all are reserved and can never
 * ring anyone. The UAE and Singapore publish no fiction range, so those two use an `000`
 * exchange, which neither plan allocates. Do not "improve" them into realistic-looking numbers —
 * a realistic number is somebody's number. `fixture-hygiene.test.ts` checks every one.
 *
 * ⚠ DOMAINS are RFC 2606 `.example` only — `tests/contract/fixture-hygiene.test.ts` enforces it.
 */

export type MayaCityId = "london" | "dubai" | "new-york" | "singapore";

export interface MayaCity {
  readonly id: MayaCityId;
  readonly city: string;
  readonly country: string;
  /** Maya Partners' office line there. Display-formatted, international. */
  readonly phone: string;
  /** The office, in one line, as it would sit in a card row. */
  readonly address: string;
}

export const MAYA = {
  firstName: "Maya",
  lastName: "Laurent",
  fullName: "Maya Laurent",
  monogram: "ML",
  company: "Maya Partners",
  role: "Founder & CEO",
  /** The reference card's bio, in its two clauses (the hero card sets one per line). */
  bio: ["Connecting people, ideas and opportunities", "to create lasting impact."],
  /** Her own mobile, as the reference card prints it: Ofcom's 07700 900xxx drama range. */
  mobile: "+44 7700 900123",
  /** The reference card's mailbox, moved from `.com` to `.example`. */
  personalEmail: "maya@contactbook.example",
  workEmail: "maya@mayapartners.example",
  /** Display form, as the reference card prints it; a URL field adds the scheme. */
  website: "www.mayapartners.example",
  linkedin: "linkedin.com/in/maya-laurent-example",
  /** Home. City only, as the reference card prints it; no street is invented for her. */
  home: { city: "Lisbon", country: "Portugal" },
} as const;

export const MAYA_CITIES: readonly MayaCity[] = [
  {
    id: "london",
    city: "London",
    country: "United Kingdom",
    phone: "+44 20 7946 0958",
    address: "14 Wren Yard, London EC2A 4NE",
  },
  {
    id: "dubai",
    city: "Dubai",
    country: "United Arab Emirates",
    phone: "+971 4 000 0147",
    address: "Level 21, Creek Harbour Tower, Dubai",
  },
  {
    id: "new-york",
    city: "New York",
    country: "United States",
    phone: "+1 212 555 0147",
    address: "88 Hudson Row, New York, NY 10013",
  },
  {
    id: "singapore",
    city: "Singapore",
    country: "Singapore",
    phone: "+65 6000 0147",
    address: "8 Keppel Quay, #14-02, Singapore 098631",
  },
];

export function mayaCity(id: MayaCityId): MayaCity {
  const city = MAYA_CITIES.find((c) => c.id === id);
  if (!city) throw new Error(`marketing-identity: no city "${id}"`);
  return city;
}
