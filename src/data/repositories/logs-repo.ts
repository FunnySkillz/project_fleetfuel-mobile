import { getDatabase } from '@/data/db';
import type { EntrySummary, EntryType, LogsQueryFilters, TripPrivateTag } from '@/data/types';

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

export const logsRepo = {
  async list(filters: LogsQueryFilters = {}): Promise<EntrySummary[]> {
    const db = await getDatabase();
    const typeFilter = normalizeType(filters.type);
    const vehicleId = (filters.vehicleId ?? '').trim();
    const search = normalizeSearch(filters.search);
    const searchLike = `%${search}%`;
    const fromIso = buildDayRangeIso(filters.fromDate, 'start');
    const toIso = buildDayRangeIso(filters.toDate, 'end');
    const businessOnly = Boolean(filters.businessOnly);

    if (fromIso && toIso && fromIso > toIso) {
      throw new Error('From date must be earlier than or equal to To date.');
    }

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (typeFilter !== 'all') {
      whereClauses.push('e.type = ?');
      params.push(typeFilter);
    }

    if (vehicleId.length > 0) {
      whereClauses.push('e.vehicle_id = ?');
      params.push(vehicleId);
    }

    if (search.length > 0) {
      whereClauses.push('e.search_text LIKE ?');
      params.push(searchLike);
    }

    if (fromIso) {
      whereClauses.push('e.occurred_at >= ?');
      params.push(fromIso);
    }

    if (toIso) {
      whereClauses.push('e.occurred_at <= ?');
      params.push(toIso);
    }

    if (businessOnly) {
      whereClauses.push("e.private_tag = 'business'");
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let limitSql = '';
    if (typeof filters.limit === 'number') {
      if (!Number.isInteger(filters.limit) || filters.limit <= 0) {
        throw new Error('Limit must be a positive integer.');
      }
      limitSql = 'LIMIT ?';
      params.push(filters.limit);
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
};
