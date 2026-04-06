export type MembershipRole = 'owner' | 'admin' | 'driver';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type VehicleStatus = 'available' | 'driving' | 'blocked';
export type AssignmentStatus = 'pending' | 'active' | 'ended' | 'rejected' | 'cancelled';

export type Fleet = {
  id: string;
  name: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetMembership = {
  id: string;
  fleetId: string;
  userId: string;
  role: MembershipRole;
  invitedByUserId: string | null;
  invitationId: string | null;
  joinedAt: string;
  endedAt: string | null;
  endedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetMembershipWithFleet = FleetMembership & {
  fleet: Fleet;
};

export type FleetMemberProfile = FleetMembership & {
  profile: Profile | null;
};

export type FleetInvitation = {
  id: string;
  fleetId: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  revokedByUserId: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Vehicle = {
  id: string;
  fleetId: string;
  name: string;
  plate: string;
  status: VehicleStatus;
  blockedUntil: string | null;
  blockedReason: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleAssignment = {
  id: string;
  fleetId: string;
  vehicleId: string;
  driverUserId: string;
  driverMembershipId: string;
  status: AssignmentStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  endedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};
