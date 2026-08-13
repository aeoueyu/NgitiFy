import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Animated, Modal, ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

const EDUCATION_ARTICLES = [
    {
        id: '1',
        iconName: 'toothbrush',
        iconLib: 'MaterialCommunityIcons',
        iconColor: '#01538b',
        title: 'Proper Brushing Technique',
        summary: 'Brush for 2 minutes, twice a day using circular motions at a 45 degree angle.',
        body: "Use a soft-bristled toothbrush and fluoride toothpaste. Hold the brush at a 45 degree angle to your gums. Use short, gentle circular strokes, never scrub. Brush outer surfaces, inner surfaces, and chewing surfaces of all teeth. Don't forget to brush your tongue to remove bacteria and freshen breath. Replace your toothbrush every 3 to 4 months.",
    },
    {
        id: '2',
        iconName: 'tooth-outline',
        iconLib: 'MaterialCommunityIcons',
        iconColor: '#00897b',
        title: 'Why Flossing Matters',
        summary: 'Flossing removes plaque from areas your toothbrush cannot reach.',
        body: 'Floss at least once a day, ideally before bed. Break off about 45 cm of floss and wind it around your middle fingers. Gently slide it between teeth in a C-shape motion, going just below the gumline. Using floss picks or a water flosser are equally effective alternatives. Skipping flossing leaves 40% of tooth surfaces uncleaned.',
    },
    {
        id: '3',
        iconName: 'nutrition-outline',
        iconLib: 'Ionicons',
        iconColor: '#2e7d32',
        title: 'Foods That Protect Your Teeth',
        summary: 'Cheese, leafy greens, and crunchy vegetables naturally strengthen enamel.',
        body: 'Dairy products provide calcium and phosphates that remineralize enamel. Crunchy fruits and vegetables like apples and carrots increase saliva production, washing away bacteria. Leafy greens are rich in calcium and folic acid. Green and black teas contain polyphenols that suppress bacteria. Drink plenty of water throughout the day.',
    },
    {
        id: '4',
        iconName: 'cafe-outline',
        iconLib: 'Ionicons',
        iconColor: '#c62828',
        title: 'Habits That Harm Your Teeth',
        summary: 'Coffee, soda, and tobacco significantly accelerate dental decay.',
        body: 'Sugary and acidic drinks erode enamel over time. Sipping throughout the day is worse than drinking in one sitting. Tobacco use causes gum disease, tooth loss, and oral cancer. Grinding your teeth damages enamel and causes jaw pain, so ask your dentist about a night guard. Using your teeth to open packaging or bottles can cause chips or fractures.',
    },
];

const ORAL_HEALTH_TIPS = [
    { id: '1', iconName: 'sunny-outline', iconLib: 'Ionicons', iconColor: '#f57f17', title: 'Morning Routine', tip: 'Brush and rinse before breakfast to remove overnight bacteria buildup.' },
    { id: '2', iconName: 'moon-outline', iconLib: 'Ionicons', iconColor: '#5c6bc0', title: 'Night Routine', tip: 'Brush and floss before bed. This is the most important brushing session.' },
    { id: '3', iconName: 'water-outline', iconLib: 'Ionicons', iconColor: '#0288d1', title: 'Stay Hydrated', tip: 'Drink water after meals to rinse away food particles and acid.' },
    { id: '4', iconName: 'flask-outline', iconLib: 'Ionicons', iconColor: '#00897b', title: 'Mouthwash', tip: 'Use fluoride or antibacterial mouthwash to reach areas brushing misses.' },
    { id: '5', iconName: 'calendar-outline', iconLib: 'Ionicons', iconColor: '#01538b', title: 'Regular Check-ups', tip: 'Visit your dentist every 6 months for cleaning and early detection.' },
    { id: '6', iconName: 'toothbrush', iconLib: 'MaterialCommunityIcons', iconColor: '#6a1b9a', title: 'Change Your Brush', tip: 'Replace your toothbrush every 3 months or after any illness.' },
];

const SECTIONS = ['overview', 'education', 'oralHealth', 'visitWindow'];
const SECTION_LABELS = {
    overview: 'Overview',
    education: 'Education',
    oralHealth: 'Oral Health',
    visitWindow: 'Visit Window',
};

