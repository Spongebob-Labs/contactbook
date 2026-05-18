import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { FieldCategory, FieldType } from "@prisma/client";
import {
  e164FromStoredUser,
  inboundE164ToIdentity,
  normalizeDialCode,
} from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import type { ProfileMeOnboardingDto } from "./dto/profile-me-onboarding.dto";
import type {
  ProfileMeIdentityUpsertDto,
  ProfileMePatchDto,
} from "./dto/profile-me-upsert.dto";
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
    return this.apply(userId, dto);
  }

  async put(
    userId: string,
    dto: ProfileMePatchDto,
  ): Promise<ProfileMeResponse> {
    return this.apply(userId, dto);
  }

  async completeOnboarding(
    userId: string,
    dto: ProfileMeOnboardingDto,
  ): Promise<ProfileMeResponse> {
    const count = await this.prisma.fieldGroup.count({ where: { userId } });
    if (count > 0) {
      throw new ConflictException("Profile already initialized");
    }

    this.assertHasOnboardingSection(dto);
    await this.assertIdentityMatchesUser(userId, dto.identity);

    const { identity, ...rest } = dto;
    const payload: ProfileMePatchDto = { ...rest };
    if (identity?.profilePhoto !== undefined) {
      payload.identity = { profilePhoto: identity.profilePhoto };
    }

    return this.put(userId, payload);
  }

  private assertHasOnboardingSection(dto: ProfileMeOnboardingDto): void {
    const hasPersonal = dto.personal !== undefined && dto.personal !== null;
    const hasWork = Array.isArray(dto.work) && dto.work.length > 0;
    const hasBusiness = Array.isArray(dto.business) && dto.business.length > 0;
    const hasSocials = Array.isArray(dto.socials) && dto.socials.length > 0;
    const hasFinancial =
      dto.financial !== undefined &&
      dto.financial !== null &&
      ((dto.financial.bankAccounts?.length ?? 0) > 0 ||
        (dto.financial.digitalWallets?.length ?? 0) > 0 ||
        (dto.financial.cryptoWallets?.length ?? 0) > 0);

    if (
      !hasPersonal &&
      !hasWork &&
      !hasBusiness &&
      !hasSocials &&
      !hasFinancial
    ) {
      throw new BadRequestException(
        "Provide at least one profile section: personal, work, business, socials, or financial",
      );
    }
  }

  private async assertIdentityMatchesUser(
    userId: string,
    identity?: ProfileMeIdentityUpsertDto,
  ): Promise<void> {
    if (!identity) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        countryCode: true,
      },
    });
    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (
      identity.firstName !== undefined &&
      identity.firstName.trim() !== user.firstName
    ) {
      throw new BadRequestException(
        "identity.firstName does not match registration",
      );
    }
    if (
      identity.lastName !== undefined &&
      identity.lastName.trim() !== user.lastName
    ) {
      throw new BadRequestException(
        "identity.lastName does not match registration",
      );
    }
    if (
      identity.primaryEmail !== undefined &&
      identity.primaryEmail.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new BadRequestException(
        "identity.primaryEmail does not match registration",
      );
    }
    if (identity.primaryPhone !== undefined) {
      const submitted = inboundE164ToIdentity(identity.primaryPhone);
      if (!submitted) {
        throw new BadRequestException("Invalid identity.primaryPhone");
      }
      let expected: string;
      try {
        expected = e164FromStoredUser(user);
      } catch {
        throw new BadRequestException(
          "identity.primaryPhone does not match registration",
        );
      }
      const submittedE164 = e164FromStoredUser({
        countryCode: submitted.countryCode,
        phone: submitted.phone,
      });
      if (submittedE164 !== expected) {
        throw new BadRequestException(
          "identity.primaryPhone does not match registration",
        );
      }
    }
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
      await this.applyPersonal(userId, dto.personal, groups);
    }
    if (dto.work !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.WORK,
        dto.work,
        groups,
        inflateWorkItem,
      );
    }
    if (dto.business !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.BUSINESS,
        dto.business,
        groups,
        inflateBusinessItem,
      );
    }
    if (dto.socials !== undefined) {
      await this.applyGroupArray(
        userId,
        FieldCategory.SOCIAL,
        dto.socials,
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
    const userUpdate: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      countryCode?: string;
    } = {};

    if (identity.firstName !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      userUpdate.firstName = String(identity.firstName).trim();
    }
    if (identity.lastName !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      userUpdate.lastName = String(identity.lastName).trim();
    }
    if (identity.primaryEmail !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      userUpdate.email = String(identity.primaryEmail).trim();
    }
    if (identity.primaryPhone !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const parsed = inboundE164ToIdentity(String(identity.primaryPhone));
      if (!parsed) {
        throw new BadRequestException("Invalid primaryPhone");
      }
      userUpdate.countryCode = normalizeDialCode(parsed.countryCode);
      userUpdate.phone = parsed.phone;
    }

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
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
    const inflated = inflatePersonal(personal);
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
    } else {
      const created = await this.persistence.createGroup(
        userId,
        FieldCategory.PERSONAL,
        inflated.tag,
      );
      targetId = created.id;
    }

    await this.persistence.updateGroupName(targetId, inflated.tag);

    const targetGroup = personalGroups.find((g) => g.id === targetId);
    await this.persistence.syncGroupFields(
      targetId,
      inflated.fields,
      targetGroup?.fields ?? [],
      true,
    );

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
}
