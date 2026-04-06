import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

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

  let payload: { name?: unknown };
  try {
    payload = (await request.json()) as { name?: unknown };
  } catch {
    return error('validation_error', 'Request body must be valid JSON.', 400);
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    return error('validation_error', 'Fleet name is required.', 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_create_fleet_with_owner', {
    p_name: name,
    p_owner_user_id: userId,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  const fleet = Array.isArray(data) ? data[0] : data;
  return json({ fleet });
});
