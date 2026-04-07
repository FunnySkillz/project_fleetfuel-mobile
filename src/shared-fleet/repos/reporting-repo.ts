import { SharedFleetError } from '@/shared-fleet/errors';
import { invokeSharedFunction } from '@/shared-fleet/supabase/functions';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import type { FleetAuditLog, FleetOperationalReport, SharedJson } from '@/shared-fleet/types';

import type { ReportingRepo } from './contracts';

function requireId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new SharedFleetError('shared_validation_error', `${fieldName} is required.`);
  }

  return normalized;
}

function asAuditLog(value: SharedJson): FleetAuditLog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, SharedJson | undefined>;
  const id = typeof row.id === 'string' ? row.id : null;
  const eventType = typeof row.eventType === 'string' ? row.eventType : null;
  const entityType = typeof row.entityType === 'string' ? row.entityType : null;
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : null;

  if (!id || !eventType || !entityType || !createdAt) {
    return null;
  }

  return {
    id,
    fleetId: '',
    actorUserId: typeof row.actorUserId === 'string' ? row.actorUserId : null,
    actorMembershipId: null,
    eventType,
    entityType,
    entityId: typeof row.entityId === 'string' ? row.entityId : null,
    payload: (row.payload ?? {}) as SharedJson,
    idempotencyKey: null,
    createdAt,
  };
}

export const reportingRepo: ReportingRepo = {
  async getFleetOperationalReport(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase.rpc('shared_get_fleet_operational_report', {
      p_fleet_id: fleetId,
    });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    const raw = (data ?? {}) as Record<string, unknown>;
    const membershipCountsRaw =
      raw.membershipCountsByRole && typeof raw.membershipCountsByRole === 'object' && !Array.isArray(raw.membershipCountsByRole)
        ? (raw.membershipCountsByRole as Record<string, unknown>)
        : {};

    const membershipCountsByRole = Object.fromEntries(
      Object.entries(membershipCountsRaw).map(([key, value]) => [key, typeof value === 'number' ? value : 0]),
    );

    const recentAuditItems = Array.isArray(raw.recentAuditActivity) ? raw.recentAuditActivity : [];
    const recentAuditActivity = recentAuditItems
      .map((item) => asAuditLog((item ?? null) as SharedJson))
      .filter((item): item is FleetAuditLog => item !== null)
      .map((audit) => ({ ...audit, fleetId }));

    return {
      activeDrivers: typeof raw.activeDrivers === 'number' ? raw.activeDrivers : 0,
      vehiclesInUse: typeof raw.vehiclesInUse === 'number' ? raw.vehiclesInUse : 0,
      availableVehicles: typeof raw.availableVehicles === 'number' ? raw.availableVehicles : 0,
      blockedVehicles: typeof raw.blockedVehicles === 'number' ? raw.blockedVehicles : 0,
      pendingRequests: typeof raw.pendingRequests === 'number' ? raw.pendingRequests : 0,
      archivedVehicles: typeof raw.archivedVehicles === 'number' ? raw.archivedVehicles : 0,
      membershipCountsByRole,
      recentAuditActivity,
    } satisfies FleetOperationalReport;
  },

  async runExpiredBlockNormalization(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const response = await invokeSharedFunction<
      { normalizedCount?: number },
      { fleetId: string; emitNotifications?: boolean }
    >('normalize-expired-blocks', input.emitNotifications === undefined ? { fleetId } : { fleetId, emitNotifications: input.emitNotifications });

    return typeof response.normalizedCount === 'number' ? response.normalizedCount : 0;
  },
};
