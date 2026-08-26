import { describe, expect, it } from "vitest";

import { SURFACE_DEFAULTS, resolveCardSurface } from "@/card/card-surface";
import { resolveCard } from "@/card/resolve-card";
import { seedFieldIds } from "@/card/template-seed";
import { TEMPLATES } from "@/card/templates";
import {
  BUILDER_NEW_CARD_NAME,
  BUILDER_PREVIEW_SLUG,
  applyFieldValues,
  builderCard,
  builderProfileEdits,
  builderInitialState,
  builderReducer,
  type BuilderAction,
  type BuilderState,
} from "@/components/builder/builder-reducer";
import { cardEmptyDemo, cardLedgerDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ProfileField } from "@/types/domain";
import type { TemplateId } from "@/card/template-types";

/**
 * The card builder's reducer — spec §8D.4, §11 E-01, E-40, E-42, AC-29, AC-36, plan T23.
 *
 * ## What this file is actually guarding
 *
 * The builder has **one commit affordance and no wizard**: every control writes straight into
 * this state and the preview re-renders from it. So this reducer *is* the builder's behaviour,
 * and the four recorded failures of the old build are all reachable from here:
 *
 *  · **The template choice that was thrown away on Create.** `templateId` and `paletteId` are
 *    state, and `builderCard` puts them on the card the preview resolves — so a chosen
 *    template cannot fail to reach the card.
 *  · **The card that shipped mapping nothing.** The reducer does not decide that (`canBuildVcf`
 *    is the single definition and the component reads it) but it must never silently drop the
 *    owner's ticks, which is what would produce it.
 *  · **§11 E-42, rapid switching.** Folding ten template selections must settle on the last.
 *  · **§11 E-40, the profile moving underneath.** Ids the profile no longer has are *kept*, not
 *    quietly deleted, and `resolveCard` reports them.
 *
 * ## The one rule that is easy to get backwards
 *
 * A **template** is what the card is *for*; a **palette** is what it looks like. They were one
 * field once, and separating them is the reason both exist. So:
 *
 *   · a template switch may re-seed the fields and adopt the template's default colour —
 *     **but only while the owner has not made that choice themselves**;
 *   · a colour the owner picked by hand **survives every later template switch**. Overwriting
 *     it would put them back to picking the business template to get a navy personal card,
 *     which is the exact model the split removed.
 *
 * ## The material system's four axes are guarded here for the same reason
 *
 * The Design panel's controls — free ground colour, wallpaper style, pattern and header layout —
 * are reducer actions, so the claims worth making about them are claims about this function and
 * are made without a browser. Three of them are behaviour rather than storage, and each has its
 * own test below:
 *
 *  · **a preset and a free colour are one axis.** Choosing a preset clears `groundHex`; choosing
 *    a free colour leaves `paletteId` in place as the fallback it is. A state that held both at
 *    once would need a precedence rule the owner never saw.
 *  · **a motif survives leaving pattern mode.** The Pattern control is hidden while the style is
 *    not `pattern`, and a `patternId` that reset itself in the meantime would turn coming back
 *    into a re-decision.
 *  · **a header layout changes composition and nothing else.** Never `fieldIds` — a look that
 *    dropped a field would be a card lying about what it shares.
 *
 * Pure functions only: no DOM, no clock, no geometry (§14.6).
 */

const seedFor = (templateId: TemplateId) =>
  seedFieldIds(templateId, fixtureGroups, fixtureFields);

/** `/cards/new` — nothing exists yet, so the default template's preset is the opening state. */
function newState(): BuilderState {
  return builderInitialState({
    card: null,
    userId: fixtureUser.id,
    seed: seedFor("meridian"),
  });
}

/** `/cards/[cardId]/edit` — the card is the whole input. */
function editState(card = cardLedgerDemo): BuilderState {
  return builderInitialState({ card, userId: fixtureUser.id, seed: [] });
}

/** Fold a list of actions, the way `useReducer` would. */
function run(state: BuilderState, ...actions: readonly BuilderAction[]): BuilderState {
  return actions.reduce(builderReducer, state);
}

const template = (templateId: TemplateId): BuilderAction => ({
  kind: "template",
  templateId,
  seed: seedFor(templateId),
});

