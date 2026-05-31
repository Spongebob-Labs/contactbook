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
      upsert: jest
        .fn()
        .mockResolvedValue({ syncToken: null, lastSyncAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        lastSyncAt: new Date("2026-05-19T00:00:00Z"),
      }),
    },
  };

  const contactUpsert = {
    upsertBatch: jest.fn().mockResolvedValue({
      added: 1,
      updated: 0,
      deleted: 0,
      duplicatesFound: 0,
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

  const contactLabels = {
    syncGoogleContactGroups: jest.fn().mockResolvedValue(undefined),
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
    jest
      .spyOn(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require("googleapis") as { google: { people: jest.Mock } }).google,
        "people",
      )
      .mockReturnValue(peopleClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("import runs full sync without syncToken in API request", async () => {
    prisma.integrationState.upsert.mockResolvedValue({
      syncToken: null,
      lastSyncAt: null,
    });

    const provider = new GoogleContactsSyncProvider(
      prisma as never,
      config as never,
      oauthTokenService as never,
      contactUpsert as never,
      contactLabels as never,
    );

    const result = await provider.import(userId);

    expect(result.stats.added).toBeGreaterThanOrEqual(0);
    expect(result.skipped).toEqual([]);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(contactUpsert.upsertBatch).toHaveBeenCalledWith(
      userId,
      expect.arrayContaining([
        expect.objectContaining({
          source: ContactSource.GOOGLE,
          externalId: "people/1",
        }),
      ]),
    );
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        syncToken: undefined,
        requestSyncToken: true,
      }),
    );
    expect(prisma.integrationState.updateMany).not.toHaveBeenCalled();
  });

  it("import clears blank sync token then runs full sync", async () => {
    prisma.integrationState.upsert.mockResolvedValue({
      syncToken: "   ",
      lastSyncAt: null,
    });

    const provider = new GoogleContactsSyncProvider(
      prisma as never,
      config as never,
      oauthTokenService as never,
      contactUpsert as never,
      contactLabels as never,
    );

    await provider.import(userId);

    expect(prisma.integrationState.updateMany).toHaveBeenCalledWith({
      where: { userId, source: ContactSource.GOOGLE },
      data: { syncToken: null },
    });
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ syncToken: undefined }),
    );
  });

  it("import always runs full sync even when a sync token exists", async () => {
    prisma.integrationState.upsert.mockResolvedValue({
      syncToken: "existing-token",
      lastSyncAt: new Date("2026-05-18T00:00:00Z"),
    });

    const provider = new GoogleContactsSyncProvider(
      prisma as never,
      config as never,
      oauthTokenService as never,
      contactUpsert as never,
      contactLabels as never,
    );

    await provider.import(userId);

    expect(prisma.integrationState.updateMany).toHaveBeenCalledWith({
      where: { userId, source: ContactSource.GOOGLE },
      data: { syncToken: null },
    });
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ syncToken: undefined }),
    );
  });

  it("sync falls back to full import on 410 and sets recoveredFromExpiredToken", async () => {
    prisma.integrationState.upsert.mockResolvedValue({
      syncToken: "expired-token",
      lastSyncAt: new Date("2026-05-18T00:00:00Z"),
    });
    listMock.mockRejectedValueOnce(apiError(410)).mockResolvedValueOnce({
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
      contactLabels as never,
    );

    const result = await provider.sync(userId);
    expect(result.recoveredFromExpiredToken).toBe(true);
    expect(result.syncMode).toBe("full");
    expect(contactUpsert.upsertBatch).toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(2);
    const calls = listMock.mock.calls as Array<
      [{ syncToken?: string }] | undefined
    >;
    const firstListArgs = calls[0]?.[0];
    const secondListArgs = calls[1]?.[0];
    expect(firstListArgs).toEqual(
      expect.objectContaining({ syncToken: "expired-token" }),
    );
    expect(secondListArgs).toEqual(
      expect.objectContaining({ syncToken: undefined }),
    );
  });
});
