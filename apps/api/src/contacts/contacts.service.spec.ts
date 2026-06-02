import { ContactSource } from "@prisma/client";
import { ContactSerializer } from "./contact.serializer";
import { ContactsService } from "./contacts.service";
import {
  ContactListSort,
  ContactListSortOrder,
  ListContactsQueryDto,
} from "./dto/list-contacts-query.dto";

const contactRow = {
  id: "contact-1",
  userId: "user-1",
  source: ContactSource.GOOGLE,
  externalId: "ext-1",
  mergeGroupId: null,
  sourceRevision: null,
  displayName: "Ann Lee",
  firstName: "Ann",
  lastName: "Lee",
  middleName: null,
  namePrefix: null,
  nameSuffix: null,
  nickname: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  updatedAt: new Date("2026-05-02T00:00:00Z"),
  phones: [],
  emails: [],
  organizations: [],
  addresses: [],
  urls: [],
  tags: [],
  groups: [],
  providerLinks: [],
};

const tagsService = { requireOwnedMany: jest.fn().mockResolvedValue([]) };
const groupsService = { requireOwnedMany: jest.fn().mockResolvedValue([]) };
const writeback = { writeBackContact: jest.fn().mockResolvedValue(undefined) };
const providerLinks = {
  findPrimaryContactIdsForMergeGroups: jest.fn().mockResolvedValue(new Map()),
};

function makeService(prisma: object) {
  return new ContactsService(
    prisma as never,
    new ContactSerializer(),
    tagsService as never,
    groupsService as never,
    writeback as never,
    providerLinks as never,
  );
}

describe("ContactsService.getImportSummary", () => {
  it("aggregates counts and integration state per source", async () => {
    const prisma = {
      contact: {
        count: jest
          .fn()
          .mockImplementation(({ where }: { where: { deletedAt: unknown } }) =>
            Promise.resolve(where.deletedAt === null ? 3 : 1),
          ),
      },
      integrationState: {
        findUnique: jest.fn().mockImplementation(
          ({
            where,
          }: {
            where: {
              userId_source: { userId: string; source: ContactSource };
            };
          }) =>
            Promise.resolve(
              where.userId_source.source === ContactSource.GOOGLE
                ? {
                    lastSyncAt: new Date("2026-05-18T00:00:00Z"),
                    syncToken: "token",
                    lastSyncAdded: 0,
                    lastSyncUpdated: 0,
                    lastSyncDeleted: 0,
                    lastSyncDuplicates: 0,
                  }
                : null,
            ),
        ),
      },
    };
    const svc = makeService(prisma);
    const summary = await svc.getImportSummary("user-1");

    expect(summary.totalActive).toBeGreaterThan(0);
    expect(summary.bySource).toHaveLength(4);
    const google = summary.bySource.find(
      (r) => r.source === ContactSource.GOOGLE,
    );
    expect(google).toMatchObject({
      activeCount: 3,
      deletedCount: 1,
      lastSync: {
        at: new Date("2026-05-18T00:00:00Z"),
        hasSyncToken: true,
        runStats: {
          added: 0,
          updated: 0,
          deleted: 0,
          duplicatesFound: 0,
        },
      },
    });
  });
});

describe("ContactsService.listPaginated", () => {
  it("returns paginated primary contacts only", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: "contact-1", mergeGroupId: "group-1" },
        { id: "contact-2", mergeGroupId: "group-1" },
      ])
      .mockResolvedValueOnce([contactRow]);
    const prisma = { contact: { findMany } };
    providerLinks.findPrimaryContactIdsForMergeGroups.mockResolvedValue(
      new Map([["group-1", "contact-1"]]),
    );
    const svc = makeService(prisma);

    const result = await svc.listPaginated(
      "user-1",
      new ListContactsQueryDto(),
    );

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: "user-1", deletedAt: null },
        select: { id: true, mergeGroupId: true },
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId: "user-1",
          deletedAt: null,
          id: { in: ["contact-1"] },
        },
        skip: 0,
        take: 25,
      }),
    );
    expect(result).toMatchObject({
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("contact-1");
  });

  it("applies source filter and search in member lookup", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { contact: { findMany } };
    const svc = makeService(prisma);
    const query = new ListContactsQueryDto();
    query.source = ContactSource.GOOGLE;
    query.search = "ann";
    query.page = 2;
    query.limit = 10;

    await svc.listPaginated("user-1", query);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        deletedAt: null,
        source: ContactSource.GOOGLE,
        OR: [
          { firstName: { contains: "ann", mode: "insensitive" } },
          { lastName: { contains: "ann", mode: "insensitive" } },
          { nickname: { contains: "ann", mode: "insensitive" } },
        ],
      },
      select: { id: true, mergeGroupId: true },
    });
  });

  it("uses updatedAt desc order when requested", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: "contact-1", mergeGroupId: null }])
      .mockResolvedValueOnce([]);
    const prisma = { contact: { findMany } };
    const svc = makeService(prisma);
    const query = new ListContactsQueryDto();
    query.sort = ContactListSort.UPDATED_AT;
    query.sortOrder = ContactListSortOrder.DESC;

    await svc.listPaginated("user-1", query);

    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }],
      }),
    );
  });

  it("returns empty page metadata when no contacts match", async () => {
    const prisma = {
      contact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = makeService(prisma);

    const result = await svc.listPaginated(
      "user-1",
      new ListContactsQueryDto(),
    );

    expect(result).toEqual({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });
  });
});
