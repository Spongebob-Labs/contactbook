/**
 * The nine fixture cards (spec §10.3): one per template, plus `card_empty_demo`.
 *
 * ## Each card carries its own `paletteId`, and that is load-bearing for the demo
 *
 * They did not, and the consequence was the first thing anyone noticed about `/cards`: nine
 * cards rendered as **two colours**. A card with no `paletteId` falls back to its template's
 * default (Meridian → Sapphire, Marigold → Amber), so a fixture set that never sets one shows
 * the fallback nine times and none of the product. Every palette now appears exactly once, so
 * the library screen demonstrates the range a real owner can reach.
 *
 * `card_minimal_demo` is the deliberate exception — it sets **no** `paletteId`, so the fallback
 * path stays exercised by a real screen rather than only by a unit test.
 *
 * A card owns no data — `name` and `type` are the only content here, everything else is a
 * *filter* over `profile.ts` (§5.3). Two rules this file exists to keep honest:
 *
 *  - **Every id is `card_…`-prefixed** so `/cards/new` can never be resolved as a card id
 *    (§11 E-38, AC-05).
 *  - **Every slug is short and opaque**, ≤ 24 chars of `[a-z0-9-]`, which is what keeps the
 *    QR payload under 60 bytes and the symbol at version 6 or below (§8A.6, AC-08).
 */

import type { ContactCard } from "@/types/domain";
import { fixtureUser } from "@/fixtures/user";

const OWNER = fixtureUser.id;

/** The card the §6.7 vCard example is written against — five mapped fields, slug `prya-hq`. */
export const cardLedgerDemo: ContactCard = {
  id: "card_minimal_demo",
  userId: OWNER,
  name: "Work",
  type: "BUSINESS",
  isSensitive: false,
  publicUrl: "https://card.example/c/1eLRLR5KbYdbwSn0kHB1v1",
  templateId: "meridian",
  fieldIds: [
    "field_job_title",
    "field_company",
    "field_work_phone",
    "field_work_email",
    "field_site_url",
  ],
  updatedAt: "2026-08-11T10:15:00.000Z",
} as const satisfies ContactCard;

/**
 * §11 E-01/E-02 and §11.6: a card that maps **zero** fields.
 *
 * This is a permanent fixture, not a test artefact. The old build shipped card `5a286f9e`
 * with 0 mappings and produced a 73-byte `.vcf` carrying only `FN` and `N`; keeping the
 * shape addressable in the app is what makes the guard demonstrable rather than theoretical.
 *
 * Its `updatedAt` is deliberately the newest in the set: the old build ranked presets
 * `updatedAt desc` and therefore preselected the empty card. Any list that sorts by recency
 * puts this card first, which is exactly the condition the zero-field warning must survive.
 */
export const cardEmptyDemo: ContactCard = {
  id: "card_empty_demo",
  userId: OWNER,
  name: "Blank card",
  type: "CUSTOM",
  isSensitive: false,
  publicUrl: "https://card.example/c/0g81sfFwyfSUCqeYInfGdS",
  templateId: "meridian",
  paletteId: "onyx",
  fieldIds: [],
  updatedAt: "2026-08-21T18:40:00.000Z",
} as const satisfies ContactCard;

export const fixtureCards: readonly ContactCard[] = [
  cardLedgerDemo,
  {
    id: "card_forest_demo",
    userId: OWNER,
    name: "Personal",
    type: "PERSONAL",
    isSensitive: true,
    publicUrl: "https://card.example/c/0q8UZLbKr4Q4E7rYzgb5JB",
    templateId: "meridian",
    paletteId: "clay",
    fieldIds: [
      "field_bio",
      "field_mobile",
      "field_personal_email",
      "field_instagram",
      "field_dob",
    ],
    updatedAt: "2026-08-09T08:05:00.000Z",
  },
  {
    id: "card_midnight_demo",
    userId: OWNER,
    name: "Studio",
    type: "BUSINESS",
    isSensitive: false,
    publicUrl: "https://card.example/c/1RVVEpRCeQxr5MUaTRz1Kx",
    templateId: "meridian",
    paletteId: "emerald",
    fieldIds: [
      "field_job_title",
      "field_company",
      "field_department",
      "field_work_email",
      "field_work_address",
      "field_gstin",
      "field_linkedin",
    ],
    updatedAt: "2026-08-04T16:30:00.000Z",
  },
  {
    id: "card_iris_demo",
    userId: OWNER,
    name: "Conference",
    type: "CUSTOM",
    isSensitive: false,
    publicUrl: "https://card.example/c/2A7p1aby44NMtuGw9UWoTp",
    templateId: "marigold",
    paletteId: "periwinkle",
    fieldIds: [
      "field_bio",
      "field_status",
      "field_work_email",
      "field_instagram",
      "field_x",
    ],
    updatedAt: "2026-07-29T12:00:00.000Z",
  },
  {
    // The masking card: three financial values that must never render unmasked in public
    // (§7.3, AC-33) and one sensitive account number.
    id: "card_cobalt_demo",
    userId: OWNER,
    name: "Payments",
    type: "PAYMENT",
    isSensitive: true,
    publicUrl: "https://card.example/c/0nTI4FJQ7k7Gwixe0gqZpr",
    templateId: "meridian",
    paletteId: "oxblood",
    fieldIds: [
      "field_company",
      "field_upi",
      "field_bank",
      "field_crypto",
      "field_work_phone",
    ],
    updatedAt: "2026-07-22T09:45:00.000Z",
  },
  {
    id: "card_ember_demo",
    userId: OWNER,
    name: "Neighbours",
    type: "PERSONAL",
    isSensitive: false,
    publicUrl: "https://card.example/c/15iMDFQBeKgTgCKRhKPb9x",
    templateId: "marigold",
    paletteId: "pistachio",
    fieldIds: [
      "field_bio",
      "field_mobile",
      "field_relation",
      "field_status",
      "field_location",
    ],
    updatedAt: "2026-07-15T19:20:00.000Z",
  },
  {
    id: "card_lagoon_demo",
    userId: OWNER,
    // No PHONE mapped: §11 E-56 — the WhatsApp action is absent, never disabled.
    name: "Open source",
    type: "CUSTOM",
    isSensitive: false,
    publicUrl: "https://card.example/c/2mrDzqonGf5zBxdJ3i1fOl",
    templateId: "marigold",
    paletteId: "rust",
    fieldIds: [
      "field_github",
      "field_x",
      "field_site_url",
      "field_work_email",
      "field_pronouns",
    ],
    updatedAt: "2026-07-02T07:10:00.000Z",
  },
  {
    id: "card_citrus_demo",
    userId: OWNER,
    name: "Travel",
    type: "PERSONAL",
    isSensitive: false,
    publicUrl: "https://card.example/c/2XhhBoF6Lpf3nQ1hLzlJoI",
    templateId: "marigold",
    paletteId: "amber",
    fieldIds: [
      "field_mobile",
      "field_personal_email",
      "field_location",
      "field_mastodon",
      "field_studio_handle",
    ],
    updatedAt: "2026-06-18T14:55:00.000Z",
  },
  cardEmptyDemo,
] as const satisfies readonly ContactCard[];
