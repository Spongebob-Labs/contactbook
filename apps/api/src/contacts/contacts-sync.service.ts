import { BadRequestException, Injectable } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
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
  ) {}

  async sync(
    userId: string,
    source: ContactSource,
  ): Promise<ContactSyncResponseDto> {
    return this.runForSource(userId, source, "sync");
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
    if (source === ContactSource.GOOGLE) {
      return toContactImportResult(await this.google.import(userId));
    }
    return toContactImportResult(await this.icloud.import(userId));
  }

  private async runForSource(
    userId: string,
    source: ContactSource,
    operation: "sync" | "import",
  ): Promise<ContactSyncResponseDto> {
    if (!SYNC_SOURCES.includes(source)) {
      throw new BadRequestException(
        `Sync is not supported for source ${source}. Use GOOGLE or ICLOUD.`,
      );
    }
    if (source === ContactSource.GOOGLE) {
      return this.google.sync(userId);
    }
    return this.icloud.sync(userId);
  }
}
