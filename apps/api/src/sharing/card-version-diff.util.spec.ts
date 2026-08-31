import {
  diffCardFields,
  isDiffEmpty,
  type CardFieldSnapshotEntry,
} from './card-version-diff.util';

function entry(
  overrides: Partial<CardFieldSnapshotEntry> = {},
): CardFieldSnapshotEntry {
  return {
    fieldId: 'field-1',
    label: 'Work mobile',
    type: 'PHONE',
    visible: true,
    position: 0,
    ...overrides,
  };
}

describe('diffCardFields', () => {
  it('reports every field as added when there is no prior state', () => {
    const next = [
      entry({ fieldId: 'a' }),
      entry({ fieldId: 'b', label: 'Work email', type: 'EMAIL' }),
    ];

    const diff = diffCardFields([], next);

    expect(diff.added).toEqual([
      { fieldId: 'a', label: 'Work mobile', type: 'PHONE' },
      { fieldId: 'b', label: 'Work email', type: 'EMAIL' },
    ]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('reports a field present before but not after as removed', () => {
    const previous = [entry({ fieldId: 'a' })];

    const diff = diffCardFields(previous, []);

    expect(diff.removed).toEqual([
      { fieldId: 'a', label: 'Work mobile', type: 'PHONE' },
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('reports no changes when the identical set is resubmitted', () => {
    const previous = [
      entry({ fieldId: 'a' }),
      entry({ fieldId: 'b', position: 1 }),
    ];
    const next = [
      entry({ fieldId: 'a' }),
      entry({ fieldId: 'b', position: 1 }),
    ];

    const diff = diffCardFields(previous, next);

    expect(isDiffEmpty(diff)).toBe(true);
  });

  it('reports a field as changed when its position moves', () => {
    const previous = [entry({ fieldId: 'a', position: 0 })];
    const next = [entry({ fieldId: 'a', position: 3 })];

    const diff = diffCardFields(previous, next);

    expect(diff.changed).toEqual([
      { fieldId: 'a', label: 'Work mobile', type: 'PHONE' },
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('reports a field as changed when it is hidden', () => {
    const previous = [entry({ fieldId: 'a', visible: true })];
    const next = [entry({ fieldId: 'a', visible: false })];

    const diff = diffCardFields(previous, next);

    expect(diff.changed).toEqual([
      { fieldId: 'a', label: 'Work mobile', type: 'PHONE' },
    ]);
  });

  it('reports a field as changed when its effective label changes', () => {
    const previous = [entry({ fieldId: 'a', label: 'Work mobile' })];
    const next = [entry({ fieldId: 'a', label: 'Reach me here' })];

    const diff = diffCardFields(previous, next);

    expect(diff.changed).toEqual([
      { fieldId: 'a', label: 'Reach me here', type: 'PHONE' },
    ]);
  });

  it('never includes a field value — only fieldId, label, and type', () => {
    const next = [entry({ fieldId: 'a' })];

    const diff = diffCardFields([], next);

    expect(Object.keys(diff.added[0]).sort()).toEqual([
      'fieldId',
      'label',
      'type',
    ]);
  });
});

describe('isDiffEmpty', () => {
  it('is true only when all three arrays are empty', () => {
    expect(isDiffEmpty({ added: [], removed: [], changed: [] })).toBe(true);
    expect(
      isDiffEmpty({
        added: [{ fieldId: 'a', label: 'X', type: 'PHONE' }],
        removed: [],
        changed: [],
      }),
    ).toBe(false);
  });
});
