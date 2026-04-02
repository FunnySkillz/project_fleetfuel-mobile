import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import { FUEL_TYPES, type FuelEntryRecord, type FuelType, type ReceiptAttachment } from '@/data/types';
import { emitDataChange } from '@/services/data-change-events';

import { resolveEffectiveCurrentOdometerTx, syncVehicleCurrentOdometerTx } from './odometer-resolver';
import { normalizeOptionalText, normalizeRequiredText } from './shared';

const LITERS_MAX = 500;
const PRICE_MAX = 500000;
const STATION_MIN = 2;
const STATION_MAX = 80;
const NOTES_MAX = 500;
const ODOMETER_MAX = 9_999_999;
const FUEL_TYPE_SET = new Set<FuelType>(FUEL_TYPES);

type FuelRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  fuel_type: FuelType | null;
  liters: number;
  total_price: number;
  station: string;
  odometer_km: number | null;
  avg_consumption_l_per_100km: number | null;
  receipt_uri: string | null;
  receipt_name: string | null;
  receipt_mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FuelCreateInput = {
  vehicleId: string;
  occurredAt?: string | null;
  fuelType?: FuelType | null;
  liters: number;
  totalPrice: number;
  station: string;
  odometerKm: number;
  receipt?: ReceiptAttachment | null;
  notes?: string | null;
};

function mapFuelRecord(row: FuelRow): FuelEntryRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
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

