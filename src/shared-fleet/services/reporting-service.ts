import { reportingRepo } from '@/shared-fleet/repos';
import type { FleetOperationalReport } from '@/shared-fleet/types';

export async function getFleetOperationalReport(input: { fleetId: string }): Promise<FleetOperationalReport> {
  return reportingRepo.getFleetOperationalReport(input);
}

export async function runExpiredBlockNormalization(input: {
  fleetId: string;
  emitNotifications?: boolean;
}): Promise<number> {
  return reportingRepo.runExpiredBlockNormalization(input);
}
