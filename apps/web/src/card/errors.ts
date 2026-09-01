/**
 * The three failures the card system is allowed to throw — spec §6.7, §6.8, §9.4, §5.6 I-1.
 *
 * All three are *typed* rather than bare `Error`s, though for two different reasons.
 * `EmptyCardError` and `ExportFailedError` are caught and turned into a specific surface:
 * the former must never reach a user at all (the UI blocks the action before it), and the
 * latter decides which retry copy the toast shows (§11 E-44). `UnknownRegistryIdError` is
 * not caught anywhere — it exists so that when invariant I-1 is broken, the failure is
 * reported *by `resolveCard`, naming the id*, rather than as an unrelated property read
 * three components downstream in whichever surface happened to dereference the hole first.
 *
 * No React, no DOM, no i18n. The `message` strings are developer-facing; user-facing copy
 * lives with the screen that catches these.
 */

/**
 * Thrown by `buildVcf` when a card shares nothing — spec §6.7, §11 E-01/E-02, AC-36.
 *
 * ⚠ **This is the regression guard, and it is deliberately unforgiving.** The old build
 * shipped card `5a286f9e` with zero field mappings and generated a **73-byte** `.vcf`
 * carrying `FN` and `N` and nothing else; the file looked like a successful save and gave
 * the scanner no way to contact anyone. `fieldTypes` was a *filter over attached fields*,
 * not a data source, so requesting every type on a card with no mappings yielded a
 * name-only file and the API echoed the requested types back regardless.
 *
 * Making this "forgiving" — returning a stub, an empty string, or a name-only card —
 * re-opens exactly that bug. The correct fix is always upstream: the builder disables Save
 * (E-01) and the public card does not render the button at all (E-02), so a caller that
 * reaches this constructor has already lost the guarantee.
 */
export class EmptyCardError extends Error {
  /** The card that shares nothing, so a caught error can name it in a log or a toast. */
  readonly cardId: string;
  /** The card's display name, for a log line or a toast. Was `slug`, which never existed. */
  readonly cardName: string;

  constructor(cardId: string, cardName: string) {
    super(
      `Card "${cardId}" maps zero profile fields, so it has no contact details to write. ` +
        `Block the action upstream (spec §11 E-01/E-02) rather than writing a name-only vCard.`,
    );
    this.name = "EmptyCardError";
    this.cardId = cardId;
    this.cardName = cardName;
  }
}

export function isEmptyCardError(value: unknown): value is EmptyCardError {
  return value instanceof EmptyCardError;
}

/** Why a PNG export failed, per spec §6.8. Each reason maps to different retry copy. */
export type ExportFailureReason = "font-not-loaded" | "image-tainted" | "unknown";

/**
 * Rejected by `exportCardPng` — spec §6.8, §9.4, §11 E-44.
 *
 * The caller always clears its busy state in a `finally`: an export that fails must leave a
 * retry and never a spinner.
 */
export class ExportFailedError extends Error {
  readonly reason: ExportFailureReason;

  /** `cause` carries the original throw for the developer surface only — never rendered (§7.3). */
  constructor(reason: ExportFailureReason, cause?: unknown) {
    super(`Card export failed: ${reason}`, { cause });
    this.name = "ExportFailedError";
    this.reason = reason;
  }
}

export function isExportFailedError(value: unknown): value is ExportFailedError {
  return value instanceof ExportFailedError;
}

/** Which registry a `templateId` or resolved `paletteId` failed to be a key of. */
export type RegistrySubject = "template" | "palette";

/**
 * Thrown by `resolveCard` when `card.templateId`, or the palette id it falls back to, is not
 * a key of the relevant registry — spec §5.6 **I-1**, §6.4.
 *
 * ⚠ **This is the guard for a hole the type system cannot close by itself.** `ContactCard.templateId`
 * is typed as `TemplateId`, and `TEMPLATES` is a `Record<TemplateId, CardTemplate>`; together
 * they make `TEMPLATES[card.templateId]` provably total *at the moment `tsc` checks it*
 * (`tests/contract/domain-types.test.ts` pins that proof down). That proof says nothing about a
 * `templateId` string already sitting in a running process's memory, and `next dev`'s Fast
 * Refresh keeps exactly that kind of memory alive on purpose: it re-renders an already-mounted
 * component against a hot-swapped module rather than remounting it, so a `useReducer` state
 * initialised before the swap is not re-initialised after it.
 *
 * Reproduced directly during the debugging session this guard comes from: with a card builder
 * mounted on a clean `next dev` server, renaming the `meridian` key of `TEMPLATES` (leaving the
 * mounted card's own `templateId` untouched) made the very next Fast-Refresh render throw
 * `TypeError: Cannot read properties of undefined (reading 'name')` — not here, but three
 * components away, in `<BuilderPreview>`, reading `resolved.template.name` off a `ResolvedCard`
 * whose non-optional `template` field `resolveCard` had already handed back as `undefined`. It
 * did not reproduce against a production build or a freshly started dev server, because neither
 * holds a second, disagreeing generation of the module for an old value to survive into.
 *
 * A card that reaches this constructor is not, in the ordinary run of the product, reachable by
 * anything a user can do — every ordinary source of a `templateId` (the fixtures, the builder's
 * own pickers) is checked against the *current* registry by construction. This is a backstop for
 * when that has already stopped being true, and its job is only to name which id and which
 * registry, at the point the mismatch is first observable, rather than let it surface as an
 * unrelated crash somewhere that did nothing wrong.
 */
export class UnknownRegistryIdError extends Error {
  /** Which registry — `TEMPLATES` or `TEMPLATE_PALETTES` — the id failed to resolve against. */
  readonly subject: RegistrySubject;
  /** The id that is not a key of that registry. */
  readonly id: string;
  /** The card whose resolution surfaced the mismatch. */
  readonly cardId: string;

  constructor(subject: RegistrySubject, id: string, cardId: string) {
    super(
      `Card "${cardId}" has a ${subject} id of "${id}", which is not a key of the ${subject} ` +
        `registry. This is supposed to be impossible by construction (spec §5.6 I-1) — the id ` +
        `reached resolveCard without ever being checked against the registry currently in ` +
        `memory, which in every case observed so far means a dev-server Fast Refresh preserved ` +
        `a component's state across an edit to the registry itself.`,
    );
    this.name = "UnknownRegistryIdError";
    this.subject = subject;
    this.id = id;
    this.cardId = cardId;
  }
}

export function isUnknownRegistryIdError(value: unknown): value is UnknownRegistryIdError {
  return value instanceof UnknownRegistryIdError;
}
