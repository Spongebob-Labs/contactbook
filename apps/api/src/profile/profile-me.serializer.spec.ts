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
});
