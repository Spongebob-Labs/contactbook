/**
 * The template registry.
 *
 * Two templates, and only two.
 *
 * There were eight, one per palette, which collapsed "which card is this for" and "what colour
 * is it" into a single decision that answered neither well. A template is now purely the
 * *purpose* — the fields it starts with — and every palette is reachable from both:
 *
 *   · one per category, so the gallery's filter rail is never empty;
 *   · each defaults to a palette that suits it — Meridian to Sapphire, Marigold to Amber — while
 *     all nine palettes stay available to both. Colour is the user's choice, not the
 *     template's identity.
 *
 * This file is data. It holds no colour — `paletteId` points into `template-palettes.ts`, which
 * means every template here is already covered by the palette contrast suite and a template is
 * structurally incapable of introducing an untested colour. That inverts the previous build's
 * arrangement, where colour was centralised and *variety* was the thing made impossible.
 *
 * It also holds no LAYOUT. The face format is a constant of `<ShareFace>`, identical on all
 * eight: brand mark left and portrait right, a role tag over the name, up to two detail pairs
 * then the link, and the QR centred at the foot. A template chooses a palette and the weight of
 * its name. Nothing else moves — somebody handed one of these cards should already know where
 * to look on every other one.
 *
 * `Record<TemplateId, CardTemplate>` is load-bearing: adding an id to `TemplateId` without a
 * record here fails `tsc --noEmit`, so `TEMPLATES[card.templateId]` can never be undefined.
 */

import type { CardTemplate, TemplateId } from "../template-types";

export const TEMPLATES: Record<TemplateId, CardTemplate> = {
  meridian: {
    id: "meridian",
    name: "Meridian",
    blurb: "For work. Starts with your work number and work email.",
    category: "business",
    paletteId: "sapphire",
    pageHeader: "band",
    type: { nameWeight: 560, nameTracking: -0.026 },
    shape: { buttonShape: "rounded" },
    photoSrc: null,
    qrZone: { plate: "solid" },
  },

  marigold: {
    id: "marigold",
    name: "Marigold",
    blurb: "For everyone else. Starts with your mobile and personal email.",
    category: "personal",
    paletteId: "amber",
    pageHeader: "band",
    type: { nameWeight: 600, nameTracking: -0.028 },
    shape: { buttonShape: "pill" },
    photoSrc: null,
    qrZone: { plate: "solid" },
  },
};

/** Gallery order. Declaration order of the record is not guaranteed to be stable enough. */
export const TEMPLATE_ORDER: readonly TemplateId[] = ["meridian", "marigold"];

/**
 * The array form, in gallery order. Derived rather than hand-listed so it cannot drift from
 * `TEMPLATES` — a template present in one and missing from the other was a real class of bug
 * in the previous registry.
 */
export const TEMPLATE_LIST: readonly CardTemplate[] = TEMPLATE_ORDER.map((id) => TEMPLATES[id]);

export { TEMPLATES as default };
