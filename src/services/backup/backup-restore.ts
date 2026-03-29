import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

import { checkDatabaseHealth, getDatabase, resetDatabaseConnection } from '@/data/db';
import { DATABASE_NAME } from '@/data/schema';
import { savePreferences, loadPreferences } from '@/preferences/storage';
import type { AppPreferences } from '@/preferences/types';
import { listReceiptFiles, getReceiptsDirectoryPath } from '@/utils/receipt-files';

import {
  BACKUP_PATHS,
  createBaseManifest,
  type BackupManifestV1,
  validateBackupManifest,
  validateRestorePreflight,
} from './manifest';

const BACKUPS_DIR_NAME = 'backups';
const SQLITE_DIR_NAME = 'SQLite';
const TEMP_RESTORE_DIR_NAME = '.restore-temp';

type BackupCreateResult = {
  uri: string;
  fileName: string;
  manifest: BackupManifestV1;
};

export type RestorePreflightResult = {
  ok: boolean;
  manifest: BackupManifestV1 | null;
  errors: string[];
  warnings: string[];
};

type LoadedBackupArchive = {
  zip: JSZip;
  entries: string[];
  manifest: BackupManifestV1;
};

function getDocumentDirectory() {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('Document directory is unavailable.');
  }

  return dir;
}

function getBackupDirectoryPath() {
  return `${getDocumentDirectory()}${BACKUPS_DIR_NAME}`;
}

function getSqliteDirectoryPath() {
  return `${getDocumentDirectory()}${SQLITE_DIR_NAME}`;
}

function getMainDatabasePath() {
  return `${getSqliteDirectoryPath()}/${DATABASE_NAME}`;
}

function getWalPath() {
  return `${getMainDatabasePath()}-wal`;
}

function getShmPath() {
  return `${getMainDatabasePath()}-shm`;
}

function getTempRestoreRoot() {
  return `${getDocumentDirectory()}${TEMP_RESTORE_DIR_NAME}`;
}

function buildBackupFileName(timestampIso: string) {
  const date = new Date(timestampIso);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const y = safeDate.getUTCFullYear();
  const m = String(safeDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(safeDate.getUTCDate()).padStart(2, '0');
  const hh = String(safeDate.getUTCHours()).padStart(2, '0');
  const mm = String(safeDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(safeDate.getUTCSeconds()).padStart(2, '0');

  return `fleetfuel_backup_${y}${m}${d}_${hh}${mm}${ss}.zip`;
}

function normalizePreferences(value: unknown): AppPreferences {
  const fallback: AppPreferences = { themeMode: 'system', language: 'en' };

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as { themeMode?: unknown; language?: unknown };

  return {
    themeMode:
      record.themeMode === 'system' || record.themeMode === 'light' || record.themeMode === 'dark'
        ? record.themeMode
        : fallback.themeMode,
    language: record.language === 'de' || record.language === 'en' ? record.language : fallback.language,
  };
}

async function ensureDirectory(path: string) {
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

async function readFileBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function writeFileBase64(uri: string, base64: string) {
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
}

async function fileInfo(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  return {
    exists: info.exists,
    size: info.exists ? info.size ?? 0 : 0,
  };
}

async function readJsonFromZip<T>(zip: JSZip, path: string): Promise<T> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`Missing payload: ${path}`);
  }

  const text = await file.async('text');
  return JSON.parse(text) as T;
}

async function loadBackupArchive(backupUri: string): Promise<LoadedBackupArchive> {
  const archiveBase64 = await readFileBase64(backupUri);
  const zip = await JSZip.loadAsync(archiveBase64, { base64: true });
  const entries = Object.keys(zip.files).filter((entry) => !zip.files[entry].dir);

  const manifestFile = zip.file(BACKUP_PATHS.manifest);
  if (!manifestFile) {
    throw new Error('Backup archive is missing manifest.json.');
  }

  const manifestRaw = JSON.parse(await manifestFile.async('text'));
  const manifestValidation = validateBackupManifest(manifestRaw);
  if (!manifestValidation.ok || !manifestValidation.manifest) {
    throw new Error(`Invalid backup manifest: ${manifestValidation.errors.join(' ')}`);
  }

  return {
    zip,
    entries,
    manifest: manifestValidation.manifest,
  };
}

