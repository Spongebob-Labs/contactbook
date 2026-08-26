/**
 * The seven floating surfaces (spec §8D.7).
 *
 * ⚠ THIS IS THE ONLY DIRECTORY IN THE BUILD PERMITTED A REAL DROP SHADOW —
 * `--elevation-1` and `--elevation-2` (F-09, §8.7). Everything in normal document flow
 * — cards, list rows, panels, sections, the card itself — is `--elevation-0` and
 * separates itself with a hairline rule. Compose these; never edit one, and never
 * re-declare a shadow elsewhere.
 *
 * ── The `[data-elevation]` contract ───────────────────────────────────────────────────
 * Every overlay root carries `data-elevation="0|1|2"` (§13.2), and this directory ships
 * the one stylesheet that turns that attribute into a shadow. It is an *attribute* rule,
 * not a class, because it also has to reach a node this directory never renders: T05's
 * `primitives/select.tsx` portals its menu with `data-elevation="1"` and deliberately no
 * shadow, since declaring one outside `overlay/**` would have failed AC-15. Without the
 * rule below, that menu floats flat against the page.
 *
 * The stylesheet is mounted automatically by all seven components (React 19 hoists
 * `<style href precedence>` and dedupes it), and `ToastProvider` — mounted once by T09 in
 * `(app)/layout.tsx` — keeps it resident on every authenticated route. **If you build a
 * layout outside `(app)` that renders a `Select` with no overlay nearby, mount
 * `<OverlayStyles />` in it.** That is the only manual step in this contract.
 */

export {
  Dialog,
  DialogClose,
  ModalLayerProvider,
  OverlayStyles,
  useInsideModalLayer,
  ELEVATION_CSS,
  OVERLAY_CSS,
  OVERLAY_STYLE_HREF,
} from "./dialog";
export type { DialogProps, DialogSize } from "./dialog";

export { ConfirmDialog } from "./confirm-dialog";
export type { ConfirmDialogProps, ConfirmTone } from "./confirm-dialog";

export { Popover, PopoverClose } from "./popover";
export type { PopoverProps } from "./popover";

export {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";
export type {
  DropdownMenuItemProps,
  DropdownMenuItemTone,
  DropdownMenuProps,
} from "./dropdown-menu";

export { Tooltip, TooltipProvider } from "./tooltip";
export type { TooltipProps, TooltipProviderProps } from "./tooltip";

export { ToastProvider, useToast } from "./toast";
export type {
  ToastAction,
  ToastApi,
  ToastOptions,
  ToastProviderProps,
  ToastTone,
} from "./toast";

export { Sheet } from "./sheet";
export type { SheetProps } from "./sheet";
