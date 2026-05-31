import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContactSource } from "@prisma/client";
import { google, people_v1 } from "googleapis";
import { OAuthTokenService } from "../../oauth-tokens/oauth-token.service";
import { PrismaService } from "../../prisma/prisma.service";
import { syncStatsProcessedCount } from "../contact-sync-stats";
import { ContactLabelsService } from "../contact-labels.service";
import { ContactUpsertService } from "../contact-upsert.service";
import { tryGooglePersonForImport } from "../google-contact.adapter";
import type { ContactImportRun } from "../contact-import-result.mapper";
import type { ContactImportSkippedItem } from "../contact-import-skipped.types";
import type { ContactSyncResponseDto } from "../dto/contact-sync-response.dto";
import type { NormalizedContact } from "../normalized-contact.types";

const GOOGLE_PROVIDER = "google";
const OAUTH2_REDIRECT_PLACEHOLDER = "urn:ietf:wg:oauth:2.0:oob";

@Injectable()
export class GoogleContactsSyncProvider {
  private readonly logger = new Logger(GoogleContactsSyncProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly contactUpsert: ContactUpsertService,
    private readonly contactLabels: ContactLabelsService,
  ) {}

  /** Lightweight People API probe before sync/import. */
  async assertCredentialsValid(userId: string): Promise<void> {
    try {
      const people = await this.getAuthorizedPeopleClient(userId);
      await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 1,
        personFields: "names",
      });
    } catch (error) {
      throw this.mapCredentialError(userId, error);
    }
  }

  /** Always runs a full import; never sends a stored sync token to Google. */
  async import(userId: string): Promise<ContactImportRun> {
    const stateRow = await this.peopleIntegrationState(userId);
    if (stateRow.syncToken != null) {
      await this.clearSyncToken(userId);
    }
    const skipped: ContactImportSkippedItem[] = [];
    const result = await this.runContactsSync(userId, false, {
      omitSyncToken: true,
      skipped,
    });
    return {
      stats: result.stats,
      skipped,
      completedAt: result.lastSyncAt ?? new Date(),
    };
  }

  async sync(userId: string): Promise<ContactSyncResponseDto> {
    try {
      return await this.runContactsSync(userId, false);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isInvalidSyncTokenError(error)) {
        this.logger.warn(
          `Google People sync token invalid for user ${userId}; falling back to full import`,
        );
        const run = await this.import(userId);
        const totalContacts = await this.contactUpsert.countActive(
          userId,
          ContactSource.GOOGLE,
        );
        return {
          source: ContactSource.GOOGLE,
          syncMode: "full",
          stats: run.stats,
          processedCount: syncStatsProcessedCount(run.stats),
          totalContacts,
          lastSyncAt: run.completedAt,
          recoveredFromExpiredToken: true,
        };
      }
      throw this.mapSyncError(userId, error);
    }
  }

  private async runContactsSync(
    userId: string,
    _recoveredFromExpiredToken: boolean,
    options?: {
      omitSyncToken?: boolean;
      skipped?: ContactImportSkippedItem[];
    },
  ): Promise<ContactSyncResponseDto> {
    const people = await this.getAuthorizedPeopleClient(userId);
    const stateRow = await this.peopleIntegrationState(userId);
    const activeSyncToken = options?.omitSyncToken ? null : stateRow.syncToken;
    const syncMode: "full" | "delta" = this.hasUsableSyncToken(activeSyncToken)
      ? "delta"
      : "full";
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    const connections: people_v1.Schema$Person[] = [];
    for (;;) {
      const res = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 100,
        pageToken,
        personFields:
          "names,emailAddresses,phoneNumbers,organizations,metadata,memberships",
        requestSyncToken: true,
        syncToken: activeSyncToken ?? undefined,
      });
      const pageConnections = res.data.connections ?? [];
      connections.push(...pageConnections);

      if (res.data.nextSyncToken) {
        nextSyncToken = res.data.nextSyncToken;
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) {
        break;
      }
    }

    const contactsToUpsert: NormalizedContact[] = [];
    for (const person of connections) {
      const parsed = tryGooglePersonForImport(person);
      if ("skipped" in parsed) {
        options?.skipped?.push(parsed.skipped);
      } else {
        contactsToUpsert.push(parsed.contact);
      }
    }

    const stats = await this.contactUpsert.upsertBatch(
      userId,
      contactsToUpsert,
    );

    await this.contactLabels.syncGoogleContactGroups(userId, connections);

    const updated = await this.prisma.integrationState.update({
      where: {
        userId_source: { userId, source: ContactSource.GOOGLE },
      },
      data: {
        ...(nextSyncToken ? { syncToken: nextSyncToken } : {}),
        lastSyncAt: new Date(),
        lastSyncAdded: stats.added,
        lastSyncUpdated: stats.updated,
        lastSyncDeleted: stats.deleted,
        lastSyncDuplicates: stats.duplicatesFound,
      },
    });
    const lastSyncAt = updated.lastSyncAt;

    const totalContacts = await this.contactUpsert.countActive(
      userId,
      ContactSource.GOOGLE,
    );

    return {
      source: ContactSource.GOOGLE,
      syncMode,
      stats,
      processedCount: syncStatsProcessedCount(stats),
      totalContacts,
      lastSyncAt,
    };
  }

  private buildOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
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

  private hasUsableSyncToken(syncToken: string | null | undefined): boolean {
    return typeof syncToken === "string" && syncToken.trim().length > 0;
  }

  private async clearSyncToken(userId: string): Promise<void> {
    await this.prisma.integrationState.updateMany({
      where: { userId, source: ContactSource.GOOGLE },
      data: { syncToken: null },
    });
  }

  private async peopleIntegrationState(userId: string) {
    return this.prisma.integrationState.upsert({
      where: {
        userId_source: { userId, source: ContactSource.GOOGLE },
      },
      create: { userId, source: ContactSource.GOOGLE },
      update: {},
    });
  }

  private googleErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === "object" && "response" in error) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (typeof status === "number") {
        return status;
      }
    }
    if (error && typeof error === "object" && "code" in error) {
      const code = error.code;
      if (typeof code === "number") {
        return code;
      }
    }
    return undefined;
  }

  private isInvalidSyncTokenError(error: unknown): boolean {
    return this.googleErrorStatus(error) === 410;
  }

  private mapCredentialError(userId: string, error: unknown): Error {
    if (error instanceof HttpException) {
      return error;
    }
    const status = this.googleErrorStatus(error);
    const message = error instanceof Error ? error.message : String(error);
    if (
      status === 401 ||
      status === 403 ||
      message.toLowerCase().includes("invalid_grant")
    ) {
      return new BadRequestException(
        "Google credentials are invalid or expired. Reconnect Google in settings and try again.",
      );
    }
    return this.mapSyncError(userId, error);
  }

  private mapSyncError(userId: string, error: unknown): Error {
    const status = this.googleErrorStatus(error);
    if (error instanceof HttpException) {
      return error;
    }
    if (status === 401 || status === 403) {
      return new BadRequestException(
        "Google authorization expired or was revoked. Reconnect your Google account.",
      );
    }
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Google contacts sync failed for user ${userId}: ${reason}`,
      error instanceof Error ? error.stack : undefined,
    );
    return new InternalServerErrorException("Google contacts sync failed");
  }
}
