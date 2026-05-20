import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { FieldCategory, FieldType, Prisma } from "@prisma/client";
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

    return this.serializer.build(userId);
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
