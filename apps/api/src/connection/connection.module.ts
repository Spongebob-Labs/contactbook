import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { TwilioNestModule } from "../integration/twilio.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ConnectionController } from "./connection.controller";
import { ConnectionInviteService } from "./connection-invite.service";
import { ConnectionShareService } from "./connection-share.service";
import { ConnectionService } from "./connection.service";

@Module({
  imports: [PrismaModule, TwilioNestModule, ContactsModule],
  controllers: [ConnectionController],
  providers: [
    ConnectionService,
    ConnectionInviteService,
    ConnectionShareService,
  ],
  exports: [ConnectionService, ConnectionInviteService, ConnectionShareService],
})
export class ConnectionModule {}
