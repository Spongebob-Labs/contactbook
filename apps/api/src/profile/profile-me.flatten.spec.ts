import { FieldCategory, FieldType } from "@prisma/client";
import {
  buildIdentity,
  flattenFieldForContext,
  groupToSocialItem,
  groupToWorkItem,
  mergePersonalGroups,
  primaryPhoneFromUserSafe,
  type GroupWithFields,
  type UserIdentityRow,
} from "./profile-me.flatten";

function mkGroup(
  partial: Pick<GroupWithFields, "id" | "name" | "category" | "updatedAt"> &
    Partial<Omit<GroupWithFields, "fields">> & { fields?: GroupWithFields["fields"] },
): GroupWithFields {
  const now = partial.updatedAt ?? new Date("2024-06-01T12:00:00.000Z");
  return {
    userId: "user-1",
    createdAt: now,
    updatedAt: now,
    fields: [],
    ...partial,
    fields: partial.fields ?? [],
  } as GroupWithFields;
}

describe("primaryPhoneFromUserSafe", () => {
  it("returns E.164 for valid stored user", () => {
    const user: UserIdentityRow = {
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      countryCode: "+91",
      phone: "9876543210",
    };
    expect(primaryPhoneFromUserSafe(user)).toMatch(/^\+91/);
  });
});

describe("buildIdentity", () => {
  const user: UserIdentityRow = {
    firstName: "Fardeen",
    lastName: "Khan",
    email: "fardeen.private@gmail.com",
    countryCode: "+91",
    phone: "9876543210",
  };

  it("uses User for core fields and profilePhoto from IDENTITY PHOTO", () => {
    const g = mkGroup({
      id: "ig1",
      name: "Main",
      category: FieldCategory.IDENTITY,
      updatedAt: new Date("2024-01-01"),
      fields: [
        {
          id: "f1",
          groupId: "ig1",
          type: FieldType.PHOTO,
          label: null,
          isSensitive: false,
          value: "https://storage.example.com/p.jpg",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = buildIdentity(user, [g]);
    expect(out.firstName).toBe("Fardeen");
    expect(out.primaryEmail).toBe("fardeen.private@gmail.com");
    expect(out.profilePhoto).toBe("https://storage.example.com/p.jpg");
  });

  it("lets User win over IDENTITY group for primaryEmail", () => {
    const g = mkGroup({
      id: "ig1",
      name: "Main",
      category: FieldCategory.IDENTITY,
      fields: [
        {
          id: "f1",
          groupId: "ig1",
          type: FieldType.EMAIL,
          label: null,
          isSensitive: false,
          value: "other@example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = buildIdentity(user, [g]);
    expect(out.primaryEmail).toBe("fardeen.private@gmail.com");
  });
});

describe("flattenFieldForContext work", () => {
  it("maps JOB_TITLE to workTitle", () => {
    const field = {
      id: "f1",
      groupId: "g1",
      type: FieldType.JOB_TITLE,
      label: null,
      isSensitive: false,
      value: "Architect",
      createdAt: new Date(),
      updatedAt: new Date(),
      address: null,
      bankAccount: null,
      digitalWallet: null,
      cryptoWallet: null,
    };
    expect(flattenFieldForContext(field, "work")).toEqual({ workTitle: "Architect" });
  });
});

describe("groupToWorkItem", () => {
  it("renames company and reg number", () => {
    const g = mkGroup({
      id: "wg1",
      name: "SaaS King",
      category: FieldCategory.WORK,
      fields: [
        {
          id: "f1",
          groupId: "wg1",
          type: FieldType.COMPANY,
          label: null,
          isSensitive: false,
          value: "SaaS King",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
        {
          id: "f2",
          groupId: "wg1",
          type: FieldType.REG_NUMBER,
          label: null,
          isSensitive: false,
          value: "CIN-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = groupToWorkItem(g);
    expect(out.groupId).toBe("wg1");
    expect(out.tag).toBe("SaaS King");
    expect(out.companyName).toBe("SaaS King");
    expect(out.companyRegNumber).toBe("CIN-123");
  });
});

describe("groupToSocialItem", () => {
  it("maps known labels to fixed keys and unknown to custom", () => {
    const g = mkGroup({
      id: "sg1",
      name: "Social",
      category: FieldCategory.SOCIAL,
      fields: [
        {
          id: "f1",
          groupId: "sg1",
          type: FieldType.SOCIAL_LINK,
          label: "Facebook",
          isSensitive: false,
          value: "https://facebook.com/x",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
        {
          id: "f2",
          groupId: "sg1",
          type: FieldType.SOCIAL_LINK,
          label: "LinkedIn",
          isSensitive: false,
          value: "https://linkedin.com/in/x",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = groupToSocialItem(g);
    expect(out.facebook).toBe("https://facebook.com/x");
    expect(out.custom).toEqual({ LinkedIn: "https://linkedin.com/in/x" });
  });
});

describe("mergePersonalGroups", () => {
  it("sets groupId and tag from most recently updated group", () => {
    const older = mkGroup({
      id: "old",
      name: "Old Personal",
      category: FieldCategory.PERSONAL,
      updatedAt: new Date("2024-01-01"),
      fields: [
        {
          id: "f1",
          groupId: "old",
          type: FieldType.TEXT,
          label: "Nickname",
          isSensitive: false,
          value: "OldNick",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const newer = mkGroup({
      id: "new",
      name: "Primary Personal Details",
      category: FieldCategory.PERSONAL,
      updatedAt: new Date("2025-01-01"),
      fields: [
        {
          id: "f2",
          groupId: "new",
          type: FieldType.TEXT,
          label: "Nickname",
          isSensitive: false,
          value: "Fardeen",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = mergePersonalGroups([older, newer]);
    expect(out.groupId).toBe("new");
    expect(out.tag).toBe("Primary Personal Details");
    expect(out.nickname).toBe("Fardeen");
  });

  it("derives yearOfBirth from dateOfBirth", () => {
    const g = mkGroup({
      id: "p1",
      name: "P",
      category: FieldCategory.PERSONAL,
      fields: [
        {
          id: "f1",
          groupId: "p1",
          type: FieldType.DATE,
          label: null,
          isSensitive: false,
          value: "1998-07-16",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          bankAccount: null,
          digitalWallet: null,
          cryptoWallet: null,
        },
      ],
    });
    const out = mergePersonalGroups([g]);
    expect(out.dateOfBirth).toBe("1998-07-16");
    expect(out.yearOfBirth).toBe("1998");
  });
});
