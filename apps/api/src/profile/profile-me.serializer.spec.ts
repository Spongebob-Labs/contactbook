import { FieldCategory, FieldType } from "@prisma/client";
import { ProfileMeSerializerService } from "./profile-me.serializer";

describe("ProfileMeSerializerService", () => {
  it("includes isSensitive and fieldId on financial rows", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
          phone: "5551234567",
          countryCode: "+1",
          profileOnboardingCompletedAt: null,
        }),
      },
      fieldGroup: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "fg-fin",
            userId: "u1",
            category: FieldCategory.FINANCIAL,
            name: "Banking",
            createdAt: new Date(),
            updatedAt: new Date(),
            fields: [
              {
                id: "bank-field-1",
                groupId: "fg-fin",
                type: FieldType.BANK_ACCOUNT,
                label: null,
                isSensitive: true,
                value: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                address: null,
                digitalWallet: null,
                cryptoWallet: null,
                bankAccount: {
                  id: "ba1",
                  fieldId: "bank-field-1",
                  bankName: "Test Bank",
                  accountHolder: "A B",
                  accountNumber: "123",
                  iban: null,
                  swiftBic: null,
                  routingNumber: null,
                  ifsc: "IFSC0001",
                  currency: "USD",
                },
              },
            ],
          },
        ]),
      },
    };

    const svc = new ProfileMeSerializerService(prisma as never);
    const out = await svc.build("u1");

    expect(out.financial.bankAccounts).toHaveLength(1);
    const row = out.financial.bankAccounts[0];
    expect(row.isSensitive).toBe(true);
    expect(row.groupId).toBe("fg-fin");
    expect(row.fieldId).toBe("bank-field-1");
    expect(row.bankName).toBe("Test Bank");
  });

  it("exposes profileOnboardingCompletedAt as ISO string", async () => {
    const completed = new Date("2026-05-20T12:00:00.000Z");
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
          phone: "5551234567",
          countryCode: "+1",
          profileOnboardingCompletedAt: completed,
        }),
      },
      fieldGroup: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const out = await new ProfileMeSerializerService(prisma as never).build(
      "u1",
    );
    expect(out.profileOnboardingCompletedAt).toBe(completed.toISOString());
  });

  it("orders multiple work groups in response array", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
          phone: "5551234567",
          countryCode: "+1",
          profileOnboardingCompletedAt: null,
        }),
      },
      fieldGroup: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "w1",
            userId: "u1",
            category: FieldCategory.WORK,
            name: "First",
            createdAt: new Date(),
            updatedAt: new Date("2020-01-01"),
            fields: [
              {
                id: "f1",
                groupId: "w1",
                type: FieldType.TEXT,
                label: "companyName",
                isSensitive: false,
                value: "Corp A",
                createdAt: new Date(),
                updatedAt: new Date(),
                address: null,
                bankAccount: null,
                digitalWallet: null,
                cryptoWallet: null,
              },
            ],
          },
          {
            id: "w2",
            userId: "u1",
            category: FieldCategory.WORK,
            name: "Second",
            createdAt: new Date(),
            updatedAt: new Date("2021-01-01"),
            fields: [
              {
                id: "f2",
                groupId: "w2",
                type: FieldType.TEXT,
                label: "companyName",
                isSensitive: false,
                value: "Corp B",
                createdAt: new Date(),
                updatedAt: new Date(),
                address: null,
                bankAccount: null,
                digitalWallet: null,
                cryptoWallet: null,
              },
            ],
          },
        ]),
      },
    };
    const out = await new ProfileMeSerializerService(prisma as never).build(
      "u1",
    );
    expect(out.work).toHaveLength(2);
    expect(out.work.map((w) => w.groupId)).toEqual(["w1", "w2"]);
  });
});
