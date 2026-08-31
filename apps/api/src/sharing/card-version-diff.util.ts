import { FieldType } from '@prisma/client';

/**
 * One field's shape as it matters for versioning: what a recipient would
 * actually see (label after any override, and position/visibility). Never a
 * value — CardVersion.diff must never carry ProfileField.value (invariant #5).
 */
export interface CardFieldSnapshotEntry {
  fieldId: string;
  label: string;
  type: FieldType;
  visible: boolean;
  position: number;
}

export interface CardVersionDiffEntry {
  fieldId: string;
  label: string;
  type: FieldType;
}

export interface CardVersionDiff {
  added: CardVersionDiffEntry[];
  removed: CardVersionDiffEntry[];
  changed: CardVersionDiffEntry[];
}

/**
 * Diffs the card's field set against what it was a moment ago. `previous` is
 * always the CardField rows as they stand right now, before setFields()
 * rewrites them — there is no separate "version 0" snapshot to reach for, so
 * a card that has never had a field selected simply diffs against an empty
 * set (`added` becomes "every field in the new set"). One code path, no
 * special-casing for "is this the first version."
 *
 * `changed` compares the effective label (labelOverride ?? the field's own
 * label), not labelOverride alone — that's what a recipient actually sees.
 */
export function diffCardFields(
  previous: readonly CardFieldSnapshotEntry[],
  next: readonly CardFieldSnapshotEntry[],
): CardVersionDiff {
  const previousById = new Map(previous.map((entry) => [entry.fieldId, entry]));
  const nextById = new Map(next.map((entry) => [entry.fieldId, entry]));

  const diff: CardVersionDiff = { added: [], removed: [], changed: [] };

  for (const entry of next) {
    const before = previousById.get(entry.fieldId);
    if (before === undefined) {
      diff.added.push(toDiffEntry(entry));
    } else if (
      before.visible !== entry.visible ||
      before.position !== entry.position ||
      before.label !== entry.label
    ) {
      diff.changed.push(toDiffEntry(entry));
    }
  }

  for (const entry of previous) {
    if (!nextById.has(entry.fieldId)) {
      diff.removed.push(toDiffEntry(entry));
    }
  }

  return diff;
}

export function isDiffEmpty(diff: CardVersionDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0
  );
}

function toDiffEntry(entry: CardFieldSnapshotEntry): CardVersionDiffEntry {
  return { fieldId: entry.fieldId, label: entry.label, type: entry.type };
}
