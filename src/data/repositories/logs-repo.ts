import { getDatabase } from '@/data/db';
import { nowIso } from '@/data/db-utils';
import type {
  EntrySummary,
  EntryType,
  ExportFuelRow,
  ExportPreview,
  ExportTripRow,
  ExportVehicleSection,
  LogsExportDataset,
  LogsExportFilters,
  LogsQueryFilters,
  TripPrivateTag,
  TripUsageFilter,
} from '@/data/types';

import { buildDayRangeIso, normalizeSearch } from './shared';

type EntrySummaryRow = {
  id: string;
  type: EntryType;
  vehicle_id: string;
  vehicle_name: string;
  occurred_at: string;
  summary: string;
  search_text: string;
  private_tag: TripPrivateTag;
};

type VehicleScopeRow = {
  id: string;
  name: string;
  plate: string;
};

type TripExportRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  purpose: string;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  distance_km: number;
  private_tag: TripPrivateTag;
  start_time: string | null;
  end_time: string | null;
  start_location: string | null;
  end_location: string | null;
  notes: string | null;
};

type FuelExportRow = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  fuel_type: ExportFuelRow['fuelType'];
  liters: number;
  fuel_in_tank_after_refuel_liters: number | null;
  total_price: number;
  station: string;
  odometer_km: number | null;
  avg_consumption_l_per_100km: number | null;
  receipt_name: string | null;
  receipt_uri: string | null;
  notes: string | null;
};

type NormalizedLogFilters = {
  type: 'all' | EntryType;
  vehicleIds: string[];
  search: string;
  fromIso: string | null;
  toIso: string | null;
  usageType: TripUsageFilter;
  limit: number | null;
};

type NormalizedExportFilters = {
  vehicleIds: string[];
  fromDate: string | null;
  toDate: string | null;
  fromIso: string | null;
  toIso: string | null;
  year: number | null;
  usageType: TripUsageFilter;
  fuelType: LogsExportFilters['fuelType'];
  includeFuel: boolean;
  includeReceipts: boolean;
};

function mapEntrySummary(row: EntrySummaryRow): EntrySummary {
  return {
    id: row.id,
    type: row.type,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    date: row.occurred_at,
    summary: row.summary,
    searchText: row.search_text,
    privateTag: row.private_tag,
  };
}

function normalizeType(type: LogsQueryFilters['type']) {
  if (!type || type === 'all') {
    return 'all' as const;
  }
  if (type === 'trip' || type === 'fuel') {
    return type;
  }

  throw new Error('Unsupported log type filter.');
}

function normalizeUsageType(value: TripUsageFilter | null | undefined): TripUsageFilter {
  if (!value || value === 'both') {
    return 'both';
  }

  if (value === 'work' || value === 'private' || value === 'unclassified') {
    return value;
  }

  throw new Error('Unsupported usage filter.');
}

function normalizeVehicleIds(value: string[] | null | undefined) {
  if (!value || value.length === 0) {
    return [];
  }

  return Array.from(new Set(value.map((item) => item.trim()).filter((item) => item.length > 0)));
}

function normalizeYear(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value)) {
    throw new Error('Year must be a whole number.');
  }

  if (value < 2000 || value > 2100) {
    throw new Error('Year must be between 2000 and 2100.');
  }

  return value;
}

