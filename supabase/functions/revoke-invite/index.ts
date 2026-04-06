import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type RequestBody = {
  invitationId?: unknown;
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

  const invitationId = typeof payload.invitationId === 'string' ? payload.invitationId.trim() : '';

  if (!invitationId) {
    return error('validation_error', 'invitationId is required.', 400);
  }

  const supabase = createServiceRoleClient();
  const { error: rpcError } = await supabase.rpc('shared_revoke_invitation', {
    p_invitation_id: invitationId,
    p_actor_user_id: userId,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  return json({ ok: true });
});
