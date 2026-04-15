// src/screens/patient/MedicalRecordsScreen.js
import React, { useEffect, useRef, useState, useContext } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList,
    Animated, ScrollView, ActivityIndicator
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000';

// ─── CATEGORY COLORS ────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
    Restoration: '#1565c0',
    Extraction: '#b71c1c',
    Prophylaxis: '#2e7d32',
    Orthodontics: '#6a1b9a',
    Endodontics: '#e65100',
    Prosthodontics: '#00838f',
    'Oral Surgery': '#c62828',
    Consultation: '#01579b',
    Other: '#546e7a',
};

// ─── DUMMY FALLBACK DATA ────────────────────────────────────────────────────
const DUMMY_TREATMENT_LOGS = [
    { _id: '1', date: '2026-02-25', procedure: 'Dental Implant Evaluation', category: 'Consultation', tooth: 'N/A', dentistName: 'Dr. Smile Brillante', branch: 'Marikina Branch', notes: 'Patient is a good candidate for implants. Scheduled for panoramic X-ray.' },
    { _id: '2', date: '2025-10-12', procedure: 'Tooth Extraction', category: 'Extraction', tooth: '48', dentistName: 'Dr. John Doe', branch: 'Rizal Branch', notes: 'Impacted wisdom tooth removed. Prescribed antibiotics for 7 days.' },
    { _id: '3', date: '2025-05-04', procedure: 'Oral Prophylaxis', category: 'Prophylaxis', tooth: 'All', dentistName: 'Dr. Smile Brillante', branch: 'Marikina Branch', notes: 'Mild plaque build-up. Advised patient to floss daily.' },
];

const DUMMY_DENTAL_HISTORY = {
    lastExamDate: '2026-02-25',
    chiefComplaint: 'Impacted wisdom teeth causing discomfort',
    notes: 'Patient has a history of bruxism. Night guard recommended for long-term use.'
};

const DUMMY_MEDICAL_HISTORY = {
    allergies: ['Penicillin'],
    conditions: ['Hypertension (mild)'],
    medications: ['Amlodipine 5mg'],
    notes: 'Patient tolerates local anesthesia well. No adverse reactions recorded.'
};

const DUMMY_RADIOGRAPHS = [
    { _id: 'r1', label: 'Panoramic X-Ray', date: '2026-02-20', notes: 'Panoramic taken before implant evaluation. Review with Dr. Brillante.', url: null },
    { _id: 'r2', label: 'Periapical X-Ray (Tooth 48)', date: '2025-10-12', notes: 'Pre-extraction radiograph for lower right wisdom tooth.', url: null },
];

// ─── SIMPLE ODONTOGRAM TEXT GRID ─────────────────────────────────────────────
// Upper row: 18-11, 21-28 | Lower row: 48-41, 31-38
const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

