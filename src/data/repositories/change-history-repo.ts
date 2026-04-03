import type * as SQLite from 'expo-sqlite';

import { getDatabase } from '@/data/db';
import { createId, nowIso } from '@/data/db-utils';
import type {
  ChangeFieldDiff,
  ChangeHistoryActionType,
  ChangeHistoryActorType,
  ChangeHistoryEntityType,
  ChangeHistoryRecord,
} from '@/data/types';

import { buildDayRangeIso } from './shared';

const REASON_MIN_LENGTH = 5;
const REASON_MAX_LENGTH = 300;
const LIMIT_MAX = 500;

type ChangeHistoryRow = {
  id: string;
  vehicle_id: string;
  entity_type: ChangeHistoryEntityType;
  entity_id: string;
  action_type: ChangeHistoryActionType;
  reason: string;
  actor_type: ChangeHistoryActorType;
  actor_id: string;
  changed_fields_json: string;
  before_json: string;
  after_json: string | null;
  metadata_json: string | null;
  occurred_at: string;
  created_at: string;
};

type SerializedChangeHistoryRecord = {
  changedFieldsJson: string;
  beforeJson: string;
  afterJson: string | null;
  metadataJson: string | null;
};

type AuditActorInput = {
  type?: ChangeHistoryActorType | null;
  id?: string | null;
};

export type MutationAuditContext = {
  reason: string;
  actor?: AuditActorInput | null;
};

type NormalizedAuditContext = {
  reason: string;
  actorType: ChangeHistoryActorType;
  actorId: string;
};

type ChangeHistoryBaseWriteInput = {
  vehicleId: string;
  entityType: ChangeHistoryEntityType;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string;
};

type RecordUpdateInput = ChangeHistoryBaseWriteInput & {
  audit: MutationAuditContext;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

type RecordDeleteInput = ChangeHistoryBaseWriteInput & {
  audit: MutationAuditContext;
  before: Record<string, unknown>;
};

type ChangeHistoryListOptions = {
  limit?: number;
  fromDate?: string | null;
  toDate?: string | null;
};

type ChangeHistoryExportFilters = {
  vehicleIds?: string[];
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
};

function normalizeVehicleId(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Vehicle id is required.');
  }

  return normalized;
}

function normalizeEntityId(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Entity id is required.');
  }

  return normalized;
}

function normalizeEntityType(value: ChangeHistoryEntityType) {
  if (value === 'vehicle' || value === 'trip' || value === 'fuel') {
    return value;
  }

  throw new Error('Entity type is invalid.');
}

function normalizeActionType(value: ChangeHistoryActionType) {
  if (value === 'update' || value === 'delete') {
    return value;
  }

  throw new Error('Action type is invalid.');
}

function normalizeReason(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < REASON_MIN_LENGTH) {
    throw new Error(`Reason must be at least ${REASON_MIN_LENGTH} characters.`);
  }
  if (normalized.length > REASON_MAX_LENGTH) {
    throw new Error(`Reason must be at most ${REASON_MAX_LENGTH} characters.`);
  }

  return normalized;
}

function normalizeActor(input?: AuditActorInput | null) {
  const actorType = input?.type ?? 'local_user';
  if (actorType !== 'local_user' && actorType !== 'system') {
    throw new Error('Actor type is invalid.');
  }

  const actorId = input?.id?.trim() || 'local-device';
  return { actorType, actorId };
}

function normalizeOccurredAt(value?: string) {
  if (!value) {
    return nowIso();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Occurred at is invalid.');
  }

  return parsed.toISOString();
}

function normalizeLimit(value?: number) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Limit must be a positive whole number.');
  }

  return Math.min(value, LIMIT_MAX);
}

function normalizeSnapshotValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSnapshotValue(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeSnapshotValue(entry),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}