/* ── opening state ───────────────────────────────────────────────────────────────────── */

describe("opening on a new card (/cards/new)", () => {
  it("opens on the first template, its default colour and its preset", () => {
    const state = newState();

    expect(state.cardId).toBeNull();
    expect(state.templateId).toBe("meridian");
    expect(state.paletteId).toBe(TEMPLATES.meridian.paletteId);
    expect(state.fieldIds).toEqual(["field_work_phone", "field_work_email"]);
  });

  it("stamps the card type the template implies, so the face has a role tag", () => {
    expect(newState().cardType).toBe("BUSINESS");
    expect(run(newState(), template("marigold")).cardType).toBe("PERSONAL");
  });

  it("names the card in words rather than leaving the field blank", () => {
    expect(newState().name).toBe(BUILDER_NEW_CARD_NAME);
    expect(BUILDER_NEW_CARD_NAME.trim().length).toBeGreaterThan(0);
  });

  it("has made no choices yet, and nothing to save", () => {
    const state = newState();
    expect(state.paletteChosen).toBe(false);
    expect(state.fieldsTouched).toBe(false);
    expect(state.dirty).toBe(false);
    expect(state.saveCount).toBe(0);
  });

  /**
   * §11 E-08 / `?state=empty`: an empty profile satisfies no preset, so a new card opens
   * mapping nothing — which is §11 E-01, shown rather than papered over.
   */
  it("opens mapping nothing when the profile has nothing to seed from", () => {
    const state = builderInitialState({ card: null, userId: fixtureUser.id, seed: [] });
    expect(state.fieldIds).toEqual([]);
  });
});

describe("opening on an existing card (/cards/[cardId]/edit)", () => {
  it("mirrors the card exactly — the builder edits what is there, not a copy of a default", () => {
    const state = editState();

    expect(state.cardId).toBe(cardLedgerDemo.id);
    expect(state.name).toBe(cardLedgerDemo.name);
    expect(state.cardType).toBe(cardLedgerDemo.type);
    expect(state.slug).toBe(cardLedgerDemo.slug);
    expect(state.templateId).toBe(cardLedgerDemo.templateId);
    expect(state.fieldIds).toEqual([...cardLedgerDemo.fieldIds]);
    expect(state.dirty).toBe(false);
  });

  it("falls back to the template's colour for a card that never chose one", () => {
    const state = editState();
    expect(cardLedgerDemo.paletteId).toBeUndefined();
    expect(state.paletteId).toBe(TEMPLATES[cardLedgerDemo.templateId].paletteId);
    // Not chosen — so a later template switch is still free to move it.
    expect(state.paletteChosen).toBe(false);
  });

  it("treats a card's own colour as already chosen, so nothing may overwrite it", () => {
    const state = editState({ ...cardLedgerDemo, paletteId: "oxblood" });
    expect(state.paletteId).toBe("oxblood");
    expect(state.paletteChosen).toBe(true);
  });

  it("opens the zero-field card at zero — never seeded, never repaired", () => {
    // Repairing it would hide §11 E-01 behind a helpful default, which is how the old build
    // shipped a 73-byte card in the first place.
    expect(editState(cardEmptyDemo).fieldIds).toEqual([]);
  });

  it("copies the card's ids rather than aliasing the frozen fixture array", () => {
    expect(editState().fieldIds).not.toBe(cardLedgerDemo.fieldIds);
  });
});

/* ── renaming ────────────────────────────────────────────────────────────────────────── */

describe("renaming", () => {
  it("takes the new name and marks the card unsaved", () => {
    const state = run(editState(), { kind: "rename", name: "Conference" });
    expect(state.name).toBe("Conference");
    expect(state.dirty).toBe(true);
  });

  it("accepts an empty box while typing — the name is not validated mid-keystroke", () => {
    expect(run(editState(), { kind: "rename", name: "" }).name).toBe("");
  });

  it("touches nothing else", () => {
    const before = editState();
    const after = run(before, { kind: "rename", name: "Conference" });
    expect(after.fieldIds).toEqual(before.fieldIds);
    expect(after.templateId).toBe(before.templateId);
    expect(after.paletteId).toBe(before.paletteId);
    expect(after.fieldsTouched).toBe(false);
  });
});

