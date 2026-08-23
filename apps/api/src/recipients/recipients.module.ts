import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecipientsController } from './recipients.controller';
import { RecipientsService } from './recipients.service';

@Module({
  imports: [AuthModule], // for JwtAuthGuard
  controllers: [RecipientsController],
  providers: [RecipientsService],
  exports: [RecipientsService], // SharingModule upserts a recipient when minting a share link
})
export class RecipientsModule {}
