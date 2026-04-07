import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFleetOperationalReport, runExpiredBlockNormalization } from '@/shared-fleet/services/reporting-service';

const { reportingRepoMock } = vi.hoisted(() => ({
  reportingRepoMock: {
    getFleetOperationalReport: vi.fn(),
    runExpiredBlockNormalization: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  reportingRepo: reportingRepoMock,
}));

describe('reporting service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads fleet operational report', async () => {
    reportingRepoMock.getFleetOperationalReport.mockResolvedValueOnce({ activeDrivers: 1 });
    await expect(getFleetOperationalReport({ fleetId: 'fleet-1' })).resolves.toMatchObject({ activeDrivers: 1 });
  });

  it('runs expired block normalization', async () => {
    reportingRepoMock.runExpiredBlockNormalization.mockResolvedValueOnce(2);
    await expect(runExpiredBlockNormalization({ fleetId: 'fleet-1', emitNotifications: true })).resolves.toBe(2);
  });
});
