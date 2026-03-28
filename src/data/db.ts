import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'fleetfuel.db';
const SCHEMA_VERSION = 2;

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
