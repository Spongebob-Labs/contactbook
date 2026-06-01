import { Injectable, Logger } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import type { people_v1 } from "googleapis";
import { google } from "googleapis";
import { GroupsService } from "../groups/groups.service";
import { PrismaService } from "../prisma/prisma.service";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";

const GOOGLE_PROVIDER = "google";

@Injectable()
export class ContactLabelsService {
  private readonly logger = new Logger(ContactLabelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly oauthTokenService: OAuthTokenService,
  ) {}

  async applyNamedGroups(
    userId: string,
    contactId: string,
    names: string[],
    source: ContactSource | null,
    externalIdPrefix?: string,
  ): Promise<void> {
    const unique = [
      ...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)),
    ];
    if (unique.length === 0) {
      return;
    }

    const groupIds: string[] = [];
    for (const name of unique) {
      const extId = externalIdPrefix
        ? `${externalIdPrefix}:${name.toLowerCase()}`
        : null;
      if (source && extId) {
        const group = await this.groups.upsertProviderGroup(
          userId,
          source,
          extId,
          name,
        );
        groupIds.push(group.id);
      } else {
        const group = await this.prisma.contactGroup.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name, source: null, externalId: null },
          update: {},
        });
        groupIds.push(group.id);
      }
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: { groups: true },
    });
    if (!contact) {
      return;
    }

    const preserved =
      source != null
        ? contact.groups
            .filter((g) => g.source !== source)
            .map((g) => ({ id: g.id }))
        : contact.groups.map((g) => ({ id: g.id }));

    const mergedIds = new Set([...preserved.map((g) => g.id), ...groupIds]);

    await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        groups: { set: [...mergedIds].map((id) => ({ id })) },
      },
    });
  }

  async applyVcfCategories(
    userId: string,
    items: Array<{ externalId: string; categories: string[] }>,
  ): Promise<void> {
    for (const item of items) {
      if (item.categories.length === 0 || !item.externalId) {
        continue;
      }
      const contact = await this.prisma.contact.findUnique({
        where: {
          userId_source_externalId: {
            userId,
            source: ContactSource.VCARD,
            externalId: item.externalId,
          },
        },
      });
      if (!contact) {
        continue;
      }
      await this.applyNamedGroups(userId, contact.id, item.categories, null);
    }
  }

  async syncGoogleContactGroups(
    userId: string,
    persons: people_v1.Schema$Person[],
  ): Promise<void> {
    try {
      const people = await this.getPeopleClient(userId);
      const groupMap = new Map<string, string>();

      let pageToken: string | undefined;
      for (;;) {
        const res = await people.contactGroups.list({
          pageSize: 100,
          pageToken,
        });
        for (const g of res.data.contactGroups ?? []) {
          const resourceName = g.resourceName?.trim();
          const name = g.name?.trim() || g.formattedName?.trim();
          if (!resourceName || !name) {
            continue;
          }
          const group = await this.groups.upsertProviderGroup(
            userId,
            ContactSource.GOOGLE,
            resourceName,
            name,
          );
          groupMap.set(resourceName, group.id);
        }
        pageToken = res.data.nextPageToken ?? undefined;
        if (!pageToken) {
          break;
        }
      }

      for (const person of persons) {
        const externalId = person.resourceName?.trim();
        if (!externalId) {
          continue;
        }
        const contact = await this.prisma.contact.findUnique({
          where: {
            userId_source_externalId: {
              userId,
              source: ContactSource.GOOGLE,
              externalId,
            },
          },
          include: { groups: { where: { source: ContactSource.GOOGLE } } },
        });
        if (!contact) {
          continue;
        }

        const googleGroupIds: string[] = [];
        for (const membership of person.memberships ?? []) {
          const resource =
            membership.contactGroupMembership?.contactGroupResourceName?.trim();
          if (!resource) {
            continue;
          }
          const id = groupMap.get(resource);
          if (id) {
            googleGroupIds.push(id);
          }
        }

        const otherGroups = await this.prisma.contactGroup.findMany({
          where: {
            contacts: { some: { id: contact.id } },
            NOT: { source: ContactSource.GOOGLE },
          },
          select: { id: true },
        });

        const allIds = new Set([
          ...otherGroups.map((g) => g.id),
          ...googleGroupIds,
        ]);

        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { groups: { set: [...allIds].map((id) => ({ id })) } },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Google contact group sync failed for user ${userId}: ${String(error)}`,
      );
    }
  }

  private async getPeopleClient(userId: string) {
    const credential = await this.oauthTokenService.requireForUser(
      userId,
      GOOGLE_PROVIDER,
    );
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "urn:ietf:wg:oauth:2.0:oob",
    );
    oauth2.setCredentials({
      access_token: credential.accessToken ?? undefined,
      refresh_token: credential.refreshToken,
    });
    return google.people({ version: "v1", auth: oauth2 });
  }
}
