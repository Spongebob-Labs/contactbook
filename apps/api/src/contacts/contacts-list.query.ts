import { Prisma } from "@prisma/client";
import {
  ContactListSort,
  ContactListSortOrder,
  ListContactsQueryDto,
} from "./dto/list-contacts-query.dto";

function normalizeSearch(search: string | undefined): string | undefined {
  const trimmed = search?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function buildContactsListWhere(
  userId: string,
  query: ListContactsQueryDto,
): Prisma.ContactWhereInput {
  const search = normalizeSearch(query.search);

  const tagFilter =
    query.tagIds && query.tagIds.length > 0
      ? {
          AND: query.tagIds.map((tagId) => ({
            tags: { some: { id: tagId } },
          })),
        }
      : {};

  const groupFilter =
    query.groupIds && query.groupIds.length > 0
      ? {
          AND: query.groupIds.map((groupId) => ({
            groups: { some: { id: groupId } },
          })),
        }
      : {};

  return {
    userId,
    deletedAt: null,
    ...(query.source ? { source: query.source } : {}),
    ...tagFilter,
    ...groupFilter,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { nickname: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function buildContactsListOrderBy(
  query: ListContactsQueryDto,
): Prisma.ContactOrderByWithRelationInput[] {
  const direction =
    query.sortOrder === ContactListSortOrder.DESC ? "desc" : "asc";

  switch (query.sort) {
    case ContactListSort.UPDATED_AT:
      return [{ updatedAt: direction }];
    case ContactListSort.SOURCE:
      return [{ source: direction }];
    case ContactListSort.NAME:
    default:
      return [
        { displayName: direction },
        { lastName: direction },
        { firstName: direction },
      ];
  }
}
