import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { AuthContext } from '../../context/AuthContext';
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

const toDateKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function OralCareInsightsScreen({ navigation, route }) {
  const { userToken, API_BASE_URL } = useContext(AuthContext);
  const [oralHealth, setOralHealth] = useState(
    route?.params?.oralHealth || null
  );

  const [
    visitPrediction,
    setVisitPrediction,
  ] = useState(
    route?.params?.visitPrediction || null
  );

  const [loading, setLoading] = useState(
    !route?.params?.oralHealth
  );

  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () =>
      getStaticOralCarePreview(
        visitPrediction,
        oralHealth
      ),
    [
      oralHealth,
      visitPrediction,
    ],
  );

  const [factors, setFactors] = useState(preview.factors);
  const [logGroups, setLogGroups] = useState(preview.logGroups);
  const [logNotes, setLogNotes] = useState('');
  const [factorsVisible, setFactorsVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [educationQuery, setEducationQuery] = useState('');
  const [educationCategory, setEducationCategory] = useState('all');
  const [selectedEducationArticle, setSelectedEducationArticle] = useState(null);

  const fetchCareData = useCallback(async () => {
    if (
      !userToken
      || !API_BASE_URL
    ) {
      return;
    }

    setLoading(true);

    try {
      const [
        oralHealthResult,
        visitPredictionResult,
      ] = await Promise.allSettled([
        fetch(
          `${API_BASE_URL}/api/my/oral-health`,
          {
            headers: {
              Authorization:
                `Bearer ${userToken}`,
            },
          },
        ),
        fetch(
          `${API_BASE_URL}/api/my/visit-prediction`,
          {
            headers: {
              Authorization:
                `Bearer ${userToken}`,
            },
          },
        ),
      ]);

      if (
        oralHealthResult.status
        === 'fulfilled'
      ) {
        const response =
          oralHealthResult.value;

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (response.ok) {
          setOralHealth(payload);
        } else if (
          !route?.params?.oralHealth
        ) {
          throw new Error(
            payload.message
            || 'Could not load oral health data.'
          );
        }
      } else if (
        !route?.params?.oralHealth
      ) {
        throw new Error(
          'Unable to connect to the oral health service.'
        );
      }

      if (
        visitPredictionResult.status
        === 'fulfilled'
      ) {
        const response =
          visitPredictionResult.value;

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (response.ok) {
          setVisitPrediction(
            payload?.prediction
            || null
          );
        } else if (
          !route?.params
            ?.visitPrediction
        ) {
          setVisitPrediction(null);
        }
      } else if (
        !route?.params
          ?.visitPrediction
      ) {
        setVisitPrediction(null);
      }
    } catch (error) {
      Alert.alert(
        'Oral Health Management',
        error.message
        || 'Unable to load your Oral Health Management information.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    API_BASE_URL,
    route?.params?.oralHealth,
    route?.params?.visitPrediction,
    userToken,
  ]);

  useEffect(() => {
    fetchCareData();
  }, [fetchCareData]);

  useEffect(() => {
    setFactors(preview.factors);
    setLogGroups(preview.logGroups);
    setLogNotes(oralHealth?.logs?.[0]?.logDateKey === toDateKey() ? oralHealth.logs[0]?.notes || '' : '');
  }, [oralHealth, preview]);

  const activeFactors = factors.filter((item) => item.active && item.id !== 'none');
  const selectedLogItems = logGroups.flatMap((group) => group.items.filter((item) => item.selected));

  const educationArticles = useMemo(
    () => (
      Array.isArray(preview.education?.articles)
        ? preview.education.articles
        : []
    ),
    [preview.education?.articles],
  );

  const contextualEducation = useMemo(
    () => (
      Array.isArray(preview.education?.contextualArticles)
        ? preview.education.contextualArticles.slice(0, 3)
        : []
    ),
    [preview.education?.contextualArticles],
  );

  const educationCategories = useMemo(() => {
    const categoryMap = new Map();

    educationArticles.forEach((article) => {
      const label = String(
        article.category || 'Dental Health Education',
      ).trim();

      const categoryId = String(
        article.categoryId
        || label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        || 'dental-health-education',
      );

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          id: categoryId,
          label,
        });
      }
    });

    return Array.from(categoryMap.values());
  }, [educationArticles]);

  const filteredEducationArticles = useMemo(() => {
    const normalizedQuery = educationQuery.trim().toLowerCase();

    return educationArticles.filter((article) => {
      const categoryLabel = String(
        article.category || 'Dental Health Education',
      ).trim();

      const categoryId = String(
        article.categoryId
        || categoryLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        || 'dental-health-education',
      );

      if (
        educationCategory !== 'all'
        && categoryId !== educationCategory
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        article.title,
        article.category,
        article.summary,
        article.body,
        article.action,
        ...(Array.isArray(article.keywords) ? article.keywords : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [
    educationArticles,
    educationCategory,
    educationQuery,
  ]);

  const openEducationArticle = (article) => {
    if (!article) return;
    setSelectedEducationArticle(article);
  };

  const openContextualEducationArticle = (article) => {
    setEducationCategory('all');
    setEducationQuery('');
    openEducationArticle(article);
  };

  const clearEducationFilters = () => {
    setEducationCategory('all');
    setEducationQuery('');
  };

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
        items: group.items.map((item) => {
          if (groupId === 'symptoms' && itemId === 'no-symptoms') {
            return { ...item, selected: item.id === 'no-symptoms' ? !item.selected : false };
          }
          if (groupId === 'symptoms' && itemId !== 'no-symptoms') {
            return {
              ...item,
              selected: item.id === 'no-symptoms'
                ? false
                : item.id === itemId
                  ? !item.selected
                  : item.selected,
            };
          }
          return item.id === itemId ? { ...item, selected: !item.selected } : item;
        }),
      };
    }));
  };

  const saveFactors = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/my/oral-health/factors`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ factors: factors.filter((item) => item.active).map((item) => item.id) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to save oral health factors.');
      setOralHealth(payload);
      setFactorsVisible(false);
      Alert.alert('Oral Health Management', payload.message || 'Oral health factors saved.');
    } catch (error) {
      Alert.alert('Oral Health Management', error.message || 'Failed to save oral health factors.');
    } finally {
      setSaving(false);
    }
  };

  const saveDailyLog = async () => {
    const symptoms = logGroups.find((group) => group.id === 'symptoms')?.items.filter((item) => item.selected).map((item) => item.id) || [];
    const dailyCare = logGroups.find((group) => group.id === 'dailyCare')?.items.filter((item) => item.selected).map((item) => item.id) || [];
    const riskFactors = logGroups.find((group) => group.id === 'riskFactors')?.items.filter((item) => item.selected).map((item) => item.id) || [];

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/my/oral-health/logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logDate: toDateKey(), symptoms, dailyCare, riskFactors, notes: logNotes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to save daily oral health log.');
      setOralHealth(payload);
      setLogVisible(false);
      Alert.alert('Oral Health Management', payload.message || 'Daily oral health log saved.');
    } catch (error) {
      Alert.alert('Oral Health Management', error.message || 'Failed to save daily oral health log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header
        title="Oral Health Management"
        subtitle="Today, trends, recommended visit windows, and Dental Health Education"
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
        {loading ? (
          <SurfaceCard style={styles.loadingCard}>
            <ActivityIndicator color={mobileTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Loading saved oral health data...</Text>
          </SurfaceCard>
        ) : null}

        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>
              {preview.hero.eyebrow}
            </Text>

            <View style={styles.systemBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={
                  mobileTheme.colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.systemBadgeText
                }
              >
                System Recommendation
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{preview.hero.title}</Text>
          <Text style={styles.heroHeadline}>{preview.hero.headline}</Text>
          <Text style={styles.heroBody}>{preview.hero.whyThisShowing}</Text>

          <View style={styles.heroStatusPill}>
            <Ionicons name="sparkles-outline" size={14} color={mobileTheme.colors.primaryDark} />
            <Text style={styles.heroStatusText}>{preview.hero.statusLabel}</Text>
          </View>

          <Text style={styles.previewHint}>
            Recommendation based on
          </Text>
          <View style={styles.summaryChipRow}>
            {(preview.hero.sourceLabels || []).map((source) => (
              <View key={source} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>{source}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryChipRow}>
            {preview.summaryChips.map((chip) => (
              <View key={chip} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>{chip}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.previewHint}>
            {preview.hero.previewHint}
          </Text>

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
          eyebrow="Oral Health Management"
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
            Saved factors help personalize watch signals without changing your clinical record.
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
          eyebrow="Daily Oral Health Log"
          title="Record Today"
          actionLabel="Open"
          onActionPress={() =>
            setLogVisible(true)
          }
          style={styles.sectionSpacing}
        />
        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>Log today in one tap</Text>
            <Text style={styles.summaryCount}>{selectedLogItems.length} selected</Text>
          </View>
          <Text style={styles.summaryBody}>
            Today's one-tap symptoms and care habits are saved to your patient account.
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

        <SectionLabel
          eyebrow="Dental Health Education"
          title="Learn about your oral health"
          style={styles.sectionSpacing}
        />

        <SurfaceCard style={styles.educationIntroCard}>
          <View style={styles.educationIntroIcon}>
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={24}
              color={mobileTheme.colors.primaryDark}
            />
          </View>

          <Text style={styles.educationIntroTitle}>
            Dental Health Education
          </Text>

          <Text style={styles.educationBody}>
            {preview.education.body}
          </Text>

          <View style={styles.educationDisclaimer}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={mobileTheme.colors.primaryDark}
            />

            <Text style={styles.educationDisclaimerText}>
              This information is educational and does not diagnose dental
              disease. Persistent, worsening, or concerning symptoms may be
              worth discussing with your dentist or clinic.
            </Text>
          </View>
        </SurfaceCard>

        <SectionLabel
          eyebrow="Recommended for You"
          title={
            contextualEducation.length
              ? 'Related to your recent logs'
              : 'No matching topics yet'
          }
          style={styles.sectionSpacing}
        />

        {contextualEducation.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.educationRecommendationScroll}
            contentContainerStyle={styles.educationRecommendationContent}
          >
            {contextualEducation.map((article) => (
              <TouchableOpacity
                key={article.id}
                activeOpacity={0.86}
                style={styles.educationRecommendationCard}
                onPress={() => openContextualEducationArticle(article)}
                accessibilityRole="button"
                accessibilityLabel={`Read ${article.title}`}
              >
                <View style={styles.educationRecommendationIcon}>
                  <MaterialCommunityIcons
                    name="tooth-outline"
                    size={21}
                    color={mobileTheme.colors.primaryDark}
                  />
                </View>

                <Text style={styles.educationCategoryEyebrow}>
                  {article.category || 'Dental Health Education'}
                </Text>

                <Text
                  style={styles.educationRecommendationTitle}
                  numberOfLines={3}
                >
                  {article.title}
                </Text>

                <Text
                  style={styles.educationRecommendationSummary}
                  numberOfLines={4}
                >
                  {article.summary}
                </Text>

                <View style={styles.educationReadRow}>
                  <Text style={styles.educationReadText}>
                    Read topic
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={mobileTheme.colors.primaryDark}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <SurfaceCard style={styles.educationEmptyCard}>
            <View style={styles.educationEmptyIcon}>
              <MaterialCommunityIcons
                name="book-search-outline"
                size={27}
                color={mobileTheme.colors.primaryDark}
              />
            </View>

            <Text style={styles.educationEmptyTitle}>
              No contextual education yet
            </Text>

            <Text style={styles.educationEmptyText}>
              Save Oral Health Management information such as sensitivity,
              bleeding gums, flossing, missed brushing, sugary drinks,
              smoking, or vaping to see related educational topics.
            </Text>
          </SurfaceCard>
        )}

        <SectionLabel
          eyebrow="Education Library"
          title="Browse Dental Health Education"
          style={styles.sectionSpacing}
        />

        {educationArticles.length ? (
          <>
            <View style={styles.educationSearchWrap}>
              <Ionicons
                name="search-outline"
                size={19}
                color={mobileTheme.colors.textSoft}
              />

              <TextInput
                value={educationQuery}
                onChangeText={setEducationQuery}
                placeholder="Search education topics"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.educationSearchInput}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search Dental Health Education"
              />

              {educationQuery ? (
                <TouchableOpacity
                  style={styles.educationSearchClear}
                  onPress={() => setEducationQuery('')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear education search"
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={mobileTheme.colors.textSoft}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.educationCategoryScroll}
              contentContainerStyle={styles.educationCategoryContent}
            >
              <TouchableOpacity
                activeOpacity={0.84}
                style={[
                  styles.educationCategoryChip,
                  educationCategory === 'all'
                    && styles.educationCategoryChipActive,
                ]}
                onPress={() => setEducationCategory('all')}
                accessibilityRole="button"
                accessibilityState={{
                  selected: educationCategory === 'all',
                }}
              >
                <Text
                  style={[
                    styles.educationCategoryChipText,
                    educationCategory === 'all'
                      && styles.educationCategoryChipTextActive,
                  ]}
                >
                  All Topics
                </Text>
              </TouchableOpacity>

              {educationCategories.map((category) => {
                const selected = educationCategory === category.id;

                return (
                  <TouchableOpacity
                    key={category.id}
                    activeOpacity={0.84}
                    style={[
                      styles.educationCategoryChip,
                      selected && styles.educationCategoryChipActive,
                    ]}
                    onPress={() => setEducationCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.educationCategoryChipText,
                        selected && styles.educationCategoryChipTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredEducationArticles.length ? (
              <View style={styles.educationArticleList}>
                {filteredEducationArticles.map((article) => (
                  <TouchableOpacity
                    key={article.id}
                    activeOpacity={0.86}
                    style={styles.educationArticleCard}
                    onPress={() => openEducationArticle(article)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${article.title}`}
                  >
                    <View style={styles.educationArticleIcon}>
                      <MaterialCommunityIcons
                        name="book-open-outline"
                        size={21}
                        color={mobileTheme.colors.primaryDark}
                      />
                    </View>

                    <View style={styles.educationArticleContent}>
                      <Text style={styles.educationCategoryEyebrow}>
                        {article.category || 'Dental Health Education'}
                      </Text>

                      <Text style={styles.educationArticleTitle}>
                        {article.title}
                      </Text>

                      <Text
                        style={styles.educationArticleSummary}
                        numberOfLines={3}
                      >
                        {article.summary}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={mobileTheme.colors.textSoft}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <SurfaceCard style={styles.educationEmptyCard}>
                <View style={styles.educationEmptyIcon}>
                  <Ionicons
                    name="search-outline"
                    size={25}
                    color={mobileTheme.colors.primaryDark}
                  />
                </View>

                <Text style={styles.educationEmptyTitle}>
                  No education topics found
                </Text>

                <Text style={styles.educationEmptyText}>
                  Try another category or clear your search to browse the
                  complete Dental Health Education library.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.84}
                  style={styles.educationResetButton}
                  onPress={clearEducationFilters}
                  accessibilityRole="button"
                >
                  <Text style={styles.educationResetButtonText}>
                    Show All Topics
                  </Text>
                </TouchableOpacity>
              </SurfaceCard>
            )}
          </>
        ) : (
          <SurfaceCard style={styles.educationEmptyCard}>
            <View style={styles.educationEmptyIcon}>
              <MaterialCommunityIcons
                name="book-alert-outline"
                size={27}
                color={mobileTheme.colors.primaryDark}
              />
            </View>

            <Text style={styles.educationEmptyTitle}>
              Dental Health Education is unavailable
            </Text>

            <Text style={styles.educationEmptyText}>
              The education library could not be loaded right now. Your
              Daily Oral Health Log and other Oral Health Management features
              remain available.
            </Text>

            <TouchableOpacity
              activeOpacity={0.84}
              style={styles.educationResetButton}
              onPress={fetchOralHealth}
              accessibilityRole="button"
            >
              <Text style={styles.educationResetButtonText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </SurfaceCard>
        )}
      </ScrollView>

      <Modal visible={factorsVisible} transparent animationType="slide" onRequestClose={() => setFactorsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <SheetHeader
              title="Oral Health Management Factors"
              subtitle="Choose all that apply. These factors help personalize your oral-care screen."
              onClose={() => setFactorsVisible(false)}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {factors.map((item) => (
                <FactorRow key={item.id} item={item} onToggle={toggleFactor} />
              ))}
            </ScrollView>
            <PrimaryButton
              label={saving ? 'Saving...' : 'Save Factors'}
              onPress={saveFactors}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={logVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <SheetHeader
              title="Quick Log"
              subtitle="Save today's symptoms and home-care habits."
              onClose={() => setLogVisible(false)}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {logGroups.map((group) => (
                <View key={group.id} style={styles.logGroup}>
                  <Text style={styles.logGroupTitle}>
                    {group.title}
                  </Text>

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

              <Text style={styles.notesLabel}>
                Notes
              </Text>

              <TextInput
                value={logNotes}
                onChangeText={setLogNotes}
                multiline
                maxLength={500}
                placeholder="Optional note for yourself before your next visit."
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.notesInput}
              />
            </ScrollView>

            <PrimaryButton
              label={saving ? 'Saving...' : 'Save Daily Log'}
              onPress={saveDailyLog}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedEducationArticle)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEducationArticle(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.educationSheetCard}>
            <SheetHeader
              title="Dental Health Education"
              subtitle={
                selectedEducationArticle?.category
                || 'Educational oral-health information'
              }
              onClose={() => setSelectedEducationArticle(null)}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.educationSheetContent}
            >
              {selectedEducationArticle ? (
                <>
                  <View style={styles.educationSheetIcon}>
                    <MaterialCommunityIcons
                      name="book-open-page-variant-outline"
                      size={26}
                      color={mobileTheme.colors.primaryDark}
                    />
                  </View>

                  <Text style={styles.educationSheetCategory}>
                    {selectedEducationArticle.category
                      || 'Dental Health Education'}
                  </Text>

                  <Text style={styles.educationSheetTitle}>
                    {selectedEducationArticle.title}
                  </Text>

                  <Text style={styles.educationSheetSummary}>
                    {selectedEducationArticle.summary}
                  </Text>

                  <View style={styles.educationSheetDivider} />

                  <Text style={styles.educationSheetBody}>
                    {selectedEducationArticle.body
                      || selectedEducationArticle.summary}
                  </Text>

                  {selectedEducationArticle.action ? (
                    <View style={styles.educationActionCard}>
                      <View style={styles.educationActionHeader}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={19}
                          color={mobileTheme.colors.primaryDark}
                        />

                        <Text style={styles.educationActionTitle}>
                          What you can do
                        </Text>
                      </View>

                      <Text style={styles.educationActionText}>
                        {selectedEducationArticle.action}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.educationSheetDisclaimer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={mobileTheme.colors.primaryDark}
                    />

                    <Text style={styles.educationSheetDisclaimerText}>
                      This information is educational and is not a diagnosis.
                      Consider contacting the clinic if symptoms continue,
                      worsen, or concern you.
                    </Text>
                  </View>
                </>
              ) : null}
            </ScrollView>
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
  loadingCard: {
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: mobileTheme.colors.textMuted,
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
  systemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  systemBadgeText: {
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
  notesLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: mobileTheme.colors.text,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 19,
  },

  educationIntroCard: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  educationIntroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
    marginBottom: 14,
  },
  educationIntroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 8,
  },
  educationDisclaimer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 14,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.backgroundMuted,
  },
  educationDisclaimerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    lineHeight: 18,
    color: mobileTheme.colors.textMuted,
  },

  educationRecommendationScroll: {
    marginHorizontal: -18,
    marginBottom: 20,
  },
  educationRecommendationContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  educationRecommendationCard: {
    width: 264,
    minHeight: 230,
    marginRight: 12,
    padding: 17,
    borderRadius: mobileTheme.radii.lg,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    ...mobileTheme.shadows.soft,
  },
  educationRecommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
    marginBottom: 12,
  },
  educationCategoryEyebrow: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    color: mobileTheme.colors.secondaryDark,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  educationRecommendationTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 8,
  },
  educationRecommendationSummary: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: mobileTheme.colors.textMuted,
  },
  educationReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  educationReadText: {
    fontSize: 12,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
    marginRight: 5,
  },

  educationSearchWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
  },
  educationSearchInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    color: mobileTheme.colors.text,
    fontSize: 14,
  },
  educationSearchClear: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  educationCategoryScroll: {
    marginHorizontal: -18,
    marginBottom: 16,
  },
  educationCategoryContent: {
    paddingHorizontal: 18,
    paddingBottom: 3,
  },
  educationCategoryChip: {
    minHeight: 42,
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
  },
  educationCategoryChipActive: {
    borderColor: mobileTheme.colors.primaryDark,
    backgroundColor: mobileTheme.colors.primaryDark,
  },
  educationCategoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: mobileTheme.colors.textMuted,
  },
  educationCategoryChipTextActive: {
    color: '#ffffff',
  },

  educationArticleList: {
    marginBottom: 20,
  },
  educationArticleCard: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 11,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    ...mobileTheme.shadows.soft,
  },
  educationArticleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
    marginRight: 12,
  },
  educationArticleContent: {
    flex: 1,
    paddingRight: 8,
  },
  educationArticleTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 5,
  },
  educationArticleSummary: {
    fontSize: 12,
    lineHeight: 18,
    color: mobileTheme.colors.textMuted,
  },

  educationEmptyCard: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  educationEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  educationEmptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 7,
  },
  educationEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: mobileTheme.colors.textMuted,
  },
  educationResetButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
    borderRadius: mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor: mobileTheme.colors.primaryDark,
    backgroundColor: mobileTheme.colors.surface,
  },
  educationResetButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
  },

  educationSheetCard: {
    maxHeight: '88%',
    backgroundColor: mobileTheme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  educationSheetContent: {
    paddingBottom: 12,
  },
  educationSheetIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
    marginBottom: 16,
  },
  educationSheetCategory: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    color: mobileTheme.colors.secondaryDark,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  educationSheetTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    marginBottom: 12,
  },
  educationSheetSummary: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: mobileTheme.colors.textMuted,
  },
  educationSheetDivider: {
    height: 1,
    backgroundColor: mobileTheme.colors.border,
    marginVertical: 20,
  },
  educationSheetBody: {
    fontSize: 14,
    lineHeight: 23,
    color: mobileTheme.colors.text,
  },
  educationActionCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  educationActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  educationActionTitle: {
    marginLeft: 7,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  educationActionText: {
    fontSize: 13,
    lineHeight: 20,
    color: mobileTheme.colors.textMuted,
  },
  educationSheetDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    padding: 15,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.backgroundMuted,
  },
  educationSheetDisclaimerText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 12,
    lineHeight: 19,
    color: mobileTheme.colors.textMuted,
  },
});