import { BadRequestException } from "@nestjs/common";
import { ProfilePhotoService } from "./profile-photo.service";

describe("ProfilePhotoService", () => {
  const gcs = {
    isConfigured: jest.fn().mockReturnValue(true),
    upload: jest.fn(),
    deleteByUrl: jest.fn(),
    extensionForMime: jest.fn().mockReturnValue("jpg"),
  };

  function createSvc() {
    return new ProfilePhotoService(gcs as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    gcs.isConfigured.mockReturnValue(true);
    gcs.upload.mockResolvedValue(
      "https://storage.googleapis.com/b/profiles/u/new.jpg",
    );
  });

  it("rejects missing file", async () => {
    const svc = createSvc();
    await expect(svc.upload("user-1", undefined as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("uploads and returns the public GCS URL without DB patching", async () => {
    const svc = createSvc();
    const file = {
      buffer: Buffer.from("x"),
      mimetype: "image/jpeg",
      size: 100,
    } as Express.Multer.File;

    const result = await svc.upload("user-1", file);

    expect(gcs.upload).toHaveBeenCalledWith(
      "user-1",
      file.buffer,
      "image/jpeg",
    );
    expect(result.url).toBe(
      "https://storage.googleapis.com/b/profiles/u/new.jpg",
    );
  });

  it("remove deletes GCS object by URL", async () => {
    const svc = createSvc();
    const targetUrl = "https://storage.googleapis.com/b/profiles/u/photo.jpg";
    const result = await svc.remove(targetUrl);

    expect(gcs.deleteByUrl).toHaveBeenCalledWith(targetUrl);
    expect(result.url).toBe(targetUrl);
  });

  it("remove rejects missing URL with 400", async () => {
    const svc = createSvc();
    await expect(svc.remove("")).rejects.toThrow(BadRequestException);
  });
});