/* ── the template axis ───────────────────────────────────────────────────────────────── */

describe("choosing a template", () => {
  it("re-seeds a new card the owner has not touched", () => {
    const state = run(newState(), template("marigold"));
    expect(state.templateId).toBe("marigold");
    expect(state.fieldIds).toEqual(["field_mobile", "field_personal_email"]);
  });

  it("adopts the template's colour while the owner has not chosen one", () => {
    const state = run(newState(), template("marigold"));
    expect(state.paletteId).toBe(TEMPLATES.marigold.paletteId);
    expect(state.paletteChosen).toBe(false);
  });

  /** The rule stated in the module note, from the palette side. */
  it("never overwrites a colour the owner picked by hand", () => {
    const state = run(
      newState(),
      { kind: "palette", paletteId: "emerald" },
      template("marigold"),
      template("meridian"),
    );
    expect(state.paletteId).toBe("emerald");
    expect(state.templateId).toBe("meridian");
  });

  it("never re-seeds once the owner has ticked something", () => {
    const state = run(
      newState(),
      { kind: "field", fieldId: "field_linkedin", on: true },
      template("marigold"),
    );
    expect(state.templateId).toBe("marigold");
    // Their own set, untouched — the preset does not get to overwrite a decision.
    expect(state.fieldIds).toEqual(["field_work_phone", "field_work_email", "field_linkedin"]);
  });

  /**
   * The important half. A preset is an *opening* offer; on an existing card it is not on
   * offer at all, because "helpfully" replacing five mapped fields with two would be the
   * builder deleting the owner's card in front of them.
   */
  it("never re-seeds an existing card, even one the owner has not touched", () => {
    const state = run(editState(), template("marigold"));
    expect(state.templateId).toBe("marigold");
    expect(state.fieldIds).toEqual([...cardLedgerDemo.fieldIds]);
  });

  it("does not re-seed the existing zero-field card into a non-empty one", () => {
    const state = run(editState(cardEmptyDemo), template("marigold"));
    expect(state.fieldIds).toEqual([]);
  });

  it("marks the card unsaved", () => {
    expect(run(editState(), template("marigold")).dirty).toBe(true);
  });

  it("re-selecting the template already selected changes nothing observable", () => {
    const before = run(newState(), { kind: "field", fieldId: "field_bio", on: true });
    const after = run(before, template("meridian"));
    expect(after.templateId).toBe(before.templateId);
    expect(after.fieldIds).toEqual(before.fieldIds);
    expect(after.paletteId).toBe(before.paletteId);
  });

  /** §11 E-42 — ten selections in two seconds settle on the last, with nothing stale. */
  it("settles on the last of ten rapid selections (E-42)", () => {
    const clicks: readonly TemplateId[] = [
      "meridian",
      "meridian",
      "marigold",
      "meridian",
      "marigold",
      "marigold",
      "marigold",
      "meridian",
      "meridian",
      "marigold",
    ];

    const state = run(newState(), ...clicks.map(template));

    expect(state.templateId).toBe("marigold");
    expect(state.paletteId).toBe(TEMPLATES.marigold.paletteId);
    expect(state.cardType).toBe("PERSONAL");
    expect(state.fieldIds).toEqual(["field_mobile", "field_personal_email"]);
    // Folding the same sequence again lands in the same place: no order-dependent residue.
    expect(run(newState(), ...clicks.map(template))).toEqual(state);
  });
});

/* ── the colour axis ─────────────────────────────────────────────────────────────────── */

