/**
 * `scroll-margin-top` for anything in the builder's control column that the browser may scroll
 * into view.
 *
 * ## The bug this fixes
 *
 * Below `lg` the preview pane is `position: sticky; top: 0` and half the viewport tall, so the
 * top ~50svh of the screen is permanently occluded by an opaque pane. Anything the browser
 * scrolls into view lands **underneath it**:
 *
 * · a checkbox scrolled to the centre of the viewport is behind the pane, and the click hits the
 *   pane instead — reproduced at 360×800 as a Playwright "…[data-split-pinned] intercepts pointer
 *   events" retry loop, but it is a real tap that a real thumb would miss too;
 * · worse, tabbing through the field list scrolls each focused control into view the same way, so
 *   a keyboard user's focus ring disappears behind the preview.
 *
 * `scroll-margin-top` is the sanctioned cure: it tells the browser to leave that much room above
 * the target when scrolling it into view, so the row settles *below* the pane rather than under
 * it. 54svh is the 50svh pane plus its 3px border and a little air.
 *
 * Zero at `lg` and above, where the pane is a side-by-side column and occludes nothing.
 *
 * Two consumers now — the Fields section's controls (`field-picker.tsx`: the **+ Add** button
 * and each row's remove control, which are what the checkbox list's rows used to be) and the
 * picker cells (`preview-option.tsx`). It used to be three: the tab triggers carried it as
 * well, and they went with the tabs. It is a shared constant rather than a copy per consumer
 * because the value has to track the pane's cap in `builder-client.tsx`; two of them would
 * drift the first time that cap moved.
 *
 * The "Add a field" dialog needs none of this: it is portalled, `position: fixed` and centred,
 * so nothing in it is ever scrolled under the pinned pane.
 */
export const BUILDER_SCROLL_CLEAR = "scroll-mt-[54svh] lg:scroll-mt-0";
