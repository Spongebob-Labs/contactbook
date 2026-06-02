import { Injectable, NotFoundException } from "@nestjs/common";
import { GroupsService } from "../groups/groups.service";
import { PrismaService } from "../prisma/prisma.service";
import { TagsService } from "../tags/tags.service";
import { ContactProviderLinkService } from "./contact-provider-link.service";
import { ContactSourceWritebackService } from "./contact-source-writeback.service";
import type { UpdateContactDto } from "./dto/update-contact.dto";
import {
  buildContactsListOrderBy,
  buildContactsListWhere,
} from "./contacts-list.query";
import { ContactSerializer } from "./contact.serializer";
import { IMPORT_SUMMARY_SOURCES } from "./contact-import-summary.constants";
import type { ContactImportSummaryDto } from "./dto/contact-import-summary.dto";
import type { ContactListResponseDto } from "./dto/contact-list-response.dto";
import type { ContactDetailDto } from "./dto/contact-response.dto";
import type { ListContactsQueryDto } from "./dto/list-contacts-query.dto";

const contactInclude = {
  phones: { orderBy: { sortOrder: "asc" as const } },
  emails: { orderBy: { sortOrder: "asc" as const } },
  organizations: { orderBy: { sortOrder: "asc" as const } },
  addresses: { orderBy: { sortOrder: "asc" as const } },
  urls: { orderBy: { sortOrder: "asc" as const } },
  tags: { orderBy: { name: "asc" as const } },
  groups: { orderBy: { name: "asc" as const } },
  providerLinks: { orderBy: { source: "asc" as const } },
};

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: ContactSerializer,
    private readonly tags: TagsService,
    private readonly groups: GroupsService,
    private readonly writeback: ContactSourceWritebackService,
    private readonly providerLinks: ContactProviderLinkService,
  ) {}

  async getImportSummary(userId: string): Promise<ContactImportSummaryDto> {
    const [totalActive, totalDeleted, ...rows] = await Promise.all([
      this.prisma.contact.count({
        where: { userId, deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { userId, deletedAt: { not: null } },
      }),
      ...IMPORT_SUMMARY_SOURCES.map(async (source) => {
        const [activeCount, deletedCount, integration] = await Promise.all([
          this.prisma.contact.count({
            where: { userId, source, deletedAt: null },
          }),
          this.prisma.contact.count({
            where: { userId, source, deletedAt: { not: null } },
          }),
          this.prisma.integrationState.findUnique({
            where: { userId_source: { userId, source } },
          }),
        ]);
        const lastSync =
          integration?.lastSyncAt != null
            ? {
                at: integration.lastSyncAt,
                hasSyncToken: Boolean(integration.syncToken),
                runStats: {
                  added: integration.lastSyncAdded,
                  updated: integration.lastSyncUpdated,
                  deleted: integration.lastSyncDeleted,
                  duplicatesFound: integration.lastSyncDuplicates,
                },
              }
            : integration?.syncToken
              ? {
                  at: null,
                  hasSyncToken: true,
                }
              : undefined;
        return {
          source,
          activeCount,
          deletedCount,
          lastSync,
        };
      }),
    ]);

    return {
      totalActive,
      totalDeleted,
      bySource: rows,
    };
  }

  async listPaginated(
    userId: string,
    query: ListContactsQueryDto,
  ): Promise<ContactListResponseDto> {
    const memberWhere = buildContactsListWhere(userId, query);
    const matchingMembers = await this.prisma.contact.findMany({
      where: memberWhere,
      select: { id: true, mergeGroupId: true },
    });

    if (matchingMembers.length === 0) {
      return {
        items: [],
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      };
    }

    const mergeGroupIds = [
      ...new Set(
        matchingMembers
          .map((row) => row.mergeGroupId)
          .filter((id): id is string => id != null),
      ),
    ];
    const primaryByGroup =
      mergeGroupIds.length > 0
        ? await this.providerLinks.findPrimaryContactIdsForMergeGroups(
            userId,
            mergeGroupIds,
          )
        : new Map<string, string>();

    const primaryIds = [
      ...new Set(
        matchingMembers.map((row) => {
          if (row.mergeGroupId) {
            return primaryByGroup.get(row.mergeGroupId) ?? row.id;
          }
          return row.id;
        }),
      ),
    ];

    const orderBy = buildContactsListOrderBy(query);
    const skip = (query.page - 1) * query.limit;

    const [total, rows] = await Promise.all([
      Promise.resolve(primaryIds.length),
      this.prisma.contact.findMany({
        where: { userId, deletedAt: null, id: { in: primaryIds } },
        include: contactInclude,
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.serializer.toDetail(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async get(userId: string, id: string): Promise<ContactDetailDto> {
    const row = await this.prisma.contact.findFirst({
      where: { id, userId },
      include: contactInclude,
    });
    if (!row) {
      throw new NotFoundException("Contact not found");
    }
    return this.serializer.toDetail(row);
  }

  async updateContact(
    userId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<ContactDetailDto> {
    await this.requireContact(userId, contactId);
    if (dto.notes !== undefined) {
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { notes: dto.notes },
      });
    }
    void this.writeback.writeBackContact(userId, contactId);
    return this.get(userId, contactId);
  }

  async setContactTags(
    userId: string,
    contactId: string,
    tagIds: string[],
  ): Promise<ContactDetailDto> {
    await this.requireContact(userId, contactId);
    await this.tags.requireOwnedMany(userId, tagIds);
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { tags: { set: tagIds.map((id) => ({ id })) } },
    });
    return this.get(userId, contactId);
  }

  async setContactGroups(
    userId: string,
    contactId: string,
    groupIds: string[],
  ): Promise<ContactDetailDto> {
    await this.requireContact(userId, contactId);
    await this.groups.requireOwnedMany(userId, groupIds);
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { groups: { set: groupIds.map((id) => ({ id })) } },
    });
    return this.get(userId, contactId);
  }

  private async requireContact(userId: string, contactId: string) {
    const row = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException("Contact not found");
    }
    return row;
  }
}
