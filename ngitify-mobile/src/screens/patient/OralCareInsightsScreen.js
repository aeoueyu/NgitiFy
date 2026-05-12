import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionLabel,
  SurfaceCard,
} from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';

const tonePalette = {
  primary: {
    background: mobileTheme.colors.primarySoft,
    icon: mobileTheme.colors.primaryDark,
  },
  secondary: {
    background: mobileTheme.colors.secondarySoft,
    icon: mobileTheme.colors.secondaryDark,
  },
  info: {
    background: '#eef7ff',
    icon: mobileTheme.colors.primaryDark,
  },
};

function SignalCard({ signal }) {
  const palette = tonePalette[signal.tone] || tonePalette.primary;

  return (
    <SurfaceCard style={styles.signalCard}>
      <View style={[styles.signalIconWrap, { backgroundColor: palette.background }]}>
        <Ionicons name={signal.icon} size={18} color={signal.iconColor || palette.icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.signalTitle}>{signal.title}</Text>
        <Text style={styles.signalSummary}>{signal.summary}</Text>
        <Text style={styles.signalAction}>{signal.action}</Text>
      </View>
    </SurfaceCard>
  );
}

function FactorRow({ item, onToggle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.factorRow, item.active && styles.factorRowActive]}
      onPress={() => onToggle(item.id)}
    >
      <Text style={[styles.factorLabel, item.active && styles.factorLabelActive]}>{item.label}</Text>
      <View style={[styles.factorToggle, item.active && styles.factorToggleActive]}>
        {item.active ? <Ionicons name="checkmark" size={15} color="#ffffff" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function LogChip({ item, onToggle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      style={[styles.logChip, item.selected && styles.logChipSelected]}
      onPress={onToggle}
    >
      <Text style={[styles.logChipText, item.selected && styles.logChipTextSelected]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

function SheetHeader({ title, subtitle, onClose }) {
  return (
    <View style={styles.sheetHeader}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.sheetSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.sheetCloseButton} onPress={onClose} activeOpacity={0.8}>
        <Ionicons name="close" size={18} color={mobileTheme.colors.text} />
      </TouchableOpacity>
    </View>
  );
}

export default function OralCareInsightsScreen({ navigation, route }) {
  const preview = useMemo(
    () => getStaticOralCarePreview(route?.params?.visitPrediction || null),
    [route?.params?.visitPrediction],
  );

  const [factors, setFactors] = useState(preview.factors);
  const [logGroups, setLogGroups] = useState(preview.logGroups);
  const [factorsVisible, setFactorsVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);

  const activeFactors = factors.filter((item) => item.active && item.id !== 'none');
  const selectedLogItems = logGroups.flatMap((group) => group.items.filter((item) => item.selected));

  const toggleFactor = (factorId) => {
    setFactors((current) => {
      if (factorId === 'none') {
        return current.map((item) => ({
          ...item,
          active: item.id === 'none',
        }));
      }

      const next = current.map((item) => {
        if (item.id === factorId) {
          return { ...item, active: !item.active };
        }
        if (item.id === 'none') {
          return { ...item, active: false };
        }
        return item;
      });

      const hasActiveFactor = next.some((item) => item.id !== 'none' && item.active);
      return next.map((item) => (
        item.id === 'none' ? { ...item, active: !hasActiveFactor && item.active } : item
      ));
    });
  };

  const toggleLogItem = (groupId, itemId) => {
    setLogGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        items: group.items.map((item) => (
          item.id === itemId ? { ...item, selected: !item.selected } : item
        )),
      };
    }));
  };

  return (
    <Screen>
      <Header
        title="Oral Care Window"
        subtitle="Front-end preview"
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate('PatientDashboardMain');
        }}
        floating
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>{preview.hero.eyebrow}</Text>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{preview.hero.title}</Text>
          <Text style={styles.heroHeadline}>{preview.hero.headline}</Text>
          <Text style={styles.heroBody}>{preview.hero.whyThisShowing}</Text>

          <View style={styles.heroStatusPill}>
            <Ionicons name="sparkles-outline" size={14} color={mobileTheme.colors.primaryDark} />
            <Text style={styles.heroStatusText}>{preview.hero.statusLabel}</Text>
          </View>

          <View style={styles.summaryChipRow}>
            {preview.summaryChips.map((chip) => (
              <View key={chip} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>{chip}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.previewHint}>{preview.hero.previewHint}</Text>

          <View style={styles.heroActions}>
            <PrimaryButton
              label="Book Preventive Visit"
              icon="calendar-outline"
              onPress={() => navigation.navigate('AppointmentBooking')}
              style={styles.heroPrimary}
            />
            <SecondaryButton
              label="Review Factors"
              icon="options-outline"
              onPress={() => setFactorsVisible(true)}
              style={styles.heroSecondary}
            />
          </View>
        </SurfaceCard>

        <SectionLabel eyebrow="Watch Signals" title="What Needs Attention" style={styles.sectionSpacing} />
        {preview.watchSignals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}

        <SectionLabel
          eyebrow="Oral Health Factors"
          title="Current Factors"
          actionLabel="Open"
          onActionPress={() => setFactorsVisible(true)}
          style={styles.sectionSpacing}
        />
        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>Multi-select factors</Text>
            <Text style={styles.summaryCount}>
              {activeFactors.length > 0 ? `${activeFactors.length} active` : 'None selected'}
            </Text>
          </View>
          <Text style={styles.summaryBody}>
            This replaces the cycle-factor radio list with dental-specific toggles that can be combined.
          </Text>
          <View style={styles.factorChipRow}>
            {(activeFactors.length > 0 ? activeFactors : factors.filter((item) => item.id === 'none')).map((item) => (
              <View key={item.id} style={styles.factorChip}>
                <Text style={styles.factorChipText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        <SectionLabel
          eyebrow="Quick Log"
          title="Daily Care Preview"
          actionLabel="Open"
          onActionPress={() => setLogVisible(true)}
          style={styles.sectionSpacing}
        />
        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>Log today in one tap</Text>
            <Text style={styles.summaryCount}>{selectedLogItems.length} selected</Text>
          </View>
          <Text style={styles.summaryBody}>
            The final version can save daily symptoms and habits. For now, this preview lets you test the interaction pattern.
          </Text>
          <View style={styles.selectedLogWrap}>
            {selectedLogItems.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.selectedLogChip}>
                <Text style={styles.selectedLogChipText}>{item.label}</Text>
              </View>
            ))}
          </View>
          <SecondaryButton
            label="Open Quick Log"
            icon="create-outline"
            onPress={() => setLogVisible(true)}
            style={styles.inlineButton}
          />
        </SurfaceCard>

        <SectionLabel eyebrow="Care Focus" title={preview.carePlan.title} style={styles.sectionSpacing} />
        <SurfaceCard style={styles.carePlanCard}>
          <Text style={styles.carePlanBody}>{preview.carePlan.body}</Text>
          {preview.carePlan.checklist.map((item) => (
            <View key={item} style={styles.checklistRow}>
              <View style={styles.checkDot} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </SurfaceCard>

        <SectionLabel eyebrow="Education" title={preview.education.title} style={styles.sectionSpacing} />
        <SurfaceCard style={styles.educationCard}>
          <MaterialCommunityIcons
            name="tooth-outline"
            size={30}
            color={mobileTheme.colors.primaryDark}
            style={{ marginBottom: 10 }}
          />
          <Text style={styles.educationBody}>{preview.education.body}</Text>
        </SurfaceCard>
      </ScrollView>

      <Modal visible={factorsVisible} transparent animationType="slide" onRequestClose={() => setFactorsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <SheetHeader
              title="Oral Health Factors"
              subtitle="Choose all that apply. These should be toggles or chips, not single-choice radio buttons."
              onClose={() => setFactorsVisible(false)}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {factors.map((item) => (
                <FactorRow key={item.id} item={item} onToggle={toggleFactor} />
              ))}
            </ScrollView>
            <PrimaryButton
              label="Done"
              onPress={() => setFactorsVisible(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={logVisible} transparent animationType="slide" onRequestClose={() => setLogVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <SheetHeader
              title="Quick Log"
              subtitle="Preview how patients could log symptoms and oral care with one-tap chips."
              onClose={() => setLogVisible(false)}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {logGroups.map((group) => (
                <View key={group.id} style={styles.logGroup}>
                  <Text style={styles.logGroupTitle}>{group.title}</Text>
                  <View style={styles.logChipWrap}>
                    {group.items.map((item) => (
                      <LogChip
                        key={item.id}
                        item={item}
                        onToggle={() => toggleLogItem(group.id, item.id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <PrimaryButton
              label="Done"
              onPress={() => setLogVisible(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 152,
  },
  heroCard: {
    marginTop: 8,
    marginBottom: 18,
    backgroundColor: '#f7fcff',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: mobileTheme.colors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 8,
  },
  heroHeadline: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
    marginBottom: 10,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: mobileTheme.colors.textMuted,
    marginBottom: 14,
  },
  heroStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.secondarySoft,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  heroStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
  },
  summaryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  summaryChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: mobileTheme.colors.textMuted,
  },
  previewHint: {
    fontSize: 12,
    lineHeight: 18,
    color: mobileTheme.colors.textSoft,
    marginBottom: 16,
  },
  heroActions: {
    marginTop: 2,
  },
  heroPrimary: {
    marginBottom: 12,
  },
  heroSecondary: {
    backgroundColor: '#ffffff',
  },
  sectionSpacing: {
    marginBottom: 12,
  },
  signalCard: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  signalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 5,
  },
  signalSummary: {
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.textMuted,
    marginBottom: 6,
  },
  signalAction: {
    fontSize: 12,
    lineHeight: 18,
    color: mobileTheme.colors.primaryDark,
    fontWeight: '700',
  },
  summaryCard: {
    marginBottom: 18,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: mobileTheme.colors.text,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '800',
    color: mobileTheme.colors.secondaryDark,
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 20,
    color: mobileTheme.colors.textMuted,
    marginBottom: 12,
  },
  factorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  factorChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  factorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  selectedLogWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  selectedLogChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.secondarySoft,
  },
  selectedLogChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  inlineButton: {
    backgroundColor: '#ffffff',
  },
  carePlanCard: {
    marginBottom: 18,
  },
  carePlanBody: {
    fontSize: 14,
    lineHeight: 21,
    color: mobileTheme.colors.text,
    marginBottom: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileTheme.colors.secondary,
    marginTop: 7,
    marginRight: 10,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.textMuted,
  },
  educationCard: {
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  educationBody: {
    fontSize: 14,
    lineHeight: 21,
    color: mobileTheme.colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 31, 48, 0.35)',
  },
  sheetCard: {
    maxHeight: '84%',
    backgroundColor: mobileTheme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.textMuted,
  },
  sheetCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.backgroundMuted,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#f8fcff',
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    marginBottom: 10,
  },
  factorRowActive: {
    borderColor: mobileTheme.colors.primary,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  factorLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: mobileTheme.colors.text,
    paddingRight: 12,
  },
  factorLabelActive: {
    color: mobileTheme.colors.primaryDark,
  },
  factorToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorToggleActive: {
    backgroundColor: mobileTheme.colors.primaryDark,
    borderColor: mobileTheme.colors.primaryDark,
  },
  logGroup: {
    marginBottom: 18,
  },
  logGroupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 10,
  },
  logChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  logChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
  },
  logChipSelected: {
    backgroundColor: mobileTheme.colors.secondarySoft,
    borderColor: mobileTheme.colors.secondary,
  },
  logChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: mobileTheme.colors.textMuted,
  },
  logChipTextSelected: {
    color: mobileTheme.colors.primaryDark,
  },
});