function formatLocalDay(value: Date) {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateRange(input: {
  fromDate?: string | null;
  toDate?: string | null;
  year?: number | null;
}) {
  const fromDate = input.fromDate?.trim() || null;
  const toDate = input.toDate?.trim() || null;
  const year = normalizeYear(input.year ?? null);

  let normalizedFromDate = fromDate;
  let normalizedToDate = toDate;

  if (!normalizedFromDate && !normalizedToDate && year !== null) {
    const now = new Date();
    const currentYear = now.getFullYear();
    normalizedFromDate = `${year}-01-01`;
    normalizedToDate = year === currentYear ? formatLocalDay(now) : `${year}-12-31`;
  }

  const fromIso = buildDayRangeIso(normalizedFromDate, 'start');
  const toIso = buildDayRangeIso(normalizedToDate, 'end');

  if (fromIso && toIso && fromIso > toIso) {
    throw new Error('From date must be earlier than or equal to To date.');
  }

  return {
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
    fromIso,
    toIso,
    year,
  };
}

function appendVehicleScopeClause(whereClauses: string[], params: (string | number)[], vehicleIds: string[], column: string) {
  if (vehicleIds.length === 0) {
    return;
  }

  const placeholders = vehicleIds.map(() => '?').join(', ');
  whereClauses.push(`${column} IN (${placeholders})`);
  params.push(...vehicleIds);
}

function appendDateRangeClause(
  whereClauses: string[],
  params: (string | number)[],
  fromIso: string | null,
  toIso: string | null,
  column: string,
) {
  if (fromIso) {
    whereClauses.push(`${column} >= ?`);
    params.push(fromIso);
  }

  if (toIso) {
    whereClauses.push(`${column} <= ?`);
    params.push(toIso);
  }
}

function appendTripUsageClause(whereClauses: string[], usageType: TripUsageFilter, column: string) {
  if (usageType === 'both') {
    return;
  }

  if (usageType === 'work') {
    whereClauses.push(`${column} = 'business'`);
    return;
  }

  if (usageType === 'private') {
    whereClauses.push(`${column} = 'private'`);
    return;
  }

  whereClauses.push(`${column} IS NULL`);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function mapTripExportRow(row: TripExportRow): ExportTripRow {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    occurredAt: row.occurred_at,
    purpose: row.purpose,
    startOdometerKm: row.start_odometer_km ?? 0,
    endOdometerKm: row.end_odometer_km ?? row.distance_km,
    distanceKm: row.distance_km,
    privateTag: row.private_tag,
    startTime: row.start_time,
    endTime: row.end_time,
    startLocation: row.start_location,
    endLocation: row.end_location,
    notes: row.notes,
  };
}

function mapFuelExportRow(row: FuelExportRow): ExportFuelRow {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    occurredAt: row.occurred_at,
    fuelType: row.fuel_type,
    liters: row.liters,
    fuelInTankAfterRefuelLiters: row.fuel_in_tank_after_refuel_liters,
    totalPrice: row.total_price,
    station: row.station,
    odometerKm: row.odometer_km,
    avgConsumptionLPer100Km: row.avg_consumption_l_per_100km,
    receiptName: row.receipt_name,
    receiptUri: row.receipt_uri,
    notes: row.notes,
  };
}

function buildExportPreview(scope: VehicleScopeRow[], trips: ExportTripRow[], fuelEntries: ExportFuelRow[]): ExportPreview {
  const distanceTotals = trips.reduce(
    (acc, trip) => {
      acc.total += trip.distanceKm;
      if (trip.privateTag === 'business') {
        acc.business += trip.distanceKm;
      } else if (trip.privateTag === 'private') {
        acc.private += trip.distanceKm;
      } else {
        acc.unclassified += trip.distanceKm;
      }

      return acc;
    },
    { total: 0, business: 0, private: 0, unclassified: 0 },
  );

  const spendTotal = fuelEntries.reduce((acc, fuel) => acc + fuel.totalPrice, 0);
  const avgConsumptionValues = fuelEntries
    .map((fuel) => fuel.avgConsumptionLPer100Km)
    .filter((value): value is number => value !== null);
  const avgConsumption =
    avgConsumptionValues.length > 0
      ? round2(avgConsumptionValues.reduce((acc, value) => acc + value, 0) / avgConsumptionValues.length)
      : null;

  return {
    vehicleCount: scope.length,
    tripCount: trips.length,
    fuelCount: fuelEntries.length,
    totalDistanceKm: distanceTotals.total,
    businessDistanceKm: distanceTotals.business,
    privateDistanceKm: distanceTotals.private,
    unclassifiedDistanceKm: distanceTotals.unclassified,
    fuelSpendTotal: round2(spendTotal),
    avgConsumptionLPer100Km: avgConsumption,
  };
}

