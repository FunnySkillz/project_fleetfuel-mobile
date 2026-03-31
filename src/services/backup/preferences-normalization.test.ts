import { describe, expect, it } from 'vitest';

import { normalizeBackupPreferences } from '@/services/backup/preferences-normalization';

describe('backup preference normalization', () => {
  it('keeps appLockEnabled when present', () => {
    const normalized = normalizeBackupPreferences({
      themeMode: 'dark',
      language: 'de',
      appLockEnabled: true,
    });

    expect(normalized).toEqual({
      themeMode: 'dark',
      language: 'de',
      appLockEnabled: true,
    });
  });

  it('falls back appLockEnabled to false for legacy backups', () => {
    const normalized = normalizeBackupPreferences({
      themeMode: 'system',
      language: 'en',
    });

    expect(normalized.appLockEnabled).toBe(false);
  });
});
