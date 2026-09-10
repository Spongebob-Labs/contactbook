import type {
  AuthMeResponseDto,
  CardResponseDto,
  MeResponseDto,
  ProfileFieldGroupResponseDto,
  ProfileFieldResponseDto,
} from "@/lib/api/schema";
import { toApiCardKind } from "@/lib/api/map";
import { FIXTURE_DB } from "@/fixtures";
import type { ContactCard, FieldGroup, ProfileField } from "@/types/domain";

/**
 * **The e2e API stub's data, built from `src/fixtures` and serialised to JSON.**
 *
 * ## Why this file exists, and why it is TypeScript while the server is not
 *
 * Every `(app)` route — `/dashboard`, `/cards/**`, `/contacts/**`, `/profile/**` — is gated by
 * `(app)/layout.tsx`, which fetches the signed-in user **server-side**. The e2e harness had no
 * answer for that: `tests/stubs/public-card-api.mjs` serves one route (`/public/links/n{N}`)
 * and 404s the rest, so `loadUser()` failed, and `proxy.ts` bounced every navigation to
 * `/signin/phone`. The visible symptom was the whole of `card-detail.spec.ts` and
 * `builder.spec.ts` going red — not with assertion failures, but with every test looking at a
 * phone-number form.
 *
 * ⚠ **That is migration fallout, not a flaky harness.** Those suites were written when the app
 * read from the fixture gateway directly and made zero outbound requests (the rule
 * `wallet-pass-block.tsx` still cites as §3.1). When the screens moved onto the real API the
 * server-side reads became un-interceptable — `page.route()` cannot see a fetch made inside the
 * Next process — and the suites silently stopped exercising anything.
 *
 * So the fixtures are served over HTTP instead, in the API's own DTO shapes. The point is that
 * **there is still one source of truth**: `src/fixtures` is what the specs already assert
 * against (`card_minimal_demo`, `card_empty_demo`, `field_mobile`), and what the unit tests and
 * the marketing page render from. A hand-written JSON stub would have been a second copy of
 * that data, free to drift, and the drift would present as product bugs.
 *
 * ## ⚠ Why a snapshot file rather than the server importing this directly
 *
 * The stub server is launched by Playwright's `webServer.command` as a separate process, and
 * this workspace has no TypeScript runner — no `tsx`, no `vite-node`, no `ts-node` (checked:
 * `node_modules/.bin` holds `eslint`, `next`, `playwright`, `qrcode`, `tsc`, `vitest`). A plain
 * `.mjs` server cannot import this module, and it cannot resolve the `@/` alias either.
 *
 * Playwright's own config and `globalSetup` *are* transpiled by Playwright, alias included. So
 * the setup imports this, writes {@link SNAPSHOT_PATH}, and the `.mjs` server reads that file
 * **per request** rather than at boot — which makes the whole thing independent of whether
 * Playwright starts `webServer` before or after `globalSetup`, an ordering that has changed
 * between versions and is not worth depending on.
 *
 * ## What this deliberately is not
 *
 * Not a re-implementation of the API. It answers the **reads** the gated screens make on load.
 * Writes (`POST /cards`, `PUT /cards/:id/fields`, `POST /profile/fields`, …) are handled by the
 * server as accepted-and-echoed so a save does not explode, but nothing is persisted across
 * requests — see the note in `api.mjs`. A spec that asserts a mutation round-trips needs real
 * state, and that is the next piece of work rather than something to fake convincingly here.
 */

/** Where the snapshot lands. Relative to `apps/web`, and gitignored via `tests/.tmp`. */
export const SNAPSHOT_PATH = "tests/.tmp/api-fixtures.json";

/** A fixed instant, so nothing in the snapshot moves between runs. */
const T0 = "2026-01-01T00:00:00.000Z";

/**
 * `ProfileField` → its DTO.
 *
 * ⚠ `isSensitive` is **not** in the DTO and must not be invented here: `map.ts` derives it from
 * the field's type (`isSensitiveType`), and the API has no such column. Emitting one would let
 * the stub disagree with production about which fields mask.
 */
function fieldDto(
  field: ProfileField,
  category: string,
  position: number,
): ProfileFieldResponseDto {
  return {
    id: field.id,
    category: category as ProfileFieldResponseDto["category"],
    type: field.type as ProfileFieldResponseDto["type"],
    label: field.label,
    value: field.value,
    position,
    groupId: field.groupId,
    createdAt: T0,
    updatedAt: T0,
  };
}

