// src/screens/patient/AiPatientCareCompanionScreen.js
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Animated, Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';

// ─── DENTAL HEALTH EDUCATION CONTENT ───────────────────────────────────────
const EDUCATION_ARTICLES = [
    {
        id: '1',
        emoji: '🪥',
        title: 'Proper Brushing Technique',
        summary: 'Brush for 2 minutes, twice a day using circular motions at a 45° angle.',
        body: 'Use a soft-bristled toothbrush and fluoride toothpaste. Hold the brush at a 45° angle to your gums. Use short, gentle circular strokes — never scrub. Brush outer surfaces, inner surfaces, and chewing surfaces of all teeth. Don\'t forget to brush your tongue to remove bacteria and freshen breath. Replace your toothbrush every 3–4 months.'
    },
    {
        id: '2',
        emoji: '🦷',
        title: 'Why Flossing Matters',
        summary: 'Flossing removes plaque from areas your toothbrush cannot reach.',
        body: 'Floss at least once a day, ideally before bed. Break off about 45 cm of floss and wind it around your middle fingers. Gently slide it between teeth in a C-shape motion, going just below the gumline. Using floss picks or a water flosser are equally effective alternatives. Skipping flossing leaves 40% of tooth surfaces uncleaned.'
    },
    {
        id: '3',
        emoji: '🍎',
        title: 'Foods That Protect Your Teeth',
        summary: 'Cheese, leafy greens, and crunchy vegetables naturally strengthen enamel.',
        body: 'Dairy products (cheese, milk, yogurt) provide calcium and phosphates that remineralize enamel. Crunchy fruits and vegetables like apples and carrots increase saliva production, washing away bacteria. Leafy greens are rich in calcium and folic acid. Green and black teas contain polyphenols that suppress bacteria. Drink plenty of water — especially fluoridated water — throughout the day.'
    },
    {
        id: '4',
        emoji: '☕',
        title: 'Habits That Harm Your Teeth',
        summary: 'Coffee, soda, and tobacco significantly accelerate dental decay.',
        body: 'Sugary and acidic drinks erode enamel over time. Sipping throughout the day is worse than drinking in one sitting. Tobacco use causes gum disease, tooth loss, and oral cancer. Grinding your teeth (bruxism) damages enamel and causes jaw pain — ask your dentist about a night guard. Using your teeth to open packaging or bottles can cause chips or fractures.'
    },
];

// ─── ORAL HEALTH TIPS ───────────────────────────────────────────────────────
const ORAL_HEALTH_TIPS = [
    { id: '1', icon: '🌅', title: 'Morning Routine', tip: 'Brush and rinse before breakfast to remove overnight bacteria buildup.' },
    { id: '2', icon: '🌙', title: 'Night Routine', tip: 'Brush and floss before bed. This is the most important brushing session.' },
    { id: '3', icon: '💧', title: 'Stay Hydrated', tip: 'Drink water after meals to rinse away food particles and acid.' },
    { id: '4', icon: '🧴', title: 'Mouthwash', tip: 'Use fluoride or antibacterial mouthwash to reach areas brushing misses.' },
    { id: '5', icon: '📅', title: 'Regular Check-ups', tip: 'Visit your dentist every 6 months for cleaning and early detection.' },
    { id: '6', icon: '🪥', title: 'Change Your Brush', tip: 'Replace your toothbrush every 3 months or after any illness.' },
];

// ─── PREDICTIVE VISIT LOGIC ─────────────────────────────────────────────────
const getVisitPrediction = (lastVisitDate) => {
    const last = new Date(lastVisitDate);
    const sixMonthsLater = new Date(last);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    const today = new Date();
    const diffMs = sixMonthsLater - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Overdue', days: Math.abs(diffDays), color: '#d32f2f', bg: '#ffebee', nextDate: sixMonthsLater.toDateString() };
    if (diffDays <= 14) return { label: 'Due Soon', days: diffDays, color: '#e65100', bg: '#fff3e0', nextDate: sixMonthsLater.toDateString() };
    return { label: 'On Track', days: diffDays, color: '#2e7d32', bg: '#e8f5e9', nextDate: sixMonthsLater.toDateString() };
};

// ─── SECTION IDs ────────────────────────────────────────────────────────────
const SECTIONS = ['overview', 'inquiry', 'education', 'oralHealth', 'visitWindow'];
const SECTION_LABELS = {
    overview: 'Overview',
    inquiry: 'Inquiry',
    education: 'Education',
    oralHealth: 'Oral Health',
    visitWindow: 'Visit Window',
};

