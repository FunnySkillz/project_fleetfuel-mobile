import type { Session } from '@supabase/supabase-js';

import type {
  Fleet,
  FleetInvitation,
  FleetMemberProfile,
  FleetMembershipWithFleet,
  MembershipRole,
  Vehicle,
  VehicleAssignment,
} from '@/shared-fleet/types';

export type AuthCredentials = {
  email: string;
  password: string;
};

export type AuthStateChangeCallback = (session: Session | null) => void;

export type AuthStateSubscription = {
  unsubscribe: () => void;
};

export interface AuthRepo {
  signUp(input: AuthCredentials): Promise<Session | null>;
  signIn(input: AuthCredentials): Promise<Session | null>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  onAuthStateChange(callback: AuthStateChangeCallback): AuthStateSubscription;
  handleDeepLinkCallback(url: string): Promise<boolean>;
}

export interface FleetRepo {
  createFleet(input: { name: string }): Promise<Fleet>;
  loadCurrentUserFleets(): Promise<FleetMembershipWithFleet[]>;
  loadFleetMembers(fleetId: string): Promise<FleetMemberProfile[]>;
  countDrivers(fleetId: string): Promise<number>;
}

export interface InvitesRepo {
  createInvite(input: { fleetId: string; email: string; role: MembershipRole }): Promise<FleetInvitation>;
  acceptInvite(input: { invitationId: string; token: string }): Promise<{ membershipCreated: boolean }>;
  revokeInvite(input: { invitationId: string }): Promise<void>;
  loadFleetInvitations(fleetId: string): Promise<FleetInvitation[]>;
}

export interface VehicleAccessRepo {
  listFleetVehicles(fleetId: string): Promise<Vehicle[]>;
  listFleetAssignments(fleetId: string): Promise<VehicleAssignment[]>;
}
