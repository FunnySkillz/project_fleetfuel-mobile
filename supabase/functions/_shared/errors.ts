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

  if (normalized.includes('not_found')) {
    return { code: 'not_found', message: 'Requested resource could not be found.', status: 404 };
  }

  if (normalized.includes('validation_error')) {
    return { code: 'validation_error', message: 'Request payload failed validation.', status: 400 };
  }

  return { code: 'internal_error', message: 'Unexpected server error.', status: 500 };
}
