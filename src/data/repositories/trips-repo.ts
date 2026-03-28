import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type { TripPrivateTag, TripRecord } from '@/data/types';

import { assertValidPrivateTag, ensureValidTime, normalizeOptionalText, normalizeRequiredText } from './shared';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const NOTES_MAX = 500;
const LOCATION_MAX = 120;
const ODOMETER_MAX = 9_999_999;

type TripRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  purpose: string;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  distance_km: number;
  start_time: string | null;
  end_time: string | null;
  start_location: string | null;
  end_location: string | null;
  notes: string | null;
  private_tag: TripPrivateTag;
  created_at: string;
  updated_at: string;
};

type TripCreateInput = {
  vehicleId: string;
  occurredAt?: string | null;
  purpose: string;
  startOdometerKm: number;
  endOdometerKm: number;
  startTime?: string | null;
  endTime?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  notes?: string | null;
  privateTag?: TripPrivateTag;
};

function mapTripRecord(row: TripRow): TripRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    occurredAt: row.occurred_at,
    purpose: row.purpose,
    startOdometerKm: row.start_odometer_km ?? 0,
    endOdometerKm: row.end_odometer_km ?? row.distance_km,
    distanceKm: row.distance_km,
    startTime: row.start_time,
    endTime: row.end_time,
    startLocation: row.start_location,
    endLocation: row.end_location,
    notes: row.notes,
    privateTag: row.private_tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOccurredAt(value: string | null | undefined) {
  if (!value) {
    return nowIso();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Trip date/time is invalid.');
  }

  return parsed.toISOString();
}

function normalizePurpose(value: string) {
  const purpose = normalizeRequiredText(value, 'Purpose');
  if (purpose.length < PURPOSE_MIN) {
    throw new Error(`Purpose must be at least ${PURPOSE_MIN} characters.`);
  }
  if (purpose.length > PURPOSE_MAX) {
    throw new Error(`Purpose must be at most ${PURPOSE_MAX} characters.`);
  }
  return purpose;
}

function normalizeOdometer(value: number, fieldName: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be a whole number.`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be 0 or greater.`);
  }
  if (value > ODOMETER_MAX) {
    throw new Error(`${fieldName} must be less than or equal to ${ODOMETER_MAX}.`);
  }

  return value;
}

function normalizeTripNotes(value: string | null | undefined) {
  const notes = normalizeOptionalText(value);
  if (notes && notes.length > NOTES_MAX) {
    throw new Error(`Notes must be at most ${NOTES_MAX} characters.`);
  }
  return notes;
}

function normalizeLocation(value: string | null | undefined, fieldName: string) {
  const location = normalizeOptionalText(value);
  if (location && location.length > LOCATION_MAX) {
    throw new Error(`${fieldName} must be at most ${LOCATION_MAX} characters.`);
  }
  return location;
}

async function ensureVehicleExists(db: SQLite.SQLiteDatabase, vehicleId: string) {
  const vehicle = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM vehicles
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [vehicleId],
  );

  if (!vehicle) {
    throw new Error('Selected vehicle no longer exists.');
  }
}

