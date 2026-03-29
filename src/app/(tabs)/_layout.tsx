import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { type Href, Tabs, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

function AddTabButton({
  onPress,
  label,
}: BottomTabBarButtonProps & { onPress: PressableProps['onPress']; label: string }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.addButtonWrap, pressed && styles.pressed]}>
      <View style={[styles.addButtonSurface, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" style={styles.addGlyph}>
          +
        </ThemedText>
        <ThemedText type="smallBold">{label}</ThemedText>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const openAddMenu = useCallback(() => {
    const goTo = (path: Href) => {
      router.push(path);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('add.actionSheet.title'),
          options: [
            t('add.actionSheet.addTrip'),
            t('add.actionSheet.addFuel'),
            t('add.actionSheet.addVehicle'),
            t('common.cancel'),
          ],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) goTo('/trips/new');
          if (buttonIndex === 1) goTo('/fuel/new');
          if (buttonIndex === 2) goTo('/vehicles/new');
        },
      );
      return;
    }

    Alert.alert(t('add.actionSheet.title'), t('add.actionSheet.message'), [
      { text: t('add.actionSheet.addTrip'), onPress: () => goTo('/trips/new') },
      { text: t('add.actionSheet.addFuel'), onPress: () => goTo('/fuel/new') },
      { text: t('add.actionSheet.addVehicle'), onPress: () => goTo('/vehicles/new') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [router, t]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundElement,
          height: BottomTabInset,
          paddingTop: Spacing.one,
          paddingBottom: Platform.OS === 'ios' ? Spacing.one : Spacing.two,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.dashboard'),
          tabBarLabel: t('nav.dashboard'),
        }}
      />
      <Tabs.Screen
        name="vehicles/index"
        options={{
          title: t('nav.vehicles'),
          tabBarLabel: t('nav.vehicles'),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('nav.add'),
          tabBarLabel: t('nav.add'),
          tabBarButton: (props) => <AddTabButton {...props} onPress={openAddMenu} label={t('add.buttonLabel')} />,
        }}
      />
      <Tabs.Screen
        name="logs/index"
        options={{
          title: t('nav.logs'),
          tabBarLabel: t('nav.logs'),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t('nav.settings'),
          tabBarLabel: t('nav.settings'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButtonWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonSurface: {
    minWidth: 88,
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addGlyph: {
    fontSize: 18,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
