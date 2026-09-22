import { renderFieldRow, type FieldIconSize, type FieldRow } from "@/card/field-renderers";
import type { FieldCategory, ResolvedField } from "@/types/domain";

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

/* ── the hero promotion ─────────────────────────────────────────────────────── */

/**
 * The two fields the card page's hero prints under the name, and everything left for the list.
 *
 * ## Why promotion is subtraction and not duplication
 *
 * The reference this composition was built from prints "Founder & CEO / Maya Partners" beneath
 * the name **and** lists "Maya Partners" again as a row further down. In a mockup with invented
 * data that reads as thoroughness; on a real card it reads as the card repeating itself two
 * inches apart, and the second copy is the less useful one — a `COMPANY` row has no destination,
 * so it is a note, so it is the same static text in a duller position.
 *
 * So the first `JOB_TITLE` and the first `COMPANY` are consumed by the hero and removed from the
 * stack, exactly as `PHOTO` is consumed by the image slot and removed in `resolveCard`. The rule
 * is "first", not "every": somebody genuinely holding two titles keeps the second as a row, where
 * a reader can see there are two.
 *
 * ## ⚠ This does NOT change the `.vcf`
 *
 * `buildVcf` writes from `resolved.fields`, which this function does not touch — it returns a
 * filtered view for the renderer and mutates nothing. A saved contact still carries `TITLE:` and
 * `ORG:`. The same reasoning `resolveBio` already documents: a derived view never removes its
 * source field.
 */
export interface HeroFields {
  /** First `JOB_TITLE`, trimmed. `null` when the card maps none. */
  role: string | null;
  /** First `COMPANY`, trimmed. `null` when the card maps none. */
  org: string | null;
  /** Everything the stack should still render, in the resolver's order. */
  rest: readonly ResolvedField[];
}

/**
 * @param bio `ResolvedCard.bio`. Passed in so the field that PRODUCED the bio can be consumed
 *   along with the role and the company — `resolveBio`'s first branch is "the first mapped
 *   `TEXT` field", and the hero prints that text in a display serif directly above the stack.
 *   Leaving it in produced the same paragraph twice, forty pixels apart. `null` consumes
 *   nothing, which is what an unsaved or bio-less card wants.
 */
export function splitHeroFields(
  fields: readonly ResolvedField[],
  bio: string | null = null,
): HeroFields {
  const roleField = fields.find((f) => f.type === "JOB_TITLE");
  const orgField = fields.find((f) => f.type === "COMPANY");
  /* Matched on VALUE and not just on "the first TEXT field": `resolveBio` only reaches its
     TEXT branch when there is one, so a TEXT field whose value is not the bio is a different
     field the owner added on purpose, and it keeps its row. */
  const bioField =
    bio === null
      ? undefined
      : fields.find((f) => f.type === "TEXT" && f.value.trim() === bio.trim());

  /* Compared by id rather than by type, which is what makes this "the first" and not "all of
     them" — a second JOB_TITLE has a different id and survives into `rest`. */
  const consumed = new Set<string>();
  if (roleField !== undefined) consumed.add(roleField.id);
  if (orgField !== undefined) consumed.add(orgField.id);
  if (bioField !== undefined) consumed.add(bioField.id);

  const role = roleField?.value.trim() ?? "";
  const org = orgField?.value.trim() ?? "";

  return {
    role: role.length > 0 ? role : null,
    org: org.length > 0 ? org : null,
    /* A blank-valued field cannot reach here — `resolveCard` drops those (E-07) — but the
       trim check above can still yield `null` from a whitespace-only value that slipped the
       resolver. In that case the field stays consumed rather than reappearing as an empty row. */
    rest: fields.filter((f) => !consumed.has(f.id)),
  };
}

/* ── the sections ───────────────────────────────────────────────────────────── */

/**
 * What each `FieldCategory` is called on the card.
 *
 * Two of the seven are deliberately NOT their enum spelling. `FINANCIAL` reads as PAYMENT
 * because that is what a reader is looking for when they scan a card for where to send money,
 * and `CUSTOM` reads as OTHER because "custom" describes how the field was authored, which is
 * the owner's concern and not the reader's.
 *
 * `SOCIAL` is present for completeness and is never used: social links are lifted out of the
 * stack entirely and rendered as the icon strip. {@link cardPageSections} drops them.
 */
