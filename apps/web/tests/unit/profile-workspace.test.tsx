/**
 * The `/profile` workspace (client, 2026-09-28): the suggested blank fields, the rows each
 * section lists, what a new card carries over, the body `PUT /cards/{id}/fields` is sent, the
 * click-to-edit row and the debounced "on this card" sync.
 *
 * Every expectation is derived from the modules' own tables (`PROFILE_SECTIONS`, the fixture
 * profile) rather than restated, so adding a suggestion does not mean editing a list here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, fireEvent, renderHook, renderWithProviders, screen, userEvent } from "../helpers/render";
import {
  ALL_SUGGESTIONS,
  PROFILE_SECTIONS,
  childBirthdayLabel,
  openSuggestions,
  pairChildren,
  sectionForCategory,
} from "@/components/builder/field-suggestions";
import { FIELD_CATALOGUE } from "@/components/builder/field-catalogue";
import { WorkspaceFieldRow } from "@/components/profile/workspace-field-row";
import {
  CARD_FIELD_LIMIT,
  cardFieldPayload,
  carryOverFieldIds,
  groupIdForCreate,
  workGroupTag,
  workspaceSections,
} from "@/components/profile/workspace-model";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import type { ContactCard, FieldGroup, ProfileField } from "@/types/domain";

const setFields = vi.fn();
vi.mock("@/lib/api/browser", () => ({
  cards: { setFields: (...args: unknown[]) => setFields(...args) },
}));

function field(partial: Partial<ProfileField> & Pick<ProfileField, "id" | "type">): ProfileField {
  return { groupId: "g", label: partial.id, value: `v-${partial.id}`, isSensitive: false, ...partial };
}

/* ── the suggestion table ─────────────────────────────────────────────────────────────── */

describe("PROFILE_SECTIONS", () => {
  it("reads Personal, Work, Socials, Business, then the rest — the first two open", () => {
    expect(PROFILE_SECTIONS.slice(0, 4).map((s) => s.label)).toEqual([
      "Personal",
      "Work",
      "Socials",
      "Business",
    ]);
    expect(PROFILE_SECTIONS.filter((s) => s.defaultOpen).map((s) => s.id)).toEqual([
      "personal",
      "work",
    ]);
  });

  it("files every category under exactly one section", () => {
    const categories = PROFILE_SECTIONS.flatMap((s) => s.categories);
    expect(new Set(categories).size).toBe(categories.length);
    for (const category of categories) {
      expect(sectionForCategory(category).categories).toContain(category);
    }
  });

  it("carries the fields the client listed, with unique ids", () => {
    const ids = ALL_SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = (id: string) =>
      PROFILE_SECTIONS.find((s) => s.id === id)?.suggestions.map((s) => s.label);
    expect(labels("personal")).toEqual(["Date of birth", "Home address"]);
    expect(labels("work")).toEqual(["Company name", "Job title", "Company address"]);
    expect(labels("social")).toEqual(["LinkedIn", "Instagram", "X"]);
    expect(labels("business")).toEqual(["Business name", "Website", "Business address"]);
    /* Children and the company logo are rows of their own, not field suggestions. */
    expect(PROFILE_SECTIONS.find((s) => s.children)?.id).toBe("personal");
    expect(PROFILE_SECTIONS.find((s) => s.companyLogo)?.id).toBe("work");
  });

  it("offers each section's own catalogue entries under Add field", () => {
    for (const section of PROFILE_SECTIONS) {
      const catalogue = FIELD_CATALOGUE.find((entry) => entry.category === section.createCategory);
      expect(section.offers).toBe(catalogue?.offers);
    }
  });
});

