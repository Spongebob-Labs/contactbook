import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";
import type { DataScreenState } from "@/lib/screen-state";
import type { ScreenState } from "@/types/domain";

/**
 * The root wrapper every data screen renders, and the one DOM contract the whole state
 * matrix hangs from (spec §13.2, AC-24).
 *
 * `data-screen-state` is **not** debug cruft. T29's `states.spec.ts` and `a11y.spec.ts`
 * sweep nineteen routes × every applicable `?state=` value × three viewports by reading
 * this attribute, so a screen that forgets it — or spells it differently — fails AC-24
 * and AC-25 at once. The rule from plan §0.5 is literal: the client component's **root
 * element** carries it, not a child of the root.
 *
 * ```tsx
 * const { state, data } = useFixture((db) => db.cards);
 * const screenState = resolveDataScreenState({
 *   state,
 *   isEmpty: (data ?? []).length === 0,
 *   isFiltered: query.length > 0,
 * });
 *
 * return (
 *   <ScreenStateRoot state={screenState} as="section" aria-label="Cards">
 *     {screenState === 'loading' ? <LoadingSkeleton variant="card-grid" /> : null}
 *     …
 *   </ScreenStateRoot>
 * );
 * ```
 *
 * It renders no chrome of its own — no padding, no ground, no border. A wrapper that
 * imposed layout would force every screen to fight it.
 */

/** The elements a screen root is ever legitimately allowed to be. */
export type ScreenStateRootElement = "div" | "section" | "main" | "article";

export interface ScreenStateRootProps extends ComponentPropsWithRef<"div"> {
  state: DataScreenState;
  /** `section` + `aria-label` when the screen wants a landmark; `div` otherwise. */
  as?: ScreenStateRootElement;
}

export function ScreenStateRoot({
  state,
  as: Tag = "div",
  className,
  children,
  ...rest
}: ScreenStateRootProps) {
  return (
    <Tag
      {...rest}
      data-screen-state={state}
      // Only the loading family is busy. Marking an error or an empty screen busy tells
      // a screen reader to wait for content that is never coming.
      aria-busy={state === "loading" ? true : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}

export interface ResolveDataScreenStateInput {
  /** Straight from `useFixture` (spec §6.3). */
  state: ScreenState;
  /**
   * The screen's own verdict on whether it has anything to show. It is **not** derived
   * from `state === 'empty'`, and that is deliberate: `?state=empty` hands `/profile`
   * seven field groups with `fieldIds: []` rather than zero groups (§11 E-08), so only
   * the screen knows what emptiness means for its own content.
   */
  isEmpty: boolean;
  /** Whether a search or filter is currently narrowing the collection. */
  isFiltered?: boolean;
}

/**
 * Map the gateway's five-value `ScreenState` onto the six-value `data-screen-state`.
 *
 * The sixth value, `empty-filtered`, is unreachable through `?state=` on purpose — it
 * is a consequence of a real query, and a first-run empty and a filtered-to-nothing
 * empty are different screens with different copy and different actions (§8D.1). Every
 * screen with a filter or a search box routes through here so that distinction is made
 * the same way nineteen times.
 */
export function resolveDataScreenState({
  state,
  isEmpty,
  isFiltered = false,
}: ResolveDataScreenStateInput): DataScreenState {
  if (state === "loading" || state === "error" || state === "offline") return state;
  if (!isEmpty) return "success";
  return isFiltered ? "empty-filtered" : "empty";
}
