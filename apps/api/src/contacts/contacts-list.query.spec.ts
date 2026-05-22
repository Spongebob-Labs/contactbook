import { ContactSource } from "@prisma/client";
import {
  buildContactsListOrderBy,
  buildContactsListWhere,
} from "./contacts-list.query";
import {
  ContactListSort,
  ContactListSortOrder,
  ListContactsQueryDto,
} from "./dto/list-contacts-query.dto";

describe("buildContactsListWhere", () => {
  it("scopes to user and active contacts", () => {
    const where = buildContactsListWhere("user-1", new ListContactsQueryDto());

    expect(where).toEqual({
      userId: "user-1",
      deletedAt: null,
    });
  });

  it("filters by source when provided", () => {
    const query = new ListContactsQueryDto();
    query.source = ContactSource.GOOGLE;

    const where = buildContactsListWhere("user-1", query);

    expect(where).toMatchObject({
      userId: "user-1",
      deletedAt: null,
      source: ContactSource.GOOGLE,
    });
  });

  it("adds OR search on firstName, lastName, and nickname", () => {
    const query = new ListContactsQueryDto();
    query.search = "ann";

    const where = buildContactsListWhere("user-1", query);

    expect(where.OR).toEqual([
      { firstName: { contains: "ann", mode: "insensitive" } },
      { lastName: { contains: "ann", mode: "insensitive" } },
      { nickname: { contains: "ann", mode: "insensitive" } },
    ]);
  });

  it("ignores blank search", () => {
    const query = new ListContactsQueryDto();
    query.search = "   ";

    const where = buildContactsListWhere("user-1", query);

    expect(where.OR).toBeUndefined();
  });
});

describe("buildContactsListOrderBy", () => {
  it("defaults to name sort", () => {
    expect(buildContactsListOrderBy(new ListContactsQueryDto())).toEqual([
      { displayName: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ]);
  });

  it("sorts by updatedAt desc", () => {
    const query = new ListContactsQueryDto();
    query.sort = ContactListSort.UPDATED_AT;
    query.sortOrder = ContactListSortOrder.DESC;

    expect(buildContactsListOrderBy(query)).toEqual([{ updatedAt: "desc" }]);
  });

  it("sorts by source asc", () => {
    const query = new ListContactsQueryDto();
    query.sort = ContactListSort.SOURCE;

    expect(buildContactsListOrderBy(query)).toEqual([{ source: "asc" }]);
  });
});
