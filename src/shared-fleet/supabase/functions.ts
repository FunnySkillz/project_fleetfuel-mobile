import { getSharedFleetConfig } from '@/shared-fleet/config';
import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';

type EdgeFunctionErrorPayload = {
  code?: string;
  message?: string;
};

function mapCodeToError(code: string | undefined, status: number, message: string): SharedFleetError {
  switch (code) {
    case 'duplicate_invite':
      return new SharedFleetError('shared_duplicate_invite', message, { status });
    case 'invite_expired':
      return new SharedFleetError('shared_invite_expired', message, { status });
    case 'invite_revoked':
      return new SharedFleetError('shared_invite_revoked', message, { status });
    case 'email_mismatch':
      return new SharedFleetError('shared_invite_email_mismatch', message, { status });
    case 'already_member':
      return new SharedFleetError('shared_already_member', message, { status });
    case 'forbidden':
      return new SharedFleetError('shared_forbidden', message, { status });
    case 'not_authorized':
      return new SharedFleetError('shared_not_authorized', message, { status });
    case 'vehicle_blocked':
      return new SharedFleetError('shared_vehicle_blocked', message, { status });
    case 'assignment_conflict':
      return new SharedFleetError('shared_assignment_conflict', message, { status });
    case 'assignment_not_found':
      return new SharedFleetError('shared_assignment_not_found', message, { status });
    case 'already_ended':
      return new SharedFleetError('shared_already_ended', message, { status });
    case 'invalid_transition':
      return new SharedFleetError('shared_invalid_transition', message, { status });
    case 'duplicate_request':
      return new SharedFleetError('shared_duplicate_request', message, { status });
    case 'not_found':
      return new SharedFleetError('shared_not_found', message, { status });
    default:
      return new SharedFleetError('shared_unknown_error', message, { status });
  }
}

export async function invokeSharedFunction<TResponse, TBody extends Record<string, unknown>>(
  functionName: string,
  body: TBody,
): Promise<TResponse> {
  const config = getSharedFleetConfig();
  const supabase = getSharedSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new SharedFleetError('shared_auth_required', 'You must be signed in to use Shared Fleet features.');
  }

  let response: Response;

  try {
    response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    throw new SharedFleetError('shared_network_error', 'Unable to reach Shared Fleet services.', {
      cause: networkError,
      status: null,
    });
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsed = (payload ?? {}) as EdgeFunctionErrorPayload;
    const message = parsed.message?.trim() || 'Shared Fleet function call failed.';
    throw mapCodeToError(parsed.code, response.status, message);
  }

  return payload as TResponse;
}
