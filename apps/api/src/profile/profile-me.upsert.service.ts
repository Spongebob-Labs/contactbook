import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { CardType, FieldCategory, FieldType, Prisma } from "@prisma/client";
import { inboundE164ToIdentity, normalizeDialCode } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import type { ProfileDeleteGroupDto } from "./dto/profile-delete-group.dto";
import type { ProfileMeOnboardingDto } from "./dto/profile-me-onboarding.dto";
import type { ProfileMePatchDto } from "./dto/profile-me-upsert.dto";
import { fieldCategoryFromDeletable } from "./profile-me.deletable-group";
import type {
  InflatedFinancialRow,
  InflatedGroupItem,
} from "./profile-me.field-spec";
import {
  inflateBankRow,
  inflateBusinessItem,
  inflateCryptoRow,
  inflateIdentityPhoto,
  inflatePersonal,
  inflateSocialItem,
  inflateWalletRow,
  inflateWorkItem,
} from "./profile-me.inflate";
import type { GroupWithFields } from "./profile-me.flatten";
import { sanitizeProfilePayload } from "./profile-me.payload.util";
import {
  fieldMatchesPersonalNullKey,
  personalNullKeys,
  stripPersonalNulls,
} from "./profile-me.personal-null";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import type { ProfileMeResponse } from "./profile-me.types";
import { ProfilePersistenceService } from "./profile-persistence.service";

/**
 * Field categories whose fields belong on a contact card.
 *
 * FINANCIAL is absent by design: those fields are sensitive by construction,
 * and mapping one onto a card would widen what a share is able to expose.
 */
const CARD_MAPPABLE_CATEGORIES: FieldCategory[] = [
  FieldCategory.IDENTITY,
  FieldCategory.PERSONAL,
  FieldCategory.SOCIAL,
  FieldCategory.WORK,
  FieldCategory.BUSINESS,
];

/**
 * Categories that fall back to the user's PERSONAL cards when their group is so
 * new that no card references it yet — the same routing `completeOnboarding`
 * uses when it builds the first Personal card.
 */
const PERSONAL_CARD_CATEGORIES = new Set<FieldCategory>([
  FieldCategory.IDENTITY,
  FieldCategory.PERSONAL,
  FieldCategory.SOCIAL,
]);

function addTo(
  map: Map<string, Set<string>>,
  key: string,
  value: string,
): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.add(value);
    return;
  }
  map.set(key, new Set([value]));
}

/**
 * Which groups a card carrying nothing at all adopts, decided by its type.
 *
 * A card with no mappings serializes to `FN`/`N` and nothing else, which is
 * never what anyone wanted — and `POST /cards` produces exactly that. Its type
 * is the only statement of intent available, so honour it.
 *
 * Cardinality mirrors `completeOnboarding`: a Personal card there receives every
 * identity/personal/social group, while each work group gets a card of its own.
 * So a Business card adopts one group — `groups` arrives newest-first, and the
 * most recently updated work group is also the one the card editor writes to
 * (`profile.work[0]` in `listCardProfileFields`), which keeps what the user
 * typed and what the card carries the same thing.
 *
 * PAYMENT is legacy and has no matching category; it adopts nothing rather than
 * guessing.
 */
function adoptableGroupIds(
  cardType: CardType,
  groups: { id: string; category: FieldCategory }[],
): string[] {
  if (cardType === CardType.BUSINESS) {
    const chosen =
      groups.find((group) => group.category === FieldCategory.WORK) ??
      groups.find((group) => group.category === FieldCategory.BUSINESS);
    return chosen ? [chosen.id] : [];
  }
  if (cardType === CardType.PERSONAL || cardType === CardType.CUSTOM) {
    return groups
      .filter((group) => PERSONAL_CARD_CATEGORIES.has(group.category))
      .map((group) => group.id);
  }
  return [];
}

