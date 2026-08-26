/**
 * The data-state vocabulary (spec §8D.1, §8D.7). Nineteen routes render these for their
 * non-success states, and `ScreenStateRoot` carries the `data-screen-state` attribute
 * that every state and a11y sweep in T29 keys off (§13.2, AC-24).
 *
 * Compose these; do not fork them. Two screens writing their own error panel is how the
 * §6.10 shape stops being one shape — which is the reason T09's `(app)/error.tsx` depends
 * on this track rather than implementing the panel itself.
 *
 * `logBoundaryError` rides along for the same reason: thirteen `error.tsx` files writing
 * their own `console.error` is how the §13.1 log shape stopped being one shape, and how a
 * real crash came to print `[contactbook] {}`.
 */

export { ScreenStateRoot, resolveDataScreenState } from "./screen-state-root";
export type {
  ResolveDataScreenStateInput,
  ScreenStateRootElement,
  ScreenStateRootProps,
} from "./screen-state-root";

export { LoadingSkeleton, CARD_ASPECT_CLASS } from "./loading-skeleton";
export type { LoadingSkeletonProps, LoadingSkeletonVariant } from "./loading-skeleton";

export { EmptyState, StateAction } from "./empty-state";
export type { EmptyStateProps, StateActionSpec } from "./empty-state";

export { EmptyFilteredState } from "./empty-filtered-state";
export type { EmptyFilteredStateProps } from "./empty-filtered-state";

export {
  ErrorPanel,
  boundaryErrorPanelProps,
  boundaryScopeForPath,
  logBoundaryError,
} from "./error-panel";
export type { BoundaryLogPayload, BoundaryLogScope, ErrorPanelProps } from "./error-panel";

export { NotFoundPanel } from "./not-found-panel";
export type { NotFoundPanelProps } from "./not-found-panel";

export { FilterBar } from "./filter-bar";
export type { FilterBarProps, FilterOption } from "./filter-bar";

export { SearchField } from "./search-field";
export type { SearchFieldProps } from "./search-field";

export { DataTable } from "./data-table";
export type { DataTableColumn, DataTableProps } from "./data-table";