describe("choosing a colour", () => {
  it("takes the colour and records that the owner chose it", () => {
    const state = run(newState(), { kind: "palette", paletteId: "onyx" });
    expect(state.paletteId).toBe("onyx");
    expect(state.paletteChosen).toBe(true);
    expect(state.dirty).toBe(true);
  });

  it("leaves the template and the fields alone — the two axes are independent", () => {
    const before = newState();
    const after = run(before, { kind: "palette", paletteId: "pistachio" });
    expect(after.templateId).toBe(before.templateId);
    expect(after.fieldIds).toEqual(before.fieldIds);
    expect(after.cardType).toBe(before.cardType);
  });

  it("lets any palette reach either template — the whole point of the split", () => {
    const business = run(newState(), { kind: "palette", paletteId: "amber" });
    const personal = run(newState(), template("marigold"), {
      kind: "palette",
      paletteId: "sapphire",
    });
    expect([business.templateId, business.paletteId]).toEqual(["meridian", "amber"]);
    expect([personal.templateId, personal.paletteId]).toEqual(["marigold", "sapphire"]);
  });

  it("settles on the last of a rapid run (E-42, from the colour side)", () => {
    const state = run(
      newState(),
      { kind: "palette", paletteId: "oxblood" },
      { kind: "palette", paletteId: "pistachio" },
      { kind: "palette", paletteId: "periwinkle" },
    );
    expect(state.paletteId).toBe("periwinkle");
  });
});

/* ── the material system: one ground, three treatments ───────────────────────────────── */

describe("choosing a free ground colour", () => {
  it("takes the colour, and counts as a colour the owner chose", () => {
    const state = run(newState(), { kind: "ground", hex: "#123456" });
    expect(state.groundHex).toBe("#123456");
    expect(state.paletteChosen).toBe(true);
    expect(state.dirty).toBe(true);
  });

  /**
   * The half that makes the two controls one axis. Without it the card renders the old custom
   * ground while the picker draws a tick on Sapphire — the picker lying about the card.
   */
  it("is cleared by picking a preset, because a preset is the same axis", () => {
    const state = run(
      newState(),
      { kind: "ground", hex: "#123456" },
      { kind: "palette", paletteId: "sapphire" },
    );
    expect(state.groundHex).toBeUndefined();
    expect(state.paletteId).toBe("sapphire");
  });

  /** And the other direction: the preset stays put underneath, as the thing to come back to. */
  it("leaves the curated palette in place as the fallback", () => {
    const state = run(
      newState(),
      { kind: "palette", paletteId: "emerald" },
      { kind: "ground", hex: "#C2410C" },
    );
    expect(state.groundHex).toBe("#C2410C");
    expect(state.paletteId).toBe("emerald");

    // …so clearing the free colour returns to Emerald, not to the template's default.
    expect(run(state, { kind: "palette", paletteId: "emerald" }).paletteId).toBe("emerald");
  });

  it("survives a template switch, like any colour the owner picked by hand", () => {
    const state = run(newState(), { kind: "ground", hex: "#0F172A" }, template("marigold"));
    expect(state.groundHex).toBe("#0F172A");
    expect(state.templateId).toBe("marigold");
  });

  /**
   * §11 E-42 from the axis that generates the most events of any control on the screen: a
   * native colour input fires on every frame of a drag, so a hundred of these in a second is
   * ordinary use rather than an edge case.
   */
  it("settles on the last of a rapid run (E-42)", () => {
    const hexes = ["#111111", "#222222", "#333333", "#444444", "#555555"];
    const state = run(
      newState(),
      ...hexes.map((hex): BuilderAction => ({ kind: "ground", hex })),
    );
    expect(state.groundHex).toBe("#555555");
  });

  it("does not validate or move the colour — the clamp is derivePalette's job, not a refusal", () => {
    // A mid-tone that lands inside `LEGIBILITY_DEAD_BAND`. The reducer stores exactly what the
    // owner picked; the panel shows what the palette engine did about it.
    const state = run(newState(), { kind: "ground", hex: "#7F7F7F" });
    expect(state.groundHex).toBe("#7F7F7F");
  });

  it("leaves the fields and the template alone", () => {
    const before = newState();
    const after = run(before, { kind: "ground", hex: "#123456" });
    expect(after.fieldIds).toEqual(before.fieldIds);
    expect(after.templateId).toBe(before.templateId);
    expect(after.fieldsTouched).toBe(false);
  });
});

