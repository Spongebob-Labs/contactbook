import { Injectable, NotFoundException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ContactSerializer } from "./contact.serializer";
import type { ContactImportSummaryDto } from "./dto/contact-import-summary.dto";
import type { ContactDetailDto } from "./dto/contact-response.dto";

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

  async list(
    userId: string,
    source?: ContactSource,
  ): Promise<ContactDetailDto[]> {
    const rows = await this.prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(source ? { source } : {}),
      },
      include: contactInclude,
      orderBy: [
        { displayName: "asc" },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });
    return rows.map((row) => this.serializer.toDetail(row));
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
