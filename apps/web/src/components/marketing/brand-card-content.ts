import { heroPhone, mayaProfile, solution } from "@/fixtures/marketing";
import { MAYA, mayaCity } from "@/fixtures/marketing-identity";

import type { BrandCardProps, BrandCardRow, BrandCardSection } from "./brand-card";

/**
 * What each of Maya's three example cards SAYS, in the brand card's terms. 2026-10-06.
 *
 * The Solution deck and the How-it-works panels draw the same three cards (`solution.cards`:
 * Work, Family, CV). Their field lists stay exactly the fixture's — the chip row's "which card
 * carries which field" is the section's whole argument — and this file only turns each field id
 * into the row the brand card draws: which group it sits in, which glyph, which value. Every
 * value comes from the identity file or Maya's profile fixture (all on reserved `.example`
 * domains and Ofcom drama-range numbers); nothing here is new demo data.
 *
 * The header (wordmark, name, role, company, bio, the Send to Phone pill) is the hero card's,
 * unchanged: these are the same person's cards, and the client's point was that every card
 * should be that card.
 */

type CardId = (typeof solution.cards)[number]["id"];
type FieldId = (typeof solution.cards)[number]["fields"][number];

const PERSONAL = heroPhone.sections[0]!.label;
const BUSINESS = heroPhone.sections[1]!.label;

/** A row value is one line on the card (`white-space: nowrap`); longer copy is cut with "…". */
const ROW_MAX = 34;

function clip(value: string): string {
  return value.length <= ROW_MAX ? value : `${value.slice(0, ROW_MAX - 1).trimEnd()}…`;
}

function profileValue(id: string): string {
  const field = mayaProfile.fields.find((f) => f.id === id);
  if (!field) throw new Error(`brand-card-content: no profile field "${id}"`);
  return field.value;
}

/** "1990-06-14" → "14 June 1990", fixed to UTC so the server and every client agree. */
function birthday(): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${profileValue("field_dob")}T00:00:00Z`));
}

/** Every field a card can carry, as the row it draws. `social` is not a row — it is the disc. */
const FIELD_ROWS: Readonly<Record<Exclude<FieldId, "social">, { group: string; row: BrandCardRow }>> = {
  mobile: { group: PERSONAL, row: { icon: "phone", value: MAYA.mobile } },
  "personal-email": { group: PERSONAL, row: { icon: "mail", value: MAYA.personalEmail } },
  home: { group: PERSONAL, row: { icon: "pin", value: `${MAYA.home.city}, ${MAYA.home.country}` } },
  birthday: { group: PERSONAL, row: { icon: "calendar", value: birthday() } },
  "work-email": { group: BUSINESS, row: { icon: "mail", value: MAYA.workEmail } },
  title: { group: BUSINESS, row: { icon: "briefcase", value: MAYA.role } },
  company: { group: BUSINESS, row: { icon: "building", value: MAYA.company } },
  office: { group: BUSINESS, row: { icon: "pin", value: clip(mayaCity("london").address) } },
  experience: { group: BUSINESS, row: { icon: "briefcase", value: clip(profileValue("field_experience")) } },
};

export type BrandCardContent = Pick<
  BrandCardProps,
  "brand" | "name" | "role" | "company" | "bio" | "action" | "sections" | "social"
>;

export interface BrandCardContentOptions {
  /** Replace one field's value and mark it updated — the How-it-works "update arrives" panel. */
  readonly update?: { readonly field: Exclude<FieldId, "social">; readonly value: string };
  /** Extra sections after the field groups — the share panel's link + QR. */
  readonly append?: readonly BrandCardSection[];
  /** Draw only the header and `append` — no field rows. */
  readonly rowsless?: boolean;
}

export function brandCardContent(cardId: CardId, options: BrandCardContentOptions = {}): BrandCardContent {
  const card = solution.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`brand-card-content: no card "${cardId}"`);

  const groups = new Map<string, BrandCardRow[]>([
    [PERSONAL, []],
    [BUSINESS, []],
  ]);
  if (!options.rowsless) {
    for (const field of card.fields) {
      if (field === "social") continue;
      const entry = FIELD_ROWS[field];
      const row =
        options.update?.field === field
          ? { ...entry.row, value: clip(options.update.value), updated: true }
          : entry.row;
      groups.get(entry.group)!.push(row);
    }
  }

  const sections: BrandCardSection[] = [...groups]
    .filter(([, rows]) => rows.length > 0)
    .map(([label, rows]) => ({ label, rows }));
  sections.push(...(options.append ?? []));

  const carriesSocial = !options.rowsless && (card.fields as readonly string[]).includes("social");

  return {
    brand: heroPhone.brand,
    name: heroPhone.name,
    role: heroPhone.role,
    company: heroPhone.company,
    bio: heroPhone.bio,
    action: heroPhone.action,
    sections,
    ...(carriesSocial
      ? { social: { label: heroPhone.socialLabel, platforms: ["linkedin"] as const } }
      : {}),
  };
}
