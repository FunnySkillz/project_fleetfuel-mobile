import { generateInviteToken, sha256Hex } from '../_shared/crypto.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { mapRpcErrorMessage } from '../_shared/errors.ts';
import { error, json } from '../_shared/response.ts';
import { createServiceRoleClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }

  return value;
}

type RequestBody = {
  fleetId?: unknown;
  email?: unknown;
  role?: unknown;
};

function toExpiryIso(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function buildAcceptLink(invitationId: string, token: string): string {
  const base = requireEnv('SHARED_INVITE_BASE_URL');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}`;
}

async function sendInviteEmail(args: {
  to: string;
  role: string;
  fleetId: string;
  invitationId: string;
  link: string;
}) {
  const resendApiKey = requireEnv('RESEND_API_KEY');
  const fromEmail = requireEnv('SHARED_INVITE_FROM_EMAIL');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [args.to],
      subject: 'FleetFuel Shared Fleet Invitation',
      html: `
        <p>You were invited to join a FleetFuel shared fleet.</p>
        <p>Role: <strong>${args.role}</strong></p>
        <p>Fleet ID: <strong>${args.fleetId}</strong></p>
        <p><a href="${args.link}">Accept invitation</a></p>
        <p>If the button does not open the app, copy this link:</p>
        <p>${args.link}</p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend_error:${response.status}`);
  }
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
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const role = payload.role === 'admin' || payload.role === 'driver' ? payload.role : null;

  if (!fleetId || !email || !role) {
    return error('validation_error', 'fleetId, email, and role are required.', 400);
  }

  const token = generateInviteToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = toExpiryIso(7);

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc('shared_create_invitation', {
    p_fleet_id: fleetId,
    p_email: email,
    p_role: role,
    p_invited_by_user_id: userId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return error(mapped.code, mapped.message, mapped.status);
  }

  const invitation = Array.isArray(data) ? data[0] : data;
  if (!invitation?.id) {
    return error('internal_error', 'Invitation creation returned no record.', 500);
  }

  const acceptLink = buildAcceptLink(invitation.id as string, token);

  try {
    await sendInviteEmail({
      to: email,
      role,
      fleetId,
      invitationId: invitation.id as string,
      link: acceptLink,
    });
  } catch {
    return error('email_delivery_failed', 'Invitation was created, but email delivery failed.', 502);
  }

  return json({ invitation });
});
