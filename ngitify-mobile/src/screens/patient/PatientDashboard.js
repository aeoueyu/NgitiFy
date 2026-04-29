import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, RefreshControl, ActivityIndicator,
    StatusBar, TouchableHighlight,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { getVisitPrediction } from '../../utils/visitPrediction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
};

const formatTime = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${suffix}`;
};

const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
};

const getActivityIcon = (action = '') => {
    const a = action.toUpperCase();
    if (a.includes('LOGIN'))       return '🔑';
    if (a.includes('LOGOUT'))      return '🚪';
    if (a.includes('APPOINTMENT')) return '📅';
    if (a.includes('TREATMENT'))   return '🦷';
    if (a.includes('RADIOGRAPH'))  return '🩻';
    if (a.includes('PROFILE'))     return '👤';
    if (a.includes('PASSWORD'))    return '🔒';
    if (a.includes('TICKET'))      return '💬';
    return '📋';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickActionCard({ icon, label, color, onPress }) {
    return (
        <TouchableOpacity style={[styles.qaCard, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.75}>
            <Text style={styles.qaIcon}>{icon}</Text>
            <Text style={styles.qaLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

function SectionHeader({ title }) {
    return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PatientDashboard({ navigation }) {
    const { userToken, userId, userInfo, API_BASE_URL } = useContext(AuthContext);

    // ── Data state ──
    const [upcomingAppt,    setUpcomingAppt]    = useState(null);
    const [notifications,   setNotifications]   = useState([]);
    const [activityLogs,    setActivityLogs]    = useState([]);
    const [lastVisitDate,   setLastVisitDate]   = useState(null);
    const [visitPrediction, setVisitPrediction] = useState(null);

    // ── Loading / error state ──
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [apptError,   setApptError]   = useState(false);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // ─── Data fetching ────────────────────────────────────────────────────────

    const authHeader = { Authorization: `Bearer ${userToken}` };

    const fetchAll = useCallback(async () => {
        if (!userToken || !userId) return;

        try {
            const [apptRes, notifRes, logRes, treatRes] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/api/surgeries?patientId=${userId}`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/notifications`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/activity-logs/patient`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/my/treatment-logs`, { headers: authHeader }),
            ]);

            // ── Upcoming appointment ──
            if (apptRes.status === 'fulfilled' && apptRes.value.ok) {
                const appts = await apptRes.value.json();
                const active = (Array.isArray(appts) ? appts : [])
                    .filter(a => ['pending', 'confirmed', 'in-clinic'].includes(a.status))
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                setUpcomingAppt(active[0] || null);
                setApptError(false);
            } else {
                setApptError(true);
            }

            // ── Notifications ──
            if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
                const notifs = await notifRes.value.json();
                setNotifications(Array.isArray(notifs) ? notifs : []);
            }

            // ── Activity logs (show last 3) ──
            if (logRes.status === 'fulfilled' && logRes.value.ok) {
                const logs = await logRes.value.json();
                setActivityLogs((Array.isArray(logs) ? logs : []).slice(0, 3));
            }

            // ── Last visit → visit prediction ──
            if (treatRes.status === 'fulfilled' && treatRes.value.ok) {
                const logs = await treatRes.value.json();
                const latest = Array.isArray(logs) && logs.length > 0 ? logs[0] : null;
                if (latest?.date) {
                    setLastVisitDate(latest.date);
                    setVisitPrediction(getVisitPrediction(latest.date));
                }
            }

        } catch (err) {
            console.warn('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userToken, userId, API_BASE_URL]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAll();
    };

    // ─── Focus refresh (return from another screen) ───────────────────────────
    useEffect(() => {
        const unsub = navigation.addListener('focus', () => {
            fetchAll();
        });
        return unsub;
    }, [navigation, fetchAll]);

    // ─── Render helpers ───────────────────────────────────────────────────────

    const renderAppointmentCard = () => {
        if (apptError) {
            return (
                <View style={[styles.apptCard, styles.apptCardEmpty]}>
                    <Text style={styles.emptyIcon}>⚠️</Text>
                    <Text style={styles.emptyTitle}>Could not load appointment</Text>
                    <Text style={styles.emptySubtitle}>Check your connection and pull to refresh.</Text>
                </View>
            );
        }

        if (!upcomingAppt) {
            return (
                <TouchableOpacity
                    style={[styles.apptCard, styles.apptCardEmpty]}
                    onPress={() => navigation.navigate('AppointmentBooking')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.emptyIcon}>📅</Text>
                    <Text style={styles.emptyTitle}>No upcoming appointment</Text>
                    <Text style={styles.emptySubtitle}>Tap to book your next dental visit.</Text>
                    <View style={styles.bookBtn}>
                        <Text style={styles.bookBtnText}>Book Now</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        const statusColors = {
            pending:   { bg: '#fff3e0', text: '#e65100', dot: '#ff9800' },
            confirmed: { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' },
            'in-clinic': { bg: '#e3f2fd', text: '#01538b', dot: '#2196f3' },
        };
        const sc = statusColors[upcomingAppt.status] || statusColors.pending;
        const dentistName = upcomingAppt.dentist
            ? `Dr. ${upcomingAppt.dentist.name?.first || ''} ${upcomingAppt.dentist.name?.last || ''}`.trim()
            : 'To be assigned';

        return (
            <TouchableOpacity
                style={styles.apptCard}
                onPress={() => navigation.navigate('AppointmentBooking')}
                activeOpacity={0.85}
            >
                <View style={styles.apptCardTop}>
                    <View>
                        <Text style={styles.apptProcedure}>{upcomingAppt.procedure}</Text>
                        <Text style={styles.apptMeta}>{formatDate(upcomingAppt.date)}</Text>
                        {upcomingAppt.time ? (
                            <Text style={styles.apptMeta}>{formatTime(upcomingAppt.time)}</Text>
                        ) : null}
                        <Text style={styles.apptDentist}>{dentistName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                        <Text style={[styles.statusText, { color: sc.text }]}>
                            {upcomingAppt.status.charAt(0).toUpperCase() + upcomingAppt.status.slice(1)}
                        </Text>
                    </View>
                </View>
                <View style={styles.apptCardFooter}>
                    <Text style={styles.apptBranch}>📍 {upcomingAppt.branch || 'Dentime Dental Clinic'}</Text>
                    <Text style={styles.apptTapHint}>Tap to manage →</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderVisitBanner = () => {
        if (!visitPrediction) {
            return (
                <View style={[styles.visitBanner, { backgroundColor: '#f5f5f5' }]}>
                    <Text style={styles.visitBannerIcon}>🦷</Text>
                    <View style={styles.visitBannerText}>
                        <Text style={styles.visitBannerTitle}>No visit history yet</Text>
                        <Text style={styles.visitBannerSub}>Your visit prediction will appear after your first recorded treatment.</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.visitBanner, { backgroundColor: visitPrediction.bg }]}>
                <Text style={styles.visitBannerIcon}>
                    {visitPrediction.label === 'On Track' ? '✅' :
                     visitPrediction.label === 'Due Soon' ? '⚠️' : '🚨'}
                </Text>
                <View style={styles.visitBannerText}>
                    <Text style={[styles.visitBannerTitle, { color: visitPrediction.color }]}>
                        {visitPrediction.label}
                    </Text>
                    <Text style={styles.visitBannerSub}>
                        {visitPrediction.label === 'Overdue'
                            ? `You are ${visitPrediction.days} day(s) overdue for a check-up.`
                            : `Next recommended visit: ${visitPrediction.nextDate}`}
                    </Text>
                </View>
            </View>
        );
    };

    const renderActivityLog = () => {
        if (activityLogs.length === 0) {
            return (
                <View style={styles.emptyLogCard}>
                    <Text style={styles.emptyLogText}>No recent activity to show.</Text>
                </View>
            );
        }

        return activityLogs.map((log, idx) => (
            <View key={log._id || idx} style={styles.logRow}>
                <Text style={styles.logIcon}>{getActivityIcon(log.action)}</Text>
                <View style={styles.logContent}>
                    <Text style={styles.logAction} numberOfLines={1}>
                        {log.details || log.action || 'Activity recorded'}
                    </Text>
                    <Text style={styles.logTime}>{formatTimestamp(log.timestamp || log.createdAt)}</Text>
                </View>
            </View>
        ));
    };

    // ─── Full render ──────────────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#01538b" />
                <Text style={styles.loadingText}>Loading your dashboard…</Text>
            </View>
        );
    }

    const firstName = userInfo?.firstName || 'Patient';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#01538b" />

            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerGreeting}>Hello, {firstName} 👋</Text>
                    <Text style={styles.headerSub}>Welcome back to NgitiFy</Text>
                </View>
                <TouchableOpacity
                    style={styles.notifBtn}
                    onPress={() => navigation.navigate('Notifications')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.notifIcon}>🔔</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#01538b']}
                        tintColor="#01538b"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ── Upcoming Appointment ── */}
                <SectionHeader title="Upcoming Appointment" />
                {renderAppointmentCard()}

                {/* ── Predictive Visit Banner ── */}
                <SectionHeader title="Predictive Visit Window" />
                {renderVisitBanner()}

                {/* ── Quick Actions ── */}
                <SectionHeader title="Quick Actions" />
                <View style={styles.qaGrid}>
                    <QuickActionCard
                        icon="📅"
                        label="Book Appointment"
                        color="#01538b"
                        onPress={() => navigation.navigate('AppointmentBooking')}
                    />
                    <QuickActionCard
                        icon="🦷"
                        label="My EMR"
                        color="#00897b"
                        onPress={() => navigation.navigate('MedicalRecords')}
                    />
                    <QuickActionCard
                        icon="🤖"
                        label="AI Companion"
                        color="#7b1fa2"
                        onPress={() => navigation.navigate('AiPatientCareCompanion')}
                    />
                    <QuickActionCard
                        icon="⚙️"
                        label="Settings"
                        color="#e65100"
                        onPress={() => navigation.navigate('Settings')}
                    />
                </View>

                {/* ── Recent Activity ── */}
                <View style={styles.activitySection}>
                    <View style={styles.activityHeader}>
                        <SectionHeader title="Recent Activity" />
                        <TouchableOpacity onPress={() => navigation.navigate('ActivityLogs')}>
                            <Text style={styles.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.activityCard}>
                        {renderActivityLog()}
                    </View>
                </View>

                {/* ── Bottom padding for FAB ── */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ── FAB → AI Care Companion ── */}
            <TouchableHighlight
                style={styles.fab}
                onPress={() => navigation.navigate('AiPatientCareCompanion')}
                underlayColor="#014a7a"
            >
                <Text style={styles.fabLabel}>🤖 NgitiBot</Text>
            </TouchableHighlight>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container:        { flex: 1, backgroundColor: '#f3f7f9' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f7f9' },
    loadingText:      { marginTop: 12, color: '#888', fontSize: 14 },

    // Header
    header:       { backgroundColor: '#01538b', paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft:   { flex: 1 },
    headerGreeting: { fontSize: 22, fontWeight: 'bold', color: 'white' },
    headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    notifBtn:     { padding: 8, position: 'relative' },
    notifIcon:    { fontSize: 24 },
    badge:        { position: 'absolute', top: 4, right: 4, backgroundColor: '#e53935', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
    badgeText:    { color: 'white', fontSize: 9, fontWeight: 'bold' },

    // Scroll
    scroll:       { flex: 1 },
    scrollContent:{ paddingHorizontal: 16, paddingTop: 16 },

    // Section header
    sectionHeader: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

    // Appointment card
    apptCard:      { backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
    apptCardEmpty: { alignItems: 'center', paddingVertical: 28 },
    apptCardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    apptCardFooter:{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10, marginTop: 4 },
    apptProcedure: { fontSize: 17, fontWeight: 'bold', color: '#01538b', marginBottom: 4 },
    apptMeta:      { fontSize: 13, color: '#555', marginBottom: 2 },
    apptDentist:   { fontSize: 12, color: '#888', marginTop: 2 },
    apptBranch:    { fontSize: 12, color: '#888' },
    apptTapHint:   { fontSize: 12, color: '#01538b', fontWeight: '600' },

    statusBadge:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusDot:     { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusText:    { fontSize: 12, fontWeight: '700' },

    emptyIcon:     { fontSize: 36, marginBottom: 10 },
    emptyTitle:    { fontSize: 15, fontWeight: 'bold', color: '#555', marginBottom: 4 },
    emptySubtitle: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 16 },
    bookBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    bookBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Visit banner
    visitBanner:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 16 },
    visitBannerIcon: { fontSize: 28, marginRight: 12 },
    visitBannerText: { flex: 1 },
    visitBannerTitle:{ fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
    visitBannerSub:  { fontSize: 12, color: '#555', lineHeight: 16 },

    // Quick actions
    qaGrid:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
    qaCard:   { width: '48%', backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 10, alignItems: 'center', elevation: 2, borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
    qaIcon:   { fontSize: 28, marginBottom: 8 },
    qaLabel:  { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },

    // Activity
    activitySection: { marginBottom: 8 },
    activityHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seeAll:          { fontSize: 13, color: '#01538b', fontWeight: '600', marginBottom: 8 },
    activityCard:    { backgroundColor: 'white', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
    logRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    logIcon:         { fontSize: 20, marginRight: 12 },
    logContent:      { flex: 1 },
    logAction:       { fontSize: 13, color: '#333', fontWeight: '500', marginBottom: 2 },
    logTime:         { fontSize: 11, color: '#aaa' },
    emptyLogCard:    { padding: 20, alignItems: 'center' },
    emptyLogText:    { color: '#bbb', fontSize: 13 },

    // FAB
    fab:      { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#01538b', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
    fabLabel: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});