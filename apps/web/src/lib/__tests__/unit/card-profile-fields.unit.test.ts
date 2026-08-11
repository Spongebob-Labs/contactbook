import { describe, expect, it } from "vitest";
import {
  buildCardProfilePatch,
  listCardProfileFields,
  type CardProfileEdits,
} from "@/lib/card-profile-fields";
import type { ProfileMeResponse } from "@/lib/types";

/** Keys the server's socials DTO whitelists; anything else makes PATCH 400. */
const ALLOWED_SOCIAL_KEYS = new Set([
  "groupId",
  "tag",
  "custom",
  "website",
  "facebook",
  "twitter",
  "whatsApp",
  "blog",
  "skype",
  "bbmPin",
  "asw",
  "bebo",
]);

const profile = {
  identity: {
    firstName: "Aayush",
    lastName: "Sharma",
    primaryPhone: "+919347243575",
    primaryEmail: "as@example.com",
    profilePhoto: null,
  },
  personal: {
    groupId: "personal-1",
    tag: "Personal",
    mobile: "+919347243575",
    email: "as@example.com",
  },
  work: [
    {
      groupId: "work-1",
      tag: "Work",
      companyName: "Shava",
      workTitle: "Engineer",
    },
  ],
  business: [],
  socials: [
    {
      groupId: "social-1",
      tag: "Main Digital Presence",
      linkedin: "https://linkedin.com/in/aayush",
      github: "https://github.com/aayush",
      twitter: "https://x.com/aayush",
      custom: { instagram: "" },
    },
  ],
  financial: { bankAccounts: [], digitalWallets: [], cryptoWallets: [] },
} as unknown as ProfileMeResponse;

const noEdits: CardProfileEdits = { values: {}, addresses: {} };

describe("card profile patch — socials whitelist", () => {
  it("never sends keys the server rejects", () => {
    const patch = buildCardProfilePatch(profile, "PERSONAL", {
      values: { twitter: "https://x.com/new", facebook: "https://fb.com/me" },
      addresses: {},
    });
    const socials = (patch.socials as Array<Record<string, unknown>>)[0] ?? {};

    // The live API answers 400 "socials.0.property linkedin should not exist".
    expect(socials).not.toHaveProperty("linkedin");
    expect(socials).not.toHaveProperty("github");
    for (const key of Object.keys(socials)) {
      expect(ALLOWED_SOCIAL_KEYS.has(key)).toBe(true);
    }
    expect(socials.twitter).toBe("https://x.com/new");
    expect(socials.facebook).toBe("https://fb.com/me");
  });

  it("keeps the group id and tag so the server updates rather than duplicates", () => {
    const patch = buildCardProfilePatch(profile, "PERSONAL", noEdits);
    const socials = (patch.socials as Array<Record<string, unknown>>)[0] ?? {};
    expect(socials.groupId).toBe("social-1");
    expect(socials.tag).toBe("Main Digital Presence");
  });

  it("omits social keys that are neither stored nor edited", () => {
    const patch = buildCardProfilePatch(profile, "PERSONAL", noEdits);
    const socials = (patch.socials as Array<Record<string, unknown>>)[0] ?? {};
    expect(socials).not.toHaveProperty("blog");
    expect(socials).not.toHaveProperty("website");
    // Stored values survive a save that did not touch them.
    expect(socials.twitter).toBe("https://x.com/aayush");
  });
});

describe("card profile fields", () => {
  it("marks LinkedIn read-only because the server rejects it", () => {
    const linkedin = listCardProfileFields(profile, "PERSONAL").find(
      (field) => field.key === "linkedin",
    );
    expect(linkedin?.editable).toBe(false);
    expect(linkedin?.unavailableReason).toBeTruthy();
  });

  it("marks Department read-only because no profile key stores it", () => {
    const department = listCardProfileFields(profile, "BUSINESS").find(
      (field) => field.key === "department",
    );
    expect(department?.editable).toBe(false);
  });

  it("reads work values for a work card and personal values otherwise", () => {
    const work = listCardProfileFields(profile, "BUSINESS");
    expect(work.find((f) => f.key === "companyName")?.value).toBe("Shava");

    const personal = listCardProfileFields(profile, "PERSONAL");
    expect(personal.find((f) => f.key === "mobile")?.value).toBe(
      "+919347243575",
    );
  });

  it("resends the whole work group, since the server deletes omitted fields", () => {
    const patch = buildCardProfilePatch(profile, "BUSINESS", {
      values: { workTitle: "Staff Engineer" },
      addresses: {},
    });
    const work = (patch.work as Array<Record<string, unknown>>)[0] ?? {};
    expect(work.groupId).toBe("work-1");
    expect(work.workTitle).toBe("Staff Engineer");
    // Untouched values must still be present or the server drops them.
    expect(work.companyName).toBe("Shava");
  });
});
