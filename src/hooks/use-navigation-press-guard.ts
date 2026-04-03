import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';

import { createNavigationPressGuard } from '@/utils/navigation-press-guard';

type UseNavigationPressGuardOptions = {
  unlockDelayMs?: number;
};

export function useNavigationPressGuard(options: UseNavigationPressGuardOptions = {}) {
  const isFocused = useIsFocused();
  const guardRef = useRef(createNavigationPressGuard(options.unlockDelayMs));

  useEffect(() => {
    if (isFocused) {
      guardRef.current.reset();
    }
  }, [isFocused]);

  useEffect(() => {
    const guard = guardRef.current;
    return () => {
      guard.dispose();
    };
  }, []);

  const runGuarded = useCallback((action: () => void) => {
    return guardRef.current.runGuarded(action);
  }, []);

  const reset = useCallback(() => {
    guardRef.current.reset();
  }, []);

  const isLocked = useCallback(() => {
    return guardRef.current.isLocked();
  }, []);

  return {
    runGuarded,
    reset,
    isLocked,
  };
}
