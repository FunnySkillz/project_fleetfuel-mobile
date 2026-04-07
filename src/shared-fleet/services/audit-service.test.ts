import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFleetAuditLog } from '@/shared-fleet/services/audit-service';

const { auditRepoMock } = vi.hoisted(() => ({
  auditRepoMock: {
    getFleetAuditLog: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  auditRepo: auditRepoMock,
}));

describe('audit service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads fleet audit log through repo', async () => {
    auditRepoMock.getFleetAuditLog.mockResolvedValueOnce([{ id: 'audit-1' }]);
    await expect(getFleetAuditLog({ fleetId: 'fleet-1', limit: 10 })).resolves.toEqual([{ id: 'audit-1' }]);
  });
});
