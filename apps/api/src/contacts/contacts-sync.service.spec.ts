import { BadRequestException, NotImplementedException } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import { ContactsSyncService } from "./contacts-sync.service";

describe("ContactsSyncService", () => {
  const google = { sync: jest.fn() };
  const icloud = { sync: jest.fn() };
  const svc = new ContactsSyncService(
    google as never,
    icloud as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches GOOGLE to google provider", async () => {
    google.sync.mockResolvedValue({ source: ContactSource.GOOGLE });
    await svc.sync("user-1", ContactSource.GOOGLE);
    expect(google.sync).toHaveBeenCalledWith("user-1");
  });

  it("rejects CSV sync", async () => {
    await expect(svc.sync("user-1", ContactSource.CSV)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("ICLOUD delegates to icloud provider", async () => {
    icloud.sync.mockRejectedValue(new NotImplementedException());
    await expect(
      svc.sync("user-1", ContactSource.ICLOUD),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});
