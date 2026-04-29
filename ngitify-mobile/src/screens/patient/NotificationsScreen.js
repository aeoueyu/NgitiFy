import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, RefreshControl, ActivityIndicator,
    StatusBar,
} from 'react-native';
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

const getNotifIcon = (type = '') => {
    switch (type) {
        case 'NEW_APPOINTMENT':           return '📅';
        case 'APPOINTMENT_CONFIRMED':     return '✅';
        case 'APPOINTMENT_DECLINED':      return '❌';
        case 'APPOINTMENT_REMINDER':      return '⏰';
        case 'APPOINTMENT_CANCELLED':     return '🚫';
        case 'PREDICTIVE_VISIT_DUE':      return '⚠️';
        case 'PREDICTIVE_VISIT_OVERDUE':  return '🚨';
        case 'DENTAL_HEALTH_TIP':         return '🦷';
        case 'CHAT_TICKET_RAISED':        return '💬';
        case 'INQUIRY_ESCALATED':         return '📣';
        case 'NEW_RADIOGRAPH':            return '🩻';
        case 'LOW_INVENTORY':             return '📦';
        default:                          return '🔔';
    }
};

// Determines which screen to navigate to when a notification is tapped
const getNavTarget = (type = '') => {
    if (type.includes('APPOINTMENT'))  return 'AppointmentBooking';
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
                <Text style={styles.iconText}>{getNotifIcon(item.type)}</Text>
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

            {/* Arrow */}
            <Text style={styles.arrow}>›</Text>
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

    const authHeader = { Authorization: `Bearer ${userToken}` };

    // ── Fetch notifications ──
    const fetchNotifications = useCallback(async () => {
        try {
            setError('');
            const res  = await fetch(`${API_BASE_URL}/api/notifications`, { headers: authHeader });
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

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    // ── Mark single as read ──
    const handleNotifPress = async (item) => {
        // Optimistically mark as read in local state
        if (!item.isRead) {
            setNotifications(prev =>
                prev.map(n => n._id === item._id ? { ...n, isRead: true } : n)
            );
            try {
                await fetch(`${API_BASE_URL}/api/notifications/${item._id}/read`, {
                    method:  'PATCH',
                    headers: authHeader,
                });
            } catch {
                // non-critical — local state already updated
            }
        }

        // Navigate to relevant screen
        logActivity(
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
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        try {
            await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
                method:  'PATCH',
                headers: authHeader,
            });
        } catch {
            // non-critical
        } finally {
            setMarkingAll(false);
        }
    };

    // ── Derived ──
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // ── Empty state ──
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔔</Text>
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
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Could not load notifications</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchNotifications}>
                <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Separator ──
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

    // ── Main render ──
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
    iconText: { fontSize: 20 },

    notifContent:      { flex: 1, marginRight: 8 },
    notifTitle:        { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 2 },
    notifTitleUnread:  { color: '#01538b', fontWeight: '700' },
    notifMessage:      { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 4 },
    notifTime:         { fontSize: 11, color: '#aaa' },

    arrow: { fontSize: 22, color: '#ccc', fontWeight: '300' },

    separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 66 },

    // Empty / error
    emptyFlex:      { flexGrow: 1, justifyContent: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon:      { fontSize: 52, marginBottom: 16 },
    emptyTitle:     { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' },
    emptySubtitle:  { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
    retryBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },
});