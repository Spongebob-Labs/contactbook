import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ContactImportSource,
  ContactImportStatus,
  OAuthProvider,
  TravelEventSource,
} from "@prisma/client";
import { google, people_v1 } from "googleapis";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ContactImportService } from "./contact-import.service";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly contactImport: ContactImportService,
  ) {}

  buildOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("Google OAuth is not configured");
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  createAuthUrl(userId: string): string {
    const oauth2 = this.buildOAuthClient();
    const state = this.jwt.sign(
      { sub: userId, typ: "google_oauth" },
      { expiresIn: "10m" },
    );
    return oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES,
      state,
    });
  }

  private async upsertGoogleAccountForUser(userId: string, args: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    scopes: string;
  }): Promise<void> {
    await this.prisma.googleAccount.upsert({
      where: {
        userId_provider: { userId, provider: OAuthProvider.GOOGLE },
      },
      create: {
        userId,
        provider: OAuthProvider.GOOGLE,
        scopes: args.scopes,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
      },
      update: {
        scopes: args.scopes,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
      },
    });
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string; typ?: string }>(state);
      if (payload.typ !== "google_oauth") {
        throw new Error("Invalid state type");
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const oauth2 = this.buildOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token || !tokens.access_token) {
      throw new BadRequestException("Google did not return tokens");
    }
    oauth2.setCredentials(tokens);
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    await this.upsertGoogleAccountForUser(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: GOOGLE_SCOPES.join(" "),
    });
  }

  async linkProviderTokensForUser(
    userId: string,
    args: {
      providerAccessToken: string;
      providerRefreshToken: string;
      expiresAt: Date | null;
      scope: string | null;
    },
  ): Promise<void> {
    await this.upsertGoogleAccountForUser(userId, {
      accessToken: args.providerAccessToken,
      refreshToken: args.providerRefreshToken,
      expiresAt: args.expiresAt,
      scopes: (args.scope && args.scope.trim().length > 0)
        ? args.scope.trim()
        : GOOGLE_SCOPES.join(" "),
    });
  }

  private async getOAuth2ForUser(userId: string) {
    const account = await this.prisma.googleAccount.findUnique({
      where: {
        userId_provider: { userId, provider: OAuthProvider.GOOGLE },
      },
    });
    if (!account) {
      throw new BadRequestException("Google account not linked");
    }
    const oauth2 = this.buildOAuthClient();
    oauth2.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });
    oauth2.on(
      "tokens",
      (tokens: {
        access_token?: string | null;
        refresh_token?: string | null;
        expiry_date?: number | null;
      }) => {
        void (async () => {
          if (tokens.access_token) {
            await this.prisma.googleAccount.update({
              where: { id: account.id },
              data: {
                accessToken: tokens.access_token,
                expiresAt: tokens.expiry_date
                  ? new Date(tokens.expiry_date)
                  : account.expiresAt,
                refreshToken: tokens.refresh_token ?? account.refreshToken,
              },
            });
          }
        })();
      },
    );
    return { oauth2, account };
  }

  private async getAuthorizedPeopleClient(userId: string) {
    const { oauth2, account } = await this.getOAuth2ForUser(userId);
    return { people: google.people({ version: "v1", auth: oauth2 }), account };
  }

  async syncContacts(userId: string): Promise<{ imported: number }> {
    const { people, account } = await this.getAuthorizedPeopleClient(userId);
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
        syncToken: account.peopleSyncToken ?? undefined,
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
      await this.prisma.googleAccount.update({
        where: { id: account.id },
        data: { peopleSyncToken: nextSyncToken },
      });
    }
    return { imported: count };
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
          source: ContactImportSource.GOOGLE,
          externalResourceName: resourceName,
        },
        data: {
          deletedAt: new Date(),
          lastSyncedAt: new Date(),
          rawPerson: raw,
          etag: person.etag ?? undefined,
        },
      });
      return;
    }
    const existing = await this.prisma.contactImport.findUnique({
      where: {
        userId_source_externalResourceName: {
          userId,
          source: ContactImportSource.GOOGLE,
          externalResourceName: resourceName,
        },
      },
    });
    const mergedName = this.contactImport.mergeDisplayNameSnapshot(
      person,
      existing?.userOverrides ?? null,
    );
    await this.prisma.contactImport.upsert({
      where: {
        userId_source_externalResourceName: {
          userId,
          source: ContactImportSource.GOOGLE,
          externalResourceName: resourceName,
        },
      },
      create: {
        userId,
        source: ContactImportSource.GOOGLE,
        status: ContactImportStatus.PROCESSED,
        externalResourceName: resourceName,
        etag: person.etag ?? null,
        displayNameSnapshot: mergedName,
        rawPerson: raw,
        lastSyncedAt: new Date(),
        processedAt: new Date(),
        deletedAt: null,
      },
      update: {
        etag: person.etag ?? null,
        displayNameSnapshot: mergedName,
        rawPerson: raw,
        lastSyncedAt: new Date(),
        processedAt: new Date(),
        deletedAt: null,
        status: ContactImportStatus.PROCESSED,
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

  async syncTravelEvents(userId: string): Promise<number> {
    const { oauth2 } = await this.getOAuth2ForUser(userId);
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
      const start = new Date(startRaw);
      const end = new Date(endRaw);
      const city = ev.location?.split(",")[0]?.trim().slice(0, 120) ?? null;
      await this.prisma.travelEvent.upsert({
        where: {
          userId_calendarEventId: {
            userId,
            calendarEventId: ev.id,
          },
        },
        create: {
          userId,
          calendarEventId: ev.id,
          title: ev.summary ?? null,
          start,
          end,
          city,
          location: ev.location ?? null,
          timeZone: ev.start?.timeZone ?? null,
          raw: (ev as object) ?? {},
          source: TravelEventSource.GOOGLE_CALENDAR,
        },
        update: {
          title: ev.summary ?? null,
          start,
          end,
          city,
          location: ev.location ?? null,
          timeZone: ev.start?.timeZone ?? null,
          raw: (ev as object) ?? {},
        },
      });
      count += 1;
    }
    return count;
  }
}
