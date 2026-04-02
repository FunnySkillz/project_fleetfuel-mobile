import type * as SQLite from 'expo-sqlite';

import { getDatabase } from '@/data/db';
import { nowIso } from '@/data/db-utils';
import type { EntryType } from '@/data/types';

type OdometerLatestRow = {
  entry_type: EntryType;
  entry_id: string;
  vehicle_id: string;
  odometer_km: number;
  occurred_at: string;
  updated_at: string;
  created_at: string;
};

type VehicleBaselineRow = {
  current_odometer_km: number;
};

export type OdometerResolverOptions = {
  excludeTripId?: string;
  excludeFuelId?: string;
};

export type LatestEntryOdometer = {
  entryType: EntryType;
  entryId: string;
  vehicleId: string;
  odometerKm: number;
  occurredAt: string;
  updatedAt: string;
  createdAt: string;
};

export type EffectiveCurrentOdometer = {
  value: number;
  source: 'latestEntry' | 'vehicleBaseline';
  latestEntry: LatestEntryOdometer | null;
  vehicleBaselineKm: number;
};

function normalizeVehicleId(vehicleId: string) {
  const normalized = vehicleId.trim();
  if (!normalized) {
    throw new Error('Vehicle id is required.');
  }
  return normalized;
}

async function getVehicleBaselineOdometer(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
): Promise<number> {
  const row = await db.getFirstAsync<VehicleBaselineRow>(
    `
      SELECT current_odometer_km
      FROM vehicles
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [vehicleId],
  );

  if (!row) {
    throw new Error('Selected vehicle no longer exists.');
  }

  return row.current_odometer_km;
}

export async function resolveLatestEntryOdometerTx(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
  options: OdometerResolverOptions = {},
): Promise<LatestEntryOdometer | null> {
  const normalizedVehicleId = normalizeVehicleId(vehicleId);
  const row = await db.getFirstAsync<OdometerLatestRow>(
    `
      SELECT
        latest.entry_type,
        latest.entry_id,
        latest.vehicle_id,
        latest.odometer_km,
        latest.occurred_at,
        latest.updated_at,
        latest.created_at
      FROM (
        SELECT
          'trip' AS entry_type,
          t.id AS entry_id,
          t.vehicle_id AS vehicle_id,
          t.end_odometer_km AS odometer_km,
          t.occurred_at AS occurred_at,
          t.updated_at AS updated_at,
          t.created_at AS created_at
        FROM trips t
        WHERE t.vehicle_id = ?
          AND t.deleted_at IS NULL
          AND t.end_odometer_km IS NOT NULL
          AND (? = '' OR t.id <> ?)

        UNION ALL

        SELECT
          'fuel' AS entry_type,
          f.id AS entry_id,
          f.vehicle_id AS vehicle_id,
          f.odometer_km AS odometer_km,
          f.occurred_at AS occurred_at,
          f.updated_at AS updated_at,
          f.created_at AS created_at
        FROM fuel_entries f
        WHERE f.vehicle_id = ?
          AND f.deleted_at IS NULL
          AND f.odometer_km IS NOT NULL
          AND (? = '' OR f.id <> ?)
      ) latest
      ORDER BY latest.occurred_at DESC, latest.updated_at DESC, latest.created_at DESC, latest.entry_id DESC
      LIMIT 1
    `,
    [
      normalizedVehicleId,
      options.excludeTripId ?? '',
      options.excludeTripId ?? '',
      normalizedVehicleId,
      options.excludeFuelId ?? '',
      options.excludeFuelId ?? '',
    ],
  );

  if (!row) {
    return null;
  }

  return {
    entryType: row.entry_type,
    entryId: row.entry_id,
    vehicleId: row.vehicle_id,
    odometerKm: row.odometer_km,
    occurredAt: row.occurred_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function resolveEffectiveCurrentOdometerTx(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
  options: OdometerResolverOptions = {},
): Promise<EffectiveCurrentOdometer> {
  const normalizedVehicleId = normalizeVehicleId(vehicleId);
  const [latestEntry, vehicleBaselineKm] = await Promise.all([
    resolveLatestEntryOdometerTx(db, normalizedVehicleId, options),
    getVehicleBaselineOdometer(db, normalizedVehicleId),
  ]);

  if (latestEntry) {
    return {
      value: latestEntry.odometerKm,
      source: 'latestEntry',
      latestEntry,
      vehicleBaselineKm,
    };
  }

  return {
    value: vehicleBaselineKm,
    source: 'vehicleBaseline',
    latestEntry: null,
    vehicleBaselineKm,
  };
}

export async function syncVehicleCurrentOdometerTx(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
): Promise<EffectiveCurrentOdometer> {
  const normalizedVehicleId = normalizeVehicleId(vehicleId);
  const resolved = await resolveEffectiveCurrentOdometerTx(db, normalizedVehicleId);
  const timestamp = nowIso();

  const result = await db.runAsync(
    `
      UPDATE vehicles
      SET current_odometer_km = ?,
          updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [resolved.value, timestamp, normalizedVehicleId],
  );

  if ((result.changes ?? 0) === 0) {
    throw new Error('Selected vehicle no longer exists.');
  }

  return resolved;
}

export async function resolveLatestEntryOdometer(
  vehicleId: string,
  options: OdometerResolverOptions = {},
): Promise<LatestEntryOdometer | null> {
  const db = await getDatabase();
  return resolveLatestEntryOdometerTx(db, vehicleId, options);
}

export async function resolveEffectiveCurrentOdometer(
  vehicleId: string,
  options: OdometerResolverOptions = {},
): Promise<EffectiveCurrentOdometer> {
  const db = await getDatabase();
  return resolveEffectiveCurrentOdometerTx(db, vehicleId, options);
}

export async function syncVehicleCurrentOdometer(
  vehicleId: string,
): Promise<EffectiveCurrentOdometer> {
  const db = await getDatabase();
  return syncVehicleCurrentOdometerTx(db, vehicleId);
}
