import { ContactSource } from "@prisma/client";
import { ContactSerializer } from "./contact.serializer";
import { ContactsService } from "./contacts.service";

describe("ContactsService.getImportSummary", () => {
  it("aggregates counts and integration state per source", async () => {
    const prisma = {
      contact: {
        count: jest
          .fn()
          .mockImplementation(({ where }: { where: { deletedAt: unknown } }) =>
            Promise.resolve(where.deletedAt === null ? 3 : 1),
          ),
      },
      integrationState: {
        findUnique: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { userId_source: { userId: string; source: ContactSource } };
            }) =>
              Promise.resolve(
                where.userId_source.source === ContactSource.GOOGLE
                  ? {
                      lastSyncAt: new Date("2026-05-18T00:00:00Z"),
                      syncToken: "token",
                    }
                  : null,
              ),
          ),
      },
    };
    const svc = new ContactsService(prisma as never, new ContactSerializer());
    const summary = await svc.getImportSummary("user-1");

    expect(summary.totalActive).toBeGreaterThan(0);
    const google = summary.bySource.find((r) => r.source === ContactSource.GOOGLE);
    expect(google).toMatchObject({
      activeCount: 3,
      deletedCount: 1,
      hasSyncToken: true,
    });
  });
});
