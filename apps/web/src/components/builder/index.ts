/**
 * The card builder (spec §8D.4, plan T23).
 *
 * The two routes import `BuilderClient` and `BuilderSkeleton` from here and nothing else; every
 * other module in this directory is a part of the screen rather than a public component.
 *
 * There is deliberately no `builder-split.tsx`. The plan named one, but `SplitView` (T09) *is*
 * the split — it already owns the 46/54 ratio, the sticky pinned pane and the DOM-order rule —
 * so a wrapper here would exist only to forward props and to give a second place for the ratio
 * to be wrong.
 */

export { BuilderClient } from "./builder-client";
export type { BuilderClientProps, BuilderData } from "./builder-client";

export { BuilderSkeleton } from "./builder-skeleton";

export { BUILDER_SCROLL_CLEAR } from "./scroll-clear";

export { BuilderHeader } from "./builder-header";
export type { BuilderHeaderProps } from "./builder-header";

/* The section rail, its section list and the hook that holds which one is showing. Exported
   together because a consumer that renders one without the others has a tab list with no
   panels behind it. */
export { BuilderNav, BUILDER_SECTIONS, PANEL_PARAM, useBuilderSection } from "./builder-nav";
export type { BuilderSectionDef, BuilderSectionId } from "./builder-nav";

export { PanelHead } from "./panel-head";
export type { PanelHeadProps } from "./panel-head";

/* `PreviewVariant` is gone with the pane's two-button toggle, and it is not coming back: the
   preview is the **card page** — the product — in a phone frame, and nothing else. The share
   face is the wallet pass; it renders unscaled on `/cards/[cardId]`, which is where the QR
   contract suite measures it. See the module note in `builder-preview.tsx`. */
export { BuilderPreview } from "./builder-preview";
export type { BuilderPreviewProps } from "./builder-preview";

export { EmptyCardWarning, EMPTY_CARD_SAVE_REASON, EMPTY_CARD_WARNING_TEXT } from "./empty-card-warning";
export { DroppedFieldsNotice } from "./dropped-fields-notice";
export type { DroppedFieldsNoticeProps } from "./dropped-fields-notice";

/* There is no `TemplatePicker` here any more, and its absence is the point: the file is gone
   and the control column is `FieldPicker` then `DesignPanel`, stacked. Everything the picker
   *drove* survives — `templateId` on `ContactCard`, `TEMPLATES`, `card/template-seed.ts` and
   the reducer's `template` action with all of its rules — so a template control can be added
   back as a third section without reopening the model. It is only the UI that left.

   `palette-picker.tsx` is gone too, and for a different reason: it was nine live wallet passes
   offering one axis, and that axis is now the Design panel's first control, where it shares a
   selected state with the free colour input it belongs with. `background-picker.tsx` carries
   the argument. */

export { DesignPanel } from "./design-panel";
export type { DesignPanelProps } from "./design-panel";

export { BackgroundPicker } from "./background-picker";
export type { BackgroundPickerProps } from "./background-picker";

/* `wallpaper-picker.tsx` is gone. It offered one axis of five that conflated "how the colour is
   laid down" with "what is cut into it", which is why three of its five cells rendered as the
   same rectangle. `surface-picker.tsx` carries the argument and the two axes that replaced it. */
export {
  FinishPicker,
  TexturePicker,
  TexturePresenceDial,
  TextureScaleDial,
} from "./surface-picker";
export type { FinishPickerProps, TextureDialProps, TexturePickerProps } from "./surface-picker";

/* The Design panel's layout unit. One axis per row, name left, control ranged right — the
   file's own note carries why the panel stopped being a column of stacked headings. */
export { PanelGroup, PanelRow } from "./panel-row";
export type { PanelRowProps } from "./panel-row";

/* `header-layout-picker.tsx` is gone with the `HeaderLayout` axis — `card-surface.ts` carries
   why. The rail is two sections now, Fields and Design. */

/* The box every cell in the panel paints in. It paints nothing itself — `@/card/card-ground`
   does, which is the whole reason this is a shared component rather than five inline styles:
   the panel must not be able to describe a treatment the card will not produce. */
export { SurfaceSwatch } from "./surface-swatch";
export type { SurfaceSwatchProps } from "./surface-swatch";

export { PreviewOption, PreviewOptionFrame, PreviewOptionGroup } from "./preview-option";
export type {
  PreviewOptionFrameProps,
  PreviewOptionGroupProps,
  PreviewOptionProps,
} from "./preview-option";

export { FieldPicker } from "./field-picker";
export type { FieldPickerProps } from "./field-picker";

/* The Fields section is three files now: the section itself, the modal it opens, and the row
   model both of them read. The row model is exported because it is where the masking rule, the
   §11 E-07 blank-value rule and §6.4's ordering are enforced *once* — a future surface that
   lists profile fields should call `buildFieldRows` rather than grow a fourth opinion. */
export { AddFieldDialog, SUGGESTED_RAIL_ID } from "./add-field-dialog";
export type { AddFieldDialogProps, CreatedField } from "./add-field-dialog";

export {
  FIELD_CATEGORY_ORDER,
  SUGGESTED_LIMIT,
  buildFieldRows,
  rowMatches,
  selectedRows,
  sortCanonically,
  suggestedRows,
} from "./field-rows";
export type { BuilderFieldRow } from "./field-rows";

export {
  BUILDER_NEW_CARD_NAME,
  BUILDER_PREVIEW_CARD_ID,
  BUILDER_PREVIEW_PUBLIC_URL,
  applyFieldValues,
  builderCard,
  builderInitialState,
  builderProfileEdits,
  builderReducer,
} from "./builder-reducer";
export type { BuilderAction, BuilderInit, BuilderState } from "./builder-reducer";
