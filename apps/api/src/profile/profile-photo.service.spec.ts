import { BadRequestException } from "@nestjs/common";
import { ProfilePhotoService } from "./profile-photo.service";

describe("ProfilePhotoService", () => {
  const gcs = {
    isConfigured: jest.fn().mockReturnValue(true),
    upload: jest.fn(),
    deleteByUrl: jest.fn(),
    extensionForMime: jest.fn().mockReturnValue("jpg"),
  };
  const profileUpsert = { patch: jest.fn().mockResolvedValue({}) };
  const profileSerializer = {
    build: jest.fn().mockResolvedValue({
      identity: {
        profilePhoto: "https://storage.googleapis.com/b/profiles/u/old.jpg",
      },
    }),
  };

  function createSvc() {
    return new ProfilePhotoService(
      gcs as never,
      profileUpsert as never,
      profileSerializer as never,
    );
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

  it("uploads, patches profile, and deletes previous object", async () => {
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
    expect(profileUpsert.patch).toHaveBeenCalledWith("user-1", {
      identity: {
        profilePhoto: "https://storage.googleapis.com/b/profiles/u/new.jpg",
      },
    });
    expect(gcs.deleteByUrl).toHaveBeenCalledWith(
      "https://storage.googleapis.com/b/profiles/u/old.jpg",
    );
    expect(result.profilePhoto).toBe(
      "https://storage.googleapis.com/b/profiles/u/new.jpg",
    );
  });

  it("remove clears profile and deletes GCS object", async () => {
    const svc = createSvc();
    const result = await svc.remove("user-1");
    expect(profileUpsert.patch).toHaveBeenCalledWith("user-1", {
      identity: { profilePhoto: null },
    });
    expect(gcs.deleteByUrl).toHaveBeenCalled();
    expect(result.profilePhoto).toBeNull();
  });
});