function groupDto(group: FieldGroup, position: number, fields: ProfileFieldResponseDto[]) {
  return {
    id: group.id,
    category: group.category as ProfileFieldGroupResponseDto["category"],
    /* The API calls it `tag`; the UI calls it `name`. `toProfile` falls back to the category
       name when it is null, so round-tripping the fixture's name keeps headings stable. */
    tag: group.name,
    position,
    fields,
  } satisfies ProfileFieldGroupResponseDto;
}

function cardDto(card: ContactCard, fields: readonly ProfileField[]): CardResponseDto {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const categoryOf = new Map(
    FIXTURE_DB.groups.map((g) => [g.id, g.category as string] as const),
  );

  return {
    id: card.id,
    name: card.name,
    /* ⚠ Through `toApiCardKind`, not a cast. The domain's `BUSINESS` is the API's `WORK`, and
       a cast would have shipped a kind the API never uses — silently, since both are strings. */
    kind: toApiCardKind(card.type),
    templateId: card.templateId ?? null,
    paletteId: card.paletteId ?? null,
    groundHex: card.groundHex ?? null,
    finish: card.finish ?? null,
    texture: card.texture ?? null,
    texturePresence: card.texturePresence ?? null,
    textureScale: card.textureScale ?? null,
    /* The fixture carries the whole URL; there is no `slug` on `ContactCard`. */
    publicUrl: card.publicUrl ?? undefined,
    fields: card.fieldIds.flatMap((fieldId, index) => {
      const field = byId.get(fieldId);
      if (field === undefined) return [];
      return [
        {
          fieldId,
          category: (categoryOf.get(field.groupId) ??
            "PERSONAL") as CardResponseDto["fields"][number]["category"],
          type: field.type as CardResponseDto["fields"][number]["type"],
          label: field.label,
          value: field.value,
          visible: true,
          position: index,
        },
      ];
    }),
    createdAt: T0,
    updatedAt: T0,
  };
}

