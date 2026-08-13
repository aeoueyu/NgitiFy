import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';
import {
  Screen,
  SurfaceCard,
  SectionLabel,
  PrimaryButton,
  SecondaryButton,
  StatusChip,
} from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';

const formatDate = (dateStr) => {
  if (!dateStr) return 'Not scheduled';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (time24) => {
  if (!time24) return 'Time to be assigned';
  const [hourText, minute] = time24.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return time24;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
};

const formatMonthDay = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
};

const toDateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildStaticPredictiveWindow = (prediction, previewData) => {
  const resolvedWindowStart = prediction?.windowStartKey || prediction?.windowStart
    ? parseDateKey(prediction?.windowStartKey) || new Date(prediction?.windowStart)
    : previewData?.windowStart;
  const resolvedWindowEnd = prediction?.windowEndKey || prediction?.windowEnd
    ? parseDateKey(prediction?.windowEndKey) || new Date(prediction?.windowEnd)
    : previewData?.windowEnd;
  const resolvedRecommendedDate = prediction?.recommendedDateKey || prediction?.recommendedDate
    ? parseDateKey(prediction?.recommendedDateKey)
      || (prediction?.recommendedDate ? new Date(prediction?.recommendedDate) : null)
    : previewData?.recommendedDate;

  const windowStart = resolvedWindowStart;
  const windowEnd = resolvedWindowEnd;
  const recommendedDate = resolvedRecommendedDate;
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) return null;

  const stripStart = new Date(windowStart);
  stripStart.setDate(stripStart.getDate() - 2);

  const stripEnd = new Date(windowEnd);
  stripEnd.setDate(stripEnd.getDate() + 2);

  const days = [];
  const cursor = new Date(stripStart);
  const recommendedKey = recommendedDate && !Number.isNaN(recommendedDate.getTime())
    ? toDateKey(recommendedDate)
    : '';

  while (cursor <= stripEnd) {
    const dayDate = new Date(cursor);
    const isoDate = toDateKey(dayDate);
    const inWindow = dayDate >= windowStart && dayDate <= windowEnd;

    days.push({
      key: dayDate.toISOString(),
      weekday: dayDate.toLocaleDateString('en-PH', { weekday: 'short' }).slice(0, 1),
      day: dayDate.getDate(),
      inWindow,
      isRecommended: isoDate === recommendedKey,
      isoDate,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    label: prediction?.label || previewData?.hero?.statusLabel || 'Preview',
    rangeText: prediction?.windowLabel || previewData?.hero?.windowLabel || `${formatMonthDay(windowStart)} - ${formatMonthDay(windowEnd)}`,
    detail: prediction?.recommendationReason
      || previewData?.hero?.whyThisShowing
      || 'Based on your recorded treatment history and recommended oral care follow-up.',
    color: prediction?.color || mobileTheme.colors.secondaryDark,
    bg: prediction?.bg || mobileTheme.colors.secondarySoft,
    days,
    windowStart,
    windowEnd,
    selectedDate: prediction?.recommendedDateKey || recommendedKey || toDateKey(windowStart),
    badgeText: previewData?.isPreviewOnly ? 'Preview' : 'Care',
  };
};

const getAppointmentDentistLabel = (appointment) => {
  if (appointment?.dentist) {
    return `Dr. ${appointment.dentist.name?.first || ''} ${appointment.dentist.name?.last || ''}`.trim();
  }
  if (appointment?.dentistName) return appointment.dentistName;
  return 'To be assigned';
};

function QuickAction({ icon, lib = 'Ionicons', label, sublabel, onPress, tone = 'primary' }) {
  const IconComponent = lib === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
  const palette = {
    primary: { bg: mobileTheme.colors.primarySoft, fg: mobileTheme.colors.primaryDark },
    secondary: { bg: mobileTheme.colors.secondarySoft, fg: mobileTheme.colors.secondaryDark },
  }[tone];

  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.84}>
      <View style={[styles.quickActionIcon, { backgroundColor: palette.bg }]}>
        <IconComponent name={icon} size={22} color={palette.fg} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Text style={styles.quickActionSub}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

function navigateWithinPatientShell(navigation, target) {
  if (target === 'MyProfile' || target === 'MyProfileHome') {
    navigation.navigate('MyProfile', { screen: 'MyProfileHome' });
    return;
  }

  if (['Settings', 'EditProfile', 'ActivityLogs'].includes(target)) {
    navigation.navigate('MyProfile', { screen: target });
    return;
  }

  navigation.navigate(target);
}

function ProfileSheet({ visible, onClose, navigation, userInfo, logout }) {
  const [logoutVisible, setLogoutVisible] = useState(false);
  const initials = useMemo(() => {
    return [userInfo?.firstName?.[0], userInfo?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'P';
  }, [userInfo]);

  const menuItems = [
    { label: 'My Profile', icon: 'person-outline', target: 'MyProfile' },
    { label: 'Edit Profile', icon: 'create-outline', target: 'EditProfile' },
    { label: 'My Appointments', icon: 'calendar-outline', target: 'MyAppointments' },
    { label: 'Medical Records', icon: 'medkit-outline', target: 'MedicalRecords' },
    { label: 'Notifications', icon: 'notifications-outline', target: 'Notifications' },
    { label: 'Settings', icon: 'settings-outline', target: 'Settings' },
    { label: 'Activity Logs', icon: 'document-text-outline', target: 'ActivityLogs' },
  ];

  const handlePress = (target) => {
    onClose();
    setTimeout(() => navigateWithinPatientShell(navigation, target), 120);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheetCard}>
                <View style={styles.sheetProfileRow}>
                  {userInfo?.profileImage ? (
                    <Image source={{ uri: userInfo.profileImage }} style={styles.sheetAvatarImage} />
                  ) : (
                    <View style={styles.sheetAvatarFallback}>
                      <Text style={styles.sheetAvatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{userInfo?.fullName || `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || 'Patient'}</Text>
                    <Text style={styles.sheetEmail}>{userInfo?.email || ''}</Text>
                  </View>
                </View>

                {menuItems.map((item) => (
                  <TouchableOpacity
                    key={item.target}
                    style={styles.sheetMenuItem}
                    onPress={() => handlePress(item.target)}
                    activeOpacity={0.82}
                  >
                    <View style={styles.sheetMenuIcon}>
                      <Ionicons name={item.icon} size={18} color={mobileTheme.colors.text} />
                    </View>
                    <Text style={styles.sheetMenuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={mobileTheme.colors.textSoft} />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.logoutRow}
                  onPress={() => {
                    onClose();
                    setTimeout(() => setLogoutVisible(true), 140);
                  }}
                  activeOpacity={0.82}
                >
                  <View style={[styles.sheetMenuIcon, { backgroundColor: mobileTheme.colors.dangerSoft }]}>
                    <Ionicons name="log-out-outline" size={18} color={mobileTheme.colors.danger} />
                  </View>
                  <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <LogoutModal
        visible={logoutVisible}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={logout}
      />
    </>
  );
}

export default function PatientDashboard({ navigation }) {
  const { userToken, userId, userInfo, API_BASE_URL, logout } = useContext(AuthContext);

  const [upcomingAppt, setUpcomingAppt] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [visitPrediction, setVisitPrediction] = useState(null);
  const [oralHealth, setOralHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apptError, setApptError] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const fetchAll = useCallback(async () => {
    if (!userToken || !userId) return;

    try {
      const authHeader = { Authorization: `Bearer ${userToken}` };
      const [apptRes, notifRes, predictionRes, oralHealthRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/appointments?patientId=${userId}`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/api/notifications`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/api/my/visit-prediction`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/api/my/oral-health`, { headers: authHeader }),
      ]);

      if (apptRes.status === 'fulfilled' && apptRes.value.ok) {
        const appts = await apptRes.value.json();
        const list = Array.isArray(appts) ? appts : [];
        const active = list
          .filter((appointment) => ['pending', 'confirmed', 'in-clinic'].includes(appointment.status))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setUpcomingAppt(active[0] || null);
        setApptError(false);
      } else {
        setApptError(true);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const data = await notifRes.value.json();
        setNotifications(Array.isArray(data) ? data : []);
      }

      if (predictionRes.status === 'fulfilled' && predictionRes.value.ok) {
        const data = await predictionRes.value.json();
        setVisitPrediction(data?.prediction || null);
      }

      if (oralHealthRes.status === 'fulfilled' && oralHealthRes.value.ok) {
        const data = await oralHealthRes.value.json();
        setOralHealth(data || null);
      }
    } catch (error) {
      console.warn('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE_URL, userId, userToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchAll);
    return unsubscribe;
  }, [fetchAll, navigation]);

  useEffect(() => {
    const intervalId = setInterval(fetchAll, 30000);
    return () => clearInterval(intervalId);
  }, [fetchAll]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  if (loading) {
    return (
      <Screen style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={mobileTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </Screen>
    );
  }

  const firstName = userInfo?.firstName || 'Patient';
  const initials = [userInfo?.firstName?.[0], userInfo?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'P';
  const dentistName = getAppointmentDentistLabel(upcomingAppt);
  const oralCarePreview = getStaticOralCarePreview(visitPrediction, oralHealth);
  const predictiveWindow = buildStaticPredictiveWindow(visitPrediction, oralCarePreview);

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[mobileTheme.colors.primaryDark]}
              tintColor={mobileTheme.colors.primaryDark}
            />
          }
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.heroGreeting}>Hello,</Text>
                <Text style={styles.heroName}>{firstName}!</Text>
              </View>

              <View style={styles.headerActionsPill}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={() => navigation.navigate('Notifications')}
                  activeOpacity={0.84}
                >
                  <Ionicons name="notifications-outline" size={22} color={mobileTheme.colors.primaryDark} />
                  {unreadCount > 0 ? (
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.profileChip}
                  onPress={() => setProfileMenuVisible(true)}
                  activeOpacity={0.85}
                >
                  {userInfo?.profileImage ? (
                    <Image source={{ uri: userInfo.profileImage }} style={styles.profileTriggerImage} />
                  ) : (
                    <View style={styles.profileTriggerFallback}>
                      <Text style={styles.profileTriggerText}>{initials}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <SectionLabel title="Next Visit" style={styles.sectionHeading} />
          <SurfaceCard style={styles.appointmentCard}>
            <View style={styles.appointmentGlowTop} />
            <View style={styles.appointmentGlowBottom} />
            {apptError ? (
            <View style={styles.centerState}>
                <Ionicons name="warning-outline" size={30} color="#ffffff" />
                <Text style={styles.stateTitle}>Could not load appointment</Text>
                <Text style={styles.stateText}>Pull to refresh and try again.</Text>
              </View>
            ) : upcomingAppt ? (
              <>
                <View style={styles.appointmentTopRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.appointmentDoctor}>{dentistName}</Text>
                    <Text style={styles.appointmentTitle}>{upcomingAppt.procedure}</Text>
                    <StatusChip
                      status={upcomingAppt.status}
                      label={upcomingAppt.status === 'in-clinic' ? 'In Clinic' : upcomingAppt.status}
                      style={styles.appointmentStatus}
                    />
                  </View>
                  <View style={styles.calendarBadge}>
                    <Ionicons name="calendar-outline" size={20} color="#ffffff" />
                  </View>
                </View>

                <Text style={styles.appointmentDateText}>{formatDate(upcomingAppt.date)}</Text>

                <View style={styles.metricRow}>
                  <View style={styles.metricPill}>
                    <Ionicons name="time-outline" size={14} color="#ffffff" />
                    <Text style={styles.metricPillText}>{formatTime(upcomingAppt.time)}</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Ionicons name="business-outline" size={14} color="#ffffff" />
                    <Text style={styles.metricPillText}>{upcomingAppt.branch || 'Dentime Dental Clinic'}</Text>
                  </View>
                </View>

                <View style={styles.appointmentActions}>
                  <SecondaryButton
                    label="View visits"
                    onPress={() => navigation.navigate('MyAppointments')}
                    icon="calendar-outline"
                    style={styles.appointmentSecondaryButton}
                  />
                  <PrimaryButton
                    label="Book now"
                    onPress={() => navigation.navigate('AppointmentBooking')}
                    icon="add-outline"
                    style={styles.appointmentPrimaryButton}
                    textStyle={styles.emptyAppointmentButtonText}
                    iconColor={mobileTheme.colors.primaryDark}
                  />
                </View>
              </>
            ) : (
              <View style={styles.centerState}>
                <Ionicons name="calendar-clear-outline" size={34} color="#ffffff" />
                <Text style={styles.stateTitle}>No upcoming appointment</Text>
                <Text style={styles.stateText}>Plan your next check-up whenever you are ready.</Text>
                <PrimaryButton
                  label="Book Appointment"
                  onPress={() => navigation.navigate('AppointmentBooking')}
                  icon="calendar-outline"
                  style={styles.emptyAppointmentButton}
                  textStyle={styles.emptyAppointmentButtonText}
                  iconColor={mobileTheme.colors.primaryDark}
                />
              </View>
            )}
          </SurfaceCard>

          <SectionLabel title="Oral Health Management" style={styles.sectionHeading} />
          <SurfaceCard style={styles.predictiveSectionCard}>
            {predictiveWindow ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() =>
                  navigation.navigate('OralCareInsights', {
                    visitPrediction,
                    oralHealth,
                  })
                }
              >
                <View style={styles.predictiveSectionTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.predictiveSectionEyebrow}>Recommended Visit Window</Text>
                    <Text style={styles.predictiveSectionTitle}>{predictiveWindow.rangeText}</Text>
                  </View>
                  <View style={styles.predictiveSectionBadge}>
                    <Ionicons name="sparkles-outline" size={13} color={mobileTheme.colors.primaryDark} />
                    <Text style={styles.predictiveSectionBadgeText}>{predictiveWindow.badgeText}</Text>
                  </View>
                </View>

                <Text style={styles.predictiveSectionText}>{predictiveWindow.detail}</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.predictiveStrip}
                >
                  {predictiveWindow.days.map((day) => (
                    <TouchableOpacity
                      key={day.key}
                      activeOpacity={0.84}
                      style={[styles.predictiveMiniCard, day.inWindow && styles.predictiveMiniCardActive]}
                      onPress={() => navigation.navigate('OralCareInsights', { visitPrediction, oralHealth })}
                    >
                      <Text style={[styles.predictiveMiniWeek, day.inWindow && styles.predictiveMiniWeekActive]}>
                        {day.weekday}
                      </Text>
                      <Text style={[styles.predictiveMiniNumber, day.inWindow && styles.predictiveMiniNumberActive]}>
                        {day.day}
                      </Text>
                      <Text style={[styles.predictiveMiniHint, day.inWindow && styles.predictiveMiniHintActive]}>
                        {day.isRecommended ? 'Ideal' : day.inWindow ? 'Window' : 'Near'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.predictiveOpenRow}>
                  <Text style={styles.predictiveOpenText}>Open care window, factors, and quick logs</Text>
                  <Ionicons name="chevron-forward" size={16} color={mobileTheme.colors.primaryDark} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.predictiveEmptyState}>
                <Ionicons name="sparkles-outline" size={26} color={mobileTheme.colors.secondaryDark} />
                <Text style={styles.predictiveEmptyTitle}>No prediction yet</Text>
                <Text style={styles.predictiveEmptyText}>
                  Once a treatment is recorded in the clinic, this calendar will highlight your next ideal visit window.
                </Text>
              </View>
            )}
          </SurfaceCard>

          <SectionLabel title="Care Tools" style={styles.sectionHeading} />
          <View style={styles.quickRail}>
            <QuickAction
              icon="calendar-outline"
              label="Appointments"
              sublabel="Book and review visits"
              onPress={() => navigation.navigate('MyAppointments')}
              tone="primary"
            />
            <QuickAction
              icon="medkit-outline"
              label="Medical Records"
              sublabel="View your EMR"
              onPress={() => navigation.navigate('MedicalRecords')}
              tone="secondary"
            />
            <QuickAction
              icon="sparkles-outline"
              label="AI Companion"
              sublabel="Ask care questions"
              onPress={() => navigation.navigate('AiPatientCareCompanion')}
              tone="primary"
            />
            <QuickAction
              icon="sparkles-outline"
              label="Oral Health Management"
              sublabel="Today, trends, and visit window"
              onPress={() => navigation.navigate('OralCareInsights', { visitPrediction, oralHealth })}
              tone="secondary"
            />
            <QuickAction
              icon="settings-outline"
              label="Settings"
              sublabel="Account and privacy"
              onPress={() => navigateWithinPatientShell(navigation, 'Settings')}
              tone="secondary"
            />
          </View>
        </ScrollView>

      </SafeAreaView>

      <ProfileSheet
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
        navigation={navigation}
        userInfo={userInfo}
        logout={logout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: mobileTheme.colors.textMuted,
  },
  content: {
    padding: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 18 : 18,
    paddingBottom: 152,
  },
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  headerActionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5f2f8',
    ...mobileTheme.shadows.soft,
  },
  heroGreeting: {
    fontSize: 23,
    color: '#415668',
    marginBottom: 4,
  },
  heroName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#223746',
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf8',
    marginRight: 8,
  },
  profileTriggerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  profileTriggerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  profileTriggerText: {
    fontSize: 16,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  heroBadge: {
    position: 'absolute',
    top: 5,
    right: 4,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.secondary,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  sectionHeading: {
    marginBottom: 14,
  },
  appointmentCard: {
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: mobileTheme.colors.primary,
    borderColor: '#0e72b1',
    padding: 20,
  },
  appointmentGlowTop: {
    position: 'absolute',
    top: -34,
    right: -14,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(45, 204, 246, 0.24)',
  },
  appointmentGlowBottom: {
    position: 'absolute',
    bottom: -28,
    left: -16,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  appointmentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  appointmentDoctor: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  appointmentTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    marginBottom: 12,
  },
  appointmentStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  calendarBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  metricPillText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  predictiveSectionCard: {
    marginBottom: 18,
    padding: 18,
  },
  predictiveSectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  predictiveSectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: mobileTheme.colors.secondaryDark,
    marginBottom: 4,
  },
  predictiveSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: mobileTheme.colors.text,
  },
  predictiveSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  predictiveSectionBadgeText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
  },
  predictiveSectionText: {
    fontSize: 13,
    lineHeight: 18,
    color: mobileTheme.colors.textMuted,
    marginBottom: 14,
  },
  predictiveStrip: {
    marginBottom: 14,
    paddingRight: 4,
  },
  predictiveMiniCard: {
    width: 78,
    borderRadius: 18,
    backgroundColor: '#eef8fd',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8edf8',
    marginRight: 10,
  },
  predictiveMiniCardActive: {
    backgroundColor: mobileTheme.colors.primaryDark,
    borderColor: mobileTheme.colors.primaryDark,
  },
  predictiveMiniWeek: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7a92a3',
    marginBottom: 4,
  },
  predictiveMiniWeekActive: {
    color: '#ffffff',
  },
  predictiveMiniNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDark,
  },
  predictiveMiniNumberActive: {
    color: '#ffffff',
  },
  predictiveMiniHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6f8593',
    marginTop: 4,
  },
  predictiveMiniHintActive: {
    color: '#d9f7ff',
  },
  predictiveOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5fbff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d8edf8',
  },
  predictiveOpenText: {
    fontSize: 13,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  predictiveEmptyState: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    backgroundColor: '#f5fbff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8edf8',
  },
  predictiveEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
    marginTop: 10,
    marginBottom: 6,
  },
  predictiveEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.textMuted,
    textAlign: 'center',
  },
  appointmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appointmentSecondaryButton: {
    flex: 1,
    marginRight: 10,
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  appointmentPrimaryButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#ffffff',
  },
  emptyAppointmentButton: {
    marginTop: 16,
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
  },
  emptyAppointmentButtonText: {
    color: mobileTheme.colors.primaryDark,
  },
  centerState: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 6,
  },
  stateText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.84)',
    textAlign: 'center',
  },
  quickRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 18,
  },
  quickAction: {
    width: '48%',
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#dfeef6',
    marginBottom: 12,
    minHeight: 146,
    ...mobileTheme.shadows.soft,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334655',
    marginBottom: 6,
  },
  quickActionSub: {
    fontSize: 11,
    lineHeight: 16,
    color: '#7a8c98',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: mobileTheme.colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 86,
    paddingRight: 18,
  },
  sheetCard: {
    width: 290,
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileTheme.shadows.card,
  },
  sheetProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  sheetAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.primarySoft,
  },
  sheetAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: mobileTheme.colors.primaryDark,
  },
  sheetName: {
    fontSize: 16,
    fontWeight: '700',
    color: mobileTheme.colors.text,
    marginBottom: 4,
  },
  sheetEmail: {
    fontSize: 12,
    color: mobileTheme.colors.textMuted,
  },
  sheetMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingVertical: 8,
  },
  sheetMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.surfaceAlt,
    marginRight: 12,
  },
  sheetMenuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: mobileTheme.colors.text,
  },
  logoutRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: mobileTheme.colors.danger,
  },
});
