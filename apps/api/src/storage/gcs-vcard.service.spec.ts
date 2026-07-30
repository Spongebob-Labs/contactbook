import { ConfigService } from "@nestjs/config";
import { GcsVcardService } from "./gcs-vcard.service";
import { GcsUploadService } from "./gcs-upload.service";

const mockSave = jest.fn().mockResolvedValue(undefined);

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: mockSave,
      }),
    }),
  })),
}));

function createService(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new GcsVcardService(config, new GcsUploadService(config));
}

describe("GcsVcardService", () => {
  const baseEnv = {
    GCS_CARD_SHARES_BUCKET: "contactbook-card-shares",
    GCS_CARD_SHARES_PUBLIC_BASE_URL:
      "https://storage.googleapis.com/contactbook-card-shares",
  };

  beforeEach(() => {
    mockSave.mockClear();
  });

  it("reports configured only when bucket and base URL are both set", () => {
    expect(createService(baseEnv).isConfigured()).toBe(true);
    expect(createService({}).isConfigured()).toBe(false);
  });

  it("builds a public URL from the caller-supplied content-addressed key", () => {
    const svc = createService(baseEnv);
    expect(svc.buildPublicUrl("card-1/abc123.vcf")).toBe(
      "https://storage.googleapis.com/contactbook-card-shares/card-1/abc123.vcf",
    );
  });

  it("uploads with text/x-vcard content type (WhatsApp-accepted, not text/vcard which is MMS-only) and an immutable cache header", async () => {
    const svc = createService(baseEnv);
    const url = await svc.upload("card-1/abc123.vcf", Buffer.from("BEGIN:VCARD"));

    expect(url).toBe(
      "https://storage.googleapis.com/contactbook-card-shares/card-1/abc123.vcf",
    );
    expect(mockSave).toHaveBeenCalledWith(
      Buffer.from("BEGIN:VCARD"),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: expect.objectContaining({
          contentType: "text/x-vcard",
          cacheControl: "public, max-age=31536000, immutable",
        }),
      }),
    );
  });

  it("throws instead of uploading when not configured", async () => {
    const svc = createService({});
    await expect(svc.upload("card-1/x.vcf", Buffer.from(""))).rejects.toThrow(
      "GCS card-share storage is not configured",
    );
  });
});