async function getDatasetCounters() {
  const db = await getDatabase();

  const [vehicles, trips, fuelEntries] = await Promise.all([
    db.getFirstAsync<{ total: number }>(`SELECT COUNT(1) AS total FROM vehicles WHERE deleted_at IS NULL`),
    db.getFirstAsync<{ total: number }>(`SELECT COUNT(1) AS total FROM trips WHERE deleted_at IS NULL`),
    db.getFirstAsync<{ total: number }>(`SELECT COUNT(1) AS total FROM fuel_entries WHERE deleted_at IS NULL`),
  ]);

  return {
    vehicles: vehicles?.total ?? 0,
    trips: trips?.total ?? 0,
    fuelEntries: fuelEntries?.total ?? 0,
  };
}

async function addOptionalPayload(zip: JSZip, filePath: string, zipPath: string) {
  const info = await fileInfo(filePath);
  if (!info.exists) {
    return null;
  }

  const base64 = await readFileBase64(filePath);
  zip.file(zipPath, base64, { base64: true });

  return {
    path: zipPath,
    bytes: info.size,
  };
}

export async function createBackupZip(): Promise<BackupCreateResult> {
  const generatedAt = new Date().toISOString();

  const db = await getDatabase();
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  const [datasetCounters, preferencesSnapshot, receiptFiles] = await Promise.all([
    getDatasetCounters(),
    loadPreferences(),
    listReceiptFiles(),
  ]);

  const zip = new JSZip();

  const mainDbPath = getMainDatabasePath();
  const mainDbInfo = await fileInfo(mainDbPath);
  if (!mainDbInfo.exists) {
    throw new Error('Cannot create backup: local database file is missing.');
  }

  const dbBase64 = await readFileBase64(mainDbPath);
  zip.file(BACKUP_PATHS.database, dbBase64, { base64: true });

  const walPayload = await addOptionalPayload(zip, getWalPath(), BACKUP_PATHS.databaseWal);
  const shmPayload = await addOptionalPayload(zip, getShmPath(), BACKUP_PATHS.databaseShm);

  const receiptsPrefix = BACKUP_PATHS.receiptsDir;
  for (const receiptPath of receiptFiles) {
    const name = receiptPath.split('/').pop();
    if (!name) {
      continue;
    }

    const data = await readFileBase64(receiptPath);
    zip.file(`${receiptsPrefix}${name}`, data, { base64: true });
  }

  const preferencesJson = JSON.stringify(preferencesSnapshot);
  zip.file(BACKUP_PATHS.preferences, preferencesJson);

  const manifest = createBaseManifest({
    generatedAt,
    counters: {
      vehicles: datasetCounters.vehicles,
      trips: datasetCounters.trips,
      fuelEntries: datasetCounters.fuelEntries,
      receiptFiles: receiptFiles.length,
    },
    payloads: {
      database: {
        path: BACKUP_PATHS.database,
        bytes: mainDbInfo.size,
      },
      ...(walPayload ? { databaseWal: walPayload } : {}),
      ...(shmPayload ? { databaseShm: shmPayload } : {}),
      preferences: {
        path: BACKUP_PATHS.preferences,
        bytes: preferencesJson.length,
      },
      receipts: {
        path: BACKUP_PATHS.receiptsDir,
        fileCount: receiptFiles.length,
      },
    },
  });

  zip.file(BACKUP_PATHS.manifest, JSON.stringify(manifest, null, 2));

  const backupBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });

  const backupsDir = getBackupDirectoryPath();
  await ensureDirectory(backupsDir);

  const fileName = buildBackupFileName(generatedAt);
  const outputUri = `${backupsDir}/${fileName}`;
  await writeFileBase64(outputUri, backupBase64);

  return {
    uri: outputUri,
    fileName,
    manifest,
  };
}

export async function preflightRestore(backupUri: string): Promise<RestorePreflightResult> {
  try {
    const archive = await loadBackupArchive(backupUri);
    const check = validateRestorePreflight({
      manifest: archive.manifest,
      zipEntries: archive.entries,
    });

    try {
      await readJsonFromZip(archive.zip, archive.manifest.payloads.preferences.path);
    } catch {
      return {
        ok: false,
        manifest: archive.manifest,
        errors: ['Preferences payload is invalid JSON.'],
        warnings: check.warnings,
      };
    }

    return {
      ok: check.ok,
      manifest: archive.manifest,
      errors: check.errors,
      warnings: check.warnings,
    };
  } catch (error) {
    return {
      ok: false,
      manifest: null,
      errors: [error instanceof Error ? error.message : 'Failed to read backup archive.'],
      warnings: [],
    };
  }
}

