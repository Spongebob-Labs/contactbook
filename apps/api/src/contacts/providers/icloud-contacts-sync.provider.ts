import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ContactImportRun } from "../contact-import-result.mapper";
import type { ContactSyncResponseDto } from "../dto/contact-sync-response.dto";

@Injectable()
export class IcloudContactsSyncProvider {
  sync(userId: string): Promise<ContactSyncResponseDto> {
    void userId;
    throw new NotImplementedException(
      "iCloud contact sync is not implemented yet. Use GET /contacts/import/google.",
    );
  }

  import(userId: string): Promise<ContactImportRun> {
    void userId;
    throw new NotImplementedException(
      "iCloud contact import is not implemented yet. Use POST /contacts/import/icloud when available.",
    );
  }
}