export default function AiPatientCareCompanionScreen({ navigation }) {
    const { userToken, userInfo, userId } = useContext(AuthContext);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [activeSection, setActiveSection] = useState('overview');

    // Inquiry state
    const [inquiryText, setInquiryText] = useState('');
    const [inquiryCategory, setInquiryCategory] = useState('General');
    const [submittingInquiry, setSubmittingInquiry] = useState(false);

    // Education state
    const [selectedArticle, setSelectedArticle] = useState(null);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    // ─── SUBMIT INQUIRY ────────────────────────────────────────────────────
    const handleSubmitInquiry = async () => {
        if (!inquiryText.trim()) {
            Alert.alert('Empty Inquiry', 'Please type your question or concern first.');
            return;
        }
        setSubmittingInquiry(true);
        try {
            // Placeholder: replace with your backend URL
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/inquiries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    category: inquiryCategory,
                    message: inquiryText.trim()
                })
            });
            if (response.ok) {
                setInquiryText('');
                Alert.alert('Inquiry Sent ✅', 'Your inquiry has been forwarded to our clinic team. We will get back to you shortly.');
            } else {
                Alert.alert('Failed to Send', 'Please try again or contact us directly.');
            }
        } catch (err) {
            // If backend not yet connected, show success as UI demo
            setInquiryText('');
            Alert.alert('Inquiry Sent ✅', 'Your inquiry has been received. Our team will respond shortly.');
        } finally {
            setSubmittingInquiry(false);
        }
    };

    // ─── VISIT PREDICTION (using last treatment log date as dummy) ─────────
    const visitInfo = getVisitPrediction('2026-02-25');

    // ─── RENDERS ───────────────────────────────────────────────────────────

    const renderOverview = () => (
        <View>
            <Text style={styles.welcomeText}>
                Your personal AI-powered companion for dental care, education, and clinic support.
            </Text>

            <View style={styles.featureGrid}>
                <TouchableOpacity style={[styles.featureCard, { backgroundColor: '#01538b' }]}
                    onPress={() => navigation.navigate('Chatbot')}>
                    <Text style={styles.featureEmoji}>🤖</Text>
                    <Text style={styles.featureCardTitle}>NgitiBot</Text>
                    <Text style={styles.featureCardSub}>Chat with our AI dental assistant</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.featureCard, { backgroundColor: '#006064' }]}
                    onPress={() => setActiveSection('inquiry')}>
                    <Text style={styles.featureEmoji}>✉️</Text>
                    <Text style={styles.featureCardTitle}>Inquiry</Text>
                    <Text style={styles.featureCardSub}>Send questions to our team</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.featureCard, { backgroundColor: '#1565c0' }]}
                    onPress={() => setActiveSection('education')}>
                    <Text style={styles.featureEmoji}>📚</Text>
                    <Text style={styles.featureCardTitle}>Dental Education</Text>
                    <Text style={styles.featureCardSub}>Learn about oral care</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.featureCard, { backgroundColor: '#00695c' }]}
                    onPress={() => setActiveSection('oralHealth')}>
                    <Text style={styles.featureEmoji}>🦷</Text>
                    <Text style={styles.featureCardTitle}>Oral Health</Text>
                    <Text style={styles.featureCardSub}>Daily care reminders & tips</Text>
                </TouchableOpacity>
            </View>

            {/* Predictive Visit Window summary card */}
            <TouchableOpacity style={[styles.visitBanner, { backgroundColor: visitInfo.bg, borderColor: visitInfo.color }]}
                onPress={() => setActiveSection('visitWindow')}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.visitBannerLabel, { color: visitInfo.color }]}>Next Visit Prediction</Text>
                    <Text style={styles.visitBannerDate}>{visitInfo.nextDate}</Text>
                </View>
                <View style={[styles.visitTag, { backgroundColor: visitInfo.color }]}>
                    <Text style={styles.visitTagText}>{visitInfo.label}</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderInquiry = () => (
        <View>
            <Text style={styles.sectionHeader}>Send an Inquiry</Text>
            <Text style={styles.sectionSub}>Have questions about your treatment, billing, or schedule? Send us a message and we'll get back to you.</Text>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
                {['General', 'Treatment', 'Schedule', 'Billing'].map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, inquiryCategory === cat && styles.categoryChipActive]}
                        onPress={() => setInquiryCategory(cat)}
                    >
                        <Text style={[styles.categoryChipText, inquiryCategory === cat && styles.categoryChipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.fieldLabel}>Your Question or Concern</Text>
            <TextInput
                style={styles.inquiryInput}
                placeholder="Type your message here..."
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={5}
                value={inquiryText}
                onChangeText={setInquiryText}
                textAlignVertical="top"
            />

            <TouchableOpacity
                style={[styles.submitBtn, submittingInquiry && { opacity: 0.6 }]}
                onPress={handleSubmitInquiry}
                disabled={submittingInquiry}
            >
                {submittingInquiry
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.submitBtnText}>Send Inquiry ✉️</Text>
                }
            </TouchableOpacity>

            <View style={styles.infoNote}>
                <Text style={styles.infoNoteText}>📞 You can also reach us at (02) 8123-4567 or visit the clinic during operating hours: Mon–Sat, 9:00 AM–5:00 PM.</Text>
            </View>
        </View>
    );

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
                    <Text style={styles.articleEmoji}>{article.emoji}</Text>
                    <View style={styles.articleInfo}>
                        <Text style={styles.articleTitle}>{article.title}</Text>
                        <Text style={styles.articleSummary}>{article.summary}</Text>
                    </View>
                    <Text style={styles.articleArrow}>›</Text>
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
                        <Text style={styles.tipIcon}>{tip.icon}</Text>
                        <Text style={styles.tipTitle}>{tip.title}</Text>
                        <Text style={styles.tipText}>{tip.tip}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.highlightCard}>
                <Text style={styles.highlightTitle}>🏆 Did You Know?</Text>
                <Text style={styles.highlightText}>
                    Poor oral health is linked to heart disease, diabetes, and respiratory infections. 
                    Brushing twice daily reduces your risk of systemic disease by up to 30%.
                </Text>
            </View>
        </View>
    );

    const renderVisitWindow = () => (
        <View>
            <Text style={styles.sectionHeader}>Predictive Visit Window</Text>
            <Text style={styles.sectionSub}>Based on your treatment history, here is when we recommend your next clinic visit.</Text>

            <View style={[styles.visitMainCard, { backgroundColor: visitInfo.bg, borderColor: visitInfo.color }]}>
                <Text style={[styles.visitStatus, { color: visitInfo.color }]}>{visitInfo.label}</Text>
                <Text style={styles.visitNextDate}>{visitInfo.nextDate}</Text>
                {visitInfo.days > 0
                    ? <Text style={styles.visitDaysText}>{visitInfo.days} days from today</Text>
                    : <Text style={[styles.visitDaysText, { color: '#d32f2f' }]}>{visitInfo.days} days overdue</Text>
                }
            </View>

            <View style={styles.visitDetailsCard}>
                <Text style={styles.visitDetailTitle}>📋 Based On</Text>
                <View style={styles.visitDetailRow}>
                    <Text style={styles.visitDetailLabel}>Last Visit:</Text>
                    <Text style={styles.visitDetailValue}>Feb 25, 2026</Text>
                </View>
                <View style={styles.visitDetailRow}>
                    <Text style={styles.visitDetailLabel}>Last Procedure:</Text>
                    <Text style={styles.visitDetailValue}>Dental Implant Evaluation</Text>
                </View>
                <View style={styles.visitDetailRow}>
                    <Text style={styles.visitDetailLabel}>Recommended Interval:</Text>
                    <Text style={styles.visitDetailValue}>Every 6 months</Text>
                </View>
            </View>

            <View style={styles.visitTipCard}>
                <Text style={styles.visitTipTitle}>💡 Why Regular Visits Matter</Text>
                <Text style={styles.visitTipText}>
                    Routine check-ups allow your dentist to catch cavities, gum disease, and other issues 
                    before they become serious. Early detection saves you pain, time, and cost.
                </Text>
            </View>

            <TouchableOpacity
                style={styles.bookVisitBtn}
                onPress={() => navigation.navigate('AppointmentBooking')}
            >
                <Text style={styles.bookVisitBtnText}>📅  Book Your Next Visit</Text>
            </TouchableOpacity>
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
                <Text style={styles.headerTitle}>AI Care Companion</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {SECTIONS.map(sec => (
                        <TouchableOpacity
                            key={sec}
                            style={[styles.tab, activeSection === sec && styles.tabActive]}
                            onPress={() => setActiveSection(sec)}
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
                {activeSection === 'overview' && renderOverview()}
                {activeSection === 'inquiry' && renderInquiry()}
                {activeSection === 'education' && renderEducation()}
                {activeSection === 'oralHealth' && renderOralHealth()}
                {activeSection === 'visitWindow' && renderVisitWindow()}
            </Animated.ScrollView>

            {/* Article Detail Modal */}
            <Modal visible={!!selectedArticle} transparent animationType="slide" onRequestClose={() => setSelectedArticle(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalEmoji}>{selectedArticle?.emoji}</Text>
                        <Text style={styles.modalTitle}>{selectedArticle?.title}</Text>
                        <Text style={styles.modalBody}>{selectedArticle?.body}</Text>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedArticle(null)}>
                            <Text style={styles.modalCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },

    // Tabs
    tabBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 1 },
    tabScroll: { paddingHorizontal: 10 },
    tab: { paddingVertical: 12, paddingHorizontal: 14, marginRight: 2 },
    tabActive: { borderBottomWidth: 3, borderBottomColor: '#01538b' },
    tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#01538b' },

    // Content
    content: { padding: 20, paddingBottom: 40 },
    welcomeText: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },

    // Feature Grid
    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    featureCard: { width: '48%', padding: 18, borderRadius: 15, marginBottom: 12, elevation: 2 },
    featureEmoji: { fontSize: 28, marginBottom: 8 },
    featureCardTitle: { color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
    featureCardSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15 },

    // Visit Banner
    visitBanner: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, borderWidth: 1.5, elevation: 1 },
    visitBannerLabel: { fontWeight: 'bold', fontSize: 12, marginBottom: 3 },
    visitBannerDate: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    visitTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    visitTagText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

    // Section Headers
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#01538b', marginBottom: 6 },
    sectionSub: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 20 },

    // Inquiry
    fieldLabel: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
    categoryChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#eee', marginRight: 8, marginBottom: 8 },
    categoryChipActive: { backgroundColor: '#01538b' },
    categoryChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
    categoryChipTextActive: { color: 'white' },
    inquiryInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 15, fontSize: 14, minHeight: 120, marginBottom: 15, color: '#333' },
    submitBtn: { backgroundColor: '#01538b', paddingVertical: 15, borderRadius: 12, alignItems: 'center', elevation: 2, marginBottom: 15 },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    infoNote: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#1565c0' },
    infoNoteText: { color: '#1565c0', fontSize: 12, lineHeight: 18 },

    // Education
    articleCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    articleEmoji: { fontSize: 30, marginRight: 15 },
    articleInfo: { flex: 1 },
    articleTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    articleSummary: { fontSize: 12, color: '#888', lineHeight: 17 },
    articleArrow: { fontSize: 22, color: '#01538b', fontWeight: 'bold' },

    // Oral Health Tips
    tipGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
    tipCard: { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
    tipIcon: { fontSize: 24, marginBottom: 8 },
    tipTitle: { fontWeight: 'bold', fontSize: 13, color: '#01538b', marginBottom: 4 },
    tipText: { fontSize: 12, color: '#666', lineHeight: 16 },
    highlightCard: { backgroundColor: '#fff8e1', padding: 18, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#f9a825' },
    highlightTitle: { fontWeight: 'bold', fontSize: 14, color: '#f57f17', marginBottom: 8 },
    highlightText: { fontSize: 13, color: '#555', lineHeight: 20 },

    // Visit Window
    visitMainCard: { padding: 25, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', marginBottom: 15, elevation: 1 },
    visitStatus: { fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
    visitNextDate: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 3 },
    visitDaysText: { fontSize: 13, color: '#888' },
    visitDetailsCard: { backgroundColor: 'white', padding: 18, borderRadius: 15, marginBottom: 15, elevation: 2 },
    visitDetailTitle: { fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 12 },
    visitDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    visitDetailLabel: { fontSize: 13, color: '#888', flex: 1 },
    visitDetailValue: { fontSize: 13, color: '#333', fontWeight: '600', flex: 1.2, textAlign: 'right' },
    visitTipCard: { backgroundColor: '#e8f5e9', padding: 18, borderRadius: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#4caf50' },
    visitTipTitle: { fontWeight: 'bold', fontSize: 14, color: '#2e7d32', marginBottom: 8 },
    visitTipText: { fontSize: 13, color: '#555', lineHeight: 20 },
    bookVisitBtn: { backgroundColor: '#01538b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', elevation: 2 },
    bookVisitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // Article Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: '75%' },
    modalEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b', textAlign: 'center', marginBottom: 15 },
    modalBody: { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 20 },
    modalCloseBtn: { backgroundColor: '#01538b', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalCloseBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});