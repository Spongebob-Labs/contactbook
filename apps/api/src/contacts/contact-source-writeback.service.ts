import { Injectable, Logger } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { google } from "googleapis";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";
import { PrismaService } from "../prisma/prisma.service";
import { IcloudContactsSyncProvider } from "./providers/icloud-contacts-sync.provider";
import {
  buildIcloudResourceUrl,
  patchVcardFromContact,
} from "./vcard-writeback.util";

const GOOGLE_PROVIDER = "google";
const GOOGLE_WRITE_SCOPE = "https://www.googleapis.com/auth/contacts";

@Injectable()
export class ContactSourceWritebackService {
  private readonly logger = new Logger(ContactSourceWritebackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly icloud: IcloudContactsSyncProvider,
  ) {}

  hasGoogleWriteScope(scope: string | null | undefined): boolean {
    return (scope ?? "").includes(GOOGLE_WRITE_SCOPE);
  }

  async writeBackContact(userId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
      include: {
        phones: { orderBy: { sortOrder: "asc" } },
        emails: { orderBy: { sortOrder: "asc" } },
        organizations: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!contact) {
      return;
    }
    if (
      contact.source !== ContactSource.GOOGLE &&
      contact.source !== ContactSource.ICLOUD
    ) {
      return;
    }
    if (!contact.externalId) {
      return;
    }

    try {
      if (contact.source === ContactSource.GOOGLE) {
        await this.writeBackGoogle(userId, contact);
      } else {
        await this.writeBackIcloud(userId, contact);
      }
      await this.recordSuccess(userId, contact.source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordFailure(userId, contact.source, message);
      this.logger.warn(
        `Write-back failed for contact ${contactId} (${contact.source}): ${message}`,
      );
    }
  }

  private async writeBackGoogle(
    userId: string,
    contact: {
      externalId: string;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      notes: string | null;
      phones: Array<{ value: string; label: string | null }>;
      emails: Array<{ value: string; label: string | null }>;
      organizations: Array<{
        companyName: string | null;
        title: string | null;
      }>;
    },
  ): Promise<void> {
    const credential = await this.oauthTokenService.requireForUser(
      userId,
      GOOGLE_PROVIDER,
    );
    if (!this.hasGoogleWriteScope(credential.scope)) {
      throw new Error("Google contacts write scope not granted");
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "urn:ietf:wg:oauth:2.0:oob",
    );
    oauth2.setCredentials({
      access_token: credential.accessToken ?? undefined,
      refresh_token: credential.refreshToken,
    });
    const people = google.people({ version: "v1", auth: oauth2 });

    const givenName = contact.firstName ?? undefined;
    const familyName = contact.lastName ?? undefined;
    const person: Record<string, unknown> = {
      names: [
        {
          givenName,
          familyName,
          displayName: contact.displayName ?? undefined,
        },
      ],
      phoneNumbers: contact.phones.map((p) => ({
        value: p.value,
        type: p.label ?? undefined,
      })),
      emailAddresses: contact.emails.map((e) => ({
        value: e.value,
        type: e.label ?? undefined,
      })),
      organizations: contact.organizations.map((o) => ({
        name: o.companyName ?? undefined,
        title: o.title ?? undefined,
      })),
      biographies: contact.notes
        ? [{ value: contact.notes, contentType: "TEXT_PLAIN" }]
        : undefined,
    };

    await people.people.updateContact({
      resourceName: contact.externalId,
      updatePersonFields:
        "names,phoneNumbers,emailAddresses,organizations,biographies",
      requestBody: person,
    });
  }

  private async writeBackIcloud(
    userId: string,
    contact: {
      id: string;
      externalId: string;
      sourceRevision: string | null;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      notes: string | null;
      phones: Array<{ value: string; label: string | null }>;
      emails: Array<{ value: string; label: string | null }>;
      organizations: Array<{
        companyName: string | null;
        title: string | null;
      }>;
    },
  ): Promise<void> {
    const { client, primaryBook, serverBase } =
      await this.icloud.connectForUser(userId);
    const resourceUrl = buildIcloudResourceUrl(serverBase, contact.externalId);

    const vcards = await client.fetchVCards({ addressBook: primaryBook });
    const existing = vcards.find((v) => {
      if (!v.url) {
        return false;
      }
      try {
        return (
          new URL(v.url, serverBase).pathname === contact.externalId ||
          v.url === resourceUrl
        );
      } catch {
        return v.url.includes(contact.externalId);
      }
    });

    if (!existing?.data) {
      throw new Error(
        `iCloud vCard not found for external id ${contact.externalId}`,
      );
    }

    const vcardData =
      typeof existing.data === "string"
        ? existing.data
        : String(existing.data ?? "");
    const updatedData = patchVcardFromContact(vcardData, contact);
    const etag = contact.sourceRevision ?? existing.etag ?? undefined;

    const response = await client.updateVCard({
      vCard: {
        data: updatedData,
        url: existing.url ?? resourceUrl,
        etag,
      },
    });

    if (response.status === 412) {
      throw new Error(
        "iCloud contact was modified elsewhere; write-back conflict (412)",
      );
    }
    if (!response.ok) {
      throw new Error(
        `iCloud updateVCard failed with status ${response.status}`,
      );
    }

    const newEtag = response.headers.get("etag");
    if (newEtag) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { sourceRevision: newEtag },
      });
    }
  }

  private async recordSuccess(
    userId: string,
    source: ContactSource,
  ): Promise<void> {
    await this.prisma.integrationState.updateMany({
      where: { userId, source },
      data: { lastWriteBackAt: new Date(), lastWriteBackError: null },
    });
  }

  private async recordFailure(
    userId: string,
    source: ContactSource,
    message: string,
  ): Promise<void> {
    await this.prisma.integrationState.updateMany({
      where: { userId, source },
      data: { lastWriteBackError: message.slice(0, 500) },
    });
  }
}
