import { Injectable } from "@nestjs/common";
import {
  type AddressDetail,
  type BankAccountDetail,
  type CryptoWalletDetail,
  type DigitalWalletDetail,
  FieldCategory,
  type FieldGroup,
  FieldType,
  type ProfileField,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fieldTypeToCamelCase } from "./field-type.util";

type FieldWithExtensions = ProfileField & {
  address: AddressDetail | null;
  bankAccount: BankAccountDetail | null;
  digitalWallet: DigitalWalletDetail | null;
  cryptoWallet: CryptoWalletDetail | null;
};

type GroupWithFields = FieldGroup & { fields: FieldWithExtensions[] };

export type ProfileMeResponse = {
  identity: Record<string, unknown>[];
  personal: Record<string, unknown>;
  work: Record<string, unknown>[];
  business: Record<string, unknown>[];
  socials: Record<string, unknown>[];
  financial: {
    bankAccounts: Record<string, unknown>[];
    digitalWallets: Record<string, unknown>[];
    cryptoWallets: Record<string, unknown>[];
  };
  custom: Record<string, string>;
};

function categoryToKey(category: FieldCategory): keyof ProfileMeResponse | null {
  switch (category) {
    case FieldCategory.IDENTITY:
      return "identity";
    case FieldCategory.PERSONAL:
      return "personal";
    case FieldCategory.WORK:
      return "work";
    case FieldCategory.BUSINESS:
      return "business";
    case FieldCategory.SOCIAL:
      return "socials";
    case FieldCategory.FINANCIAL:
      return "financial";
    case FieldCategory.CUSTOM:
      return "custom";
    default:
      return null;
  }
}

function extensionPayload(field: FieldWithExtensions): Record<string, unknown> {
  if (field.address) {
    const a = field.address;
    return {
      street: a.street,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country,
    };
  }
  if (field.bankAccount) {
    const b = field.bankAccount;
    return {
      bankName: b.bankName,
      accountHolder: b.accountHolder,
      accountNumber: b.accountNumber,
      iban: b.iban,
      swiftBic: b.swiftBic,
      routingNumber: b.routingNumber,
      ifsc: b.ifsc,
      currency: b.currency,
    };
  }
  if (field.digitalWallet) {
    const d = field.digitalWallet;
    return { platform: d.platform, handleOrLink: d.handleOrLink };
  }
  if (field.cryptoWallet) {
    const c = field.cryptoWallet;
    return { network: c.network, address: c.address };
  }
  return {};
}

function flattenField(
  field: FieldWithExtensions,
): Record<string, unknown> | null {
  if (field.type === FieldType.CUSTOM) {
    return null;
  }
  const key = fieldTypeToCamelCase(field.type);
  if (
    field.type === FieldType.ADDRESS ||
    field.type === FieldType.BANK_ACCOUNT ||
    field.type === FieldType.DIGITAL_WALLET ||
    field.type === FieldType.CRYPTO_WALLET
  ) {
    return { [key]: extensionPayload(field) };
  }
  if (field.value === null || field.value === undefined) {
    return { [key]: null };
  }
  return { [key]: field.value };
}

function groupToFlatObject(
  group: GroupWithFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    groupId: group.id,
    tag: group.name,
  };
  const customNested: Record<string, string> = {};
  for (const field of group.fields) {
    if (field.type === FieldType.CUSTOM) {
      const k =
        (field.label && field.label.trim()) ||
        `custom_${field.id.slice(0, 8)}`;
      customNested[k] = field.value ?? "";
      continue;
    }
    const part = flattenField(field);
    if (part) {
      Object.assign(out, part);
    }
  }
  if (Object.keys(customNested).length > 0) {
    out.custom = customNested;
  }
  return out;
}

function mergePersonalGroups(groups: GroupWithFields[]): Record<string, unknown> {
  const ordered = [...groups].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );
  const merged: Record<string, unknown> = {};
  for (const g of ordered) {
    const flat = groupToFlatObject(g);
    delete flat.groupId;
    delete flat.tag;
    const nestedCustom = flat.custom as Record<string, string> | undefined;
    delete flat.custom;
    Object.assign(merged, flat);
    if (nestedCustom) {
      const existing = (merged.custom as Record<string, string>) ?? {};
      merged.custom = { ...existing, ...nestedCustom };
    }
  }
  return merged;
}

function collectCustomFromGroups(groups: GroupWithFields[]): Record<string, string> {
  const custom: Record<string, string> = {};
  for (const g of groups) {
    for (const field of g.fields) {
      if (field.type !== FieldType.CUSTOM) {
        continue;
      }
      const k =
        (field.label && field.label.trim()) ||
        `custom_${field.id.slice(0, 8)}`;
      custom[k] = field.value ?? "";
    }
  }
  return custom;
}

@Injectable()
export class ProfileMeSerializerService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string): Promise<ProfileMeResponse> {
    const groups = await this.prisma.fieldGroup.findMany({
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

    const result: ProfileMeResponse = {
      identity: [],
      personal: {},
      work: [],
      business: [],
      socials: [],
      financial: {
        bankAccounts: [],
        digitalWallets: [],
        cryptoWallets: [],
      },
      custom: {},
    };

    const customCategoryGroups = groups.filter(
      (g) => g.category === FieldCategory.CUSTOM,
    );
    result.custom = {
      ...result.custom,
      ...collectCustomFromGroups(customCategoryGroups),
    };

    for (const g of groups) {
      const key = categoryToKey(g.category);
      if (!key || key === "custom") {
        continue;
      }
      if (g.category === FieldCategory.PERSONAL) {
        continue;
      }
      if (g.category === FieldCategory.FINANCIAL) {
        for (const field of g.fields) {
          const base = {
            groupId: g.id,
            tag: g.name,
            fieldId: field.id,
            ...extensionPayload(field),
          };
          if (field.type === FieldType.BANK_ACCOUNT) {
            result.financial.bankAccounts.push(base);
          } else if (field.type === FieldType.DIGITAL_WALLET) {
            result.financial.digitalWallets.push(base);
          } else if (field.type === FieldType.CRYPTO_WALLET) {
            result.financial.cryptoWallets.push(base);
          }
        }
        continue;
      }
      if (key === "identity" || key === "work" || key === "business" || key === "socials") {
        result[key].push(groupToFlatObject(g as GroupWithFields));
      }
    }

    const personalGroups = groups.filter(
      (g) => g.category === FieldCategory.PERSONAL,
    ) as GroupWithFields[];
    result.personal = mergePersonalGroups(personalGroups);

    const topCustom = collectCustomFromGroups(
      groups.filter((g) => g.category !== FieldCategory.CUSTOM) as GroupWithFields[],
    );
    result.custom = { ...result.custom, ...topCustom };

    return result;
  }
}
