import { BadRequestException, NotImplementedException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { ContactsSyncService } from "./contacts-sync.service";

describe("ContactsSyncService", () => {
  const google = { sync: jest.fn(), import: jest.fn() };
  const icloud = { sync: jest.fn(), import: jest.fn() };
  const credentials = { assertValid: jest.fn().mockResolvedValue(undefined) };
  const svc = new ContactsSyncService(
    google as never,
    icloud as never,
    credentials as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches GOOGLE sync to google provider", async () => {
    google.sync.mockResolvedValue({ source: ContactSource.GOOGLE });
    await svc.sync("user-1", ContactSource.GOOGLE);
    expect(credentials.assertValid).toHaveBeenCalledWith(
      "user-1",
      ContactSource.GOOGLE,
    );
    expect(google.sync).toHaveBeenCalledWith("user-1");
    expect(google.import).not.toHaveBeenCalled();
  });

  it("dispatches GOOGLE import to google provider", async () => {
    google.import.mockResolvedValue({
      stats: { added: 1, updated: 0, deleted: 0, duplicatesFound: 0 },
      skipped: [],
      completedAt: new Date(),
    });
    const result = await svc.import("user-1", ContactSource.GOOGLE);
    expect(credentials.assertValid).toHaveBeenCalledWith(
      "user-1",
      ContactSource.GOOGLE,
    );
    expect(google.import).toHaveBeenCalledWith("user-1");
    expect(google.sync).not.toHaveBeenCalled();
    expect(result).toMatchObject({ created: 1, updated: 0, skipped: [] });
  });

  it("rejects VCARD sync", async () => {
    await expect(
      svc.sync("user-1", ContactSource.VCARD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects VCARD import", async () => {
    await expect(
      svc.import("user-1", ContactSource.VCARD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ICLOUD sync delegates to icloud provider", async () => {
    icloud.sync.mockRejectedValue(new NotImplementedException());
    await expect(
      svc.sync("user-1", ContactSource.ICLOUD),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it("ICLOUD import delegates to icloud provider", async () => {
    icloud.import.mockRejectedValue(new NotImplementedException());
    await expect(
      svc.import("user-1", ContactSource.ICLOUD),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});
