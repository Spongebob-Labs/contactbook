import { Test, TestingModule } from "@nestjs/testing";
import { ProfileController } from "../../src/profile/profile.controller";
import { ProfileMeSerializerService } from "../../src/profile/profile-me.serializer";
import { ProfileMeUpsertService } from "../../src/profile/profile-me.upsert.service";
import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { mockJwtGuard } from "./mock-jwt.guard";

export type ProfileControllerTestOverrides = {
  upsert?: Partial<ProfileMeUpsertService>;
  serializer?: Partial<ProfileMeSerializerService>;
  useRealJwtGuard?: boolean;
};

export async function createProfileControllerTestModule(
  overrides: ProfileControllerTestOverrides = {},
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    controllers: [ProfileController],
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
    ],
  });

  if (!overrides.useRealJwtGuard) {
    builder.overrideGuard(JwtAuthGuard).useValue(mockJwtGuard);
  }

  return builder.compile();
}
