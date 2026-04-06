import { invitesRepo } from '@/shared-fleet/repos';
import type { FleetInvitation, MembershipRole } from '@/shared-fleet/types';

export async function createInvite(input: { fleetId: string; email: string; role: MembershipRole }): Promise<FleetInvitation> {
  return invitesRepo.createInvite(input);
}

export async function acceptInvite(input: { invitationId: string; token: string }): Promise<{ membershipCreated: boolean }> {
  return invitesRepo.acceptInvite(input);
}

export async function revokeInvite(input: { invitationId: string }): Promise<void> {
  return invitesRepo.revokeInvite(input);
}

export async function loadFleetInvitations(input: { fleetId: string }): Promise<FleetInvitation[]> {
  return invitesRepo.loadFleetInvitations(input.fleetId);
}
