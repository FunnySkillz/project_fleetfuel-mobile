export type SharedFleetErrorCode =
  | 'shared_config_missing'
  | 'shared_auth_required'
  | 'shared_invalid_credentials'
  | 'shared_duplicate_invite'
  | 'shared_invite_expired'
  | 'shared_invite_revoked'
  | 'shared_invite_email_mismatch'
  | 'shared_already_member'
  | 'shared_forbidden'
  | 'shared_not_authorized'
  | 'shared_vehicle_blocked'
  | 'shared_vehicle_archived'
  | 'shared_assignment_conflict'
  | 'shared_assignment_not_found'
  | 'shared_already_ended'
  | 'shared_invalid_transition'
  | 'shared_duplicate_request'
  | 'shared_not_found'
  | 'shared_network_error'
  | 'shared_validation_error'
  | 'shared_unknown_error';

export class SharedFleetError extends Error {
  readonly code: SharedFleetErrorCode;
  readonly status: number | null;

  constructor(code: SharedFleetErrorCode, message: string, options: { status?: number | null; cause?: unknown } = {}) {
    super(message);
    this.name = 'SharedFleetError';
    this.code = code;
    this.status = options.status ?? null;

    if ('cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function toSharedFleetError(error: unknown, fallback: SharedFleetError): SharedFleetError {
  if (error instanceof SharedFleetError) {
    return error;
  }

  if (error instanceof Error) {
    return new SharedFleetError(fallback.code, error.message, {
      status: fallback.status,
      cause: error,
    });
  }

  return fallback;
}
