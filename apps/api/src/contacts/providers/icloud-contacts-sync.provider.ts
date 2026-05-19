import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ContactSyncResponseDto } from "../dto/contact-sync-response.dto";

@Injectable()
export class IcloudContactsSyncProvider {
  sync(userId: string): Promise<ContactSyncResponseDto> {
    void userId;
    throw new NotImplementedException(
      "iCloud contact sync is not implemented yet. Use source=GOOGLE.",
    );
  }

  import(userId: string): Promise<ContactSyncResponseDto> {
    void userId;
    throw new NotImplementedException(
      "iCloud contact import is not implemented yet. Use source=GOOGLE.",
    );
  }
}
