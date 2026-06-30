import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { WhatsappModule } from "../messaging/whatsapp.module";

@Module({
  imports: [WhatsappModule],
  controllers: [HealthController],
})
export class HealthModule {}
