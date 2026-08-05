import { describe, expect, it } from "vitest";
import {
  getMissingProfileSections,
  getProfileCompletion,
  getProfileCompletionItems,
} from "@/lib/profile-completion";
import type { ProfileMeResponse } from "@/lib/types";

function emptyProfile(
  overrides: Partial<ProfileMeResponse> = {},
): ProfileMeResponse {
  return {
    identity: {
      firstName: "",
      lastName: "",
      primaryEmail: "",
      primaryPhone: "",
    },
    personal: {
      groupId: "",
      tag: "",
      postalAddress: undefined,
    },
    work: [],
    business: [],
    socials: [],
    financial: [],
    ...overrides,
  } as ProfileMeResponse;
}

describe("profile-completion", () => {
  it("reports all sections missing for empty profile", () => {
    const missing = getMissingProfileSections(null);
    expect(missing).toHaveLength(5);
    expect(getProfileCompletion(null)).toEqual({
      completed: 0,
      total: 5,
      percent: 0,
    });
  });

  it("marks identity complete when any identity field is set", () => {
    const profile = emptyProfile({
      identity: {
        firstName: "Ada",
        lastName: "",
        primaryEmail: "",
        primaryPhone: "",
      },
    });
    const items = getProfileCompletionItems(profile);
    expect(items[0]?.done).toBe(true);
    expect(getProfileCompletion(profile).completed).toBe(1);
  });

  it("counts work/business and socials", () => {
    const profile = emptyProfile({
      identity: {
        firstName: "",
        lastName: "",
        primaryEmail: "ada@example.com",
        primaryPhone: "",
      },
      personal: {
        groupId: "g1",
        tag: "personal",
        postalAddress: {
          street: "1 Main",
          city: "Pune",
          state: "MH",
          pincode: "411001",
          country: "IN",
        },
      },
      work: [
        {
          groupId: "w1",
          tag: "work",
          companyName: "Analytical",
        },
      ],
      socials: [
        {
          groupId: "s1",
          tag: "social",
          linkedin: "https://linkedin.com/in/ada",
        },
      ],
    });

    expect(getMissingProfileSections(profile)).toEqual([]);
    expect(getProfileCompletion(profile).percent).toBe(100);
  });
});
