export type MembershipRole = 'owner' | 'admin' | 'driver';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type VehicleStatus = 'available' | 'driving' | 'blocked';
export type AssignmentStatus = 'pending' | 'active' | 'ended' | 'rejected' | 'cancelled';
export type AssignmentEndReason = 'driver_ended' | 'admin_ended' | 'blocked' | 'system_ended' | 'archived';
export type NotificationEventType =
  | 'fleet_created'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_revoked'
  | 'vehicle_created'
  | 'vehicle_updated'
  | 'vehicle_request_submitted'
  | 'assignment_approved'
  | 'assignment_rejected'
  | 'assignment_cancelled'
  | 'direct_assignment_created'
  | 'assignment_ended'
  | 'vehicle_blocked'
  | 'vehicle_unblocked'
  | 'vehicle_archived'
  | 'vehicle_unarchived'
  | 'membership_role_changed'
  | 'membership_deactivated';

export type SharedJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SharedJson | undefined }
  | SharedJson[];

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
  deactivatedReason: string | null;
  roleUpdatedAt: string | null;
  roleUpdatedByUserId: string | null;
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
  archivedAt: string | null;
  archivedByUserId: string | null;
  archiveReason: string | null;
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

export type FleetNotification = {
  id: string;
  fleetId: string;
  recipientUserId: string;
  eventType: NotificationEventType;
  entityType: string;
  entityId: string | null;
  payload: SharedJson;
  isRead: boolean;
  readAt: string | null;
  dedupeKey: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

export type FleetAuditLog = {
  id: string;
  fleetId: string;
  actorUserId: string | null;
  actorMembershipId: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  payload: SharedJson;
  idempotencyKey: string | null;
  createdAt: string;
};

export type FleetOperationalReport = {
  activeDrivers: number;
  vehiclesInUse: number;
  availableVehicles: number;
  blockedVehicles: number;
  pendingRequests: number;
  archivedVehicles: number;
  membershipCountsByRole: Record<string, number>;
  recentAuditActivity: FleetAuditLog[];
};
