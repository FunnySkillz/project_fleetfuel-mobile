import type { Session } from '@supabase/supabase-js';

import type {
  AssignmentEndReason,
  FleetAuditLog,
  FleetNotification,
  FleetOperationalReport,
  Fleet,
  FleetAssignmentMetrics,
  FleetInvitation,
  FleetMemberProfile,
  FleetMembershipWithFleet,
  MembershipRole,
  Vehicle,
  VehicleAssignment,
  VehicleAssignmentWithContext,
  VehicleWithEffectiveStatus,
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
  updateMembershipRole(input: { membershipId: string; role: 'admin' | 'driver' }): Promise<FleetMemberProfile>;
  deactivateMembership(input: { membershipId: string; reason?: string }): Promise<FleetMemberProfile>;
}

export interface InvitesRepo {
  createInvite(input: { fleetId: string; email: string; role: MembershipRole }): Promise<FleetInvitation>;
  acceptInvite(input: { invitationId: string; token: string }): Promise<{ membershipCreated: boolean }>;
  revokeInvite(input: { invitationId: string }): Promise<void>;
  loadFleetInvitations(fleetId: string): Promise<FleetInvitation[]>;
}

export interface VehicleAccessRepo {
  createVehicle(input: { fleetId: string; name: string; plate: string }): Promise<Vehicle>;
  listFleetVehicleAccess(input: { fleetId: string; includeArchived?: boolean }): Promise<VehicleWithEffectiveStatus[]>;
  getFleetAssignmentMetrics(fleetId: string): Promise<FleetAssignmentMetrics>;
  archiveVehicle(input: { fleetId: string; vehicleId: string; archiveReason?: string }): Promise<Vehicle>;
  unarchiveVehicle(input: { fleetId: string; vehicleId: string }): Promise<Vehicle>;
}

export interface AssignmentRepo {
  requestAssignment(input: { fleetId: string; vehicleId: string }): Promise<VehicleAssignment>;
  approveAssignment(input: { assignmentId: string }): Promise<VehicleAssignment>;
  rejectAssignment(input: { assignmentId: string; reason?: string }): Promise<VehicleAssignment>;
  cancelAssignment(input: { assignmentId: string; reason?: string }): Promise<VehicleAssignment>;
  directAssign(input: { fleetId: string; vehicleId: string; driverMembershipId: string }): Promise<VehicleAssignment>;
  endAssignment(input: { assignmentId: string; endReason?: AssignmentEndReason }): Promise<VehicleAssignment>;
  blockVehicle(input: { fleetId: string; vehicleId: string; blockedUntil: string; blockedReason?: string }): Promise<Vehicle>;
  unblockVehicle(input: { fleetId: string; vehicleId: string }): Promise<Vehicle>;
  getVehicleCurrentAssignment(input: { fleetId: string; vehicleId: string }): Promise<VehicleAssignmentWithContext | null>;
  getFleetPendingAssignmentRequests(input: { fleetId: string }): Promise<VehicleAssignmentWithContext[]>;
  getVehicleTimeline(input: { fleetId: string; vehicleId: string }): Promise<VehicleAssignmentWithContext[]>;
  getFleetAssignmentHistory(input: { fleetId: string; limit?: number }): Promise<VehicleAssignmentWithContext[]>;
}

export interface NotificationRepo {
  getFleetNotifications(input: { fleetId: string; limit?: number }): Promise<FleetNotification[]>;
  markNotificationRead(input: { notificationId: string }): Promise<void>;
  markAllNotificationsRead(input: { fleetId: string }): Promise<number>;
  countUnread(input: { fleetId: string }): Promise<number>;
}

export interface AuditRepo {
  getFleetAuditLog(input: {
    fleetId: string;
    eventType?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
  }): Promise<FleetAuditLog[]>;
}

export interface ReportingRepo {
  getFleetOperationalReport(input: { fleetId: string }): Promise<FleetOperationalReport>;
  runExpiredBlockNormalization(input: { fleetId: string; emitNotifications?: boolean }): Promise<number>;
}
