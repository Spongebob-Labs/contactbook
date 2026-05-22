import { ConfigService } from "@nestjs/config";
import {
  GcsProfilePhotoService,
  normalizePublicBaseUrl,
} from "./gcs-profile-photo.service";

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: mockSave,
        delete: mockDelete,
      }),
    }),
  })),
}));

function createService(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new GcsProfilePhotoService(config);
}

describe("normalizePublicBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizePublicBaseUrl("https://cdn.example.com///")).toBe(
      "https://cdn.example.com",
    );
  });
});

describe("GcsProfilePhotoService", () => {
  const baseEnv = {
    GCS_PROFILE_PHOTOS_BUCKET: "contactbook-profile-photos",
    GCS_PUBLIC_BASE_URL:
      "https://storage.googleapis.com/contactbook-profile-photos",
  };

  beforeEach(() => {
    mockSave.mockClear();
    mockDelete.mockClear();
  });

  it("reports configured when bucket and base URL are set", () => {
    const svc = createService(baseEnv);
    expect(svc.isConfigured()).toBe(true);
  });

  it("builds public URLs and detects managed URLs", () => {
    const svc = createService(baseEnv);
    const key = "profiles/user-1/abc.jpg";
    const url = svc.buildPublicUrl(key);
    expect(url).toBe(
      "https://storage.googleapis.com/contactbook-profile-photos/profiles/user-1/abc.jpg",
    );
    expect(svc.isManagedUrl(url)).toBe(true);
    expect(svc.objectKeyFromUrl(url)).toBe(key);
  });

  it("uploads with profiles/userId/uuid.ext key", async () => {
    const svc = createService(baseEnv);
    const url = await svc.upload("user-1", Buffer.from("fake"), "image/jpeg");
    expect(url).toMatch(
      /^https:\/\/storage\.googleapis\.com\/contactbook-profile-photos\/profiles\/user-1\/[0-9a-f-]+\.jpg$/,
    );
    expect(mockSave).toHaveBeenCalledWith(
      Buffer.from("fake"),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: expect.objectContaining({
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000, immutable",
        }),
      }),
    );
  });

  it("deletes managed objects and ignores unknown URLs", async () => {
    const svc = createService(baseEnv);
    const url = svc.buildPublicUrl("profiles/user-1/old.jpg");
    await svc.deleteByUrl(url);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    await svc.deleteByUrl("https://other.example.com/x.jpg");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
