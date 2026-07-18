import { BadRequestException, ConflictException } from "@nestjs/common";
import { CardType, FieldCategory, ProfileField } from "@prisma/client";
import { ProfileDeletableGroupCategory } from "./dto/profile-deletable-group-category.enum";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import type { GroupWithFields } from "./profile-me.flatten";
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

  it("onboarding automatically creates personal, work and business cards", async () => {
    const { svc, mocks } = createSvc();

    const mockIdentityField = {
      id: "field-identity-1",
    } as unknown as ProfileField;
    const mockPersonalField = {
      id: "field-personal-1",
    } as unknown as ProfileField;
    const mockSocialField = { id: "field-social-1" } as unknown as ProfileField;
    const mockWorkField = { id: "field-work-1" } as unknown as ProfileField;
    const mockBusinessField = {
      id: "field-business-1",
    } as unknown as ProfileField;

    mocks.groups.push(
      {
        id: "g-id",
        category: FieldCategory.IDENTITY,
        name: "Identity",
        fields: [mockIdentityField],
      },
      {
        id: "g-pers",
        category: FieldCategory.PERSONAL,
        name: "Personal Details",
        fields: [mockPersonalField],
      },
      {
        id: "g-soc",
        category: FieldCategory.SOCIAL,
        name: "Social Profiles",
        fields: [mockSocialField],
      },
      {
        id: "g-work",
        category: FieldCategory.WORK,
        name: "My Company",
        fields: [mockWorkField],
      },
      {
        id: "g-biz",
        category: FieldCategory.BUSINESS,
        name: "My Business",
        fields: [mockBusinessField],
      },
    );

    await svc.completeOnboarding(
      mocks.userId,
      onboardingWithPersonalAndWorkFull,
    );

    // Verify Personal card was created
    expect(mocks.prisma.contactCard.create).toHaveBeenCalledWith({
      data: {
        userId: mocks.userId,
        name: "Personal",
        type: CardType.PERSONAL,
      },
    });

    // Verify Personal card mappings were created (for Identity, Personal, Social fields)
    expect(mocks.prisma.cardFieldMapping.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        {
          cardId: expect.any(String) as never,
          fieldId: "field-identity-1",
        },
        {
          cardId: expect.any(String) as never,
          fieldId: "field-personal-1",
        },
        {
          cardId: expect.any(String) as never,
          fieldId: "field-social-1",
        },
      ]) as unknown,
    });

    // Verify Work card was created
    expect(mocks.prisma.contactCard.create).toHaveBeenCalledWith({
      data: {
        userId: mocks.userId,
        name: "My Company",
        type: CardType.BUSINESS,
      },
    });

    // Verify Work card mappings were created
    expect(mocks.prisma.cardFieldMapping.createMany).toHaveBeenCalledWith({
      data: [
        {
          cardId: expect.any(String) as never,
          fieldId: "field-work-1",
        },
      ],
    });

    // Verify Business card was created
    expect(mocks.prisma.contactCard.create).toHaveBeenCalledWith({
      data: {
        userId: mocks.userId,
        name: "My Business",
        type: CardType.BUSINESS,
      },
    });

    // Verify Business card mappings were created
    expect(mocks.prisma.cardFieldMapping.createMany).toHaveBeenCalledWith({
      data: [
        {
          cardId: expect.any(String) as never,
          fieldId: "field-business-1",
        },
      ],
    });
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
