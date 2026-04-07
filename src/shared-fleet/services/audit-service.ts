import { auditRepo } from '@/shared-fleet/repos';
import type { FleetAuditLog } from '@/shared-fleet/types';

export async function getFleetAuditLog(input: {
  fleetId: string;
  eventType?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<FleetAuditLog[]> {
  return auditRepo.getFleetAuditLog(input);
}
