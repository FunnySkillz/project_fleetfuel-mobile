import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type RequestBody = {
  fleetId?: unknown;
  emitNotifications?: unknown;
};

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

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
  const emitNotifications = toBoolean(payload.emitNotifications, true);

  if (!fleetId) {
    return error('validation_error', 'fleetId is required.', 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_normalize_expired_vehicle_blocks', {
    p_actor_user_id: userId,
    p_fleet_id: fleetId,
    p_emit_notifications: emitNotifications,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  const normalizedCount = typeof data === 'number' ? data : Array.isArray(data) ? Number(data[0] ?? 0) : 0;
  return json({ normalizedCount });
});
