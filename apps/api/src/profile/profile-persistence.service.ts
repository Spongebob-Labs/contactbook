import { Injectable, NotFoundException } from "@nestjs/common";
import {
  FieldCategory,
  FieldType,
  type FieldGroup,
  type Prisma,
} from "@prisma/client";
import { encryptFieldValue } from "../crypto/field-encryption.util";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "../sync/sync.service";
import type { FieldSpec } from "./profile-me.field-spec";
import type {
  FieldWithExtensions,
  GroupWithFields,
} from "./profile-me.flatten";

const FINANCIAL_TYPES: FieldType[] = [
  FieldType.BANK_ACCOUNT,
  FieldType.DIGITAL_WALLET,
  FieldType.CRYPTO_WALLET,
];

const SINGLETON_TYPES = new Set<FieldType>([
  FieldType.PHONE,
  FieldType.LANDLINE,
  FieldType.FAX,
  FieldType.EMAIL,
  FieldType.ADDRESS,
  FieldType.JOB_TITLE,
  FieldType.COMPANY,
  FieldType.REG_NUMBER,
  FieldType.PHOTO,
  FieldType.DATE,
  FieldType.RELATION,
  FieldType.STATUS,
  FieldType.LOCATION_TRACKING,
  FieldType.URL,
]);

type Tx = Prisma.TransactionClient;

function encryptIfFinancial(
  type: FieldType,
  value: string | null,
): string | null {
  if (value == null || value === "") {
    return value;
  }
  if (!FINANCIAL_TYPES.includes(type)) {
    return value;
  }
  return encryptFieldValue(value);
}

function encryptFinancialString(value: string): string {
  return encryptFieldValue(value);
}

