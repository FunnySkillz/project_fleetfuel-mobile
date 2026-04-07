import { fleetRepo } from '@/shared-fleet/repos';
import type { Fleet, FleetMemberProfile, FleetMembershipWithFleet } from '@/shared-fleet/types';

export async function createFleet(input: { name: string }): Promise<Fleet> {
  return fleetRepo.createFleet(input);
}

export async function loadCurrentUserFleets(): Promise<FleetMembershipWithFleet[]> {
  return fleetRepo.loadCurrentUserFleets();
}

export async function loadFleetMembers(input: { fleetId: string }): Promise<FleetMemberProfile[]> {
  return fleetRepo.loadFleetMembers(input.fleetId);
}

export async function countFleetDrivers(input: { fleetId: string }): Promise<number> {
  return fleetRepo.countDrivers(input.fleetId);
}

export async function updateFleetMembershipRole(input: {
  membershipId: string;
  role: 'admin' | 'driver';
}): Promise<FleetMemberProfile> {
  return fleetRepo.updateMembershipRole(input);
}

export async function deactivateFleetMembership(input: {
  membershipId: string;
  reason?: string;
}): Promise<FleetMemberProfile> {
  return fleetRepo.deactivateMembership(input);
}