/** Everything the stub server needs, as plain JSON. */
export function buildApiSnapshot() {
  const { user, groups, fields, cards, contacts } = FIXTURE_DB;

  /* Fields keep the fixture's own order — `toProfile` sorts by `position`, so the index IS the
     display order the specs were written against. */
  const categoryOf = new Map(groups.map((g) => [g.id, g.category as string] as const));
  const fieldDtos = fields.map((field, i) =>
    fieldDto(field, categoryOf.get(field.groupId) ?? "PERSONAL", i),
  );
  const dtoById = new Map(fieldDtos.map((f) => [f.id, f] as const));

  const groupDtos = groups.map((group, i) =>
    groupDto(
      group,
      i,
      group.fieldIds.flatMap((id) => {
        const dto = dtoById.get(id);
        return dto === undefined ? [] : [dto];
      }),
    ),
  );

  /* ⚠ `User` holds `phone` and `countryCode` separately, and `toUser` derives the country back
     out of a single E.164 string — so the fixture's phone is already the full number and must
     not be concatenated with its own prefix. */
  const authMe: AuthMeResponseDto = { id: user.id, phoneE164: user.phone };

  const byCategory = (category: string) => groupDtos.filter((g) => g.category === category);

  const me: MeResponseDto = {
    /* ⚠ The onboarding gate reads exactly this. `false` sends every `(app)` navigation to
       `/signup/first-name`, which is the second redirect the harness was hitting. */
    onboardingCompleted: true,
    identity: {
      firstName: user.firstName,
      lastName: user.lastName,
      primaryPhone: user.phone,
      primaryEmail: user.email,
      profilePhoto: user.avatarUrl,
    },
    /* Ungrouped PERSONAL fields. The fixture groups everything, so this is normally empty —
       and it must stay an array either way. */
    personal: fieldDtos.filter((f) => f.groupId === null && f.category === "PERSONAL"),
    work: byCategory("WORK"),
    business: byCategory("BUSINESS"),
    socials: byCategory("SOCIAL"),
    financial: byCategory("FINANCIAL"),
  };

  return {
    authMe,
    me,
    fields: fieldDtos,
    groups: groupDtos,
    cards: cards.map((card) => cardDto(card, fields)),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      phoneE164: contact.phoneE164,
      displayName: contact.displayName ?? null,
      notes: contact.notes ?? null,
      source: "MANUAL" as const,
      optedOutAt: null,
      createdAt: T0,
    })),
    /* No links minted in the fixture, so nothing has been shared and nobody is behind. A spec
       that needs recipients has to seed them — see the note in `api.mjs` about state. */
    shareLinks: [] as unknown[],
    /**
     * Inbound WhatsApp capture.
     *
     * ⚠ Seeded so that **one row belongs to a fixture contact and one does not**, because that
     * asymmetry is the whole thing the `/api/inbound/connects` route exists to enforce: the
     * matched sender must reach the browser and the unmatched one must not. A stub where every
     * sender is a known contact would let the leak through and still pass.
     */
    /**
     * ⚠ Every row carries `source`, and the mix is deliberate — see
     * `app/api/inbound/connects/route.ts`. Four cases, each one a thing the route must get
     * right and none of them reachable without a fixture for it:
     *
     *  1. two `WHATSAPP_MESSAGE` rows from a known contact → the *Messaged you* column
     *  2. a `QR_SCAN_CONNECT` from a known contact, `resolvedOwnerId` = **this user** → the
     *     *Scanned your card* column
     *  3. a `QR_SCAN_CONNECT` from that **same** known contact whose `resolvedOwnerId` is
     *     **somebody else** → must be DROPPED. This is the false positive the phone join alone
     *     produced, and it is invisible without a row where the sender is legitimately in the
     *     registry while the scanned card is not this user's.
     *  4. a `WHATSAPP_MESSAGE` from an unknown number → the count, never the number
     */
    inboundMessages: [
      ...(contacts[0] === undefined
        ? []
        : [
            {
              id: "inbound_known_1",
              source: "WHATSAPP_MESSAGE",
              provider: "twilio",
              providerMessageId: "SMstub00000000000000000000000001",
              fromPhoneE164: contacts[0].phoneE164,
              toPhoneE164: "+15551234567",
              body: "Hi, saw your card",
              profileName: contacts[0].displayName ?? null,
              resolvedOwnerId: null,
              receivedAt: "2026-09-05T09:00:00.000Z",
            },
            {
              id: "inbound_known_2",
              source: "WHATSAPP_MESSAGE",
              provider: "twilio",
              providerMessageId: "SMstub00000000000000000000000002",
              fromPhoneE164: contacts[0].phoneE164,
              toPhoneE164: "+15551234567",
              body: "Following up",
              profileName: contacts[0].displayName ?? null,
              resolvedOwnerId: null,
              receivedAt: "2026-09-04T09:00:00.000Z",
            },
            {
              /* Case 2: this user's own card was scanned. `providerMessageId` is null and
                 `body` is null because no Twilio message ever existed. */
              id: "inbound_scan_mine",
              source: "QR_SCAN_CONNECT",
              provider: "twilio",
              providerMessageId: null,
              fromPhoneE164: contacts[0].phoneE164,
              /* For a scan this is the OWNER's number, not our business number. */
              toPhoneE164: user.phone,
              body: null,
              profileName: null,
              resolvedOwnerId: user.id,
              receivedAt: "2026-09-08T18:05:25.487Z",
            },
            {
              /* ⚠ Case 3, and the whole reason this fixture set is worth reading. Same sender
                 as above — genuinely one of this user's contacts — but the card scanned belongs
                 to another owner. The route must drop it: counting it would report a scan of
                 "your card" that never happened. */
              id: "inbound_scan_other_owner",
              source: "QR_SCAN_CONNECT",
              provider: "twilio",
              providerMessageId: null,
              fromPhoneE164: contacts[0].phoneE164,
              toPhoneE164: "+919000000009",
              body: null,
              profileName: null,
              resolvedOwnerId: "another-owner-user-id",
              receivedAt: "2026-09-07T12:00:00.000Z",
            },
          ]),
      {
        /* ⚠ Case 5, and the one that reproduces the bug this panel exists for: a scan of THIS
           user's card by a number that is NOT in the registry. `resolvedOwnerId` proves it is
           this caller's, so it must appear — with its number — under "scanned your card".
           The first cut required a contact match for scans and dropped this row silently,
           which is how a real scan ended up visible nowhere. */
        id: "inbound_scan_unlinked",
        source: "QR_SCAN_CONNECT",
        provider: "twilio",
        providerMessageId: null,
        fromPhoneE164: "+919000000002",
        toPhoneE164: user.phone,
        body: null,
        profileName: "Kabir",
        resolvedOwnerId: user.id,
        receivedAt: "2026-09-09T08:15:00.000Z",
      },
      {
        /* Case 4: not in the fixture registry — stands for another user's contact. The route
           must reduce this to a count and never emit the number. */
        id: "inbound_stranger",
        source: "WHATSAPP_MESSAGE",
        provider: "twilio",
        providerMessageId: "SMstub00000000000000000000000003",
        fromPhoneE164: "+919000000001",
        toPhoneE164: "+15551234567",
        body: "wrong number",
        profileName: "Someone Else",
        resolvedOwnerId: null,
        receivedAt: "2026-09-03T09:00:00.000Z",
      },
    ],
  };
}
