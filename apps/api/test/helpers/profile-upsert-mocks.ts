import { FieldCategory, FieldType } from "@prisma/client";
import type { GroupWithFields } from "../../src/profile/profile-me.flatten";
import { registrationIdentity } from "../fixtures/profile-payloads";
import { emptyProfileMeResponse } from "../fixtures/profile-responses";

export const defaultUserId = "user-1";

export type ProfileUpsertMocks = {
  userId: string;
  groups: GroupWithFields[];
  prisma: {
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
    contactCard: {
      create: jest.Mock;
    };
    cardFieldMapping: {
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  persistence: {
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
  serializer: { build: jest.Mock };
};

function mockUserRow(userId: string) {
  return {
    id: userId,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "2025551234",
    countryCode: "+1",
    profileOnboardingCompletedAt: null as Date | null,
  };
}

export function createProfileUpsertMocks(
  userId = defaultUserId,
): ProfileUpsertMocks {
  const groups: GroupWithFields[] = [];
  const userRow = mockUserRow(userId);

  const prisma: ProfileUpsertMocks["prisma"] = {
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockImplementation(
        (args: {
          where: {
            id?: string;
            email?: string;
            countryCode_phone?: { countryCode: string; phone: string };
          };
          select?: Record<string, boolean>;
        }) => {
          if (args.where?.id === userId) {
            if (args.select) {
              return Promise.resolve(
                Object.fromEntries(
                  Object.entries(args.select)
                    .filter(([, include]) => include)
                    .map(([key]) => [
                      key,
                      userRow[key as keyof typeof userRow],
                    ]),
                ),
              );
            }
            return Promise.resolve({ ...userRow });
          }
          if (args.where?.email !== undefined) {
            return Promise.resolve(null);
          }
          if (args.where?.countryCode_phone !== undefined) {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        },
      ),
    },
    fieldGroup: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(groups)),
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
    contactCard: {
      create: jest.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: `card-${Math.random().toString(36).substring(2, 9)}`,
          ...args.data,
        }),
      ),
    },
    cardFieldMapping: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (p: ProfileUpsertMocks["prisma"]) => unknown) => fn(prisma),
  );

  const persistence = {
    loadGroups: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(groups.map((g) => ({ ...g, fields: [...g.fields] }))),
      ),
    createGroup: jest.fn(
      (uid: string, category: FieldCategory, name: string): GroupWithFields => {
        const createdAt = new Date();
        const created = {
          id: `group-${groups.length + 1}`,
          userId: uid,
          category,
          name,
          createdAt,
          updatedAt: createdAt,
          fields: [],
        } as unknown as GroupWithFields;
        groups.push(created);
        return created as GroupWithFields;
      },
    ),
    updateGroupName: jest.fn().mockResolvedValue(undefined),
    syncGroupFields: jest.fn().mockResolvedValue([]),
    deleteGroup: jest.fn().mockImplementation((uid: string, id: string) => {
      const idx = groups.findIndex((g) => g.id === id && g.userId === uid);
      if (idx >= 0) {
        groups.splice(idx, 1);
      }
    }),
    upsertFieldById: jest.fn().mockResolvedValue("field-1"),
    createField: jest.fn().mockResolvedValue("new-field"),
    deleteField: jest.fn().mockResolvedValue(undefined),
    findGroup: jest
      .fn()
      .mockImplementation(
        (uid: string, groupId: string, category: FieldCategory) => {
          const g = groups.find(
            (x) =>
              x.id === groupId && x.userId === uid && x.category === category,
          );
          if (!g) {
            throw new Error("group not found");
          }
          return { id: g.id, category: g.category };
        },
      ),
  };

  const serializer = {
    build: jest.fn().mockResolvedValue({
      ...emptyProfileMeResponse,
      identity: registrationIdentity,
    }),
  };

  const result: ProfileUpsertMocks = {
    userId,
    groups,
    prisma,
    persistence,
    serializer,
  };
  return result;
}

export function addWorkGroup(
  mocks: ProfileUpsertMocks,
  id = "work-1",
  name = "Acme",
): GroupWithFields {
  const createdAt = new Date();
  const g = {
    id,
    userId: mocks.userId,
    category: FieldCategory.WORK,
    name,
    createdAt,
    updatedAt: createdAt,
    fields: [],
  } as unknown as GroupWithFields;
  mocks.groups.push(g);
  return g;
}

export function addPersonalGroupWithPhone(
  mocks: ProfileUpsertMocks,
  phoneFieldId = "phone-1",
  landlineFieldId = "land-1",
): GroupWithFields {
  const g: GroupWithFields = {
    id: "p1",
    userId: mocks.userId,
    category: FieldCategory.PERSONAL,
    name: "Primary",
    updatedAt: new Date(),
    fields: [
      {
        id: phoneFieldId,
        type: FieldType.PHONE,
        groupId: "p1",
        label: null,
      },
      {
        id: landlineFieldId,
        type: FieldType.LANDLINE,
        groupId: "p1",
        label: null,
      },
    ],
  } as GroupWithFields;
  mocks.groups.push(g);
  return g;
}
