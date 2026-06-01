import { ContactSource } from "@prisma/client";
import { ContactProviderLinkService } from "./contact-provider-link.service";
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

  function makeProviderLinks(
    overrides: Partial<ContactProviderLinkService> = {},
  ) {
    return {
      resolveContactId: jest.fn().mockResolvedValue(null),
      findPrimaryContactIdInMergeGroup: jest.fn().mockResolvedValue(null),
      findPrimaryContactIdsForMergeGroups: jest
        .fn()
        .mockResolvedValue(new Map()),
      upsertLink: jest.fn().mockResolvedValue(undefined),
      softDeleteByProviderKey: jest.fn().mockResolvedValue(false),
      ...overrides,
    } as unknown as ContactProviderLinkService;
  }

  function createMocks(existing: boolean) {
    const contact = {
      id: "contact-1",
      userId,
      source: ContactSource.GOOGLE,
      externalId: "people/abc",
      mergeGroupId: "group-1",
      displayName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      middleName: null,
      namePrefix: null,
      nameSuffix: null,
      nickname: null,
      notes: null,
      sourceRevision: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      phones: [],
      emails: [],
      organizations: [],
      addresses: [],
      urls: [],
    };
    const tx = {
      contact: {
        findUnique: jest.fn().mockResolvedValue(existing ? contact : null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(contact),
        create: jest.fn().mockResolvedValue(contact),
        update: jest.fn().mockResolvedValue({ ...contact, deletedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      contactProviderLink: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactOrganization: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactDedupKey: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      contactMergeGroup: {
        create: jest.fn().mockResolvedValue({ id: "group-1" }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ countryCode: "+1" }),
      },
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
      resolveMergeGroupFromIndex: jest.fn(),
      flushDedupIndexPending: jest.fn(),
      loadDedupIndex: jest.fn(),
    };
    const providerLinks = makeProviderLinks({
      resolveContactId: jest
        .fn()
        .mockResolvedValue(existing ? "contact-1" : null),
    });
    return { prisma, dedup, providerLinks, tx, contact };
  }

  it("returns added outcome for new contact", async () => {
    const { prisma, dedup, providerLinks } = createMocks(false);
    const svc = new ContactUpsertService(
      prisma as never,
      dedup as never,
      providerLinks,
    );
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "added", duplicateFound: false });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(providerLinks.upsertLink).toHaveBeenCalledWith(
      userId,
      "contact-1",
      baseContact,
      true,
      expect.anything(),
    );
  });

  it("returns updated outcome for existing contact", async () => {
    const { prisma, dedup, providerLinks } = createMocks(true);
    const svc = new ContactUpsertService(
      prisma as never,
      dedup as never,
      providerLinks,
    );
    const result = await svc.upsert(userId, baseContact);
    expect(result).toMatchObject({ outcome: "updated", duplicateFound: false });
  });

  it("soft-deletes and returns deleted outcome", async () => {
    const { prisma, dedup, providerLinks } = createMocks(false);
    const svc = new ContactUpsertService(
      prisma as never,
      dedup as never,
      providerLinks,
    );
    const result = await svc.upsert(userId, { ...baseContact, deleted: true });
    expect(result).toEqual({ outcome: "deleted", duplicateFound: false });
    expect(prisma.contact.updateMany).toHaveBeenCalled();
  });

  it("merges cross-source duplicate into primary contact", async () => {
    const { prisma, dedup, providerLinks, tx } = createMocks(false);
    dedup.resolveMergeGroup.mockResolvedValue({
      mergeGroupId: "group-1",
      duplicateFound: true,
    });
    (
      providerLinks.findPrimaryContactIdInMergeGroup as jest.Mock
    ).mockResolvedValue("primary-1");
    tx.contact.findUniqueOrThrow.mockResolvedValue({
      id: "primary-1",
      source: ContactSource.GOOGLE,
      externalId: "people/google",
      mergeGroupId: "group-1",
      deletedAt: null,
      phones: [],
      emails: [],
      organizations: [],
      addresses: [],
      urls: [],
    });
    tx.contact.update.mockResolvedValue({
      id: "primary-1",
      source: ContactSource.GOOGLE,
      externalId: "people/google",
      deletedAt: null,
    });

    const incoming: NormalizedContact = {
      ...baseContact,
      source: ContactSource.ICLOUD,
      externalId: "icloud-1",
    };
    const svc = new ContactUpsertService(
      prisma as never,
      dedup as never,
      providerLinks,
    );
    const result = await svc.upsert(userId, incoming);
    expect(result).toMatchObject({ outcome: "updated", duplicateFound: true });
    expect(tx.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "primary-1" } }),
    );
    expect(tx.contact.updateMany).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(providerLinks.upsertLink).toHaveBeenCalledWith(
      userId,
      "primary-1",
      incoming,
      false,
      expect.anything(),
    );
  });

  it("upsertBatch processes multiple contacts sequentially", async () => {
    const contactA = { ...baseContact, externalId: "vcard-a" };
    const contactB = {
      ...baseContact,
      externalId: "vcard-b",
      emails: [{ value: "bob@example.com", isPrimary: true }],
      phones: [{ value: "+15559876543", isPrimary: true }],
    };

    const tx = {
      contact: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: "new-a", externalId: "vcard-a" })
          .mockResolvedValueOnce({ id: "new-b", externalId: "vcard-b" }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      contactProviderLink: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      contactPhone: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactEmail: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactOrganization: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactUrl: { deleteMany: jest.fn(), createMany: jest.fn() },
      contactMergeGroup: { createMany: jest.fn() },
      contactDedupKey: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ countryCode: "+1" }),
      },
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
      refreshKeysForContact: jest.fn(),
    };

    const providerLinks = makeProviderLinks();
    const svc = new ContactUpsertService(
      prisma as never,
      dedup as never,
      providerLinks,
    );
    const stats = await svc.upsertBatch(userId, [contactA, contactB]);

    expect(stats.added).toBe(2);
    expect(tx.contact.create).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(providerLinks.upsertLink).toHaveBeenCalledTimes(2);
  });
});
