import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Animated, ActivityIndicator, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getVisitPrediction } from '../../utils/visitPrediction';
import LogoutModal from '../../components/LogoutModal';

import ProfileIcon        from '../../assets/icons/MyProfile.svg';
import MedicalRecordsIcon from '../../assets/icons/MedicalRecords.svg';
import CalendarIcon       from '../../assets/icons/Calendar.svg';
import TimeIcon           from '../../assets/icons/Time.svg';
import DentistIcon        from '../../assets/icons/Dentist.svg';
import ChatBotIcon        from '../../assets/icons/ChatBot.svg';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN',
                    'JUL','AUG','SEP','OCT','NOV','DEC'];

const formatSurgeryDate = (iso) => {
    const d = new Date(iso);
    return { month: MONTH_ABBR[d.getMonth()], day: d.getDate() };
};

const ACTIVE_STATUSES   = ['pending', 'confirmed', 'in-clinic'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDashboard({ navigation }) {
    const { logout, userInfo, userToken, userId, API_BASE_URL } = useContext(AuthContext);

    const [isLogoutVisible, setIsLogoutVisible] = useState(false);
    const [surgeries,       setSurgeries]       = useState([]);
    const [loadingSurgery,  setLoadingSurgery]  = useState(true);
    const [unreadCount,     setUnreadCount]     = useState(0);
    const [refreshing,      setRefreshing]      = useState(false);

    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // ─── Entrance animation ───────────────────────────────────────────────────
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    // ─── Data fetch ───────────────────────────────────────────────────────────
    const fetchDashboardData = useCallback(async () => {
        if (!userToken || !userId) return;
        try {
            const headers = { Authorization: `Bearer ${userToken}` };

            const [surgeriesRes, notifRes] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/api/surgeries?patientId=${userId}`, { headers }),
                fetch(`${API_BASE_URL}/api/notifications`,                 { headers }),
            ]);

            // Surgeries
            if (surgeriesRes.status === 'fulfilled' && surgeriesRes.value.ok) {
                const data = await surgeriesRes.value.json();
                setSurgeries(Array.isArray(data) ? data : []);
            }

            // Notifications — unread badge
            if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
                const notifs = await notifRes.value.json();
                const unread = Array.isArray(notifs)
                    ? notifs.filter(n => !n.isRead).length
                    : 0;
                setUnreadCount(unread);
            }
        } catch (err) {
            console.warn('Dashboard fetch error:', err);
        } finally {
            setLoadingSurgery(false);
            setRefreshing(false);
        }
    }, [userToken, userId, API_BASE_URL]);

    // Fetch on first mount
    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    // Re-fetch every time the screen comes into focus (e.g. returning from booking)
    useFocusEffect(
        useCallback(() => {
            setLoadingSurgery(true);
            fetchDashboardData();
        }, [fetchDashboardData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    // ─── Derived data ─────────────────────────────────────────────────────────

    // Upcoming = not completed / cancelled, sorted soonest first
    const upcomingSurgery = surgeries
        .filter(s => ACTIVE_STATUSES.includes(s.status))
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;

    // Last completed visit → for visit prediction
    const lastCompleted = surgeries
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

    const visitInfo = getVisitPrediction(lastCompleted?.date || null);

    const displayName = userInfo?.firstName || userInfo?.fullName?.split(' ')[0] || 'Patient';

    // ─── Sub-renders ──────────────────────────────────────────────────────────

    const renderSurgeryCard = () => {
        if (loadingSurgery) {
            return (
                <View style={[styles.apptCard, styles.apptCardSkeleton]}>
                    <ActivityIndicator color="#01538b" size="small" />
                    <Text style={styles.skeletonText}>Loading your appointments…</Text>
                </View>
            );
        }

        if (!upcomingSurgery) {
            return (
                <View style={[styles.apptCard, styles.apptCardEmpty]}>
                    <Text style={styles.emptyEmoji}>🦷</Text>
                    <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
                    <Text style={styles.emptySubText}>
                        Book a visit below and we'll show your schedule here.
                    </Text>
                </View>
            );
        }

        const { month, day } = formatSurgeryDate(upcomingSurgery.date);
        const dentistName    = upcomingSurgery.dentist?.name
            ? `${upcomingSurgery.dentist.name.first || ''} ${upcomingSurgery.dentist.name.last || ''}`.trim()
            : 'To be assigned';
        const hasPreOp       = !!upcomingSurgery.preOpInstructions;
        const statusColor    = upcomingSurgery.status === 'confirmed' ? '#2e7d32'
                             : upcomingSurgery.status === 'in-clinic' ? '#1565c0'
                             : '#e65100'; // pending

        return (
            <TouchableOpacity
                style={styles.apptCard}
                activeOpacity={0.8}
                onPress={() => hasPreOp && navigation.navigate('PreOpInstructions', { surgery: upcomingSurgery })}
            >
                <View style={styles.apptHeader}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateMonth}>{month}</Text>
                        <Text style={styles.dateDay}>{day}</Text>
                    </View>

                    <View style={styles.apptDetails}>
                        <View style={styles.statusPill}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusLabel, { color: statusColor }]}>
                                {upcomingSurgery.status.charAt(0).toUpperCase() + upcomingSurgery.status.slice(1)}
                            </Text>
                        </View>

                        <Text style={styles.procedureText}>{upcomingSurgery.procedure}</Text>

                        {upcomingSurgery.time ? (
                            <View style={styles.iconRow}>
                                <TimeIcon width={12} height={12} style={{ color: '#888', marginRight: 5 }} />
                                <Text style={styles.timeText}>{upcomingSurgery.time}</Text>
                            </View>
                        ) : null}

                        <View style={styles.iconRow}>
                            <DentistIcon width={12} height={12} style={{ color: '#888', marginRight: 5 }} />
                            <Text style={styles.dentistText}>Dr. {dentistName}</Text>
                        </View>

                        {upcomingSurgery.branch ? (
                            <Text style={styles.branchText}>📍 {upcomingSurgery.branch}</Text>
                        ) : null}

                        {hasPreOp && (
                            <Text style={styles.viewPreOpText}>Tap to view Pre-Op Instructions →</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderVisitPrediction = () => {
        if (!visitInfo) return null; // No completed visits yet — hide the card entirely

        return (
            <View style={[styles.visitCard, { backgroundColor: visitInfo.bg }]}>
                <View style={styles.visitLeft}>
                    <Text style={[styles.visitLabel, { color: visitInfo.color }]}>
                        {visitInfo.label}
                    </Text>
                    <Text style={styles.visitNextDate}>
                        Next checkup: {visitInfo.nextDate}
                    </Text>
                </View>
                <View style={[styles.visitBadge, { backgroundColor: visitInfo.color }]}>
                    <Text style={styles.visitBadgeDays}>{visitInfo.days}</Text>
                    <Text style={styles.visitBadgeLabel}>days</Text>
                </View>
            </View>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
                    <Text style={styles.role}>Patient</Text>
                </View>
                <TouchableOpacity onPress={() => setIsLogoutVisible(true)} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#01538b" />
                    }
                >
                    {/* ── Upcoming Surgery ── */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
                        {upcomingSurgery && (
                            <Text style={styles.infoBadge}>
                                {upcomingSurgery.status === 'confirmed' ? 'Confirmed ✓'
                                 : upcomingSurgery.status === 'in-clinic' ? 'In Clinic'
                                 : 'Pending'}
                            </Text>
                        )}
                    </View>

                    {renderSurgeryCard()}

                    {/* ── Visit Prediction ── */}
                    {renderVisitPrediction()}

                    {/* ── Book Appointment ── */}
                    <Text style={styles.sectionTitle}>Appointments</Text>
                    <TouchableOpacity
                        style={[styles.actionCard, styles.bookingCard]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('AppointmentBooking')}
                    >
                        <CalendarIcon width={35} height={35} style={{ marginRight: 15 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { textAlign: 'left', color: 'white' }]}>
                                Book an Appointment
                            </Text>
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                                Schedule a visit with your dentist.
                            </Text>
                        </View>
                        <Text style={styles.bookingArrow}>→</Text>
                    </TouchableOpacity>

                    {/* ── My Records ── */}
                    <Text style={[styles.sectionTitle, { marginTop: 5 }]}>My Records</Text>
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('MyProfile')}
                        >
                            <ProfileIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>My Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('MedicalRecords')}
                        >
                            <MedicalRecordsIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>My EMR</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </Animated.View>

            <LogoutModal
                visible={isLogoutVisible}
                onCancel={() => setIsLogoutVisible(false)}
                onConfirm={logout}
            />

            {/* FAB → AI Patient Care Companion */}
            <TouchableOpacity
                style={styles.fabChat}
                onPress={() => navigation.navigate('AiPatientCareCompanion')}
                activeOpacity={0.8}
            >
                <ChatBotIcon width={30} height={30} style={{ color: 'white' }} />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container:     { flex: 1, backgroundColor: '#f3f7f9' },
    header:        {
        backgroundColor: '#01538b', padding: 25, paddingTop: 60,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 5, zIndex: 10,
    },
    greeting:      { color: 'white', fontSize: 22, fontWeight: 'bold' },
    role:          { color: '#b3ccd1', fontSize: 13, fontWeight: '600', marginTop: 2 },
    logoutBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
    logoutText:    { color: 'white', fontWeight: 'bold', fontSize: 12 },
    content:       { padding: 20 },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
    sectionTitle:     { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 12, marginTop: 10 },
    infoBadge:        { backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

    // Surgery card
    apptCard:       {
        backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15,
        elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b',
    },
    apptCardSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftColor: '#ccc' },
    apptCardEmpty:    { alignItems: 'center', borderLeftColor: '#e0e0e0', paddingVertical: 30 },
    skeletonText:     { color: '#999', fontSize: 13 },
    emptyEmoji:       { fontSize: 36, marginBottom: 8 },
    emptyTitle:       { fontSize: 15, fontWeight: 'bold', color: '#555', marginBottom: 6 },
    emptySubText:     { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18 },

    apptHeader:    { flexDirection: 'row', alignItems: 'flex-start' },
    dateBox:       { backgroundColor: '#f3f7f9', padding: 10, borderRadius: 10, alignItems: 'center', width: 60, marginRight: 15 },
    dateMonth:     { fontSize: 12, fontWeight: 'bold', color: '#01538b' },
    dateDay:       { fontSize: 22, fontWeight: 'bold', color: '#01538b' },
    apptDetails:   { flex: 1 },

    statusPill:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    statusDot:     { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
    statusLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

    procedureText: { fontSize: 15, fontWeight: 'bold', color: '#01538b', marginBottom: 6 },
    iconRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    timeText:      { fontSize: 12, color: '#555', fontWeight: '600' },
    dentistText:   { fontSize: 12, color: '#888' },
    branchText:    { fontSize: 11, color: '#aaa', marginTop: 2 },
    viewPreOpText: { fontSize: 11, color: '#01538b', fontWeight: 'bold', marginTop: 8 },

    // Visit prediction card
    visitCard:     {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderRadius: 14, marginBottom: 20, elevation: 1,
    },
    visitLeft:     { flex: 1 },
    visitLabel:    { fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
    visitNextDate: { fontSize: 11, color: '#666' },
    visitBadge:    { alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 28 },
    visitBadgeDays:{ fontSize: 18, fontWeight: 'bold', color: 'white' },
    visitBadgeLabel:{ fontSize: 10, color: 'white', fontWeight: '600' },

    // Booking card
    bookingCard:   { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#01538b', elevation: 4, marginBottom: 20 },
    bookingArrow:  { color: 'white', fontSize: 22, fontWeight: 'bold' },

    // Record cards
    row:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    actionCard:    { width: '48%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center' },
    iconMargin:    { marginBottom: 10 },
    cardTitle:     { fontSize: 15, fontWeight: 'bold', color: '#444', textAlign: 'center' },

    // FAB
    fabChat: {
        position: 'absolute', bottom: 30, right: 25,
        backgroundColor: '#01538b', width: 65, height: 65,
        borderRadius: 35, justifyContent: 'center', alignItems: 'center',
        elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 5,
    },
    badge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: '#d32f2f', minWidth: 20, height: 20,
        borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 4, borderWidth: 2, borderColor: 'white',
    },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
});