import { BadRequestException, ConflictException } from "@nestjs/common";
import { FieldCategory, FieldType } from "@prisma/client";
import { ProfileDeletableGroupCategory } from "./dto/profile-deletable-group-category.enum";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import { sanitizeProfilePayload } from "./profile-me.payload.util";

const registrationIdentity = {
  firstName: "Jane",
  lastName: "Doe",
  primaryEmail: "jane@example.com",
  primaryPhone: "+12025551234",
};

describe("sanitizeProfilePayload", () => {
  it("omits empty work array", () => {
    const out = sanitizeProfilePayload({ work: [] });
    expect(out.work).toBeUndefined();
  });

  it("omits empty personal shell without explicit null field clears", () => {
    const out = sanitizeProfilePayload({
      personal: { tag: "", postalAddress: {} },
    });
    expect(out.personal).toBeUndefined();
  });

  it("keeps personal when explicit null clears a field", () => {
    const out = sanitizeProfilePayload({
      personal: { mobile: null },
    });
    expect(out.personal).toEqual({ mobile: null });
  });
});

describe("ProfileMeUpsertService", () => {
  const userId = "user-1";
  let prisma: {
    user: {
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    fieldGroup: {
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
    profileField: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let persistence: {
    loadGroups: jest.Mock;
    createGroup: jest.Mock;
    updateGroupName: jest.Mock;
    syncGroupFields: jest.Mock;
    deleteGroup: jest.Mock;
    upsertFieldById: jest.Mock;
    createField: jest.Mock;
    deleteField: jest.Mock;
    findGroup: jest.Mock;
  };
  let serializer: { build: jest.Mock };

  const emptyProfileResponse = {
    profileOnboardingCompletedAt: null,
    identity: registrationIdentity,
    personal: { groupId: "", tag: "" },
    work: [],
    business: [],
    socials: [],
    financial: {
      bankAccounts: [],
      digitalWallets: [],
      cryptoWallets: [],
    },
  };

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "2025551234",
          countryCode: "+1",
          profileOnboardingCompletedAt: null,
        }),
      },
      fieldGroup: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      profileField: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn((fn: (p: typeof prisma) => unknown) => fn(prisma)),
    };
    persistence = {
      loadGroups: jest.fn().mockResolvedValue([]),
      createGroup: jest.fn().mockResolvedValue({
        id: "new-group",
        userId,
        category: FieldCategory.WORK,
        name: "Acme",
      }),
      updateGroupName: jest.fn().mockResolvedValue(undefined),
      syncGroupFields: jest.fn().mockResolvedValue([]),
      deleteGroup: jest.fn().mockResolvedValue(undefined),
      upsertFieldById: jest.fn().mockResolvedValue("field-1"),
      createField: jest.fn().mockResolvedValue("new-field"),
      deleteField: jest.fn().mockResolvedValue(undefined),
      findGroup: jest.fn().mockResolvedValue({
        id: "g1",
        category: FieldCategory.WORK,
      }),
    };
    serializer = {
      build: jest.fn().mockResolvedValue(emptyProfileResponse),
    };
  });

  it("creates work group when groupId omitted", async () => {
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      work: [{ tag: "Acme", companyName: "Acme", workTitle: "Dev" }],
    });
    expect(persistence.createGroup).toHaveBeenCalledWith(
      userId,
      FieldCategory.WORK,
      "Acme",
    );
    expect(persistence.syncGroupFields).toHaveBeenCalled();
  });

  it("does not delete work groups when work is an empty array", async () => {
    persistence.loadGroups.mockResolvedValue([
      {
        id: "work-1",
        userId,
        category: FieldCategory.WORK,
        name: "Acme",
        updatedAt: new Date(),
        fields: [],
      },
    ]);
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, { work: [] });
    expect(persistence.deleteGroup).not.toHaveBeenCalled();
  });

  it("updates identity user fields", async () => {
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      identity: { firstName: "Jane", lastName: "Doe" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { firstName: "Jane", lastName: "Doe" },
    });
  });

  it("updates financial row by fieldId", async () => {
    persistence.loadGroups.mockResolvedValue([
      {
        id: "fg-fin",
        userId,
        category: FieldCategory.FINANCIAL,
        name: "Banking",
        fields: [
          {
            id: "bank-field-1",
            type: FieldType.BANK_ACCOUNT,
            groupId: "fg-fin",
          },
        ],
      },
    ]);
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, {
      financial: {
        bankAccounts: [
          {
            fieldId: "bank-field-1",
            groupId: "fg-fin",
            tag: "Banking",
            bankName: "HDFC",
            accountHolder: "Jane",
            accountNumber: "123",
            currency: "INR",
          },
        ],
      },
    });
    expect(persistence.upsertFieldById).toHaveBeenCalledWith(
      userId,
      "bank-field-1",
      expect.objectContaining({ type: FieldType.BANK_ACCOUNT }),
    );
  });

  it("deletes a work group by id and category", async () => {
    persistence.findGroup.mockResolvedValue({
      id: "work-1",
      category: FieldCategory.WORK,
    });
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.deleteGroup(userId, {
      groupId: "work-1",
      category: ProfileDeletableGroupCategory.WORK,
    });
    expect(persistence.deleteGroup).toHaveBeenCalledWith(userId, "work-1");
    expect(serializer.build).toHaveBeenCalledWith(userId);
  });

  it("rejects delete when category does not match group", async () => {
    persistence.findGroup.mockResolvedValue({
      id: "work-1",
      category: FieldCategory.WORK,
    });
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await expect(
      svc.deleteGroup(userId, {
        groupId: "work-1",
        category: ProfileDeletableGroupCategory.BUSINESS,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("clears personal phone with null without reconcile-wiping landline", async () => {
    persistence.loadGroups.mockResolvedValue([
      {
        id: "p1",
        userId,
        category: FieldCategory.PERSONAL,
        name: "Primary",
        updatedAt: new Date(),
        fields: [
          {
            id: "phone-1",
            type: FieldType.PHONE,
            groupId: "p1",
            label: null,
          },
          {
            id: "land-1",
            type: FieldType.LANDLINE,
            groupId: "p1",
            label: null,
          },
        ],
      },
    ]);
    const svc = new ProfileMeUpsertService(
      prisma as never,
      persistence as never,
      serializer as never,
    );
    await svc.patch(userId, { personal: { mobile: null } });
    expect(persistence.deleteField).toHaveBeenCalledWith(userId, "phone-1");
    expect(persistence.deleteField).not.toHaveBeenCalledWith(userId, "land-1");
    expect(persistence.syncGroupFields).not.toHaveBeenCalled();
  });

  describe("completeOnboarding", () => {
    it("returns 409 when onboarding already completed", async () => {
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "5551234567",
        countryCode: "+1",
        profileOnboardingCompletedAt: new Date(),
      });
      const svc = new ProfileMeUpsertService(
        prisma as never,
        persistence as never,
        serializer as never,
      );
      await expect(
        svc.completeOnboarding(userId, {
          identity: registrationIdentity,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("completes identity-only onboarding and sets completedAt", async () => {
      const svc = new ProfileMeUpsertService(
        prisma as never,
        persistence as never,
        serializer as never,
      );
      const applySpy = jest.spyOn(svc as never, "apply" as never);

      await svc.completeOnboarding(userId, {
        identity: registrationIdentity,
        work: [],
      });

      expect(applySpy).toHaveBeenCalledWith(userId, {
        identity: {
          firstName: "Jane",
          lastName: "Doe",
          primaryEmail: "jane@example.com",
          primaryPhone: "+12025551234",
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          profileOnboardingCompletedAt: expect.any(Date) as Date,
        },
      });
    });

    it("applies identity updates during onboarding", async () => {
      const svc = new ProfileMeUpsertService(
        prisma as never,
        persistence as never,
        serializer as never,
      );
      const applySpy = jest.spyOn(svc as never, "apply" as never);

      await svc.completeOnboarding(userId, {
        identity: { ...registrationIdentity, firstName: "Janet" },
      });

      expect(applySpy).toHaveBeenCalledWith(userId, {
        identity: {
          firstName: "Janet",
          lastName: "Doe",
          primaryEmail: "jane@example.com",
          primaryPhone: "+12025551234",
        },
      });
    });

    it("requires identity on onboarding", async () => {
      const svc = new ProfileMeUpsertService(
        prisma as never,
        persistence as never,
        serializer as never,
      );
      await expect(
        svc.completeOnboarding(
          userId,
          {} as Parameters<ProfileMeUpsertService["completeOnboarding"]>[1],
        ),
      ).rejects.toThrow("identity is required");
    });

    it("initializes profile via apply when sections are present", async () => {
      const svc = new ProfileMeUpsertService(
        prisma as never,
        persistence as never,
        serializer as never,
      );
      const applySpy = jest.spyOn(svc as never, "apply" as never);

      await svc.completeOnboarding(userId, {
        identity: {
          ...registrationIdentity,
          profilePhoto: "https://example.com/photo.jpg",
        },
        personal: { tag: "Primary Personal", mobile: "+12025551234" },
      });

      expect(applySpy).toHaveBeenCalledWith(userId, {
        personal: { tag: "Primary Personal", mobile: "+12025551234" },
        identity: {
          firstName: "Jane",
          lastName: "Doe",
          primaryEmail: "jane@example.com",
          primaryPhone: "+12025551234",
          profilePhoto: "https://example.com/photo.jpg",
        },
      });
    });
  });
});
