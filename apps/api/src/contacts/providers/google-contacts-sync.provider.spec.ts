import { ContactSource } from "@prisma/client";
import { GoogleContactsSyncProvider } from "./google-contacts-sync.provider";

function apiError(status: number) {
  return { response: { status } };
}

describe("GoogleContactsSyncProvider", () => {
  const userId = "user-1";
  let listMock: jest.Mock;
  let peopleClient: { people: { connections: { list: jest.Mock } } };

  const prisma = {
    integrationState: {
      upsert: jest.fn().mockResolvedValue({ syncToken: null, lastSyncAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        lastSyncAt: new Date("2026-05-19T00:00:00Z"),
      }),
    },
  };

  const contactUpsert = {
    upsert: jest.fn().mockResolvedValue({
      outcome: "added",
      duplicateFound: false,
      contact: { id: "c1" },
    }),
    countActive: jest.fn().mockResolvedValue(1),
  };

  const config = {
    get: jest.fn((key: string) =>
      key === "GOOGLE_CLIENT_ID" || key === "GOOGLE_CLIENT_SECRET"
        ? "x"
        : undefined,
    ),
  };

  const oauthTokenService = {
    requireForUser: jest.fn().mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      scope: "scope",
    }),
    updateAccessToken: jest.fn(),
    upsertForUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    listMock = jest.fn().mockResolvedValue({
      data: {
        connections: [
          {
            resourceName: "people/1",
            names: [{ displayName: "A", metadata: { primary: true } }],
            emailAddresses: [],
            phoneNumbers: [],
            organizations: [],
          },
        ],
        nextSyncToken: "new-token",
      },
    });
    peopleClient = { people: { connections: { list: listMock } } };
    jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("googleapis").google,
      "people",
    ).mockReturnValue(peopleClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retries full sync on 410 and sets recoveredFromExpiredToken", async () => {
    listMock
      .mockRejectedValueOnce(apiError(410))
      .mockResolvedValueOnce({
        data: {
          connections: [],
          nextSyncToken: "tok",
        },
      });

    const provider = new GoogleContactsSyncProvider(
      prisma as never,
      config as never,
      oauthTokenService as never,
      contactUpsert as never,
    );

    const result = await provider.sync(userId);
    expect(prisma.integrationState.updateMany).toHaveBeenCalledWith({
      where: { userId, source: ContactSource.GOOGLE },
      data: { syncToken: null },
    });
    expect(result.recoveredFromExpiredToken).toBe(true);
    expect(result.syncMode).toBe("full");
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
