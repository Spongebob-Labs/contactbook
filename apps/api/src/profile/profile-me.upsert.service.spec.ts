import { BadRequestException, ConflictException } from "@nestjs/common";
import { FieldCategory, FieldType } from "@prisma/client";
import { ProfileDeletableGroupCategory } from "./dto/profile-deletable-group-category.enum";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import { registrationIdentity } from "../../test/fixtures/profile-payloads";
import {
  createProfileUpsertMocks,
  type ProfileUpsertMocks,
} from "../../test/helpers/profile-upsert-mocks";

describe("ProfileMeUpsertService", () => {
  let mocks: ProfileUpsertMocks;

  function svc() {
    return new ProfileMeUpsertService(
      mocks.prisma as never,
      mocks.persistence as never,
      mocks.serializer as never,
    );
  }

  beforeEach(() => {
    mocks = createProfileUpsertMocks();
  });

  it("creates work group when groupId omitted", async () => {
    await svc().patch(mocks.userId, {
      work: [{ tag: "Acme", companyName: "Acme", workTitle: "Dev" }],
    });
    expect(mocks.persistence.createGroup).toHaveBeenCalledWith(
      mocks.userId,
      FieldCategory.WORK,
      "Acme",
    );
    expect(mocks.persistence.syncGroupFields).toHaveBeenCalled();
  });

  it("does not delete work groups when work is an empty array", async () => {
    mocks.groups.push({
      id: "work-1",
      userId: mocks.userId,
      category: FieldCategory.WORK,
      name: "Acme",
      updatedAt: new Date(),
      fields: [],
    });
    await svc().patch(mocks.userId, { work: [] });
    expect(mocks.persistence.deleteGroup).not.toHaveBeenCalled();
  });

  it("updates identity user fields", async () => {
    await svc().patch(mocks.userId, {
      identity: { firstName: "Jane", lastName: "Doe" },
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: mocks.userId },
      data: { firstName: "Jane", lastName: "Doe" },
    });
  });

  it("updates financial row by fieldId", async () => {
    mocks.groups.push({
      id: "fg-fin",
      userId: mocks.userId,
      category: FieldCategory.FINANCIAL,
      name: "Banking",
      updatedAt: new Date(),
      fields: [
        {
          id: "bank-field-1",
          type: FieldType.BANK_ACCOUNT,
          groupId: "fg-fin",
        },
      ],
    });
    await svc().patch(mocks.userId, {
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
    expect(mocks.persistence.upsertFieldById).toHaveBeenCalledWith(
      mocks.userId,
      "bank-field-1",
      expect.objectContaining({ type: FieldType.BANK_ACCOUNT }),
    );
  });

  it.each([
    ProfileDeletableGroupCategory.WORK,
    ProfileDeletableGroupCategory.BUSINESS,
    ProfileDeletableGroupCategory.SOCIAL,
    ProfileDeletableGroupCategory.FINANCIAL,
  ])("deletes group for category %s", async (category) => {
    const fieldCategory =
      category === ProfileDeletableGroupCategory.WORK
        ? FieldCategory.WORK
        : category === ProfileDeletableGroupCategory.BUSINESS
          ? FieldCategory.BUSINESS
          : category === ProfileDeletableGroupCategory.SOCIAL
            ? FieldCategory.SOCIAL
            : FieldCategory.FINANCIAL;
    mocks.persistence.findGroup.mockResolvedValue({
      id: "g-del",
      category: fieldCategory,
    });
    await svc().deleteGroup(mocks.userId, {
      groupId: "g-del",
      category,
    });
    expect(mocks.persistence.deleteGroup).toHaveBeenCalledWith(
      mocks.userId,
      "g-del",
    );
  });

  it("rejects delete when category does not match group", async () => {
    mocks.persistence.findGroup.mockResolvedValue({
      id: "work-1",
      category: FieldCategory.WORK,
    });
    await expect(
      svc().deleteGroup(mocks.userId, {
        groupId: "work-1",
        category: ProfileDeletableGroupCategory.BUSINESS,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe("completeOnboarding", () => {
    it("returns 409 when onboarding already completed", async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        profileOnboardingCompletedAt: new Date(),
      });
      await expect(
        svc().completeOnboarding(mocks.userId, {
          identity: registrationIdentity,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("requires identity on onboarding", async () => {
      await expect(
        svc().completeOnboarding(
          mocks.userId,
          {} as Parameters<ProfileMeUpsertService["completeOnboarding"]>[1],
        ),
      ).rejects.toThrow("identity is required");
    });

    it("returns 409 when primaryEmail is already used by another user", async () => {
      mocks.prisma.user.findUnique.mockImplementation(
        (args: {
          where: { id?: string; email?: string };
          select?: Record<string, boolean>;
        }) => {
          if (args.where?.id === mocks.userId) {
            return Promise.resolve({
              email: "jane@example.com",
              phone: "2025551234",
              countryCode: "+1",
            });
          }
          if (args.where?.email === "taken@example.com") {
            return Promise.resolve({ id: "other-user" });
          }
          return Promise.resolve(null);
        },
      );
      await expect(
        svc().completeOnboarding(mocks.userId, {
          identity: {
            ...registrationIdentity,
            primaryEmail: "taken@example.com",
          },
        }),
      ).rejects.toThrow(ConflictException);
      expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });

    it("creates financial bank row on onboarding", async () => {
      await svc().completeOnboarding(mocks.userId, {
        identity: registrationIdentity,
        financial: {
          bankAccounts: [
            {
              tag: "Primary Bank",
              bankName: "HDFC",
              accountHolder: "Jane",
              accountNumber: "123456",
              currency: "INR",
            },
          ],
        },
      });
      expect(mocks.persistence.createGroup).toHaveBeenCalledWith(
        mocks.userId,
        FieldCategory.FINANCIAL,
        "Primary Bank",
      );
    });
  });
});
