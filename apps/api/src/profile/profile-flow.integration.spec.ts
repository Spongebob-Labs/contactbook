import { BadRequestException, ConflictException } from "@nestjs/common";
import { FieldCategory } from "@prisma/client";
import { ProfileDeletableGroupCategory } from "./dto/profile-deletable-group-category.enum";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import {
  identityOnlyOnboarding,
  onboardingWithEmptyShells,
  onboardingWithPersonalAndWorkFull,
  registrationIdentity,
} from "../../test/fixtures/profile-payloads";
import {
  addPersonalGroupWithPhone,
  addWorkGroup,
  createProfileUpsertMocks,
} from "../../test/helpers/profile-upsert-mocks";

type UserUpdateCall = [{ where: { id: string }; data: { firstName?: string } }];

describe("Profile flow (integration, mocked persistence)", () => {
  function createSvc(mocks = createProfileUpsertMocks()) {
    const svc = new ProfileMeUpsertService(
      mocks.prisma as never,
      mocks.persistence as never,
      mocks.serializer as never,
    );
    return { svc, mocks };
  }

  it("completes identity-only onboarding and sets profileOnboardingCompletedAt", async () => {
    const { svc, mocks } = createSvc();
    await svc.completeOnboarding(mocks.userId, identityOnlyOnboarding);

    const identityUpdate = (
      mocks.prisma.user.update.mock.calls as UserUpdateCall[]
    ).find(
      ([arg]) => arg.where.id === mocks.userId && arg.data.firstName === "Jane",
    );
    expect(identityUpdate).toBeDefined();
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: mocks.userId },
      data: { profileOnboardingCompletedAt: expect.any(Date) as Date },
    });
    expect(mocks.persistence.createGroup).not.toHaveBeenCalled();
  });

  it("onboarding creates work and personal groups from sections", async () => {
    const { svc, mocks } = createSvc();
    await svc.completeOnboarding(
      mocks.userId,
      onboardingWithPersonalAndWorkFull,
    );

    expect(mocks.persistence.createGroup).toHaveBeenCalledWith(
      mocks.userId,
      FieldCategory.WORK,
      "Acme",
    );
    expect(mocks.persistence.createGroup).toHaveBeenCalledWith(
      mocks.userId,
      FieldCategory.PERSONAL,
      "Primary Personal",
    );
    expect(mocks.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects repeat onboarding when already completed", async () => {
    const mocks = createProfileUpsertMocks();
    mocks.prisma.user.findUnique.mockResolvedValue({
      profileOnboardingCompletedAt: new Date(),
    });
    const { svc } = createSvc(mocks);
    await expect(
      svc.completeOnboarding(mocks.userId, identityOnlyOnboarding),
    ).rejects.toThrow(ConflictException);
  });

  it("applies identity correction during onboarding", async () => {
    const { svc, mocks } = createSvc();
    await svc.completeOnboarding(mocks.userId, {
      identity: { ...registrationIdentity, firstName: "Janet" },
    });
    const identityUpdate = (
      mocks.prisma.user.update.mock.calls as UserUpdateCall[]
    ).find(
      ([arg]) =>
        arg.where.id === mocks.userId && arg.data.firstName === "Janet",
    );
    expect(identityUpdate).toBeDefined();
  });

  it("ignores empty work and personal shells on onboarding", async () => {
    const { svc, mocks } = createSvc();
    await svc.completeOnboarding(mocks.userId, onboardingWithEmptyShells);
    expect(mocks.persistence.createGroup).not.toHaveBeenCalled();
  });

  it("patches business after onboarding then deletes work group", async () => {
    const mocks = createProfileUpsertMocks();
    addWorkGroup(mocks, "work-1", "Acme");
    const { svc } = createSvc(mocks);

    await svc.patch(mocks.userId, {
      business: [{ tag: "Biz", businessName: "Startup LLC" }],
    });
    expect(mocks.persistence.createGroup).toHaveBeenCalledWith(
      mocks.userId,
      FieldCategory.BUSINESS,
      "Biz",
    );

    mocks.persistence.findGroup.mockResolvedValue({
      id: "work-1",
      category: FieldCategory.WORK,
    });
    await svc.deleteGroup(mocks.userId, {
      groupId: "work-1",
      category: ProfileDeletableGroupCategory.WORK,
    });
    expect(mocks.persistence.deleteGroup).toHaveBeenCalledWith(
      mocks.userId,
      "work-1",
    );
    expect(mocks.groups.find((g) => g.id === "work-1")).toBeUndefined();
  });

  it("clears personal mobile with null without deleting landline", async () => {
    const mocks = createProfileUpsertMocks();
    addPersonalGroupWithPhone(mocks);
    const { svc } = createSvc(mocks);

    await svc.patch(mocks.userId, { personal: { mobile: null } });
    expect(mocks.persistence.deleteField).toHaveBeenCalledWith(
      mocks.userId,
      "phone-1",
    );
    expect(mocks.persistence.deleteField).not.toHaveBeenCalledWith(
      mocks.userId,
      "land-1",
    );
  });

  it("rejects patch with invalid primaryPhone", async () => {
    const { svc, mocks } = createSvc();
    await expect(
      svc.patch(mocks.userId, { identity: { primaryPhone: "bad" } }),
    ).rejects.toThrow(BadRequestException);
  });
});