describe("choosing a finish, a texture and its dials", () => {
  it("opens on the contract's defaults rather than on a literal of its own", () => {
    const state = newState();
    expect(state.finish).toBe(SURFACE_DEFAULTS.finish);
    expect(state.texture).toBe(SURFACE_DEFAULTS.texture);
    expect(state.texturePresence).toBe(SURFACE_DEFAULTS.texturePresence);
    expect(state.textureScale).toBe(SURFACE_DEFAULTS.textureScale);
    expect(state.groundHex).toBeUndefined();
  });

  it("mirrors a card that already carries a surface", () => {
    const state = editState({
      ...cardLedgerDemo,
      groundHex: "#2E1065",
      finish: "mesh",
      texture: "topo",
      texturePresence: "strong",
      textureScale: "large",
    });

    expect(state.groundHex).toBe("#2E1065");
    expect(state.finish).toBe("mesh");
    expect(state.texture).toBe("topo");
    expect(state.texturePresence).toBe("strong");
    expect(state.textureScale).toBe("large");
    // A card wearing a colour of its own has chosen one, so no preset may overwrite it.
    expect(state.paletteChosen).toBe(true);
    expect(state.dirty).toBe(false);
  });

  /**
   * ⚠ The migration, asserted on a real pre-split card shape.
   *
   * `pattern` meant "flat, plus this motif" and `grain` meant "flat, plus noise". A card that
   * has not been edited since the split must still render exactly what it always did, or the
   * refactor repainted somebody's card behind their back.
   */
  it("migrates a pre-split card without changing what it renders", () => {
    const patterned = editState({
      ...cardLedgerDemo,
      surfaceStyle: "pattern",
      patternId: "topo",
    });
    expect(patterned.finish).toBe("flat");
    expect(patterned.texture).toBe("topo");

    const grained = editState({ ...cardLedgerDemo, surfaceStyle: "grain" });
    expect(grained.finish).toBe("flat");
    expect(grained.texture).toBe("grain");

    const meshed = editState({ ...cardLedgerDemo, surfaceStyle: "mesh" });
    expect(meshed.finish).toBe("mesh");
    expect(meshed.texture).toBe("none");
  });

  it("takes each choice and marks the card unsaved", () => {
    const state = run(
      newState(),
      { kind: "finish", finish: "flat" },
      { kind: "texture", texture: "grid" },
      { kind: "presence", texturePresence: "strong" },
      { kind: "scale", textureScale: "large" },
    );
    expect(state.finish).toBe("flat");
    expect(state.texture).toBe("grid");
    expect(state.texturePresence).toBe("strong");
    expect(state.textureScale).toBe("large");
    expect(state.dirty).toBe(true);
  });

  /**
   * The axes are independent, which is the whole reason there are two of them. Choosing a
   * finish may not disturb the texture and choosing a texture may not disturb the finish — the
   * old single axis could not express this, and its `pattern`/`grain` values silently set both.
   */
  it("keeps finish and texture independent in both directions", () => {
    const textured = run(newState(), { kind: "texture", texture: "topo" });
    expect(textured.texture).toBe("topo");
    expect(textured.finish).toBe(SURFACE_DEFAULTS.finish);

    const refinished = run(textured, { kind: "finish", finish: "mesh" });
    expect(refinished.finish).toBe("mesh");
    expect(refinished.texture).toBe("topo");

    /* `none` is a value, not a clear: it leaves the finish exactly where it was. */
    const bare = run(refinished, { kind: "texture", texture: "none" });
    expect(bare.texture).toBe("none");
    expect(bare.finish).toBe("mesh");
  });

  it("keeps the colour axis out of it", () => {
    const before = run(newState(), { kind: "ground", hex: "#0F172A" });
    const after = run(
      before,
      { kind: "finish", finish: "mesh" },
      { kind: "texture", texture: "grid" },
    );
    expect(after.groundHex).toBe("#0F172A");
    expect(after.paletteId).toBe(before.paletteId);
  });
});

/* ── the field axis ──────────────────────────────────────────────────────────────────── */

