/**
 * Allowed values for the closed, backend-validated appearance fields. All
 * six of these are now enumerated per the frontend's card-appearance spec
 * (2026-09-20) — `finish`/`texture`/`texturePresence`/`textureScale` used to
 * be loosely-validated free text pending that handoff; they're tightened to
 * @IsIn(...) here now that it's arrived.
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
  'mint',
  'ivory',
] as const;

export const CARD_FINISH_IDS = ['flat', 'gradient', 'mesh'] as const;

export const CARD_TEXTURE_IDS = [
  'none',
  'grain',
  'grid',
  'dots',
  'topo',
] as const;

export const CARD_TEXTURE_PRESENCE_IDS = [
  'subtle',
  'medium',
  'strong',
] as const;

export const CARD_TEXTURE_SCALE_IDS = ['fine', 'regular', 'large'] as const;

export const GROUND_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
