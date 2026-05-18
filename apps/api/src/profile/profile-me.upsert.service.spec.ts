import { FieldCategory, FieldType } from "@prisma/client";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";

describe("ProfileMeUpsertService", () => {
  const userId = "user-1";
  let prisma: {
    user: { update: jest.Mock };
    fieldGroup: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
    profileField: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let persistence: {
    loadGroups: jest.Mock;
    createGroup: jest.Mock;
    updateGroupName: jest.Mock;
    syncGroupFields: jest.Mock;
    deleteGroup: jest.Mock;
    upsertFieldById: jest.Mock;
    createField: jest.Mock;
    deleteField: jest.Mock;
    findGroup: jest.Mock;
  };
  let serializer: { build: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { update: jest.fn().mockResolvedValue({}) },
      fieldGroup: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      profileField: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn((fn: (p: typeof prisma) => unknown) => fn(prisma)),
    };
    persistence = {
      loadGroups: jest.fn().mockResolvedValue([]),
      createGroup: jest.fn().mockResolvedValue({
        id: "new-group",
        userId,
        category: FieldCategory.WORK,
        name: "Acme",
      }),
      updateGroupName: jest.fn().mockResolvedValue(undefined),
      syncGroupFields: jest.fn().mockResolvedValue([]),
      deleteGroup: jest.fn().mockResolvedValue(undefined),
      upsertFieldById: jest.fn().mockResolvedValue("field-1"),
      createField: jest.fn().mockResolvedValue("new-field"),
      deleteField: jest.fn().mockResolvedValue(undefined),
      findGroup: jest.fn().mockResolvedValue({
        id: "g1",
        category: FieldCategory.WORK,
      }),
    };
    serializer = {
      build: jest.fn().mockResolvedValue({
        identity: {},
        personal: {},
        work: [],
        business: [],
        socials: [],
        financial: {
          bankAccounts: [],
          digitalWallets: [],
          cryptoWallets: [],
        },
      }),
    };
  });

  it("creates work group when groupId omitted", async () => {
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      work: [{ tag: "Acme", companyName: "Acme", workTitle: "Dev" }],
    });
    expect(persistence.createGroup).toHaveBeenCalledWith(
      userId,
      FieldCategory.WORK,
      "Acme",
    );
    expect(persistence.syncGroupFields).toHaveBeenCalled();
  });

  it("updates identity user fields", async () => {
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      identity: { firstName: "Jane", lastName: "Doe" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { firstName: "Jane", lastName: "Doe" },
    });
  });

  it("updates financial row by fieldId", async () => {
    persistence.loadGroups.mockResolvedValue([
      {
        id: "fg-fin",
        userId,
        category: FieldCategory.FINANCIAL,
        name: "Banking",
        fields: [
          {
            id: "bank-field-1",
            type: FieldType.BANK_ACCOUNT,
            groupId: "fg-fin",
          },
        ],
      },
    ]);
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      financial: {
        bankAccounts: [
          {
            fieldId: "bank-field-1",
            groupId: "fg-fin",
            tag: "Banking",
            bankName: "HDFC",
            accountHolder: "Jane",
            accountNumber: "123",
            currency: "INR",
          },
        ],
      },
    });
    expect(persistence.upsertFieldById).toHaveBeenCalledWith(
      userId,
      "bank-field-1",
      expect.objectContaining({ type: FieldType.BANK_ACCOUNT }),
    );
  });
});
