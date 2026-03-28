import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { nowIso } from '@/data/db-utils';
import type { EntryDetail, TripPrivateTag } from '@/data/types';

import { assertValidPrivateTag, normalizeOptionalText } from './shared';

const NOTES_MAX = 500;

type TripDetailRow = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  occurred_at: string;
  purpose: string;
  distance_km: number;
  notes: string | null;
  private_tag: TripPrivateTag;
};

type FuelDetailRow = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  occurred_at: string;
  liters: number;
  total_price: number;
  station: string;
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
    distanceKm: row.distance_km,
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
    liters: row.liters,
    totalPrice: row.total_price,
    station: row.station,
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
        t.distance_km,
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
        f.liters,
        f.total_price,
        f.station,
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
        const nextPrivateTag =
          patch.privateTag === undefined ? trip.private_tag : assertValidPrivateTag(patch.privateTag);

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
