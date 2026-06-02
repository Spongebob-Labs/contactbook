import { Injectable, NotFoundException } from "@nestjs/common";
import { TwilioService } from "../integration/twilio.service";
import { PrismaService } from "../prisma/prisma.service";

export type TravelSettingsDto = {
  homeCity: string | null;
  homeCountry: string | null;
  calendarSyncEnabled: boolean;
};

@Injectable()
export class TravelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async getSettings(userId: string): Promise<TravelSettingsDto> {
    const profile = await this.prisma.userTravelProfile.findUnique({
      where: { userId },
    });
    return {
      homeCity: profile?.homeCity ?? null,
      homeCountry: profile?.homeCountry ?? null,
      calendarSyncEnabled: profile?.calendarSyncEnabled ?? true,
    };
  }

  async updateSettings(
    userId: string,
    data: Partial<TravelSettingsDto>,
  ): Promise<TravelSettingsDto> {
    await this.prisma.userTravelProfile.upsert({
      where: { userId },
      create: {
        userId,
        homeCity: data.homeCity ?? null,
        homeCountry: data.homeCountry ?? null,
        calendarSyncEnabled: data.calendarSyncEnabled ?? true,
      },
      update: {
        ...(data.homeCity !== undefined ? { homeCity: data.homeCity } : {}),
        ...(data.homeCountry !== undefined
          ? { homeCountry: data.homeCountry }
          : {}),
        ...(data.calendarSyncEnabled !== undefined
          ? { calendarSyncEnabled: data.calendarSyncEnabled }
          : {}),
      },
    });
    return this.getSettings(userId);
  }

  async listEvents(userId: string) {
    return this.prisma.travelEvent.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
      take: 100,
    });
  }

  async listNotificationContacts(userId: string) {
    return this.prisma.travelNotificationContact.findMany({
      where: { userId },
      include: { contact: { select: { id: true, displayName: true } } },
    });
  }

  async setNotificationContacts(userId: string, contactIds: string[]) {
    await this.prisma.travelNotificationContact.deleteMany({
      where: { userId },
    });
    if (contactIds.length === 0) {
      return [];
    }
    const owned = await this.prisma.contact.findMany({
      where: { userId, id: { in: contactIds }, deletedAt: null },
      select: { id: true },
    });
    if (owned.length !== contactIds.length) {
      throw new NotFoundException("One or more contacts not found");
    }
    await this.prisma.travelNotificationContact.createMany({
      data: contactIds.map((contactId) => ({ userId, contactId })),
      skipDuplicates: true,
    });
    return this.listNotificationContacts(userId);
  }

  async dispatchTravelNotifications(
    userId: string,
    message: string,
  ): Promise<{ sent: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const list = await this.prisma.travelNotificationContact.findMany({
      where: { userId },
      include: {
        contact: {
          include: {
            phones: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
          },
        },
      },
    });
    let sent = 0;
    for (const row of list) {
      const phone =
        row.contact.phones.find((p) => p.isPrimary) ?? row.contact.phones[0];
      if (!phone?.value) {
        continue;
      }
      await this.twilio.sendWhatsApp(phone.value, message);
      sent += 1;
    }
    return { sent };
  }
}
