/**
 * The shared `(app)` vocabulary (plan T17; spec §8D.3).
 *
 * Six screen tracks — dashboard, cards list, card detail, builder, contacts, profile —
 * compose these seven components. They live here, in one directory owned by one track,
 * precisely so those six never fight over the same file and never grow six subtly different
 * versions of the same row.
 *
 * Two of them carry guarantees that cannot be re-implemented locally:
 * · `FieldCountMeter` reads `canBuildVcf` (T11) — the single definition of "this card shares
 *   nothing" (AC-36). Never count fields at a call site.
 * · `FieldList` renders T12's rows verbatim: `context`, `rel="noopener noreferrer"` on every
 *   external destination (AC-32), masked values with no reveal control (AC-33), and the
 *   §6.4 order the `.vcf` is written in.
 */

export { StatRow } from "./stat-row";
export type { StatRowProps, StatSpec } from "./stat-row";

export { CardThumbTile } from "./card-thumb-tile";
export type { CardThumbTileProps } from "./card-thumb-tile";

export { ContactRow } from "./contact-row";
export type { ContactRowProps } from "./contact-row";

export { FIELD_CATEGORY_LABELS, FieldList } from "./field-list";
export type { FieldListProps } from "./field-list";

export { EMPTY_CARD_NOTE, FieldCountMeter, fieldCountLabel } from "./field-count-meter";
export type { FieldCountMeterProps } from "./field-count-meter";

export { CARD_TYPE_LABELS, CardTypeChip } from "./card-type-chip";
export type { CardTypeChipProps } from "./card-type-chip";

