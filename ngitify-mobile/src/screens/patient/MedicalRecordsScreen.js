import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, FlatList, Animated
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { logActivity } from '../../utils/logActivity';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'treatment',  label: 'Treatment' },
    { key: 'odontogram', label: 'Odontogram' },
    { key: 'radiograph', label: 'X-Rays' },
    { key: 'history',    label: 'History' },
];

// FDI tooth notation — 4 quadrants, upper then lower
const UPPER_RIGHT = [18,17,16,15,14,13,12,11]; // displayed right→left
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41]; // displayed right→left

const STATUS_COLORS = {
    'Healthy':           { bg: '#e8f5e9', text: '#2e7d32' },
    'Normal':            { bg: '#e8f5e9', text: '#2e7d32' },
    'Caries':            { bg: '#ffebee', text: '#c62828' },
    'Missing':           { bg: '#eeeeee', text: '#757575' },
    'Crowned':           { bg: '#e3f2fd', text: '#1565c0' },
    'Filled':            { bg: '#fff8e1', text: '#f57f17' },
    'Root Canal':        { bg: '#fce4ec', text: '#880e4f' },
    'Implant':           { bg: '#e8eaf6', text: '#283593' },
    'Fractured':         { bg: '#fff3e0', text: '#e65100' },
    'Under Observation': { bg: '#e0f7fa', text: '#006064' },
    'Extracted':         { bg: '#eeeeee', text: '#757575' },
};

const DEFAULT_STATUS_COLOR = { bg: '#f5f5f5', text: '#333' };

const CATEGORY_ICONS = {
    Restoration:    { name: 'construct-outline',     lib: 'Ionicons' },
    Extraction:     { name: 'medical-outline',       lib: 'Ionicons' },
    Prophylaxis:    { name: 'sparkles-outline',      lib: 'Ionicons' },
    Orthodontics:   { name: 'git-merge-outline',     lib: 'Ionicons' },
    Endodontics:    { name: 'pulse-outline',         lib: 'Ionicons' },
    Prosthodontics: { name: 'diamond-outline',       lib: 'Ionicons' },
    'Oral Surgery': { name: 'cut-outline',           lib: 'Ionicons' },
    Consultation:   { name: 'chatbubble-outline',    lib: 'Ionicons' },
    Other:          { name: 'document-text-outline', lib: 'Ionicons' },
};

function CategoryIcon({ category, size = 14, color = '#555' }) {
    const cfg = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;
    return <Ionicons name={cfg.name} size={size} color={color} />;
}

const SURGERY_STATUS_COLORS = {
    completed:  { color: '#2e7d32', bg: '#e8f5e9' },
    confirmed:  { color: '#1565c0', bg: '#e3f2fd' },
    'in-clinic':{ color: '#6a1b9a', bg: '#f3e5f5' },
    pending:    { color: '#e65100', bg: '#fff3e0' },
    cancelled:  { color: '#757575', bg: '#eeeeee' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ iconComponent, title, sub }) {
    return (
        <View style={shared.emptyBox}>
            <View style={{ marginBottom: 12 }}>{iconComponent}</View>
            <Text style={shared.emptyTitle}>{title}</Text>
            {sub && <Text style={shared.emptySub}>{sub}</Text>}
        </View>
    );
}

