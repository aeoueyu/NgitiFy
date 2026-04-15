// src/screens/patient/AppointmentBookingScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Animated, TextInput, Platform, ActivityIndicator
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import BackIcon from '../../assets/icons/Back.svg';
import CustomModal from '../../components/CustomModal';

// ─── Static Data ──────────────────────────────────────────────────────────────

const PROCEDURES = [
    'Oral Prophylaxis (Cleaning)',
    'Tooth Extraction',
    'Dental Filling',
    'Root Canal Treatment',
    'Orthodontic Consultation',
    'Dental Implant Consultation',
    'Teeth Whitening',
    'Dentures / Retainers',
    'X-Ray / Imaging',
    'Other / General Check-up',
];

// Times blocked per slot (demo — replace with real availability from backend)
const AVAILABLE_SLOTS = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
];

// Slots that are "taken" for demo purposes
const TAKEN_SLOTS = ['09:00 AM', '02:00 PM'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayString() {
    const d = new Date();
    return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month,10)-1]} ${day}, ${year}`;
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepIndicator({ current }) {
    const steps = ['Date', 'Time', 'Procedure', 'Confirm'];
    return (
        <View style={indicator.row}>
            {steps.map((label, i) => {
                const idx = i + 1;
                const done = idx < current;
                const active = idx === current;
                return (
                    <React.Fragment key={label}>
                        <View style={indicator.item}>
                            <View style={[indicator.circle, active && indicator.activeCircle, done && indicator.doneCircle]}>
                                <Text style={[indicator.num, (active || done) && indicator.activeNum]}>
                                    {done ? '✓' : idx}
                                </Text>
                            </View>
                            <Text style={[indicator.label, active && indicator.activeLabel]}>{label}</Text>
                        </View>
                        {i < steps.length - 1 && <View style={[indicator.line, done && indicator.doneLine]} />}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const indicator = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white', elevation: 1 },
    item: { alignItems: 'center', flex: 0 },
    circle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    activeCircle: { backgroundColor: '#01538b' },
    doneCircle: { backgroundColor: '#4caf50' },
    num: { fontSize: 12, fontWeight: 'bold', color: '#999' },
    activeNum: { color: 'white' },
    label: { fontSize: 10, color: '#aaa', fontWeight: '600' },
    activeLabel: { color: '#01538b' },
    line: { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginBottom: 16, marginHorizontal: 4 },
    doneLine: { backgroundColor: '#4caf50' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AppointmentBookingScreen({ navigation }) {
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedProcedure, setSelectedProcedure] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState('success'); // 'success' | 'error'

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, [step]);

    const today = getTodayString();

    // Disable past dates and Sundays
    const disabledDates = {};
    // Mark taken slots visually (handled in step 2)

    const handleDateSelect = (day) => {
        const date = new Date(day.dateString);
        if (date.getDay() === 0) return; // block Sundays
        setSelectedDate(day.dateString);
    };

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else navigation.goBack();
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // TODO: Replace with real API call to backend
        await new Promise(res => setTimeout(res, 1500));
        setIsSubmitting(false);
        setModalType('success');
        setModalVisible(true);
    };

    const handleModalClose = () => {
        setModalVisible(false);
        navigation.goBack();
    };

    // ── Step 1: Pick a Date ──────────────────────────────────────────────────
    const renderStep1 = () => (
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            <Text style={styles.stepHeading}>Select a Date</Text>
            <Text style={styles.stepSub}>Sundays are unavailable. Choose any weekday.</Text>
            <Calendar
                minDate={today}
                onDayPress={handleDateSelect}
                markedDates={{
                    ...(selectedDate ? { [selectedDate]: { selected: true, selectedColor: '#01538b' } } : {}),
                }}
                disableAllTouchEventsForDisabledDays
                theme={{
                    selectedDayBackgroundColor: '#01538b',
                    todayTextColor: '#01538b',
                    arrowColor: '#01538b',
                    dotColor: '#01538b',
                    textDayFontWeight: '600',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    calendarBackground: 'white',
                    textSectionTitleColor: '#01538b',
                }}
                style={styles.calendar}
            />
            <TouchableOpacity
                style={[styles.primaryBtn, !selectedDate && styles.disabledBtn]}
                onPress={handleNext}
                disabled={!selectedDate}
                activeOpacity={0.8}
            >
                <Text style={styles.primaryBtnText}>Next →</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    // ── Step 2: Pick a Time ──────────────────────────────────────────────────
    const renderStep2 = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Select a Time Slot</Text>
            <Text style={styles.stepSub}>For {formatDisplayDate(selectedDate)}</Text>
            <View style={styles.slotGrid}>
                {AVAILABLE_SLOTS.map((slot) => {
                    const taken = TAKEN_SLOTS.includes(slot);
                    const selected = selectedTime === slot;
                    return (
                        <TouchableOpacity
                            key={slot}
                            style={[
                                styles.slotChip,
                                selected && styles.slotSelected,
                                taken && styles.slotTaken,
                            ]}
                            onPress={() => !taken && setSelectedTime(slot)}
                            activeOpacity={taken ? 1 : 0.7}
                            disabled={taken}
                        >
                            <Text style={[
                                styles.slotText,
                                selected && styles.slotTextSelected,
                                taken && styles.slotTextTaken,
                            ]}>
                                {slot}
                            </Text>
                            {taken && <Text style={styles.takenLabel}>Taken</Text>}
                        </TouchableOpacity>
                    );
                })}
            </View>
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack} activeOpacity={0.8}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, !selectedTime && styles.disabledBtn]}
                    onPress={handleNext}
                    disabled={!selectedTime}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // ── Step 3: Pick Procedure + Notes ───────────────────────────────────────
    const renderStep3 = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Procedure & Notes</Text>
            <Text style={styles.stepSub}>What brings you in?</Text>
            <View style={styles.procedureList}>
                {PROCEDURES.map((proc) => {
                    const selected = selectedProcedure === proc;
                    return (
                        <TouchableOpacity
                            key={proc}
                            style={[styles.procedureItem, selected && styles.procedureSelected]}
                            onPress={() => setSelectedProcedure(proc)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.radioCircle, selected && styles.radioSelected]}>
                                {selected && <View style={styles.radioDot} />}
                            </View>
                            <Text style={[styles.procedureText, selected && styles.procedureTextSelected]}>
                                {proc}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text style={styles.inputLabel}>Additional Notes (optional)</Text>
            <TextInput
                style={styles.notesInput}
                placeholder="E.g. allergies, concerns, or anything your dentist should know..."
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
            />
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack} activeOpacity={0.8}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, !selectedProcedure && styles.disabledBtn]}
                    onPress={handleNext}
                    disabled={!selectedProcedure}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // ── Step 4: Confirm ──────────────────────────────────────────────────────
    const renderStep4 = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Confirm Your Booking</Text>
            <Text style={styles.stepSub}>Please review your appointment details below.</Text>
            <View style={styles.summaryCard}>
                <SummaryRow label="Date" value={formatDisplayDate(selectedDate)} />
                <SummaryRow label="Time" value={selectedTime} />
                <SummaryRow label="Procedure" value={selectedProcedure} />
                {notes ? <SummaryRow label="Notes" value={notes} /> : null}
            </View>
            <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerText}>
                    📌 Your appointment is <Text style={{ fontWeight: 'bold' }}>pending confirmation</Text> by the clinic. 
                    You will be notified once it is approved.
                </Text>
            </View>
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack} activeOpacity={0.8} disabled={isSubmitting}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, isSubmitting && styles.disabledBtn]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting
                        ? <ActivityIndicator color="white" />
                        : <Text style={styles.primaryBtnText}>Submit Booking</Text>
                    }
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>{step > 1 ? 'Back' : 'Cancel'}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <View style={{ width: 70 }} />
            </View>

            {/* Step Indicator */}
            <StepIndicator current={step} />

            {/* Step Content */}
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </ScrollView>

            {/* Success Modal */}
            <CustomModal
                visible={modalVisible}
                type={modalType}
                title="Booking Submitted!"
                message={`Your appointment request for ${formatDisplayDate(selectedDate)} at ${selectedTime} has been sent. The clinic will confirm your schedule shortly.`}
                onClose={handleModalClose}
            />
        </View>
    );
}

// ─── Summary Row Helper ───────────────────────────────────────────────────────

function SummaryRow({ label, value }) {
    return (
        <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 70 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    // Step content
    content: { padding: 20, paddingBottom: 40 },
    stepHeading: { fontSize: 20, fontWeight: 'bold', color: '#01538b', marginBottom: 4, marginTop: 4 },
    stepSub: { fontSize: 13, color: '#888', marginBottom: 20 },

    // Calendar
    calendar: { borderRadius: 15, elevation: 2, marginBottom: 24, overflow: 'hidden' },

    // Buttons
    primaryBtn: { backgroundColor: '#01538b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    disabledBtn: { backgroundColor: '#b0bec5' },
    secondaryBtn: { backgroundColor: 'white', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#01538b', marginTop: 10 },
    secondaryBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 15 },
    navRow: { flexDirection: 'row', alignItems: 'center' },

    // Time Slots
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    slotChip: { width: '46%', paddingVertical: 14, borderRadius: 12, backgroundColor: 'white', alignItems: 'center', elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0' },
    slotSelected: { backgroundColor: '#01538b', borderColor: '#01538b' },
    slotTaken: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0', opacity: 0.6 },
    slotText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
    slotTextSelected: { color: 'white' },
    slotTextTaken: { color: '#bbb' },
    takenLabel: { fontSize: 10, color: '#bbb', marginTop: 2 },

    // Procedures
    procedureList: { marginBottom: 20 },
    procedureItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8, elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0' },
    procedureSelected: { borderColor: '#01538b', backgroundColor: '#e8f1f8' },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    radioSelected: { borderColor: '#01538b' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#01538b' },
    procedureText: { fontSize: 14, color: '#444', flex: 1 },
    procedureTextSelected: { color: '#01538b', fontWeight: '700' },

    // Notes
    inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8 },
    notesInput: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 14, color: '#333', elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0', minHeight: 90, marginBottom: 10 },

    // Summary
    summaryCard: { backgroundColor: 'white', borderRadius: 15, padding: 20, elevation: 2, marginBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    summaryLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
    summaryValue: { fontSize: 14, color: '#333', fontWeight: 'bold', maxWidth: '60%', textAlign: 'right' },

    // Disclaimer
    disclaimerCard: { backgroundColor: '#fff8e1', borderRadius: 12, padding: 15, borderLeftWidth: 4, borderLeftColor: '#ffc107', marginBottom: 10 },
    disclaimerText: { fontSize: 13, color: '#795548', lineHeight: 19 },
});