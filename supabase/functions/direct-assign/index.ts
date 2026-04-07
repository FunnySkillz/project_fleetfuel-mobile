import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type RequestBody = {
  fleetId?: unknown;
  vehicleId?: unknown;
  driverMembershipId?: unknown;
};

Deno.serve(async (request) => {
  const preflight = handlePreflight(request);
  if (preflight) {
    return preflight;
  }

  if (request.method !== 'POST') {
    return error('method_not_allowed', 'Only POST is supported.', 405);
  }

  let userId: string;
  try {
    const user = await requireAuthenticatedUser(request);
    userId = user.id;
  } catch (authError) {
    return error('unauthorized', authError instanceof Error ? authError.message : 'Unauthorized', 401);
  }

  let payload: RequestBody;
  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return error('validation_error', 'Request body must be valid JSON.', 400);
  }

  const fleetId = typeof payload.fleetId === 'string' ? payload.fleetId.trim() : '';
  const vehicleId = typeof payload.vehicleId === 'string' ? payload.vehicleId.trim() : '';
  const driverMembershipId = typeof payload.driverMembershipId === 'string' ? payload.driverMembershipId.trim() : '';

  if (!fleetId || !vehicleId || !driverMembershipId) {
    return error('validation_error', 'fleetId, vehicleId, and driverMembershipId are required.', 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_direct_assign', {
    p_fleet_id: fleetId,
    p_vehicle_id: vehicleId,
    p_driver_membership_id: driverMembershipId,
    p_actor_user_id: userId,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  const assignment = Array.isArray(data) ? data[0] : data;
  return json({ assignment });
});
