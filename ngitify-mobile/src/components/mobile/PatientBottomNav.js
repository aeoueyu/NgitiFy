import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileTheme } from '../../theme/mobileTheme';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home', route: 'PatientDashboardMain' },
  { key: 'window', label: 'Window', icon: 'sparkles-outline', route: 'OralCareInsights' },
  { key: 'visits', label: 'Visits', icon: 'calendar-outline', route: 'MyAppointments' },
  { key: 'records', label: 'Records', icon: 'document-text-outline', route: 'MedicalRecords' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', route: 'MyProfile' },
];

export default function PatientBottomNav({ navigation, state, activeKey }) {
  const currentRoute = state?.routes?.[state.index]?.name;
  const resolvedActiveKey =
    activeKey || NAV_ITEMS.find((item) => item.route === currentRoute)?.key || 'home';

  const navigateToItem = (item, isActive) => {
    if (isActive) return;

    if (state) {
      const targetKey = state.routes.find((route) => route.name === item.route)?.key;
      const event = navigation.emit({
        type: 'tabPress',
        target: targetKey,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(item.route);
      }
      return;
    }

    navigation.navigate('PatientTabs', { screen: item.route });
  };

  return (
    <View style={styles.shell}>
      <View style={styles.dock}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === resolvedActiveKey;

          return (
            <TouchableOpacity
              key={item.key}
              style={styles.item}
              onPress={() => navigateToItem(item, isActive)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? mobileTheme.colors.primaryDark : mobileTheme.colors.textSoft}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 16 : 12,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...mobileTheme.shadows.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: mobileTheme.colors.textSoft,
  },
  labelActive: {
    color: mobileTheme.colors.primaryDark,
  },
});
