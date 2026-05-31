import { ContactSource } from "@prisma/client";
import { ContactSourceWritebackService } from "./contact-source-writeback.service";

describe("ContactSourceWritebackService", () => {
  const prisma = {
    contact: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    integrationState: { updateMany: jest.fn() },
  };
  const oauthTokenService = { requireForUser: jest.fn() };
  const icloud = { connectForUser: jest.fn() };

  const svc = new ContactSourceWritebackService(
    prisma as never,
    oauthTokenService as never,
    icloud as never,
  );

  const userId = "user-1";
  const contactId = "contact-1";

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.integrationState.updateMany.mockResolvedValue({ count: 1 });
  });

  it("writeBackIcloud updates vCard via CardDAV", async () => {
    const updateVCard = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"new-etag"' }),
    });
    const fetchVCards = jest.fn().mockResolvedValue([
      {
        url: "https://p12-contacts.icloud.com/1/card/a.vcf",
        data: "BEGIN:VCARD\nVERSION:3.0\nFN:Old\nEND:VCARD",
        etag: '"old-etag"',
      },
    ]);
    icloud.connectForUser.mockResolvedValue({
      client: { fetchVCards, updateVCard },
      primaryBook: { url: "https://p12-contacts.icloud.com/1/card/" },
      serverBase: "https://p12-contacts.icloud.com",
    });
    prisma.contact.findFirst.mockResolvedValue({
      id: contactId,
      source: ContactSource.ICLOUD,
      externalId: "/1/card/a.vcf",
      sourceRevision: '"old-etag"',
      firstName: "Jane",
      lastName: "Doe",
      displayName: "Jane Doe",
      notes: null,
      phones: [],
      emails: [],
      organizations: [],
    });

    await svc.writeBackContact(userId, contactId);

    expect(updateVCard).toHaveBeenCalledWith(
      expect.objectContaining({
        vCard: expect.objectContaining({
          etag: '"old-etag"',
          url: "https://p12-contacts.icloud.com/1/card/a.vcf",
        }) as unknown,
      }),
    );
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: contactId },
      data: { sourceRevision: '"new-etag"' },
    });
    expect(prisma.integrationState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastWriteBackError: null }) as unknown,
      }),
    );
  });
});
