import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type RequestBody = {
  membershipId?: unknown;
  reason?: unknown;
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

  const membershipId = typeof payload.membershipId === 'string' ? payload.membershipId.trim() : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

  if (!membershipId) {
    return error('validation_error', 'membershipId is required.', 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_deactivate_membership', {
    p_membership_id: membershipId,
    p_actor_user_id: userId,
    p_reason: reason || null,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  const membership = Array.isArray(data) ? data[0] : data;
  return json({ membership });
});
