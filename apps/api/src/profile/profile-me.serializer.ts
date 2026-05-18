import { Injectable } from "@nestjs/common";
import { FieldCategory, FieldType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildIdentity,
  extensionPayload,
  groupToBusinessItem,
  groupToSocialItem,
  groupToWorkItem,
  mergePersonalGroups,
  type GroupWithFields,
} from "./profile-me.flatten";
import type {
  ProfileMeBankRow,
  ProfileMeCryptoRow,
  ProfileMeFinancial,
  ProfileMeResponse,
  ProfileMeWalletRow,
} from "./profile-me.types";

export type { ProfileMeResponse } from "./profile-me.types";

@Injectable()
export class ProfileMeSerializerService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string): Promise<ProfileMeResponse> {
    const [user, groups] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          countryCode: true,
        },
      }),
      this.prisma.fieldGroup.findMany({
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
      }),
    ]);

    if (!user) {
      return {
        identity: {
          firstName: "",
          lastName: "",
          primaryPhone: "",
          primaryEmail: "",
        },
        personal: { groupId: "", tag: "" },
        work: [],
        business: [],
        socials: [],
        financial: {
          bankAccounts: [],
          digitalWallets: [],
          cryptoWallets: [],
        },
      };
    }

    const financial: ProfileMeFinancial = {
      bankAccounts: [],
      digitalWallets: [],
      cryptoWallets: [],
    };

    const work: ProfileMeResponse["work"] = [];
    const business: ProfileMeResponse["business"] = [];
    const socials: ProfileMeResponse["socials"] = [];
    const identityGroups: GroupWithFields[] = [];
    const personalGroups: GroupWithFields[] = [];

    for (const g of groups) {
      if (g.category === FieldCategory.CUSTOM) {
        continue;
      }
      const gw = g;

      if (g.category === FieldCategory.PERSONAL) {
        personalGroups.push(gw);
        continue;
      }
      if (g.category === FieldCategory.FINANCIAL) {
        for (const field of gw.fields) {
          const base = {
            groupId: g.id,
            fieldId: field.id,
            tag: g.name,
            isSensitive: field.isSensitive,
            ...extensionPayload(field),
          };
          if (field.type === FieldType.BANK_ACCOUNT) {
            financial.bankAccounts.push(base as ProfileMeBankRow);
          } else if (field.type === FieldType.DIGITAL_WALLET) {
            financial.digitalWallets.push(base as ProfileMeWalletRow);
          } else if (field.type === FieldType.CRYPTO_WALLET) {
            financial.cryptoWallets.push(base as ProfileMeCryptoRow);
          }
        }
        continue;
      }
      if (g.category === FieldCategory.IDENTITY) {
        identityGroups.push(gw);
        continue;
      }
      if (g.category === FieldCategory.WORK) {
        work.push(groupToWorkItem(gw));
        continue;
      }
      if (g.category === FieldCategory.BUSINESS) {
        business.push(groupToBusinessItem(gw));
        continue;
      }
      if (g.category === FieldCategory.SOCIAL) {
        socials.push(groupToSocialItem(gw) as (typeof socials)[0]);
      }
    }

    return {
      identity: buildIdentity(user, identityGroups),
      personal: mergePersonalGroups(
        personalGroups,
      ) as ProfileMeResponse["personal"],
      work,
      business,
      socials,
      financial,
    };
  }
}
