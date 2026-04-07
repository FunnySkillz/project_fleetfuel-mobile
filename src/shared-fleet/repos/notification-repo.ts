import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';

import type { NotificationRepo } from './contracts';
import { mapNotification, type NotificationRow } from './mappers';

const NOTIFICATION_COLUMNS = [
  'id',
  'fleet_id',
  'recipient_user_id',
  'event_type',
  'entity_type',
  'entity_id',
  'payload',
  'is_read',
  'read_at',
  'dedupe_key',
  'created_by_user_id',
  'created_at',
].join(', ');

function requireId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new SharedFleetError('shared_validation_error', `${fieldName} is required.`);
  }

  return normalized;
}

function asRows<TRow>(data: unknown): TRow[] {
  return ((data ?? []) as unknown) as TRow[];
}

async function requireCurrentUserId() {
  const supabase = getSharedSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new SharedFleetError('shared_auth_required', 'You must be signed in to access Shared Fleet.');
  }

  return userId;
}

export const notificationRepo: NotificationRepo = {
  async getFleetNotifications(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('fleet_notifications')
      .select(NOTIFICATION_COLUMNS)
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return asRows<NotificationRow>(data).map(mapNotification);
  },

  async markNotificationRead(input) {
    const notificationId = requireId(input.notificationId, 'Notification id');
    const supabase = getSharedSupabaseClient();

    const { error } = await supabase
      .from('fleet_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('is_read', false);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }
  },

  async markAllNotificationsRead(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const userId = await requireCurrentUserId();
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('fleet_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('fleet_id', fleetId)
      .eq('recipient_user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return (data ?? []).length;
  },

  async countUnread(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const userId = await requireCurrentUserId();
    const supabase = getSharedSupabaseClient();

    const { count, error } = await supabase
      .from('fleet_notifications')
      .select('id', { head: true, count: 'exact' })
      .eq('fleet_id', fleetId)
      .eq('recipient_user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return count ?? 0;
  },
};
