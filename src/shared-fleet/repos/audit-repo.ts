import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';

import type { AuditRepo } from './contracts';
import { mapAudit, type AuditRow } from './mappers';

const AUDIT_COLUMNS = [
  'id',
  'fleet_id',
  'actor_user_id',
  'actor_membership_id',
  'event_type',
  'entity_type',
  'entity_id',
  'payload',
  'idempotency_key',
  'created_at',
].join(', ');

function requireId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new SharedFleetError('shared_validation_error', `${fieldName} is required.`);
  }

  return normalized;
}

function asRows<TRow>(data: unknown): TRow[] {
  return ((data ?? []) as unknown) as TRow[];
}

export const auditRepo: AuditRepo = {
  async getFleetAuditLog(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const limit = Math.max(1, Math.min(input.limit ?? 200, 1000));
    const supabase = getSharedSupabaseClient();

    let query = supabase
      .from('fleet_audit_logs')
      .select(AUDIT_COLUMNS)
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (input.eventType && input.eventType.trim()) {
      query = query.eq('event_type', input.eventType.trim());
    }

    if (input.from && input.from.trim()) {
      query = query.gte('created_at', input.from.trim());
    }

    if (input.to && input.to.trim()) {
      query = query.lte('created_at', input.to.trim());
    }

    const { data, error } = await query;
    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return asRows<AuditRow>(data).map(mapAudit);
  },
};
