import { sha256Hex } from '../_shared/crypto.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type RequestBody = {
  invitationId?: unknown;
  token?: unknown;
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
  let userEmail: string;

  try {
    const user = await requireAuthenticatedUser(request);
    userId = user.id;
    userEmail = (user.email ?? '').trim().toLowerCase();
  } catch (authError) {
    return error('unauthorized', authError instanceof Error ? authError.message : 'Unauthorized', 401);
  }

  if (!userEmail) {
    return error('validation_error', 'Authenticated user must have an email.', 400);
  }

  let payload: RequestBody;
  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return error('validation_error', 'Request body must be valid JSON.', 400);
  }

  const invitationId = typeof payload.invitationId === 'string' ? payload.invitationId.trim() : '';
  const token = typeof payload.token === 'string' ? payload.token.trim() : '';

  if (!invitationId || !token) {
    return error('validation_error', 'invitationId and token are required.', 400);
  }

  const tokenHash = await sha256Hex(token);

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_accept_invitation', {
    p_invitation_id: invitationId,
    p_token_hash: tokenHash,
    p_user_id: userId,
    p_user_email: userEmail,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  return json({ membership_created: Boolean(data) });
});
