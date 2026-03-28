import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type { VehicleListItem, VehicleRecord } from '@/data/types';

import { normalizeOptionalInteger, normalizeOptionalText, normalizePlate, normalizeRequiredText, normalizeSearch } from './shared';

const VEHICLE_NAME_MIN = 2;
const VEHICLE_NAME_MAX = 60;
const TEXT_FIELD_MAX = 80;
const ENGINE_CODE_MAX = 40;

type VehicleRow = {
  id: string;
  name: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  ps: number | null;
  kw: number | null;
  engine_displacement_cc: number | null;
  vin: string | null;
  engine_type_code: string | null;
  created_at: string;
  updated_at: string;
};

type VehicleListRow = VehicleRow & {
  trip_count: number;
  fuel_count: number;
  last_activity_at: string | null;
};

type VehicleWriteInput = {
  name: string;
  plate: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  ps?: number | null;
  kw?: number | null;
  engineDisplacementCc?: number | null;
  vin?: string | null;
  engineTypeCode?: string | null;
};

type NormalizedVehicleInput = {
  name: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  ps: number | null;
  kw: number | null;
  engineDisplacementCc: number | null;
  vin: string | null;
  engineTypeCode: string | null;
};

function mapVehicleRecord(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    make: row.make,
    model: row.model,
    year: row.year,
    ps: row.ps,
    kw: row.kw,
    engineDisplacementCc: row.engine_displacement_cc,
    vin: row.vin,
    engineTypeCode: row.engine_type_code,
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

function normalizeBoundedOptionalText(value: string | null | undefined, fieldName: string, maxLength: number) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function normalizeVin(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]+$/.test(upper)) {
    throw new Error('VIN can only contain letters A-Z (without I, O, Q) and numbers.');
  }
  if (upper.length < 11 || upper.length > 17) {
    throw new Error('VIN must be between 11 and 17 characters.');
  }

  return upper;
}

function normalizeVehicleInput(input: VehicleWriteInput): NormalizedVehicleInput {
  const name = normalizeRequiredText(input.name, 'Vehicle name');
  if (name.length < VEHICLE_NAME_MIN || name.length > VEHICLE_NAME_MAX) {
    throw new Error(`Vehicle name must be between ${VEHICLE_NAME_MIN} and ${VEHICLE_NAME_MAX} characters.`);
  }

  return {
    name,
    plate: normalizePlate(input.plate),
    make: normalizeBoundedOptionalText(input.make, 'Make', TEXT_FIELD_MAX),
    model: normalizeBoundedOptionalText(input.model, 'Model', TEXT_FIELD_MAX),
    year: normalizeOptionalInteger(input.year, 'Year', 1950, new Date().getUTCFullYear() + 1),
    ps: normalizeOptionalInteger(input.ps, 'PS', 1, 3000),
    kw: normalizeOptionalInteger(input.kw, 'kW', 1, 3000),
    engineDisplacementCc: normalizeOptionalInteger(input.engineDisplacementCc, 'Engine displacement', 50, 20000),
    vin: normalizeVin(input.vin),
    engineTypeCode: normalizeBoundedOptionalText(input.engineTypeCode, 'Engine type code', ENGINE_CODE_MAX),
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

async function ensureActiveVinIsAvailable(db: SQLite.SQLiteDatabase, vin: string | null, excludeId?: string) {
  if (!vin) {
    return;
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM vehicles
      WHERE deleted_at IS NULL
        AND upper(vin) = upper(?)
        AND (? = '' OR id <> ?)
      LIMIT 1
    `,
    [vin, excludeId ?? '', excludeId ?? ''],
  );

  if (existing) {
    throw new Error('A vehicle with this VIN already exists.');
  }
}

async function getVehicleRowById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<VehicleRow>(
    `
      SELECT
        id,
        name,
        plate,
        make,
        model,
        year,
        ps,
        kw,
        engine_displacement_cc,
        vin,
        engine_type_code,
        created_at,
        updated_at
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
          v.make,
          v.model,
          v.year,
          v.ps,
          v.kw,
          v.engine_displacement_cc,
          v.vin,
          v.engine_type_code,
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
            OR lower(ifnull(v.make, '')) LIKE ?
            OR lower(ifnull(v.model, '')) LIKE ?
            OR lower(ifnull(v.vin, '')) LIKE ?
          )
        ORDER BY lower(v.name) ASC, v.created_at DESC
      `,
      [normalizedSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
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

  async create(input: VehicleWriteInput): Promise<VehicleRecord> {
    const normalized = normalizeVehicleInput(input);
    const id = createId('veh');
    const timestamp = nowIso();

    return runInWriteTransaction(async (txn) => {
      await ensureActivePlateIsAvailable(txn, normalized.plate);
      await ensureActiveVinIsAvailable(txn, normalized.vin);

      await txn.runAsync(
        `
          INSERT INTO vehicles (
            id,
            name,
            plate,
            make,
            model,
            year,
            ps,
            kw,
            engine_displacement_cc,
            vin,
            engine_type_code,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `,
        [
          id,
          normalized.name,
          normalized.plate,
          normalized.make,
          normalized.model,
          normalized.year,
          normalized.ps,
          normalized.kw,
          normalized.engineDisplacementCc,
          normalized.vin,
          normalized.engineTypeCode,
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

  async update(id: string, input: VehicleWriteInput): Promise<VehicleRecord> {
    return runInWriteTransaction(async (txn) => {
      const current = await getVehicleRowById(txn, id);
      if (!current) {
        throw new Error('Vehicle not found.');
      }

      const normalized = normalizeVehicleInput(input);
      const timestamp = nowIso();

      await ensureActivePlateIsAvailable(txn, normalized.plate, id);
      await ensureActiveVinIsAvailable(txn, normalized.vin, id);

      await txn.runAsync(
        `
          UPDATE vehicles
          SET name = ?,
              plate = ?,
              make = ?,
              model = ?,
              year = ?,
              ps = ?,
              kw = ?,
              engine_displacement_cc = ?,
              vin = ?,
              engine_type_code = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [
          normalized.name,
          normalized.plate,
          normalized.make,
          normalized.model,
          normalized.year,
          normalized.ps,
          normalized.kw,
          normalized.engineDisplacementCc,
          normalized.vin,
          normalized.engineTypeCode,
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