@Injectable()
export class ProfilePersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async loadGroups(userId: string): Promise<GroupWithFields[]> {
    return this.prisma.fieldGroup.findMany({
      where: { userId },
      include: {
        fields: {
          include: {
            address: true,
            bankAccount: true,
            digitalWallet: true,
            cryptoWallet: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findGroup(
    userId: string,
    groupId: string,
    category?: FieldCategory,
  ): Promise<FieldGroup> {
    const g = await this.prisma.fieldGroup.findFirst({
      where: {
        id: groupId,
        userId,
        ...(category ? { category } : {}),
      },
    });
    if (!g) {
      throw new NotFoundException("Field group not found");
    }
    return g;
  }

  async createGroup(
    userId: string,
    category: FieldCategory,
    name: string,
    tx?: Tx,
  ): Promise<FieldGroup> {
    const client = tx ?? this.prisma;
    return client.fieldGroup.create({
      data: { userId, category, name },
    });
  }

  async updateGroupName(groupId: string, name: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    await client.fieldGroup.update({
      where: { id: groupId },
      data: { name },
    });
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    await this.findGroup(userId, groupId);
    const fields = await this.prisma.profileField.findMany({
      where: { groupId },
      select: { id: true },
    });
    await this.prisma.fieldGroup.delete({ where: { id: groupId } });
    for (const f of fields) {
      await this.sync.notifyFieldSubscribers(f.id);
    }
  }

  async deleteField(userId: string, fieldId: string): Promise<void> {
    const field = await this.prisma.profileField.findFirst({
      where: { id: fieldId, group: { userId } },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    await this.prisma.profileField.delete({ where: { id: fieldId } });
    await this.sync.notifyFieldSubscribers(fieldId);
  }

  /**
   * Sync fields on a group: upsert specs, delete untouched existing fields when reconcile.
   */
  async syncGroupFields(
    groupId: string,
    specs: FieldSpec[],
    existing: FieldWithExtensions[],
    reconcile: boolean,
  ): Promise<string[]> {
    const touched = new Set<string>();
    const notified: string[] = [];

    for (const spec of specs) {
      const id = await this.upsertFieldInGroup(groupId, spec, existing);
      touched.add(id);
      notified.push(id);
    }

    if (reconcile) {
      for (const f of existing) {
        if (!touched.has(f.id)) {
          await this.prisma.profileField.delete({ where: { id: f.id } });
          await this.sync.notifyFieldSubscribers(f.id);
        }
      }
    }

    return notified;
  }

  async upsertFieldById(
    userId: string,
    fieldId: string,
    spec: FieldSpec,
  ): Promise<string> {
    const field = await this.prisma.profileField.findFirst({
      where: { id: fieldId, group: { userId } },
      include: {
        address: true,
        bankAccount: true,
        digitalWallet: true,
        cryptoWallet: true,
      },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    if (field.type !== spec.type) {
      throw new NotFoundException("Field type mismatch");
    }
    await this.applyFieldUpdate(fieldId, spec, field.type);
    await this.sync.notifyFieldSubscribers(fieldId);
    return fieldId;
  }

  async createField(groupId: string, spec: FieldSpec): Promise<string> {
    const id = await this.createFieldRecord(groupId, spec);
    await this.sync.notifyFieldSubscribers(id);
    return id;
  }

  private findMatchingField(
    existing: FieldWithExtensions[],
    spec: FieldSpec,
  ): FieldWithExtensions | undefined {
    if (spec.type === FieldType.CUSTOM || spec.type === FieldType.TEXT) {
      const label = spec.label?.trim();
      return existing.find(
        (f) =>
          f.type === spec.type && (f.label?.trim() || "") === (label || ""),
      );
    }
    if (spec.type === FieldType.SOCIAL_LINK) {
      const label = spec.label?.trim();
      return existing.find(
        (f) =>
          (f.type === FieldType.SOCIAL_LINK || f.type === FieldType.URL) &&
          (f.label?.trim() || "") === (label || ""),
      );
    }
    if (SINGLETON_TYPES.has(spec.type)) {
      if (spec.type === FieldType.URL && spec.label) {
        return existing.find(
          (f) =>
            f.type === FieldType.URL &&
            (f.label?.trim() || "") === spec.label!.trim(),
        );
      }
      return existing.find((f) => f.type === spec.type);
    }
    return undefined;
  }

  private async upsertFieldInGroup(
    groupId: string,
    spec: FieldSpec,
    existing: FieldWithExtensions[],
  ): Promise<string> {
    const match = this.findMatchingField(existing, spec);
    if (match) {
      await this.applyFieldUpdate(match.id, spec, match.type);
      return match.id;
    }
    return this.createFieldRecord(groupId, spec);
  }

  private async createFieldRecord(
    groupId: string,
    spec: FieldSpec,
  ): Promise<string> {
    const isSensitive = FINANCIAL_TYPES.includes(spec.type)
      ? true
      : (spec.isSensitive ?? false);

    if (spec.type === FieldType.ADDRESS && spec.address) {
      const a = spec.address;
      return this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: spec.type,
            label: spec.label ?? null,
            isSensitive,
            value: spec.value ?? null,
          },
        });
        await tx.addressDetail.create({
          data: {
            fieldId: f.id,
            street: a.street,
            city: a.city,
            state: a.state ?? null,
            pincode: a.pincode ?? null,
            country: a.country,
          },
        });
        return f.id;
      });
    }

    if (spec.type === FieldType.BANK_ACCOUNT && spec.bankAccount) {
      const b = spec.bankAccount;
      return this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: spec.type,
            label: spec.label ?? null,
            isSensitive: true,
            value: encryptIfFinancial(spec.type, spec.value ?? null),
          },
        });
        await tx.bankAccountDetail.create({
          data: {
            fieldId: f.id,
            bankName: b.bankName,
            accountHolder: b.accountHolder,
            accountNumber: encryptFinancialString(b.accountNumber),
            iban: b.iban ?? null,
            swiftBic: b.swiftBic ?? null,
            routingNumber: b.routingNumber ?? null,
            ifsc: b.ifsc ?? null,
            currency: b.currency ?? "USD",
          },
        });
        return f.id;
      });
    }