async function getTripRowById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<TripRow>(
    `
      SELECT
        id,
        vehicle_id,
        occurred_at,
        purpose,
        start_odometer_km,
        end_odometer_km,
        distance_km,
        start_time,
        end_time,
        start_location,
        end_location,
        notes,
        private_tag,
        created_at,
        updated_at
      FROM trips
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );
}

async function getLatestVehicleOdometer(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
  options: { excludeTripId?: string } = {},
) {
  const row = await db.getFirstAsync<{ odometer_km: number | null }>(
    `
      SELECT odometer_km
      FROM (
        SELECT t.end_odometer_km AS odometer_km, t.occurred_at AS occurred_at
        FROM trips t
        WHERE t.vehicle_id = ?
          AND t.deleted_at IS NULL
          AND (? = '' OR t.id <> ?)
          AND t.end_odometer_km IS NOT NULL

        UNION ALL

        SELECT f.odometer_km AS odometer_km, f.occurred_at AS occurred_at
        FROM fuel_entries f
        WHERE f.vehicle_id = ?
          AND f.deleted_at IS NULL
          AND f.odometer_km IS NOT NULL
      ) latest
      ORDER BY latest.occurred_at DESC
      LIMIT 1
    `,
    [vehicleId, options.excludeTripId ?? '', options.excludeTripId ?? '', vehicleId],
  );

  return row?.odometer_km ?? null;
}

function assertTimeOrder(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) {
    return;
  }

  if (endTime < startTime) {
    throw new Error('End time must be later than or equal to start time.');
  }
}

function normalizeTripCreateInput(input: TripCreateInput) {
  const startOdometerKm = normalizeOdometer(input.startOdometerKm, 'Start km');
  const endOdometerKm = normalizeOdometer(input.endOdometerKm, 'Current km');

  if (endOdometerKm < startOdometerKm) {
    throw new Error('Current km cannot be less than start km.');
  }

  if (endOdometerKm === startOdometerKm) {
    throw new Error('Current km must be greater than start km.');
  }

  const startTime = ensureValidTime(input.startTime, 'Start time');
  const endTime = ensureValidTime(input.endTime, 'End time');
  assertTimeOrder(startTime, endTime);

  return {
    vehicleId: input.vehicleId,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    purpose: normalizePurpose(input.purpose),
    startOdometerKm,
    endOdometerKm,
    distanceKm: endOdometerKm - startOdometerKm,
    startTime,
    endTime,
    startLocation: normalizeLocation(input.startLocation, 'Start location'),
    endLocation: normalizeLocation(input.endLocation, 'End location'),
    notes: normalizeTripNotes(input.notes),
    privateTag: assertValidPrivateTag(input.privateTag),
  };
}

export const tripsRepo = {
  async listByVehicle(vehicleId: string): Promise<TripRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<TripRow>(
      `
        SELECT
          id,
          vehicle_id,
          occurred_at,
          purpose,
          start_odometer_km,
          end_odometer_km,
          distance_km,
          start_time,
          end_time,
          start_location,
          end_location,
          notes,
          private_tag,
          created_at,
          updated_at
        FROM trips
        WHERE vehicle_id = ?
          AND deleted_at IS NULL
        ORDER BY occurred_at DESC, created_at DESC
      `,
      [vehicleId],
    );

    return rows.map(mapTripRecord);
  },

  async getById(id: string): Promise<TripRecord | null> {
    const db = await getDatabase();
    const row = await getTripRowById(db, id);
    return row ? mapTripRecord(row) : null;
  },

  async getLatestRecordedOdometerKmForVehicle(vehicleId: string): Promise<number | null> {
    const db = await getDatabase();
    return getLatestVehicleOdometer(db, vehicleId);
  },

  async create(input: TripCreateInput): Promise<TripRecord> {
    const id = createId('trip');
    const normalized = normalizeTripCreateInput(input);
    const timestamp = nowIso();

    return runInWriteTransaction(async (txn) => {
      await ensureVehicleExists(txn, normalized.vehicleId);

      const latestOdometer = await getLatestVehicleOdometer(txn, normalized.vehicleId);
      if (latestOdometer !== null && normalized.startOdometerKm < latestOdometer) {
        throw new Error('Start km cannot be less than the latest recorded km.');
      }
      if (latestOdometer !== null && normalized.endOdometerKm < latestOdometer) {
        throw new Error('Current km cannot be less than the latest recorded km.');
      }

      await txn.runAsync(
        `
          INSERT INTO trips (
            id,
            vehicle_id,
            occurred_at,
            purpose,
            start_odometer_km,
            end_odometer_km,
            distance_km,
            start_time,
            end_time,
            start_location,
            end_location,
            notes,
            private_tag,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `,
        [
          id,
          normalized.vehicleId,
          normalized.occurredAt,
          normalized.purpose,
          normalized.startOdometerKm,
          normalized.endOdometerKm,
          normalized.distanceKm,
          normalized.startTime,
          normalized.endTime,
          normalized.startLocation,
          normalized.endLocation,
          normalized.notes,
          normalized.privateTag,
          timestamp,
          timestamp,
        ],
      );

      return {
        id,
        ...normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  },

  async update(
    id: string,
    patch: Partial<TripCreateInput>,
  ): Promise<TripRecord> {
    return runInWriteTransaction(async (txn) => {
      const current = await getTripRowById(txn, id);
      if (!current) {
        throw new Error('Trip not found.');
      }

      const normalized = normalizeTripCreateInput({
        vehicleId: patch.vehicleId ?? current.vehicle_id,
        occurredAt: patch.occurredAt ?? current.occurred_at,
        purpose: patch.purpose ?? current.purpose,
        startOdometerKm: patch.startOdometerKm ?? current.start_odometer_km ?? 0,
        endOdometerKm: patch.endOdometerKm ?? current.end_odometer_km ?? current.distance_km,
        startTime: patch.startTime ?? current.start_time,
        endTime: patch.endTime ?? current.end_time,
        startLocation: patch.startLocation ?? current.start_location,
        endLocation: patch.endLocation ?? current.end_location,
        notes: patch.notes ?? current.notes,
        privateTag: patch.privateTag ?? current.private_tag,
      });

      await ensureVehicleExists(txn, normalized.vehicleId);

      const latestOdometer = await getLatestVehicleOdometer(txn, normalized.vehicleId, { excludeTripId: id });
      if (latestOdometer !== null && normalized.startOdometerKm < latestOdometer) {
        throw new Error('Start km cannot be less than the latest recorded km.');
      }
      if (latestOdometer !== null && normalized.endOdometerKm < latestOdometer) {
        throw new Error('Current km cannot be less than the latest recorded km.');
      }

      const timestamp = nowIso();
      await txn.runAsync(
        `
          UPDATE trips
          SET vehicle_id = ?,
              occurred_at = ?,
              purpose = ?,
              start_odometer_km = ?,
              end_odometer_km = ?,
              distance_km = ?,
              start_time = ?,
              end_time = ?,
              start_location = ?,
              end_location = ?,
              notes = ?,
              private_tag = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [
          normalized.vehicleId,
          normalized.occurredAt,
          normalized.purpose,
          normalized.startOdometerKm,
          normalized.endOdometerKm,
          normalized.distanceKm,
          normalized.startTime,
          normalized.endTime,
          normalized.startLocation,
          normalized.endLocation,
          normalized.notes,
          normalized.privateTag,
          timestamp,
          id,
        ],
      );

      return {
        id,
        ...normalized,
        createdAt: current.created_at,
        updatedAt: timestamp,
      };
    });
  },

  async delete(id: string): Promise<void> {
    await runInWriteTransaction(async (txn) => {
      const timestamp = nowIso();
      const result = await txn.runAsync(
        `
          UPDATE trips
          SET deleted_at = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      if ((result.changes ?? 0) === 0) {
        throw new Error('Trip not found.');
      }
    });
  },
};
