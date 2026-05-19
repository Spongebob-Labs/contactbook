import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ContactSyncResponseDto } from "../dto/contact-sync-response.dto";

@Injectable()
export class IcloudContactsSyncProvider {
  sync(_userId: string): Promise<ContactSyncResponseDto> {
    throw new NotImplementedException(
      "iCloud contact sync is not implemented yet. Use source=GOOGLE.",
    );
  }
}