function normalizeOdometer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error('Current km must be a whole number.');
  }
  if (value < 0) {
    throw new Error('Current km must be 0 or greater.');
  }
  if (value > ODOMETER_MAX) {
    throw new Error(`Current km must be less than or equal to ${ODOMETER_MAX}.`);
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

function normalizeReceipt(value: ReceiptAttachment | null | undefined): ReceiptAttachment | null {
  if (!value) {
    return null;
  }

  const uri = normalizeRequiredText(value.uri, 'Receipt URI');
  const name = normalizeRequiredText(value.name, 'Receipt name');
  const mimeType = normalizeOptionalText(value.mimeType);

  return {
    uri,
    name,
    mimeType,
  };
}

function normalizeFuelType(value: FuelType | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (FUEL_TYPE_SET.has(value)) {
    return value;
  }

  throw new Error('Fuel type is invalid.');
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
        fuel_type,
        liters,
        total_price,
        station,
        odometer_km,
        avg_consumption_l_per_100km,
        receipt_uri,
        receipt_name,
        receipt_mime_type,
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

async function getLatestFuelOdometer(
  db: SQLite.SQLiteDatabase,
  vehicleId: string,
  options: { excludeFuelId?: string } = {},
) {
  const row = await db.getFirstAsync<{ odometer_km: number | null }>(
    `
      SELECT odometer_km
      FROM fuel_entries
      WHERE vehicle_id = ?
        AND deleted_at IS NULL
        AND (? = '' OR id <> ?)
        AND odometer_km IS NOT NULL
      ORDER BY occurred_at DESC, updated_at DESC, created_at DESC, id DESC
      LIMIT 1
    `,
    [vehicleId, options.excludeFuelId ?? '', options.excludeFuelId ?? ''],
  );

  return row?.odometer_km ?? null;
}

function calculateAvgConsumption(liters: number, odometerKm: number, previousFuelOdometerKm: number | null) {
  if (previousFuelOdometerKm === null) {
    return null;
  }

  const distanceKm = odometerKm - previousFuelOdometerKm;
  if (distanceKm <= 0) {
    return null;
  }

  const raw = (liters / distanceKm) * 100;
  return Math.round(raw * 100) / 100;
}

function normalizeCreateInput(input: FuelCreateInput) {
  return {
    vehicleId: input.vehicleId,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    fuelType: normalizeFuelType(input.fuelType),
    liters: normalizePositiveNumber(input.liters, 'Liters', LITERS_MAX),
    totalPrice: normalizePositiveNumber(input.totalPrice, 'Total price', PRICE_MAX),
    station: normalizeStation(input.station),
    odometerKm: normalizeOdometer(input.odometerKm),
    receipt: normalizeReceipt(input.receipt),
    notes: normalizeFuelNotes(input.notes),
  };
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
          fuel_type,
          liters,
          total_price,
          station,
          odometer_km,
          avg_consumption_l_per_100km,
          receipt_uri,
          receipt_name,
          receipt_mime_type,
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

  async getLatestFuelOdometerKmForVehicle(vehicleId: string): Promise<number | null> {
    const db = await getDatabase();
    return getLatestFuelOdometer(db, vehicleId);
  },

  async create(input: FuelCreateInput): Promise<FuelEntryRecord> {
    const id = createId('fuel');
    const normalized = normalizeCreateInput(input);
    const timestamp = nowIso();

    const created = await runInWriteTransaction(async (txn) => {
      await ensureVehicleExists(txn, normalized.vehicleId);

      const effectiveCurrent = await resolveEffectiveCurrentOdometerTx(txn, normalized.vehicleId);
      if (normalized.odometerKm < effectiveCurrent.value) {
        throw new Error('Current km cannot be less than the latest recorded km.');
      }

      const previousFuelOdometer = await getLatestFuelOdometer(txn, normalized.vehicleId);
      const avgConsumption = calculateAvgConsumption(normalized.liters, normalized.odometerKm, previousFuelOdometer);

      await txn.runAsync(
        `
          INSERT INTO fuel_entries (
            id,
            vehicle_id,
            occurred_at,
            fuel_type,
            liters,
            total_price,
            station,
            odometer_km,
            avg_consumption_l_per_100km,
            receipt_uri,
            receipt_name,
            receipt_mime_type,
            notes,
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
          normalized.fuelType,
          normalized.liters,
          normalized.totalPrice,
          normalized.station,
          normalized.odometerKm,
          avgConsumption,
          normalized.receipt?.uri ?? null,
          normalized.receipt?.name ?? null,
          normalized.receipt?.mimeType ?? null,
          normalized.notes,
          timestamp,
          timestamp,
        ],
      );

      await syncVehicleCurrentOdometerTx(txn, normalized.vehicleId);

      return {
        id,
        vehicleId: normalized.vehicleId,
        occurredAt: normalized.occurredAt,
        fuelType: normalized.fuelType,
        liters: normalized.liters,
        totalPrice: normalized.totalPrice,
        station: normalized.station,
        odometerKm: normalized.odometerKm,
        avgConsumptionLPer100Km: avgConsumption,
        receiptUri: normalized.receipt?.uri ?? null,
        receiptName: normalized.receipt?.name ?? null,
        receiptMimeType: normalized.receipt?.mimeType ?? null,
        notes: normalized.notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
    emitDataChange({ scope: 'entries', action: 'create' });
    return created;
  },

  async update(
    id: string,
    patch: Partial<FuelCreateInput>,
  ): Promise<FuelEntryRecord> {
    const updated = await runInWriteTransaction(async (txn) => {
      const current = await getFuelRowById(txn, id);
      if (!current) {
        throw new Error('Fuel entry not found.');
      }

      const normalized = normalizeCreateInput({
        vehicleId: patch.vehicleId ?? current.vehicle_id,
        occurredAt: patch.occurredAt ?? current.occurred_at,
        fuelType: patch.fuelType ?? current.fuel_type,
        liters: patch.liters ?? current.liters,
        totalPrice: patch.totalPrice ?? current.total_price,
        station: patch.station ?? current.station,
        odometerKm: patch.odometerKm ?? current.odometer_km ?? 0,
        receipt:
          patch.receipt ??
          (current.receipt_uri
            ? {
                uri: current.receipt_uri,
                name: current.receipt_name ?? 'receipt',
                mimeType: current.receipt_mime_type,
              }
            : null),
        notes: patch.notes ?? current.notes,
      });

      await ensureVehicleExists(txn, normalized.vehicleId);

      const effectiveCurrent = await resolveEffectiveCurrentOdometerTx(txn, normalized.vehicleId, { excludeFuelId: id });
      if (normalized.odometerKm < effectiveCurrent.value) {
        throw new Error('Current km cannot be less than the latest recorded km.');
      }

      const previousFuelOdometer = await getLatestFuelOdometer(txn, normalized.vehicleId, { excludeFuelId: id });
      const avgConsumption = calculateAvgConsumption(normalized.liters, normalized.odometerKm, previousFuelOdometer);
      const timestamp = nowIso();

      await txn.runAsync(
        `
          UPDATE fuel_entries
          SET vehicle_id = ?,
              occurred_at = ?,
              fuel_type = ?,
              liters = ?,
              total_price = ?,
              station = ?,
              odometer_km = ?,
              avg_consumption_l_per_100km = ?,
              receipt_uri = ?,
              receipt_name = ?,
              receipt_mime_type = ?,
              notes = ?,
              updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [
          normalized.vehicleId,
          normalized.occurredAt,
          normalized.fuelType,
          normalized.liters,
          normalized.totalPrice,
          normalized.station,
          normalized.odometerKm,
          avgConsumption,
          normalized.receipt?.uri ?? null,
          normalized.receipt?.name ?? null,
          normalized.receipt?.mimeType ?? null,
          normalized.notes,
          timestamp,
          id,
        ],
      );

      await syncVehicleCurrentOdometerTx(txn, normalized.vehicleId);
      if (current.vehicle_id !== normalized.vehicleId) {
        await syncVehicleCurrentOdometerTx(txn, current.vehicle_id);
      }

      return {
        id,
        vehicleId: normalized.vehicleId,
        occurredAt: normalized.occurredAt,
        fuelType: normalized.fuelType,
        liters: normalized.liters,
        totalPrice: normalized.totalPrice,
        station: normalized.station,
        odometerKm: normalized.odometerKm,
        avgConsumptionLPer100Km: avgConsumption,
        receiptUri: normalized.receipt?.uri ?? null,
        receiptName: normalized.receipt?.name ?? null,
        receiptMimeType: normalized.receipt?.mimeType ?? null,
        notes: normalized.notes,
        createdAt: current.created_at,
        updatedAt: timestamp,
      };
    });
    emitDataChange({ scope: 'entries', action: 'update' });
    return updated;
  },

  async delete(id: string): Promise<void> {
    await runInWriteTransaction(async (txn) => {
      const current = await getFuelRowById(txn, id);
      if (!current) {
        throw new Error('Fuel entry not found.');
      }

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

      await syncVehicleCurrentOdometerTx(txn, current.vehicle_id);
    });
    emitDataChange({ scope: 'entries', action: 'delete' });
  },

  async listActiveReceiptUris(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ receipt_uri: string }>(
      `
        SELECT DISTINCT receipt_uri
        FROM fuel_entries
        WHERE deleted_at IS NULL
          AND receipt_uri IS NOT NULL
          AND receipt_uri <> ''
      `,
    );

    return rows.map((row) => row.receipt_uri);
  },
};
