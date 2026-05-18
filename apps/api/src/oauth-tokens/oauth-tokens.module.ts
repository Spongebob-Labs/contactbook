import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { OAuthTokenService } from "./oauth-token.service";

@Module({
  imports: [PrismaModule],
  providers: [OAuthTokenService],
  exports: [OAuthTokenService],
})
export class OAuthTokensModule {}
