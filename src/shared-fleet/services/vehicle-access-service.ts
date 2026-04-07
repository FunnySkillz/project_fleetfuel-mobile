import { vehicleAccessRepo } from '@/shared-fleet/repos';
import type { FleetAssignmentMetrics, Vehicle, VehicleWithEffectiveStatus } from '@/shared-fleet/types';

export async function createSharedVehicle(input: { fleetId: string; name: string; plate: string }): Promise<Vehicle> {
  return vehicleAccessRepo.createVehicle(input);
}

export async function loadFleetVehiclesWithAccess(input: { fleetId: string }): Promise<VehicleWithEffectiveStatus[]> {
  return vehicleAccessRepo.listFleetVehicleAccess(input.fleetId);
}

export async function loadFleetAssignmentMetrics(input: { fleetId: string }): Promise<FleetAssignmentMetrics> {
  return vehicleAccessRepo.getFleetAssignmentMetrics(input.fleetId);
}