function toExportFilters(filters: NormalizedExportFilters): LogsExportFilters {
  return {
    vehicleIds: filters.vehicleIds,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    year: filters.year,
    usageType: filters.usageType,
    fuelType: filters.fuelType,
    includeFuel: filters.includeFuel,
    includeReceipts: filters.includeReceipts,
  };
}

function normalizeFuelTypeFilter(value: LogsExportFilters['fuelType'] | null | undefined): LogsExportFilters['fuelType'] {
  if (!value || value === 'all') {
    return 'all';
  }

  if (['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng', 'other'].includes(value)) {
    return value;
  }

  throw new Error('Unsupported fuel type filter.');
}

async function resolveVehicleScope(db: Awaited<ReturnType<typeof getDatabase>>, vehicleIds: string[]): Promise<VehicleScopeRow[]> {
  const whereClauses: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  appendVehicleScopeClause(whereClauses, params, vehicleIds, 'id');

  return db.getAllAsync<VehicleScopeRow>(
    `
      SELECT id, name, plate
      FROM vehicles
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY lower(name) ASC, created_at DESC
    `,
    params,
  );
}

async function queryTripsForExport(
  db: Awaited<ReturnType<typeof getDatabase>>,
  filters: NormalizedExportFilters,
): Promise<ExportTripRow[]> {
  const whereClauses: string[] = ['t.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  appendVehicleScopeClause(whereClauses, params, filters.vehicleIds, 't.vehicle_id');
  appendDateRangeClause(whereClauses, params, filters.fromIso, filters.toIso, 't.occurred_at');
  appendTripUsageClause(whereClauses, filters.usageType, 't.private_tag');

  const rows = await db.getAllAsync<TripExportRow>(
    `
      SELECT
        t.id,
        t.vehicle_id,
        t.occurred_at,
        t.purpose,
        t.start_odometer_km,
        t.end_odometer_km,
        t.distance_km,
        t.private_tag,
        t.start_time,
        t.end_time,
        t.start_location,
        t.end_location,
        t.notes
      FROM trips t
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY t.occurred_at DESC, t.created_at DESC
    `,
    params,
  );

  return rows.map(mapTripExportRow);
}

async function queryFuelForExport(
  db: Awaited<ReturnType<typeof getDatabase>>,
  filters: NormalizedExportFilters,
): Promise<ExportFuelRow[]> {
  if (!filters.includeFuel) {
    return [];
  }

  const whereClauses: string[] = ['f.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  appendVehicleScopeClause(whereClauses, params, filters.vehicleIds, 'f.vehicle_id');
  appendDateRangeClause(whereClauses, params, filters.fromIso, filters.toIso, 'f.occurred_at');
  if (filters.fuelType !== 'all') {
    whereClauses.push('f.fuel_type = ?');
    params.push(filters.fuelType);
  }

  const rows = await db.getAllAsync<FuelExportRow>(
    `
      SELECT
        f.id,
        f.vehicle_id,
        f.occurred_at,
        f.fuel_type,
        f.liters,
        f.fuel_in_tank_after_refuel_liters,
        f.total_price,
        f.station,
        f.odometer_km,
        f.avg_consumption_l_per_100km,
        f.receipt_name,
        f.receipt_uri,
        f.notes
      FROM fuel_entries f
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY f.occurred_at DESC, f.created_at DESC
    `,
    params,
  );

  return rows.map(mapFuelExportRow);
}

function groupVehicleSections(
  scope: VehicleScopeRow[],
  trips: ExportTripRow[],
  fuelEntries: ExportFuelRow[],
): ExportVehicleSection[] {
  const tripsByVehicle = new Map<string, ExportTripRow[]>();
  for (const trip of trips) {
    const list = tripsByVehicle.get(trip.vehicleId) ?? [];
    list.push(trip);
    tripsByVehicle.set(trip.vehicleId, list);
  }

  const fuelByVehicle = new Map<string, ExportFuelRow[]>();
  for (const fuel of fuelEntries) {
    const list = fuelByVehicle.get(fuel.vehicleId) ?? [];
    list.push(fuel);
    fuelByVehicle.set(fuel.vehicleId, list);
  }

  return scope.map((vehicle) => {
    const vehicleTrips = tripsByVehicle.get(vehicle.id) ?? [];
    const vehicleFuelEntries = fuelByVehicle.get(vehicle.id) ?? [];

    const totals = vehicleTrips.reduce(
      (acc, trip) => {
        acc.distanceKm += trip.distanceKm;
        if (trip.privateTag === 'business') {
          acc.businessDistanceKm += trip.distanceKm;
        } else if (trip.privateTag === 'private') {
          acc.privateDistanceKm += trip.distanceKm;
        } else {
          acc.unclassifiedDistanceKm += trip.distanceKm;
        }

        return acc;
      },
      {
        tripCount: vehicleTrips.length,
        fuelCount: vehicleFuelEntries.length,
        distanceKm: 0,
        businessDistanceKm: 0,
        privateDistanceKm: 0,
        unclassifiedDistanceKm: 0,
        fuelSpendTotal: 0,
      },
    );

    totals.fuelSpendTotal = round2(vehicleFuelEntries.reduce((acc, fuel) => acc + fuel.totalPrice, 0));

    return {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehiclePlate: vehicle.plate,
      trips: vehicleTrips,
      fuelEntries: vehicleFuelEntries,
      totals,
    };
  });
}

function normalizeLogFilters(filters: LogsQueryFilters): NormalizedLogFilters {
  const type = normalizeType(filters.type);
  const vehicleIds = normalizeVehicleIds(filters.vehicleIds);
  const search = normalizeSearch(filters.search);
  const { fromIso, toIso } = normalizeDateRange({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    year: filters.year,
  });

  let limit: number | null = null;
  if (typeof filters.limit === 'number') {
    if (!Number.isInteger(filters.limit) || filters.limit <= 0) {
      throw new Error('Limit must be a positive integer.');
    }
    limit = filters.limit;
  }

  return {
    type,
    vehicleIds,
    search,
    fromIso,
    toIso,
    usageType: normalizeUsageType(filters.usageType),
    limit,
  };
}

function normalizeExportFilters(input: Partial<LogsExportFilters> = {}): NormalizedExportFilters {
  const vehicleIds = normalizeVehicleIds(input.vehicleIds);
  const dateRange = normalizeDateRange({
    fromDate: input.fromDate,
    toDate: input.toDate,
    year: input.year,
  });

  return {
    vehicleIds,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    fromIso: dateRange.fromIso,
    toIso: dateRange.toIso,
    year: dateRange.year,
    usageType: normalizeUsageType(input.usageType),
    fuelType: normalizeFuelTypeFilter(input.fuelType),
    includeFuel: input.includeFuel ?? true,
    includeReceipts: input.includeReceipts ?? false,
  };
}

export const logsRepo = {
  normalizeExportFilters,

  async list(filters: LogsQueryFilters = {}): Promise<EntrySummary[]> {
    const db = await getDatabase();
    const normalized = normalizeLogFilters(filters);
    const params: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (normalized.type !== 'all') {
      whereClauses.push('e.type = ?');
      params.push(normalized.type);
    }

    appendVehicleScopeClause(whereClauses, params, normalized.vehicleIds, 'e.vehicle_id');

    if (normalized.search.length > 0) {
      whereClauses.push('e.search_text LIKE ?');
      params.push(`%${normalized.search}%`);
    }

    appendDateRangeClause(whereClauses, params, normalized.fromIso, normalized.toIso, 'e.occurred_at');

    if (normalized.usageType === 'work') {
      whereClauses.push("(e.type = 'trip' AND e.private_tag = 'business')");
    } else if (normalized.usageType === 'private') {
      whereClauses.push("(e.type = 'trip' AND e.private_tag = 'private')");
    } else if (normalized.usageType === 'unclassified') {
      whereClauses.push("(e.type = 'trip' AND e.private_tag IS NULL)");
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const limitSql = normalized.limit ? 'LIMIT ?' : '';
    if (normalized.limit) {
      params.push(normalized.limit);
    }

    const rows = await db.getAllAsync<EntrySummaryRow>(
      `
        SELECT
          e.id,
          e.type,
          e.vehicle_id,
          e.vehicle_name,
          e.occurred_at,
          e.summary,
          e.search_text,
          e.private_tag
        FROM (
          SELECT
            t.id AS id,
            'trip' AS type,
            t.vehicle_id AS vehicle_id,
            v.name AS vehicle_name,
            t.occurred_at AS occurred_at,
            t.purpose || ' (' || t.distance_km || ' km)' AS summary,
            lower(
              v.name || ' ' ||
              t.purpose || ' ' ||
              ifnull(t.start_location, '') || ' ' ||
              ifnull(t.end_location, '') || ' ' ||
              ifnull(t.start_time, '') || ' ' ||
              ifnull(t.end_time, '') || ' ' ||
              ifnull(t.notes, '') || ' ' ||
              t.occurred_at
            ) AS search_text,
            t.private_tag AS private_tag
          FROM trips t
          INNER JOIN vehicles v ON v.id = t.vehicle_id
          WHERE t.deleted_at IS NULL
            AND v.deleted_at IS NULL

          UNION ALL

          SELECT
            f.id AS id,
            'fuel' AS type,
            f.vehicle_id AS vehicle_id,
            v.name AS vehicle_name,
            f.occurred_at AS occurred_at,
            printf('%.2f L, EUR %.2f', f.liters, f.total_price) AS summary,
            lower(
              v.name || ' ' ||
              f.station || ' ' ||
              ifnull(f.receipt_name, '') || ' ' ||
              ifnull(f.notes, '') || ' ' ||
              f.occurred_at
            ) AS search_text,
            NULL AS private_tag
          FROM fuel_entries f
          INNER JOIN vehicles v ON v.id = f.vehicle_id
          WHERE f.deleted_at IS NULL
            AND v.deleted_at IS NULL
        ) e
        ${whereSql}
        ORDER BY e.occurred_at DESC, e.id DESC
        ${limitSql}
      `,
      params,
    );

    return rows.map(mapEntrySummary);
  },

  async getExportDataset(input: Partial<LogsExportFilters> = {}): Promise<LogsExportDataset> {
    const db = await getDatabase();
    const filters = normalizeExportFilters(input);

    const scope = await resolveVehicleScope(db, filters.vehicleIds);

    if (scope.length === 0) {
      const emptyPreview: ExportPreview = {
        vehicleCount: 0,
        tripCount: 0,
        fuelCount: 0,
        totalDistanceKm: 0,
        businessDistanceKm: 0,
        privateDistanceKm: 0,
        unclassifiedDistanceKm: 0,
        fuelSpendTotal: 0,
        avgConsumptionLPer100Km: null,
      };

      return {
        generatedAt: nowIso(),
        filters: toExportFilters(filters),
        preview: emptyPreview,
        vehicles: [],
      };
    }

    const scopedFilters: NormalizedExportFilters = {
      ...filters,
      vehicleIds: scope.map((vehicle) => vehicle.id),
    };

    const [trips, fuelEntries] = await Promise.all([
      queryTripsForExport(db, scopedFilters),
      queryFuelForExport(db, scopedFilters),
    ]);

    const preview = buildExportPreview(scope, trips, fuelEntries);
    const vehicles = groupVehicleSections(scope, trips, fuelEntries);

    return {
      generatedAt: nowIso(),
      filters: toExportFilters(filters),
      preview,
      vehicles,
    };
  },

  async getExportPreview(input: Partial<LogsExportFilters> = {}): Promise<ExportPreview> {
    const dataset = await logsRepo.getExportDataset(input);
    return dataset.preview;
  },
};

