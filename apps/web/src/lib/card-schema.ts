import { z } from "zod";

/**
 * The published card snapshot — the single contract between the builder, the
 * public card page, and the `publishedSnapshot` JSONB column on the API.
 *
 * The API stores and serves this verbatim and never interprets it, so this file
 * is the only place the shape is defined. Adding a layout, theme knob or block
 * type is a change here and nowhere else — deliberately, so customization work
 * never costs a database migration.
 *
 * Bump `CARD_SNAPSHOT_VERSION` on any breaking change and teach
 * `parseCardSnapshot` how to read the old shape. Cards already published carry
 * the old version forever, and their QR codes are in strangers' phones.
 */
export const CARD_SNAPSHOT_VERSION = 1;

/**
 * Photos ride inline as data URLs for now. The cap keeps a snapshot inside the
 * API's 2mb JSON body limit with room to spare; revisit when photos move to GCS.
 */
export const PHOTO_MAX_CHARS = 400_000;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Expected a hex colour like #1B2430");

/** Three real layouts. Everything else that looks like a "template" is a theme. */
export const cardLayoutSchema = z.enum(["stack", "cardface", "compact"]);

export const cardBackgroundSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid"), color: hexColor }),
  z.object({
    kind: z.literal("gradient"),
    from: hexColor,
    to: hexColor,
    angle: z.number().min(0).max(360),
  }),
  z.object({
    kind: z.literal("image"),
    url: z.string().max(PHOTO_MAX_CHARS),
    /** Scrim strength so text stays legible over a busy photo. */
    overlay: z.number().min(0).max(1),
  }),
]);

/**
 * Font pairings are named for their *character*, not for a specific typeface.
 * Only Inter is bundled today, so these currently resolve to system stacks —
 * swapping in real webfonts later is a change in `card-themes.ts` alone and
 * needs no schema bump, which matters because published cards carry these ids
 * forever.
 */
export const cardFontPairSchema = z.enum([
  "sans",
  "serif-display",
  "serif",
  "geometric",
  "humanist",
  "mono",
]);

export const cardButtonStyleSchema = z.enum([
  "filled",
  "outline",
  "soft",
  "shadow",
]);

export const cardCornerSchema = z.enum(["sharp", "soft", "round", "pill"]);

export const cardThemeSchema = z.object({
  /** Preset id when unmodified, "custom" once the user edits a value. */
  id: z.string().min(1).max(60),
  background: cardBackgroundSchema,
  textColor: hexColor,
  accent: hexColor,
  fontPair: cardFontPairSchema,
  buttonStyle: cardButtonStyleSchema,
  corners: cardCornerSchema,
});

export const cardIdentitySchema = z.object({
  photo: z.string().max(PHOTO_MAX_CHARS).default(""),
  displayName: z.string().min(1).max(120),
  title: z.string().max(160).default(""),
  company: z.string().max(160).default(""),
  bio: z.string().max(400).default(""),
});

/**
 * Structured contact methods — this is the half that keeps a ContactBook card
 * different from a Linktree page. vCard export and the Wallet pass face read
 * from here, so it stays typed rather than collapsing into the block list.
 */
export const cardContactTypeSchema = z.enum([
  "phone",
  "email",
  "website",
  "address",
]);

export const cardContactMethodSchema = z.object({
  id: z.string().min(1).max(64),
  type: cardContactTypeSchema,
  label: z.string().max(60).default(""),
  value: z.string().min(1).max(400),
  visible: z.boolean().default(true),
});

export const cardSocialPlatformSchema = z.enum([
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "github",
  "youtube",
  "tiktok",
  "whatsapp",
  "telegram",
]);

export const cardSocialSchema = z.object({
  id: z.string().min(1).max(64),
  platform: cardSocialPlatformSchema,
  url: z.string().min(1).max(500),
  visible: z.boolean().default(true),
});

/** The Linktree half: free-form, reorderable, add whatever you like. */
export const cardBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("link"),
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    url: z.string().min(1).max(500),
    description: z.string().max(200).default(""),
    visible: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("heading"),
    id: z.string().min(1).max(64),
    text: z.string().min(1).max(120),
    visible: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("text"),
    id: z.string().min(1).max(64),
    text: z.string().min(1).max(600),
    visible: z.boolean().default(true),
  }),
]);

