"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/primitives/button";
import { Switch } from "@/components/primitives/switch";

/**
 * The two per-field controls that decide what a value looks like — spec §7.3, §15 AC-33.
 *
 * They are deliberately in one file because they are two halves of one rule and reading
 * either alone gets it wrong:
 *
 * · `SensitiveToggle` sets `ProfileField.isSensitive`. That is a **policy** the owner
 *   writes down once and every downstream surface obeys: `isMaskedField()` (T12) adds it
 *   to the three always-masked financial types, so a sensitive field renders masked on the
 *   public card, in the builder's field picker and in a saved contact — everywhere.
 *
 * · `RevealToggle` un-masks **one field, on this screen, for as long as the screen is
 *   mounted**. It changes nothing about the field. It is a view of the owner's own data by
 *   the owner, on an owner-only route, and that is the entire justification for its
 *   existence.
 *
 * ── ⚠ WHY THIS IS THE ONLY REVEAL CONTROL IN THE PRODUCT ────────────────────────────
 * §7.3: *"There is no reveal control on `/c/[slug]`. Reveal exists only in `/profile`,
 * behind an explicit per-field toggle that resets on navigation."* `/c/[slug]` is
 * unauthenticated by design — anyone with the URL is looking at the page — so a reveal
 * control there is a public "show me the account number" button. AC-33 is the binary check.
 *
 * Three consequences that constrain this file, and every consumer of it:
 *
 * 1. **`RevealToggle` is exported from this module and from nowhere else.** There is no
 *    `components/profile/index.ts` and there must not be one: a barrel is how a control
 *    with a single legitimate home ends up imported by a second screen. `FieldList`
 *    (T17) and `PublicCardView` (T18) render the same rows with no reveal path at all,
 *    which is why AC-33 holds on those surfaces by construction rather than by review.
 *
 * 2. **Reveal state is never stored here.** This component is fully controlled: the
 *    screen owns the set of revealed ids in plain `useState`, so it dies with the
 *    component and cannot outlive a navigation. No browser storage of any kind, no URL
 *    parameter, no context mounted above the route (§3.1, §5.7).
 *    Putting the id in the URL would be the worst version of this: a revealed field
 *    would then survive a share, a bookmark and the browser history.
 *
 * 3. **The announcement never contains the value.** `aria-pressed` carries the state and
 *    the `role="status"` region says *which field* is showing, never *what* it says — a
 *    live region is read aloud, and reading a bank account aloud is the analogue of the
 *    leak this whole rule exists to prevent.
 */

export interface SensitiveToggleProps {
  /** Used for the control id, so a row's label and its switch are paired uniquely. */
  fieldId: string;
  /** The owner's own label. Disambiguates seven "Sensitive" switches on one screen. */
  fieldLabel: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /**
   * When set, the switch renders disabled and this sentence explains why.
   *
   * Used against the live API, which has **no `isSensitive` column**: the flag is derived from
   * the field's type (`map.ts`), so financial values are always masked and nothing else can be.
   * A switch that moved and then reverted on reload would be worse than one that says so —
   * see `docs/INTEGRATION.md` ask #6.
   */
  readOnlyReason?: string;
}

/**
 * Mark a field sensitive.
 *
 * The visible word is "Sensitive" and the accessible name is "Sensitive — Mobile". The
 * visible text is a prefix of the accessible name, which is what WCAG 2.5.3 (Label in
 * Name) requires and what axe's `label-content-name-mismatch` rule checks (AC-25) — a
 * hidden name that *replaced* the visible one would fail both.
 */
export function SensitiveToggle({
  fieldId,
  fieldLabel,
  checked,
  onCheckedChange,
  readOnlyReason,
}: SensitiveToggleProps) {
  const readOnly = readOnlyReason !== undefined;

  return (
    <Switch
      id={`${fieldId}-sensitive`}
      data-sensitive-toggle={fieldId}
      data-sensitive-readonly={readOnly ? "" : undefined}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={readOnly}
      // The reason is wired through `description`, which the primitive links with
      // `aria-describedby` — so the explanation reaches a screen reader rather than only
      // sighted users noticing a greyed-out control.
      description={readOnly ? readOnlyReason : undefined}
      labelPosition="end"
      rowClassName="justify-start"
      label={
        <span className="text-xs text-ink-3">
          Sensitive
          <span className="sr-only"> — {fieldLabel}</span>
        </span>
      }
    />
  );
}

export interface RevealToggleProps {
  fieldId: string;
  fieldLabel: string;
  revealed: boolean;
  onToggle: () => void;
}

/**
 * Show or hide one masked value, for this mount only.
 *
 * `aria-pressed` rather than a label that only changes text: a toggle button's state is
 * the thing that changed, and screen readers announce it on activation without the user
 * having to re-read the control.
 *
 * The `role="status"` region is empty until the first reveal. An initially-populated live
 * region is announced by some screen readers on page load, which would mean seven "…is
 * hidden" announcements before the reader has done anything.
 */
export function RevealToggle({ fieldId, fieldLabel, revealed, onToggle }: RevealToggleProps) {
  return (
    <>
      <Button
        variant="ghost"
        iconOnly
        aria-label={revealed ? `Hide ${fieldLabel}` : `Reveal ${fieldLabel}`}
        aria-pressed={revealed}
        data-field-reveal={fieldId}
        onClick={onToggle}
      >
        {revealed ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
      </Button>

      <span role="status" className="sr-only">
        {revealed ? `Showing ${fieldLabel}` : ""}
      </span>
    </>
  );
}
