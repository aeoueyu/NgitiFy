import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, RefreshControl, ActivityIndicator,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { logActivity } from '../../utils/logActivity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d   = new Date(ts);
    const now = new Date();
    const diffMs   = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24)  return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7)  return `${diffDays}d ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const NOTIF_ICON_MAP = {
    NEW_APPOINTMENT:             { name: 'calendar-outline',         lib: 'Ionicons',               color: '#1e88e5' },
    APPOINTMENT_CONFIRMED:       { name: 'checkmark-circle-outline', lib: 'Ionicons',               color: '#2e7d32' },
    APPOINTMENT_DECLINED:        { name: 'close-circle-outline',     lib: 'Ionicons',               color: '#c62828' },
    APPOINTMENT_REMINDER:        { name: 'alarm-outline',            lib: 'Ionicons',               color: '#f57f17' },
    APPOINTMENT_CANCELLED:       { name: 'ban-outline',              lib: 'Ionicons',               color: '#757575' },
    APPOINTMENT_STATUS_UPDATED:  { name: 'sync-outline',             lib: 'Ionicons',               color: '#01538b' },
    PREDICTIVE_VISIT_DUE:        { name: 'warning-outline',          lib: 'Ionicons',               color: '#e65100' },
    PREDICTIVE_VISIT_OVERDUE:    { name: 'alert-circle-outline',     lib: 'Ionicons',               color: '#b71c1c' },
    DENTAL_HEALTH_TIP:           { name: 'tooth-outline',            lib: 'MaterialCommunityIcons', color: '#00897b' },
    CHAT_TICKET_RAISED:          { name: 'chatbubble-outline',       lib: 'Ionicons',               color: '#6a1b9a' },
    INQUIRY_ESCALATED:           { name: 'megaphone-outline',        lib: 'Ionicons',               color: '#ad1457' },
    NEW_RADIOGRAPH:              { name: 'bone',                     lib: 'MaterialCommunityIcons', color: '#4527a0' },
    LOW_INVENTORY:               { name: 'cube-outline',             lib: 'Ionicons',               color: '#558b2f' },
    NEW_PATIENT_REGISTRATION:    { name: 'person-add-outline',       lib: 'Ionicons',               color: '#00838f' },
};

function NotifIcon({ type, size = 22 }) {
    const cfg = NOTIF_ICON_MAP[type] || { name: 'notifications-outline', lib: 'Ionicons', color: '#01538b' };
    if (cfg.lib === 'MaterialCommunityIcons') {
        return <MaterialCommunityIcons name={cfg.name} size={size} color={cfg.color} />;
    }
    return <Ionicons name={cfg.name} size={size} color={cfg.color} />;
}

const getNavTarget = (type = '') => {
    if (type.includes('APPOINTMENT'))  return 'MyAppointments';
    if (type.includes('RADIOGRAPH'))   return 'MedicalRecords';
    if (type.includes('TICKET') || type.includes('INQUIRY')) return 'AiPatientCareCompanion';
    if (type.includes('VISIT'))        return 'AiPatientCareCompanion';
    return null;
};

// ─── Notification Item ────────────────────────────────────────────────────────

function NotifItem({ item, onPress }) {
    const unread = !item.isRead;
    return (
        <TouchableOpacity
            style={[styles.notifRow, unread && styles.notifRowUnread]}
            onPress={() => onPress(item)}
            activeOpacity={0.75}
        >
            {/* Unread dot */}
            <View style={styles.dotCol}>
                {unread && <View style={styles.unreadDot} />}
            </View>

            {/* Icon */}
            <View style={[styles.iconCircle, unread && styles.iconCircleUnread]}>
                <NotifIcon type={item.type} size={22} />
            </View>

            {/* Content */}
            <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, unread && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title || 'Notification'}
                </Text>
                <Text style={styles.notifMessage} numberOfLines={2}>
                    {item.message}
                </Text>
                <Text style={styles.notifTime}>{formatTimestamp(item.createdAt)}</Text>
            </View>

            {/* ← was: <Text style={styles.arrow}>›</Text> — bare Unicode chevron */}
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
    const { userToken, API_BASE_URL } = useContext(AuthContext);

    const [notifications, setNotifications] = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [refreshing,    setRefreshing]    = useState(false);
    const [markingAll,    setMarkingAll]    = useState(false);
    const [error,         setError]         = useState('');

    // ← FIX: authHeader moved inside fetchNotifications to avoid stale closure.
    //   Previously defined at component level and captured by useCallback without
    //   being in the dependency array.
    const fetchNotifications = useCallback(async () => {
        try {
            setError('');
            const res = await fetch(`${API_BASE_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setNotifications(Array.isArray(data) ? data : []);
        } catch {
            setError('Could not load notifications. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userToken, API_BASE_URL]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    useEffect(() => {
        const refresh = () => fetchNotifications();
        const unsubscribe = navigation.addListener('focus', refresh);
        const intervalId = setInterval(refresh, 30000);
        return () => {
            unsubscribe();
            clearInterval(intervalId);
        };
    }, [fetchNotifications, navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    // ── Mark single as read ──
    // (not memoized — always captures current token from render closure, no fix needed)
    const handleNotifPress = async (item) => {
        if (!item.isRead) {
            setNotifications(prev =>
                prev.map(n => n._id === item._id ? { ...n, isRead: true } : n)
            );
            try {
                const response = await fetch(`${API_BASE_URL}/api/notifications/${item._id}/read`, {
                    method:  'PATCH',
                    headers: { Authorization: `Bearer ${userToken}` },
                });
                if (!response.ok) {
                    throw new Error('Failed to mark notification as read.');
                }
            } catch {
                // non-critical — local state already updated
            }
        }

        await logActivity(
            'NOTIFICATION_VIEWED',
            `Viewed notification: ${item.title || item.type}`,
            userToken, API_BASE_URL
        );
        const target = getNavTarget(item.type);
        if (target) navigation.navigate(target);
    };

    // ── Mark all as read ──
    const handleMarkAllRead = async () => {
        const hasUnread = notifications.some(n => !n.isRead);
        if (!hasUnread) return;

        setMarkingAll(true);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        try {
            await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
                method:  'PATCH',
                headers: { Authorization: `Bearer ${userToken}` },
            });
        } catch {
            // non-critical
        } finally {
            setMarkingAll(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // ── Empty state ──
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="notifications-outline" size={52} color="#bbb" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySubtitle}>
                    You'll be notified here when your appointments are confirmed,
                    when it's time to visit, and more.
                </Text>
            </View>
        );
    };

    // ── Error state ──
    const renderError = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={52} color="#e65100" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>Could not load notifications</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchNotifications}>
                <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSeparator = () => <View style={styles.separator} />;

    // ── List header (mark-all row) ──
    const renderHeader = () => {
        if (notifications.length === 0) return null;
        return (
            <View style={styles.listHeader}>
                <Text style={styles.listHeaderCount}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </Text>
                <TouchableOpacity
                    onPress={handleMarkAllRead}
                    disabled={markingAll || unreadCount === 0}
                    activeOpacity={0.7}
                >
                    {markingAll
                        ? <ActivityIndicator size="small" color="#01538b" />
                        : (
                            <Text style={[
                                styles.markAllText,
                                unreadCount === 0 && styles.markAllDisabled,
                            ]}>
                                Mark all as read
                            </Text>
                        )
                    }
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <BackIcon width={16} height={16} style={{ color: '#01538b' }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={styles.headerRight}>
                    {unreadCount > 0 && (
                        <View style={styles.headerBadge}>
                            <Text style={styles.headerBadgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Body */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.loadingText}>Loading notifications…</Text>
                </View>
            ) : error ? (
                renderError()
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item._id?.toString() || Math.random().toString()}
                    renderItem={({ item }) => (
                        <NotifItem item={item} onPress={handleNotifPress} />
                    )}
                    ItemSeparatorComponent={renderSeparator}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#01538b']}
                            tintColor="#01538b"
                        />
                    }
                    contentContainerStyle={notifications.length === 0 && styles.emptyFlex}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header: {
        backgroundColor: 'white', paddingTop: 50, paddingBottom: 16,
        paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 70 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16, marginLeft: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    headerRight: { width: 70, alignItems: 'flex-end' },
    headerBadge: {
        backgroundColor: '#e53935', borderRadius: 10,
        minWidth: 20, height: 20, justifyContent: 'center',
        alignItems: 'center', paddingHorizontal: 5,
    },
    headerBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },

    // Loading
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:      { marginTop: 12, color: '#888', fontSize: 14 },

    // List header
    listHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#f3f7f9',
    },
    listHeaderCount: { fontSize: 13, color: '#888', fontWeight: '600' },
    markAllText:     { fontSize: 13, color: '#01538b', fontWeight: '700' },
    markAllDisabled: { color: '#ccc' },

    // Notification row
    notifRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'white', paddingVertical: 14,
        paddingHorizontal: 12,
    },
    notifRowUnread: { backgroundColor: '#f0f6ff' },

    dotCol:    { width: 10, alignItems: 'center', marginRight: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e88e5' },

    iconCircle: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#f0f0f0', justifyContent: 'center',
        alignItems: 'center', marginRight: 12,
    },
    iconCircleUnread: { backgroundColor: '#dceeff' },

    notifContent:      { flex: 1, marginRight: 8 },
    notifTitle:        { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 2 },
    notifTitleUnread:  { color: '#01538b', fontWeight: '700' },
    notifMessage:      { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 4 },
    notifTime:         { fontSize: 11, color: '#aaa' },

    // ← arrow style removed: replaced by Ionicons component directly in NotifItem

    separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 66 },

    // Empty / error
    emptyFlex:      { flexGrow: 1, justifyContent: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle:     { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' },
    emptySubtitle:  { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
    retryBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
