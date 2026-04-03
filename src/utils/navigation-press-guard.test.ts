import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNavigationPressGuard } from './navigation-press-guard';

describe('createNavigationPressGuard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first action and blocks rapid repeated action until timeout', () => {
    vi.useFakeTimers();
    const guard = createNavigationPressGuard(1000);
    const action = vi.fn();

    expect(guard.runGuarded(action)).toBe(true);
    expect(guard.runGuarded(action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(999);
    expect(guard.runGuarded(action)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(guard.runGuarded(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('unlocks immediately when reset is called', () => {
    vi.useFakeTimers();
    const guard = createNavigationPressGuard(1000);
    const action = vi.fn();

    expect(guard.runGuarded(action)).toBe(true);
    expect(guard.isLocked()).toBe(true);

    guard.reset();

    expect(guard.isLocked()).toBe(false);
    expect(guard.runGuarded(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('clears lock when guarded action throws', () => {
    const guard = createNavigationPressGuard(1000);
    const error = new Error('boom');

    expect(() =>
      guard.runGuarded(() => {
        throw error;
      }),
    ).toThrow(error);

    expect(guard.isLocked()).toBe(false);

    const safeAction = vi.fn();
    expect(guard.runGuarded(safeAction)).toBe(true);
    expect(safeAction).toHaveBeenCalledTimes(1);
  });
});

