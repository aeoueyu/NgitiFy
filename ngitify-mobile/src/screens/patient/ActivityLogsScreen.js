import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, RefreshControl, ActivityIndicator,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';                  // ← added
import { MaterialCommunityIcons } from '@expo/vector-icons';    // ← added
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

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

// ← was: returned emoji strings. Now returns icon name + lib for proper rendering.
const getActionIcon = (action = '') => {
    const a = action.toUpperCase();
    if (a === 'LOGIN')
        return { name: 'key-outline',              lib: 'Ionicons',               color: '#1e88e5', bg: '#dceeff' };
    if (a === 'LOGOUT')
        return { name: 'exit-outline',             lib: 'Ionicons',               color: '#757575', bg: '#f5f5f5' };
    if (a.includes('APPOINTMENT'))
        return { name: 'calendar-outline',         lib: 'Ionicons',               color: '#7b1fa2', bg: '#f3e5f5' };
    if (a.includes('TREATMENT'))
        return { name: 'tooth-outline',            lib: 'MaterialCommunityIcons', color: '#00897b', bg: '#e0f2f1' };
    if (a.includes('RADIOGRAPH'))
        return { name: 'bone',                     lib: 'MaterialCommunityIcons', color: '#0288d1', bg: '#e1f5fe' };
    if (a.includes('PROFILE') || a.includes('UPDATE'))
        return { name: 'person-outline',           lib: 'Ionicons',               color: '#f57c00', bg: '#fff3e0' };
    if (a.includes('PASSWORD'))
        return { name: 'lock-closed-outline',      lib: 'Ionicons',               color: '#e53935', bg: '#ffebee' };
    if (a.includes('TICKET') || a.includes('INQUIRY'))
        return { name: 'chatbubble-outline',        lib: 'Ionicons',               color: '#039be5', bg: '#e1f5fe' };
    if (a.includes('NOTIFICATION'))
        return { name: 'notifications-outline',    lib: 'Ionicons',               color: '#f57f17', bg: '#fffde7' };
    return         { name: 'document-text-outline',lib: 'Ionicons',               color: '#90a4ae', bg: '#f5f5f5' };
};

const formatActionLabel = (action = '') => {
    return action
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Log Item ─────────────────────────────────────────────────────────────────

function LogItem({ item }) {
    const { name, lib, color, bg } = getActionIcon(item.action);
    return (
        <View style={styles.logRow}>
            <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                {/* ← was: <Text style={styles.iconText}>{icon}</Text> */}
                {lib === 'MaterialCommunityIcons' ? (
                    <MaterialCommunityIcons name={name} size={22} color={color} />
                ) : (
                    <Ionicons name={name} size={22} color={color} />
                )}
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

    const [allLogs,     setAllLogs]     = useState([]);
    const [visibleLogs, setVisibleLogs] = useState([]);
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error,       setError]       = useState('');

    // ── Fetch all logs ──
    // ← FIX: authHeader moved inside fetchLogs to avoid stale-closure on token refresh.
    //   Previously it was defined outside useCallback as a plain object, so if userToken
    //   changed between renders the callback would still hold the old value.
    const fetchLogs = useCallback(async () => {
        try {
            setError('');
            const res = await fetch(`${API_BASE_URL}/api/activity-logs/patient`, {
                headers: { Authorization: `Bearer ${userToken}` },
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
        const nextPage  = page + 1;
        const nextSlice = allLogs.slice(0, nextPage * PAGE_SIZE);
        if (nextSlice.length === visibleLogs.length) return;
        setLoadingMore(true);
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

    const renderSeparator = () => <View style={styles.separator} />;

    // ── Empty state ──
    // ← was: <Text style={styles.emptyIcon}>📋</Text>
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={52} color="#bbb" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySubtitle}>
                    Your in-app actions — logins, appointments, EMR views, and more —
                    will appear here automatically.
                </Text>
            </View>
        );
    };

    // ── Error state ──
    // ← was: <Text style={styles.emptyIcon}>⚠️</Text>
    const renderError = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={52} color="#e65100" style={{ marginBottom: 16 }} />
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
                    <BackIcon width={16} height={16} fill="#01538b" />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Activity Logs</Text>
                <View style={{ width: 70 }} />
            </View>

            {/* Info banner — ← was: emoji 🔍 inside a <Text> string */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={14} color="#01538b" style={{ marginRight: 6 }} />
                <Text style={styles.infoBannerText}>
                    A read-only record of all your actions in NgitiFy.
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
                    contentContainerStyle={[styles.listContent, visibleLogs.length === 0 && styles.emptyFlex]}
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
        backgroundColor: 'white', paddingTop: mobilePageTopInset, paddingBottom: 16,
        paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 70 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16, marginLeft: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    // Info banner — ← flexDirection added so icon sits beside the text
    infoBanner: {
        backgroundColor: '#e8f1f8', paddingHorizontal: 16,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#d0e4f7',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    },
    infoBannerText: { fontSize: 12, color: '#01538b', fontWeight: '500' },

    // Loading
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:      { marginTop: 12, color: '#888', fontSize: 14 },
    listContent:      { paddingBottom: 132 },

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
    // ← iconText removed: no longer rendering emoji as <Text>
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
    // ← emptyIcon removed: was only used for emoji <Text>, now icons are rendered directly
    emptyTitle:     { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' },
    emptySubtitle:  { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn:       { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
    retryBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