describe("openSuggestions", () => {
  it("draws every suggestion as a blank row on an empty section", () => {
    for (const section of PROFILE_SECTIONS) {
      expect(openSuggestions(section, [])).toEqual(section.suggestions);
    }
  });

  it("stops drawing a suggestion once a filled field answers it", () => {
    const personal = PROFILE_SECTIONS[0];
    const dob = field({ id: "dob", type: "DATE", label: "Date of birth", value: "1991-03-08" });
    expect(openSuggestions(personal, [dob]).map((s) => s.id)).not.toContain("dob");
  });

  it("never lets a child's birthday stand in for the owner's own", () => {
    const personal = PROFILE_SECTIONS[0];
    const kid = field({ id: "kid", type: "RELATION", label: "Child", value: "Aarav" });
    const birthday = field({
      id: "kid-bday",
      type: "DATE",
      label: childBirthdayLabel("Aarav"),
      value: "2019-05-12",
    });
    expect(openSuggestions(personal, [kid, birthday]).map((s) => s.id)).toContain("dob");
  });

  it("tells the three social suggestions apart by the link, not the type", () => {
    const social = PROFILE_SECTIONS.find((s) => s.id === "social");
    if (social === undefined) throw new Error("no social section");
    const linkedin = field({ id: "li", type: "SOCIAL_LINK", label: "Work profile", value: "https://www.linkedin.com/in/x" });
    expect(openSuggestions(social, [linkedin]).map((s) => s.id)).toEqual(["instagram", "x"]);
  });

  it("does not count a blank stored value as an answer", () => {
    const work = PROFILE_SECTIONS[1];
    const empty = field({ id: "co", type: "COMPANY", value: "  " });
    expect(openSuggestions(work, [empty]).map((s) => s.id)).toContain("company");
  });
});

describe("pairChildren", () => {
  it("pairs each child with the birthday stored under their name, in profile order", () => {
    const fields = [
      field({ id: "a", type: "RELATION", label: "Child", value: "Aarav" }),
      field({ id: "b", type: "RELATION", label: "Child", value: "Mira" }),
      field({ id: "mira-bday", type: "DATE", label: childBirthdayLabel("Mira"), value: "2021-01-02" }),
      field({ id: "other", type: "RELATION", label: "Emergency contact", value: "Anand" }),
    ];
    expect(pairChildren(fields).map((c) => [c.name.id, c.birthday?.id ?? null])).toEqual([
      ["a", null],
      ["b", "mira-bday"],
    ]);
  });
});

/* ── the rows each section lists ─────────────────────────────────────────────────────── */

describe("workspaceSections", () => {
  const sections = workspaceSections(fixtureGroups, fixtureFields);

  it("lists every non-photo field exactly once, in the section its category names", () => {
    const listed = sections.flatMap((s) => [
      ...s.fields,
      ...s.children.flatMap((c) => [c.name, ...(c.birthday ? [c.birthday] : [])]),
    ]);
    const expected = fixtureFields.filter((f) => f.type !== "PHOTO");
    expect(listed.map((f) => f.id).sort()).toEqual(expected.map((f) => f.id).sort());

    const categoryOf = new Map(fixtureGroups.map((g) => [g.id, g.category]));
    for (const model of sections) {
      for (const f of model.fields) {
        expect(model.section.categories).toContain(categoryOf.get(f.groupId));
      }
    }
  });

  it("links reorder/delete only for real groups", () => {
    const synthetic: FieldGroup = { id: "category:PERSONAL", userId: "u", category: "PERSONAL", name: "Personal", fieldIds: ["p1"] };
    const [personal] = workspaceSections([synthetic], [field({ id: "p1", type: "PHONE", groupId: synthetic.id })]);
    expect(personal.fields.map((f) => f.id)).toEqual(["p1"]);
    expect(personal.groups).toEqual([]);
  });

  it("renders a FAMILY group as one family member, not as loose rows", () => {
    const group: FieldGroup = {
      id: "fam-1",
      userId: "u",
      category: "FAMILY",
      name: "Rohan",
      fieldIds: ["n1", "b1"],
    };
    const [personal] = workspaceSections(
      [group],
      [
        field({ id: "n1", type: "RELATION", label: "Name", value: "Rohan", groupId: "fam-1" }),
        field({ id: "b1", type: "DATE", label: "Birthday", value: "2019-03-14", groupId: "fam-1" }),
      ],
    );

    expect(personal.families.map((f) => [f.name, f.nameField?.id, f.birthdayField?.id])).toEqual([
      ["Rohan", "n1", "b1"],
    ]);
    // Neither field leaks into the ordinary rows or the legacy child pairing.
    expect(personal.fields.map((f) => f.id)).toEqual([]);
    expect(personal.children).toEqual([]);
  });

  it("falls back to the RELATION value when a FAMILY group has no tag", () => {
    const group: FieldGroup = {
      id: "fam-2",
      userId: "u",
      category: "FAMILY",
      name: "",
      fieldIds: ["n2"],
    };
    const [personal] = workspaceSections(
      [group],
      [field({ id: "n2", type: "RELATION", label: "Name", value: "Mira", groupId: "fam-2" })],
    );
    expect(personal.families.map((f) => f.name)).toEqual(["Mira"]);
  });
});

