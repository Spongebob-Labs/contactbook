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
    organizations: [
      { companyName: "Acme", title: "Engineer", isPrimary: true },
    ],
    addresses: [],
    urls: [],
  };

  function createMocks(existing: boolean) {
    const contact = {
      id: "contact-1",
      userId,
      mergeGroupId: "group-1",
      ...baseContact,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      contact: {
        findUnique: jest.fn().mockResolvedValue(existing ? contact : null),
        upsert: jest.fn().mockResolvedValue(contact),
      },
      contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactOrganization: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactDedupKey: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      contactMergeGroup: {
        create: jest.fn().mockResolvedValue({ id: "group-1" }),
      },
    };
    const prisma = {
      contact: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const dedup = {
      resolveMergeGroup: jest.fn().mockResolvedValue({
        mergeGroupId: "group-1",
        duplicateFound: false,
      }),
      refreshKeysForContact: jest.fn(),
      buildDedupKeys: jest
        .fn()
        .mockReturnValue([{ kind: "email", value: "jane@example.com" }]),
    };
    return { prisma, dedup, tx, contact };
  }

  it("returns added outcome for new contact", async () => {
    const { prisma, dedup } = createMocks(false);
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "added", duplicateFound: false });
  });

  it("returns updated outcome for existing contact", async () => {
    const { prisma, dedup } = createMocks(true);
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "updated", duplicateFound: false });
  });

  it("soft-deletes and returns deleted outcome", async () => {
    const { prisma, dedup } = createMocks(false);
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, { ...baseContact, deleted: true });
    expect(result).toEqual({ outcome: "deleted", duplicateFound: false });
    expect(prisma.contact.updateMany).toHaveBeenCalled();
  });

  it("reports duplicateFound from dedup service", async () => {
    const { prisma, dedup } = createMocks(false);
    dedup.resolveMergeGroup.mockResolvedValue({
      mergeGroupId: "group-1",
      duplicateFound: true,
    });
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "added", duplicateFound: true });
  });
});
