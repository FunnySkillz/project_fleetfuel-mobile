import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type { TripPrivateTag, TripRecord } from '@/data/types';

import { assertValidPrivateTag, normalizeOptionalText, normalizeRequiredText } from './shared';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const DISTANCE_MAX_KM = 50000;
const NOTES_MAX = 500;

type TripRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  purpose: string;
  distance_km: number;
  notes: string | null;
  private_tag: TripPrivateTag;
  created_at: string;
  updated_at: string;
};

function mapTripRecord(row: TripRow): TripRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    occurredAt: row.occurred_at,
    purpose: row.purpose,
    distanceKm: row.distance_km,
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

function normalizeDistance(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error('Distance must be a whole number.');
  }
  if (value <= 0) {
    throw new Error('Distance must be greater than 0.');
  }
  if (value > DISTANCE_MAX_KM) {
    throw new Error(`Distance must be less than or equal to ${DISTANCE_MAX_KM} km.`);
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
        distance_km,
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
          distance_km,
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

  async create(input: {
    vehicleId: string;
    occurredAt?: string | null;
    purpose: string;
    distanceKm: number;
    notes?: string | null;
    privateTag?: TripPrivateTag;
  }): Promise<TripRecord> {
    const id = createId('trip');
    const vehicleId = input.vehicleId;
    const occurredAt = normalizeOccurredAt(input.occurredAt);
    const purpose = normalizePurpose(input.purpose);
    const distanceKm = normalizeDistance(input.distanceKm);
    const notes = normalizeTripNotes(input.notes);
    const privateTag = assertValidPrivateTag(input.privateTag);
    const timestamp = nowIso();

    return runInWriteTransaction(async (txn) => {
      await ensureVehicleExists(txn, vehicleId);

      await txn.runAsync(
        `
          INSERT INTO trips (
            id,
            vehicle_id,
            occurred_at,
            purpose,
            distance_km,
            notes,
            private_tag,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `,
        [id, vehicleId, occurredAt, purpose, distanceKm, notes, privateTag, timestamp, timestamp],
      );

      return {
        id,
        vehicleId,
        occurredAt,
        purpose,
        distanceKm,
        notes,
        privateTag,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  },

  async update(
    id: string,
    patch: {
      vehicleId?: string;
      occurredAt?: string | null;
      purpose?: string;
      distanceKm?: number;
      notes?: string | null;
      privateTag?: TripPrivateTag;
    },
  ): Promise<TripRecord> {
    return runInWriteTransaction(async (txn) => {
      const current = await getTripRowById(txn, id);
      if (!current) {
        throw new Error('Trip not found.');
      }

      const vehicleId = patch.vehicleId ?? current.vehicle_id;
      const occurredAt = patch.occurredAt === undefined ? current.occurred_at : normalizeOccurredAt(patch.occurredAt);
      const purpose = patch.purpose === undefined ? current.purpose : normalizePurpose(patch.purpose);
      const distanceKm = patch.distanceKm === undefined ? current.distance_km : normalizeDistance(patch.distanceKm);
      const notes = patch.notes === undefined ? current.notes : normalizeTripNotes(patch.notes);
      const privateTag = patch.privateTag === undefined ? current.private_tag : assertValidPrivateTag(patch.privateTag);
      const timestamp = nowIso();

      await ensureVehicleExists(txn, vehicleId);

      await txn.runAsync(
        `
          UPDATE trips
          SET vehicle_id = ?,
              occurred_at = ?,
              purpose = ?,
              distance_km = ?,
              notes = ?,
              private_tag = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [vehicleId, occurredAt, purpose, distanceKm, notes, privateTag, timestamp, id],
      );

      return {
        id,
        vehicleId,
        occurredAt,
        purpose,
        distanceKm,
        notes,
        privateTag,
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
