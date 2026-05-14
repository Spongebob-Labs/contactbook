import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { FieldGroup, ProfileField } from "@prisma/client";
import { FieldType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "../sync/sync.service";
import { CreateFieldGroupDto } from "./dto/create-field-group.dto";
import { CreateProfileFieldDto } from "./dto/create-profile-field.dto";
import { UpdateFieldGroupDto } from "./dto/update-field-group.dto";
import { UpdateProfileFieldDto } from "./dto/update-profile-field.dto";

const FINANCIAL_TYPES: FieldType[] = [
  FieldType.BANK_ACCOUNT,
  FieldType.DIGITAL_WALLET,
  FieldType.CRYPTO_WALLET,
];

function isFinancialType(t: FieldType): boolean {
  return FINANCIAL_TYPES.includes(t);
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async listFieldGroups(userId: string): Promise<FieldGroup[]> {
    return this.prisma.fieldGroup.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createFieldGroup(
    userId: string,
    dto: CreateFieldGroupDto,
  ): Promise<FieldGroup> {
    return this.prisma.fieldGroup.create({
      data: {
        userId,
        category: dto.category,
        name: dto.name,
      },
    });
  }

  async getFieldGroup(userId: string, groupId: string): Promise<FieldGroup> {
    const g = await this.prisma.fieldGroup.findFirst({
      where: { id: groupId, userId },
    });
    if (!g) {
      throw new NotFoundException("Field group not found");
    }
    return g;
  }

  async updateFieldGroup(
    userId: string,
    groupId: string,
    dto: UpdateFieldGroupDto,
  ): Promise<FieldGroup> {
    await this.getFieldGroup(userId, groupId);
    if (dto.name === undefined && dto.category === undefined) {
      throw new BadRequestException("Provide at least one of name, category");
    }
    return this.prisma.fieldGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
    });
  }

  async deleteFieldGroup(userId: string, groupId: string): Promise<void> {
    await this.getFieldGroup(userId, groupId);
    const fields = await this.prisma.profileField.findMany({
      where: { groupId },
      select: { id: true },
    });
    await this.prisma.fieldGroup.delete({ where: { id: groupId } });
    for (const f of fields) {
      await this.sync.notifyFieldSubscribers(f.id);
    }
  }

  private validateCreatePayload(dto: CreateProfileFieldDto): void {
    if (dto.type === FieldType.ADDRESS) {
      if (!dto.address) {
        throw new BadRequestException(
          "address payload is required for ADDRESS",
        );
      }
      return;
    }
    if (dto.type === FieldType.BANK_ACCOUNT) {
      if (!dto.bankAccount) {
        throw new BadRequestException(
          "bankAccount payload is required for BANK_ACCOUNT",
        );
      }
      return;
    }
    if (dto.type === FieldType.DIGITAL_WALLET) {
      if (!dto.digitalWallet) {
        throw new BadRequestException(
          "digitalWallet payload is required for DIGITAL_WALLET",
        );
      }
      return;
    }
    if (dto.type === FieldType.CRYPTO_WALLET) {
      if (!dto.cryptoWallet) {
        throw new BadRequestException(
          "cryptoWallet payload is required for CRYPTO_WALLET",
        );
      }
      return;
    }
    if (
      dto.address ||
      dto.bankAccount ||
      dto.digitalWallet ||
      dto.cryptoWallet
    ) {
      throw new BadRequestException(
        "Extension payloads are only allowed for ADDRESS and financial field types",
      );
    }
  }

  async createField(
    userId: string,
    groupId: string,
    dto: CreateProfileFieldDto,
  ): Promise<ProfileField> {
    await this.getFieldGroup(userId, groupId);
    this.validateCreatePayload(dto);
    const isSensitive = isFinancialType(dto.type)
      ? true
      : (dto.isSensitive ?? false);

    if (dto.type === FieldType.ADDRESS && dto.address) {
      const a = dto.address;
      const field = await this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: dto.type,
            label: dto.label ?? null,
            isSensitive,
            value: dto.value ?? null,
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
        return f;
      });
      await this.sync.notifyFieldSubscribers(field.id);
      return field;
    }

    if (dto.type === FieldType.BANK_ACCOUNT && dto.bankAccount) {
      const b = dto.bankAccount;
      const field = await this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: dto.type,
            label: dto.label ?? null,
            isSensitive: true,
            value: dto.value ?? null,
          },
        });
        await tx.bankAccountDetail.create({
          data: {
            fieldId: f.id,
            bankName: b.bankName,
            accountHolder: b.accountHolder,
            accountNumber: b.accountNumber,
            iban: b.iban ?? null,
            swiftBic: b.swiftBic ?? null,
            routingNumber: b.routingNumber ?? null,
            ifsc: b.ifsc ?? null,
            currency: b.currency ?? "USD",
          },
        });
        return f;
      });
      await this.sync.notifyFieldSubscribers(field.id);
      return field;
    }

    if (dto.type === FieldType.DIGITAL_WALLET && dto.digitalWallet) {
      const d = dto.digitalWallet;
      const field = await this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: dto.type,
            label: dto.label ?? null,
            isSensitive: true,
            value: dto.value ?? null,
          },
        });
        await tx.digitalWalletDetail.create({
          data: {
            fieldId: f.id,
            platform: d.platform,
            handleOrLink: d.handleOrLink,
          },
        });
        return f;
      });
      await this.sync.notifyFieldSubscribers(field.id);
      return field;
    }

    if (dto.type === FieldType.CRYPTO_WALLET && dto.cryptoWallet) {
      const c = dto.cryptoWallet;
      const field = await this.prisma.$transaction(async (tx) => {
        const f = await tx.profileField.create({
          data: {
            groupId,
            type: dto.type,
            label: dto.label ?? null,
            isSensitive: true,
            value: dto.value ?? null,
          },
        });
        await tx.cryptoWalletDetail.create({
          data: {
            fieldId: f.id,
            network: c.network,
            address: c.address,
          },
        });
        return f;
      });
      await this.sync.notifyFieldSubscribers(field.id);
      return field;
    }

    const field = await this.prisma.profileField.create({
      data: {
        groupId,
        type: dto.type,
        label: dto.label ?? null,
        isSensitive,
        value: dto.value ?? null,
      },
    });
    await this.sync.notifyFieldSubscribers(field.id);
    return field;
  }

  async updateField(
    userId: string,
    fieldId: string,
    dto: UpdateProfileFieldDto,
  ): Promise<ProfileField> {
    const field = await this.prisma.profileField.findFirst({
      where: { id: fieldId, group: { userId } },
      include: {
        address: true,
        bankAccount: true,
        digitalWallet: true,
        cryptoWallet: true,
        group: true,
      },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    const sensitive = isFinancialType(field.type)
      ? true
      : (dto.isSensitive ?? field.isSensitive);

    await this.prisma.$transaction(async (tx) => {
      await tx.profileField.update({
        where: { id: fieldId },
        data: {
          label: dto.label ?? undefined,
          isSensitive: sensitive,
          value: dto.value ?? undefined,
        },
      });
      if (dto.address && field.type === FieldType.ADDRESS && field.address) {
        await tx.addressDetail.update({
          where: { fieldId },
          data: {
            street: dto.address.street,
            city: dto.address.city,
            state: dto.address.state ?? null,
            pincode: dto.address.pincode ?? null,
            country: dto.address.country,
          },
        });
      }
      if (
        dto.bankAccount &&
        field.type === FieldType.BANK_ACCOUNT &&
        field.bankAccount
      ) {
        const b = dto.bankAccount;
        await tx.bankAccountDetail.update({
          where: { fieldId },
          data: {
            bankName: b.bankName,
            accountHolder: b.accountHolder,
            accountNumber: b.accountNumber,
            iban: b.iban ?? null,
            swiftBic: b.swiftBic ?? null,
            routingNumber: b.routingNumber ?? null,
            ifsc: b.ifsc ?? null,
            currency: b.currency ?? "USD",
          },
        });
      }
      if (
        dto.digitalWallet &&
        field.type === FieldType.DIGITAL_WALLET &&
        field.digitalWallet
      ) {
        const d = dto.digitalWallet;
        await tx.digitalWalletDetail.update({
          where: { fieldId },
          data: {
            platform: d.platform,
            handleOrLink: d.handleOrLink,
          },
        });
      }
      if (
        dto.cryptoWallet &&
        field.type === FieldType.CRYPTO_WALLET &&
        field.cryptoWallet
      ) {
        const c = dto.cryptoWallet;
        await tx.cryptoWalletDetail.update({
          where: { fieldId },
          data: {
            network: c.network,
            address: c.address,
          },
        });
      }
    });

    const updated = await this.prisma.profileField.findUniqueOrThrow({
      where: { id: fieldId },
    });
    await this.sync.notifyFieldSubscribers(fieldId);
    return updated;
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
}
