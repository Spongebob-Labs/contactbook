import { Injectable, NotFoundException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildContactsListOrderBy,
  buildContactsListWhere,
} from "./contacts-list.query";
import { ContactSerializer } from "./contact.serializer";
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
};

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: ContactSerializer,
  ) {}

  async getImportSummary(userId: string): Promise<ContactImportSummaryDto> {
    const sources = Object.values(ContactSource);

    const rows = await Promise.all(
      sources.map(async (source) => {
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
        const hasSyncToken = Boolean(integration?.syncToken);
        const lastSyncStats =
          integration?.lastSyncAt != null
            ? {
                added: integration.lastSyncAdded,
                updated: integration.lastSyncUpdated,
                deleted: integration.lastSyncDeleted,
                duplicatesFound: integration.lastSyncDuplicates,
              }
            : undefined;
        return {
          source,
          activeCount,
          deletedCount,
          lastSyncAt: integration?.lastSyncAt ?? null,
          hasSyncToken,
          lastSyncStats,
        };
      }),
    );

    const bySource = rows.filter(
      (row) =>
        row.activeCount > 0 ||
        row.deletedCount > 0 ||
        row.hasSyncToken ||
        row.lastSyncAt != null,
    );

    return {
      totalActive: bySource.reduce((sum, row) => sum + row.activeCount, 0),
      totalDeleted: bySource.reduce((sum, row) => sum + row.deletedCount, 0),
      bySource,
    };
  }

  async listPaginated(
    userId: string,
    query: ListContactsQueryDto,
  ): Promise<ContactListResponseDto> {
    const where = buildContactsListWhere(userId, query);
    const orderBy = buildContactsListOrderBy(query);
    const skip = (query.page - 1) * query.limit;

    const [total, rows] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
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
}
