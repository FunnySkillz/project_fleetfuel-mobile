import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPinAsync,
  hasPinAsync,
  isValidPin,
  setPinAsync,
  verifyPinAsync,
} from '@/services/pin-auth';

const secureStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  getRandomBytes: (size: number) => Uint8Array.from({ length: size }, (_, index) => index + 1),
  digestStringAsync: vi.fn(async (_algorithm: string, input: string) => `hash:${input}`),
}));

describe('pin auth service', () => {
  beforeEach(async () => {
    secureStore.clear();
    vi.restoreAllMocks();
    await clearPinAsync();
  });

  it('validates expected PIN format', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12ab')).toBe(false);
  });

  it('stores and verifies PIN successfully', async () => {
    await setPinAsync('1234');

    expect(await hasPinAsync()).toBe(true);

    const verifyOk = await verifyPinAsync('1234');
    expect(verifyOk.success).toBe(true);
    expect(verifyOk.lockedUntilEpochMs).toBeNull();
    expect(verifyOk.remainingAttempts).toBe(5);
  });

  it('locks temporary access after 5 failed attempts', async () => {
    await setPinAsync('1234');

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await verifyPinAsync('0000');
      expect(result.success).toBe(false);
      expect(result.lockedUntilEpochMs).toBeNull();
    }

    const lockResult = await verifyPinAsync('0000');
    expect(lockResult.success).toBe(false);
    expect(lockResult.lockedUntilEpochMs).toBe(31_000);
    expect(lockResult.remainingAttempts).toBe(0);

    const lockedCheck = await verifyPinAsync('1234');
    expect(lockedCheck.success).toBe(false);
    expect(lockedCheck.lockedUntilEpochMs).toBe(31_000);
    expect(lockedCheck.remainingAttempts).toBe(0);

    nowSpy.mockReturnValue(31_001);

    const afterLockWindow = await verifyPinAsync('1234');
    expect(afterLockWindow.success).toBe(true);
    expect(afterLockWindow.lockedUntilEpochMs).toBeNull();
  });

  it('clears stored PIN', async () => {
    await setPinAsync('1234');
    expect(await hasPinAsync()).toBe(true);

    await clearPinAsync();
    expect(await hasPinAsync()).toBe(false);
  });
});
