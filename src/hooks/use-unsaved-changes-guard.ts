import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
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
  const allowExitRef = useRef(false);
  const title = copy.title ?? DEFAULT_TITLE;
  const message = copy.message ?? DEFAULT_MESSAGE;

  const allowNextNavigation = useCallback(() => {
    allowExitRef.current = true;
    setTimeout(() => {
      allowExitRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || isDialogOpenRef.current || allowExitRef.current) {
        return;
      }

      event.preventDefault();
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
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });

    return unsubscribe;
  }, [isDirty, message, navigation, title]);

  return { allowNextNavigation };
}
