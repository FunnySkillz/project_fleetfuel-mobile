import { SCHEMA_VERSION } from '@/data/schema';

export const BACKUP_MANIFEST_SCHEMA = 'fleetfuel.backup.manifest';
export const BACKUP_MANIFEST_VERSION = 1;
export const BACKUP_COMPAT_MIN_VERSION = 1;
export const BACKUP_COMPAT_MAX_VERSION = 1;

export const BACKUP_PATHS = {
  manifest: 'manifest.json',
  database: 'payload/database/fleetfuel.db',
  databaseWal: 'payload/database/fleetfuel.db-wal',
  databaseShm: 'payload/database/fleetfuel.db-shm',
  preferences: 'payload/preferences/preferences.json',
  receiptsDir: 'payload/receipts/',
} as const;

export type BackupManifestV1 = {
  schema: typeof BACKUP_MANIFEST_SCHEMA;
  version: typeof BACKUP_MANIFEST_VERSION;
  generatedAt: string;
  schemaVersion: number;
  compatibility: {
    minManifestVersion: number;
    maxManifestVersion: number;
  };
  counters: {
    vehicles: number;
    trips: number;
    fuelEntries: number;
    receiptFiles: number;
  };
  payloads: {
    database: {
      path: string;
      bytes: number;
    };
    databaseWal?: {
      path: string;
      bytes: number;
    };
    databaseShm?: {
      path: string;
      bytes: number;
    };
    preferences: {
      path: string;
      bytes: number;
    };
    receipts: {
      path: string;
      fileCount: number;
    };
  };
};

