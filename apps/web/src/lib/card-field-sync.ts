/**
 * Attaches profile fields to a card from the client.
 *
 * A card owns no values. Its vCard is built from `CardFieldMapping` rows, and
 * until now the frontend could not create one: `POST /cards/:cardId/field-mappings`
 * needs a `fieldId`, and `GET /profile/me` returns ids for financial rows only —
 * the very rows the vCard generator drops. So every card made by `POST /cards`
 * stayed a name-only VCF, and "save your details" attached nothing.
 *
 * `GET /v1/profile/me/fields` closes that gap (confirmed live on production
 * 2026-08-11). This module is the client-side equivalent of the API's
 * `syncCardMappings`: work out which profile groups a card should draw from,
 * then map every shareable field in them.
 *
 * Idempotent — already-mapped fields are skipped, and a duplicate the server
 * rejects is counted as skipped rather than failing the run. Safe to call after
 * every profile save, which is what makes a newly typed landline actually reach
 * the card.
 */
import {
  SHAREABLE_FIELD_TYPES,
  isShareableFieldType,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import {
  addCardFieldMapping,
  listCardFieldMappings,
  type CardFieldMapping,
} from "@/lib/cards-api";
import {
  fetchProfileMe,
  listProfileFields,
  type ProfileFieldRow,
} from "@/lib/profile-api";
import { usesWorkGroup } from "@/lib/card-profile-fields";
import type { ContactCardType, ProfileMeResponse } from "@/lib/types";

export type CardFieldSyncResult = {
  /** Mappings created by this run. */
  added: number;
  /** Fields the card already held, so nothing to do. */
  alreadyMapped: number;
  /** Shareable fields this card's type can draw from at all. */
  candidates: number;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Profile groups a card of this type should draw from.
 *
 * Mirrors the API's adoption rules: a work card takes the workplace group the
 * editor also edits (`work[0]`), and a personal or custom card takes the
 * personal group plus socials.
 *
 * Personal cards additionally take any group the profile response does not
 * classify — that is where an identity group's photo lives, and `GET /profile/me`
 * exposes no id for it. Financial groups are never adopted: their types are
 * dropped from every vCard, so a mapping would be dead weight.
 */
export function adoptableGroupIds(
  profile: ProfileMeResponse,
  cardType: ContactCardType,
  fields: ProfileFieldRow[],
): Set<string> {
  const work = (profile.work ?? []).flatMap((group) => nonEmpty(group.groupId) ?? []);
  const business = (profile.business ?? []).flatMap(
    (group) => nonEmpty(group.groupId) ?? [],
  );

  if (usesWorkGroup(cardType)) {
    // One card per workplace: the editor writes `work[0]`, so the card has to
    // read the same group or saving a value would fill a group nothing shares.
    const primary = work[0] ?? business[0];
    return new Set(primary ? [primary] : []);
  }

  const personal = nonEmpty(profile.personal?.groupId);
  const socials = (profile.socials ?? []).flatMap(
    (group) => nonEmpty(group.groupId) ?? [],
  );
  const financial = [
    ...(profile.financial?.bankAccounts ?? []),
    ...(profile.financial?.digitalWallets ?? []),
    ...(profile.financial?.cryptoWallets ?? []),
  ].flatMap((row) => nonEmpty((row as { groupId?: string }).groupId) ?? []);

  const classified = new Set([...work, ...business, ...financial]);
  const unclassified = fields
    .map((field) => field.groupId)
    .filter((groupId) => groupId.length > 0 && !classified.has(groupId));

  return new Set(
    [personal, ...socials, ...unclassified].flatMap((id) => id ?? []),
  );
}

/** Fields a card of this type should hold: shareable type, adoptable group. */
export function selectCardFields(
  profile: ProfileMeResponse,
  cardType: ContactCardType,
  fields: ProfileFieldRow[],
): ProfileFieldRow[] {
  const groups = adoptableGroupIds(profile, cardType, fields);
  return fields.filter(
    (field) => isShareableFieldType(field.type) && groups.has(field.groupId),
  );
}

/**
 * Maps every profile field this card should hold and is missing.
 *
 * Empty values are mapped too, on purpose: the generator already skips a field
 * with no value, and mapping it now means the day the user fills it in it shows
 * up without another sync. That is the same reason the API adopts whole groups
 * rather than filled fields.
 */
export async function syncCardFieldMappings(
  cardId: string,
  cardType: ContactCardType,
): Promise<CardFieldSyncResult> {
  const [profile, fields, existing] = await Promise.all([
    fetchProfileMe(),
    listProfileFields(),
    listCardFieldMappings(cardId).catch(() => [] as CardFieldMapping[]),
  ]);

  const wanted = selectCardFields(profile, cardType, fields);
  const mapped = new Set(existing.map((row) => row.fieldId));
  const pending = wanted.filter((field) => !mapped.has(field.id));

  let added = 0;
  for (const field of pending) {
    try {
      await addCardFieldMapping(cardId, field.id);
      added += 1;
    } catch {
      // Already mapped by a concurrent run, or the field was deleted between
      // the read and the write. Neither is worth failing the whole sync over.
    }
  }

  return {
    added,
    alreadyMapped: wanted.length - pending.length,
    candidates: wanted.length,
  };
}

/**
 * The field types a card **actually holds**, resolved by joining its mappings to
 * the profile's field list.
 *
 * `GET /cards/:id/field-mappings` returns bare `{cardId, fieldId}` pairs — no
 * type — and `POST /cards/:id/vcard` echoes back whatever filter it was sent, so
 * neither answers this on its own. Without the join a card page can only guess
 * from the profile, and it guesses wrong the moment a card's mappings do not
 * match its type: a work card holding personal fields showed "Company: Kidan —
 * shared" while its VCF carried no ORG line at all.
 */
export async function listCardMappedFieldTypes(
  cardId: string,
): Promise<ShareableFieldType[]> {
  const [mappings, fields] = await Promise.all([
    listCardFieldMappings(cardId),
    listProfileFields(),
  ]);
  const mapped = new Set(mappings.map((row) => row.fieldId));
  const present = new Set(
    fields
      .filter((field) => mapped.has(field.id))
      .map((field) => field.type)
      .filter(isShareableFieldType),
  );
  return SHAREABLE_FIELD_TYPES.filter((type) => present.has(type));
}

/** Field types this card's profile groups can supply, for honest UI copy. */
export function syncableFieldTypes(
  profile: ProfileMeResponse,
  cardType: ContactCardType,
  fields: ProfileFieldRow[],
): string[] {
  const present = new Set(
    selectCardFields(profile, cardType, fields).map((field) => field.type),
  );
  return SHAREABLE_FIELD_TYPES.filter((type) => present.has(type));
}
