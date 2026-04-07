import { assignmentRepo } from '@/shared-fleet/repos';
import type {
  AssignmentEndReason,
  Vehicle,
  VehicleAssignment,
  VehicleAssignmentWithContext,
} from '@/shared-fleet/types';

export async function requestAssignment(input: { fleetId: string; vehicleId: string }): Promise<VehicleAssignment> {
  return assignmentRepo.requestAssignment(input);
}

export async function approveAssignment(input: { assignmentId: string }): Promise<VehicleAssignment> {
  return assignmentRepo.approveAssignment(input);
}

export async function rejectAssignment(input: { assignmentId: string; reason?: string }): Promise<VehicleAssignment> {
  return assignmentRepo.rejectAssignment(input);
}

export async function cancelAssignment(input: { assignmentId: string; reason?: string }): Promise<VehicleAssignment> {
  return assignmentRepo.cancelAssignment(input);
}

export async function directAssignVehicle(input: {
  fleetId: string;
  vehicleId: string;
  driverMembershipId: string;
}): Promise<VehicleAssignment> {
  return assignmentRepo.directAssign(input);
}

export async function endAssignment(input: {
  assignmentId: string;
  endReason?: AssignmentEndReason;
}): Promise<VehicleAssignment> {
  return assignmentRepo.endAssignment(input);
}

export async function blockVehicle(input: {
  fleetId: string;
  vehicleId: string;
  blockedUntil: string;
  blockedReason?: string;
}): Promise<Vehicle> {
  return assignmentRepo.blockVehicle(input);
}

export async function unblockVehicle(input: { fleetId: string; vehicleId: string }): Promise<Vehicle> {
  return assignmentRepo.unblockVehicle(input);
}

export async function getVehicleCurrentAssignment(input: {
  fleetId: string;
  vehicleId: string;
}): Promise<VehicleAssignmentWithContext | null> {
  return assignmentRepo.getVehicleCurrentAssignment(input);
}

export async function getFleetPendingAssignmentRequests(input: { fleetId: string }): Promise<VehicleAssignmentWithContext[]> {
  return assignmentRepo.getFleetPendingAssignmentRequests(input);
}

export async function getVehicleTimeline(input: {
  fleetId: string;
  vehicleId: string;
}): Promise<VehicleAssignmentWithContext[]> {
  return assignmentRepo.getVehicleTimeline(input);
}

export async function getFleetAssignmentHistory(input: {
  fleetId: string;
  limit?: number;
}): Promise<VehicleAssignmentWithContext[]> {
  return assignmentRepo.getFleetAssignmentHistory(input);
}
