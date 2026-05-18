import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImportSource } from "@prisma/client";
import { google, people_v1 } from "googleapis";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";
import { PrismaService } from "../prisma/prisma.service";

const GOOGLE_PROVIDER = "google";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** Placeholder redirect URI; only used for token refresh via googleapis, not authorization-code flow. */
const OAUTH2_REDIRECT_PLACEHOLDER = "urn:ietf:wg:oauth:2.0:oob";

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauthTokenService: OAuthTokenService,
  ) {}

  buildOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new BadRequestException("Google OAuth is not configured");
    }
    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      OAUTH2_REDIRECT_PLACEHOLDER,
    );
  }

  async linkProviderTokensForUser(
    userId: string,
    args: {
      providerAccessToken: string;
      providerRefreshToken?: string | null;
      expiresAt: Date | null;
      scope: string | null;
    },
  ): Promise<void> {
    if (!args.providerRefreshToken) {
      return;
    }

    const scope =
      args.scope && args.scope.trim().length > 0
        ? args.scope.trim()
        : GOOGLE_SCOPES.join(" ");

    try {
      await this.oauthTokenService.upsertForUser(userId, GOOGLE_PROVIDER, {
        refreshToken: args.providerRefreshToken,
        accessToken: args.providerAccessToken ?? null,
        accessTokenExpiresAt: args.expiresAt,
        scope,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      this.logger.error(
        `Failed to persist Google OAuth credentials for user ${userId}: ${reason}`,
      );
      throw error;
    }
  }

  async disconnectGoogle(userId: string): Promise<void> {
    await this.oauthTokenService.deleteForUser(userId, GOOGLE_PROVIDER);
  }

  private async getOAuth2ForUser(userId: string) {
    const credential = await this.oauthTokenService.requireForUser(
      userId,
      GOOGLE_PROVIDER,
    );
    const oauth2 = this.buildOAuthClient();
    oauth2.setCredentials({
      access_token: credential.accessToken ?? undefined,
      refresh_token: credential.refreshToken,
    });
    oauth2.on(
      "tokens",
      (tokens: {
        access_token?: string | null;
        refresh_token?: string | null;
        expiry_date?: number | null;
      }) => {
        void (async () => {
          if (!tokens.access_token) {
            return;
          }
          try {
            await this.oauthTokenService.updateAccessToken(
              userId,
              GOOGLE_PROVIDER,
              {
                accessToken: tokens.access_token,
                accessTokenExpiresAt: tokens.expiry_date
                  ? new Date(tokens.expiry_date)
                  : new Date(Date.now() + 3600 * 1000),
              },
            );
            if (tokens.refresh_token) {
              await this.oauthTokenService.upsertForUser(
                userId,
                GOOGLE_PROVIDER,
                {
                  refreshToken: tokens.refresh_token,
                  accessToken: tokens.access_token,
                  accessTokenExpiresAt: tokens.expiry_date
                    ? new Date(tokens.expiry_date)
                    : null,
                  scope: credential.scope,
                },
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to persist refreshed Google tokens for user ${userId}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        })();
      },
    );
    return oauth2;
  }

  private async getAuthorizedPeopleClient(userId: string) {
    const oauth2 = await this.getOAuth2ForUser(userId);
    return google.people({ version: "v1", auth: oauth2 });
  }

  private async peopleIntegrationState(userId: string) {
    return this.prisma.integrationState.upsert({
      where: {
        userId_source: { userId, source: ImportSource.GOOGLE },
      },
      create: { userId, source: ImportSource.GOOGLE },
      update: {},
    });
  }

  async syncContacts(userId: string): Promise<{ imported: number }> {
    const people = await this.getAuthorizedPeopleClient(userId);
    const stateRow = await this.peopleIntegrationState(userId);
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let count = 0;
    for (;;) {
      const res = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 100,
        pageToken,
        personFields:
          "names,emailAddresses,phoneNumbers,organizations,metadata,etag",
        requestSyncToken: true,
        syncToken: stateRow.syncToken ?? undefined,
      });
      const connections = res.data.connections ?? [];
      for (const person of connections) {
        await this.upsertPerson(userId, person);
        count += 1;
      }
      if (res.data.nextSyncToken) {
        nextSyncToken = res.data.nextSyncToken;
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) {
        break;
      }
    }
    if (nextSyncToken) {
      await this.prisma.integrationState.update({
        where: {
          userId_source: { userId, source: ImportSource.GOOGLE },
        },
        data: { syncToken: nextSyncToken, lastSyncAt: new Date() },
      });
    }
    return { imported: count };
  }

  private primaryPhone(person: people_v1.Schema$Person): string | null {
    const list = person.phoneNumbers ?? [];
    const primary = list.find((p) => p.metadata?.primary === true) ?? list[0];
    return primary?.value?.trim() ?? null;
  }

  private primaryEmail(person: people_v1.Schema$Person): string | null {
    const list = person.emailAddresses ?? [];
    const primary = list.find((e) => e.metadata?.primary === true) ?? list[0];
    return primary?.value?.trim()?.toLowerCase() ?? null;
  }

  private nameParts(person: people_v1.Schema$Person): {
    firstName: string | null;
    lastName: string | null;
  } {
    const names = person.names ?? [];
    const primary = names.find((n) => n.metadata?.primary === true) ?? names[0];
    return {
      firstName: primary?.givenName?.trim() ?? null,
      lastName: primary?.familyName?.trim() ?? null,
    };
  }

  private async upsertPerson(
    userId: string,
    person: people_v1.Schema$Person,
  ): Promise<void> {
    const resourceName = person.resourceName;
    if (!resourceName) {
      return;
    }
    const deleted = person.metadata?.deleted === true;
    const raw = person as object;
    if (deleted) {
      await this.prisma.contactImport.updateMany({
        where: {
          userId,
          source: ImportSource.GOOGLE,
          externalId: resourceName,
        },
        data: { deletedAt: new Date() },
      });
      return;
    }
    const { firstName, lastName } = this.nameParts(person);
    const mainPhone = this.primaryPhone(person);
    const mainEmail = this.primaryEmail(person);
    await this.prisma.contactImport.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source: ImportSource.GOOGLE,
          externalId: resourceName,
        },
      },
      create: {
        userId,
        source: ImportSource.GOOGLE,
        externalId: resourceName,
        firstName,
        lastName,
        mainPhone,
        mainEmail,
        rawJson: raw,
        deletedAt: null,
      },
      update: {
        firstName,
        lastName,
        mainPhone,
        mainEmail,
        rawJson: raw,
        deletedAt: null,
      },
    });
  }

  private looksLikeTravel(ev: {
    summary?: string | null;
    location?: string | null;
  }): boolean {
    const hay = `${ev.summary ?? ""} ${ev.location ?? ""}`.toLowerCase();
    const keys = [
      "flight",
      "hotel",
      "trip",
      "travel",
      "away",
      "vacation",
      "conference",
    ];
    return keys.some((k) => hay.includes(k));
  }

  private inferCountry(location: string | null | undefined): string {
    if (!location?.trim()) {
      return "";
    }
    const parts = location.split(",").map((s) => s.trim());
    return parts[parts.length - 1] ?? "";
  }

  async syncTravelEvents(userId: string): Promise<number> {
    const oauth2 = await this.getOAuth2ForUser(userId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    const timeMin = new Date();
    const timeMax = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    const items = res.data.items ?? [];
    let count = 0;
    for (const ev of items) {
      if (!ev.id || !this.looksLikeTravel(ev)) {
        continue;
      }
      const startRaw = ev.start?.dateTime ?? ev.start?.date;
      const endRaw = ev.end?.dateTime ?? ev.end?.date;
      if (!startRaw || !endRaw) {
        continue;
      }
      const startDate = new Date(startRaw);
      const endDate = new Date(endRaw);
      const city =
        ev.location?.split(",")[0]?.trim().slice(0, 120) ?? "Unknown";
      const country = this.inferCountry(ev.location ?? null);
      await this.prisma.travelEvent.upsert({
        where: {
          userId_externalCalendarEventId: {
            userId,
            externalCalendarEventId: ev.id,
          },
        },
        create: {
          userId,
          city,
          country: country || "Unknown",
          startDate,
          endDate,
          externalCalendarEventId: ev.id,
          title: ev.summary ?? null,
          raw: (ev as object) ?? {},
        },
        update: {
          city,
          country: country || "Unknown",
          startDate,
          endDate,
          title: ev.summary ?? null,
          raw: (ev as object) ?? {},
        },
      });
      count += 1;
    }
    return count;
  }
}
