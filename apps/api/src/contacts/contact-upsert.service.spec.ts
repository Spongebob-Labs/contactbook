import { ContactSource } from "@prisma/client";
import { ContactUpsertService } from "./contact-upsert.service";
import type { NormalizedContact } from "./normalized-contact.types";

describe("ContactUpsertService", () => {
  const userId = "user-1";

  const baseContact: NormalizedContact = {
    source: ContactSource.GOOGLE,
    externalId: "people/abc",
    displayName: "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    phones: [{ value: "+15551234567", isPrimary: true }],
    emails: [{ value: "jane@example.com", isPrimary: true }],
    organizations: [{ companyName: "Acme", title: "Engineer", isPrimary: true }],
    addresses: [],
    urls: [],
  };

  function createPrismaMock() {
    const contact = {
      id: "contact-1",
      userId,
      ...baseContact,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return {
      contact: {
        upsert: jest.fn().mockResolvedValue(contact),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
      contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactOrganization: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(
        async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            contact: {
              upsert: jest.fn().mockResolvedValue(contact),
            },
            contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
            contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
            contactOrganization: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
            contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
          }),
      ),
    };
  }

  it("soft-deletes without requiring an existing row", async () => {
    const prisma = createPrismaMock();
    const svc = new ContactUpsertService(prisma as never);
    const result = await svc.upsert(userId, {
      ...baseContact,
      deleted: true,
    });
    expect(result).toBeNull();
    expect(prisma.contact.updateMany).toHaveBeenCalled();
  });
});