function normalizeSnapshot(value: Record<string, unknown>) {
  const normalized = normalizeSnapshotValue(value);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return {};
  }
  return normalized as Record<string, unknown>;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function computeChangedFields(before: Record<string, unknown>, after: Record<string, unknown>): ChangeFieldDiff[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  return keys.flatMap((field) => {
    const previousValue = before[field] ?? null;
    const nextValue = after[field] ?? null;
    if (valuesEqual(previousValue, nextValue)) {
      return [];
    }

    return [
      {
        field,
        before: previousValue,
        after: nextValue,
      },
    ];
  });
}

function safeParseObject(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeParseChangedFields(value: string): ChangeFieldDiff[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: ChangeFieldDiff[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const field = (item as { field?: unknown }).field;
      if (typeof field !== 'string' || field.trim().length === 0) {
        continue;
      }

      result.push({
        field,
        before: (item as { before?: unknown }).before ?? null,
        after: (item as { after?: unknown }).after ?? null,
      });
    }

    return result;
  } catch {
    return [];
  }
}

function serializeChangeRecord(args: {
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  const before = normalizeSnapshot(args.before);
  const after = args.after === null ? null : normalizeSnapshot(args.after);
  const changedFields = computeChangedFields(before, after ?? {});
  const metadata = args.metadata ? normalizeSnapshot(args.metadata) : null;

  return {
    changedFieldsJson: JSON.stringify(changedFields),
    beforeJson: JSON.stringify(before),
    afterJson: after === null ? null : JSON.stringify(after),
    metadataJson: metadata === null ? null : JSON.stringify(metadata),
  } satisfies SerializedChangeHistoryRecord;
}

function mapChangeHistoryRecord(row: ChangeHistoryRow): ChangeHistoryRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionType: row.action_type,
    reason: row.reason,
    actorType: row.actor_type,
    actorId: row.actor_id,
    changedFields: safeParseChangedFields(row.changed_fields_json),
    before: safeParseObject(row.before_json) ?? {},
    after: safeParseObject(row.after_json),
    metadata: safeParseObject(row.metadata_json),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function normalizeAuditContext(audit: MutationAuditContext): NormalizedAuditContext {
  return {
    reason: normalizeReason(audit.reason),
    ...normalizeActor(audit.actor),
  };
}

async function insertHistoryRow(
  db: SQLite.SQLiteDatabase,
  input: {
    vehicleId: string;
    entityType: ChangeHistoryEntityType;
    entityId: string;
    actionType: ChangeHistoryActionType;
    audit: MutationAuditContext;
    serialized: SerializedChangeHistoryRecord;
    occurredAt?: string;
  },
): Promise<ChangeHistoryRecord> {
  const id = createId('hist');
  const audit = normalizeAuditContext(input.audit);
  const createdAt = nowIso();
  const occurredAt = normalizeOccurredAt(input.occurredAt);

  await db.runAsync(
    `
      INSERT INTO change_history (
        id,
        vehicle_id,
        entity_type,
        entity_id,
        action_type,
        reason,
        actor_type,
        actor_id,
        changed_fields_json,
        before_json,
        after_json,
        metadata_json,
        occurred_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      normalizeVehicleId(input.vehicleId),
      normalizeEntityType(input.entityType),
      normalizeEntityId(input.entityId),
      normalizeActionType(input.actionType),
      audit.reason,
      audit.actorType,
      audit.actorId,
      input.serialized.changedFieldsJson,
      input.serialized.beforeJson,
      input.serialized.afterJson,
      input.serialized.metadataJson,
      occurredAt,
      createdAt,
    ],
  );

  return {
    id,
    vehicleId: input.vehicleId,
    entityType: input.entityType,
    entityId: input.entityId,
    actionType: input.actionType,
    reason: audit.reason,
    actorType: audit.actorType,
    actorId: audit.actorId,
    changedFields: safeParseChangedFields(input.serialized.changedFieldsJson),
    before: safeParseObject(input.serialized.beforeJson) ?? {},
    after: safeParseObject(input.serialized.afterJson),
    metadata: safeParseObject(input.serialized.metadataJson),
    occurredAt,
    createdAt,
  };
}

export const changeHistoryRepo = {
  normalizeReason,

  async recordUpdateTx(db: SQLite.SQLiteDatabase, input: RecordUpdateInput): Promise<ChangeHistoryRecord> {
    const serialized = serializeChangeRecord({
      before: input.before,
      after: input.after,
      metadata: input.metadata,
    });

    return insertHistoryRow(db, {
      vehicleId: input.vehicleId,
      entityType: input.entityType,
      entityId: input.entityId,
      actionType: 'update',
      audit: input.audit,
      serialized,
      occurredAt: input.occurredAt,
    });
  },

  async recordDeleteTx(db: SQLite.SQLiteDatabase, input: RecordDeleteInput): Promise<ChangeHistoryRecord> {
    const serialized = serializeChangeRecord({
      before: input.before,
      after: null,
      metadata: input.metadata,
    });

    return insertHistoryRow(db, {
      vehicleId: input.vehicleId,
      entityType: input.entityType,
      entityId: input.entityId,
      actionType: 'delete',
      audit: input.audit,
      serialized,
      occurredAt: input.occurredAt,
    });
  },

  async listByVehicle(vehicleId: string, options: ChangeHistoryListOptions = {}): Promise<ChangeHistoryRecord[]> {
    const db = await getDatabase();
    const normalizedVehicleId = normalizeVehicleId(vehicleId);
    const limit = normalizeLimit(options.limit);
    const fromIso = buildDayRangeIso(options.fromDate, 'start');
    const toIso = buildDayRangeIso(options.toDate, 'end');
    const params: (string | number)[] = [normalizedVehicleId];
    const whereClauses = ['vehicle_id = ?'];

    if (fromIso) {
      whereClauses.push('occurred_at >= ?');
      params.push(fromIso);
    }
    if (toIso) {
      whereClauses.push('occurred_at <= ?');
      params.push(toIso);
    }

    const limitSql = limit ? 'LIMIT ?' : '';
    if (limit) {
      params.push(limit);
    }

    const rows = await db.getAllAsync<ChangeHistoryRow>(
      `
        SELECT
          id,
          vehicle_id,
          entity_type,
          entity_id,
          action_type,
          reason,
          actor_type,
          actor_id,
          changed_fields_json,
          before_json,
          after_json,
          metadata_json,
          occurred_at,
          created_at
        FROM change_history
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY occurred_at DESC, created_at DESC, id DESC
        ${limitSql}
      `,
      params,
    );

    return rows.map(mapChangeHistoryRecord);
  },

  async listForExport(filters: ChangeHistoryExportFilters = {}): Promise<ChangeHistoryRecord[]> {
    const db = await getDatabase();
    const vehicleIds = Array.from(
      new Set((filters.vehicleIds ?? []).map((value) => value.trim()).filter((value) => value.length > 0)),
    );
    const limit = normalizeLimit(filters.limit);
    const fromIso = buildDayRangeIso(filters.fromDate, 'start');
    const toIso = buildDayRangeIso(filters.toDate, 'end');
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (vehicleIds.length > 0) {
      const placeholders = vehicleIds.map(() => '?').join(', ');
      whereClauses.push(`vehicle_id IN (${placeholders})`);
      params.push(...vehicleIds);
    }
    if (fromIso) {
      whereClauses.push('occurred_at >= ?');
      params.push(fromIso);
    }
    if (toIso) {
      whereClauses.push('occurred_at <= ?');
      params.push(toIso);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitSql = limit ? 'LIMIT ?' : '';
    if (limit) {
      params.push(limit);
    }

    const rows = await db.getAllAsync<ChangeHistoryRow>(
      `
        SELECT
          id,
          vehicle_id,
          entity_type,
          entity_id,
          action_type,
          reason,
          actor_type,
          actor_id,
          changed_fields_json,
          before_json,
          after_json,
          metadata_json,
          occurred_at,
          created_at
        FROM change_history
        ${whereSql}
        ORDER BY occurred_at DESC, created_at DESC, id DESC
        ${limitSql}
      `,
      params,
    );

    return rows.map(mapChangeHistoryRecord);
  },
};

export function normalizeMutationAuditContext(audit: MutationAuditContext) {
  return normalizeAuditContext(audit);
}
