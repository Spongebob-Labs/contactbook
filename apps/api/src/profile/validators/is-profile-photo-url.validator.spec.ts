import { validate } from "class-validator";
import { ProfileMeIdentityUpsertDto } from "../dto/profile-me-upsert.dto";

describe("IsProfilePhotoUrl", () => {
  const originalBase = process.env.GCS_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalBase === undefined) {
      delete process.env.GCS_PUBLIC_BASE_URL;
    } else {
      process.env.GCS_PUBLIC_BASE_URL = originalBase;
    }
  });

  it("rejects data URLs", async () => {
    delete process.env.GCS_PUBLIC_BASE_URL;
    const dto = new ProfileMeIdentityUpsertDto();
    dto.profilePhoto = "data:image/png;base64,abc";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "profilePhoto")).toBe(true);
  });

  it("accepts null", async () => {
    const dto = new ProfileMeIdentityUpsertDto();
    dto.profilePhoto = null;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("requires URL under GCS_PUBLIC_BASE_URL when configured", async () => {
    process.env.GCS_PUBLIC_BASE_URL =
      "https://storage.googleapis.com/contactbook-profile-photos";
    const dto = new ProfileMeIdentityUpsertDto();
    dto.profilePhoto = "https://storage.example.com/photo.jpg";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "profilePhoto")).toBe(true);

    dto.profilePhoto =
      "https://storage.googleapis.com/contactbook-profile-photos/profiles/u/1.jpg";
    const ok = await validate(dto);
    expect(ok).toHaveLength(0);
  });
});
