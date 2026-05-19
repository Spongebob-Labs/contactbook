import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ContactSerializer } from "./contact.serializer";
import { ContactUpsertService } from "./contact-upsert.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactSerializer, ContactUpsertService],
  exports: [ContactUpsertService, ContactsService, ContactSerializer],
})
export class ContactsModule {}
