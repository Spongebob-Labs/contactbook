import { BadRequestException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { VcardContactsImportService } from "./vcard-contacts-import.service";

const SAMPLE_VCF = Buffer.from(
  [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "UID:import-1",
    "FN:Import Test",
    "TEL:+15551234567",
    "END:VCARD",
  ].join("\r\n"),
  "utf8",
);

describe("VcardContactsImportService", () => {
  const prisma = {
    integrationState: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const contactUpsert = {
    upsertBatch: jest.fn().mockResolvedValue({
      added: 1,
      updated: 0,
      deleted: 0,
      duplicatesFound: 0,
    }),
  };
  const contactLabels = {
    applyVcfCategories: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new VcardContactsImportService(
    prisma as never,
    contactUpsert as never,
    contactLabels as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imports contacts and updates integration state", async () => {
    const run = await svc.importFromFile("user-1", {
      buffer: SAMPLE_VCF,
      size: SAMPLE_VCF.length,
      originalname: "contacts.vcf",
      mimetype: "text/vcard",
    } as Express.Multer.File);

    expect(run.stats.added).toBe(1);
    expect(run.skipped).toEqual([]);
    expect(contactUpsert.upsertBatch).toHaveBeenCalledWith(
      "user-1",
      [
        expect.objectContaining({
          source: ContactSource.VCARD,
          externalId: "import-1",
        }),
      ],
      { batchSize: 100 },
    );
    expect(prisma.integrationState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_source: { userId: "user-1", source: ContactSource.VCARD },
        },
      }),
    );
  });

  it("rejects missing file", async () => {
    await expect(
      svc.importFromFile("user-1", undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects empty file", async () => {
    await expect(
      svc.importFromFile("user-1", {
        buffer: Buffer.alloc(0),
        size: 0,
        originalname: "empty.vcf",
        mimetype: "text/vcard",
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
