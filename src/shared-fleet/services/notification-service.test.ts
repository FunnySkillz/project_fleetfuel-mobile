import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countFleetUnreadNotifications,
  getFleetNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/shared-fleet/services/notification-service';

const { notificationRepoMock } = vi.hoisted(() => ({
  notificationRepoMock: {
    getFleetNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    countUnread: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  notificationRepo: notificationRepoMock,
}));

describe('notification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads notifications through repo', async () => {
    notificationRepoMock.getFleetNotifications.mockResolvedValueOnce([{ id: 'n-1' }]);
    await expect(getFleetNotifications({ fleetId: 'fleet-1' })).resolves.toEqual([{ id: 'n-1' }]);
  });

  it('marks single and all notifications as read', async () => {
    notificationRepoMock.markNotificationRead.mockResolvedValueOnce(undefined);
    notificationRepoMock.markAllNotificationsRead.mockResolvedValueOnce(3);

    await expect(markNotificationRead({ notificationId: 'n-1' })).resolves.toBeUndefined();
    await expect(markAllNotificationsRead({ fleetId: 'fleet-1' })).resolves.toBe(3);
  });

  it('counts unread notifications', async () => {
    notificationRepoMock.countUnread.mockResolvedValueOnce(4);
    await expect(countFleetUnreadNotifications({ fleetId: 'fleet-1' })).resolves.toBe(4);
  });
});
