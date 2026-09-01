/**
 * The fixture profile — 7 `FieldGroup`s, one per `FieldCategory`, and 35 `ProfileField`s
 * covering all 21 `FieldType`s (spec §10.3).
 *
 * The coverage requirement is not decorative: `FIELD_RENDERERS` is exhaustive over
 * `FieldType` (AC-21), so a type with no fixture field has a renderer nobody can look at.
 * Every type below is reachable from at least one card in `cards.ts`.
 *
 * A card owns no data (§5.3) — everything a card shows comes from this file.
 */

import type { FieldGroup, ProfileField } from "@/types/domain";
import { fixtureUser } from "@/fixtures/user";

const OWNER = fixtureUser.id;

export const fixtureGroups: readonly FieldGroup[] = [
  {
    id: "group_identity",
    userId: OWNER,
    category: "IDENTITY",
    name: "Identity",
    fieldIds: ["field_photo", "field_bio", "field_dob"],
  },
  {
    id: "group_personal",
    userId: OWNER,
    category: "PERSONAL",
    name: "Personal",
    fieldIds: [
      "field_mobile",
      "field_personal_email",
      "field_home_address",
      "field_home_landline",
      "field_relation",
      "field_status",
      "field_location",
    ],
  },
  {
    id: "group_work",
    userId: OWNER,
    category: "WORK",
    name: "Work",
    fieldIds: [
      "field_job_title",
      "field_company",
      "field_department",
      "field_work_email",
      "field_work_phone",
      "field_site_url",
      "field_desk_landline",
      "field_fax",
      "field_work_address",
    ],
  },
  {
    id: "group_business",
    userId: OWNER,
    category: "BUSINESS",
    name: "Business",
    fieldIds: ["field_gstin", "field_cin", "field_press_url", "field_registered_address"],
  },
  {
    id: "group_social",
    userId: OWNER,
    category: "SOCIAL",
    name: "Social",
    fieldIds: [
      "field_linkedin",
      "field_x",
      "field_instagram",
      "field_github",
      "field_mastodon",
    ],
  },
  {
    id: "group_financial",
    userId: OWNER,
    category: "FINANCIAL",
    name: "Payments",
    fieldIds: ["field_bank", "field_upi", "field_paypal", "field_crypto"],
  },
  {
    id: "group_custom",
    userId: OWNER,
    category: "CUSTOM",
    name: "Custom",
    fieldIds: ["field_pronouns", "field_studio_handle", "field_draft_note"],
  },
] as const satisfies readonly FieldGroup[];

