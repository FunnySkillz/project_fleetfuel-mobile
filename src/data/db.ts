import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME, SCHEMA_VERSION } from '@/data/schema';
import { FUEL_TYPES } from '@/data/types';

export { DATABASE_NAME, SCHEMA_VERSION };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

async function migrateToV1(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      plate TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      purpose TEXT NOT NULL,
      distance_km INTEGER NOT NULL,
      notes TEXT,
      private_tag TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      liters REAL NOT NULL,
      total_price REAL NOT NULL,
      station TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_vehicles_name ON vehicles(name);
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);

    CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trips_occurred_at ON trips(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_trips_deleted_at ON trips(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_id ON fuel_entries(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_fuel_occurred_at ON fuel_entries(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_fuel_deleted_at ON fuel_entries(deleted_at);
  `);
}

async function migrateToV2(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    DROP INDEX IF EXISTS idx_trips_occured_at;
    DROP INDEX IF EXISTS idx_fuel_occured_at;

    CREATE INDEX IF NOT EXISTS idx_trips_occurred_at ON trips(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_fuel_occurred_at ON fuel_entries(occurred_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_active_unique
    ON vehicles(plate)
    WHERE deleted_at IS NULL;
  `);
}

type TableInfoRow = {
  name: string;
};

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  tableName: 'vehicles' | 'trips' | 'fuel_entries',
  columnName: string,
  columnDefinition: string,
) {
  const columns = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName});`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (hasColumn) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
}

async function migrateToV3(db: SQLite.SQLiteDatabase) {
  await addColumnIfMissing(db, 'vehicles', 'make', 'TEXT');
  await addColumnIfMissing(db, 'vehicles', 'model', 'TEXT');
  await addColumnIfMissing(db, 'vehicles', 'year', 'INTEGER');
  await addColumnIfMissing(db, 'vehicles', 'ps', 'INTEGER');
  await addColumnIfMissing(db, 'vehicles', 'kw', 'INTEGER');
  await addColumnIfMissing(db, 'vehicles', 'engine_displacement_cc', 'INTEGER');
  await addColumnIfMissing(db, 'vehicles', 'vin', 'TEXT');
  await addColumnIfMissing(db, 'vehicles', 'engine_type_code', 'TEXT');

  await addColumnIfMissing(db, 'trips', 'start_odometer_km', 'INTEGER');
  await addColumnIfMissing(db, 'trips', 'end_odometer_km', 'INTEGER');
  await addColumnIfMissing(db, 'trips', 'start_time', 'TEXT');
  await addColumnIfMissing(db, 'trips', 'end_time', 'TEXT');
  await addColumnIfMissing(db, 'trips', 'start_location', 'TEXT');
  await addColumnIfMissing(db, 'trips', 'end_location', 'TEXT');

  await addColumnIfMissing(db, 'fuel_entries', 'odometer_km', 'INTEGER');
  await addColumnIfMissing(db, 'fuel_entries', 'avg_consumption_l_per_100km', 'REAL');
  await addColumnIfMissing(db, 'fuel_entries', 'receipt_uri', 'TEXT');
  await addColumnIfMissing(db, 'fuel_entries', 'receipt_name', 'TEXT');
  await addColumnIfMissing(db, 'fuel_entries', 'receipt_mime_type', 'TEXT');

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_vin_active_unique
    ON vehicles(vin)
    WHERE deleted_at IS NULL AND vin IS NOT NULL AND vin <> '';
  `);
}

async function migrateToV4(db: SQLite.SQLiteDatabase) {
  await addColumnIfMissing(db, 'fuel_entries', 'fuel_type', 'TEXT');
}

async function migrateToV5(db: SQLite.SQLiteDatabase) {
  const fuelTypesSqlList = FUEL_TYPES.map((value) => `'${value}'`).join(', ');

  await addColumnIfMissing(
    db,
    'vehicles',
    'current_odometer_km',
    'INTEGER NOT NULL DEFAULT 0 CHECK (current_odometer_km >= 0)',
  );
  await addColumnIfMissing(
    db,
    'vehicles',
    'default_fuel_type',
    `TEXT NOT NULL DEFAULT '${FUEL_TYPES[0]}' CHECK (default_fuel_type IN (${fuelTypesSqlList}))`,
  );
}

async function migrateToV6(_db: SQLite.SQLiteDatabase) {
  // Reserved migration slot (no-op).
}

async function migrateToV7(db: SQLite.SQLiteDatabase) {
  await addColumnIfMissing(
    db,
    'fuel_entries',
    'fuel_in_tank_after_refuel_liters',
    'REAL CHECK (fuel_in_tank_after_refuel_liters >= 0)',
  );

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS change_history (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'trip', 'fuel')),
      entity_id TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('update', 'delete')),
      reason TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('local_user', 'system')),
      actor_id TEXT NOT NULL,
      changed_fields_json TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT,
      metadata_json TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_change_history_vehicle_occurred
    ON change_history(vehicle_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_change_history_entity_occurred
    ON change_history(entity_type, entity_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_change_history_action_occurred
    ON change_history(action_type, occurred_at DESC);
  `);
}

async function initializeDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateToV1(db);
  }
  if (currentVersion < 2) {
    await migrateToV2(db);
  }
  if (currentVersion < 3) {
    await migrateToV3(db);
  }
  if (currentVersion < 4) {
    await migrateToV4(db);
  }
  if (currentVersion < 5) {
    await migrateToV5(db);
  }
  if (currentVersion < 6) {
    await migrateToV6(db);
  }
  if (currentVersion < 7) {
    await migrateToV7(db);
  }

  if (currentVersion !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  const db = await databasePromise;

  if (!initPromise) {
    initPromise = initializeDatabase(db);
  }
  await initPromise;

  return db;
}

export async function runInWriteTransaction<T>(
  task: (txn: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();
  let result: T | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    result = await task(txn);
  });

  if (result === null) {
    throw new Error('Transaction completed without a result.');
  }

  return result;
}

export async function resetDatabaseConnection(): Promise<void> {
  if (databasePromise) {
    try {
      const db = await databasePromise;
      await db.closeAsync();
    } catch {
      // Ignore close errors and force re-open on next access.
    }
  }

  databasePromise = null;
  initPromise = null;
}

export async function checkDatabaseHealth(): Promise<void> {
  const db = await getDatabase();
  await db.getFirstAsync<{ ok: number }>('SELECT 1 AS ok;');
  await db.getFirstAsync<{ table_count: number }>(
    `
      SELECT COUNT(1) AS table_count
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('vehicles', 'trips', 'fuel_entries', 'change_history')
    `,
  );
}
