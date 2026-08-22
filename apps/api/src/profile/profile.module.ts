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
})
export class ProfileModule {}