export const fixtureFields: readonly ProfileField[] = [
  /* ── IDENTITY ─────────────────────────────────────────────────────────────────────── */
  {
    id: "field_photo",
    groupId: "group_identity",
    type: "PHOTO",
    label: "Profile photo",
    // PLACEHOLDER-ART — procedurally generated, see the run-log.
    value: "/portraits/priyanka.png",
    isSensitive: false,
  },
  {
    // First mapped TEXT field wins the bio slot (§5.3a precedence step 1).
    id: "field_bio",
    groupId: "group_identity",
    type: "TEXT",
    label: "About",
    value:
      "Builds the studio's telecom and fintech alliances across South Asia. Ex-product, still writes the deck.",
    isSensitive: false,
  },
  {
    id: "field_dob",
    groupId: "group_identity",
    type: "DATE",
    label: "Date of birth",
    value: "1991-03-08",
    isSensitive: true,
  },

  /* ── PERSONAL ─────────────────────────────────────────────────────────────────────── */
  {
    id: "field_mobile",
    groupId: "group_personal",
    type: "PHONE",
    label: "Mobile",
    value: "+919833004411",
    isSensitive: false,
  },
  {
    id: "field_personal_email",
    groupId: "group_personal",
    type: "EMAIL",
    label: "Personal email",
    value: "priyanka.r@mailbox.example",
    isSensitive: false,
  },
  {
    id: "field_home_address",
    groupId: "group_personal",
    type: "ADDRESS",
    label: "Home",
    value: "Flat 12, Sunder Nagar, Off Carter Road, Mumbai, Maharashtra, 400050, India",
    isSensitive: true,
    detail: {
      kind: "ADDRESS",
      line1: "Flat 12, Sunder Nagar",
      line2: "Off Carter Road",
      city: "Mumbai",
      region: "Maharashtra",
      postalCode: "400050",
      country: "India",
    },
  },
  {
    id: "field_home_landline",
    groupId: "group_personal",
    type: "LANDLINE",
    label: "Home landline",
    value: "+912261234567",
    isSensitive: true,
  },
  {
    id: "field_relation",
    groupId: "group_personal",
    type: "RELATION",
    label: "Emergency contact",
    value: "Anand Raghunathan — brother",
    isSensitive: true,
  },
  {
    id: "field_status",
    groupId: "group_personal",
    type: "STATUS",
    label: "Availability",
    value: "Taking partnership intros this quarter",
    isSensitive: false,
  },
  {
    // §7.3: a status, never a coordinate, on any surface.
    id: "field_location",
    groupId: "group_personal",
    type: "LOCATION_TRACKING",
    label: "Live location",
    value: "Sharing with saved contacts",
    isSensitive: false,
  },

  /* ── WORK ─────────────────────────────────────────────────────────────────────────── */
  {
    id: "field_job_title",
    groupId: "group_work",
    type: "JOB_TITLE",
    label: "Role",
    value: "Head of Partnerships",
    isSensitive: false,
  },
  {
    id: "field_company",
    groupId: "group_work",
    type: "COMPANY",
    label: "Company",
    value: "Fernwood Studio",
    isSensitive: false,
  },
  {
    id: "field_department",
    groupId: "group_work",
    type: "DEPARTMENT",
    label: "Team",
    value: "Revenue & Alliances",
    isSensitive: false,
  },
  {
    id: "field_work_email",
    groupId: "group_work",
    type: "EMAIL",
    label: "Work email",
    value: "priyanka@fernwood.example",
    isSensitive: false,
  },
  {
    id: "field_work_phone",
    groupId: "group_work",
    type: "PHONE",
    label: "Work mobile",
    value: "+919820115577",
    isSensitive: false,
  },
  {
    id: "field_site_url",
    groupId: "group_work",
    type: "URL",
    label: "Website",
    value: "https://fernwood.example",
    isSensitive: false,
  },
  {
    id: "field_desk_landline",
    groupId: "group_work",
    type: "LANDLINE",
    label: "Desk",
    value: "+912243005500",
    isSensitive: false,
  },
  {
    id: "field_fax",
    groupId: "group_work",
    type: "FAX",
    label: "Fax",
    value: "+912243005599",
    isSensitive: false,
  },
  {
    id: "field_work_address",
    groupId: "group_work",
    type: "ADDRESS",
    label: "Studio",
    value: "Fernwood Studio, 4th Floor, Raheja Titanium, Goregaon East, Mumbai, 400063, India",
    isSensitive: false,
    detail: {
      kind: "ADDRESS",
      line1: "Fernwood Studio, 4th Floor",
      line2: "Raheja Titanium, Goregaon East",
      city: "Mumbai",
      region: "Maharashtra",
      postalCode: "400063",
      country: "India",
    },
  },

  /* ── BUSINESS ─────────────────────────────────────────────────────────────────────── */
  {
    id: "field_gstin",
    groupId: "group_business",
    type: "REG_NUMBER",
    label: "GSTIN",
    value: "27AAKCS4321M1Z9",
    isSensitive: false,
  },
  {
    id: "field_cin",
    groupId: "group_business",
    type: "REG_NUMBER",
    label: "CIN",
    value: "U72900MH2021PTC367412",
    isSensitive: false,
  },
  {
    // Long enough to prove the 34-character URL clamp of §6.6.
    id: "field_press_url",
    groupId: "group_business",
    type: "URL",
    label: "Press kit",
    value: "https://fernwood.example/press/2026-partnerships-overview",
    isSensitive: false,
  },
  {
    id: "field_registered_address",
    groupId: "group_business",
    type: "ADDRESS",
    label: "Registered office",
    value: "Unit 7, Kamala Mills, Lower Parel, Mumbai, 400013, India",
    isSensitive: false,
    detail: {
      kind: "ADDRESS",
      line1: "Unit 7, Kamala Mills",
      line2: null,
      city: "Mumbai",
      region: "Maharashtra",
      postalCode: "400013",
      country: "India",
    },
  },

  /* ── SOCIAL ───────────────────────────────────────────────────────────────────────── */
  {
    id: "field_linkedin",
    groupId: "group_social",
    type: "SOCIAL_LINK",
    label: "LinkedIn",
    value: "https://www.linkedin.com/in/priyankaraghunathan",
    isSensitive: false,
  },
  {
    id: "field_x",
    groupId: "group_social",
    type: "SOCIAL_LINK",
    label: "X",
    value: "https://x.com/prya_builds",
    isSensitive: false,
  },
  {
    id: "field_instagram",
    groupId: "group_social",
    type: "SOCIAL_LINK",
    label: "Instagram",
    value: "https://instagram.com/prya.builds",
    isSensitive: false,
  },
  {
    id: "field_github",
    groupId: "group_social",
    type: "SOCIAL_LINK",
    label: "GitHub",
    value: "https://github.com/prya",
    isSensitive: false,
  },
  {
    // §11 E-23: an unrecognised hostname must render a generic glyph plus the hostname.
    id: "field_mastodon",
    groupId: "group_social",
    type: "SOCIAL_LINK",
    label: "Mastodon",
    value: "https://mastodon.example/@prya",
    isSensitive: false,
  },

  /* ── FINANCIAL — every value here renders masked on a public surface (§7.3) ────────── */
  {
    id: "field_bank",
    groupId: "group_financial",
    type: "BANK_ACCOUNT",
    label: "Business account",
    value: "50100412345678",
    isSensitive: true,
    detail: {
      kind: "BANK_ACCOUNT",
      bankName: "HDFC Bank",
      accountNumber: "50100412345678",
      routingCode: "HDFC0000123",
    },
  },
  {
    id: "field_upi",
    groupId: "group_financial",
    type: "DIGITAL_WALLET",
    label: "UPI",
    value: "priyanka@okhdfcbank",
    isSensitive: false,
    detail: {
      kind: "DIGITAL_WALLET",
      provider: "UPI",
      handle: "priyanka@okhdfcbank",
    },
  },
  {
    id: "field_paypal",
    groupId: "group_financial",
    type: "DIGITAL_WALLET",
    label: "PayPal",
    value: "prya.pays",
    isSensitive: false,
    detail: {
      kind: "DIGITAL_WALLET",
      provider: "PayPal",
      handle: "prya.pays",
    },
  },
  {
    id: "field_crypto",
    groupId: "group_financial",
    type: "CRYPTO_WALLET",
    label: "Ethereum",
    value: "0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612",
    isSensitive: true,
    detail: {
      kind: "CRYPTO_WALLET",
      network: "Ethereum",
      address: "0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612",
    },
  },

  /* ── CUSTOM ───────────────────────────────────────────────────────────────────────── */
  {
    id: "field_pronouns",
    groupId: "group_custom",
    type: "CUSTOM",
    label: "Pronouns",
    value: "she/her",
    isSensitive: false,
  },
  {
    id: "field_studio_handle",
    groupId: "group_custom",
    type: "CUSTOM",
    label: "Studio handle",
    value: "@fernwood.studio",
    isSensitive: false,
  },
  {
    // §11 E-07: a blank value is excluded from `ResolvedCard.fields` and omitted from the
    // `.vcf` — never rendered as an empty row. It is a fixture precisely so that is provable.
    id: "field_draft_note",
    groupId: "group_custom",
    type: "TEXT",
    label: "Draft note",
    value: "",
    isSensitive: false,
  },
] as const satisfies readonly ProfileField[];
