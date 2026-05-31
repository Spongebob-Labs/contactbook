import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ContactSource, OAuthProvider } from "@prisma/client";
import {
  createDAVClient,
  DAVNamespaceShort,
  type DAVAddressBook,
  type DAVResponse,
  type DAVVCard,
} from "tsdav";
import { OAuthTokenService } from "../../oauth-tokens/oauth-token.service";
import type { DecryptedOAuthCredential } from "../../oauth-tokens/oauth-token.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  emptyContactSyncStats,
  syncStatsProcessedCount,
  type ContactSyncStats,
} from "../contact-sync-stats";
import { ContactUpsertService } from "../contact-upsert.service";
import { parseVcfImport } from "../vcard-contact.adapter";
import { ICLOUD_CARDDAV_REQUEST_TIMEOUT_MS } from "../icloud-import.constants";
import type { ContactImportRun } from "../contact-import-result.mapper";
import type { ContactImportSkippedItem } from "../contact-import-skipped.types";
import type { ContactSyncResponseDto } from "../dto/contact-sync-response.dto";
import type { NormalizedContact } from "../normalized-contact.types";

const ICLOUD_PROVIDER = "icloud";
const DEFAULT_ICLOUD_SERVER = "https://contacts.icloud.com";

type IcloudShardState = {
  serverBase: string;
  homeSetUrl: string;
};

type IcloudProviderState = {
  icloud?: IcloudShardState;
};

@Injectable()
export class IcloudContactsSyncProvider {
  private readonly logger = new Logger(IcloudContactsSyncProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly contactUpsert: ContactUpsertService,
  ) {}

  /** Probes CardDAV (fetch address books) before sync/import. */
  async assertCredentialsValid(userId: string): Promise<void> {
    const creds = await this.oauthTokenService.requireForUser(
      userId,
      ICLOUD_PROVIDER,
    );
    const appleId = creds.accessToken;
    const appPassword = creds.refreshToken;
    if (!appleId || !appPassword) {
      throw new BadRequestException(
        "iCloud credentials are incomplete. Re-enter your Apple ID and app-specific password and try again.",
      );
    }
    try {
      await this.connect(userId, creds);
    } catch (error) {
      throw this.mapCredentialError(userId, error);
    }
  }

  async connectForUser(userId: string): Promise<{
    client: Awaited<ReturnType<typeof createDAVClient>>;
    primaryBook: DAVAddressBook;
    serverBase: string;
  }> {
    const creds = await this.oauthTokenService.requireForUser(
      userId,
      ICLOUD_PROVIDER,
    );
    const appleId = creds.accessToken;
    const appPassword = creds.refreshToken;
    if (!appleId || !appPassword) {
      throw new Error("iCloud credentials are incomplete");
    }
    const { client, primaryBook } = await this.connect(userId, creds);
    const bookUrl = new URL(primaryBook.url);
    const serverBase = `${bookUrl.protocol}//${bookUrl.host}`;
    return { client, primaryBook, serverBase };
  }

  async import(userId: string): Promise<ContactImportRun> {
    const creds = await this.oauthTokenService.requireForUser(
      userId,
      ICLOUD_PROVIDER,
    );
    const appleId = creds.accessToken;
    const appPassword = creds.refreshToken;

    if (!appleId || !appPassword) {
      throw new BadRequestException(
        "iCloud credentials are incomplete or corrupt.",
      );
    }

    const stateRow = await this.icloudIntegrationState(userId);
    if (stateRow.syncToken != null) {
      await this.clearSyncToken(userId);
    }

    try {
      this.logger.log(`Starting iCloud full import for user ${userId}`);
      const { client, primaryBook } = await this.connect(userId, creds);
      this.logger.log(
        `Fetching vCards from iCloud address book for user ${userId}`,
      );
      const vcards = await client.fetchVCards({ addressBook: primaryBook });
      this.logger.log(
        `Fetched ${vcards.length} vCards from iCloud for user ${userId}`,
      );
      const { contacts, skipped } = this.mapVCardsToContacts(vcards);

      const syncToken = await this.fetchBaselineSyncToken(client, primaryBook);

      const stats =
        contacts.length > 0
          ? await this.contactUpsert.upsertBatch(userId, contacts)
          : emptyContactSyncStats();

      const completedAt = new Date();
      await this.updateSyncState(userId, syncToken, stats, completedAt);

      this.logger.log(
        `Completed iCloud full import for user ${userId}: added=${stats.added} updated=${stats.updated} skipped=${skipped.length}`,
      );

      return {
        stats,
        skipped,
        completedAt,
      };
    } catch (error) {
      throw this.mapImportError(userId, error);
    }
  }

