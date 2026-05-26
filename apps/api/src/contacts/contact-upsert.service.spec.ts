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

  it("counts duplicateFound as updated for import stats", async () => {
    const { prisma, dedup } = createMocks(false);
    dedup.resolveMergeGroup.mockResolvedValue({
      mergeGroupId: "group-1",
      duplicateFound: true,
    });
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "updated", duplicateFound: true });
  });

  it("counts soft-deleted revive as created", async () => {
    const stored = {
      id: "contact-1",
      userId,
      mergeGroupId: "group-1",
      deletedAt: new Date("2026-01-01"),
    };
    const tx = {
      contact: {
        findUnique: jest.fn().mockResolvedValue(stored),
        upsert: jest.fn().mockResolvedValue({ ...stored, deletedAt: null }),
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
      contact: { updateMany: jest.fn(), count: jest.fn() },
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
      buildDedupKeys: jest.fn().mockReturnValue([]),
    };
    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "added", duplicateFound: false });
  });

  it("upsertBatch processes multiple contacts in one transaction", async () => {
    const contactA = { ...baseContact, externalId: "vcard-a" };
    const contactB = {
      ...baseContact,
      externalId: "vcard-b",
      emails: [{ value: "bob@example.com", isPrimary: true }],
      phones: [{ value: "+15559876543", isPrimary: true }],
    };

    const createdRows = [
      { id: "new-a", externalId: "vcard-a" },
      { id: "new-b", externalId: "vcard-b" },
    ];

    const tx = {
      contact: {
        findMany: jest.fn().mockResolvedValue([]),
        createManyAndReturn: jest.fn().mockResolvedValue(createdRows),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactOrganization: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactMergeGroup: { createMany: jest.fn() },
      contactDedupKey: { createMany: jest.fn() },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    const index = {
      keyToMergeGroup: new Map(),
      groupMembers: new Map(),
      pendingNewGroupIds: new Set(["group-a", "group-b"]),
      pendingKeyCreates: new Map(),
    };

    const dedup = {
      loadDedupIndex: jest.fn().mockResolvedValue(index),
      resolveMergeGroupFromIndex: jest
        .fn()
        .mockReturnValueOnce({ mergeGroupId: "group-a", duplicateFound: false })
        .mockReturnValueOnce({
          mergeGroupId: "group-b",
          duplicateFound: false,
        }),
      flushDedupIndexPending: jest.fn().mockResolvedValue(undefined),
      resolveMergeGroup: jest.fn(),
      refreshKeysForContact: jest.fn(),
      buildDedupKeys: jest.fn(),
    };

    const svc = new ContactUpsertService(prisma as never, dedup as never);
    const stats = await svc.upsertBatch(userId, [contactA, contactB]);

    expect(stats.added).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.contact.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(tx.contactPhone.deleteMany).toHaveBeenCalledWith({
      where: { contactId: { in: ["new-a", "new-b"] } },
    });
    expect(dedup.flushDedupIndexPending).toHaveBeenCalled();
  });
});