const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const buildVisitWindowMarkedDates = (visitInfo, selectedDate) => {
    if ((!visitInfo?.windowStart && !visitInfo?.windowStartKey)
        || (!visitInfo?.windowEnd && !visitInfo?.windowEndKey)) return {};

    const windowStart = parseDateKey(visitInfo.windowStartKey) || new Date(visitInfo.windowStart);
    const windowEnd = parseDateKey(visitInfo.windowEndKey) || new Date(visitInfo.windowEnd);
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) return {};

    const markedDates = {};
    const cursor = new Date(windowStart);
    const selectedKey = selectedDate || visitInfo.recommendedDateKey || toDateKey(windowStart);

    while (cursor <= windowEnd) {
        const key = toDateKey(cursor);
        const isSelected = key === selectedKey;
        markedDates[key] = {
            selected: true,
            selectedColor: isSelected ? '#01538b' : '#bfeffc',
            selectedTextColor: isSelected ? '#ffffff' : '#01538b',
        };
        cursor.setDate(cursor.getDate() + 1);
    }

    if (selectedKey && !markedDates[selectedKey]) {
        markedDates[selectedKey] = {
            selected: true,
            selectedColor: '#01538b',
            selectedTextColor: '#ffffff',
        };
    }

    return markedDates;
};

function DynamicIcon({ iconName, iconLib, iconColor, size }) {
    if (iconLib === 'MaterialCommunityIcons') {
        return <MaterialCommunityIcons name={iconName} size={size} color={iconColor} />;
    }
    return <Ionicons name={iconName} size={size} color={iconColor} />;
}

