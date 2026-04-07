import { notificationRepo } from '@/shared-fleet/repos';
import type { FleetNotification } from '@/shared-fleet/types';

export async function getFleetNotifications(input: { fleetId: string; limit?: number }): Promise<FleetNotification[]> {
  return notificationRepo.getFleetNotifications(input);
}

export async function markNotificationRead(input: { notificationId: string }): Promise<void> {
  return notificationRepo.markNotificationRead(input);
}

export async function markAllNotificationsRead(input: { fleetId: string }): Promise<number> {
  return notificationRepo.markAllNotificationsRead(input);
}

export async function countFleetUnreadNotifications(input: { fleetId: string }): Promise<number> {
  return notificationRepo.countUnread(input);
}
