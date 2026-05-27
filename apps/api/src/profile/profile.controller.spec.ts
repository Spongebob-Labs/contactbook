import {
  ConflictException,
  HttpStatus,
  INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { createProfileControllerTestModule } from "../../test/helpers/create-profile-test-module";
import { RejectJwtAuthGuard } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import {
  deleteWorkGroupDto,
  fullOnboardingPayload,
  identityOnlyOnboarding,
  onboardingRejectsReadOnlyTimestamp,
  onboardingWithInvalidWorkGroupId,
  onboardingWithPersonalAndWork,
  onboardingWithPersonalAndWorkFull,
  TEST_USER_ID,
} from "../../test/fixtures/profile-payloads";
import { emptyProfileMeResponse } from "../../test/fixtures/profile-responses";
import { ProfileController } from "./profile.controller";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfilePhotoService } from "./profile-photo.service";

describe("ProfileController (HTTP)", () => {
  let app: INestApplication;
  let upsert: {
    completeOnboarding: jest.Mock;
    patch: jest.Mock;
    deleteGroup: jest.Mock;
  };
  let serializer: { build: jest.Mock };
  let profilePhoto: { upload: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    upsert = {
      completeOnboarding: jest.fn().mockResolvedValue(emptyProfileMeResponse),
      patch: jest.fn().mockResolvedValue(emptyProfileMeResponse),
      deleteGroup: jest.fn().mockResolvedValue(emptyProfileMeResponse),
    };
    serializer = {
      build: jest.fn().mockResolvedValue(emptyProfileMeResponse),
    };
    profilePhoto = {
      upload: jest.fn().mockResolvedValue({
        profilePhoto: "https://storage.example.com/p.jpg",
      }),
      remove: jest.fn().mockResolvedValue({ profilePhoto: null }),
    };

    const moduleRef = await createProfileControllerTestModule({
      upsert,
      serializer,
      profilePhoto,
    });
    app = moduleRef.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /profile/onboarding rejects empty identity object with 400", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send({ identity: {} })
      .expect(HttpStatus.BAD_REQUEST);
    expect(upsert.completeOnboarding).not.toHaveBeenCalled();
  });

  it("POST /profile/onboarding accepts identity-only with 201", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(identityOnlyOnboarding)
      .expect(HttpStatus.CREATED);
    expect(upsert.completeOnboarding).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ identity: identityOnlyOnboarding.identity }),
    );
  });

  it("POST /profile/onboarding forwards personal and work sections", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(onboardingWithPersonalAndWork)
      .expect(HttpStatus.CREATED);
    expect(upsert.completeOnboarding).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({
        personal: onboardingWithPersonalAndWork.personal,
        work: onboardingWithPersonalAndWork.work,
      }),
    );
  });

  it("POST /profile/onboarding accepts flattened work and financial fields with 201", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(onboardingWithPersonalAndWorkFull)
      .expect(HttpStatus.CREATED);
    expect(upsert.completeOnboarding).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({
        work: [
          expect.objectContaining({
            companyName: "Acme Corp",
            workTitle: "Engineer",
          }),
        ],
      }),
    );
  });

  it("POST /profile/onboarding accepts full GET-shaped payload with 201", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(fullOnboardingPayload)
      .expect(HttpStatus.CREATED);
    expect(upsert.completeOnboarding).toHaveBeenCalledWith(
      TEST_USER_ID,
      fullOnboardingPayload,
    );
  });

  it("POST /profile/onboarding rejects profileOnboardingCompletedAt with 400", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(onboardingRejectsReadOnlyTimestamp)
      .expect(HttpStatus.BAD_REQUEST);
    expect(upsert.completeOnboarding).not.toHaveBeenCalled();
  });

  it("POST /profile/onboarding rejects invalid work groupId UUID", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(onboardingWithInvalidWorkGroupId)
      .expect(HttpStatus.BAD_REQUEST);
    expect(upsert.completeOnboarding).not.toHaveBeenCalled();
  });

  it("POST /profile/onboarding maps ConflictException to 409", async () => {
    upsert.completeOnboarding.mockRejectedValue(
      new ConflictException("Profile already initialized"),
    );
    await request(app.getHttpServer() as never)
      .post("/api/v1/profile/onboarding")
      .send(identityOnlyOnboarding)
      .expect(HttpStatus.CONFLICT);
  });

  it("GET /profile/me returns 200 and builds profile", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/profile/me")
      .expect(HttpStatus.OK);
    expect(serializer.build).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("PATCH /profile/me forwards body to patch service", async () => {
    const body = { personal: { tag: "Primary", mobile: "+12025551234" } };
    await request(app.getHttpServer() as never)
      .patch("/api/v1/profile/me")
      .send(body)
      .expect(HttpStatus.OK);
    expect(upsert.patch).toHaveBeenCalledWith(TEST_USER_ID, body);
  });

  it("DELETE /profile/me/groups forwards delete DTO", async () => {
    await request(app.getHttpServer() as never)
      .delete("/api/v1/profile/me/groups")
      .send(deleteWorkGroupDto)
      .expect(HttpStatus.OK);
    expect(upsert.deleteGroup).toHaveBeenCalledWith(
      TEST_USER_ID,
      deleteWorkGroupDto,
    );
  });

  it("DELETE /profile/me/groups rejects invalid groupId", async () => {
    await request(app.getHttpServer() as never)
      .delete("/api/v1/profile/me/groups")
      .send({
        groupId: "not-a-uuid",
        category: deleteWorkGroupDto.category,
      })
      .expect(HttpStatus.BAD_REQUEST);
    expect(upsert.deleteGroup).not.toHaveBeenCalled();
  });
});

describe("ProfileController auth", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const profileModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileMeUpsertService,
          useValue: {
            completeOnboarding: jest.fn(),
            patch: jest.fn(),
            deleteGroup: jest.fn(),
          },
        },
        {
          provide: ProfileMeSerializerService,
          useValue: {
            build: jest.fn().mockResolvedValue(emptyProfileMeResponse),
          },
        },
        {
          provide: ProfilePhotoService,
          useValue: {
            upload: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new RejectJwtAuthGuard())
      .compile();

    app = profileModule.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /profile/me returns 401 when guard rejects", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/profile/me")
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
