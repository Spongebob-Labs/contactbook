/**
 * Allowed values for the two closed, backend-validated appearance fields.
 * `finish` / `texture` / `texturePresence` / `textureScale` are deliberately
 * NOT enumerated here yet — FE owns that value set and hasn't handed over the
 * exact strings (see the card-appearance backend ask). They're stored as
 * loosely-validated text for now; tighten to @IsIn(...) here once FE gives us
 * the lists, the same way templateId/paletteId are done below.
 */
export const CARD_TEMPLATE_IDS = ['meridian', 'marigold'] as const;

export const CARD_PALETTE_IDS = [
  'onyx',
  'sapphire',
  'emerald',
  'oxblood',
  'rust',
  'amber',
  'clay',
  'pistachio',
  'periwinkle',
] as const;

export const GROUND_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
