import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  FieldCategory,
  FieldGroupCategory,
  FieldType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { prepareFieldValueForWrite } from './profile-field-value.util';
import { ProfileService } from './profile.service';
import type { CompleteOnboardingDto } from './dto/onboarding/complete-onboarding.dto';
import type {
  OnboardingBankAccountDto,
  OnboardingCryptoWalletDto,
  OnboardingDigitalWalletDto,
} from './dto/onboarding/onboarding-financial.dto';
import type { OnboardingBusinessEntryDto } from './dto/onboarding/onboarding-business-entry.dto';
import type { OnboardingPersonalDto } from './dto/onboarding/onboarding-personal.dto';
import type { OnboardingSocialEntryDto } from './dto/onboarding/onboarding-social-entry.dto';
import type { OnboardingWorkEntryDto } from './dto/onboarding/onboarding-work-entry.dto';
import type { PostalAddressDto } from './dto/postal-address.dto';
import type { MeResponseDto } from './dto/me-response.dto';
import type { OnboardingResponseDto } from './dto/onboarding/onboarding-response.dto';

interface FieldSpec {
  type: FieldType;
  label: string;
  value: string;
}

const MAX_CUSTOM_KEYS = 20;
const MAX_CUSTOM_KEY_LENGTH = 60;
const MAX_CUSTOM_VALUE_LENGTH = 2000;

