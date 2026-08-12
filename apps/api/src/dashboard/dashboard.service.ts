import { Injectable } from "@nestjs/common";
import type { CardType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  DashboardStatsDto,
  DeliveryBreakdownDto,
  TopCardDto,
  TopContactDto,
} from "./dto/dashboard-stats.dto";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCards,
      totalContacts,
      totalShareBatches,
      totalRecipientsReached,
      dispatchGroups,
      deliveredCount,
      readCount,
      sharesLast7Days,
      sharesLast30Days,
      contactsAddedLast30Days,
      newCardsLast30Days,
      recipientGroups,
      topCardGroups,
    ] = await Promise.all([
      this.prisma.contactCard.count({ where: { userId } }),

      this.prisma.contact.count({ where: { userId, deletedAt: null } }),

      this.prisma.cardShareBatch.count({ where: { senderId: userId } }),

      this.prisma.cardShareRecipient.count({
        where: { batch: { senderId: userId } },
      }),

      this.prisma.cardShareRecipient.groupBy({
        by: ["dispatchStatus"],
        where: { batch: { senderId: userId } },
        _count: { id: true },
      }),

      this.prisma.cardShareRecipient.count({
        where: {
          batch: { senderId: userId },
          deliveryStatus: { in: ["DELIVERED", "READ"] },
        },
      }),

      this.prisma.cardShareRecipient.count({
        where: { batch: { senderId: userId }, deliveryStatus: "READ" },
      }),

      this.prisma.cardShareBatch.count({
        where: { senderId: userId, createdAt: { gte: sevenDaysAgo } },
      }),

      this.prisma.cardShareBatch.count({
        where: { senderId: userId, createdAt: { gte: thirtyDaysAgo } },
      }),

      this.prisma.contact.count({
        where: { userId, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      }),

      this.prisma.contactCard.count({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
      }),

      this.prisma.cardShareRecipient.groupBy({
        by: ["recipientCountryCode", "recipientPhone"],
        where: { batch: { senderId: userId } },
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      this.prisma.cardShareBatch.groupBy({
        by: ["cardId", "cardNameSnapshot", "cardTypeSnapshot"],
        where: { senderId: userId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    const statusCount = (status: string): number =>
      dispatchGroups.find((g) => g.dispatchStatus === status)?._count.id ?? 0;

    const deliveryBreakdown: DeliveryBreakdownDto = {
      pending:
        statusCount("PENDING") +
        statusCount("PROCESSING") +
        statusCount("RETRYING"),
      dispatched: statusCount("DISPATCHED"),
      delivered: deliveredCount,
      read: readCount,
      failed: statusCount("FAILED"),
    };

    const [topContacts, topCards] = await Promise.all([
      this.resolveTopContacts(userId, recipientGroups),
      this.resolveTopCards(userId, topCardGroups),
    ]);

    return {
      totalCards,
      totalContacts,
      totalShareBatches,
      totalRecipientsReached,
      deliveryBreakdown,
      topContacts,
      topCards,
      sharesLast7Days,
      sharesLast30Days,
      contactsAddedLast30Days,
      newCardsLast30Days,
    };
  }

  private async resolveTopContacts(
    userId: string,
    groups: Array<{
      recipientCountryCode: string;
      recipientPhone: string;
      _count: { id: number };
      _max: { createdAt: Date | null };
    }>,
  ): Promise<TopContactDto[]> {
    return Promise.all(
      groups.map(async (group) => {
        const linked = await this.prisma.cardShareRecipient.findFirst({
          where: {
            recipientCountryCode: group.recipientCountryCode,
            recipientPhone: group.recipientPhone,
            recipientContactId: { not: null },
            batch: { senderId: userId },
          },
          select: {
            recipientContactId: true,
            recipientContact: {
              select: { displayName: true, firstName: true, lastName: true },
            },
          },
        });

        const contact = linked?.recipientContact;
        const displayName =
          contact?.displayName ??
          ([contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
            `${group.recipientCountryCode} ${group.recipientPhone}`);

        return {
          contactId: linked?.recipientContactId ?? null,
          displayName,
          countryCode: group.recipientCountryCode,
          phone: group.recipientPhone,
          timesSharedWith: group._count.id,
          lastSharedAt:
            group._max.createdAt?.toISOString() ?? new Date(0).toISOString(),
        };
      }),
    );
  }

  private async resolveTopCards(
    userId: string,
    groups: Array<{
      cardId: string | null;
      cardNameSnapshot: string;
      cardTypeSnapshot: CardType;
      _count: { id: number };
    }>,
  ): Promise<TopCardDto[]> {
    return Promise.all(
      groups.map(async (group) => {
        const recipientCount = await this.prisma.cardShareRecipient.count({
          where: { batch: { senderId: userId, cardId: group.cardId } },
        });

        return {
          cardId: group.cardId,
          cardName: group.cardNameSnapshot,
          cardType: group.cardTypeSnapshot,
          timesShared: group._count.id,
          recipientCount,
        };
      }),
    );
  }
}
