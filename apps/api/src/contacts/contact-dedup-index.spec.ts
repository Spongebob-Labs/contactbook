import { ContactSource } from "@prisma/client";
import {
  createEmptyDedupIndex,
  loadDedupIndex,
  resolveMergeGroupFromIndex,
} from "./contact-dedup-index";
import type { NormalizedContact } from "./normalized-contact.types";

describe("contact-dedup-index", () => {
  const userId = "user-1";

  const googleContact: NormalizedContact = {
    source: ContactSource.GOOGLE,
    externalId: "people/a",
    displayName: "Jane",
    phones: [{ value: "+15551234567", isPrimary: true }],
    emails: [{ value: "jane@example.com", isPrimary: true }],
    organizations: [],
    addresses: [],
    urls: [],
  };

  it("resolveMergeGroupFromIndex links a second contact to an existing group", () => {
    const index = createEmptyDedupIndex();
    index.keyToMergeGroup.set("email:jane@example.com", "group-1");
    index.groupMembers.set(
      "group-1",
      new Set([`${ContactSource.GOOGLE}:people/a`]),
    );

    const vcardContact: NormalizedContact = {
      ...googleContact,
      source: ContactSource.VCARD,
      externalId: "vcard-1",
    };
    const result = resolveMergeGroupFromIndex(index, vcardContact);
    expect(result.mergeGroupId).toBe("group-1");
    expect(result.duplicateFound).toBe(true);
    expect(index.keyToMergeGroup.get("email:jane@example.com")).toBe("group-1");
  });

  it("loadDedupIndex builds maps from prisma rows", async () => {
    const prisma = {
      contactDedupKey: {
        findMany: jest.fn().mockResolvedValue([
          {
            kind: "email",
            value: "jane@example.com",
            mergeGroupId: "group-1",
          },
        ]),
      },
      contact: {
        findMany: jest.fn().mockResolvedValue([
          {
            mergeGroupId: "group-1",
            source: ContactSource.GOOGLE,
            externalId: "people/a",
          },
        ]),
      },
    };

    const index = await loadDedupIndex(userId, prisma as never);
    expect(index.keyToMergeGroup.get("email:jane@example.com")).toBe("group-1");
    expect(index.groupMembers.get("group-1")?.has("GOOGLE:people/a")).toBe(
      true,
    );
  });
});