export async function restoreBackup(backupUri: string): Promise<{ restoredAt: string; manifest: BackupManifestV1 }> {
  const archive = await loadBackupArchive(backupUri);
  const preflight = validateRestorePreflight({
    manifest: archive.manifest,
    zipEntries: archive.entries,
  });

  if (!preflight.ok) {
    throw new Error(preflight.errors.join(' '));
  }

  const preferencesRaw = await readJsonFromZip<unknown>(archive.zip, archive.manifest.payloads.preferences.path);
  const normalizedPreferences = normalizePreferences(preferencesRaw);

  const tempRoot = getTempRestoreRoot();
  const tempRunDir = `${tempRoot}/${Date.now().toString(36)}`;
  const tempDbDir = `${tempRunDir}/database`;
  const tempReceiptsDir = `${tempRunDir}/receipts`;

  try {
    await ensureDirectory(tempDbDir);
    await ensureDirectory(tempReceiptsDir);

    const dbFile = archive.zip.file(archive.manifest.payloads.database.path);
    if (!dbFile) {
      throw new Error('Backup payload is missing the main database file.');
    }

    await writeFileBase64(`${tempDbDir}/${DATABASE_NAME}`, await dbFile.async('base64'));

    if (archive.manifest.payloads.databaseWal) {
      const wal = archive.zip.file(archive.manifest.payloads.databaseWal.path);
      if (wal) {
        await writeFileBase64(`${tempDbDir}/${DATABASE_NAME}-wal`, await wal.async('base64'));
      }
    }

    if (archive.manifest.payloads.databaseShm) {
      const shm = archive.zip.file(archive.manifest.payloads.databaseShm.path);
      if (shm) {
        await writeFileBase64(`${tempDbDir}/${DATABASE_NAME}-shm`, await shm.async('base64'));
      }
    }

    const receiptsPrefix = archive.manifest.payloads.receipts.path.endsWith('/')
      ? archive.manifest.payloads.receipts.path
      : `${archive.manifest.payloads.receipts.path}/`;

    for (const entryName of archive.entries.filter((entry) => entry.startsWith(receiptsPrefix))) {
      const file = archive.zip.file(entryName);
      if (!file) {
        continue;
      }

      const relativePath = entryName.slice(receiptsPrefix.length);
      if (!relativePath) {
        continue;
      }

      const targetPath = `${tempReceiptsDir}/${relativePath}`;
      const targetDir = targetPath.slice(0, Math.max(targetPath.lastIndexOf('/'), 0));
      if (targetDir.length > 0) {
        await ensureDirectory(targetDir);
      }
      await writeFileBase64(targetPath, await file.async('base64'));
    }

    await resetDatabaseConnection();

    const sqliteDir = getSqliteDirectoryPath();
    await ensureDirectory(sqliteDir);

    await FileSystem.deleteAsync(getMainDatabasePath(), { idempotent: true });
    await FileSystem.deleteAsync(getWalPath(), { idempotent: true });
    await FileSystem.deleteAsync(getShmPath(), { idempotent: true });

    await FileSystem.copyAsync({ from: `${tempDbDir}/${DATABASE_NAME}`, to: getMainDatabasePath() });

    const tempWalInfo = await fileInfo(`${tempDbDir}/${DATABASE_NAME}-wal`);
    if (tempWalInfo.exists) {
      await FileSystem.copyAsync({ from: `${tempDbDir}/${DATABASE_NAME}-wal`, to: getWalPath() });
    }

    const tempShmInfo = await fileInfo(`${tempDbDir}/${DATABASE_NAME}-shm`);
    if (tempShmInfo.exists) {
      await FileSystem.copyAsync({ from: `${tempDbDir}/${DATABASE_NAME}-shm`, to: getShmPath() });
    }

    const receiptsDir = getReceiptsDirectoryPath();
    await FileSystem.deleteAsync(receiptsDir, { idempotent: true });
    await ensureDirectory(receiptsDir);

    for (const entryName of archive.entries.filter((entry) => entry.startsWith(receiptsPrefix))) {
      const relativePath = entryName.slice(receiptsPrefix.length);
      if (!relativePath) {
        continue;
      }

      const fromPath = `${tempReceiptsDir}/${relativePath}`;
      const toPath = `${receiptsDir}/${relativePath}`;
      const toDir = toPath.slice(0, Math.max(toPath.lastIndexOf('/'), 0));
      if (toDir.length > 0) {
        await ensureDirectory(toDir);
      }
      await FileSystem.copyAsync({ from: fromPath, to: toPath });
    }

    await savePreferences(normalizedPreferences);
    await resetDatabaseConnection();
    await checkDatabaseHealth();

    return {
      restoredAt: new Date().toISOString(),
      manifest: archive.manifest,
    };
  } finally {
    await FileSystem.deleteAsync(tempRunDir, { idempotent: true });
  }
}