function LoadingState() {
    return (
        <View style={shared.loadingBox}>
            <ActivityIndicator color="#01538b" size="large" />
            <Text style={shared.loadingText}>Loading records…</Text>
        </View>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <View style={shared.errorBox}>
            <Ionicons name="warning-outline" size={36} color="#e65100" style={{ marginBottom: 10 }} />
            <Text style={shared.errorText}>{message}</Text>
            <TouchableOpacity style={shared.retryBtn} onPress={onRetry}>
                <Text style={shared.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Tab: Treatment Notes ─────────────────────────────────────────────────────

function TreatmentTab({ logs, loading, error, onRetry }) {
    const [expanded, setExpanded] = useState(null);

    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!logs.length) return (
        <EmptyState
            iconComponent={<Ionicons name="document-text-outline" size={40} color="#bbb" />}
            title="No Treatment Notes Yet"
            sub="Your dentist's notes will appear here after your first visit."
        />
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {logs.map((log) => {
                const isOpen = expanded === log._id;
                return (
                    <TouchableOpacity
                        key={log._id}
                        style={[styles.logCard, isOpen && styles.logCardOpen]}
                        onPress={() => setExpanded(isOpen ? null : log._id)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.logHeader}>
                            <View style={styles.logDateBox}>
                                <Text style={styles.logMonth}>{MONTHS[new Date(log.date).getMonth()]}</Text>
                                <Text style={styles.logDay}>{new Date(log.date).getDate()}</Text>
                                <Text style={styles.logYear}>{new Date(log.date).getFullYear()}</Text>
                            </View>
                            <View style={styles.logMeta}>
                                <View style={styles.logTitleRow}>
                                    <CategoryIcon category={log.category} size={14} color="#555" style={{ marginRight: 6 }} />
                                    <Text style={styles.logProcedure} numberOfLines={isOpen ? 0 : 1}>
                                        {log.procedure}
                                    </Text>
                                </View>
                                <Text style={styles.logCategory}>{log.category || 'Other'}</Text>
                                {log.dentistName && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="tooth-outline" size={13} color="#555" style={{ marginRight: 4 }} />
                                        <Text style={styles.logDentist}>Dr. {log.dentistName}</Text>
                                    </View>
                                )}
                                {log.tooth && (
                                    <Text style={styles.logTooth}>Tooth: {log.tooth}</Text>
                                )}
                            </View>
                            <Ionicons
                                name={isOpen ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="#bbb"
                                style={{ paddingLeft: 8, paddingTop: 2 }}
                            />
                        </View>

                        {isOpen && log.notes ? (
                            <View style={styles.logNotesBox}>
                                <Text style={styles.logNotesLabel}>Clinical Notes</Text>
                                <Text style={styles.logNotes}>{log.notes}</Text>
                            </View>
                        ) : null}

                        {isOpen && log.branch ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 }}>
                                <Ionicons name="location-outline" size={12} color="#aaa" style={{ marginRight: 4 }} />
                                <Text style={[styles.logBranch, { paddingHorizontal: 0, paddingBottom: 0 }]}>{log.branch}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

// ─── Tab: Odontogram ─────────────────────────────────────────────────────────

function OdontogramTab({ data, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;

    const hasData = Object.keys(data).length > 0;

    const ToothCell = ({ num }) => {
        const status = data[String(num)];
        const colors = status
            ? (STATUS_COLORS[status] || DEFAULT_STATUS_COLOR)
            : { bg: 'white', text: '#ccc' };
        const isMissing = status === 'Missing' || status === 'Extracted';

        return (
            <View style={[styles.toothCell, { backgroundColor: colors.bg, borderColor: colors.text + '55' }]}>
                <Text style={[styles.toothNum, { color: colors.text, textDecorationLine: isMissing ? 'line-through' : 'none' }]}>
                    {num}
                </Text>
                {status && status !== 'Healthy' && status !== 'Normal' && (
                    <Text style={[styles.toothStatus, { color: colors.text }]} numberOfLines={1}>
                        {status.length > 7 ? status.slice(0, 6) + '…' : status}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.odontogramCard}>
                <Text style={styles.odontogramTitle}>Dental Chart</Text>
                <Text style={styles.odontogramSub}>FDI Notation  ·  Read-only</Text>

                {!hasData && (
                    <View style={styles.odontogramEmpty}>
                        <Text style={styles.odontogramEmptyText}>
                            No tooth conditions recorded yet. Your dentist will update this after an examination.
                        </Text>
                    </View>
                )}

                {/* Upper jaw */}
                <Text style={styles.jawLabel}>Upper Jaw</Text>
                <View style={styles.jawRow}>
                    {UPPER_RIGHT.map(n => <ToothCell key={n} num={n} />)}
                    <View style={styles.midline} />
                    {UPPER_LEFT.map(n => <ToothCell key={n} num={n} />)}
                </View>

                <View style={styles.jawDivider} />

                {/* Lower jaw */}
                <View style={styles.jawRow}>
                    {LOWER_RIGHT.map(n => <ToothCell key={n} num={n} />)}
                    <View style={styles.midline} />
                    {LOWER_LEFT.map(n => <ToothCell key={n} num={n} />)}
                </View>
                <Text style={styles.jawLabel}>Lower Jaw</Text>
            </View>

            {/* Legend */}
            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendGrid}>
                {Object.entries(STATUS_COLORS).map(([label, { bg, text }]) => (
                    <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: bg, borderColor: text + '88' }]} />
                        <Text style={styles.legendLabel}>{label}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.readOnlyBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="lock-closed-outline" size={13} color="#1565c0" style={{ marginRight: 6 }} />
                    <Text style={styles.readOnlyText}>View-only. Only your dentist can update tooth conditions.</Text>
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Tab: Radiographs ────────────────────────────────────────────────────────

function RadiographTab({ radiographs, loading, error, onRetry, navigation }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!radiographs.length) return (
        <EmptyState
            iconComponent={<MaterialCommunityIcons name="bone" size={40} color="#bbb" />}
            title="No X-Rays On File"
            sub="Uploaded radiographs will appear here after your dentist scans them in."
        />
    );

    return (
        <FlatList
            data={radiographs}
            keyExtractor={item => item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.xrayCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('PatientXRayView', { radiograph: item })}
                >
                    <View style={styles.xrayThumb}>
                        <MaterialCommunityIcons name="bone" size={36} color="#aaa" />
                        {item.url && (
                            <View style={styles.xrayAvailableDot} />
                        )}
                    </View>
                    <View style={styles.xrayInfo}>
                        <Text style={styles.xrayLabel} numberOfLines={2}>{item.label}</Text>
                        <Text style={styles.xrayDate}>{fmtDate(item.date)}</Text>
                        {item.notes ? (
                            <Text style={styles.xrayNotes} numberOfLines={1}>{item.notes}</Text>
                        ) : null}
                        <Text style={styles.xrayTapHint}>Tap to view →</Text>
                    </View>
                </TouchableOpacity>
            )}
        />
    );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({ surgeries, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!surgeries.length) return (
        <EmptyState
            iconComponent={<Ionicons name="calendar-outline" size={40} color="#bbb" />}
            title="No Visit History Yet"
            sub="Your completed appointments will appear here."
        />
    );

    const sorted = [...surgeries].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {sorted.map((s) => {
                const sc = SURGERY_STATUS_COLORS[s.status] || SURGERY_STATUS_COLORS.pending;
                const dentistName = s.dentist?.name
                    ? `${s.dentist.name.first || ''} ${s.dentist.name.last || ''}`.trim()
                    : null;
                return (
                    <View key={s._id} style={styles.historyCard}>
                        <View style={styles.historyLeft}>
                            <Text style={styles.historyDate}>{fmtDate(s.date)}</Text>
                            {s.time ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                    <Ionicons name="time-outline" size={11} color="#888" style={{ marginRight: 3 }} />
                                    <Text style={styles.historyTime}>{s.time}</Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.historyRight}>
                            <Text style={styles.historyProcedure}>{s.procedure}</Text>
                            {dentistName ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                    <MaterialCommunityIcons name="tooth-outline" size={13} color="#555" style={{ marginRight: 4 }} />
                                    <Text style={styles.historyDentist}>Dr. {dentistName}</Text>
                                </View>
                            ) : null}
                            {s.branch ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                    <Ionicons name="location-outline" size={12} color="#aaa" style={{ marginRight: 4 }} />
                                    <Text style={styles.historyBranch}>{s.branch}</Text>
                                </View>
                            ) : null}
                            <View style={[styles.historyStatusPill, { backgroundColor: sc.bg }]}>
                                <Text style={[styles.historyStatusText, { color: sc.color }]}>
                                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                                </Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicalRecordsScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);

    const [activeTab, setActiveTab] = useState('treatment');
    const underlineAnim = useRef(new Animated.Value(0)).current;

    // Per-tab state
    const [treatmentLogs,  setTreatmentLogs]  = useState([]);
    const [odontogramData, setOdontogramData] = useState({});
    const [radiographs,    setRadiographs]    = useState([]);
    const [surgeries,      setSurgeries]      = useState([]);

    const [loading, setLoading] = useState({ treatment: false, odontogram: false, radiograph: false, history: false });
    const [errors,  setErrors]  = useState({ treatment: '', odontogram: '', radiograph: '', history: '' });
    const [fetched, setFetched] = useState({ treatment: false, odontogram: false, radiograph: false, history: false });

    const headers = { Authorization: `Bearer ${userToken}` };

    const setTabLoading = (tab, val) => setLoading(prev => ({ ...prev, [tab]: val }));
    const setTabError   = (tab, val) => setErrors(prev =>  ({ ...prev, [tab]: val }));
    const setTabFetched = (tab)      => setFetched(prev => ({ ...prev, [tab]: true }));

    // ── Fetchers ──────────────────────────────────────────────────────────────

    const fetchTreatment = useCallback(async () => {
        setTabLoading('treatment', true);
        setTabError('treatment', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/my/treatment-logs`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setTreatmentLogs(Array.isArray(data) ? data : []);
            setTabFetched('treatment');
        } catch (e) {
            setTabError('treatment', e.message || 'Could not load treatment notes.');
        } finally {
            setTabLoading('treatment', false);
        }
    }, [userToken, API_BASE_URL]);

    const fetchOdontogram = useCallback(async () => {
        setTabLoading('odontogram', true);
        setTabError('odontogram', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/my/odontogram`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setOdontogramData(data && typeof data === 'object' ? data : {});
            setTabFetched('odontogram');
        } catch (e) {
            setTabError('odontogram', e.message || 'Could not load odontogram.');
        } finally {
            setTabLoading('odontogram', false);
        }
    }, [userToken, API_BASE_URL]);

    const fetchRadiographs = useCallback(async () => {
        setTabLoading('radiograph', true);
        setTabError('radiograph', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/my/radiographs`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setRadiographs(Array.isArray(data) ? data : []);
            setTabFetched('radiograph');
        } catch (e) {
            setTabError('radiograph', e.message || 'Could not load radiographs.');
        } finally {
            setTabLoading('radiograph', false);
        }
    }, [userToken, API_BASE_URL]);

    const fetchHistory = useCallback(async () => {
        setTabLoading('history', true);
        setTabError('history', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/surgeries?patientId=${userId}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSurgeries(Array.isArray(data) ? data : []);
            setTabFetched('history');
        } catch (e) {
            setTabError('history', e.message || 'Could not load visit history.');
        } finally {
            setTabLoading('history', false);
        }
    }, [userToken, userId, API_BASE_URL]);

    const FETCHERS = {
        treatment:  fetchTreatment,
        odontogram: fetchOdontogram,
        radiograph: fetchRadiographs,
        history:    fetchHistory,
    };

    // Fetch on first tab activation (lazy per tab)
    useEffect(() => {
        if (!fetched[activeTab]) {
            FETCHERS[activeTab]();
        }
        logActivity(
            'EMR_VIEWED',
            `Viewed Medical Records — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab`,
            userToken, API_BASE_URL
        );
    }, [activeTab]);

    // Animate tab underline
    const TAB_INDEX = { treatment: 0, odontogram: 1, radiograph: 2, history: 3 };
    useEffect(() => {
        Animated.timing(underlineAnim, {
            toValue: TAB_INDEX[activeTab],
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [activeTab]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My EMR</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
                {TABS.map((tab, idx) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.tabItem}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.tabLabel,
                            activeTab === tab.key && styles.tabLabelActive,
                        ]}>
                            {tab.label}
                        </Text>
                        {activeTab === tab.key && <View style={styles.tabUnderline} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'treatment' && (
                    <TreatmentTab
                        logs={treatmentLogs}
                        loading={loading.treatment}
                        error={errors.treatment}
                        onRetry={fetchTreatment}
                    />
                )}
                {activeTab === 'odontogram' && (
                    <OdontogramTab
                        data={odontogramData}
                        loading={loading.odontogram}
                        error={errors.odontogram}
                        onRetry={fetchOdontogram}
                    />
                )}
                {activeTab === 'radiograph' && (
                    <RadiographTab
                        radiographs={radiographs}
                        loading={loading.radiograph}
                        error={errors.radiograph}
                        onRetry={fetchRadiographs}
                        navigation={navigation}
                    />
                )}
                {activeTab === 'history' && (
                    <HistoryTab
                        surgeries={surgeries}
                        loading={loading.history}
                        error={errors.history}
                        onRetry={fetchHistory}
                    />
                )}
            </View>
        </View>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const shared = StyleSheet.create({
    emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    loadingText:{ color: '#888', marginTop: 12, fontSize: 14 },
    errorBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, marginTop: 40 },
    errorText:  { color: '#d32f2f', fontSize: 14, textAlign: 'center', marginBottom: 16 },
    retryBtn:   { backgroundColor: '#01538b', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 8 },
    retryText:  { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container:   { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header:      { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn:     { padding: 5, width: 60 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    // Tab bar
    tabBar:        { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 13 },
    tabLabel:      { fontSize: 12, fontWeight: '600', color: '#aaa' },
    tabLabelActive:{ color: '#01538b' },
    tabUnderline:  { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 2.5, backgroundColor: '#01538b', borderRadius: 2 },

    // Treatment log cards
    logCard:      { backgroundColor: 'white', borderRadius: 14, marginBottom: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#e0e0e0', overflow: 'hidden' },
    logCardOpen:  { borderLeftColor: '#01538b' },
    logHeader:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
    logDateBox:   { alignItems: 'center', width: 48, marginRight: 12 },
    logMonth:     { fontSize: 10, fontWeight: 'bold', color: '#01538b', textTransform: 'uppercase' },
    logDay:       { fontSize: 22, fontWeight: 'bold', color: '#01538b', lineHeight: 24 },
    logYear:      { fontSize: 10, color: '#aaa' },
    logMeta:      { flex: 1 },
    logTitleRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    logProcedure: { fontSize: 14, fontWeight: 'bold', color: '#333', flex: 1 },
    logCategory:  { fontSize: 11, color: '#888', marginBottom: 2 },
    logDentist:   { fontSize: 12, color: '#555' },
    logTooth:     { fontSize: 11, color: '#aaa', marginTop: 2 },
    logNotesBox:  { backgroundColor: '#f9f9f9', padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    logNotesLabel:{ fontSize: 11, fontWeight: 'bold', color: '#01538b', marginBottom: 4 },
    logNotes:     { fontSize: 13, color: '#555', lineHeight: 19 },

    // Odontogram
    odontogramCard:   { backgroundColor: 'white', borderRadius: 14, padding: 16, elevation: 2, marginBottom: 16 },
    odontogramTitle:  { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 2 },
    odontogramSub:    { fontSize: 11, color: '#aaa', marginBottom: 16 },
    odontogramEmpty:  { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 10, marginBottom: 12 },
    odontogramEmptyText: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },
    jawLabel:     { fontSize: 11, fontWeight: '700', color: '#aaa', textAlign: 'center', letterSpacing: 1, marginVertical: 6 },
    jawRow:       { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' },
    midline:      { width: 2, height: 36, backgroundColor: '#e0e0e0', marginHorizontal: 3 },
    jawDivider:   { height: 1, backgroundColor: '#e0e0e0', marginVertical: 6 },
    toothCell:    { width: 30, height: 42, margin: 2, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    toothNum:     { fontSize: 9, fontWeight: 'bold' },
    toothStatus:  { fontSize: 6, textAlign: 'center', marginTop: 1, lineHeight: 8 },
    legendTitle:  { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 10 },
    legendGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    legendItem:   { flexDirection: 'row', alignItems: 'center' },
    legendDot:    { width: 14, height: 14, borderRadius: 3, borderWidth: 1, marginRight: 5 },
    legendLabel:  { fontSize: 11, color: '#666' },
    readOnlyBanner: { backgroundColor: '#e3f2fd', padding: 12, borderRadius: 10, alignItems: 'center' },
    readOnlyText:   { fontSize: 12, color: '#1565c0' },

    // Radiograph cards
    xrayCard:          { flex: 1, backgroundColor: 'white', borderRadius: 14, marginBottom: 12, elevation: 2, overflow: 'hidden' },
    xrayThumb:         { backgroundColor: '#1a1a2e', height: 90, alignItems: 'center', justifyContent: 'center' },
    xrayAvailableDot:  { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4caf50' },
    xrayInfo:          { padding: 10 },
    xrayLabel:         { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    xrayDate:          { fontSize: 11, color: '#888', marginBottom: 2 },
    xrayNotes:         { fontSize: 11, color: '#aaa', marginBottom: 4 },
    xrayTapHint:       { fontSize: 10, color: '#01538b', fontWeight: '700' },

    // History cards
    historyCard:       { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1, flexDirection: 'row', gap: 12 },
    historyLeft:       { width: 72, alignItems: 'center' },
    historyDate:       { fontSize: 12, fontWeight: 'bold', color: '#01538b', textAlign: 'center' },
    historyRight:      { flex: 1 },
    historyProcedure:  { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    historyStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    historyStatusText: { fontSize: 11, fontWeight: 'bold' },
});