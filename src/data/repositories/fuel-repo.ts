import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type { FuelEntryRecord } from '@/data/types';

import { normalizeOptionalText, normalizeRequiredText } from './shared';

const LITERS_MAX = 500;
const PRICE_MAX = 500000;
const STATION_MIN = 2;
const STATION_MAX = 80;
const NOTES_MAX = 500;

type FuelRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  liters: number;
  total_price: number;
  station: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapFuelRecord(row: FuelRow): FuelEntryRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    occurredAt: row.occurred_at,
    liters: row.liters,
    totalPrice: row.total_price,
    station: row.station,
    notes: row.notes,
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
    throw new Error('Fuel date/time is invalid.');
  }

  return parsed.toISOString();
}

function normalizePositiveNumber(value: number, fieldName: string, max: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  if (value <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }
  if (value > max) {
    throw new Error(`${fieldName} must be less than or equal to ${max}.`);
  }

  return value;
}

function normalizeStation(value: string) {
  const station = normalizeRequiredText(value, 'Station/vendor');
  if (station.length < STATION_MIN) {
    throw new Error(`Station/vendor must be at least ${STATION_MIN} characters.`);
  }
  if (station.length > STATION_MAX) {
    throw new Error(`Station/vendor must be at most ${STATION_MAX} characters.`);
  }

  return station;
}

function normalizeFuelNotes(value: string | null | undefined) {
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

async function getFuelRowById(db: SQLite.SQLiteDatabase, id: string) {
  return db.getFirstAsync<FuelRow>(
    `
      SELECT
        id,
        vehicle_id,
        occurred_at,
        liters,
        total_price,
        station,
        notes,
        created_at,
        updated_at
      FROM fuel_entries
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );
}

export const fuelRepo = {
  async listByVehicle(vehicleId: string): Promise<FuelEntryRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<FuelRow>(
      `
        SELECT
          id,
          vehicle_id,
          occurred_at,
          liters,
          total_price,
          station,
          notes,
          created_at,
          updated_at
        FROM fuel_entries
        WHERE vehicle_id = ?
          AND deleted_at IS NULL
        ORDER BY occurred_at DESC, created_at DESC
      `,
      [vehicleId],
    );

    return rows.map(mapFuelRecord);
  },

  async getById(id: string): Promise<FuelEntryRecord | null> {
    const db = await getDatabase();
    const row = await getFuelRowById(db, id);
    return row ? mapFuelRecord(row) : null;
  },

  async create(input: {
    vehicleId: string;
    occurredAt?: string | null;
    liters: number;
    totalPrice: number;
    station: string;
    notes?: string | null;
  }): Promise<FuelEntryRecord> {
    const id = createId('fuel');
    const vehicleId = input.vehicleId;
    const occurredAt = normalizeOccurredAt(input.occurredAt);
    const liters = normalizePositiveNumber(input.liters, 'Liters', LITERS_MAX);
    const totalPrice = normalizePositiveNumber(input.totalPrice, 'Total price', PRICE_MAX);
    const station = normalizeStation(input.station);
    const notes = normalizeFuelNotes(input.notes);
    const timestamp = nowIso();

    return runInWriteTransaction(async (txn) => {
      await ensureVehicleExists(txn, vehicleId);

      await txn.runAsync(
        `
          INSERT INTO fuel_entries (
            id,
            vehicle_id,
            occurred_at,
            liters,
            total_price,
            station,
            notes,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `,
        [id, vehicleId, occurredAt, liters, totalPrice, station, notes, timestamp, timestamp],
      );

      return {
        id,
        vehicleId,
        occurredAt,
        liters,
        totalPrice,
        station,
        notes,
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
      liters?: number;
      totalPrice?: number;
      station?: string;
      notes?: string | null;
    },
  ): Promise<FuelEntryRecord> {
    return runInWriteTransaction(async (txn) => {
      const current = await getFuelRowById(txn, id);
      if (!current) {
        throw new Error('Fuel entry not found.');
      }

      const vehicleId = patch.vehicleId ?? current.vehicle_id;
      const occurredAt = patch.occurredAt === undefined ? current.occurred_at : normalizeOccurredAt(patch.occurredAt);
      const liters =
        patch.liters === undefined ? current.liters : normalizePositiveNumber(patch.liters, 'Liters', LITERS_MAX);
      const totalPrice =
        patch.totalPrice === undefined
          ? current.total_price
          : normalizePositiveNumber(patch.totalPrice, 'Total price', PRICE_MAX);
      const station = patch.station === undefined ? current.station : normalizeStation(patch.station);
      const notes = patch.notes === undefined ? current.notes : normalizeFuelNotes(patch.notes);
      const timestamp = nowIso();

      await ensureVehicleExists(txn, vehicleId);

      await txn.runAsync(
        `
          UPDATE fuel_entries
          SET vehicle_id = ?,
              occurred_at = ?,
              liters = ?,
              total_price = ?,
              station = ?,
              notes = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [vehicleId, occurredAt, liters, totalPrice, station, notes, timestamp, id],
      );

      return {
        id,
        vehicleId,
        occurredAt,
        liters,
        totalPrice,
        station,
        notes,
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
          UPDATE fuel_entries
          SET deleted_at = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [timestamp, timestamp, id],
      );

      if ((result.changes ?? 0) === 0) {
        throw new Error('Fuel entry not found.');
      }
    });
  },
};
