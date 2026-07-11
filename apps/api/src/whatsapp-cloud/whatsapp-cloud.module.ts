import { Module } from "@nestjs/common";
import { WhatsappCloudController } from "./whatsapp-cloud.controller";

@Module({
  controllers: [WhatsappCloudController],
})
export class WhatsappCloudModule {}
