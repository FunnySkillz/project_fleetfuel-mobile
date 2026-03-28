import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type { VehicleListItem, VehicleRecord } from '@/data/types';

import { normalizePlate, normalizeRequiredText, normalizeSearch } from './shared';

type VehicleRow = {
  id: string;
  name: string;
  plate: string;
  created_at: string;
  updated_at: string;
};

type VehicleListRow = VehicleRow & {
  trip_count: number;
  fuel_count: number;
  last_activity_at: string | null;
};

function mapVehicleRecord(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVehicleListItem(row: VehicleListRow): VehicleListItem {
  return {
    ...mapVehicleRecord(row),
    tripCount: row.trip_count,
    fuelCount: row.fuel_count,
    lastActivityAt: row.last_activity_at,
  };
}

async function ensureActivePlateIsAvailable(db: SQLite.SQLiteDatabase, plate: string, excludeId?: string) {
  const existing = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM vehicles
      WHERE deleted_at IS NULL
        AND lower(plate) = lower(?)
        AND (? = '' OR id <> ?)
      LIMIT 1
    `,
    [plate, excludeId ?? '', excludeId ?? ''],
  );

  if (existing) {
    throw new Error('A vehicle with this license plate already exists.');
  }
}

async function getVehicleRowById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<VehicleRow>(
    `
      SELECT id, name, plate, created_at, updated_at
      FROM vehicles
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );
}

export const vehiclesRepo = {
  async list(search?: string): Promise<VehicleListItem[]> {
    const db = await getDatabase();
    const normalizedSearch = normalizeSearch(search);
    const likeSearch = `%${normalizedSearch}%`;

    const rows = await db.getAllAsync<VehicleListRow>(
      `
        SELECT
          v.id,
          v.name,
          v.plate,
          v.created_at,
          v.updated_at,
          (
            SELECT COUNT(1)
            FROM trips t
            WHERE t.vehicle_id = v.id
              AND t.deleted_at IS NULL
          ) AS trip_count,
          (
            SELECT COUNT(1)
            FROM fuel_entries f
            WHERE f.vehicle_id = v.id
              AND f.deleted_at IS NULL
          ) AS fuel_count,
          (
            SELECT MAX(activity.occurred_at)
            FROM (
              SELECT t.occurred_at AS occurred_at
              FROM trips t
              WHERE t.vehicle_id = v.id
                AND t.deleted_at IS NULL
              UNION ALL
              SELECT f.occurred_at AS occurred_at
              FROM fuel_entries f
              WHERE f.vehicle_id = v.id
                AND f.deleted_at IS NULL
            ) activity
          ) AS last_activity_at
        FROM vehicles v
        WHERE v.deleted_at IS NULL
          AND (
            ? = ''
            OR lower(v.name) LIKE ?
            OR lower(v.plate) LIKE ?
          )
        ORDER BY lower(v.name) ASC, v.created_at DESC
      `,
      [normalizedSearch, likeSearch, likeSearch],
    );

    return rows.map(mapVehicleListItem);
  },

  async countActive(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `
        SELECT COUNT(1) AS total
        FROM vehicles
        WHERE deleted_at IS NULL
      `,
    );

    return row?.total ?? 0;
  },

  async getById(id: string): Promise<VehicleRecord | null> {
    const db = await getDatabase();
    const row = await getVehicleRowById(db, id);
    if (!row) {
      return null;
    }

    return mapVehicleRecord(row);
  },

  async create(input: { name: string; plate: string }): Promise<VehicleRecord> {
    const name = normalizeRequiredText(input.name, 'Vehicle name');
    const plate = normalizePlate(input.plate);
    const id = createId('veh');
    const timestamp = nowIso();

    return runInWriteTransaction(async (txn) => {
      await ensureActivePlateIsAvailable(txn, plate);

      await txn.runAsync(
        `
          INSERT INTO vehicles (id, name, plate, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, NULL)
        `,
        [id, name, plate, timestamp, timestamp],
      );

      return {
        id,
        name,
        plate,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  },

  async update(id: string, input: { name: string; plate: string }): Promise<VehicleRecord> {
    return runInWriteTransaction(async (txn) => {
      const current = await getVehicleRowById(txn, id);
      if (!current) {
        throw new Error('Vehicle not found.');
      }

      const name = normalizeRequiredText(input.name, 'Vehicle name');
      const plate = normalizePlate(input.plate);
      const timestamp = nowIso();

      await ensureActivePlateIsAvailable(txn, plate, id);

      await txn.runAsync(
        `
          UPDATE vehicles
          SET name = ?,
              plate = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [name, plate, timestamp, id],
      );

      return {
        id,
        name,
        plate,
        createdAt: current.created_at,
        updatedAt: timestamp,
      };
    });
  },

  async delete(id: string): Promise<void> {
    await runInWriteTransaction(async (txn) => {
      const timestamp = nowIso();
      const vehicleDeleteResult = await txn.runAsync(
        `
          UPDATE vehicles
          SET deleted_at = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      if ((vehicleDeleteResult.changes ?? 0) === 0) {
        throw new Error('Vehicle not found.');
      }

      await txn.runAsync(
        `
          UPDATE trips
          SET deleted_at = ?,
              updated_at = ?
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      await txn.runAsync(
        `
          UPDATE fuel_entries
          SET deleted_at = ?,
              updated_at = ?
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );
    });
  },
};