const STATUS_STYLES = {
    healthy:    { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    missing:    { bg: '#ffebee', border: '#ef5350', text: '#b71c1c' },
    crown:      { bg: '#fff8e1', border: '#ffa000', text: '#e65100' },
    decayed:    { bg: '#fce4ec', border: '#ec407a', text: '#880e4f' },
    filled:     { bg: '#e3f2fd', border: '#1e88e5', text: '#0d47a1' },
    extracted:  { bg: '#f3e5f5', border: '#ab47bc', text: '#6a1b9a' },
};
const DEFAULT_STATUS = STATUS_STYLES.healthy;

const TABS = ['Treatment Notes', 'Odontogram', 'Radiographs', 'History'];

export default function MedicalRecordsScreen({ navigation }) {
    const { userToken, userId } = useContext(AuthContext);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);

    const [treatmentLogs, setTreatmentLogs] = useState(DUMMY_TREATMENT_LOGS);
    const [odontogram, setOdontogram] = useState({});
    const [dentalHistory, setDentalHistory] = useState(DUMMY_DENTAL_HISTORY);
    const [medicalHistory, setMedicalHistory] = useState(DUMMY_MEDICAL_HISTORY);
    const [radiographs, setRadiographs] = useState(DUMMY_RADIOGRAPHS);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        fetchEMRData();
    }, []);

    const fetchEMRData = async () => {
        if (!userId || !userToken) return;
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${userToken}` };
            const [logsRes, odontogramRes, radiographsRes] = await Promise.all([
                fetch(`${API_URL}/api/patients/${userId}/treatment-logs`, { headers }),
                fetch(`${API_URL}/api/patients/${userId}/odontogram`, { headers }),
                fetch(`${API_URL}/api/patients/${userId}/radiographs`, { headers }),
            ]);

            if (logsRes.ok) {
                const logs = await logsRes.json();
                if (logs.length > 0) setTreatmentLogs(logs);
            }
            if (odontogramRes.ok) {
                const oData = await odontogramRes.json();
                setOdontogram(oData || {});
            }
            if (radiographsRes.ok) {
                const rData = await radiographsRes.json();
                if (rData.length > 0) setRadiographs(rData);
            }
        } catch (err) {
            // Use dummy data as fallback — already set in state
        } finally {
            setLoading(false);
        }
    };

    // ─── TAB: TREATMENT NOTES ────────────────────────────────────────────
    const renderTreatmentNotes = () => (
        <View>
            {treatmentLogs.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>No treatment notes yet.</Text>
                </View>
            ) : (
                treatmentLogs.map(item => {
                    const catStyle = CATEGORY_COLORS[item.category] || '#546e7a';
                    const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                    return (
                        <View key={item._id} style={[styles.logCard, { borderLeftColor: catStyle }]}>
                            <View style={styles.logHeader}>
                                <Text style={styles.logDate}>{dateStr}</Text>
                                <View style={[styles.categoryTag, { backgroundColor: catStyle }]}>
                                    <Text style={styles.categoryTagText}>{item.category}</Text>
                                </View>
                            </View>
                            <Text style={styles.logProcedure}>{item.procedure}</Text>
                            {item.tooth && item.tooth !== 'N/A' && (
                                <Text style={styles.logTooth}>Tooth: {item.tooth}</Text>
                            )}
                            {item.notes ? (
                                <Text style={styles.logNotes}>{item.notes}</Text>
                            ) : null}
                            <Text style={styles.logDentist}>{item.dentistName} • {item.branch}</Text>
                        </View>
                    );
                })
            )}
        </View>
    );

    // ─── TAB: ODONTOGRAM ─────────────────────────────────────────────────
    const renderToothBox = (toothNum) => {
        const status = odontogram[toothNum];
        const style = STATUS_STYLES[status] || DEFAULT_STATUS;
        return (
            <View key={toothNum} style={[styles.toothBox, { backgroundColor: style.bg, borderColor: style.border }]}>
                <Text style={[styles.toothNum, { color: style.text }]}>{toothNum}</Text>
                {status && status !== 'healthy' && (
                    <Text style={[styles.toothStatus, { color: style.text }]}>{status.charAt(0).toUpperCase()}</Text>
                )}
            </View>
        );
    };

    const renderOdontogram = () => (
        <View>
            <Text style={styles.odontogramNote}>
                The odontogram below shows the recorded status of each tooth as noted by your dentist.
            </Text>

            {/* Legend */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
                {Object.entries(STATUS_STYLES).map(([key, val]) => (
                    <View key={key} style={[styles.legendItem, { backgroundColor: val.bg, borderColor: val.border }]}>
                        <Text style={[styles.legendText, { color: val.text }]}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                    </View>
                ))}
            </ScrollView>

            {/* Upper Jaw */}
            <Text style={styles.jawLabel}>Upper Jaw</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.teethRow}>
                    {UPPER_TEETH.map(t => renderToothBox(t))}
                </View>
            </ScrollView>

            {/* Midline separator */}
            <View style={styles.midline} />

            {/* Lower Jaw */}
            <Text style={styles.jawLabel}>Lower Jaw</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.teethRow}>
                    {LOWER_TEETH.map(t => renderToothBox(t))}
                </View>
            </ScrollView>

            {Object.keys(odontogram).length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🦷</Text>
                    <Text style={styles.emptyText}>No odontogram entries yet. All teeth are shown as healthy.</Text>
                </View>
            )}
        </View>
    );

    // ─── TAB: RADIOGRAPHS ────────────────────────────────────────────────
    const renderRadiographs = () => (
        <View>
            {radiographs.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🩻</Text>
                    <Text style={styles.emptyText}>No radiograph images on file yet.</Text>
                </View>
            ) : (
                radiographs.map(r => {
                    const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                    return (
                        <TouchableOpacity
                            key={r._id}
                            style={styles.xrayCard}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('PatientXRayView', { radiograph: r })}
                        >
                            <View style={styles.xrayCardLeft}>
                                <View style={styles.xrayThumb}>
                                    <Text style={styles.xrayThumbIcon}>🩻</Text>
                                </View>
                            </View>
                            <View style={styles.xrayCardInfo}>
                                <Text style={styles.xrayLabel}>{r.label}</Text>
                                <Text style={styles.xrayDate}>Taken: {dateStr}</Text>
                                {r.notes ? <Text style={styles.xrayNotes} numberOfLines={2}>{r.notes}</Text> : null}
                            </View>
                            <Text style={styles.xrayArrow}>›</Text>
                        </TouchableOpacity>
                    );
                })
            )}
            <View style={styles.xrayDisclaimer}>
                <Text style={styles.xrayDisclaimerText}>
                    🔒 Radiograph images are uploaded and managed by your dentist. Tap an entry to view the full image.
                </Text>
            </View>
        </View>
    );

    // ─── TAB: HISTORY ────────────────────────────────────────────────────
    const renderHistory = () => (
        <View>
            {/* Dental History */}
            <Text style={styles.historyGroupTitle}>Dental History</Text>
            <View style={styles.historyCard}>
                {dentalHistory.lastExamDate && (
                    <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Last Exam</Text>
                        <Text style={styles.historyValue}>
                            {new Date(dentalHistory.lastExamDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </Text>
                    </View>
                )}
                {dentalHistory.chiefComplaint && (
                    <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Chief Complaint</Text>
                        <Text style={styles.historyValue}>{dentalHistory.chiefComplaint}</Text>
                    </View>
                )}
                {dentalHistory.notes && (
                    <View style={styles.historyNotesBox}>
                        <Text style={styles.historyNotesLabel}>Dentist Notes</Text>
                        <Text style={styles.historyNotesText}>{dentalHistory.notes}</Text>
                    </View>
                )}
            </View>

            {/* Medical History */}
            <Text style={[styles.historyGroupTitle, { marginTop: 10 }]}>Medical History</Text>
            <View style={styles.historyCard}>
                {medicalHistory.allergies?.length > 0 && (
                    <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Allergies</Text>
                        <Text style={[styles.historyValue, { color: '#d32f2f' }]}>{medicalHistory.allergies.join(', ')}</Text>
                    </View>
                )}
                {medicalHistory.conditions?.length > 0 && (
                    <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Conditions</Text>
                        <Text style={styles.historyValue}>{medicalHistory.conditions.join(', ')}</Text>
                    </View>
                )}
                {medicalHistory.medications?.length > 0 && (
                    <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Medications</Text>
                        <Text style={styles.historyValue}>{medicalHistory.medications.join(', ')}</Text>
                    </View>
                )}
                {medicalHistory.notes && (
                    <View style={styles.historyNotesBox}>
                        <Text style={styles.historyNotesLabel}>Clinical Notes</Text>
                        <Text style={styles.historyNotesText}>{medicalHistory.notes}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My EMR</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {TABS.map((tab, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.tab, activeTab === idx && styles.tabActive]}
                            onPress={() => setActiveTab(idx)}
                        >
                            <Text style={[styles.tabText, activeTab === idx && styles.tabTextActive]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.loadingText}>Loading records…</Text>
                </View>
            ) : (
                <Animated.ScrollView
                    style={{ flex: 1, opacity: fadeAnim }}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 0 && renderTreatmentNotes()}
                    {activeTab === 1 && renderOdontogram()}
                    {activeTab === 2 && renderRadiographs()}
                    {activeTab === 3 && renderHistory()}
                </Animated.ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    tabBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 1 },
    tabScroll: { paddingHorizontal: 10 },
    tab: { paddingVertical: 13, paddingHorizontal: 12, marginRight: 2 },
    tabActive: { borderBottomWidth: 3, borderBottomColor: '#01538b' },
    tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#01538b' },

    content: { padding: 18, paddingBottom: 40 },

    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, color: '#888', fontSize: 14 },

    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: { fontSize: 44, marginBottom: 12 },
    emptyText: { color: '#aaa', fontSize: 14, textAlign: 'center' },

    // Treatment Notes
    logCard: { backgroundColor: 'white', padding: 16, borderRadius: 15, marginBottom: 14, elevation: 2, borderLeftWidth: 5 },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    logDate: { fontSize: 13, fontWeight: 'bold', color: '#01538b' },
    categoryTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    categoryTagText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    logProcedure: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    logTooth: { fontSize: 12, color: '#888', marginBottom: 4 },
    logNotes: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 6, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8 },
    logDentist: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },

    // Odontogram
    odontogramNote: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 14 },
    legendScroll: { marginBottom: 14 },
    legendItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1.5, marginRight: 7 },
    legendText: { fontSize: 11, fontWeight: 'bold' },
    jawLabel: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8, marginTop: 4 },
    teethRow: { flexDirection: 'row', paddingBottom: 4 },
    toothBox: { width: 36, height: 44, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    toothNum: { fontSize: 10, fontWeight: 'bold' },
    toothStatus: { fontSize: 8, fontWeight: 'bold', marginTop: 1 },
    midline: { height: 2, backgroundColor: '#e0e0e0', marginVertical: 10, borderRadius: 2 },

    // Radiographs
    xrayCard: { backgroundColor: 'white', borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', padding: 14, elevation: 2 },
    xrayCardLeft: { marginRight: 14 },
    xrayThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#263238', alignItems: 'center', justifyContent: 'center' },
    xrayThumbIcon: { fontSize: 24 },
    xrayCardInfo: { flex: 1 },
    xrayLabel: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 2 },
    xrayDate: { fontSize: 12, color: '#01538b', fontWeight: '600', marginBottom: 3 },
    xrayNotes: { fontSize: 12, color: '#888', lineHeight: 16 },
    xrayArrow: { fontSize: 22, color: '#01538b', fontWeight: 'bold' },
    xrayDisclaimer: { backgroundColor: '#e3f2fd', padding: 13, borderRadius: 10, marginTop: 8 },
    xrayDisclaimerText: { fontSize: 12, color: '#1565c0', lineHeight: 17 },

    // History
    historyGroupTitle: { fontSize: 15, fontWeight: 'bold', color: '#01538b', marginBottom: 10 },
    historyCard: { backgroundColor: 'white', borderRadius: 15, padding: 16, elevation: 2, marginBottom: 8 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    historyLabel: { fontSize: 13, color: '#888', flex: 1 },
    historyValue: { fontSize: 13, color: '#333', fontWeight: '600', flex: 1.5, textAlign: 'right' },
    historyNotesBox: { marginTop: 10, backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10 },
    historyNotesLabel: { fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 4 },
    historyNotesText: { fontSize: 13, color: '#555', lineHeight: 18 },
});