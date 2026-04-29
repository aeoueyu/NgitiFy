import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, RefreshControl, ActivityIndicator,
    StatusBar,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('en-PH', {
        month:  'short',
        day:    'numeric',
        year:   'numeric',
        hour:   'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const getActionIcon = (action = '') => {
    const a = action.toUpperCase();
    if (a === 'LOGIN')                    return { icon: '🔑', color: '#1e88e5', bg: '#dceeff' };
    if (a === 'LOGOUT')                   return { icon: '🚪', color: '#757575', bg: '#f5f5f5' };
    if (a.includes('APPOINTMENT_REQUEST'))return { icon: '📅', color: '#7b1fa2', bg: '#f3e5f5' };
    if (a.includes('APPOINTMENT'))        return { icon: '📅', color: '#7b1fa2', bg: '#f3e5f5' };
    if (a.includes('TREATMENT'))          return { icon: '🦷', color: '#00897b', bg: '#e0f2f1' };
    if (a.includes('RADIOGRAPH'))         return { icon: '🩻', color: '#0288d1', bg: '#e1f5fe' };
    if (a.includes('PROFILE') ||
        a.includes('UPDATE'))             return { icon: '👤', color: '#f57c00', bg: '#fff3e0' };
    if (a.includes('PASSWORD'))           return { icon: '🔒', color: '#e53935', bg: '#ffebee' };
    if (a.includes('TICKET') ||
        a.includes('INQUIRY'))            return { icon: '💬', color: '#039be5', bg: '#e1f5fe' };
    if (a.includes('NOTIFICATION'))       return { icon: '🔔', color: '#fdd835', bg: '#fffde7' };
    return                                       { icon: '📋', color: '#90a4ae', bg: '#f5f5f5' };
};

const formatActionLabel = (action = '') => {
    // Convert SNAKE_CASE to Title Case
    return action
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Log Item ─────────────────────────────────────────────────────────────────

function LogItem({ item }) {
    const { icon, color, bg } = getActionIcon(item.action);
    return (
        <View style={styles.logRow}>
            <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                <Text style={styles.iconText}>{icon}</Text>
            </View>
            <View style={styles.logContent}>
                <Text style={[styles.logAction, { color }]}>
                    {formatActionLabel(item.action)}
                </Text>
                <Text style={styles.logDetails} numberOfLines={2}>
                    {item.details || '—'}
                </Text>
                <Text style={styles.logTime}>{formatTimestamp(item.timestamp)}</Text>
            </View>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivityLogsScreen({ navigation }) {
    const { userToken, API_BASE_URL } = useContext(AuthContext);

    const [allLogs,     setAllLogs]     = useState([]);   // full fetched list
    const [visibleLogs, setVisibleLogs] = useState([]);   // paginated slice shown
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error,       setError]       = useState('');

    const authHeader = { Authorization: `Bearer ${userToken}` };

    // ── Fetch all logs (backend returns up to 200, we paginate client-side) ──
    const fetchLogs = useCallback(async () => {
        try {
            setError('');
            const res  = await fetch(`${API_BASE_URL}/api/activity-logs/patient`, {
                headers: authHeader,
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const logs = Array.isArray(data) ? data : [];
            setAllLogs(logs);
            setPage(1);
            setVisibleLogs(logs.slice(0, PAGE_SIZE));
        } catch {
            setError('Could not load activity logs. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [userToken, API_BASE_URL]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchLogs();
    };

    // ── Load next page ──
    const loadMore = () => {
        if (loadingMore) return;
        const nextPage = page + 1;
        const nextSlice = allLogs.slice(0, nextPage * PAGE_SIZE);
        if (nextSlice.length === visibleLogs.length) return; // nothing new to load
        setLoadingMore(true);
        // Simulate async to avoid jank
        setTimeout(() => {
            setVisibleLogs(nextSlice);
            setPage(nextPage);
            setLoadingMore(false);
        }, 150);
    };

    const hasMore = visibleLogs.length < allLogs.length;

    // ── Footer: Load More button ──
    const renderFooter = () => {
        if (!hasMore && !loadingMore) return <View style={{ height: 30 }} />;
        return (
            <View style={styles.footerContainer}>
                {loadingMore
                    ? <ActivityIndicator color="#01538b" />
                    : (
                        <TouchableOpacity
                            style={styles.loadMoreBtn}
                            onPress={loadMore}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.loadMoreText}>
                                Load More ({allLogs.length - visibleLogs.length} remaining)
                            </Text>
                        </TouchableOpacity>
                    )
                }
            </View>
        );
    };

    // ── List header ──
    const renderHeader = () => {
        if (allLogs.length === 0) return null;
        return (
            <View style={styles.listHeader}>
                <Text style={styles.listHeaderCount}>
                    {allLogs.length} total record{allLogs.length !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.listHeaderNote}>Read-only · Newest first</Text>
            </View>
        );
    };

    // ── Separator ──
    const renderSeparator = () => <View style={styles.separator} />;

    // ── Empty state ──
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySubtitle}>
                    Your in-app actions — logins, appointments, EMR views, and more —
                    will appear here automatically.
                </Text>
            </View>
        );
    };

    // ── Error state ──
    const renderError = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Could not load activity logs</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchLogs}>
                <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

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
                <Text style={styles.headerTitle}>Activity Logs</Text>
                <View style={{ width: 70 }} />
            </View>

            {/* Info banner */}
            <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                    🔍 A read-only record of all your actions in NgitiFy.
                </Text>
            </View>

            {/* Body */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.loadingText}>Loading activity logs…</Text>
                </View>
            ) : error ? (
                renderError()
            ) : (
                <FlatList
                    data={visibleLogs}
                    keyExtractor={(item, idx) => item._id?.toString() || idx.toString()}
                    renderItem={({ item }) => <LogItem item={item} />}
                    ItemSeparatorComponent={renderSeparator}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    onEndReached={hasMore ? loadMore : null}
                    onEndReachedThreshold={0.3}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#01538b']}
                            tintColor="#01538b"
                        />
                    }
                    contentContainerStyle={visibleLogs.length === 0 && styles.emptyFlex}
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

    // Info banner
    infoBanner: {
        backgroundColor: '#e8f1f8', paddingHorizontal: 16,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#d0e4f7',
    },
    infoBannerText: { fontSize: 12, color: '#01538b', textAlign: 'center', fontWeight: '500' },

    // Loading
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:      { marginTop: 12, color: '#888', fontSize: 14 },

    // List header
    listHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f3f7f9',
    },
    listHeaderCount: { fontSize: 13, color: '#555', fontWeight: '700' },
    listHeaderNote:  { fontSize: 11, color: '#aaa' },

    // Log row
    logRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 16,
    },
    iconCircle: {
        width: 42, height: 42, borderRadius: 21,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14, marginTop: 1,
    },
    iconText:   { fontSize: 20 },
    logContent: { flex: 1 },
    logAction:  { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    logDetails: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 4 },
    logTime:    { fontSize: 11, color: '#aaa' },

    separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 72 },

    // Footer
    footerContainer: { paddingVertical: 20, alignItems: 'center' },
    loadMoreBtn: {
        backgroundColor: 'white', borderRadius: 20, borderWidth: 1.5,
        borderColor: '#01538b', paddingHorizontal: 24, paddingVertical: 10,
        elevation: 1,
    },
    loadMoreText: { color: '#01538b', fontWeight: '700', fontSize: 13 },

    // Empty / error
    emptyFlex:      { flexGrow: 1, justifyContent: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon:      { fontSize: 52, marginBottom: 16 },
    emptyTitle:     { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' },
    emptySubtitle:  { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
    retryBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },
});