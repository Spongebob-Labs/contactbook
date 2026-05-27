import { validate } from "class-validator";
import {
  ProfileMeBusinessUpsertDto,
  ProfileMeIdentityUpsertDto,
  ProfileMeWorkUpsertDto,
} from "../dto/profile-me-upsert.dto";

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

  it("validates companyLogo correctly under GCS rules", async () => {
    process.env.GCS_PUBLIC_BASE_URL =
      "https://storage.googleapis.com/contactbook-profile-photos";

    const dto = new ProfileMeWorkUpsertDto();
    dto.companyLogo = "https://storage.example.com/logo.png";
    let errors = await validate(dto);
    expect(errors.some((e) => e.property === "companyLogo")).toBe(true);

    dto.companyLogo =
      "https://storage.googleapis.com/contactbook-profile-photos/profiles/u/logo.png";
    errors = await validate(dto);
    expect(errors.some((e) => e.property === "companyLogo")).toBe(false);
  });

  it("validates businessLogo correctly under GCS rules", async () => {
    process.env.GCS_PUBLIC_BASE_URL =
      "https://storage.googleapis.com/contactbook-profile-photos";

    const dto = new ProfileMeBusinessUpsertDto();
    dto.businessLogo = "https://storage.example.com/logo.png";
    let errors = await validate(dto);
    expect(errors.some((e) => e.property === "businessLogo")).toBe(true);

    dto.businessLogo =
      "https://storage.googleapis.com/contactbook-profile-photos/profiles/u/logo.png";
    errors = await validate(dto);
    expect(errors.some((e) => e.property === "businessLogo")).toBe(false);
  });
});
