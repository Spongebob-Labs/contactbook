import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppConfigService } from '../config/app-config.service';
import type { AppLogger } from '../common/logging/app-logger.service';
import type { ProfilePhotoStorageService } from './profile-photo-storage.service';

/**
 * A profile edit a recipient can see must make them "behind".
 *
 * ## The bug this pins
 * `Card.currentVersion` only moved when a card's field *selection* changed. Editing a phone
 * number's value changed what every recipient sees through their link while `versionsBehind`
 * stayed 0, and `notify` dedupes on `(shareLink, currentVersion)` — so the owner pressing "Send
 * update" for that edit enqueued nothing.
 *
 * ## What must NOT bump
 * An edit nobody can perceive: a financial value (masked on the public page), a write that
 * changes nothing, or a position/category move.
 */

const USER = 'user-1';
const FIELD = 'field-1';

type Field = {
  id: string;
  userId: string;
  category: string;
  type: string;
  label: string;
  value: string;
  isEncrypted: boolean;
  position: number;
  groupId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const field = (over: Partial<Field> = {}): Field => ({
  id: FIELD,
  userId: USER,
  category: 'PERSONAL',
  type: 'PHONE',
  label: 'Mobile',
  value: '+919999900000',
  isEncrypted: false,
  position: 0,
  groupId: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...over,
});

function harness(existing: Field) {
  const bumps: Array<{ where: unknown; data: unknown }> = [];
  const fieldUpdates: Array<Record<string, unknown>> = [];

  const prisma = {
    profileField: {
      findFirst: () => Promise.resolve(existing),
      update: (args: { data: Record<string, unknown> }) => {
        fieldUpdates.push(args.data);
        return Promise.resolve({ ...existing, ...args.data });
      },
    },
    card: {
      updateMany: (args: { where: unknown; data: unknown }) => {
        bumps.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
    // The service passes an array of already-created promises; resolve them in order.
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
  };
  const logger = {
    info: () => undefined,
    error: () => undefined,
    warn: () => undefined,
  };
  const config = { fieldEncryptionKey: Buffer.alloc(32, 7).toString('base64') };
  const storage = { deleteByUrl: () => Promise.resolve() };

  const service = new ProfileService(
    prisma as unknown as PrismaService,
    config as unknown as AppConfigService,
    storage as unknown as ProfilePhotoStorageService,
    logger as unknown as AppLogger,
  );
  return { service, bumps, fieldUpdates };
}

describe('ProfileService — card version bump on a perceivable edit', () => {
  it('bumps live cards that visibly show the field when its value changes', async () => {
    const { service, bumps } = harness(field());
    await service.update(USER, FIELD, { value: '+919999911111' });

    expect(bumps).toHaveLength(1);
    expect(bumps[0].data).toEqual({ currentVersion: { increment: 1 } });
    // Scoped to this owner, live cards only, visible membership only.
    expect(bumps[0].where).toEqual({
      userId: USER,
      archivedAt: null,
      fields: { some: { fieldId: FIELD, visible: true } },
    });
  });

  it('bumps when only the label changes', async () => {
    const { service, bumps } = harness(field());
    await service.update(USER, FIELD, { label: 'Work mobile' });
    expect(bumps).toHaveLength(1);
  });

  it('does not bump when the value is resubmitted unchanged', async () => {
    const { service, bumps } = harness(field());
    await service.update(USER, FIELD, {
      value: '+919999900000',
      label: 'Mobile',
    });
    expect(bumps).toHaveLength(0);
  });

  it('does not bump for a position-only move', async () => {
    const { service, bumps } = harness(field());
    await service.update(USER, FIELD, { position: 4 });
    expect(bumps).toHaveLength(0);
  });

  it('does not bump when a financial value changes (masked on the public page)', async () => {
    const { service, bumps } = harness(
      field({ type: 'BANK_ACCOUNT', value: 'ciphertext', isEncrypted: true }),
    );
    await service.update(USER, FIELD, { value: '1234567890' });
    expect(bumps).toHaveLength(0);
  });

  it('still bumps when a financial field is relabelled (the label is public)', async () => {
    const { service, bumps } = harness(
      field({ type: 'BANK_ACCOUNT', value: 'ciphertext', isEncrypted: true }),
    );
    await service.update(USER, FIELD, { label: 'Savings' });
    expect(bumps).toHaveLength(1);
  });

  it('bumps before archiving a field, so its removal reaches recipients', async () => {
    const { service, bumps, fieldUpdates } = harness(field());
    await service.archive(USER, FIELD);
    expect(bumps).toHaveLength(1);
    expect(fieldUpdates[0]).toHaveProperty('archivedAt');
  });
});
