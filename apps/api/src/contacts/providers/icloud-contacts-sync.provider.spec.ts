import { BadRequestException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { createDAVClient } from "tsdav";
import { IcloudContactsSyncProvider } from "./icloud-contacts-sync.provider";

jest.mock("tsdav", () => ({
  createDAVClient: jest.fn(),
  DAVNamespaceShort: { DAV: "DAV", CARDDAV: "CARDDAV" },
}));

const SAMPLE_VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "UID:icloud-test-1",
  "FN:Jane Doe",
  "TEL:+15550001111",
  "END:VCARD",
].join("\r\n");

function makeClient(overrides?: Partial<Record<string, jest.Mock>>) {
  return {
    fetchAddressBooks: jest.fn().mockResolvedValue([
      {
        url: "https://p12-contacts.icloud.com/12345678/carddav/addressbooks/contacts/",
        displayName: "Contacts",
      },
    ]),
    fetchVCards: jest.fn().mockResolvedValue([
      {
        url: "https://p12-contacts.icloud.com/12345678/carddav/addressbooks/contacts/abc.vcf",
        data: SAMPLE_VCARD,
        etag: "etag-1",
      },
    ]),
    syncCollection: jest.fn().mockResolvedValue([
      {
        raw: {
          multistatus: {
            syncToken: "baseline-token",
          },
        },
      },
    ]),
    smartCollectionSync: jest.fn(),
    ...overrides,
  };
}

describe("IcloudContactsSyncProvider", () => {
  const userId = "user-1";

  const prisma = {
    integrationState: {
      upsert: jest
        .fn()
        .mockResolvedValue({ syncToken: null, lastSyncAt: null }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    oAuthAccount: {
      update: jest.fn().mockResolvedValue({}),
    },
    contact: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  const oauthTokenService = {
    requireForUser: jest.fn().mockResolvedValue({
      accessToken: "user@icloud.com",
      refreshToken: "abcd-efgh-ijkl-mnop",
      providerState: null,
      providerAccountId: null,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.integrationState.findUnique.mockResolvedValue(null);
    (createDAVClient as jest.Mock).mockImplementation(() => makeClient());
  });

  function provider() {
    return new IcloudContactsSyncProvider(
      prisma as never,
      oauthTokenService as never,
      contactUpsert as never,
    );
  }

  it("import fetches vCards, caches shard metadata, and stores baseline sync token", async () => {
    const result = await provider().import(userId);

    expect(result.stats.added).toBe(1);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(contactUpsert.upsertBatch).toHaveBeenCalledWith(
      userId,
      expect.arrayContaining([
        expect.objectContaining({
          source: ContactSource.ICLOUD,
          externalId: "/12345678/carddav/addressbooks/contacts/abc.vcf",
          displayName: "Jane Doe",
        }),
      ]),
    );
    expect(prisma.oAuthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerAccountId: "12345678",
          providerState: expect.objectContaining({
            icloud: {
              serverBase: "https://p12-contacts.icloud.com",
              homeSetUrl: "/12345678/carddav/",
            },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      }),
    );
    expect(prisma.integrationState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          syncToken: "baseline-token",
        }) as Record<string, unknown>,
      }),
    );
  });

  it("import clears an existing sync token before full import", async () => {
    prisma.integrationState.upsert.mockResolvedValue({
      syncToken: "old-token",
      lastSyncAt: null,
    });

    await provider().import(userId);

    expect(prisma.integrationState.updateMany).toHaveBeenCalledWith({
      where: { userId, source: ContactSource.ICLOUD },
      data: { syncToken: null },
    });
  });

  it("import maps auth failures to BadRequestException", async () => {
    (createDAVClient as jest.Mock).mockImplementation(() =>
      makeClient({
        fetchAddressBooks: jest.fn().mockRejectedValue({ status: 401 }),
      }),
    );

    await expect(provider().import(userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("import maps CardDAV timeouts to BadRequestException", async () => {
    const timeoutError = new Error("The operation was aborted");
    timeoutError.name = "AbortError";
    (createDAVClient as jest.Mock).mockImplementation(() =>
      makeClient({
        fetchVCards: jest.fn().mockRejectedValue(timeoutError),
      }),
    );

    await expect(provider().import(userId)).rejects.toThrow(/timed out/i);
  });

  it("sync falls back to full import when no sync token exists", async () => {
    prisma.integrationState.findUnique.mockResolvedValue(null);

    const result = await provider().sync(userId);

    expect(result.syncMode).toBe("full");
    expect(result.source).toBe(ContactSource.ICLOUD);
    expect(contactUpsert.upsertBatch).toHaveBeenCalled();
  });

  it("sync performs delta sync with smartCollectionSync", async () => {
    prisma.integrationState.findUnique.mockResolvedValue({
      syncToken: "delta-token",
    });
    (createDAVClient as jest.Mock).mockImplementation(() =>
      makeClient({
        smartCollectionSync: jest.fn().mockResolvedValue({
          syncToken: "next-token",
          objects: {
            created: [
              {
                url: "https://p12-contacts.icloud.com/12345678/carddav/addressbooks/contacts/new.vcf",
                data: SAMPLE_VCARD,
                etag: "etag-2",
              },
            ],
            updated: [],
            deleted: [
              {
                url: "https://p12-contacts.icloud.com/12345678/carddav/addressbooks/contacts/old.vcf",
              },
            ],
          },
        }),
      }),
    );

    const result = await provider().sync(userId);

    expect(result.syncMode).toBe("delta");
    expect(result.stats.added).toBe(1);
    expect(result.stats.deleted).toBe(1);
    expect(prisma.contact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalId: "/12345678/carddav/addressbooks/contacts/old.vcf",
        }) as Record<string, unknown>,
      }),
    );
  });

  it("sync falls back to full import on invalid sync token", async () => {
    prisma.integrationState.findUnique.mockResolvedValue({
      syncToken: "stale-token",
    });
    (createDAVClient as jest.Mock).mockImplementation(() =>
      makeClient({
        smartCollectionSync: jest
          .fn()
          .mockRejectedValue(new Error("Invalid sync-token")),
      }),
    );

    const result = await provider().sync(userId);

    expect(result.recoveredFromExpiredToken).toBe(true);
    expect(result.syncMode).toBe("full");
    expect(contactUpsert.upsertBatch).toHaveBeenCalled();
  });
});
