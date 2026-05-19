import { ContactSource } from "@prisma/client";
import {
  ContactDedupService,
  normalizeEmail,
  normalizePhone,
} from "./contact-dedup.service";
import type { NormalizedContact } from "./normalized-contact.types";

describe("ContactDedupService", () => {
  const userId = "user-1";

  const contactA: NormalizedContact = {
    source: ContactSource.GOOGLE,
    externalId: "people/a",
    displayName: "Jane",
    phones: [{ value: "+1 555 123 4567", isPrimary: true }],
    emails: [{ value: "Jane@Example.com", isPrimary: true }],
    organizations: [],
    addresses: [],
    urls: [],
  };

  it("normalizes email and phone keys", () => {
    expect(normalizeEmail("  Jane@Example.com ")).toBe("jane@example.com");
    expect(normalizePhone("+1 (555) 123-4567")).toBe("15551234567");
  });

  it("links second source to existing merge group when email matches", async () => {
    const groupId = "group-1";
    const prisma = {
      contactMergeGroup: {
        create: jest.fn().mockResolvedValue({ id: "group-new" }),
      },
      contactDedupKey: {
        findMany: jest.fn().mockResolvedValue([
          {
            mergeGroupId: groupId,
            mergeGroup: {
              contacts: [
                {
                  id: "c1",
                  source: ContactSource.GOOGLE,
                  externalId: "people/a",
                },
              ],
            },
          },
        ]),
        upsert: jest.fn(),
      },
    };
    const svc = new ContactDedupService(prisma as never);
    const icloudContact: NormalizedContact = {
      ...contactA,
      source: ContactSource.ICLOUD,
      externalId: "icloud-1",
    };
    const result = await svc.resolveMergeGroup(userId, icloudContact);
    expect(result.mergeGroupId).toBe(groupId);
    expect(result.duplicateFound).toBe(true);
  });
});
