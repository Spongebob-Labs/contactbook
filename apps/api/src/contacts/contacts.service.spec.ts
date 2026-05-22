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
};

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
    const svc = new ContactsService(prisma as never, new ContactSerializer());
    const summary = await svc.getImportSummary("user-1");

    expect(summary.totalActive).toBeGreaterThan(0);
    const google = summary.bySource.find(
      (r) => r.source === ContactSource.GOOGLE,
    );
    expect(google).toMatchObject({
      activeCount: 3,
      deletedCount: 1,
      hasSyncToken: true,
      lastSyncStats: {
        added: 0,
        updated: 0,
        deleted: 0,
        duplicatesFound: 0,
      },
    });
  });
});

describe("ContactsService.listPaginated", () => {
  it("returns paginated items with default page and limit", async () => {
    const count = jest.fn().mockResolvedValue(30);
    const findMany = jest.fn().mockResolvedValue([contactRow]);
    const prisma = { contact: { count, findMany } };
    const svc = new ContactsService(prisma as never, new ContactSerializer());

    const result = await svc.listPaginated("user-1", new ListContactsQueryDto());

    expect(count).toHaveBeenCalledWith({
      where: { userId: "user-1", deletedAt: null },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", deletedAt: null },
      include: expect.any(Object),
      orderBy: [
        { displayName: "asc" },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
      skip: 0,
      take: 25,
    });
    expect(result).toMatchObject({
      page: 1,
      limit: 25,
      total: 30,
      totalPages: 2,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("contact-1");
  });

  it("applies source filter and search in where clause", async () => {
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { contact: { count, findMany } };
    const svc = new ContactsService(prisma as never, new ContactSerializer());
    const query = new ListContactsQueryDto();
    query.source = ContactSource.GOOGLE;
    query.search = "ann";
    query.page = 2;
    query.limit = 10;

    await svc.listPaginated("user-1", query);

    expect(count).toHaveBeenCalledWith({
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
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("uses updatedAt desc order when requested", async () => {
    const count = jest.fn().mockResolvedValue(0);
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { contact: { count, findMany } };
    const svc = new ContactsService(prisma as never, new ContactSerializer());
    const query = new ListContactsQueryDto();
    query.sort = ContactListSort.UPDATED_AT;
    query.sortOrder = ContactListSortOrder.DESC;

    await svc.listPaginated("user-1", query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }],
      }),
    );
  });

  it("returns empty page metadata when no contacts match", async () => {
    const prisma = {
      contact: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = new ContactsService(prisma as never, new ContactSerializer());

    const result = await svc.listPaginated("user-1", new ListContactsQueryDto());

    expect(result).toEqual({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });
  });
});