@Injectable()
export class ProfileMeUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly persistence: ProfilePersistenceService,
    private readonly serializer: ProfileMeSerializerService,
  ) {}

  async patch(
    userId: string,
    dto: ProfileMePatchDto,
  ): Promise<ProfileMeResponse> {
    const sanitized = sanitizeProfilePayload(dto);
    return this.apply(userId, sanitized);
  }

  async deleteGroup(
    userId: string,
    dto: ProfileDeleteGroupDto,
  ): Promise<ProfileMeResponse> {
    const expectedCategory = fieldCategoryFromDeletable(dto.category);
    const group = await this.persistence.findGroup(
      userId,
      dto.groupId,
      expectedCategory,
    );
    if (group.category !== expectedCategory) {
      throw new BadRequestException(
        "groupId does not match the provided category",
      );
    }
    await this.persistence.deleteGroup(userId, dto.groupId);
    return this.serializer.build(userId);
  }

  async completeOnboarding(
    userId: string,
    dto: ProfileMeOnboardingDto,
  ): Promise<ProfileMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileOnboardingCompletedAt: true },
    });
    if (!user) {
      throw new BadRequestException("User not found");
    }
    if (user.profileOnboardingCompletedAt) {
      throw new ConflictException("Profile already initialized");
    }

    if (!dto?.identity) {
      throw new BadRequestException("identity is required");
    }

    const { identity, ...rest } = dto;
    const payload: ProfileMePatchDto = sanitizeProfilePayload({ ...rest });
    payload.identity = {
      firstName: identity.firstName,
      lastName: identity.lastName,
      primaryEmail: identity.primaryEmail,
      primaryPhone: identity.primaryPhone,
      ...(identity.profilePhoto !== undefined
        ? { profilePhoto: identity.profilePhoto }
        : {}),
    };

    await this.apply(userId, payload);

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileOnboardingCompletedAt: new Date() },
    });

    const groups = await this.prisma.fieldGroup.findMany({
      where: { userId },
      include: { fields: true },
    });

    // 1. Automatically create 1 Personal card
    const personalCard = await this.prisma.contactCard.create({
      data: {
        userId,
        name: "Personal",
        type: CardType.PERSONAL,
      },
    });

    const personalFieldIds = groups
      .filter(
        (g) =>
          g.category === FieldCategory.IDENTITY ||
          g.category === FieldCategory.PERSONAL ||
          g.category === FieldCategory.SOCIAL,
      )
      .flatMap((g) => g.fields.map((f) => f.id));

    if (personalFieldIds.length > 0) {
      await this.prisma.cardFieldMapping.createMany({
        data: personalFieldIds.map((fieldId) => ({
          cardId: personalCard.id,
          fieldId,
        })),
      });
    }

    // 2. Automatically create 1 Work card per work group added
    const workGroups = groups.filter((g) => g.category === FieldCategory.WORK);
    for (const g of workGroups) {
      const card = await this.prisma.contactCard.create({
        data: {
          userId,
          name: g.name,
          type: CardType.BUSINESS,
        },
      });
      if (g.fields.length > 0) {
        await this.prisma.cardFieldMapping.createMany({
          data: g.fields.map((f) => ({
            cardId: card.id,
            fieldId: f.id,
          })),
        });
      }
    }

    // 3. Automatically create 1 Business card per business group added
    const businessGroups = groups.filter(
      (g) => g.category === FieldCategory.BUSINESS,
    );
    for (const g of businessGroups) {
      const card = await this.prisma.contactCard.create({
        data: {
          userId,
          name: g.name,
          type: CardType.BUSINESS,
        },
      });
      if (g.fields.length > 0) {
        await this.prisma.cardFieldMapping.createMany({
          data: g.fields.map((f) => ({
            cardId: card.id,
            fieldId: f.id,
          })),
        });
      }
    }

    return this.serializer.build(userId);
  }

  private async apply(
    userId: string,
    dto: ProfileMePatchDto,
  ): Promise<ProfileMeResponse> {
    const groups = await this.persistence.loadGroups(userId);

    if (dto.identity !== undefined) {
      await this.applyIdentity(
        userId,
        dto.identity as Record<string, unknown>,
        groups,
      );
    }
    if (dto.personal !== undefined) {
      await this.applyPersonal(
        userId,
        dto.personal as unknown as Record<string, unknown>,
        groups,
      );
    }
    if (dto.work !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.WORK,
        dto.work as unknown as Record<string, unknown>[],
        groups,
        inflateWorkItem,
      );
    }
    if (dto.business !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.BUSINESS,
        dto.business as unknown as Record<string, unknown>[],
        groups,
        inflateBusinessItem,
      );
    }
    if (dto.socials !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.SOCIAL,
        dto.socials as unknown as Record<string, unknown>[],
        groups,
        inflateSocialItem,
      );
    }
    if (dto.financial !== undefined) {
      await this.applyFinancial(
        userId,
        dto.financial as Record<string, unknown>,
        groups,
      );
    }

    await this.syncCardMappings(userId);

    return this.serializer.build(userId);
  }

  /**
   * Attaches profile fields to the cards that should carry them.
   *
   * `CardFieldMapping` rows used to be written only by `completeOnboarding`,
   * and a card's vCard is built purely from its mappings
   * (`VCardGeneratorService.getOrCreateAsset`). So a field added after signup —
   * a birthday filled in months later — sat on the profile but on no card, and
   * every share silently dropped it no matter which `fieldTypes` the sharer
   * ticked. Selecting a type can only ever filter what is mapped; it cannot
   * conjure a field the card does not carry.
   *
   * Three rules, all mirroring onboarding's own routing:
   *  1. A card that already draws from a group also gets that group's later
   *     fields.
   *  2. A group no card draws from yet lands on the PERSONAL cards when it is
   *     identity/personal/social.
   *  3. A card holding nothing at all adopts the groups its type is for — see
   *     `adoptableGroupIds`. Without this a `POST /cards` card could never carry
   *     anything, because rule 1 has no mapping to grow from.
   *
   * Idempotent, and runs after every patch, so it also heals profiles left
   * unmapped by earlier deploys rather than only fixing fields from here on.
   *
   * Deliberately silent: `SyncService.notifyCardSubscribers` sends a WhatsApp
   * message to every accepted connection, and `syncGroupFields` has already
   * notified them for the values touched in this same request. Notifying again
   * per backfilled mapping would text real people twice for one edit.
   */
  private async syncCardMappings(userId: string): Promise<void> {
    const [cards, groups] = await Promise.all([
      this.prisma.contactCard.findMany({
        where: { userId },
        select: { id: true, type: true },
      }),
      this.prisma.fieldGroup.findMany({
        where: { userId, category: { in: CARD_MAPPABLE_CATEGORIES } },
        select: { id: true, category: true, fields: { select: { id: true } } },
        // Newest first, so `adoptableGroupIds` can take "the current workplace"
        // off the front.
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    if (cards.length === 0 || groups.length === 0) {
      return;
    }

    const existing = await this.prisma.cardFieldMapping.findMany({
      where: { card: { userId } },
      select: { cardId: true, fieldId: true },
    });

    const groupIdByField = new Map<string, string>();
    for (const group of groups) {
      for (const field of group.fields) {
        groupIdByField.set(field.id, group.id);
      }
    }

    // Which cards already hold a given field, and which cards already draw from
    // a given group — the second is what decides where a new field belongs.
    const cardsByField = new Map<string, Set<string>>();
    const targetsByGroup = new Map<string, Set<string>>();
    const cardsHoldingSomething = new Set<string>();
    for (const { cardId, fieldId } of existing) {
      addTo(cardsByField, fieldId, cardId);
      cardsHoldingSomething.add(cardId);
      const groupId = groupIdByField.get(fieldId);
      if (groupId) {
        addTo(targetsByGroup, groupId, cardId);
      }
    }

    // A group no card draws from yet: identity/personal/social land on the
    // PERSONAL cards, where onboarding would have put them.
    const personalCardIds = cards
      .filter((card) => card.type === CardType.PERSONAL)
      .map((card) => card.id);
    for (const group of groups) {
      if (targetsByGroup.has(group.id)) {
        continue;
      }
      if (PERSONAL_CARD_CATEGORIES.has(group.category)) {
        for (const cardId of personalCardIds) {
          addTo(targetsByGroup, group.id, cardId);
        }
      }
    }

    // A card holding nothing at all adopts the groups its type is for, so a
    // `POST /cards` card stops being a permanent name-only vCard.
    for (const card of cards) {
      if (cardsHoldingSomething.has(card.id)) {
        continue;
      }
      for (const groupId of adoptableGroupIds(card.type, groups)) {
        addTo(targetsByGroup, groupId, card.id);
      }
    }

    const pending: { cardId: string; fieldId: string }[] = [];
    for (const group of groups) {
      const targets = targetsByGroup.get(group.id);
      if (!targets) {
        continue;
      }
      for (const field of group.fields) {
        const already = cardsByField.get(field.id);
        for (const cardId of targets) {
          if (!already?.has(cardId)) {
            pending.push({ cardId, fieldId: field.id });
          }
        }
      }
    }
    if (pending.length === 0) {
      return;
    }

    // skipDuplicates: two patches racing on the same new field would otherwise
    // collide on the (cardId, fieldId) primary key.
    await this.prisma.cardFieldMapping.createMany({
      data: pending,
      skipDuplicates: true,
    });
  }

  private async applyIdentity(
    userId: string,
    identity: Record<string, unknown>,
    groups: GroupWithFields[],
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        countryCode: true,
      },
    });
    if (!current) {
      throw new BadRequestException("User not found");
    }

    const userUpdate: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      countryCode?: string;
    } = {};

    if (identity.firstName !== undefined && identity.firstName !== null) {
      userUpdate.firstName = (identity.firstName as string).trim();
    }
    if (identity.lastName !== undefined && identity.lastName !== null) {
      userUpdate.lastName = (identity.lastName as string).trim();
    }
    if (identity.primaryEmail !== undefined && identity.primaryEmail !== null) {
      const email = (identity.primaryEmail as string).trim().toLowerCase();
      if (email !== current.email.toLowerCase()) {
        const taken = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (taken && taken.id !== userId) {
          throw new ConflictException("This email is already in use");
        }
        userUpdate.email = email;
      }
    }
    if (identity.primaryPhone !== undefined && identity.primaryPhone !== null) {
      const parsed = inboundE164ToIdentity(identity.primaryPhone as string);
      if (!parsed) {
        throw new BadRequestException("Invalid primaryPhone");
      }
      const countryCode = normalizeDialCode(parsed.countryCode);
      const phone = parsed.phone;
      if (
        phone !== current.phone ||
        countryCode !== normalizeDialCode(current.countryCode)
      ) {
        const taken = await this.prisma.user.findUnique({
          where: { countryCode_phone: { countryCode, phone } },
          select: { id: true },
        });
        if (taken && taken.id !== userId) {
          throw new ConflictException("This phone number is already in use");
        }
        userUpdate.countryCode = countryCode;
        userUpdate.phone = phone;
      }
    }

    if (Object.keys(userUpdate).length > 0) {
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: userUpdate,
        });
      } catch (err) {
        throw this.mapUserUniqueConstraintError(err);
      }
    }

    if (identity.profilePhoto === undefined) {
      return;
    }

    const photoSpec = inflateIdentityPhoto(identity);
    if (photoSpec === null) {
      return;
    }

    let identityGroup = groups.find(
      (g) => g.category === FieldCategory.IDENTITY,
    );
    if (!identityGroup) {
      const created = await this.persistence.createGroup(
        userId,
        FieldCategory.IDENTITY,
        "Identity",
      );
      identityGroup = { ...created, fields: [] };
    }

    const existing = identityGroup.fields.filter(
      (f) => f.type === FieldType.PHOTO || f.type === FieldType.URL,
    );
    if (photoSpec.value === null) {
      for (const f of existing) {
        await this.persistence.deleteField(userId, f.id);
      }
      return;
    }

    await this.persistence.syncGroupFields(
      identityGroup.id,
      [photoSpec],
      existing,
      true,
    );
  }

  private async applyPersonal(
    userId: string,
    personal: Record<string, unknown>,
    groups: GroupWithFields[],
  ): Promise<void> {
    const nullKeys = personalNullKeys(personal);
    const forInflate = stripPersonalNulls(personal);
    const inflated = inflatePersonal(forInflate);
    const personalGroups = groups.filter(
      (g) => g.category === FieldCategory.PERSONAL,
    );

    let targetId = inflated.groupId;
    if (targetId) {
      await this.persistence.findGroup(
        userId,
        targetId,
        FieldCategory.PERSONAL,
      );
    } else if (personalGroups.length > 0) {
      const primary = [...personalGroups].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0];
      targetId = primary.id;
    } else if (nullKeys.size === 0 && inflated.fields.length > 0) {
      const created = await this.persistence.createGroup(
        userId,
        FieldCategory.PERSONAL,
        inflated.tag,
      );
      targetId = created.id;
    } else if (nullKeys.size > 0) {
      return;
    } else if (forInflate.tag !== undefined) {
      const created = await this.persistence.createGroup(
        userId,
        FieldCategory.PERSONAL,
        inflated.tag,
      );
      targetId = created.id;
    } else {
      return;
    }

    const targetGroup =
      personalGroups.find((g) => g.id === targetId) ??
      ({ id: targetId, fields: [] } as unknown as GroupWithFields);

    if (nullKeys.size > 0) {
      for (const field of targetGroup.fields) {
        for (const nullKey of nullKeys) {
          if (fieldMatchesPersonalNullKey(field, nullKey)) {
            await this.persistence.deleteField(userId, field.id);
          }
        }
      }
    }

    if (forInflate.tag !== undefined && forInflate.tag !== null) {
      await this.persistence.updateGroupName(targetId, inflated.tag);
    }

    if (inflated.fields.length > 0) {
      const refreshed = await this.persistence.loadGroups(userId);
      const refreshedPersonal = refreshed.filter(
        (g) => g.category === FieldCategory.PERSONAL,
      );
      const refreshedTarget =
        refreshedPersonal.find((g) => g.id === targetId) ?? targetGroup;
      await this.persistence.syncGroupFields(
        targetId,
        inflated.fields,
        refreshedTarget.fields,
        false,
      );
    }

    for (const g of personalGroups) {
      if (g.id !== targetId) {
        await this.persistence.deleteGroup(userId, g.id);
      }
    }
  }

  private async applyGroupArray(
    userId: string,
    category: FieldCategory,
    items: Record<string, unknown>[],
    groups: GroupWithFields[],
    inflate: (item: Record<string, unknown>) => InflatedGroupItem,
  ): Promise<void> {
    const categoryGroups = groups.filter((g) => g.category === category);
    const keptGroupIds = new Set<string>();

    for (const raw of items) {
      const item = inflate(raw);
      let groupId = item.groupId;
      if (groupId) {
        await this.persistence.findGroup(userId, groupId, category);
      } else {
        const created = await this.persistence.createGroup(
          userId,
          category,
          item.tag,
        );
        groupId = created.id;
      }

      keptGroupIds.add(groupId);
      await this.persistence.updateGroupName(groupId, item.tag);

      const existing =
        categoryGroups.find((g) => g.id === groupId)?.fields ?? [];
      await this.persistence.syncGroupFields(
        groupId,
        item.fields,
        existing,
        true,
      );
    }

    for (const g of categoryGroups) {
      if (!keptGroupIds.has(g.id)) {
        await this.persistence.deleteGroup(userId, g.id);
      }
    }
  }

  private async applyFinancial(
    userId: string,
    financial: Record<string, unknown>,
    groups: GroupWithFields[],
  ): Promise<void> {
    const financialGroups = groups.filter(
      (g) => g.category === FieldCategory.FINANCIAL,
    );

    const processRows = async (
      rows: Record<string, unknown>[] | undefined,
      inflate: (row: Record<string, unknown>) => InflatedFinancialRow | null,
      fieldType: FieldType,
    ) => {
      if (rows === undefined) {
        return;
      }
      const keptFieldIds = new Set<string>();

      for (const raw of rows) {
        const row = inflate(raw);
        if (!row) {
          continue;
        }

        let groupId = row.groupId;
        if (groupId) {
          await this.persistence.findGroup(
            userId,
            groupId,
            FieldCategory.FINANCIAL,
          );
        } else if (row.tag) {
          const match = financialGroups.find((g) => g.name === row.tag);
          if (match) {
            groupId = match.id;
          } else {
            const created = await this.persistence.createGroup(
              userId,
              FieldCategory.FINANCIAL,
              row.tag,
            );
            groupId = created.id;
          }
        } else {
          throw new BadRequestException(
            "Financial row requires tag or groupId",
          );
        }

        await this.persistence.updateGroupName(groupId, row.tag);

        if (row.fieldId) {
          await this.persistence.upsertFieldById(
            userId,
            row.fieldId,
            row.field,
          );
          keptFieldIds.add(row.fieldId);
        } else {
          const id = await this.persistence.createField(groupId, row.field);
          keptFieldIds.add(id);
        }
      }

      for (const g of financialGroups) {
        for (const f of g.fields) {
          if (f.type === fieldType && !keptFieldIds.has(f.id)) {
            await this.persistence.deleteField(userId, f.id);
          }
        }
      }
    };

    await processRows(
      financial.bankAccounts as Record<string, unknown>[] | undefined,
      inflateBankRow,
      FieldType.BANK_ACCOUNT,
    );
    await processRows(
      financial.digitalWallets as Record<string, unknown>[] | undefined,
      inflateWalletRow,
      FieldType.DIGITAL_WALLET,
    );
    await processRows(
      financial.cryptoWallets as Record<string, unknown>[] | undefined,
      inflateCryptoRow,
      FieldType.CRYPTO_WALLET,
    );
  }

  private mapUserUniqueConstraintError(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const fields = err.meta?.target;
      const fieldList = Array.isArray(fields)
        ? fields.map(String)
        : typeof fields === "string"
          ? [fields]
          : [];
      if (fieldList.some((f) => f.includes("email"))) {
        return new ConflictException("This email is already in use");
      }
      if (
        fieldList.some((f) => f.includes("phone") || f.includes("countryCode"))
      ) {
        return new ConflictException("This phone number is already in use");
      }
      return new ConflictException("Identity field already in use");
    }
    return err;
  }
}
