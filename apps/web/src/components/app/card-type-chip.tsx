"use client";

import { chipClassName, type ChipSize } from "@/components/primitives/chip";
import type { CardType } from "@/types/domain";

/**
 * `CardTypeChip` — the `CardType` marker that appears wherever a card is listed
 * (spec §8D.3: the cards list, the dashboard tile, the card detail header).
 *
 * A `--radius-full` pill on the `--accent-wash` ground (§8.6), and **never a control**: the
 * type of a card is a fact about it, not a filter the reader can toggle. `<Chip interactive>`
 * exists for the filter case and belongs to the screen that owns the filter.
 *
 * ⚠ `"use client"` is deliberate. `chipClassName` lives in a client module, so calling it
 * during a server render would fail on a client reference; the directive keeps the import
 * client-to-client. Nothing here holds state.
 *
 * The pill is built from `chipClassName` rather than `<Chip>` because the static branch of
 * that component does not forward extra attributes, and `data-card-type` is the handle the
 * screen suites address a tile by (§13.2's convention).
 */

/**
 * The four §5.1 `CardType`s in the owner's language. `Record<CardType, string>` on purpose:
 * a fifth type is a compile error here rather than a chip that renders its own enum name.
 */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Custom",
};

export interface CardTypeChipProps {
  type: CardType;
  /** `sm` in a tile caption, `md` beside a page title. */
  size?: ChipSize;
  className?: string;
}

export function CardTypeChip({ type, size = "sm", className }: CardTypeChipProps) {
  return (
    <span
      data-card-type={type}
      className={chipClassName({ tone: "accent", size, className })}
    >
      {CARD_TYPE_LABELS[type]}
    </span>
  );
}
