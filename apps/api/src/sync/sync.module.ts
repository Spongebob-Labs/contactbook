import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappModule } from "../messaging/whatsapp.module";
import { SyncService } from "./sync.service";

@Module({
  imports: [PrismaModule, WhatsappModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
