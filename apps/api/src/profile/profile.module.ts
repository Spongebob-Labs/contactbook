import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfilePhotoStorageService } from './profile-photo-storage.service';
import { ProfileService } from './profile.service';
import { ProfileOnboardingService } from './profile-onboarding.service';

@Module({
  imports: [AuthModule], // for JwtAuthGuard
  controllers: [ProfileController],
  providers: [
    ProfileService,
    ProfilePhotoStorageService,
    ProfileOnboardingService,
  ],
  // The agent module (apps/api/src/agent) wraps these as LangGraph
  // tools and needs them injectable across the module boundary.
  // The HTTP controller is the only other consumer and doesn't mind
  // sharing the export.
  exports: [ProfileService, ProfileOnboardingService],
})
export class ProfileModule {}
