import { SCHEMA_VERSION } from '@/data/schema';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_MANIFEST_SCHEMA,
  BACKUP_MANIFEST_VERSION,
  createBaseManifest,
  validateBackupManifest,
  validateRestorePreflight,
} from '@/services/backup/manifest';

describe('backup manifest validation', () => {
  it('accepts a valid manifest', () => {
    const manifest = createBaseManifest({
      generatedAt: '2026-03-29T12:00:00.000Z',
      counters: {
        vehicles: 1,
        trips: 2,
        fuelEntries: 3,
        receiptFiles: 1,
      },
      payloads: {
        database: { path: 'payload/database/fleetfuel.db', bytes: 1024 },
        preferences: { path: 'payload/preferences/preferences.json', bytes: 128 },
        receipts: { path: 'payload/receipts/', fileCount: 1 },
      },
    });

    const result = validateBackupManifest(manifest);

    expect(result.ok).toBe(true);
    expect(result.manifest).not.toBeNull();
    expect(result.errors).toEqual([]);
  });

  it('rejects unsupported manifest version', () => {
    const invalid = {
      schema: BACKUP_MANIFEST_SCHEMA,
      version: BACKUP_MANIFEST_VERSION + 1,
      generatedAt: '2026-03-29T12:00:00.000Z',
      schemaVersion: SCHEMA_VERSION,
      compatibility: {
        minManifestVersion: 1,
        maxManifestVersion: 1,
      },
      counters: {
        vehicles: 0,
        trips: 0,
        fuelEntries: 0,
        receiptFiles: 0,
      },
      payloads: {
        database: { path: 'payload/database/fleetfuel.db', bytes: 1 },
        preferences: { path: 'payload/preferences/preferences.json', bytes: 1 },
        receipts: { path: 'payload/receipts/', fileCount: 0 },
      },
    };

    const result = validateBackupManifest(invalid);

    expect(result.ok).toBe(false);
    expect(result.manifest).toBeNull();
    expect(result.errors.some((entry) => entry.includes('Unsupported manifest version'))).toBe(true);
  });
});

describe('restore preflight rejection', () => {
  it('rejects missing required database payload', () => {
    const manifest = createBaseManifest({
      generatedAt: '2026-03-29T12:00:00.000Z',
      counters: {
        vehicles: 1,
        trips: 1,
        fuelEntries: 1,
        receiptFiles: 0,
      },
      payloads: {
        database: { path: 'payload/database/fleetfuel.db', bytes: 1024 },
        preferences: { path: 'payload/preferences/preferences.json', bytes: 128 },
        receipts: { path: 'payload/receipts/', fileCount: 0 },
      },
    });

    const result = validateRestorePreflight({
      manifest,
      zipEntries: ['payload/preferences/preferences.json'],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.includes('Missing required payload'))).toBe(true);
  });

  it('rejects backup schema newer than app schema', () => {
    const manifest = createBaseManifest({
      generatedAt: '2026-03-29T12:00:00.000Z',
      counters: {
        vehicles: 1,
        trips: 1,
        fuelEntries: 1,
        receiptFiles: 0,
      },
      payloads: {
        database: { path: 'payload/database/fleetfuel.db', bytes: 1024 },
        preferences: { path: 'payload/preferences/preferences.json', bytes: 128 },
        receipts: { path: 'payload/receipts/', fileCount: 0 },
      },
    });

    manifest.schemaVersion = SCHEMA_VERSION + 1;

    const result = validateRestorePreflight({
      manifest,
      zipEntries: ['payload/database/fleetfuel.db', 'payload/preferences/preferences.json'],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.includes('schema is newer'))).toBe(true);
  });
});
