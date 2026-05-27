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

  return {
    userId,
    deletedAt: null,
    ...(query.source ? { source: query.source } : {}),
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