/* ── what a card is sent ──────────────────────────────────────────────────────────────── */

describe("carryOverFieldIds", () => {
  it("takes every filled field a card can carry — no photo, no blanks, no local ids", () => {
    const ids = carryOverFieldIds(fixtureFields);
    const expected = fixtureFields
      .filter((f) => f.type !== "PHOTO" && f.value.trim() !== "")
      .map((f) => f.id);
    expect(ids).toEqual(expected);

    expect(carryOverFieldIds([field({ id: "field_local_1", type: "PHONE" })])).toEqual([]);
  });

  it("stops at the API's limit rather than failing the create", () => {
    const many = Array.from({ length: CARD_FIELD_LIMIT + 5 }, (_, i) => field({ id: `f${i}`, type: "PHONE" }));
    expect(carryOverFieldIds(many)).toHaveLength(CARD_FIELD_LIMIT);
  });
});

describe("cardFieldPayload", () => {
  const fields = [
    field({ id: "a", type: "PHONE" }),
    field({ id: "photo", type: "PHOTO" }),
    field({ id: "b", type: "EMAIL" }),
  ];

  it("drops what the all-or-nothing endpoint would refuse: photos, unknown ids, duplicates", () => {
    expect(cardFieldPayload(["a", "photo", "gone", "a", "b"], fields).map((e) => e.fieldId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps a field created a moment ago that the profile read has not returned yet", () => {
    expect(cardFieldPayload(["a", "new"], fields, new Set(["new"])).map((e) => e.fieldId)).toEqual([
      "a",
      "new",
    ]);
  });
});

describe("groupIdForCreate / workGroupTag", () => {
  const groups: FieldGroup[] = [
    { id: "category:WORK", userId: "u", category: "WORK", name: "Work", fieldIds: [] },
    { id: "g-biz", userId: "u", category: "BUSINESS", name: "Fernwood", fieldIds: [] },
    { id: "g-personal", userId: "u", category: "PERSONAL", name: "Personal", fieldIds: [] },
  ];

  it("joins a real group of a group-able category, and nothing else", () => {
    expect(groupIdForCreate("BUSINESS", groups)).toBe("g-biz");
    expect(groupIdForCreate("WORK", groups), "a synthetic group is not a group upstream").toBeUndefined();
    expect(groupIdForCreate("PERSONAL", groups), "PERSONAL cannot hold a groupId").toBeUndefined();
  });

  it("treats FAMILY as group-able — a family member is a real group", () => {
    const family: FieldGroup[] = [
      { id: "fam-1", userId: "u", category: "FAMILY", name: "Rohan", fieldIds: [] },
    ];
    expect(groupIdForCreate("FAMILY", family)).toBe("fam-1");
  });

  it("names a first WORK group after the company, else Work", () => {
    expect(workGroupTag(" Fernwood Studio ")).toBe("Fernwood Studio");
    expect(workGroupTag("")).toBe("Work");
    expect(workGroupTag(undefined)).toBe("Work");
  });
});

/* ── the row ──────────────────────────────────────────────────────────────────────────── */

describe("WorkspaceFieldRow — click to edit", () => {
  const mobile = field({ id: "m", type: "PHONE", label: "Mobile", value: "+919833004411" });

  function renderRow(props: Partial<Parameters<typeof WorkspaceFieldRow>[0]> = {}) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ul>
        <WorkspaceFieldRow
          field={mobile}
          category="PERSONAL"
          label={mobile.label}
          type={mobile.type}
          labelEditable
          onSave={onSave}
          onCancel={onCancel}
          {...props}
        />
      </ul>,
    );
    return { onSave, onCancel };
  }

  it("opens in place when the row itself is pressed, and saves on Enter", async () => {
    const { onSave } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: /mobile/i }));

    const input = document.querySelector("[data-workspace-row-input]") as HTMLInputElement;
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, "+919800000000{Enter}");

    expect(onSave).toHaveBeenCalledWith({ label: "Mobile", value: "+919800000000" });
    expect(document.querySelector("[data-workspace-row-form]")).toBeNull();
  });

  it("cancels on Escape without saving", async () => {
    const { onSave } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: /mobile/i }));
    await userEvent.type(document.querySelector("[data-workspace-row-input]") as HTMLElement, "9{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(document.querySelector("[data-workspace-row-form]")).toBeNull();
  });

  it("saves when focus leaves the row, so a tap elsewhere never loses the edit", async () => {
    const { onSave } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: /mobile/i }));
    const input = document.querySelector("[data-workspace-row-input]") as HTMLInputElement;
    await userEvent.type(input, "9");
    fireEvent.blur(input, { relatedTarget: document.body });

    expect(onSave).toHaveBeenCalledWith({ label: "Mobile", value: "+9198330044119" });
  });

  it("refuses to empty a stored field and keeps the row open to say so", async () => {
    const { onSave } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: /mobile/i }));
    const input = document.querySelector("[data-workspace-row-input]") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value.");
  });

  it("shows a blank suggestion as its prompt and closes quietly when left empty", async () => {
    const { onSave, onCancel } = renderRow({
      field: null,
      label: "Date of birth",
      type: "DATE",
      prompt: "Add date of birth",
      labelEditable: false,
    });
    const open = screen.getByRole("button", { name: "Add date of birth" });
    await userEvent.click(open);

    const input = document.querySelector("[data-workspace-row-input]") as HTMLInputElement;
    expect(input.type, "a date is picked, not typed").toBe("date");
    fireEvent.blur(input, { relatedTarget: document.body });

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add date of birth" })).toBeInTheDocument();
  });

  it("reveals a masked row first and puts no raw value in the DOM until then", async () => {
    const bank = field({ id: "bank", type: "BANK_ACCOUNT", label: "Account", value: "50100412345678", isSensitive: true });
    const onToggleReveal = vi.fn();
    renderRow({ field: bank, label: bank.label, type: bank.type, category: "FINANCIAL", onToggleReveal });

    expect(document.body.innerHTML).not.toContain("50100412345678");
    await userEvent.click(screen.getByRole("button", { name: "Reveal Account" }));
    expect(onToggleReveal).toHaveBeenCalled();
    expect(document.querySelector("[data-workspace-row-form]"), "no blind edit").toBeNull();
  });

  it("puts the card tick on the row, named for the card", async () => {
    const onChange = vi.fn();
    renderRow({ toggle: { cardName: "Work", on: false, onChange } });

    await userEvent.click(screen.getByRole("checkbox", { name: "Show Mobile on Work" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

/* ── the sync ─────────────────────────────────────────────────────────────────────────── */

describe("useCardFieldSync", () => {
  const card = { id: "card_1", fieldIds: ["a"] } as unknown as ContactCard;
  const fields = [field({ id: "a", type: "PHONE" }), field({ id: "b", type: "EMAIL" }), field({ id: "c", type: "URL" })];

  beforeEach(() => {
    setFields.mockReset();
    vi.useFakeTimers();
  });

  async function load() {
    const { useCardFieldSync, SYNC_DELAY_MS } = await import("@/components/profile/use-card-field-sync");
    const onError = vi.fn();
    const hook = renderHook(() => useCardFieldSync({ fields, onError }));
    return { hook, onError, delay: SYNC_DELAY_MS };
  }

  it("shows a toggle at once and folds a burst of taps into one full-set write", async () => {
    setFields.mockResolvedValue({});
    const { hook, delay } = await load();

    act(() => hook.result.current.toggle(card, "b", true));
    act(() => hook.result.current.toggle(card, "c", true));
    act(() => hook.result.current.toggle(card, "a", false));
    expect(hook.result.current.fieldIdsFor(card)).toEqual(["b", "c"]);
    expect(hook.result.current.statusFor(card.id)).toBe("pending");
    expect(setFields).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(delay);
    });
    expect(setFields).toHaveBeenCalledTimes(1);
    expect(setFields).toHaveBeenCalledWith("card_1", {
      fields: [
        { fieldId: "b", visible: true },
        { fieldId: "c", visible: true },
      ],
    });
    expect(hook.result.current.statusFor(card.id)).toBe("saved");
    vi.useRealTimers();
  });

  it("keeps the set and offers a retry when the write fails", async () => {
    setFields.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
    const { hook, onError, delay } = await load();

    act(() => hook.result.current.toggle(card, "b", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(delay);
    });
    expect(onError).toHaveBeenCalled();
    expect(hook.result.current.statusFor(card.id)).toBe("error");
    expect(hook.result.current.fieldIdsFor(card), "the toggle was not lost").toEqual(["a", "b"]);

    await act(async () => {
      hook.result.current.retry(card.id);
      await vi.runAllTimersAsync();
    });
    expect(setFields).toHaveBeenCalledTimes(2);
    expect(hook.result.current.statusFor(card.id)).toBe("saved");
    vi.useRealTimers();
  });
});
