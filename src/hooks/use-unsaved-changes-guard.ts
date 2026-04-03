import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type GuardCopy = {
  title?: string;
  message?: string;
};

const DEFAULT_TITLE = 'Discard changes?';
const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this screen and discard them?';

export function useUnsavedChangesGuard(isDirty: boolean, copy: GuardCopy = {}) {
  const navigation = useNavigation();
  const isDialogOpenRef = useRef(false);
  const [allowNextRemove, setAllowNextRemove] = useState(false);
  const allowResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = copy.title ?? DEFAULT_TITLE;
  const message = copy.message ?? DEFAULT_MESSAGE;

  const clearAllowResetTimer = useCallback(() => {
    if (!allowResetTimerRef.current) {
      return;
    }
    clearTimeout(allowResetTimerRef.current);
    allowResetTimerRef.current = null;
  }, []);

  const scheduleAllowReset = useCallback(() => {
    clearAllowResetTimer();
    allowResetTimerRef.current = setTimeout(() => {
      setAllowNextRemove(false);
      allowResetTimerRef.current = null;
    }, 0);
  }, [clearAllowResetTimer]);

  const allowNextNavigation = useCallback(() => {
    setAllowNextRemove(true);
    scheduleAllowReset();
  }, [scheduleAllowReset]);

  usePreventRemove(isDirty && !allowNextRemove, ({ data }) => {
    if (isDialogOpenRef.current) {
      return;
    }

    isDialogOpenRef.current = true;
    Alert.alert(title, message, [
      {
        text: 'Stay',
        style: 'cancel',
        onPress: () => {
          isDialogOpenRef.current = false;
        },
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          isDialogOpenRef.current = false;
          setAllowNextRemove(true);
          navigation.dispatch(data.action);
          scheduleAllowReset();
        },
      },
    ]);
  });

  useEffect(() => {
    return () => {
      clearAllowResetTimer();
      isDialogOpenRef.current = false;
    };
  }, [clearAllowResetTimer]);

  useEffect(() => {
    if (!isDirty) {
      clearAllowResetTimer();
      setAllowNextRemove(false);
      isDialogOpenRef.current = false;
      return;
    }
  }, [clearAllowResetTimer, isDirty]);

  return { allowNextNavigation };
}
