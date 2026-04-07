export type MembershipRole = 'owner' | 'admin' | 'driver';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type VehicleStatus = 'available' | 'driving' | 'blocked';
export type AssignmentStatus = 'pending' | 'active' | 'ended' | 'rejected' | 'cancelled';
export type AssignmentEndReason = 'driver_ended' | 'admin_ended' | 'blocked' | 'system_ended';

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
  rejectedByUserId: string | null;
  cancelledByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  endReason: AssignmentEndReason | null;
  rejectedReason: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleAssignmentWithContext = VehicleAssignment & {
  driverProfile: Profile | null;
  vehicle: Vehicle | null;
};

export type VehicleWithEffectiveStatus = Vehicle & {
  effectiveStatus: VehicleStatus;
  currentAssignment: VehicleAssignmentWithContext | null;
  pendingRequestCount: number;
};

export type FleetAssignmentMetrics = {
  activeDrivers: number;
  vehiclesInUse: number;
  availableVehicles: number;
  blockedVehicles: number;
  pendingRequests: number;
};
