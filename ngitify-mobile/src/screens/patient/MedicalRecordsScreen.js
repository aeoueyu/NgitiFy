import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, FlatList, Animated
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { logActivity } from '../../utils/logActivity';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header, Screen } from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'odontogram', label: 'Odontogram' },
    { key: 'radiograph', label: 'X-Rays' },
    { key: 'medical',    label: 'Medical History' },
];

// FDI tooth notation — 4 quadrants, upper then lower
const UPPER_RIGHT = [18,17,16,15,14,13,12,11]; // displayed right→left
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41]; // displayed right→left

const STATUS_COLORS = {
    healthy:            { bg: '#e8f5e9', text: '#2e7d32' },
    normal:             { bg: '#e8f5e9', text: '#2e7d32' },
    caries:             { bg: '#ffebee', text: '#c62828' },
    decayed:            { bg: '#ffebee', text: '#c62828' },
    missing:            { bg: '#eeeeee', text: '#757575' },
    crowned:            { bg: '#e3f2fd', text: '#1565c0' },
    crown:              { bg: '#e3f2fd', text: '#1565c0' },
    filled:             { bg: '#fff8e1', text: '#f57f17' },
    'root canal':       { bg: '#fce4ec', text: '#880e4f' },
    implant:            { bg: '#e8eaf6', text: '#283593' },
    fractured:          { bg: '#fff3e0', text: '#e65100' },
    'under observation': { bg: '#e0f7fa', text: '#006064' },
    extracted:          { bg: '#eeeeee', text: '#757575' },
    'extraction-site':  { bg: '#eeeeee', text: '#757575' },
    mobility:           { bg: '#fff3e0', text: '#e65100' },
    bridge:             { bg: '#e8eaf6', text: '#283593' },
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

const yesNoDisplay = (value) => (
    value === true ? 'Yes'
        : value === false ? 'No'
            : 'Not specified'
);

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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
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
    const normalizeToothData = (raw) => {
        if (!raw) return { status: '', surfaces: [] };
        if (typeof raw === 'string') return { status: raw, surfaces: [] };
        return {
            status: String(raw.status || ''),
            surfaces: Array.isArray(raw.surfaces) ? raw.surfaces.map((surface) => String(surface)) : [],
        };
    };

    const ToothCell = ({ num }) => {
        const toothData = normalizeToothData(data[String(num)]);
        const normalizedStatusKey = String(toothData.status || '').trim().toLowerCase();
        const statusLabel = toothData.status || '';
        const colors = normalizedStatusKey
            ? (STATUS_COLORS[normalizedStatusKey] || DEFAULT_STATUS_COLOR)
            : { bg: 'white', text: '#ccc' };
        const isMissing = ['missing', 'extracted', 'extraction-site'].includes(normalizedStatusKey);
        const surfaceSuffix = toothData.surfaces.length ? ` (${toothData.surfaces.join(', ')})` : '';

        return (
            <View style={[styles.toothCell, { backgroundColor: colors.bg, borderColor: colors.text + '55' }]}>
                <Text style={[styles.toothNum, { color: colors.text, textDecorationLine: isMissing ? 'line-through' : 'none' }]}>
                    {num}
                </Text>
                {statusLabel && !['healthy', 'normal'].includes(normalizedStatusKey) && (
                    <Text style={[styles.toothStatus, { color: colors.text }]} numberOfLines={1}>
                        {`${statusLabel}${surfaceSuffix}`.length > 12 ? `${statusLabel}${surfaceSuffix}`.slice(0, 11) + '…' : `${statusLabel}${surfaceSuffix}`}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
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
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
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
                        {item.radiographNumber ? (
                            <Text style={styles.xrayMeta} numberOfLines={1}>Radiograph No. {item.radiographNumber}</Text>
                        ) : null}
                        {item.findings ? (
                            <Text style={styles.xrayMeta} numberOfLines={2}>{item.findings}</Text>
                        ) : null}
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

function MedicalHistoryTab({ profile, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!profile) return (
        <EmptyState
            iconComponent={<Ionicons name="document-text-outline" size={40} color="#bbb" />}
            title="No Medical History Yet"
            sub="Your patient intake details will appear here once the clinic has completed your record."
        />
    );

    const medicalHistory = profile.medicalHistory || {};
    const dentalHistory = profile.dentalHistory || {};
    const physician = profile.physician || {};
    const allergies = Array.isArray(medicalHistory.allergies) ? medicalHistory.allergies : [];
    const conditions = Array.isArray(medicalHistory.conditions) ? medicalHistory.conditions : [];
    const medications = Array.isArray(medicalHistory.medications) ? medicalHistory.medications : [];
    const pairedRows = [
        ['Reason for Consultation', profile.reasonForConsultation || dentalHistory.chiefComplaint || 'Not specified'],
        ['Last Dental Visit', dentalHistory.lastExamDate ? fmtDate(dentalHistory.lastExamDate) : 'Not specified'],
        ['Reaction or Complication After Dental Treatment?', yesNoDisplay(dentalHistory.hadTreatmentReaction), 'If Yes, Please Detail', dentalHistory.reactionDetails || 'Not specified'],
        ['Under Medical Treatment Now?', yesNoDisplay(medicalHistory.underMedicalTreatment), 'Condition Treated', medicalHistory.medicalTreatmentDetails || 'Not specified'],
        ['Serious Illness or Surgical Operation?', yesNoDisplay(medicalHistory.hadSeriousIllnessOrSurgery), 'Illness or Operation Details', medicalHistory.seriousIllnessOrSurgeryDetails || 'Not specified'],
    ];

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            {(physician.name || physician.officeNumber) ? (
                <View style={styles.historySectionCard}>
                    <Text style={styles.historySectionTitle}>Attending Physician</Text>
                    <View style={styles.detailGrid}>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Physician Name</Text><Text style={styles.detailValue}>{physician.name || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Specialty</Text><Text style={styles.detailValue}>{physician.specialty || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Office Address</Text><Text style={styles.detailValue}>{physician.officeAddress || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Office Number</Text><Text style={styles.detailValue}>{physician.officeNumber || 'Not specified'}</Text></View>
                    </View>
                </View>
            ) : null}

            <View style={styles.historySectionCard}>
                <Text style={styles.historySectionTitle}>Medical and Dental History</Text>
                {pairedRows.map((row) => (
                    <View key={row[0]} style={styles.detailRowPair}>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailLabel}>{row[0]}</Text>
                            <Text style={styles.detailValue}>{row[1]}</Text>
                        </View>
                        {row[2] ? (
                            <View style={styles.detailCell}>
                                <Text style={styles.detailLabel}>{row[2]}</Text>
                                <Text style={styles.detailValue}>{row[3]}</Text>
                            </View>
                        ) : null}
                    </View>
                ))}

                <View style={styles.detailGrid}>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Private or Confidential Information to Discuss in Private?</Text><Text style={styles.detailValue}>{yesNoDisplay(dentalHistory.hasConfidentialInfo)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You in Good Health?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.inGoodHealth)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Ever Been Hospitalized?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.hadHospitalization)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Hospitalization Details</Text><Text style={styles.detailValue}>{medicalHistory.hospitalizationDetails || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Taking Prescription / Non-Prescription Medication?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isTakingMedication)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Medications</Text><Text style={styles.detailValue}>{medications.length ? medications.join(', ') : 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Use Tobacco Products?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.usesTobacco)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Use Alcohol, Cocaine, or Other Dangerous Drugs?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.usesAlcoholOrDrugs)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Has Allergies?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.hasAllergies)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Bleeding Time</Text><Text style={styles.detailValue}>{medicalHistory.bleedingTime || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Blood Pressure</Text><Text style={styles.detailValue}>{medicalHistory.bloodPressure || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Blood Type</Text><Text style={styles.detailValue}>{profile.bloodType || medicalHistory.bloodType || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You Pregnant?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isPregnant)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You Nursing?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isNursing)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Taking Birth Control Pills?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.takingBirthControl)}</Text></View>
                </View>

                <View style={styles.detailChecklistSection}>
                    <Text style={styles.detailLabel}>Allergy Checklist</Text>
                    <View style={styles.checklistGrid}>
                        {allergies.length ? allergies.map((item) => (
                            <View key={item} style={styles.checklistItem}>
                                <Ionicons name="checkbox-outline" size={16} color="#01538b" />
                                <Text style={styles.checklistText}>{item}</Text>
                            </View>
                        )) : <Text style={styles.detailValue}>No allergies recorded.</Text>}
                    </View>
                </View>

                <View style={styles.detailChecklistSection}>
                    <Text style={styles.detailLabel}>Medical Conditions Checklist</Text>
                    <View style={styles.checklistGrid}>
                        {conditions.length ? conditions.map((item) => (
                            <View key={item} style={styles.checklistItem}>
                                <Ionicons name="checkbox-outline" size={16} color="#01538b" />
                                <Text style={styles.checklistText}>{item}</Text>
                            </View>
                        )) : <Text style={styles.detailValue}>No medical conditions recorded.</Text>}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicalRecordsScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);

    const [activeTab, setActiveTab] = useState('odontogram');
    const underlineAnim = useRef(new Animated.Value(0)).current;

    // Per-tab state
    const [odontogramData, setOdontogramData] = useState({});
    const [radiographs,    setRadiographs]    = useState([]);
    const [profile,        setProfile]        = useState(null);

    const [loading, setLoading] = useState({ odontogram: false, radiograph: false, medical: false });
    const [errors,  setErrors]  = useState({ odontogram: '', radiograph: '', medical: '' });
    const [fetched, setFetched] = useState({ odontogram: false, radiograph: false, medical: false });

    const headers = { Authorization: `Bearer ${userToken}` };

    const setTabLoading = (tab, val) => setLoading(prev => ({ ...prev, [tab]: val }));
    const setTabError   = (tab, val) => setErrors(prev =>  ({ ...prev, [tab]: val }));
    const setTabFetched = (tab)      => setFetched(prev => ({ ...prev, [tab]: true }));

    // ── Fetchers ──────────────────────────────────────────────────────────────

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

    const fetchMedicalHistory = useCallback(async () => {
        setTabLoading('medical', true);
        setTabError('medical', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setProfile(data || null);
            setTabFetched('medical');
        } catch (e) {
            setTabError('medical', e.message || 'Could not load your medical history.');
        } finally {
            setTabLoading('medical', false);
        }
    }, [userToken, userId, API_BASE_URL]);

    const FETCHERS = {
        odontogram: fetchOdontogram,
        radiograph: fetchRadiographs,
        medical:    fetchMedicalHistory,
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
    const TAB_INDEX = { odontogram: 0, radiograph: 1, medical: 2 };
    useEffect(() => {
        Animated.timing(underlineAnim, {
            toValue: TAB_INDEX[activeTab],
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [activeTab]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Screen>
            <Header
                title="Records"
                subtitle="EMR, radiographs, and medical history"
            />

            <View style={styles.heroCard}>
                <View style={styles.heroIconBubble}>
                    <Ionicons name="document-text-outline" size={22} color="#ffffff" />
                </View>
                <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>Your dental record hub</Text>
                    <Text style={styles.heroText}>
                        Switch between odontogram, x-rays, and medical history without leaving the same patient record space.
                    </Text>
                </View>
            </View>

            <View style={styles.tabBar}>
                {TABS.map((tab, idx) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tabItem,
                            activeTab === tab.key && styles.tabItemActive,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.tabLabel,
                            activeTab === tab.key && styles.tabLabelActive,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab content */}
            <View style={{ flex: 1 }}>
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
                {activeTab === 'medical' && (
                    <MedicalHistoryTab
                        profile={profile}
                        loading={loading.medical}
                        error={errors.medical}
                        onRetry={fetchMedicalHistory}
                    />
                )}
            </View>

        </Screen>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const shared = StyleSheet.create({
    emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 8, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: mobileTheme.colors.textSoft, textAlign: 'center', lineHeight: 19 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    loadingText:{ color: mobileTheme.colors.textSoft, marginTop: 12, fontSize: 14 },
    errorBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, marginTop: 40 },
    errorText:  { color: '#d32f2f', fontSize: 14, textAlign: 'center', marginBottom: 16 },
    retryBtn:   { backgroundColor: mobileTheme.colors.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999 },
    retryText:  { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container:   { flex: 1, backgroundColor: mobileTheme.colors.background },
    heroCard: {
        marginHorizontal: 18,
        marginBottom: 16,
        backgroundColor: mobileTheme.colors.primary,
        borderRadius: 24,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroIconBubble: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginRight: 14,
    },
    heroCopy: {
        flex: 1,
    },
    heroTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 6,
    },
    heroText: {
        fontSize: 12,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.86)',
    },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 18,
        marginBottom: 10,
        backgroundColor: mobileTheme.colors.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        padding: 6,
        ...mobileTheme.shadows.soft,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 11,
        borderRadius: 16,
    },
    tabItemActive: {
        backgroundColor: mobileTheme.colors.primarySoft,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: mobileTheme.colors.textSoft,
    },
    tabLabelActive:{
        color: mobileTheme.colors.primaryDark,
    },

    // Treatment log cards
    logCard:      { backgroundColor: 'white', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, overflow: 'hidden', ...mobileTheme.shadows.soft },
    logCardOpen:  { borderColor: mobileTheme.colors.primary },
    logHeader:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
    logDateBox:   { alignItems: 'center', width: 48, marginRight: 12 },
    logMonth:     { fontSize: 10, fontWeight: 'bold', color: '#01538b', textTransform: 'uppercase' },
    logDay:       { fontSize: 22, fontWeight: 'bold', color: '#01538b', lineHeight: 24 },
    logYear:      { fontSize: 10, color: mobileTheme.colors.textSoft },
    logMeta:      { flex: 1 },
    logTitleRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    logProcedure: { fontSize: 14, fontWeight: 'bold', color: mobileTheme.colors.text, flex: 1 },
    logCategory:  { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 2 },
    logDentist:   { fontSize: 12, color: mobileTheme.colors.textMuted },
    logTooth:     { fontSize: 11, color: mobileTheme.colors.textSoft, marginTop: 2 },
    logNotesBox:  { backgroundColor: mobileTheme.colors.surfaceAlt, padding: 14, borderTopWidth: 1, borderTopColor: mobileTheme.colors.border },
    logNotesLabel:{ fontSize: 11, fontWeight: 'bold', color: mobileTheme.colors.primary, marginBottom: 4 },
    logNotes:     { fontSize: 13, color: mobileTheme.colors.textMuted, lineHeight: 19 },

    // Odontogram
    odontogramCard:   { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: mobileTheme.colors.border, ...mobileTheme.shadows.soft },
    odontogramTitle:  { fontSize: 16, fontWeight: 'bold', color: mobileTheme.colors.primary, marginBottom: 2 },
    odontogramSub:    { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 16 },
    odontogramEmpty:  { backgroundColor: mobileTheme.colors.surfaceAlt, padding: 16, borderRadius: 14, marginBottom: 12 },
    odontogramEmptyText: { fontSize: 13, color: mobileTheme.colors.textSoft, textAlign: 'center', lineHeight: 19 },
    jawLabel:     { fontSize: 11, fontWeight: '700', color: mobileTheme.colors.textSoft, textAlign: 'center', letterSpacing: 1, marginVertical: 6 },
    jawRow:       { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' },
    midline:      { width: 2, height: 36, backgroundColor: '#e0e0e0', marginHorizontal: 3 },
    jawDivider:   { height: 1, backgroundColor: '#e0e0e0', marginVertical: 6 },
    toothCell:    { width: 30, height: 42, margin: 2, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    toothNum:     { fontSize: 9, fontWeight: 'bold' },
    toothStatus:  { fontSize: 6, textAlign: 'center', marginTop: 1, lineHeight: 8 },
    legendTitle:  { fontSize: 13, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 10 },
    legendGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    legendItem:   { flexDirection: 'row', alignItems: 'center' },
    legendDot:    { width: 14, height: 14, borderRadius: 3, borderWidth: 1, marginRight: 5 },
    legendLabel:  { fontSize: 11, color: mobileTheme.colors.textMuted },
    readOnlyBanner: { backgroundColor: mobileTheme.colors.primarySoft, padding: 12, borderRadius: 14, alignItems: 'center' },
    readOnlyText:   { fontSize: 12, color: mobileTheme.colors.primaryDark },

    // Radiograph cards
    xrayCard:          { flex: 1, backgroundColor: 'white', borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, overflow: 'hidden', ...mobileTheme.shadows.soft },
    xrayThumb:         { backgroundColor: '#1a1a2e', height: 90, alignItems: 'center', justifyContent: 'center' },
    xrayAvailableDot:  { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4caf50' },
    xrayInfo:          { padding: 10 },
    xrayLabel:         { fontSize: 13, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 3 },
    xrayDate:          { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 2 },
    xrayMeta:          { fontSize: 11, color: '#64748b', marginBottom: 2 },
    xrayNotes:         { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 4 },
    xrayTapHint:       { fontSize: 10, color: mobileTheme.colors.primary, fontWeight: '700' },

    // History cards
    historyCard:       { backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: mobileTheme.colors.border, flexDirection: 'row', gap: 12 },
    historyLeft:       { width: 72, alignItems: 'center' },
    historyDate:       { fontSize: 12, fontWeight: 'bold', color: '#01538b', textAlign: 'center' },
    historyRight:      { flex: 1 },
    historyProcedure:  { fontSize: 14, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 3 },
    historyStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    historyStatusText: { fontSize: 11, fontWeight: 'bold' },
    historySectionCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, ...mobileTheme.shadows.soft },
    historySectionTitle: { fontSize: 16, fontWeight: '800', color: mobileTheme.colors.primary, marginBottom: 14 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detailRowPair: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    detailCell: { flex: 1, minWidth: 140, backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 14, padding: 12 },
    detailLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
    detailValue: { fontSize: 13, lineHeight: 18, color: mobileTheme.colors.textMuted },
    detailChecklistSection: { marginTop: 14 },
    checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    checklistItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
    checklistText: { flex: 1, fontSize: 12, color: mobileTheme.colors.textMuted },
});
