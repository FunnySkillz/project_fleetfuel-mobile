import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { nowIso } from '@/data/db-utils';
import type { EntryDetail, FuelEntryDetail, TripPrivateTag } from '@/data/types';

import { assertRequiredPrivateTag, normalizeOptionalText } from './shared';

const NOTES_MAX = 500;

type TripDetailRow = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
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
};

type FuelDetailRow = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  occurred_at: string;
  fuel_type: FuelEntryDetail['fuelType'];
  liters: number;
  total_price: number;
  station: string;
  odometer_km: number | null;
  avg_consumption_l_per_100km: number | null;
  receipt_uri: string | null;
  receipt_name: string | null;
  receipt_mime_type: string | null;
  notes: string | null;
};

function mapTripDetail(row: TripDetailRow): EntryDetail {
  return {
    type: 'trip',
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
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
  };
}

function mapFuelDetail(row: FuelDetailRow): EntryDetail {
  return {
    type: 'fuel',
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    occurredAt: row.occurred_at,
    fuelType: row.fuel_type,
    liters: row.liters,
    totalPrice: row.total_price,
    station: row.station,
    odometerKm: row.odometer_km,
    avgConsumptionLPer100Km: row.avg_consumption_l_per_100km,
    receiptUri: row.receipt_uri,
    receiptName: row.receipt_name,
    receiptMimeType: row.receipt_mime_type,
    notes: row.notes,
  };
}

async function getTripDetailById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<TripDetailRow>(
    `
      SELECT
        t.id,
        t.vehicle_id,
        v.name AS vehicle_name,
        t.occurred_at,
        t.purpose,
        t.start_odometer_km,
        t.end_odometer_km,
        t.distance_km,
        t.start_time,
        t.end_time,
        t.start_location,
        t.end_location,
        t.notes,
        t.private_tag
      FROM trips t
      INNER JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.id = ?
        AND t.deleted_at IS NULL
        AND v.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );
}

async function getFuelDetailById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<FuelDetailRow>(
    `
      SELECT
        f.id,
        f.vehicle_id,
        v.name AS vehicle_name,
        f.occurred_at,
        f.fuel_type,
        f.liters,
        f.total_price,
        f.station,
        f.odometer_km,
        f.avg_consumption_l_per_100km,
        f.receipt_uri,
        f.receipt_name,
        f.receipt_mime_type,
        f.notes
      FROM fuel_entries f
      INNER JOIN vehicles v ON v.id = f.vehicle_id
      WHERE f.id = ?
        AND f.deleted_at IS NULL
        AND v.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );
}

function normalizeNotes(value: string | null | undefined) {
  const notes = normalizeOptionalText(value);
  if (notes && notes.length > NOTES_MAX) {
    throw new Error(`Notes must be at most ${NOTES_MAX} characters.`);
  }

  return notes;
}

function getMonthRangeIso(referenceIso: string) {
  const date = new Date(referenceIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid reference date.');
  }

  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return {
    from: monthStart.toISOString(),
    toExclusive: nextMonthStart.toISOString(),
  };
}

async function getLatestVehicleOdometer(db: SQLite.SQLiteDatabase, vehicleId: string) {
  const row = await db.getFirstAsync<{ odometer_km: number | null }>(
    `
      SELECT odometer_km
      FROM (
        SELECT t.end_odometer_km AS odometer_km, t.occurred_at AS occurred_at
        FROM trips t
        WHERE t.vehicle_id = ?
          AND t.deleted_at IS NULL
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
    [vehicleId, vehicleId],
  );

  return row?.odometer_km ?? null;
}

export const entriesRepo = {
  async getById(id: string): Promise<EntryDetail | null> {
    const db = await getDatabase();

    const trip = await getTripDetailById(db, id);
    if (trip) {
      return mapTripDetail(trip);
    }

    const fuel = await getFuelDetailById(db, id);
    if (fuel) {
      return mapFuelDetail(fuel);
    }

    return null;
  },

  async getLatestOdometerKmForVehicle(vehicleId: string): Promise<number | null> {
    const db = await getDatabase();
    return getLatestVehicleOdometer(db, vehicleId);
  },

  async updateEditableFields(
    id: string,
    patch: {
      notes?: string | null;
      privateTag?: TripPrivateTag;
    },
  ): Promise<EntryDetail> {
    const notes = patch.notes === undefined ? undefined : normalizeNotes(patch.notes);

    await runInWriteTransaction(async (txn) => {
      const timestamp = nowIso();

      const trip = await txn.getFirstAsync<{ id: string; private_tag: TripPrivateTag; notes: string | null }>(
        `
          SELECT id, private_tag, notes
          FROM trips
          WHERE id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [id],
      );

      if (trip) {
        const nextNotes = notes === undefined ? trip.notes : notes;
        const nextPrivateTag = assertRequiredPrivateTag(patch.privateTag === undefined ? trip.private_tag : patch.privateTag);

        await txn.runAsync(
          `
            UPDATE trips
            SET notes = ?,
                private_tag = ?,
                updated_at = ?
            WHERE id = ?
              AND deleted_at IS NULL
          `,
          [nextNotes, nextPrivateTag, timestamp, id],
        );
        return;
      }

      const fuel = await txn.getFirstAsync<{ id: string; notes: string | null }>(
        `
          SELECT id, notes
          FROM fuel_entries
          WHERE id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [id],
      );

      if (!fuel) {
        throw new Error('Entry not found.');
      }

      const nextNotes = notes === undefined ? fuel.notes : notes;
      await txn.runAsync(
        `
          UPDATE fuel_entries
          SET notes = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [nextNotes, timestamp, id],
      );
    });

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Entry not found after update.');
    }

    return updated;
  },

  async delete(id: string): Promise<void> {
    await runInWriteTransaction(async (txn) => {
      const timestamp = nowIso();

      const tripDelete = await txn.runAsync(
        `
          UPDATE trips
          SET deleted_at = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      if ((tripDelete.changes ?? 0) > 0) {
        return;
      }

      const fuelDelete = await txn.runAsync(
        `
          UPDATE fuel_entries
          SET deleted_at = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      if ((fuelDelete.changes ?? 0) === 0) {
        throw new Error('Entry not found.');
      }
    });
  },

  async countMonthly(referenceIso: string = nowIso()): Promise<{ trips: number; fuelEntries: number }> {
    const { from, toExclusive } = getMonthRangeIso(referenceIso);
    const db = await getDatabase();

    const tripsRow = await db.getFirstAsync<{ total: number }>(
      `
        SELECT COUNT(1) AS total
        FROM trips
        WHERE deleted_at IS NULL
          AND occurred_at >= ?
          AND occurred_at < ?
      `,
      [from, toExclusive],
    );

    const fuelRow = await db.getFirstAsync<{ total: number }>(
      `
        SELECT COUNT(1) AS total
        FROM fuel_entries
        WHERE deleted_at IS NULL
          AND occurred_at >= ?
          AND occurred_at < ?
      `,
      [from, toExclusive],
    );

    return {
      trips: tripsRow?.total ?? 0,
      fuelEntries: fuelRow?.total ?? 0,
    };
  },
};