export const cardSnapshotSchema = z.object({
  v: z.literal(CARD_SNAPSHOT_VERSION),
  layout: cardLayoutSchema,
  theme: cardThemeSchema,
  identity: cardIdentitySchema,
  contact: z.array(cardContactMethodSchema).max(20),
  socials: z.array(cardSocialSchema).max(12),
  blocks: z.array(cardBlockSchema).max(50),
});

export type CardLayout = z.infer<typeof cardLayoutSchema>;
export type CardBackground = z.infer<typeof cardBackgroundSchema>;
export type CardFontPair = z.infer<typeof cardFontPairSchema>;
export type CardButtonStyle = z.infer<typeof cardButtonStyleSchema>;
export type CardCorner = z.infer<typeof cardCornerSchema>;
export type CardContactType = z.infer<typeof cardContactTypeSchema>;
export type CardSocialPlatform = z.infer<typeof cardSocialPlatformSchema>;
export type CardTheme = z.infer<typeof cardThemeSchema>;
export type CardIdentity = z.infer<typeof cardIdentitySchema>;
export type CardContactMethod = z.infer<typeof cardContactMethodSchema>;
export type CardSocial = z.infer<typeof cardSocialSchema>;
export type CardBlock = z.infer<typeof cardBlockSchema>;
export type CardSnapshot = z.infer<typeof cardSnapshotSchema>;

export const DEFAULT_CARD_THEME: CardTheme = {
  id: "midnight",
  background: { kind: "solid", color: "#1B2430" },
  textColor: "#F8F7F4",
  accent: "#C4A882",
  fontPair: "sans",
  buttonStyle: "filled",
  corners: "round",
};

export function emptyCardSnapshot(displayName: string): CardSnapshot {
  return {
    v: CARD_SNAPSHOT_VERSION,
    layout: "stack",
    theme: DEFAULT_CARD_THEME,
    identity: {
      photo: "",
      displayName: displayName.trim() || "Untitled card",
      title: "",
      company: "",
      bio: "",
    },
    contact: [],
    socials: [],
    blocks: [],
  };
}

export type ParsedCardSnapshot =
  | { ok: true; snapshot: CardSnapshot }
  | { ok: false; reason: "unsupported-version" | "malformed"; message: string };

/**
 * Tolerant read for the public card page.
 *
 * Returns a discriminated result rather than throwing, because a stranger who
 * scanned a QR must never be shown a blank screen or a stack trace — a card
 * published by a newer client than the one they loaded should still render a
 * clear message.
 */
export function parseCardSnapshot(value: unknown): ParsedCardSnapshot {
  const version = (value as { v?: unknown } | null)?.v;

  if (typeof version === "number" && version > CARD_SNAPSHOT_VERSION) {
    return {
      ok: false,
      reason: "unsupported-version",
      message: "This card was published with a newer version of ContactBook.",
    };
  }

  const parsed = cardSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "malformed",
      message: "This card could not be displayed.",
    };
  }

  return { ok: true, snapshot: parsed.data };
}

/**
 * Move the block with `activeId` to where `overId` sits.
 *
 * Kept here as a pure function rather than inline in the drag handler so the
 * reordering rule is testable without a browser or a pointer device — the drag
 * library is responsible for gestures, not for what the move means.
 * Returns the original array when either id is unknown.
 */
export function reorderBlocks(
  blocks: CardBlock[],
  activeId: string,
  overId: string,
): CardBlock[] {
  const from = blocks.findIndex((block) => block.id === activeId);
  const to = blocks.findIndex((block) => block.id === overId);

  if (from < 0 || to < 0 || from === to) {
    return blocks;
  }

  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Visible entries only, in author order — what both the preview and the public page render. */
export function visibleBlocks(snapshot: CardSnapshot): CardBlock[] {
  return snapshot.blocks.filter((block) => block.visible);
}

export function visibleContactMethods(
  snapshot: CardSnapshot,
): CardContactMethod[] {
  return snapshot.contact.filter((method) => method.visible);
}

export function visibleSocials(snapshot: CardSnapshot): CardSocial[] {
  return snapshot.socials.filter((social) => social.visible);
}
