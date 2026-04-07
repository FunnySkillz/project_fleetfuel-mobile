export function mapRpcErrorMessage(rawMessage: string): { code: string; message: string; status: number } {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('duplicate_invite')) {
    return { code: 'duplicate_invite', message: 'A pending invitation already exists for this email and role.', status: 409 };
  }

  if (normalized.includes('invite_expired')) {
    return { code: 'invite_expired', message: 'This invitation has expired.', status: 410 };
  }

  if (normalized.includes('invite_revoked')) {
    return { code: 'invite_revoked', message: 'This invitation has been revoked.', status: 410 };
  }

  if (normalized.includes('email_mismatch')) {
    return { code: 'email_mismatch', message: 'Invitation email does not match your account email.', status: 403 };
  }

  if (normalized.includes('already_member')) {
    return { code: 'already_member', message: 'User is already an active fleet member.', status: 409 };
  }

  if (normalized.includes('forbidden')) {
    return { code: 'forbidden', message: 'You do not have permission for this operation.', status: 403 };
  }

  if (normalized.includes('not_authorized')) {
    return { code: 'not_authorized', message: 'You are not authorized for this operation.', status: 403 };
  }

  if (normalized.includes('vehicle_blocked')) {
    return { code: 'vehicle_blocked', message: 'Vehicle is currently blocked and cannot be activated.', status: 409 };
  }

  if (normalized.includes('assignment_conflict')) {
    return { code: 'assignment_conflict', message: 'Vehicle already has an active assignment.', status: 409 };
  }

  if (normalized.includes('assignment_not_found')) {
    return { code: 'assignment_not_found', message: 'Assignment could not be found.', status: 404 };
  }

  if (normalized.includes('already_ended')) {
    return { code: 'already_ended', message: 'Assignment has already been ended.', status: 409 };
  }

  if (normalized.includes('invalid_transition')) {
    return { code: 'invalid_transition', message: 'The requested assignment transition is not allowed.', status: 409 };
  }

  if (normalized.includes('duplicate_request')) {
    return { code: 'duplicate_request', message: 'A pending request for this driver and vehicle already exists.', status: 409 };
  }

  if (normalized.includes('not_found')) {
    return { code: 'not_found', message: 'Requested resource could not be found.', status: 404 };
  }

  if (normalized.includes('validation_error')) {
    return { code: 'validation_error', message: 'Request payload failed validation.', status: 400 };
  }

  return { code: 'internal_error', message: 'Unexpected server error.', status: 500 };
}
