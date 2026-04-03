const DEFAULT_UNLOCK_DELAY_MS = 1200;

type NavigationAction = () => void;

export type NavigationPressGuard = {
  runGuarded: (action: NavigationAction) => boolean;
  reset: () => void;
  isLocked: () => boolean;
  dispose: () => void;
};

export function createNavigationPressGuard(unlockDelayMs: number = DEFAULT_UNLOCK_DELAY_MS): NavigationPressGuard {
  let locked = false;
  let unlockTimer: ReturnType<typeof setTimeout> | null = null;

  const clearUnlockTimer = () => {
    if (!unlockTimer) {
      return;
    }
    clearTimeout(unlockTimer);
    unlockTimer = null;
  };

  const reset = () => {
    locked = false;
    clearUnlockTimer();
  };

  const scheduleUnlock = () => {
    clearUnlockTimer();
    unlockTimer = setTimeout(() => {
      locked = false;
      unlockTimer = null;
    }, unlockDelayMs);
  };

  return {
    runGuarded(action: NavigationAction) {
      if (locked) {
        return false;
      }

      locked = true;
      try {
        action();
      } catch (error) {
        reset();
        throw error;
      }
      scheduleUnlock();
      return true;
    },
    reset,
    isLocked() {
      return locked;
    },
    dispose() {
      reset();
    },
  };
}

