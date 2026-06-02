import { BadRequestException, Injectable } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { ContactSourceCredentialsService } from "./contact-source-credentials.service";
import { toContactImportResult } from "./contact-import-result.mapper";
import type { ContactImportResultDto } from "./dto/contact-import-result.dto";
import type { ContactSyncResponseDto } from "./dto/contact-sync-response.dto";
import { GoogleContactsSyncProvider } from "./providers/google-contacts-sync.provider";
import { IcloudContactsSyncProvider } from "./providers/icloud-contacts-sync.provider";

const SYNC_SOURCES: ContactSource[] = [
  ContactSource.GOOGLE,
  ContactSource.ICLOUD,
];

@Injectable()
export class ContactsSyncService {
  constructor(
    private readonly google: GoogleContactsSyncProvider,
    private readonly icloud: IcloudContactsSyncProvider,
    private readonly credentials: ContactSourceCredentialsService,
  ) {}

  async sync(
    userId: string,
    source: ContactSource,
  ): Promise<ContactSyncResponseDto> {
    return this.runForSource(userId, source);
  }

  async import(
    userId: string,
    source: ContactSource,
  ): Promise<ContactImportResultDto> {
    if (!SYNC_SOURCES.includes(source)) {
      throw new BadRequestException(
        `Sync is not supported for source ${source}. Use GOOGLE or ICLOUD.`,
      );
    }
    await this.credentials.assertValid(
      userId,
      source as typeof ContactSource.GOOGLE | typeof ContactSource.ICLOUD,
    );
    if (source === ContactSource.GOOGLE) {
      return toContactImportResult(await this.google.import(userId));
    }
    return toContactImportResult(await this.icloud.import(userId));
  }

  private async runForSource(
    userId: string,
    source: ContactSource,
  ): Promise<ContactSyncResponseDto> {
    if (!SYNC_SOURCES.includes(source)) {
      throw new BadRequestException(
        `Sync is not supported for source ${source}. Use GOOGLE or ICLOUD.`,
      );
    }
    await this.credentials.assertValid(
      userId,
      source as typeof ContactSource.GOOGLE | typeof ContactSource.ICLOUD,
    );
    if (source === ContactSource.GOOGLE) {
      return this.google.sync(userId);
    }
    return this.icloud.sync(userId);
  }
}
