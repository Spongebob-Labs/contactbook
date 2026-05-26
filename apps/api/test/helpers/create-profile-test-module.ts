import { Test, TestingModule } from "@nestjs/testing";
import { ProfileController } from "../../src/profile/profile.controller";
import { PhotoController } from "../../src/profile/photo.controller";
import { ProfileMeSerializerService } from "../../src/profile/profile-me.serializer";
import { ProfileMeUpsertService } from "../../src/profile/profile-me.upsert.service";
import { ProfilePhotoService } from "../../src/profile/profile-photo.service";
import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { mockJwtGuard } from "./mock-jwt.guard";

export type ProfileControllerTestOverrides = {
  upsert?: Partial<ProfileMeUpsertService>;
  serializer?: Partial<ProfileMeSerializerService>;
  profilePhoto?: Partial<ProfilePhotoService>;
  useRealJwtGuard?: boolean;
};

export async function createProfileControllerTestModule(
  overrides: ProfileControllerTestOverrides = {},
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    controllers: [ProfileController, PhotoController],
    providers: [
      {
        provide: ProfileMeUpsertService,
        useValue: {
          completeOnboarding: jest.fn(),
          patch: jest.fn(),
          deleteGroup: jest.fn(),
          ...overrides.upsert,
        },
      },
      {
        provide: ProfileMeSerializerService,
        useValue: {
          build: jest.fn(),
          ...overrides.serializer,
        },
      },
      {
        provide: ProfilePhotoService,
        useValue: {
          upload: jest.fn(),
          remove: jest.fn(),
          ...overrides.profilePhoto,
        },
      },
    ],
  });

  if (!overrides.useRealJwtGuard) {
    builder.overrideGuard(JwtAuthGuard).useValue(mockJwtGuard);
  }

  return builder.compile();
}
