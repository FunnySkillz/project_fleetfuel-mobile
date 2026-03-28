import type * as SQLite from 'expo-sqlite';

import { getDatabase, runInWriteTransaction } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type {
  TripPrivateTag,
  VehicleInsightSummary,
  VehicleListItem,
  VehicleMonthlyDistancePoint,
  VehicleRecentTrip,
  VehicleRecord,
  VehicleUsageSplitPoint,
} from '@/data/types';

import { normalizeOptionalInteger, normalizeOptionalText, normalizePlate, normalizeRequiredText, normalizeSearch } from './shared';

const VEHICLE_NAME_MIN = 2;
const VEHICLE_NAME_MAX = 60;
const TEXT_FIELD_MAX = 80;
const ENGINE_CODE_MAX = 40;
const INSIGHT_MONTHS_DEFAULT = 6;
const RECENT_TRIPS_LIMIT_DEFAULT = 6;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

type VehicleInsightKpiRow = {
  total_trips: number;
  total_distance_km: number;
  business_distance_km: number;
  private_distance_km: number;
  unclassified_distance_km: number;
  fuel_spend_total: number;
  avg_consumption_l_per_100km: number | null;
};

type VehicleMonthlyDistanceRow = {
  month_key: string;
  distance_km: number;
};

type VehicleRecentTripRow = {
  id: string;
  occurred_at: string;
  purpose: string;
  distance_km: number;
  private_tag: TripPrivateTag;
  start_time: string | null;
  end_time: string | null;
  start_location: string | null;
  end_location: string | null;
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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`;
}

function buildMonthlyDistanceSeries(
  rows: VehicleMonthlyDistanceRow[],
  monthCount: number,
  referenceDate: Date = new Date(),
): VehicleMonthlyDistancePoint[] {
  const safeMonthCount = clamp(monthCount, 3, 12);
  const values = new Map(rows.map((row) => [row.month_key, row.distance_km]));
  const series: VehicleMonthlyDistancePoint[] = [];

  for (let offset = safeMonthCount - 1; offset >= 0; offset -= 1) {
    const date = startOfMonthUtc(new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - offset, 1)));
    const key = monthKey(date);

    series.push({
      monthKey: key,
      monthLabel: monthLabel(date),
      distanceKm: values.get(key) ?? 0,
    });
  }

  return series;
}

function mapRecentTrip(row: VehicleRecentTripRow): VehicleRecentTrip {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    purpose: row.purpose,
    distanceKm: row.distance_km,
    privateTag: row.private_tag,
    startTime: row.start_time,
    endTime: row.end_time,
    startLocation: row.start_location,
    endLocation: row.end_location,
  };
}

function buildUsageSplitPoints(kpi: VehicleInsightKpiRow): VehicleUsageSplitPoint[] {
  const total = kpi.total_distance_km;

  const entries: { key: VehicleUsageSplitPoint['key']; label: string; distanceKm: number }[] = [
    { key: 'business', label: 'Business', distanceKm: kpi.business_distance_km },
    { key: 'private', label: 'Private', distanceKm: kpi.private_distance_km },
    { key: 'unclassified', label: 'Unclassified', distanceKm: kpi.unclassified_distance_km },
  ];

  return entries.map((entry) => ({
    ...entry,
    ratio: total > 0 ? entry.distanceKm / total : 0,
  }));
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

  async getInsightSummary(
    id: string,
    options: { monthCount?: number; recentTripLimit?: number } = {},
  ): Promise<VehicleInsightSummary | null> {
    const db = await getDatabase();
    const vehicleRow = await getVehicleRowById(db, id);
    if (!vehicleRow) {
      return null;
    }

    const monthCount = clamp(options.monthCount ?? INSIGHT_MONTHS_DEFAULT, 3, 12);
    const recentTripLimit = clamp(options.recentTripLimit ?? RECENT_TRIPS_LIMIT_DEFAULT, 1, 20);
    const firstMonth = startOfMonthUtc(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (monthCount - 1), 1)));

    const [tripKpiRow, fuelKpiRow, monthlyRows, recentTripRows] = await Promise.all([
      db.getFirstAsync<VehicleInsightKpiRow>(
        `
          SELECT
            COUNT(1) AS total_trips,
            COALESCE(SUM(distance_km), 0) AS total_distance_km,
            COALESCE(SUM(CASE WHEN private_tag = 'business' THEN distance_km ELSE 0 END), 0) AS business_distance_km,
            COALESCE(SUM(CASE WHEN private_tag = 'private' THEN distance_km ELSE 0 END), 0) AS private_distance_km,
            COALESCE(SUM(CASE WHEN private_tag IS NULL THEN distance_km ELSE 0 END), 0) AS unclassified_distance_km,
            0 AS fuel_spend_total,
            NULL AS avg_consumption_l_per_100km
          FROM trips
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
        `,
        [id],
      ),
      db.getFirstAsync<{ fuel_spend_total: number; avg_consumption_l_per_100km: number | null }>(
        `
          SELECT
            COALESCE(SUM(total_price), 0) AS fuel_spend_total,
            AVG(avg_consumption_l_per_100km) AS avg_consumption_l_per_100km
          FROM fuel_entries
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
        `,
        [id],
      ),
      db.getAllAsync<VehicleMonthlyDistanceRow>(
        `
          SELECT
            substr(occurred_at, 1, 7) AS month_key,
            COALESCE(SUM(distance_km), 0) AS distance_km
          FROM trips
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
            AND occurred_at >= ?
          GROUP BY substr(occurred_at, 1, 7)
          ORDER BY month_key ASC
        `,
        [id, firstMonth.toISOString()],
      ),
      db.getAllAsync<VehicleRecentTripRow>(
        `
          SELECT
            id,
            occurred_at,
            purpose,
            distance_km,
            private_tag,
            start_time,
            end_time,
            start_location,
            end_location
          FROM trips
          WHERE vehicle_id = ?
            AND deleted_at IS NULL
          ORDER BY occurred_at DESC, created_at DESC
          LIMIT ?
        `,
        [id, recentTripLimit],
      ),
    ]);

    const baseKpis = tripKpiRow ?? {
      total_trips: 0,
      total_distance_km: 0,
      business_distance_km: 0,
      private_distance_km: 0,
      unclassified_distance_km: 0,
      fuel_spend_total: 0,
      avg_consumption_l_per_100km: null,
    };

    const kpis: VehicleInsightSummary['kpis'] = {
      totalTrips: baseKpis.total_trips,
      totalDistanceKm: baseKpis.total_distance_km,
      businessDistanceKm: baseKpis.business_distance_km,
      privateDistanceKm: baseKpis.private_distance_km,
      unclassifiedDistanceKm: baseKpis.unclassified_distance_km,
      fuelSpendTotal: round2(fuelKpiRow?.fuel_spend_total ?? 0),
      avgConsumptionLPer100Km:
        typeof fuelKpiRow?.avg_consumption_l_per_100km === 'number'
          ? round2(fuelKpiRow.avg_consumption_l_per_100km)
          : null,
    };

    return {
      vehicle: mapVehicleRecord(vehicleRow),
      kpis,
      monthlyDistance: buildMonthlyDistanceSeries(monthlyRows, monthCount),
      usageSplit: buildUsageSplitPoints({
        ...baseKpis,
        fuel_spend_total: kpis.fuelSpendTotal,
        avg_consumption_l_per_100km: kpis.avgConsumptionLPer100Km,
      }),
      recentTrips: recentTripRows.map(mapRecentTrip),
    };
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