describe("ticking fields", () => {
  it("appends a ticked field to the end, keeping the earlier ones in place", () => {
    const state = run(editState(), { kind: "field", fieldId: "field_department", on: true });
    expect(state.fieldIds).toEqual([...cardLedgerDemo.fieldIds, "field_department"]);
  });

  it("removes an unticked field and leaves the rest in order", () => {
    const state = run(editState(), { kind: "field", fieldId: "field_company", on: false });
    expect(state.fieldIds).toEqual(
      cardLedgerDemo.fieldIds.filter((id) => id !== "field_company"),
    );
  });

  it("is idempotent in both directions", () => {
    const on = run(
      editState(),
      { kind: "field", fieldId: "field_department", on: true },
      { kind: "field", fieldId: "field_department", on: true },
    );
    expect(on.fieldIds.filter((id) => id === "field_department")).toHaveLength(1);

    const off = run(
      editState(),
      { kind: "field", fieldId: "field_company", on: false },
      { kind: "field", fieldId: "field_company", on: false },
    );
    expect(off.fieldIds).not.toContain("field_company");
  });

  it("can empty a card completely — the E-01 state is reachable by unticking", () => {
    const state = run(
      newState(),
      ...newState().fieldIds.map(
        (fieldId): BuilderAction => ({ kind: "field", fieldId, on: false }),
      ),
    );
    expect(state.fieldIds).toEqual([]);
  });

  it("records that the owner has taken over, so no preset overwrites them later", () => {
    const state = run(newState(), { kind: "field", fieldId: "field_bio", on: true });
    expect(state.fieldsTouched).toBe(true);
    expect(state.dirty).toBe(true);
  });

  /**
   * §11 E-40. Ids the profile no longer has have no checkbox, so the only thing the reducer
   * can do correctly is keep them: dropping them silently would be the builder editing the
   * card behind the owner's back. `resolveCard` is what reports them.
   */
  it("keeps ids the profile no longer has, and the resolver reports them (E-40)", () => {
    const state = editState({
      ...cardLedgerDemo,
      fieldIds: [...cardLedgerDemo.fieldIds, "field_that_left"],
    });

    expect(state.fieldIds).toContain("field_that_left");

    const resolved = resolveCard(
      builderCard(state),
      fixtureUser,
      fixtureGroups,
      fixtureFields,
    );
    expect(resolved.droppedFieldIds).toEqual(["field_that_left"]);
    // Never a ghost row (I-2).
    expect(resolved.fields.some((field) => field.id === "field_that_left")).toBe(false);
  });
});

/* ── saving ──────────────────────────────────────────────────────────────────────────── */

describe("saving", () => {
  it("counts the commit and clears the unsaved flag", () => {
    const state = run(editState(), { kind: "rename", name: "Conference" }, { kind: "save" });
    expect(state.saveCount).toBe(1);
    expect(state.dirty).toBe(false);
  });

  it("changes nothing about the card itself", () => {
    const before = run(editState(), { kind: "rename", name: "Conference" });
    const after = run(before, { kind: "save" });
    expect(builderCard(after)).toEqual(builderCard(before));
  });

  it("does not reset the owner's choices — a saved card is still their card", () => {
    const state = run(
      newState(),
      { kind: "palette", paletteId: "emerald" },
      { kind: "field", fieldId: "field_bio", on: true },
      { kind: "save" },
    );
    expect(state.paletteChosen).toBe(true);
    expect(state.fieldsTouched).toBe(true);
    expect(state.paletteId).toBe("emerald");
  });
});

/* ── the card the preview and the payload share (I-5) ────────────────────────────────── */

