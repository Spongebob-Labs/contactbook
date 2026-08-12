/**
 * Which profile fields a card adopts.
 *
 * A card's vCard is built from `CardFieldMapping` rows, so getting this wrong is
 * not a cosmetic bug: adopt too little and the recipient gets a bare name, adopt
 * the wrong group and a work card leaks home details.
 */
import { describe, expect, it } from "vitest";
import {
  adoptableGroupIds,
  selectCardFields,
  syncableFieldTypes,
} from "@/lib/card-field-sync";
import type { ProfileFieldRow } from "@/lib/profile-api";
import type { ProfileMeResponse } from "@/lib/types";

const WORK_GROUP = "group-work";
const OLDER_WORK_GROUP = "group-work-2";
const PERSONAL_GROUP = "group-personal";
const SOCIAL_GROUP = "group-social";
const FINANCIAL_GROUP = "group-financial";
const IDENTITY_GROUP = "group-identity";

function profile(overrides: Partial<ProfileMeResponse> = {}): ProfileMeResponse {
  return {
    identity: {
      firstName: "Vansh",
      lastName: "Mehta",
      primaryPhone: "+919953266232",
      primaryEmail: "vansh@example.com",
      profilePhoto: null,
    },
    personal: { groupId: PERSONAL_GROUP, tag: "Personal" },
    work: [
      { groupId: WORK_GROUP, tag: "Work" },
      { groupId: OLDER_WORK_GROUP, tag: "Old job" },
    ],
    business: [],
    socials: [{ groupId: SOCIAL_GROUP, tag: "Social" }],
    financial: {
      bankAccounts: [
        { groupId: FINANCIAL_GROUP, fieldId: "fin-1", tag: "Bank" },
      ],
      digitalWallets: [],
      cryptoWallets: [],
    },
    ...overrides,
  } as unknown as ProfileMeResponse;
}

function field(
  id: string,
  type: string,
  groupId: string,
  value: string | null = "value",
): ProfileFieldRow {
  return { id, type, label: null, value, groupId };
}

const FIELDS: ProfileFieldRow[] = [
  field("w-phone", "PHONE", WORK_GROUP),
  field("w-company", "COMPANY", WORK_GROUP),
  field("w-old-phone", "PHONE", OLDER_WORK_GROUP),
  field("p-phone", "PHONE", PERSONAL_GROUP),
  field("p-landline", "LANDLINE", PERSONAL_GROUP),
  field("s-link", "SOCIAL_LINK", SOCIAL_GROUP),
  field("i-photo", "PHOTO", IDENTITY_GROUP),
  field("f-bank", "BANK_ACCOUNT", FINANCIAL_GROUP),
];

describe("adoptableGroupIds", () => {
  it("gives a work card exactly the workplace the editor edits", () => {
    // The editor writes `work[0]`, so a card reading any other group would show
    // values that saving can never change.
    expect([...adoptableGroupIds(profile(), "BUSINESS", FIELDS)]).toEqual([
      WORK_GROUP,
    ]);
  });

  it("falls back to a business group when there is no work group", () => {
    const p = profile({
      work: [],
      business: [{ groupId: "group-business", tag: "Biz" }],
    } as unknown as Partial<ProfileMeResponse>);
    expect([...adoptableGroupIds(p, "BUSINESS", FIELDS)]).toEqual([
      "group-business",
    ]);
  });

  it("gives a personal card its personal, social and identity groups", () => {
    const groups = adoptableGroupIds(profile(), "PERSONAL", FIELDS);
    expect(groups.has(PERSONAL_GROUP)).toBe(true);
    expect(groups.has(SOCIAL_GROUP)).toBe(true);
    // Unclassified: `GET /profile/me` exposes no id for the identity group, so it
    // is reachable only by elimination — and that is where a photo lives.
    expect(groups.has(IDENTITY_GROUP)).toBe(true);
  });

  it("never gives a personal card work or financial groups", () => {
    const groups = adoptableGroupIds(profile(), "PERSONAL", FIELDS);
    expect(groups.has(WORK_GROUP)).toBe(false);
    expect(groups.has(OLDER_WORK_GROUP)).toBe(false);
    expect(groups.has(FINANCIAL_GROUP)).toBe(false);
  });

  it("treats a custom card like a personal one", () => {
    expect(adoptableGroupIds(profile(), "CUSTOM", FIELDS)).toEqual(
      adoptableGroupIds(profile(), "PERSONAL", FIELDS),
    );
  });

  it("ignores a blank groupId — an account with no personal group yet", () => {
    const p = profile({
      personal: { groupId: "", tag: "" },
    } as unknown as Partial<ProfileMeResponse>);
    expect(adoptableGroupIds(p, "PERSONAL", FIELDS).has("")).toBe(false);
  });
});

describe("selectCardFields", () => {
  it("takes only the work group's shareable fields for a work card", () => {
    expect(selectCardFields(profile(), "BUSINESS", FIELDS).map((f) => f.id)).toEqual([
      "w-phone",
      "w-company",
    ]);
  });

  it("takes personal, social and identity fields for a personal card", () => {
    expect(selectCardFields(profile(), "PERSONAL", FIELDS).map((f) => f.id)).toEqual([
      "p-phone",
      "p-landline",
      "s-link",
      "i-photo",
    ]);
  });

  it("never maps a field type the vCard generator drops", () => {
    // BANK_ACCOUNT is excluded server-side, so a mapping for it is dead weight
    // that would also make an empty card look populated.
    for (const cardType of ["PERSONAL", "BUSINESS", "CUSTOM"] as const) {
      expect(
        selectCardFields(profile(), cardType, FIELDS).some(
          (f) => f.type === "BANK_ACCOUNT",
        ),
      ).toBe(false);
    }
  });

  it("maps a field that has no value yet", () => {
    // Deliberate: the generator skips an empty field, so mapping it now means the
    // day it is filled in it goes out without another sync.
    const fields = [field("p-empty", "EMAIL", PERSONAL_GROUP, null)];
    expect(selectCardFields(profile(), "PERSONAL", fields).map((f) => f.id)).toEqual([
      "p-empty",
    ]);
  });
});

describe("syncableFieldTypes", () => {
  it("reports the card's types in canonical order, deduped", () => {
    expect(syncableFieldTypes(profile(), "PERSONAL", FIELDS)).toEqual([
      "PHONE",
      "LANDLINE",
      "SOCIAL_LINK",
      "PHOTO",
    ]);
  });
});