  async sync(userId: string): Promise<ContactSyncResponseDto> {
    const creds = await this.oauthTokenService.requireForUser(
      userId,
      ICLOUD_PROVIDER,
    );
    const appleId = creds.accessToken;
    const appPassword = creds.refreshToken;

    if (!appleId || !appPassword) {
      throw new BadRequestException(
        "iCloud credentials are incomplete or corrupt.",
      );
    }

    const stateRow = await this.prisma.integrationState.findUnique({
      where: { userId_source: { userId, source: ContactSource.ICLOUD } },
    });

    if (!stateRow || !this.hasUsableSyncToken(stateRow.syncToken)) {
      const run = await this.import(userId);
      const totalContacts = await this.contactUpsert.countActive(
        userId,
        ContactSource.ICLOUD,
      );
      return {
        source: ContactSource.ICLOUD,
        syncMode: "full",
        stats: run.stats,
        processedCount: syncStatsProcessedCount(run.stats),
        totalContacts,
        lastSyncAt: run.completedAt,
      };
    }

    try {
      const { client, primaryBook } = await this.connect(userId, creds);
      const syncResult = await client.smartCollectionSync({
        collection: {
          ...primaryBook,
          syncToken: stateRow.syncToken ?? undefined,
        },
        detailedResult: true,
      });

      const changedVcards = [
        ...syncResult.objects.created,
        ...syncResult.objects.updated,
      ];
      const { contacts } = this.mapVCardsToContacts(changedVcards);

      let stats = emptyContactSyncStats();
      if (contacts.length > 0) {
        stats = await this.contactUpsert.upsertBatch(userId, contacts);
      }

      let deleted = 0;
      for (const obj of syncResult.objects.deleted) {
        const res = await this.prisma.contact.updateMany({
          where: {
            userId,
            source: ContactSource.ICLOUD,
            externalId: this.normalizeExternalId(obj.url),
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        deleted += res.count;
      }
      stats = { ...stats, deleted };

      const completedAt = new Date();
      await this.updateSyncState(
        userId,
        syncResult.syncToken ?? stateRow.syncToken,
        stats,
        completedAt,
      );

      const totalContacts = await this.contactUpsert.countActive(
        userId,
        ContactSource.ICLOUD,
      );

      return {
        source: ContactSource.ICLOUD,
        syncMode: "delta",
        stats,
        processedCount: syncStatsProcessedCount(stats),
        totalContacts,
        lastSyncAt: completedAt,
      };
    } catch (error) {
      if (this.isInvalidSyncTokenError(error)) {
        this.logger.warn(
          `iCloud CardDAV sync token invalid for user ${userId}; falling back to full import`,
        );
        const run = await this.import(userId);
        const totalContacts = await this.contactUpsert.countActive(
          userId,
          ContactSource.ICLOUD,
        );
        return {
          source: ContactSource.ICLOUD,
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

  private async connect(
    userId: string,
    creds: DecryptedOAuthCredential,
  ): Promise<{
    client: Awaited<ReturnType<typeof createDAVClient>>;
    primaryBook: DAVAddressBook;
  }> {
    const appleId = creds.accessToken!;
    const appPassword = creds.refreshToken;
    const cachedShard = this.readCachedShard(creds);
    const initialServer = cachedShard?.serverBase ?? DEFAULT_ICLOUD_SERVER;

    let client = await this.buildDAVClient(appleId, appPassword, initialServer);
    let addressBooks = await client.fetchAddressBooks();
    if (addressBooks.length === 0) {
      throw new BadRequestException("No iCloud address books discovered.");
    }

    let primaryBook = addressBooks[0];
    if (!cachedShard) {
      const discovered = this.discoverShardFromAddressBook(primaryBook);
      await this.persistShard(userId, creds, discovered);
      client = await this.buildDAVClient(
        appleId,
        appPassword,
        discovered.serverBase,
      );
      addressBooks = await client.fetchAddressBooks();
      if (addressBooks.length === 0) {
        throw new BadRequestException("No iCloud address books discovered.");
      }
      primaryBook = addressBooks[0];
    }

    return { client, primaryBook };
  }

  private cardDavFetch(): typeof fetch {
    const timeoutMs = ICLOUD_CARDDAV_REQUEST_TIMEOUT_MS;
    return (input, init) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
  }

  private async buildDAVClient(
    appleId: string,
    appPassword: string,
    serverUrl: string,
  ) {
    return createDAVClient({
      serverUrl,
      credentials: { username: appleId, password: appPassword },
      authMethod: "Basic",
      defaultAccountType: "carddav",
      fetch: this.cardDavFetch(),
    });
  }

  private discoverShardFromAddressBook(
    addressBook: DAVAddressBook,
  ): IcloudShardState & { providerAccountId: string } {
    const bookUrl = new URL(addressBook.url);
    const serverBase = `${bookUrl.protocol}//${bookUrl.host}`;
    const providerAccountId = bookUrl.pathname.split("/").filter(Boolean)[0];
    if (!providerAccountId) {
      throw new BadRequestException(
        "Could not determine iCloud account shard from address book URL.",
      );
    }
    return {
      serverBase,
      homeSetUrl: `/${providerAccountId}/carddav/`,
      providerAccountId,
    };
  }

  private readCachedShard(
    creds: DecryptedOAuthCredential,
  ): IcloudShardState | null {
    const state = creds.providerState as IcloudProviderState | null;
    return state?.icloud ?? null;
  }

  private async persistShard(
    userId: string,
    creds: DecryptedOAuthCredential,
    shard: IcloudShardState & { providerAccountId: string },
  ): Promise<void> {
    const existingState =
      (creds.providerState as Record<string, unknown> | null) ?? {};
    await this.prisma.oAuthAccount.update({
      where: {
        userId_provider: { userId, provider: OAuthProvider.ICLOUD },
      },
      data: {
        providerAccountId: shard.providerAccountId,
        providerState: {
          ...existingState,
          icloud: {
            serverBase: shard.serverBase,
            homeSetUrl: shard.homeSetUrl,
          },
        },
      },
    });
  }

  private normalizeExternalId(url: string): string {
    try {
      return new URL(url, DEFAULT_ICLOUD_SERVER).pathname;
    } catch {
      return url;
    }
  }

  private mapVCardsToContacts(vcards: DAVVCard[]): {
    contacts: NormalizedContact[];
    skipped: ContactImportSkippedItem[];
  } {
    const contacts: NormalizedContact[] = [];
    const skipped: ContactImportSkippedItem[] = [];

    for (const vcard of vcards) {
      const vcardData =
        typeof vcard.data === "string" ? vcard.data : String(vcard.data ?? "");
      if (!vcardData.trim()) {
        continue;
      }

      const parsed = parseVcfImport(vcardData);
      skipped.push(...parsed.skipped);

      if (parsed.contacts.length === 0) {
        continue;
      }

      const contact = parsed.contacts[0];
      contact.source = ContactSource.ICLOUD;
      contact.externalId = this.normalizeExternalId(vcard.url);
      contact.sourceRevision = vcard.etag ?? contact.sourceRevision ?? null;
      contacts.push(contact);
    }

    return { contacts, skipped };
  }

  private async fetchBaselineSyncToken(
    client: Awaited<ReturnType<typeof createDAVClient>>,
    addressBook: DAVAddressBook,
  ): Promise<string | undefined> {
    const responses = await client.syncCollection({
      url: addressBook.url,
      syncLevel: 1,
      props: {
        [`${DAVNamespaceShort.DAV}:getetag`]: {},
      },
    });
    return this.extractSyncToken(responses);
  }

  private extractSyncToken(responses: DAVResponse[]): string | undefined {
    for (const response of responses) {
      const token = (
        response as {
          raw?: { multistatus?: { syncToken?: string | { _text?: string } } };
        }
      ).raw?.multistatus?.syncToken;
      if (typeof token === "string" && token.trim().length > 0) {
        return token;
      }
      if (
        token &&
        typeof token === "object" &&
        typeof token._text === "string" &&
        token._text.trim().length > 0
      ) {
        return token._text;
      }
    }
    return undefined;
  }

  private async updateSyncState(
    userId: string,
    syncToken: string | null | undefined,
    stats: ContactSyncStats,
    completedAt: Date,
  ): Promise<void> {
    await this.prisma.integrationState.upsert({
      where: { userId_source: { userId, source: ContactSource.ICLOUD } },
      create: {
        userId,
        source: ContactSource.ICLOUD,
        syncToken: syncToken ?? null,
        lastSyncAt: completedAt,
        lastSyncAdded: stats.added,
        lastSyncUpdated: stats.updated,
        lastSyncDeleted: stats.deleted,
        lastSyncDuplicates: stats.duplicatesFound,
      },
      update: {
        syncToken: syncToken ?? null,
        lastSyncAt: completedAt,
        lastSyncAdded: stats.added,
        lastSyncUpdated: stats.updated,
        lastSyncDeleted: stats.deleted,
        lastSyncDuplicates: stats.duplicatesFound,
      },
    });
  }

  private hasUsableSyncToken(syncToken: string | null | undefined): boolean {
    return typeof syncToken === "string" && syncToken.trim().length > 0;
  }

  private async clearSyncToken(userId: string): Promise<void> {
    await this.prisma.integrationState.updateMany({
      where: { userId, source: ContactSource.ICLOUD },
      data: { syncToken: null },
    });
  }

  private async icloudIntegrationState(userId: string) {
    return this.prisma.integrationState.upsert({
      where: {
        userId_source: { userId, source: ContactSource.ICLOUD },
      },
      create: { userId, source: ContactSource.ICLOUD },
      update: {},
    });
  }

  private davErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === "object") {
      if ("status" in error && typeof error.status === "number") {
        return error.status;
      }
      if ("response" in error) {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        if (typeof status === "number") {
          return status;
        }
      }
    }
    return undefined;
  }

  private isInvalidSyncTokenError(error: unknown): boolean {
    const status = this.davErrorStatus(error);
    if (status === 403 || status === 409 || status === 412) {
      return true;
    }
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    return (
      message.includes("sync-token") ||
      message.includes("sync token") ||
      message.includes("invalid token")
    );
  }

  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return true;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("aborted") ||
      message.includes("socket hang up") ||
      message.includes("econnreset")
    );
  }

  private isAuthError(error: unknown): boolean {
    const status = this.davErrorStatus(error);
    return status === 401 || status === 403;
  }

  private mapCredentialError(
    userId: string,
    error: unknown,
  ): BadRequestException {
    if (error instanceof BadRequestException) {
      const message = error.message.toLowerCase();
      if (
        message.includes("authorization") ||
        message.includes("credentials") ||
        message.includes("password")
      ) {
        return new BadRequestException(
          "iCloud credentials are invalid. Re-enter your Apple ID and app-specific password and try again.",
        );
      }
      return error;
    }
    if (this.isAuthError(error)) {
      return new BadRequestException(
        "iCloud credentials are invalid. Re-enter your Apple ID and app-specific password and try again.",
      );
    }
    return this.mapImportError(userId, error);
  }

  private mapImportError(userId: string, error: unknown): BadRequestException {
    if (error instanceof BadRequestException) {
      return error;
    }
    if (this.isAuthError(error)) {
      return new BadRequestException(
        "iCloud authorization failed. Verify your Apple ID and app-specific password.",
      );
    }
    if (this.isTimeoutError(error)) {
      return new BadRequestException(
        "iCloud contact import timed out. Try again; large address books can take several minutes.",
      );
    }
    this.logger.error(
      `iCloud Contacts full import failed for user ${userId}`,
      error instanceof Error ? error.stack : error,
    );
    return new BadRequestException(
      "Could not connect to iCloud CardDAV. Please verify credentials.",
    );
  }

  private mapSyncError(userId: string, error: unknown): Error {
    if (error instanceof BadRequestException) {
      return error;
    }
    if (this.isAuthError(error)) {
      return new BadRequestException(
        "iCloud authorization failed. Verify your Apple ID and app-specific password.",
      );
    }
    if (this.isTimeoutError(error)) {
      return new BadRequestException(
        "iCloud contact sync timed out. Try again later.",
      );
    }
    this.logger.error(
      `iCloud Contacts delta sync failed for user ${userId}`,
      error instanceof Error ? error.stack : error,
    );
    return new InternalServerErrorException(
      "iCloud contacts incremental sync failed.",
    );
  }
}