export type ManifestValidationResult = {
  ok: boolean;
  errors: string[];
  manifest: BackupManifestV1 | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateBackupManifest(input: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Manifest must be an object.'], manifest: null };
  }

  const manifest = input as Partial<BackupManifestV1>;

  if (manifest.schema !== BACKUP_MANIFEST_SCHEMA) {
    errors.push('Unsupported manifest schema.');
  }

  if (manifest.version !== BACKUP_MANIFEST_VERSION) {
    errors.push('Unsupported manifest version.');
  }

  const generatedAt = manifest.generatedAt;
  if (!isNonEmptyString(generatedAt)) {
    errors.push('Manifest generatedAt is required.');
  } else if (Number.isNaN(new Date(generatedAt).getTime())) {
    errors.push('Manifest generatedAt is invalid.');
  }

  if (!isPositiveInteger(manifest.schemaVersion)) {
    errors.push('Manifest schemaVersion must be a positive integer.');
  }

  if (!isObject(manifest.compatibility)) {
    errors.push('Manifest compatibility is missing.');
  } else {
    if (!isPositiveInteger(manifest.compatibility.minManifestVersion)) {
      errors.push('Manifest compatibility.minManifestVersion is invalid.');
    }
    if (!isPositiveInteger(manifest.compatibility.maxManifestVersion)) {
      errors.push('Manifest compatibility.maxManifestVersion is invalid.');
    }
  }

  if (!isObject(manifest.counters)) {
    errors.push('Manifest counters are missing.');
  } else {
    if (!isNonNegativeInteger(manifest.counters.vehicles)) {
      errors.push('Manifest counters.vehicles is invalid.');
    }
    if (!isNonNegativeInteger(manifest.counters.trips)) {
      errors.push('Manifest counters.trips is invalid.');
    }
    if (!isNonNegativeInteger(manifest.counters.fuelEntries)) {
      errors.push('Manifest counters.fuelEntries is invalid.');
    }
    if (!isNonNegativeInteger(manifest.counters.receiptFiles)) {
      errors.push('Manifest counters.receiptFiles is invalid.');
    }
  }

  if (!isObject(manifest.payloads)) {
    errors.push('Manifest payloads are missing.');
  } else {
    const payloads = manifest.payloads as BackupManifestV1['payloads'];

    if (!isObject(payloads.database) || !isNonEmptyString(payloads.database.path) || !isNonNegativeInteger(payloads.database.bytes)) {
      errors.push('Manifest payloads.database is invalid.');
    }

    if (payloads.databaseWal) {
      if (!isObject(payloads.databaseWal) || !isNonEmptyString(payloads.databaseWal.path) || !isNonNegativeInteger(payloads.databaseWal.bytes)) {
        errors.push('Manifest payloads.databaseWal is invalid.');
      }
    }

    if (payloads.databaseShm) {
      if (!isObject(payloads.databaseShm) || !isNonEmptyString(payloads.databaseShm.path) || !isNonNegativeInteger(payloads.databaseShm.bytes)) {
        errors.push('Manifest payloads.databaseShm is invalid.');
      }
    }

    if (!isObject(payloads.preferences) || !isNonEmptyString(payloads.preferences.path) || !isNonNegativeInteger(payloads.preferences.bytes)) {
      errors.push('Manifest payloads.preferences is invalid.');
    }

    if (!isObject(payloads.receipts) || !isNonEmptyString(payloads.receipts.path) || !isNonNegativeInteger(payloads.receipts.fileCount)) {
      errors.push('Manifest payloads.receipts is invalid.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, manifest: null };
  }

  return { ok: true, errors: [], manifest: manifest as BackupManifestV1 };
}

export function validateRestorePreflight(args: {
  manifest: BackupManifestV1;
  zipEntries: string[];
}): { ok: boolean; errors: string[]; warnings: string[] } {
  const { manifest, zipEntries } = args;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (manifest.compatibility.minManifestVersion > BACKUP_MANIFEST_VERSION) {
    errors.push('Backup requires a newer app manifest version.');
  }

  if (manifest.compatibility.maxManifestVersion < BACKUP_MANIFEST_VERSION) {
    errors.push('Backup is too old for this app version.');
  }

  if (manifest.schemaVersion > SCHEMA_VERSION) {
    errors.push('Backup database schema is newer than this app.');
  }

  const entrySet = new Set(zipEntries);

  const requiredPayloads = [
    manifest.payloads.database.path,
    manifest.payloads.preferences.path,
  ];

  for (const payloadPath of requiredPayloads) {
    if (!entrySet.has(payloadPath)) {
      errors.push(`Missing required payload: ${payloadPath}`);
    }
  }

  if (manifest.payloads.databaseWal && !entrySet.has(manifest.payloads.databaseWal.path)) {
    warnings.push(`Optional WAL payload listed but missing: ${manifest.payloads.databaseWal.path}`);
  }

  if (manifest.payloads.databaseShm && !entrySet.has(manifest.payloads.databaseShm.path)) {
    warnings.push(`Optional SHM payload listed but missing: ${manifest.payloads.databaseShm.path}`);
  }

  const receiptsPrefix = manifest.payloads.receipts.path.endsWith('/')
    ? manifest.payloads.receipts.path
    : `${manifest.payloads.receipts.path}/`;
  const receiptPayloadFiles = zipEntries.filter((entry) => entry.startsWith(receiptsPrefix));

  if (manifest.payloads.receipts.fileCount > 0 && receiptPayloadFiles.length === 0) {
    warnings.push('Manifest indicates receipt files, but none were found in payload/receipts/.');
  }

  if (manifest.payloads.receipts.fileCount !== receiptPayloadFiles.length) {
    warnings.push(
      `Receipt count mismatch: manifest=${manifest.payloads.receipts.fileCount}, payload=${receiptPayloadFiles.length}.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function createBaseManifest(input: {
  generatedAt: string;
  counters: BackupManifestV1['counters'];
  payloads: BackupManifestV1['payloads'];
}): BackupManifestV1 {
  return {
    schema: BACKUP_MANIFEST_SCHEMA,
    version: BACKUP_MANIFEST_VERSION,
    generatedAt: input.generatedAt,
    schemaVersion: SCHEMA_VERSION,
    compatibility: {
      minManifestVersion: BACKUP_COMPAT_MIN_VERSION,
      maxManifestVersion: BACKUP_COMPAT_MAX_VERSION,
    },
    counters: input.counters,
    payloads: input.payloads,
  };
}
