import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileTheme, statusPalette } from '../../theme/mobileTheme';

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function SurfaceCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
  floating = false,
}) {
  return (
    <View style={[styles.headerWrap, floating && styles.headerFloating]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSide}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={18} color={mobileTheme.colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerSideRight}>{right}</View>
      </View>
    </View>
  );
}

export function SectionLabel({ eyebrow, title, actionLabel, onActionPress, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, icon, style, textStyle, loading, iconColor = '#fff' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.primaryButton, (disabled || loading) && styles.disabledButton, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={iconColor} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.primaryButtonText, textStyle]}>{loading ? 'Please wait...' : label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled, icon, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.secondaryButton, disabled && styles.disabledSecondaryButton, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={mobileTheme.colors.text} style={{ marginRight: 8 }} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatusChip({ status, label, style }) {
  const key = String(status || '').toLowerCase();
  const palette = statusPalette[key] || statusPalette.pending;
  return (
    <View style={[styles.statusChip, { backgroundColor: palette.backgroundColor }, style]}>
      <View style={[styles.statusDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.statusText, { color: palette.color }]}>{label || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mobileTheme.colors.background,
  },
  card: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    padding: mobileTheme.spacing.lg,
    ...mobileTheme.shadows.card,
  },
  headerWrap: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 18 : 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerFloating: {
    backgroundColor: mobileTheme.colors.background,
  },
  headerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 52,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    width: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: mobileTheme.colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: mobileTheme.colors.textSoft,
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: mobileTheme.colors.textSoft,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: mobileTheme.colors.text,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    ...mobileTheme.shadows.soft,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.secondarySoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: mobileTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  disabledSecondaryButton: {
    opacity: 0.5,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
