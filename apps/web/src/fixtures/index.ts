/**
 * The fixture barrel — **the only data source in the application** (spec §3.1, §6.3).
 *
 * `useFixture(select)` selects out of `FIXTURE_DB`; nothing else reads a fixture module
 * directly except the edge suites, which import `@/fixtures/extremes` on purpose.
 *
 * `src/fixtures/marketing.ts` is deliberately **not** re-exported here — it belongs to the
 * marketing track and re-exporting it would put two tracks in one file (plan §1.2).
 */

import type { Contact, ContactCard, FieldGroup, ProfileField, User } from "@/types/domain";
import { fixtureCards } from "@/fixtures/cards";
import { fixtureContacts } from "@/fixtures/contacts";
import { extremeCards } from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/** The shape `useFixture`'s selector receives. Five collections, nothing derived. */
export interface FixtureDb {
  user: User;
  groups: readonly FieldGroup[];
  fields: readonly ProfileField[];
  cards: readonly ContactCard[];
  contacts: readonly Contact[];
}

/**
 * Freeze the graph, not just its root.
 *
 * `as const` is a compile-time guarantee and disappears at runtime; a screen that took a
 * reference and pushed to it would corrupt every other screen for the rest of the session,
 * and the symptom would look like a rendering bug. The `isFrozen` guard doubles as cycle
 * protection.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** The signed-in fixture user's whole world. */
export const FIXTURE_DB: FixtureDb = deepFreeze({
  user: fixtureUser,
  groups: fixtureGroups,
  fields: fixtureFields,
  cards: fixtureCards,
  contacts: fixtureContacts,
});

/**
 * What `?state=empty` selects from (§6.3).
 *
 * The collections are empty but the **user survives and the seven groups survive with no
 * fields in them**: that is §11 E-08 ("a profile has zero fields in every group"), which is
 * a different screen from "this user does not exist". The shell still has a chip to render.
 */
export const EMPTY_FIXTURE_DB: FixtureDb = deepFreeze({
  user: fixtureUser,
  groups: fixtureGroups.map((group) => ({ ...group, fieldIds: [] })),
  fields: [],
  cards: [],
  contacts: [],
});

/**
 * Every card the fixtures define, ordinary and extreme, for the AC-08 sweep. Nothing
 * renders from this list — it exists so the payload budget is asserted over *all* of them.
 */
export const ALL_FIXTURE_CARDS: readonly ContactCard[] = [...fixtureCards, ...extremeCards];

export { fixtureUser, fixtureUserNoAvatar } from "@/fixtures/user";
export { fixtureGroups, fixtureFields } from "@/fixtures/profile";
export { fixtureCards, cardEmptyDemo, cardLedgerDemo } from "@/fixtures/cards";
export { fixtureContacts } from "@/fixtures/contacts";