export default function AiPatientCareCompanionScreen({ navigation, route }) {
    const { userToken, API_BASE_URL } = useContext(AuthContext);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [activeSection, setActiveSection] = useState('overview');
    const [selectedVisitDate, setSelectedVisitDate] = useState(route?.params?.focusDate || '');
    const [visitInfo, setVisitInfo] = useState(null);
    const [treatmentHistory, setTreatmentHistory] = useState([]);
    const [loadingVisit, setLoadingVisit] = useState(true);
    const [selectedArticle, setSelectedArticle] = useState(null);

    const authHeader = { Authorization: `Bearer ${userToken}` };

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, [fadeAnim]);

    const fetchLastVisit = useCallback(async () => {
        setLoadingVisit(true);
        try {
            const [logsRes, predictionRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/my/treatment-logs`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/api/my/visit-prediction`, { headers: authHeader }),
            ]);

            if (!logsRes.ok || !predictionRes.ok) throw new Error();

            const logs = await logsRes.json();
            const predictionPayload = await predictionRes.json();
            setTreatmentHistory(Array.isArray(logs) ? logs : []);
            setVisitInfo(predictionPayload?.prediction || null);
        } catch {
            setTreatmentHistory([]);
            setVisitInfo(null);
        } finally {
            setLoadingVisit(false);
        }
    }, [userToken, API_BASE_URL]);

    useEffect(() => {
        fetchLastVisit();
    }, [fetchLastVisit]);

    useEffect(() => {
        if (route?.params?.initialSection && SECTIONS.includes(route.params.initialSection)) {
            setActiveSection(route.params.initialSection);
        }
        if (route?.params?.focusDate) {
            setSelectedVisitDate(route.params.focusDate);
        }
    }, [route?.params?.focusDate, route?.params?.initialSection]);

    // ─── RENDERS ─────────────────────────────────────────────────────────────

    const renderOverview = () => {
        const isLoadingBanner = loadingVisit;
        const hasPrediction   = !!visitInfo;

        return (
            <View>
                <Text style={styles.welcomeText}>
                    Your personal AI-powered companion for dental care, education, and visit guidance.
                </Text>

                <View style={styles.featureGrid}>

                    <TouchableOpacity
                        style={[styles.featureCard, { backgroundColor: '#1565c0' }]}
                        onPress={() => setActiveSection('education')}
                    >
                        <Ionicons name="book-outline" size={28} color="white" style={styles.featureIcon} />
                        <Text style={styles.featureCardTitle}>Dental Health Education</Text>
                        <Text style={styles.featureCardSub}>Learn about oral care</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.featureCard, { backgroundColor: '#00695c' }]}
                        onPress={() => setActiveSection('oralHealth')}
                    >
                        <MaterialCommunityIcons name="tooth-outline" size={28} color="white" style={styles.featureIcon} />
                        <Text style={styles.featureCardTitle}>Oral Health Management</Text>
                        <Text style={styles.featureCardSub}>Daily care reminders & tips</Text>
                    </TouchableOpacity>
                </View>

                {/* Predictive Visit Window summary card */}
                {isLoadingBanner ? (
                    <View style={styles.visitBannerLoading}>
                        <ActivityIndicator size="small" color="#01538b" />
                        <Text style={styles.visitBannerLoadingText}>Loading visit prediction…</Text>
                    </View>
                ) : hasPrediction ? (
                    <TouchableOpacity
                        style={[styles.visitBanner, { backgroundColor: visitInfo.bg, borderColor: visitInfo.color }]}
                        onPress={() => setActiveSection('visitWindow')}
                        activeOpacity={0.8}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.visitBannerLabel, { color: visitInfo.color }]}>Next Visit Prediction</Text>
                            <Text style={styles.visitBannerDate}>{visitInfo.windowLabel || visitInfo.nextDate}</Text>
                        </View>
                        <View style={[styles.visitTag, { backgroundColor: visitInfo.color }]}>
                            <Text style={styles.visitTagText}>{visitInfo.label}</Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.visitBanner, { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0' }]}
                        onPress={() => setActiveSection('visitWindow')}
                        activeOpacity={0.8}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.visitBannerLabel, { color: '#aaa' }]}>Visit Prediction</Text>
                            <Text style={[styles.visitBannerDate, { color: '#bbb', fontSize: 14 }]}>
                                No treatment history yet
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderEducation = () => (
        <View>
            <Text style={styles.sectionHeader}>Dental Health Education</Text>
            <Text style={styles.sectionSub}>Evidence-based tips to keep your smile healthy every day.</Text>

            {EDUCATION_ARTICLES.map(article => (
                <TouchableOpacity
                    key={article.id}
                    style={styles.articleCard}
                    onPress={() => setSelectedArticle(article)}
                    activeOpacity={0.8}
                >
                    <View style={[styles.articleIconCircle, { backgroundColor: article.iconColor + '20' }]}>
                        <DynamicIcon
                            iconName={article.iconName}
                            iconLib={article.iconLib}
                            iconColor={article.iconColor}
                            size={26}
                        />
                    </View>
                    <View style={styles.articleInfo}>
                        <Text style={styles.articleTitle}>{article.title}</Text>
                        <Text style={styles.articleSummary}>{article.summary}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#01538b" />
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderOralHealth = () => (
        <View>
            <Text style={styles.sectionHeader}>Oral Health Management</Text>
            <Text style={styles.sectionSub}>Build daily habits that protect your teeth and gums long-term.</Text>

            <View style={styles.tipGrid}>
                {ORAL_HEALTH_TIPS.map(tip => (
                    <View key={tip.id} style={styles.tipCard}>
                        <DynamicIcon
                            iconName={tip.iconName}
                            iconLib={tip.iconLib}
                            iconColor={tip.iconColor}
                            size={24}
                        />
                        <Text style={styles.tipTitle}>{tip.title}</Text>
                        <Text style={styles.tipText}>{tip.tip}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.highlightCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="trophy-outline" size={16} color="#f57f17" style={{ marginRight: 6 }} />
                    <Text style={styles.highlightTitle}>Did You Know?</Text>
                </View>
                <Text style={styles.highlightText}>
                    Poor oral health is linked to heart disease, diabetes, and respiratory infections.
                    Brushing twice daily reduces your risk of systemic disease by up to 30%.
                </Text>
            </View>

            {/* Persistent Visit CTA */}
            <TouchableOpacity
                style={styles.bookVisitBtn}
                onPress={() => navigation.navigate('AppointmentBooking')}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar-outline" size={16} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.bookVisitBtnText}>Book Your Next Visit</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderVisitWindow = () => {
        const markedDates = buildVisitWindowMarkedDates(visitInfo, selectedVisitDate);
        const calendarFocusDate = selectedVisitDate || visitInfo?.recommendedDateKey || visitInfo?.windowStartKey;

        if (loadingVisit) {
            return (
                <View style={styles.visitLoadingBox}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.visitLoadingText}>Loading your visit data…</Text>
                </View>
            );
        }

        if (!visitInfo) {
            return (
                <View>
                    <Text style={styles.sectionHeader}>Predictive Visit Window</Text>
                    <View style={styles.visitEmptyCard}>
                        <MaterialCommunityIcons name="tooth-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                        <Text style={styles.visitEmptyTitle}>No Visit History Yet</Text>
                        <Text style={styles.visitEmptySub}>
                            Your predicted next visit will appear here after your first recorded treatment.
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.bookVisitBtn}
                        onPress={() => navigation.navigate('AppointmentBooking')}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calendar-outline" size={16} color="white" style={{ marginRight: 8 }} />
                            <Text style={styles.bookVisitBtnText}>Book Your First Visit</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View>
                <Text style={styles.sectionHeader}>Predictive Visit Window</Text>
                <Text style={styles.sectionSub}>
                    Based on your treatment history, here is when we recommend your next clinic visit.
                </Text>

                <View style={[styles.visitMainCard, { backgroundColor: visitInfo.bg, borderColor: visitInfo.color }]}>
                    <Text style={[styles.visitStatus, { color: visitInfo.color }]}>{visitInfo.label}</Text>
                    <Text style={styles.visitNextDate}>{visitInfo.windowLabel || visitInfo.nextDate}</Text>
                    {visitInfo.label === 'Overdue' ? (
                        <Text style={[styles.visitDaysText, { color: '#d32f2f' }]}>
                            {visitInfo.daysPastWindow || visitInfo.days} day(s) past the recommended window
                        </Text>
                    ) : visitInfo.label === 'Window Open' ? (
                        <Text style={styles.visitDaysText}>Your recommended visit window is open now</Text>
                    ) : (
                        <Text style={styles.visitDaysText}>
                            {visitInfo.daysUntilWindowStart} day(s) until the recommended window starts
                        </Text>
                    )}
                </View>

                <Calendar
                    current={calendarFocusDate || undefined}
                    markedDates={markedDates}
                    onDayPress={(day) => setSelectedVisitDate(day.dateString)}
                    theme={{
                        selectedDayBackgroundColor: '#01538b',
                        todayTextColor: '#01538b',
                        arrowColor: '#01538b',
                        textDayFontWeight: '600',
                        textMonthFontWeight: '700',
                        textDayHeaderFontWeight: '700',
                        calendarBackground: 'white',
                        textSectionTitleColor: '#01538b',
                        monthTextColor: '#234051',
                    }}
                    style={styles.visitCalendar}
                />

                <View style={styles.visitLegendRow}>
                    <View style={styles.visitLegendItem}>
                        <View style={[styles.visitLegendDot, { backgroundColor: '#01538b' }]} />
                        <Text style={styles.visitLegendText}>Selected day</Text>
                    </View>
                    <View style={styles.visitLegendItem}>
                        <View style={[styles.visitLegendDot, { backgroundColor: '#bfeffc' }]} />
                        <Text style={styles.visitLegendText}>Predicted window</Text>
                    </View>
                </View>

                <View style={styles.visitDetailsCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="clipboard-outline" size={16} color="#333" style={{ marginRight: 6 }} />
                        <Text style={styles.visitDetailTitle}>Based On</Text>
                    </View>
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Last Visit:</Text>
                        <Text style={styles.visitDetailValue}>{fmtDate(visitInfo.lastVisitDate)}</Text>
                    </View>
                    {visitInfo.lastProcedure ? (
                        <View style={styles.visitDetailRow}>
                            <Text style={styles.visitDetailLabel}>Last Procedure:</Text>
                            <Text style={styles.visitDetailValue}>{visitInfo.lastProcedure}</Text>
                        </View>
                    ) : null}
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Recommended Window:</Text>
                        <Text style={styles.visitDetailValue}>{visitInfo.windowLabel}</Text>
                    </View>
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Recommended Visit:</Text>
                        <Text style={styles.visitDetailValue}>{visitInfo.recommendedDateLabel || visitInfo.nextDate}</Text>
                    </View>
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Treatment Records Used:</Text>
                        <Text style={styles.visitDetailValue}>{visitInfo.historyCount}</Text>
                    </View>
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Recommended Interval:</Text>
                        <Text style={styles.visitDetailValue}>{visitInfo.intervalLabel || 'Every 6 months'}</Text>
                    </View>
                    <View style={styles.visitDetailRow}>
                        <Text style={styles.visitDetailLabel}>Recommendation Basis:</Text>
                        <Text style={styles.visitDetailValue}>{visitInfo.recommendationReason}</Text>
                    </View>
                </View>

                <View style={styles.visitDetailsCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="time-outline" size={16} color="#333" style={{ marginRight: 6 }} />
                        <Text style={styles.visitDetailTitle}>Recent Treatment History</Text>
                    </View>
                    {treatmentHistory.slice(0, 5).map((log, index) => (
                        <View key={log._id || `${log.date}-${index}`} style={styles.historyRow}>
                            <View style={styles.historyDot} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyProcedure}>{log.procedure || 'Treatment recorded'}</Text>
                                <Text style={styles.historyDate}>{fmtDate(log.date)}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.visitTipCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="bulb-outline" size={16} color="#2e7d32" style={{ marginRight: 6 }} />
                        <Text style={styles.visitTipTitle}>Why Regular Visits Matter</Text>
                    </View>
                    <Text style={styles.visitTipText}>
                        Routine check-ups allow your dentist to catch cavities, gum disease, and other issues
                        before they become serious. Early detection saves you pain, time, and cost.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.bookVisitBtn}
                    onPress={() => navigation.navigate('AppointmentBooking')}
                    activeOpacity={0.8}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="calendar-outline" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.bookVisitBtnText}>Book Your Next Visit</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    // ─── Root render ─────────────────────────────────────────────────────────
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
                <Text style={styles.headerTitle}>AI Care Companion</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScroll}
                >
                    {SECTIONS.map(sec => (
                        <TouchableOpacity
                            key={sec}
                            style={[styles.tab, activeSection === sec && styles.tabActive]}
                            onPress={() => setActiveSection(sec)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, activeSection === sec && styles.tabTextActive]}>
                                {SECTION_LABELS[sec]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content */}
            <Animated.ScrollView
                style={{ flex: 1, opacity: fadeAnim }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {activeSection === 'overview'    && renderOverview()}
                {activeSection === 'education'   && renderEducation()}
                {activeSection === 'oralHealth'  && renderOralHealth()}
                {activeSection === 'visitWindow' && renderVisitWindow()}
            </Animated.ScrollView>


            {/* Article Detail Modal */}
            <Modal
                visible={!!selectedArticle}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedArticle(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {selectedArticle && (
                            <View style={styles.modalIconCircle}>
                                <DynamicIcon
                                    iconName={selectedArticle.iconName}
                                    iconLib={selectedArticle.iconLib}
                                    iconColor={selectedArticle.iconColor}
                                    size={36}
                                />
                            </View>
                        )}
                        <Text style={styles.modalTitle}>{selectedArticle?.title}</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalBody}>{selectedArticle?.body}</Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setSelectedArticle(null)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header: {
        backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { padding: 5, width: 60 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },

    // Tabs
    tabBar:        { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 1 },
    tabScroll:     { paddingHorizontal: 10 },
    tab:           { paddingVertical: 12, paddingHorizontal: 14, marginRight: 2 },
    tabActive:     { borderBottomWidth: 3, borderBottomColor: '#01538b' },
    tabText:       { fontSize: 13, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#01538b' },

    // Content
    content:     { padding: 20, paddingBottom: 48 },
    welcomeText: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },

    // Feature grid
    featureGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    featureCard:      { width: '48%', padding: 18, borderRadius: 15, marginBottom: 12, elevation: 2 },
    featureCardTitle: { color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
    featureCardSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },

    // Visit banner (overview)
    visitBanner:            { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, borderWidth: 1.5, elevation: 1 },
    visitBannerLabel:       { fontWeight: 'bold', fontSize: 12, marginBottom: 3 },
    visitBannerDate:        { fontSize: 15, fontWeight: 'bold', color: '#333' },
    visitTag:               { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    visitTagText:           { color: 'white', fontWeight: 'bold', fontSize: 12 },
    visitBannerLoading:     { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#e0e0e0' },
    visitBannerLoadingText: { marginLeft: 10, fontSize: 13, color: '#aaa' },

    // Section headers
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#01538b', marginBottom: 6 },
    sectionSub:    { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 20 },

    // Inquiry
    fieldLabel:             { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
    categoryRow:            { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },

    // Education
    articleCard:    { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    articleInfo:    { flex: 1 },
    articleTitle:   { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    articleSummary: { fontSize: 12, color: '#888', lineHeight: 17 },

    // Oral health tips
    tipGrid:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
    tipCard:       { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
    tipTitle:      { fontWeight: 'bold', fontSize: 13, color: '#01538b', marginBottom: 4 },
    tipText:       { fontSize: 12, color: '#666', lineHeight: 16 },
    highlightCard: { backgroundColor: '#fff8e1', padding: 18, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#f9a825', marginBottom: 16 },
    highlightText: { fontSize: 13, color: '#555', lineHeight: 20 },

    // Visit window
    visitLoadingBox:    { alignItems: 'center', paddingVertical: 60 },
    visitLoadingText:   { color: '#888', marginTop: 12, fontSize: 14 },
    visitEmptyCard:     { backgroundColor: 'white', borderRadius: 15, padding: 30, alignItems: 'center', elevation: 2, marginBottom: 16 },
    visitEmptyTitle:    { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 8 },
    visitEmptySub:      { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19 },
    visitMainCard:      { padding: 25, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', marginBottom: 15, elevation: 1 },
    visitStatus:        { fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
    visitNextDate:      { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    visitDaysText:      { fontSize: 13, color: '#888' },
    visitCalendar:      { borderWidth: 1, borderColor: '#dfeef6', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    visitLegendRow:     { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
    visitLegendItem:    { flexDirection: 'row', alignItems: 'center', marginRight: 18, marginBottom: 8 },
    visitLegendDot:     { width: 10, height: 10, borderRadius: 5, marginRight: 7 },
    visitLegendText:    { fontSize: 12, color: '#6f8593' },
    visitDetailsCard:   { backgroundColor: 'white', padding: 18, borderRadius: 15, marginBottom: 15, elevation: 2 },
    visitDetailRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    visitDetailLabel:   { fontSize: 13, color: '#888', flex: 1 },
    visitDetailValue:   { fontSize: 13, color: '#333', fontWeight: '600', flex: 1.2, textAlign: 'right' },
    historyRow:         { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eef4f8' },
    historyDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2dccf6', marginTop: 5, marginRight: 10 },
    historyProcedure:   { fontSize: 13, fontWeight: '700', color: '#01538b', marginBottom: 3 },
    historyDate:        { fontSize: 12, color: '#6b7c87' },
    visitTipCard:       { backgroundColor: '#e8f5e9', padding: 18, borderRadius: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#4caf50' },
    visitTipText:       { fontSize: 13, color: '#555', lineHeight: 20 },
    bookVisitBtn:       { backgroundColor: '#01538b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', elevation: 2, marginTop: 4 },
    bookVisitBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // Article modal
    modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard:         { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: '75%' },
    modalTitle:        { fontSize: 20, fontWeight: 'bold', color: '#01538b', textAlign: 'center', marginBottom: 15 },
    modalBody:         { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 20 },
    modalCloseBtn:     { backgroundColor: '#01538b', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalCloseBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    featureIcon:      { marginBottom: 8 },
    articleIconCircle:{ width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    modalIconCircle:  { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f3f7f9', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
    highlightTitle:   { fontWeight: 'bold', fontSize: 14, color: '#f57f17' },
    visitDetailTitle: { fontWeight: 'bold', fontSize: 14, color: '#333' },
    visitTipTitle:    { fontWeight: 'bold', fontSize: 14, color: '#2e7d32' },
});
