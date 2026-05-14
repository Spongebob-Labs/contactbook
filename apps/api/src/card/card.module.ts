import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SyncModule } from "../sync/sync.module";
import { CardController } from "./card.controller";
import { CardService } from "./card.service";

@Module({
  imports: [PrismaModule, SyncModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
