import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [AuthModule], // for JwtAuthGuard
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService], // SharingModule looks up a contact when minting a share link
})
export class ContactsModule {}
