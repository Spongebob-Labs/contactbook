/**
 * The profile screen's pure helpers, and the `?state=` override that now sits over real data.
 *
 * The interesting one is `globalFieldOrder`. `position` is global across a profile upstream
 * rather than per-group, so a move inside one section has to be sent as the *complete* order —
 * send only that section's ids and the API renumbers them against positions the other sections
 * still hold, which reads as fields jumping between groups. That is a bug with no local symptom,
 * so it is pinned here.
 */

import { describe, expect, it } from "vitest";

import {
  cardNamesUsing,
  emptyProfileData,
  fieldsOfGroup,
  globalFieldOrder,
  initProfileDraft,
  profileDraftReducer,
  type ProfileData,
  type ProfileDraft,
} from "@/app/(app)/profile/profile-client";
import { overrideErrorFor } from "@/lib/screen-data";
import { fixtureUser } from "@/fixtures/user";
import type { FieldGroup, ProfileField } from "@/types/domain";

function group(id: string, fieldIds: string[], category: FieldGroup["category"] = "WORK"): FieldGroup {
  return { id, userId: fixtureUser.id, category, name: id, fieldIds };
}

function field(id: string, groupId: string): ProfileField {
  return { id, groupId, type: "PHONE", label: id, value: `v-${id}`, isSensitive: false };
}

const DATA: ProfileData = {
  user: fixtureUser,
  groups: [group("personal", ["a", "b"], "PERSONAL"), group("work", ["c", "d"])],
  fields: [field("a", "personal"), field("b", "personal"), field("c", "work"), field("d", "work")],
};

describe("globalFieldOrder", () => {
  it("concatenates every group's ids in render order", () => {
    expect(globalFieldOrder(initProfileDraft(DATA))).toEqual(["a", "b", "c", "d"]);
  });

  it("reflects a move within one group, leaving the others where they were", () => {
    const draft = initProfileDraft(DATA);
    const moved = profileDraftReducer(draft, {
      kind: "move-field",
      groupId: "work",
      fieldId: "d",
      direction: -1,
    });

    // The whole order, with only `work`'s pair swapped — this is exactly the array the reorder
    // action sends, and the reason it sends all of it.
    expect(globalFieldOrder(moved)).toEqual(["a", "b", "d", "c"]);
  });

  it("never emits an id the draft has dropped", () => {
    const draft = initProfileDraft(DATA);
    const afterDelete = profileDraftReducer(draft, { kind: "delete-field", fieldId: "c" });
    expect(globalFieldOrder(afterDelete)).toEqual(["a", "b", "d"]);
  });
});

describe("profileDraftReducer — reseed", () => {
  it("discards local edits, because the server has the last word", () => {
    const edited = profileDraftReducer(initProfileDraft(DATA), {
      kind: "edit-field",
      fieldId: "a",
      label: "Edited",
      value: "changed",
    });
    expect(edited.fields.find((f) => f.id === "a")?.label).toBe("Edited");

    // What `router.refresh()` triggers. A rejected edit reverting is the *point*, not a loss.
    const reseeded = profileDraftReducer(edited, { kind: "reseed", data: DATA });
    expect(reseeded.fields.find((f) => f.id === "a")?.label).toBe("a");
  });

  it("resets the local id counter, so temporary ids cannot outlive a refresh", () => {
    // A local id reaching `PUT /profile/fields/order` would be rejected wholesale as not-yours
    // (403 PROFILE_FIELD_NOT_OWNED), taking every other field's position with it.
    const added = profileDraftReducer(initProfileDraft(DATA), {
      kind: "add-field",
      groupId: "work",
      draft: { type: "EMAIL", label: "New", value: "x@example.com", isSensitive: false },
    });
    expect(added.fields.some((f) => f.id.startsWith("field_local_"))).toBe(true);

    const reseeded = profileDraftReducer(added, { kind: "reseed", data: DATA });
    expect(reseeded.fields.some((f) => f.id.startsWith("field_local_"))).toBe(false);
    expect(reseeded.nextLocalId).toBe(1);
  });

  it("survives a reseed to null — the loading and error states carry no data", () => {
    const reseeded = profileDraftReducer(initProfileDraft(DATA), { kind: "reseed", data: null });
    expect(reseeded).toEqual({ user: null, groups: [], fields: [], nextLocalId: 1 });
  });
});

describe("emptyProfileData (§11 E-08)", () => {
  it("keeps the groups and empties the fields", () => {
    // An empty profile is the groups with no fields, not zero groups: a screen showing nothing
    // would be wrong about the data and would offer the owner no way to start.
    const empty = emptyProfileData(DATA);
    expect(empty.groups.map((g) => g.id)).toEqual(["personal", "work"]);
    expect(empty.groups.every((g) => g.fieldIds.length === 0)).toBe(true);
    expect(empty.fields).toEqual([]);
  });

  it("does not mutate the real data it derives from", () => {
    emptyProfileData(DATA);
    expect(DATA.groups[0]?.fieldIds).toEqual(["a", "b"]);
    expect(DATA.fields).toHaveLength(4);
  });
});

describe("fieldsOfGroup", () => {
  it("returns the group's fields in the group's own order", () => {
    const draft: ProfileDraft = initProfileDraft(DATA);
    expect(fieldsOfGroup(draft, group("work", ["d", "c"])).map((f) => f.id)).toEqual(["d", "c"]);
  });

  it("drops a dangling id rather than faking a row (I-2)", () => {
    const draft: ProfileDraft = initProfileDraft(DATA);
    expect(fieldsOfGroup(draft, group("work", ["c", "ghost"])).map((f) => f.id)).toEqual(["c"]);
  });
});

describe("cardNamesUsing (§11 E-41)", () => {
  const cards = [
    { name: "Work", fieldIds: ["a", "c"] },
    { name: "Personal", fieldIds: ["a"] },
    { name: "Payment", fieldIds: ["d"] },
  ];

  it("names every card that maps the field, so the delete confirm can be specific", () => {
    expect(cardNamesUsing(cards, "a")).toEqual(["Work", "Personal"]);
    expect(cardNamesUsing(cards, "d")).toEqual(["Payment"]);
  });

  it("returns nothing for a field no card maps, and for an empty card list", () => {
    expect(cardNamesUsing(cards, "b")).toEqual([]);
    // The group editor swallows a cards failure to an empty list: one less specific sentence
    // beats losing the whole editor.
    expect(cardNamesUsing([], "a")).toEqual([]);
  });
});

describe("overrideErrorFor", () => {
  it("supplies copy for the two synthetic states and nothing for the rest", () => {
    expect(overrideErrorFor("error")?.kind).toBe("unknown");
    expect(overrideErrorFor("offline")?.kind).toBe("network");
    expect(overrideErrorFor("success")).toBeNull();
    expect(overrideErrorFor("empty")).toBeNull();
    expect(overrideErrorFor("loading")).toBeNull();
  });
});