describe("builderCard", () => {
  it("carries the chosen template and colour onto the card", () => {
    const state = run(newState(), template("marigold"), {
      kind: "palette",
      paletteId: "onyx",
    });
    const card = builderCard(state);

    expect(card.templateId).toBe("marigold");
    expect(card.paletteId).toBe("onyx");
  });

  /**
   * ⚠ The material system's whole integration seam: the four axes have to be **on the card**,
   * because the card is the one object the screen resolves and the renderer reads. A Design
   * panel that painted its own preview instead would be the old build's "the previewed file
   * differs from the sent file", in a new costume.
   */
  it("carries every surface axis onto the card", () => {
    const state = run(
      newState(),
      { kind: "ground", hex: "#2E1065" },
      { kind: "finish", finish: "flat" },
      { kind: "texture", texture: "topo" },
      { kind: "presence", texturePresence: "strong" },
    );
    const card = builderCard(state);

    expect(card.groundHex).toBe("#2E1065");
    expect(resolveCardSurface(card)).toEqual({
      finish: "flat",
      texture: "topo",
      texturePresence: "strong",
      textureScale: "regular",
    });
  });

  /**
   * `undefined` and *absent* are the same thing to a reader and different things to a writer.
   * `CardSurface.groundHex`'s contract says absent means "use the palette the card already
   * resolves to", so a card on a preset must not carry the key at all.
   */
  it("omits groundHex entirely while the card is on a preset", () => {
    const card = builderCard(run(newState(), { kind: "palette", paletteId: "sapphire" }));
    expect("groundHex" in card).toBe(false);
    expect(card.paletteId).toBe("sapphire");
  });

  it("stops carrying a free ground the moment a preset is picked again", () => {
    const card = builderCard(
      run(
        newState(),
        { kind: "ground", hex: "#2E1065" },
        { kind: "palette", paletteId: "clay" },
      ),
    );
    expect("groundHex" in card).toBe(false);
  });

  /** An untouched card states the defaults, which is the same card the contract resolves. */
  it("states the surface defaults for a card that has chosen nothing", () => {
    expect(resolveCardSurface(builderCard(newState()))).toEqual(SURFACE_DEFAULTS);
  });

  it("resolves to a card whose palette is the owner's choice, not the template's default", () => {
    const state = run(newState(), { kind: "palette", paletteId: "oxblood" });
    const resolved = resolveCard(
      builderCard(state),
      fixtureUser,
      fixtureGroups,
      fixtureFields,
    );
    expect(resolved.palette.id).toBe("oxblood");
    expect(resolved.template.id).toBe("meridian");
  });

  it("keeps an existing card's own id and slug", () => {
    const card = builderCard(editState());
    expect(card.id).toBe(cardLedgerDemo.id);
    expect(card.slug).toBe(cardLedgerDemo.slug);
    expect(card.userId).toBe(cardLedgerDemo.userId);
  });

  /**
   * A card that has not been saved has no public URL, so the preview encodes a placeholder
   * rather than a URL that would 404 if somebody scanned it off the screen.
   */
  it("gives an unsaved card a stable placeholder slug", () => {
    const card = builderCard(newState());
    expect(card.slug).toBe(BUILDER_PREVIEW_SLUG);
    expect(BUILDER_PREVIEW_SLUG).toMatch(/^[a-z0-9-]{1,24}$/);
    // It must not be addressable as a real card id either (§11 E-38, AC-05).
    expect(card.id.startsWith("card_")).toBe(true);
  });

  it("produces a real QR payload for a brand-new card", () => {
    const resolved = resolveCard(
      builderCard(newState()),
      fixtureUser,
      fixtureGroups,
      fixtureFields,
    );
    expect(resolved.qrPayload).toContain(`/c/${BUILDER_PREVIEW_SLUG}`);
    expect(new TextEncoder().encode(resolved.qrPayload).length).toBeLessThanOrEqual(60);
  });

  it("hands back the state's ids without aliasing them", () => {
    const state = editState();
    expect(builderCard(state).fieldIds).toEqual([...state.fieldIds]);
    expect(builderCard(state).fieldIds).not.toBe(state.fieldIds);
  });
});

/* ── purity (I-4) ────────────────────────────────────────────────────────────────────── */

