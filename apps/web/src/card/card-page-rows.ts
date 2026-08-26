import { renderFieldRow, type FieldIconSize, type FieldRow } from "@/card/field-renderers";
import type { ResolvedField } from "@/types/domain";

/**
 * THE ROW CLASSIFIER — which of the three shapes a field takes on the card page.
 *
 * ## Why this is a module and not three ternaries inside the renderer
 *
 * `<CardPage>` is a Linktree-style stack: most fields become a full-width tappable button,
 * some become quiet text, and a few are masked and must never become either. That is a
 * *decision*, and a decision buried in JSX can only be tested through a DOM. Pulled out
 * here it is a pure function over the row contract, so the rules below are asserted in
 * `tests/unit/card-variants.test.tsx` directly — one `expect` per rule, no browser, no
 * layout engine, no fixture-shaped indirection.
 *
 * ## It builds on `FIELD_RENDERERS`, and adds no second action model
 *
 * Everything this file reads — `href`, `masked`, `external`, `label`, `display` — is already
 * decided by `src/card/field-renderers.tsx`, which is where href-scheme safety (§7.4, AC-32),
 * masking (§7.3, AC-33) and coordinate suppression live. **This module invents none of that
 * and must never start.** A second place that decides "is this tappable" is exactly how a
 * masked account number acquires a `mailto:` in six months' time; the whole value of the row
 * contract is that the answer is computed once, next to the rules that constrain it.
 *
 * So the classifier is deliberately trivial. Its job is to *name* the three cases the page
 * already implies, not to derive new ones.
 */

/**
 * The three shapes a field can take in the stack.
 *
 * - `action` — a full-width button. Tapping follows `href` (`mailto:`, `tel:`, `wa.me`,
 *   `https:`, a maps link). Renders the **label only**; see {@link actionAccessibleName}.
 * - `note`   — quiet text. `TEXT`, `JOB_TITLE`, `COMPANY`, `DATE`, `STATUS`, `RELATION`,
 *   `DEPARTMENT`, `REG_NUMBER`, `CUSTOM`, `LOCATION_TRACKING` — anything whose renderer
 *   produced no destination. A stack in which *everything* is a button makes nothing look
 *   tappable, which is the failure this split exists to prevent.
 * - `masked` — rendered with its masking, never actionable, never revealed (§7.3).
 */
export type CardPageRowKind = "action" | "note" | "masked";

export interface CardPageRow {
  field: ResolvedField;
  row: FieldRow;
  kind: CardPageRowKind;
}

/**
 * The classification, in the one order that is safe.
 *
 * **`masked` is tested first, and that order is load-bearing.** `field-renderers.tsx`
 * already strips a masked row's `href` — masking is applied last in its `renderer()` factory
 * and surrenders display, title and link together — so today the two branches cannot both be
 * true. Testing `masked` first means that if that ever stops holding, a masked value becomes
 * *un-tappable text* rather than a live link to the secret it was masking. The cheap ordering
 * is the one that fails safe, so it is the one taken, and
 * `tests/unit/card-variants.test.tsx` pins it with a hand-built row that has both flags set.
 *
 * `href === null` is the second question because a destination is what makes a button a
 * button. No `href`, no action, whatever the field type: the renderer already decided that a
 * malformed address, a `javascript:` URL or a protocol-less hostname produces no link, and
 * such a row must render as text rather than as a dead control (E-23, §7.4).
 */
export function classifyFieldRow(row: FieldRow): CardPageRowKind {
  if (row.masked) return "masked";
  return row.href === null ? "note" : "action";
}

/**
 * The owner's fields as classified page rows, in the resolver's order.
 *
 * Order is `ResolvedCard.fields` order, untouched — §6.4 already applied the ordering rule
 * and the `.vcf` is written from the same sequence, so a saved contact and the page it came
 * from agree about what comes first. Sorting the buttons above the notes was considered and
 * rejected for exactly that reason: it would reorder the page against the file.
 *
 * Rows the registry declines (`PHOTO`, and any blank value — E-07) are dropped here, which
 * is why the count published as `data-field-count` is this array's length and never
 * `resolved.fields.length`. Declaring a number larger than the number painted is the old
 * build's "5 fields / 4 rows" defect, restated as an off-by-one.
 */
export function cardPageRows(
  fields: readonly ResolvedField[],
  iconSize: FieldIconSize,
): CardPageRow[] {
  const rows: CardPageRow[] = [];
  for (const field of fields) {
    const row = renderFieldRow(field, { iconSize });
    if (row === null) continue;
    rows.push({ field, row, kind: classifyFieldRow(row) });
  }
  return rows;
}

/**
 * The accessible name of an action button — the one place the value is still spoken.
 *
 * ## The rule this implements
 *
 * The button prints its **label** and not its value: the card says "Work email", not the
 * address, because the action is what the button *does* and a stack of buttons wearing
 * addresses is a list of strings you have to read rather than a set of things you can press.
 *
 * A blind reader gets nothing from "Work email" alone, though — they cannot see the mailto
 * they are about to open, and a link whose destination is unknowable is a link you do not
 * press. So the value is carried in the accessible name, where it costs no pixels:
 * `"Work email: priyanka@fernwood.example"`.
 *
 * It is applied as `aria-label` rather than as visually hidden text on purpose. Hidden text
 * lands in `innerText`, and two suites assert on the page's text — the coordinate check in
 * `tests/e2e/public-card.spec.ts` reads `body.innerText()` — so a hidden-text implementation
 * would put values back into exactly the string those assertions scan.
 *
 * ## It is never called for a masked row
 *
 * `masked` rows are not actions, so this is unreachable for them (see
 * {@link classifyFieldRow}). That matters: `row.display` on a masked row is already the
 * masked string, but an `aria-label` is served in the HTML — `page.content()` sees it — and
 * AC-33 asserts the raw account number appears nowhere in the document, `title` and `href`
 * included. Keeping masked rows out of the button branch is what keeps that true by
 * construction rather than by remembering.
 *
 * When display and label are the same string — a `CUSTOM` field whose value *is* its
 * name — the name is not doubled; "Podcast: Podcast" is worse than "Podcast".
 */
export function actionAccessibleName(row: FieldRow): string {
  const label = row.label.trim();
  const display = row.display.trim();
  if (display.length === 0 || display === label) return label;
  return `${label}: ${display}`;
}
