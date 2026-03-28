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
import { useTheme } from '@/hooks/use-theme';

function AddTabButton({ onPress }: BottomTabBarButtonProps & { onPress: PressableProps['onPress'] }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add"
      onPress={onPress}
      style={({ pressed }) => [styles.addButtonWrap, pressed && styles.pressed]}>
      <View style={[styles.addButtonSurface, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" style={styles.addGlyph}>
          +
        </ThemedText>
        <ThemedText type="smallBold">Add</ThemedText>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();

  const openAddMenu = useCallback(() => {
    const goTo = (path: Href) => {
      router.push(path);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Create New Entry',
          options: ['Add Trip', 'Add Fuel', 'Add Vehicle', 'Cancel'],
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

    Alert.alert('Create New Entry', 'Choose what you want to add.', [
      { text: 'Add Trip', onPress: () => goTo('/trips/new') },
      { text: 'Add Fuel', onPress: () => goTo('/fuel/new') },
      { text: 'Add Vehicle', onPress: () => goTo('/vehicles/new') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [router]);

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
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="vehicles/index"
        options={{
          title: 'Vehicles',
          tabBarLabel: 'Vehicles',
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarLabel: 'Add',
          tabBarButton: (props) => <AddTabButton {...props} onPress={openAddMenu} />,
        }}
      />
      <Tabs.Screen
        name="logs/index"
        options={{
          title: 'Logs',
          tabBarLabel: 'Logs',
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
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