describe("purity", () => {
  it("never mutates the state it is handed", () => {
    const before = editState();
    const snapshot = JSON.stringify(before);

    builderReducer(before, { kind: "rename", name: "Conference" });
    builderReducer(before, template("marigold"));
    builderReducer(before, { kind: "palette", paletteId: "pistachio" });
    builderReducer(before, { kind: "ground", hex: "#2E1065" });
    builderReducer(before, { kind: "finish", finish: "mesh" });
    builderReducer(before, { kind: "texture", texture: "topo" });
    builderReducer(before, { kind: "presence", texturePresence: "strong" });
    builderReducer(before, { kind: "scale", textureScale: "large" });
    builderReducer(before, { kind: "field", fieldId: "field_department", on: true });
    builderReducer(before, { kind: "save" });

    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("is a function of its arguments — same state, same action, same result", () => {
    const state = editState();
    expect(builderReducer(state, template("marigold"))).toEqual(
      builderReducer(state, template("marigold")),
    );
  });

  it("returns a new object for every action, so React sees the change", () => {
    const state = editState();
    for (const action of [
      { kind: "rename", name: "Conference" },
      template("marigold"),
      { kind: "palette", paletteId: "pistachio" },
      { kind: "ground", hex: "#2E1065" },
      { kind: "finish", finish: "mesh" },
      { kind: "texture", texture: "topo" },
      { kind: "presence", texturePresence: "strong" },
      { kind: "scale", textureScale: "large" },
      { kind: "field", fieldId: "field_department", on: true },
      { kind: "save" },
    ] as const satisfies readonly BuilderAction[]) {
      expect(builderReducer(state, action)).not.toBe(state);
    }
  });
});

/**
 * Editing a field's VALUE — the axis that is not on the card.
 *
 * Every other axis this reducer holds ends up on the `ContactCard` that `builderCard` returns.
 * A value does not, and must not: values live on `ProfileField`, one copy, shared by every card
 * that maps the field (PRODUCT.md — "a card is a filter over the owner's profile, not a copy").
 * The first card to save a copy would fork the owner's phone number.
 */
describe("editing a field value", () => {
  it("holds the edit, marks the card unsaved, and leaves the field list alone", () => {
    const before = editState();
    const after = run(before, { kind: "value", fieldId: "field_company", value: "Fernwood Labs" });

    expect(after.fieldValues).toEqual({ field_company: "Fernwood Labs" });
    expect(after.dirty).toBe(true);
    // Editing a value is not adding or removing a field.
    expect(after.fieldIds).toEqual(before.fieldIds);
    expect(after.fieldsTouched).toBe(before.fieldsTouched);
  });

  it("stores a blank exactly as typed, and does not trim or reject it", () => {
    /* §11 E-07 is `resolveCard`'s rule and it is applied where the card is built. A reducer
       that trimmed or refused here would make the panel and the card disagree about what was
       typed, and the owner would be arguing with a text box that edits itself. */
    const state = run(editState(), { kind: "value", fieldId: "field_company", value: "  " });
    expect(state.fieldValues.field_company).toBe("  ");
  });

  it("keeps an edit for a field that is then taken off the card", () => {
    /* The value belongs to the profile, so un-mapping the field from *this* card does not undo
       an edit that every other card is also wearing. */
    const state = run(
      editState(),
      { kind: "value", fieldId: "field_company", value: "Fernwood Labs" },
      { kind: "field", fieldId: "field_company", on: false },
    );
    expect(state.fieldIds).not.toContain("field_company");
    expect(state.fieldValues.field_company).toBe("Fernwood Labs");
  });

  it("opens with no edits, so nothing looks edited and `dirty` still means something", () => {
    expect(newState().fieldValues).toEqual({});
    expect(editState().fieldValues).toEqual({});
    expect(editState().dirty).toBe(false);
  });

  /** ⚠ The card carries no values. If this ever fails, a card has forked the profile. */
  it("puts no field value on the card builderCard returns", () => {
    const state = run(editState(), {
      kind: "value",
      fieldId: "field_company",
      value: "Fernwood Labs",
    });
    expect(JSON.stringify(builderCard(state))).not.toContain("Fernwood Labs");
    expect(builderProfileEdits(state)).toEqual({ field_company: "Fernwood Labs" });
  });
});

describe("applyFieldValues", () => {
  const fields = [
    { id: "a", groupId: "g", type: "COMPANY", label: "Company", value: "Old", isSensitive: false },
    { id: "b", groupId: "g", type: "EMAIL", label: "Email", value: "x@example.com", isSensitive: false },
  ] as const satisfies readonly ProfileField[];

  it("overlays only the fields that were edited", () => {
    const out = applyFieldValues(fields, { a: "New" });
    expect(out.map((f) => f.value)).toEqual(["New", "x@example.com"]);
    // The originals are not mutated — the fixtures are frozen and shared.
    expect(fields[0].value).toBe("Old");
  });

  /* ⚠ Identity, not just equality. Every `useMemo` downstream is keyed on this array, and a new
     array on every render would re-resolve the whole card on every keystroke anywhere. */
  it("returns the very same array when nothing is edited", () => {
    expect(applyFieldValues(fields, {})).toBe(fields);
  });

  it("ignores an id the profile does not have", () => {
    expect(applyFieldValues(fields, { gone: "x" }).map((f) => f.value)).toEqual([
      "Old",
      "x@example.com",
    ]);
  });
});