    if (spec.type === FieldType.DIGITAL_WALLET && spec.digitalWallet) {
      const d = spec.digitalWallet;
      return this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: spec.type,
            label: spec.label ?? null,
            isSensitive: true,
            value: encryptIfFinancial(spec.type, spec.value ?? null),
          },
        });
        await tx.digitalWalletDetail.create({
          data: {
            fieldId: f.id,
            platform: d.platform,
            handleOrLink: encryptFinancialString(d.handleOrLink),
          },
        });
        return f.id;
      });
    }

    if (spec.type === FieldType.CRYPTO_WALLET && spec.cryptoWallet) {
      const c = spec.cryptoWallet;
      return this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: spec.type,
            label: spec.label ?? null,
            isSensitive: true,
            value: encryptIfFinancial(spec.type, spec.value ?? null),
          },
        });
        await tx.cryptoWalletDetail.create({
          data: {
            fieldId: f.id,
            network: c.network,
            address: encryptFinancialString(c.address),
          },
        });
        return f.id;
      });
    }

    const f = await this.prisma.profileField.create({
      data: {
        groupId,
        type: spec.type,
        label: spec.label ?? null,
        isSensitive,
        value: encryptIfFinancial(spec.type, spec.value ?? null),
      },
    });
    return f.id;
  }

  private async applyFieldUpdate(
    fieldId: string,
    spec: FieldSpec,
    existingType: FieldType,
  ): Promise<void> {
    const isSensitive = FINANCIAL_TYPES.includes(existingType)
      ? true
      : (spec.isSensitive ?? undefined);

    await this.prisma.$transaction(async (tx) => {
      await tx.profileField.update({
        where: { id: fieldId },
        data: {
          ...(spec.label !== undefined ? { label: spec.label } : {}),
          ...(isSensitive !== undefined ? { isSensitive } : {}),
          ...(spec.value !== undefined
            ? { value: encryptIfFinancial(existingType, spec.value) }
            : {}),
        },
      });

      if (spec.address && existingType === FieldType.ADDRESS) {
        const a = spec.address;
        await tx.addressDetail.upsert({
          where: { fieldId },
          create: {
            fieldId,
            street: a.street,
            city: a.city,
            state: a.state ?? null,
            pincode: a.pincode ?? null,
            country: a.country,
          },
          update: {
            street: a.street,
            city: a.city,
            state: a.state ?? null,
            pincode: a.pincode ?? null,
            country: a.country,
          },
        });
      }

      if (spec.bankAccount && existingType === FieldType.BANK_ACCOUNT) {
        const b = spec.bankAccount;
        await tx.bankAccountDetail.upsert({
          where: { fieldId },
          create: {
            fieldId,
            bankName: b.bankName,
            accountHolder: b.accountHolder,
            accountNumber: encryptFinancialString(b.accountNumber),
            iban: b.iban ?? null,
            swiftBic: b.swiftBic ?? null,
            routingNumber: b.routingNumber ?? null,
            ifsc: b.ifsc ?? null,
            currency: b.currency ?? "USD",
          },
          update: {
            bankName: b.bankName,
            accountHolder: b.accountHolder,
            accountNumber: encryptFinancialString(b.accountNumber),
            iban: b.iban ?? null,
            swiftBic: b.swiftBic ?? null,
            routingNumber: b.routingNumber ?? null,
            ifsc: b.ifsc ?? null,
            currency: b.currency ?? "USD",
          },
        });
      }

      if (spec.digitalWallet && existingType === FieldType.DIGITAL_WALLET) {
        const d = spec.digitalWallet;
        await tx.digitalWalletDetail.upsert({
          where: { fieldId },
          create: {
            fieldId,
            platform: d.platform,
            handleOrLink: encryptFinancialString(d.handleOrLink),
          },
          update: {
            platform: d.platform,
            handleOrLink: encryptFinancialString(d.handleOrLink),
          },
        });
      }

      if (spec.cryptoWallet && existingType === FieldType.CRYPTO_WALLET) {
        const c = spec.cryptoWallet;
        await tx.cryptoWalletDetail.upsert({
          where: { fieldId },
          create: {
            fieldId,
            network: c.network,
            address: encryptFinancialString(c.address),
          },
          update: {
            network: c.network,
            address: encryptFinancialString(c.address),
          },
        });
      }
    });
  }
}
