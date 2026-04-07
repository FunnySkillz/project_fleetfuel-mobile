import { vehicleAccessRepo } from '@/shared-fleet/repos';
import type { FleetAssignmentMetrics, Vehicle, VehicleWithEffectiveStatus } from '@/shared-fleet/types';

export async function createSharedVehicle(input: { fleetId: string; name: string; plate: string }): Promise<Vehicle> {
  return vehicleAccessRepo.createVehicle(input);
}

export async function loadFleetVehiclesWithAccess(input: {
  fleetId: string;
  includeArchived?: boolean;
}): Promise<VehicleWithEffectiveStatus[]> {
  return vehicleAccessRepo.listFleetVehicleAccess(input);
}

export async function loadFleetAssignmentMetrics(input: { fleetId: string }): Promise<FleetAssignmentMetrics> {
  return vehicleAccessRepo.getFleetAssignmentMetrics(input.fleetId);
}

export async function archiveVehicle(input: {
  fleetId: string;
  vehicleId: string;
  archiveReason?: string;
}): Promise<Vehicle> {
  return vehicleAccessRepo.archiveVehicle(input);
}

export async function unarchiveVehicle(input: { fleetId: string; vehicleId: string }): Promise<Vehicle> {
  return vehicleAccessRepo.unarchiveVehicle(input);
}