function formatPostalAddress(addr: PostalAddressDto): string | null {
  const parts = [
    addr.street,
    addr.city,
    addr.state,
    addr.pincode,
    addr.country,
  ].filter((p): p is string => Boolean(p));
  // Collapsed into ADDRESS's existing single-string value, not five separate
  // fields — FieldType.ADDRESS already means "one shareable address"
  // everywhere else in the system. Splitting it into parts is a bigger,
  // separate change with no proven need yet.
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Fans a nested onboarding payload out into User columns + ProfileFieldGroups
 * + ProfileFields, and the reverse: reading that same shape back out for
 * GET /profile/me. Deliberately its own service rather than folded into
 * ProfileService — the fan-out/fan-in transform is a distinct concern from
 * plain CRUD, and keeping them apart keeps each file a manageable size.
 */
@Injectable()
export class ProfileOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly profile: ProfileService,
    private readonly logger: AppLogger,
  ) {}

  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const [personal, photoField, work, business, socials, financial] =
      await Promise.all([
        this.profile.list(userId, { category: FieldCategory.PERSONAL }),
        this.prisma.profileField.findFirst({
          where: { userId, type: FieldType.PHOTO, archivedAt: null },
        }),
        this.profile.listGroups(userId, { category: FieldGroupCategory.WORK }),
        this.profile.listGroups(userId, {
          category: FieldGroupCategory.BUSINESS,
        }),
        this.profile.listGroups(userId, {
          category: FieldGroupCategory.SOCIAL,
        }),
        this.profile.listGroups(userId, {
          category: FieldGroupCategory.FINANCIAL,
        }),
      ]);

    return {
      onboardingCompleted: user.profileOnboardingCompletedAt !== null,
      identity: {
        firstName: user.firstName,
        lastName: user.lastName,
        primaryPhone: user.phoneE164,
        primaryEmail: user.email,
        profilePhoto: photoField?.value ?? null,
      },
      personal,
      work,
      business,
      socials,
      financial,
    };
  }

  /** One-shot. 409 if already completed — every edit after this point goes
   *  through the granular field/group endpoints instead. Everything except
   *  `identity` is optional: a user can finish onboarding with just their
   *  name and email and add jobs/wallets/socials later. */
  async complete(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<OnboardingResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.profileOnboardingCompletedAt) {
      throw ApiError.conflict(
        'ONBOARDING_ALREADY_COMPLETED',
        'Onboarding has already been completed. Use the profile field and group endpoints for further changes.',
      );
    }

    this.validateCustomBags(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: dto.identity.firstName,
          lastName: dto.identity.lastName,
          email: dto.identity.primaryEmail,
          profileOnboardingCompletedAt: new Date(),
        },
      });

      if (dto.personal) {
        await this.createLooseFields(
          tx,
          userId,
          FieldCategory.PERSONAL,
          this.personalToSpecs(dto.personal),
        );
      }

      for (const entry of dto.work ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.WORK,
          FieldCategory.WORK,
          entry.tag,
          this.workEntryToSpecs(entry),
        );
      }
      for (const entry of dto.business ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.BUSINESS,
          FieldCategory.BUSINESS,
          entry.tag,
          this.businessEntryToSpecs(entry),
        );
      }
      for (const entry of dto.socials ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.SOCIAL,
          FieldCategory.SOCIAL,
          entry.tag,
          this.socialEntryToSpecs(entry),
        );
      }
      for (const entry of dto.financial?.bankAccounts ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.FINANCIAL,
          FieldCategory.FINANCIAL,
          entry.tag,
          this.bankAccountToSpecs(entry),
        );
      }
      for (const entry of dto.financial?.digitalWallets ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.FINANCIAL,
          FieldCategory.FINANCIAL,
          entry.tag,
          this.digitalWalletToSpecs(entry),
        );
      }
      for (const entry of dto.financial?.cryptoWallets ?? []) {
        await this.createGroup(
          tx,
          userId,
          FieldGroupCategory.FINANCIAL,
          FieldCategory.FINANCIAL,
          entry.tag,
          this.cryptoWalletToSpecs(entry),
        );
      }
    });

    this.logger.info('profile.onboarding_completed', {
      userId,
      workEntries: dto.work?.length ?? 0,
      businessEntries: dto.business?.length ?? 0,
      socialEntries: dto.socials?.length ?? 0,
      bankAccounts: dto.financial?.bankAccounts?.length ?? 0,
      digitalWallets: dto.financial?.digitalWallets?.length ?? 0,
      cryptoWallets: dto.financial?.cryptoWallets?.length ?? 0,
    });

    const me = await this.getMe(userId);
    return { ...me, onboardingCompleted: true };
  }

  // ------------------------------------------------------- transaction helpers

  private async createLooseFields(
    tx: Prisma.TransactionClient,
    userId: string,
    category: FieldCategory,
    specs: FieldSpec[],
  ): Promise<void> {
    let position = await this.nextFieldPosition(tx, userId);
    for (const spec of specs) {
      await this.createField(tx, userId, category, null, spec, position++);
    }
  }

  /** Creates the group only if there is something to put in it — a
   *  completely empty entry (no tag, no fields) is a no-op rather than an
   *  empty row with zero information in it. A tag alone IS enough to create
   *  the group, as a placeholder the user fills in later. */
  private async createGroup(
    tx: Prisma.TransactionClient,
    userId: string,
    groupCategory: FieldGroupCategory,
    fieldCategory: FieldCategory,
    tag: string | undefined,
    specs: FieldSpec[],
  ): Promise<void> {
    if (specs.length === 0 && !tag) return;

    const groupPosition = await this.nextGroupPosition(
      tx,
      userId,
      groupCategory,
    );
    const group = await tx.profileFieldGroup.create({
      data: { userId, category: groupCategory, tag, position: groupPosition },
    });

    let position = 0;
    for (const spec of specs) {
      await this.createField(
        tx,
        userId,
        fieldCategory,
        group.id,
        spec,
        position++,
      );
    }
  }

  private async createField(
    tx: Prisma.TransactionClient,
    userId: string,
    category: FieldCategory,
    groupId: string | null,
    spec: FieldSpec,
    position: number,
  ): Promise<void> {
    const fieldId = randomUUID();
    const { value, isEncrypted } = prepareFieldValueForWrite(
      this.config.fieldEncryptionKey,
      { userId, fieldId, type: spec.type },
      spec.value,
    );
    await tx.profileField.create({
      data: {
        id: fieldId,
        userId,
        category,
        type: spec.type,
        label: spec.label,
        value,
        isEncrypted,
        position,
        groupId,
      },
    });
  }

  private async nextFieldPosition(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<number> {
    const last = await tx.profileField.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async nextGroupPosition(
    tx: Prisma.TransactionClient,
    userId: string,
    category: FieldGroupCategory,
  ): Promise<number> {
    const last = await tx.profileFieldGroup.findFirst({
      where: { userId, category, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  // ------------------------------------------------------ entry -> field specs

  private personalToSpecs(personal: OnboardingPersonalDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (personal.postalAddress) {
      const formatted = formatPostalAddress(personal.postalAddress);
      if (formatted)
        specs.push({
          type: FieldType.ADDRESS,
          label: 'Address',
          value: formatted,
        });
    }
    specs.push(...this.customToSpecs(personal.custom));
    return specs;
  }

  private workEntryToSpecs(entry: OnboardingWorkEntryDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (entry.companyName) {
      specs.push({
        type: FieldType.COMPANY,
        label: 'Company',
        value: entry.companyName,
      });
    }
    if (entry.workTitle) {
      specs.push({
        type: FieldType.JOB_TITLE,
        label: 'Job title',
        value: entry.workTitle,
      });
    }
    if (entry.workPostalAddress) {
      const formatted = formatPostalAddress(entry.workPostalAddress);
      if (formatted)
        specs.push({
          type: FieldType.ADDRESS,
          label: 'Work address',
          value: formatted,
        });
    }
    specs.push(...this.customToSpecs(entry.custom));
    return specs;
  }

  private businessEntryToSpecs(entry: OnboardingBusinessEntryDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (entry.businessName) {
      specs.push({
        type: FieldType.COMPANY,
        label: 'Business name',
        value: entry.businessName,
      });
    }
    if (entry.businessTitle) {
      specs.push({
        type: FieldType.JOB_TITLE,
        label: 'Title',
        value: entry.businessTitle,
      });
    }
    if (entry.businessPostalAddress) {
      const formatted = formatPostalAddress(entry.businessPostalAddress);
      if (formatted)
        specs.push({
          type: FieldType.ADDRESS,
          label: 'Business address',
          value: formatted,
        });
    }
    specs.push(...this.customToSpecs(entry.custom));
    return specs;
  }

  private socialEntryToSpecs(entry: OnboardingSocialEntryDto): FieldSpec[] {
    // Socials carry no fixed fields beyond tag — entirely custom-driven, so a
    // new platform never needs a schema change.
    return this.customToSpecs(entry.custom);
  }

  private bankAccountToSpecs(entry: OnboardingBankAccountDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (entry.bankName)
      specs.push({
        type: FieldType.TEXT,
        label: 'Bank name',
        value: entry.bankName,
      });
    if (entry.accountHolder) {
      specs.push({
        type: FieldType.TEXT,
        label: 'Account holder',
        value: entry.accountHolder,
      });
    }
    if (entry.ifsc)
      specs.push({ type: FieldType.TEXT, label: 'IFSC', value: entry.ifsc });
    if (entry.currency)
      specs.push({
        type: FieldType.TEXT,
        label: 'Currency',
        value: entry.currency,
      });
    // Encrypted automatically — BANK_ACCOUNT is a financial type.
    if (entry.accountNumber) {
      specs.push({
        type: FieldType.BANK_ACCOUNT,
        label: 'Account number',
        value: entry.accountNumber,
      });
    }
    return specs;
  }

  private digitalWalletToSpecs(entry: OnboardingDigitalWalletDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (entry.platform)
      specs.push({
        type: FieldType.TEXT,
        label: 'Platform',
        value: entry.platform,
      });
    if (entry.handleOrLink) {
      specs.push({
        type: FieldType.DIGITAL_WALLET,
        label: 'Handle or link',
        value: entry.handleOrLink,
      });
    }
    return specs;
  }

  private cryptoWalletToSpecs(entry: OnboardingCryptoWalletDto): FieldSpec[] {
    const specs: FieldSpec[] = [];
    if (entry.network)
      specs.push({
        type: FieldType.TEXT,
        label: 'Network',
        value: entry.network,
      });
    if (entry.address) {
      specs.push({
        type: FieldType.CRYPTO_WALLET,
        label: 'Wallet address',
        value: entry.address,
      });
    }
    return specs;
  }

  private customToSpecs(
    custom: Record<string, unknown> | undefined,
  ): FieldSpec[] {
    if (!custom) return [];
    // Validated (string values, length caps, key count cap) up front in
    // validateCustomBags — by the time this runs, `custom` is already known
    // safe to coerce.
    return Object.entries(custom).map(([key, value]) => ({
      type: FieldType.CUSTOM,
      label: key,
      value: String(value),
    }));
  }

  // ------------------------------------------------------------- validation

  /** class-validator has no clean "map of strings, bounded size" decorator,
   *  so the custom-field bags scattered across the payload are validated
   *  here as one pass over the whole DTO, rather than each DTO trying to
   *  express it imperfectly on its own. Throws on the FIRST violation found,
   *  naming exactly which bag and key caused it. */
  private validateCustomBags(dto: CompleteOnboardingDto): void {
    const bags: Array<{ path: string; custom?: Record<string, unknown> }> = [
      { path: 'personal.custom', custom: dto.personal?.custom },
      ...(dto.work ?? []).map((w, i) => ({
        path: `work[${i}].custom`,
        custom: w.custom,
      })),
      ...(dto.business ?? []).map((b, i) => ({
        path: `business[${i}].custom`,
        custom: b.custom,
      })),
      ...(dto.socials ?? []).map((s, i) => ({
        path: `socials[${i}].custom`,
        custom: s.custom,
      })),
    ];

    for (const { path, custom } of bags) {
      if (!custom) continue;
      const keys = Object.keys(custom);
      if (keys.length > MAX_CUSTOM_KEYS) {
        throw new ApiError(
          'CUSTOM_FIELDS_TOO_MANY',
          `${path} has ${keys.length} keys; at most ${MAX_CUSTOM_KEYS} are allowed.`,
        );
      }
      for (const key of keys) {
        if (key.length > MAX_CUSTOM_KEY_LENGTH) {
          throw new ApiError(
            'CUSTOM_FIELD_KEY_TOO_LONG',
            `${path}.${key}: key exceeds ${MAX_CUSTOM_KEY_LENGTH} characters.`,
          );
        }
        const value = custom[key];
        if (typeof value !== 'string') {
          throw new ApiError(
            'CUSTOM_FIELD_VALUE_INVALID',
            `${path}.${key}: value must be a string.`,
          );
        }
        if (value.length > MAX_CUSTOM_VALUE_LENGTH) {
          throw new ApiError(
            'CUSTOM_FIELD_VALUE_TOO_LONG',
            `${path}.${key}: value exceeds ${MAX_CUSTOM_VALUE_LENGTH} characters.`,
          );
        }
      }
    }
  }
}
