import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { GoogleContactsSyncProvider } from "./providers/google-contacts-sync.provider";
import { IcloudContactsSyncProvider } from "./providers/icloud-contacts-sync.provider";

@Injectable()
export class ContactSourceCredentialsService {
  constructor(
    private readonly google: GoogleContactsSyncProvider,
    private readonly icloud: IcloudContactsSyncProvider,
  ) {}

  async assertValid(
    userId: string,
    source: typeof ContactSource.GOOGLE | typeof ContactSource.ICLOUD,
  ): Promise<void> {
    try {
      if (source === ContactSource.GOOGLE) {
        await this.google.assertCredentialsValid(userId);
      } else {
        await this.icloud.assertCredentialsValid(userId);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          source === ContactSource.GOOGLE
            ? "Google is not connected. Connect your Google account and try again."
            : "iCloud is not connected. Enter your Apple ID and app-specific password and try again.",
        );
      }
      throw error;
    }
  }
}
