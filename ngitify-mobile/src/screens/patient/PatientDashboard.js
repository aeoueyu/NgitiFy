import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, RefreshControl, ActivityIndicator,
    StatusBar, TouchableHighlight, Modal, Animated,
    TouchableWithoutFeedback, Image,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { getVisitPrediction } from '../../utils/visitPrediction';
import LogoutModal from '../../components/LogoutModal';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickActionCard({ iconComponent, label, color, onPress }) {
    return (
        <TouchableOpacity style={[styles.qaCard, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.75}>
            <View style={{ marginBottom: 8 }}>{iconComponent}</View>
            <Text style={styles.qaLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

function SectionHeader({ title }) {
    return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Profile Menu Sheet ───────────────────────────────────────────────────────

function ProfileMenuSheet({ visible, onClose, navigation, userInfo, logout }) {
    const [logoutVisible, setLogoutVisible] = useState(false);

    const initials = [userInfo?.firstName?.[0], userInfo?.lastName?.[0]]
        .filter(Boolean).join('').toUpperCase() || '?';
    const fullName = userInfo?.fullName || userInfo?.firstName || 'Patient';
    const email    = userInfo?.email || '';

    const menuItems = [
        { iconName: 'person-outline',        lib: 'Ionicons',               label: 'My Profile',      screen: 'MyProfile' },
        { iconName: 'create-outline',        lib: 'Ionicons',               label: 'Edit Profile',    screen: 'EditProfile' },
        { iconName: 'settings-outline',      lib: 'Ionicons',               label: 'Settings',        screen: 'Settings' },
        { iconName: 'document-text-outline', lib: 'Ionicons',               label: 'Activity Logs',   screen: 'ActivityLogs' },
        { iconName: 'notifications-outline', lib: 'Ionicons',               label: 'Notifications',   screen: 'Notifications' },
        { iconName: 'calendar-outline',      lib: 'Ionicons',               label: 'My Appointments', screen: 'AppointmentBooking' },
        { iconName: 'tooth-outline',         lib: 'MaterialCommunityIcons', label: 'My EMR',          screen: 'MedicalRecords' },
    ];

    const handleNav = (screen) => {
        onClose();
        setTimeout(() => navigation.navigate(screen), 150);
    };

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={sheet.overlay}>
                        <TouchableWithoutFeedback>
                            <View style={sheet.container}>

                                {/* Profile summary */}
                                <View style={sheet.profileRow}>
                                    {userInfo?.profileImage ? (
                                        <Image
                                            source={{ uri: userInfo.profileImage }}
                                            style={sheet.avatar}
                                        />
                                    ) : (
                                        <View style={sheet.avatar}>
                                            <Text style={sheet.avatarText}>{initials}</Text>
                                        </View>
                                    )}
                                    <View style={sheet.profileInfo}>
                                        <Text style={sheet.name} numberOfLines={1}>{fullName}</Text>
                                        <Text style={sheet.email} numberOfLines={1}>{email}</Text>
                                    </View>
                                </View>

                                <View style={sheet.divider} />

                                {/* Menu items */}
                                {menuItems.map((item) => {
                                    const IconComp = item.lib === 'MaterialCommunityIcons'
                                        ? MaterialCommunityIcons
                                        : Ionicons;
                                    return (
                                        <TouchableOpacity
                                            key={item.screen}
                                            style={sheet.menuItem}
                                            onPress={() => handleNav(item.screen)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={sheet.menuIcon}>
                                                <IconComp name={item.iconName} size={18} color="#555" />
                                            </View>
                                            <Text style={sheet.menuLabel}>{item.label}</Text>
                                            {/* ← was: <Text style={sheet.menuArrow}>›</Text> */}
                                            <Ionicons name="chevron-forward" size={16} color="#ccc" />
                                        </TouchableOpacity>
                                    );
                                })}

                                <View style={sheet.divider} />

                                {/* Logout */}
                                <TouchableOpacity
                                    style={sheet.logoutItem}
                                    onPress={() => {
                                        onClose();
                                        setTimeout(() => setLogoutVisible(true), 200);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={sheet.menuIcon}>
                                        <Ionicons name="log-out-outline" size={18} color="#d32f2f" />
                                    </View>
                                    <Text style={sheet.logoutLabel}>Log Out</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PatientDashboard({ navigation }) {
    const { userToken, userId, userInfo, API_BASE_URL, logout } = useContext(AuthContext);

    // ── Data state ──
    const [upcomingAppt,    setUpcomingAppt]    = useState(null);
    const [notifications,   setNotifications]   = useState([]);
    const [lastVisitDate,   setLastVisitDate]   = useState(null);
    const [visitPrediction, setVisitPrediction] = useState(null);

    // ── Loading / error state ──
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [apptError,  setApptError]  = useState(false);

    // ── Profile menu state ──
    const [profileMenuVisible, setProfileMenuVisible] = useState(false);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const initials = [userInfo?.firstName?.[0], userInfo?.lastName?.[0]]
        .filter(Boolean).join('').toUpperCase() || '?';

    // ─── Data fetching ────────────────────────────────────────────────────────

    // ← FIX: authHeader moved inside fetchAll to avoid stale closure.
    //   Previously `const authHeader = { Authorization: \`Bearer ${userToken}\` }`
    //   was defined at component level and captured by useCallback without being
    //   in the dependency array.
    const fetchAll = useCallback(async () => {
        if (!userToken || !userId) return;

        const authHeader = { Authorization: `Bearer ${userToken}` };

        try {
            const [apptRes, notifRes, treatRes] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/api/appointments?patientId=${userId}`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/notifications`,                 { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/my/treatment-logs`,             { headers: authHeader }),
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

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const onRefresh = () => { setRefreshing(true); fetchAll(); };

    useEffect(() => {
        const unsub = navigation.addListener('focus', () => fetchAll());
        return unsub;
    }, [navigation, fetchAll]);

    // ─── Render helpers ───────────────────────────────────────────────────────

    const renderAppointmentCard = () => {
        if (apptError) {
            return (
                <View style={[styles.apptCard, styles.apptCardEmpty]}>
                    <Ionicons name="warning-outline" size={36} color="#e65100" style={{ marginBottom: 10 }} />
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
                    <Ionicons name="calendar-outline" size={36} color="#bbb" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyTitle}>No upcoming appointment</Text>
                    <Text style={styles.emptySubtitle}>Tap to book your next dental visit.</Text>
                    <View style={styles.bookBtn}>
                        <Text style={styles.bookBtnText}>Book Now</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        const statusColors = {
            pending:     { bg: '#fff3e0', text: '#e65100', dot: '#ff9800' },
            confirmed:   { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' },
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="location-outline" size={13} color="#888" style={{ marginRight: 4 }} />
                        <Text style={styles.apptBranch}>{upcomingAppt.branch || 'Dentime Dental Clinic'}</Text>
                    </View>
                    <Text style={styles.apptTapHint}>Tap to manage →</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderVisitBanner = () => {
        if (!visitPrediction) {
            return (
                <View style={[styles.visitBanner, { backgroundColor: '#f5f5f5' }]}>
                    <MaterialCommunityIcons name="tooth-outline" size={28} color="#999" style={{ marginRight: 12 }} />
                    <View style={styles.visitBannerText}>
                        <Text style={styles.visitBannerTitle}>No visit history yet</Text>
                        <Text style={styles.visitBannerSub}>Your visit prediction will appear after your first recorded treatment.</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.visitBanner, { backgroundColor: visitPrediction.bg }]}>
                {visitPrediction.label === 'On Track'
                    ? <Ionicons name="checkmark-circle-outline" size={28} color={visitPrediction.color} style={{ marginRight: 12 }} />
                    : visitPrediction.label === 'Due Soon'
                    ? <Ionicons name="warning-outline" size={28} color={visitPrediction.color} style={{ marginRight: 12 }} />
                    : <Ionicons name="alert-circle-outline" size={28} color={visitPrediction.color} style={{ marginRight: 12 }} />
                }
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.headerGreeting}>Hello, {firstName} </Text>
                    </View>
                    <Text style={styles.headerSub}>Welcome back to NgitiFy</Text>
                </View>

                <View style={styles.headerActions}>
                    {/* Notification bell */}
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => navigation.navigate('Notifications')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="notifications-outline" size={24} color="white" />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Profile avatar button */}
                    <TouchableOpacity
                        style={styles.avatarBtn}
                        onPress={() => setProfileMenuVisible(true)}
                        activeOpacity={0.8}
                    >
                        {userInfo?.profileImage ? (
                            <Image
                                source={{ uri: userInfo.profileImage }}
                                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'white' }}
                            />
                        ) : (
                            <Text style={styles.avatarBtnText}>{initials}</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
                        iconComponent={<Ionicons name="calendar-outline" size={28} color="#01538b" />}
                        label="Book Appointment"
                        color="#01538b"
                        onPress={() => navigation.navigate('AppointmentBooking')}
                    />
                    <QuickActionCard
                        iconComponent={<MaterialCommunityIcons name="tooth-outline" size={28} color="#00897b" />}
                        label="My EMR"
                        color="#00897b"
                        onPress={() => navigation.navigate('MedicalRecords')}
                    />
                    <QuickActionCard
                        iconComponent={<Ionicons name="hardware-chip-outline" size={28} color="#7b1fa2" />}
                        label="AI Companion"
                        color="#7b1fa2"
                        onPress={() => navigation.navigate('AiPatientCareCompanion')}
                    />
                    <QuickActionCard
                        iconComponent={<Ionicons name="settings-outline" size={28} color="#e65100" />}
                        label="Settings"
                        color="#e65100"
                        onPress={() => navigation.navigate('Settings')}
                    />
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="hardware-chip-outline" size={18} color="white" style={{ marginRight: 6 }} />
                    <Text style={styles.fabLabel}>NgitiBot</Text>
                </View>
            </TouchableHighlight>

            {/* ── Profile Menu Sheet ── */}
            <ProfileMenuSheet
                visible={profileMenuVisible}
                onClose={() => setProfileMenuVisible(false)}
                navigation={navigation}
                userInfo={userInfo}
                logout={logout}
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container:        { flex: 1, backgroundColor: '#f3f7f9' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f7f9' },
    loadingText:      { marginTop: 12, color: '#888', fontSize: 14 },

    // Header
    header: {
        backgroundColor: '#01538b', paddingTop: 52, paddingBottom: 20,
        paddingHorizontal: 20, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between',
    },
    headerLeft:     { flex: 1 },
    headerGreeting: { fontSize: 22, fontWeight: 'bold', color: 'white' },
    headerSub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },

    iconBtn: { padding: 8, position: 'relative' },
    badge: {
        position: 'absolute', top: 4, right: 4, backgroundColor: '#e53935',
        borderRadius: 8, minWidth: 16, height: 16,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
    },
    badgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },

    avatarBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarBtnText: { color: 'white', fontSize: 13, fontWeight: 'bold' },

    // Scroll
    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

    // Section header
    sectionHeader: {
        fontSize: 13, fontWeight: '700', color: '#888',
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 8, marginTop: 4,
    },

    // Appointment card
    apptCard: {
        backgroundColor: 'white', borderRadius: 14, padding: 16,
        marginBottom: 16, elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    },
    apptCardEmpty:  { alignItems: 'center', paddingVertical: 28 },
    apptCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    apptCardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10, marginTop: 4 },
    apptProcedure:  { fontSize: 17, fontWeight: 'bold', color: '#01538b', marginBottom: 4 },
    apptMeta:       { fontSize: 13, color: '#555', marginBottom: 2 },
    apptDentist:    { fontSize: 12, color: '#888', marginTop: 2 },
    apptBranch:     { fontSize: 12, color: '#888' },
    apptTapHint:    { fontSize: 12, color: '#01538b', fontWeight: '600' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusDot:   { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusText:  { fontSize: 12, fontWeight: '700' },

    emptyTitle:    { fontSize: 15, fontWeight: 'bold', color: '#555', marginBottom: 4 },
    emptySubtitle: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 16 },
    bookBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    bookBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Visit banner
    visitBanner:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 16 },
    visitBannerText:  { flex: 1 },
    visitBannerTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
    visitBannerSub:   { fontSize: 12, color: '#555', lineHeight: 16 },

    // Quick actions
    qaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
    qaCard: {
        width: '48%', backgroundColor: 'white', borderRadius: 12, padding: 16,
        marginBottom: 10, alignItems: 'center', elevation: 2, borderTopWidth: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3,
    },
    qaLabel: { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },

    // FAB
    fab: {
        position: 'absolute', bottom: 24, right: 20, backgroundColor: '#01538b',
        borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14,
        elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2, shadowRadius: 6,
    },
    fabLabel: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

// ─── Profile menu sheet styles ────────────────────────────────────────────────

const sheet = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 100,
        paddingRight: 16,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 18,
        width: 260,
        paddingVertical: 12,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#01538b', justifyContent: 'center', alignItems: 'center',
        marginRight: 10,
    },
    avatarText:  { color: 'white', fontSize: 16, fontWeight: 'bold' },
    profileInfo: { flex: 1 },
    name:        { fontSize: 14, fontWeight: 'bold', color: '#222' },
    email:       { fontSize: 11, color: '#999', marginTop: 2 },

    divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 6 },

    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    menuIcon:  { width: 26, alignItems: 'center', justifyContent: 'center' },
    menuLabel: { flex: 1, fontSize: 14, color: '#333', fontWeight: '500' },
    // ← menuArrow style removed: replaced by Ionicons component directly in menuItem

    logoutItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    logoutLabel: { flex: 1, fontSize: 14, color: '#d32f2f', fontWeight: '600' },
});