export const SECTION_LABELS: Record<FieldCategory, string> = {
  IDENTITY: "Details",
  PERSONAL: "Personal",
  WORK: "Work",
  BUSINESS: "Business",
  SOCIAL: "Social",
  FINANCIAL: "Payment",
  CUSTOM: "Other",
};

export interface CardPageSection {
  category: FieldCategory;
  /** The printed heading, from {@link SECTION_LABELS}. */
  label: string;
  rows: CardPageRow[];
}

/**
 * The owner's fields as headed sections — the card page's stack.
 *
 * ## ⚠ Nothing is reordered, and that is the whole reason this is safe
 *
 * `compareResolvedFields` already sorts by **category first** (see `resolve-card.ts`), so the
 * incoming array arrives with every category contiguous and in rank order. This function walks
 * it once and starts a new section wherever the category changes; it never sorts, never
 * regroups, and never moves a row past another.
 *
 * That matters because grouping was previously rejected on exactly this ground: `buildVcf`
 * writes from the same sequence, so a page that re-sorted its rows would disagree with the
 * `.vcf` a reader saved from it. Inserting headings at boundaries that already exist changes
 * what the page *says* without changing what it *orders*, so the two stay in step.
 *
 * ## `SOCIAL` never becomes a section
 *
 * Social links render as the icon strip beneath the stack. They are dropped here rather than
 * filtered by the caller so there is one answer to "is this row in the stack or the strip",
 * and `tests/unit/card-variants.test.tsx` can assert it without a DOM.
 */
export function cardPageSections(
  fields: readonly ResolvedField[],
  iconSize: FieldIconSize,
): CardPageSection[] {
  const sections: CardPageSection[] = [];

  for (const field of fields) {
    if (field.category === "SOCIAL") continue;

    const row = renderFieldRow(field, { iconSize });
    /* Declined by the registry, or blank (E-07). Dropped before a section is opened, so a
       category whose every field declines produces no empty heading. */
    if (row === null) continue;

    const entry: CardPageRow = { field, row, kind: classifyFieldRow(row) };
    const open = sections.at(-1);

    if (open !== undefined && open.category === field.category) {
      open.rows.push(entry);
      continue;
    }

    sections.push({
      category: field.category,
      label: SECTION_LABELS[field.category],
      rows: [entry],
    });
  }

  return sections;
}

/**
 * The bio, unless the hero has already said it.
 *
 * ## The duplication this removes
 *
 * `resolveBio` composes the bio by precedence: the first mapped `TEXT` field, else
 * `"{JOB_TITLE} at {COMPANY}"`, else `JOB_TITLE`, else `COMPANY`. Three of those four branches
 * are built out of the two fields {@link splitHeroFields} now prints directly under the name —
 * so a card with no `TEXT` field rendered "Head of Partnerships" as its role and "Head of
 * Partnerships at Fernwood Studio" as its bio, one line below, in a display serif.
 *
 * ## ⚠ Why this is a display rule and not a change to `resolveBio`
 *
 * The bio is a **derived view**, and its derivation is correct — it is what the share face and
 * the OpenGraph description want, neither of which has a hero that prints the role. Teaching
 * the resolver about a composition would make one surface's layout a property of the resolved
 * card, which is exactly backwards: `resolveCard` is the single resolution *because* it is
 * independent of who renders it.
 *
 * So the rule lives here, next to the promotion that causes it, and it is deliberately narrow:
 * it suppresses the bio only when the bio IS one of the three strings the hero can already be
 * showing. An owner who writes "Head of Partnerships" as their actual `TEXT` bio gets it
 * suppressed too, and that is the right outcome — the page would otherwise print the same
 * sentence twice whatever its provenance.
 *
 * Comparison is case-insensitive and whitespace-collapsed, because "Head of Partnerships at
 * Fernwood Studio" and "Head of partnerships at Fernwood  Studio" are the same repeat to a
 * reader and only an exact-match rule would print both.
 */
export function heroBio(
  bio: string | null,
  role: string | null,
  org: string | null,
): string | null {
  if (bio === null) return null;

  const key = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();
  const seen = new Set<string>();
  if (role !== null) seen.add(key(role));
  if (org !== null) seen.add(key(org));
  if (role !== null && org !== null) seen.add(key(`${role} at ${org}`));

  return seen.has(key(bio)) ? null : bio;
}
