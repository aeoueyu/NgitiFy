import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Animated, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import CustomModal from '../../components/CustomModal';
import { logActivity } from '../../utils/logActivity';

// ─── Static procedure list ────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTodayString = () => new Date().toISOString().split('T')[0];

const toMonthString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month, 10) - 1]} ${day}, ${year}`;
};

// "08:00" → "8:00 AM" | "13:00" → "1:00 PM"
const to12h = (time24) => {
    if (!time24) return '';
    const [hourStr, min] = time24.split(':');
    const hour   = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min} ${suffix}`;
};

// Returns true if a slot is in the past OR within the 30-minute booking buffer.
// Slots starting within the next 30 min are not realistically bookable.
const isSlotPast = (slot24, dateStr, todayStr) => {
    if (dateStr !== todayStr) return false;
    const now = new Date();
    const [hour, min] = slot24.split(':').map(Number);
    const slotMinutes   = hour * 60 + min;
    const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 30; // 30-min buffer
    return slotMinutes <= bufferMinutes;
};

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }) {
    const steps = ['Date', 'Time', 'Details', 'Confirm'];
    return (
        <View style={indicator.row}>
            {steps.map((label, i) => {
                const idx    = i + 1;
                const done   = idx < current;
                const active = idx === current;
                return (
                    <React.Fragment key={label}>
                        <View style={indicator.item}>
                            <View style={[
                                indicator.circle,
                                active && indicator.activeCircle,
                                done   && indicator.doneCircle,
                            ]}>
                                {done
                                    ? <Ionicons name="checkmark" size={13} color="white" />
                                    : <Text style={[indicator.num, active && indicator.activeNum]}>{idx}</Text>
                                }
                            </View>
                            <Text style={[indicator.label, active && indicator.activeLabel]}>
                                {label}
                            </Text>
                        </View>
                        {i < steps.length - 1 && (
                            <View style={[indicator.line, done && indicator.doneLine]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const indicator = StyleSheet.create({
    row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 16, backgroundColor: 'white', elevation: 1 },
    item:         { alignItems: 'center', flex: 0 },
    circle:       { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    activeCircle: { backgroundColor: '#01538b' },
    doneCircle:   { backgroundColor: '#4caf50' },
    num:          { fontSize: 11, fontWeight: 'bold', color: '#999' },
    activeNum:    { color: 'white' },
    label:        { fontSize: 9, color: '#aaa', fontWeight: '600' },
    activeLabel:  { color: '#01538b' },
    line:         { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginBottom: 16, marginHorizontal: 2 },
    doneLine:     { backgroundColor: '#4caf50' },
});

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({ label, value }) {
    return (
        <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AppointmentBookingScreen({ navigation }) {
    const { userToken, userInfo, API_BASE_URL } = useContext(AuthContext);

    // ── Wizard state ──
    const [step, setStep] = useState(1);

    // Step 1 — Branch
    const [selectedBranch, setSelectedBranch] = useState(userInfo?.assignedBranch || '');

    // Step 2 — Date
    const [selectedDate,   setSelectedDate]   = useState('');
    const [blockedDates,   setBlockedDates]   = useState([]);
    const [loadingBlocked, setLoadingBlocked] = useState(false);
    const [currentMonth,   setCurrentMonth]   = useState(toMonthString(new Date()));

    // Step 3 — Time
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots,   setTakenSlots]   = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsError,   setSlotsError]   = useState('');
    const [selectedTime, setSelectedTime] = useState('');

    // Step 4 — Procedure & Notes
    const [selectedProcedure, setSelectedProcedure] = useState('');
    const [notes,             setNotes]             = useState('');

    // Step 5 / submit
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType,    setModalType]    = useState('success');
    const [modalMessage, setModalMessage] = useState('');

    // Duplicate booking guard
    const [duplicateAppt, setDuplicateAppt] = useState(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const today    = getTodayString();

    // ── Animate on step change ──
    useEffect(() => {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, [step]);

    // ── Fetch branches on mount ──
    useEffect(() => {
        setSelectedBranch(userInfo?.assignedBranch || '');
    }, [userInfo?.assignedBranch]);

    // ── Duplicate booking guard: check for active appointment on mount ──
    useEffect(() => {
        const checkDuplicate = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/appointments/my-active`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.hasActive) setDuplicateAppt(data.appointment);
            } catch {
                // Silent fail — never block booking if the check fails
            }
        };
        checkDuplicate();
    }, []);

    // ── Clear downstream selections when branch changes ──
    // Prevents stale date/time data from a previous branch carrying over.
    useEffect(() => {
        setSelectedDate('');
        setSelectedTime('');
        setAllowedSlots([]);
        setTakenSlots([]);
    }, [selectedBranch]);

    // ── Fetch blocked dates for a given month ──
    const fetchBlockedDates = useCallback(async (month) => {
        if (!selectedBranch) return; // Wait until branch is selected (Step 1)
        setLoadingBlocked(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/appointments/blocked-dates?month=${month}&branch=${encodeURIComponent(selectedBranch)}`,
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            if (!res.ok) throw new Error();
            const data = await res.json();
            setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
        } catch {
            setBlockedDates([]);
        } finally {
            setLoadingBlocked(false);
        }
    }, [userToken, API_BASE_URL, selectedBranch]);

    // Fetch blocked dates whenever month or branch changes
    useEffect(() => {
        fetchBlockedDates(currentMonth);
    }, [currentMonth, fetchBlockedDates]);

    // ── Fetch time slots when date selected ──
    const fetchSlots = useCallback(async (date) => {
        setLoadingSlots(true);
        setSlotsError('');
        setSelectedTime('');
        try {
            const branchQ = selectedBranch
                ? `&branch=${encodeURIComponent(selectedBranch)}`
                : '';
            const res = await fetch(
                `${API_BASE_URL}/api/appointments/slots?date=${date}${branchQ}`,
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            if (!res.ok) throw new Error('Failed to fetch slots');
            const data = await res.json();
            setAllowedSlots(data.allowedSlots || []);
            setTakenSlots(data.takenSlots     || []);
        } catch {
            setSlotsError('Could not load time slots. Please try again.');
            setAllowedSlots([]);
            setTakenSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [userToken, API_BASE_URL, selectedBranch]);

    // ── Build markedDates object for Calendar ──
    const buildMarkedDates = () => {
        const marked = {};
        blockedDates.forEach((dateStr) => {
            marked[dateStr] = {
                disabled:          true,
                disableTouchEvent: true,
                customStyles: {
                    container: { backgroundColor: '#ffebee', borderRadius: 6 },
                    text:       { color: '#e57373', textDecorationLine: 'line-through' },
                },
                dotColor: '#e53935',
                marked:   true,
            };
        });
        if (selectedDate) {
            marked[selectedDate] = {
                selected:          true,
                selectedColor:     '#01538b',
                disableTouchEvent: false,
            };
        }
        return marked;
    };

    // ── Handlers ──
    const handleDateSelect = (day) => {
        const date = new Date(day.dateString + 'T12:00:00');
        if (date.getDay() === 0) return;
        if (blockedDates.includes(day.dateString)) return;
        setSelectedDate(day.dateString);
        fetchSlots(day.dateString);
    };

    const handleMonthChange = (month) => {
        const monthStr = `${month.year}-${String(month.month).padStart(2, '0')}`;
        setCurrentMonth(monthStr);
    };

    const handleNext = () => {
        if (!selectedBranch) {
            Alert.alert(
                'Assigned Branch Required',
                'Your account does not have an assigned branch yet. Please contact the clinic before booking an appointment.'
            );
            return;
        }

        // Safety net: re-fetch slots if advancing from Date step with empty slots
        if (step === 1 && selectedDate && allowedSlots.length === 0 && !loadingSlots) {
            fetchSlots(selectedDate);
        }

        // Duplicate booking guard: warn before the Confirm step
        if (step === 3 && duplicateAppt) {
            const apptDateStr = duplicateAppt.date
                ? new Date(duplicateAppt.date).toISOString().split('T')[0]
                : '';
            const apptDate = apptDateStr ? formatDisplayDate(apptDateStr) : 'a scheduled date';
            Alert.alert(
                'Existing Appointment Found',
                `You already have a ${duplicateAppt.status} appointment for "${duplicateAppt.procedure}" on ${apptDate} at ${duplicateAppt.branch}.\n\nAre you sure you want to book another?`,
                [
                    { text: 'Go Back', style: 'cancel' },
                    { text: 'Continue Anyway', onPress: () => setStep(4) },
                ]
            );
            return;
        }

        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        // Going back to Date step: clear time so stale selection isn't carried over
        if (step === 2) setSelectedTime('');
        if (step > 1) setStep(step - 1);
        else navigation.goBack();
    };

    // ── Submit ──
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/request`, {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization:  `Bearer ${userToken}`,
                },
                body: JSON.stringify({
                    date:      selectedDate,
                    time:      selectedTime,
                    procedure: selectedProcedure,
                    notes:     notes.trim(),
                    branch:    selectedBranch,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setModalType('success');
                setModalMessage(
                    `Your appointment request for ${formatDisplayDate(selectedDate)}` +
                    (selectedTime ? ` at ${to12h(selectedTime) || selectedTime}` : '') +
                    ' has been submitted. The clinic will confirm your schedule shortly.'
                );
                setModalVisible(true);
                logActivity(
                    'APPOINTMENT_REQUEST',
                    `Requested ${selectedProcedure} on ${formatDisplayDate(selectedDate)} at ${to12h(selectedTime) || selectedTime}`,
                    userToken, API_BASE_URL
                );
            } else {
                setModalType('error');
                setModalMessage(data.message || 'Booking failed. Please try again.');
                setModalVisible(true);
            }
        } catch {
            setModalType('error');
            setModalMessage('Unable to connect to the server. Please check your internet connection.');
            setModalVisible(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        if (modalType === 'success') navigation.goBack();
    };

    // ── Step 1: Pick a Branch ─────────────────────────────────────────────────
    const renderStep1 = () => (
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            <Text style={styles.stepHeading}>Select a Branch</Text>
            <Text style={styles.stepSub}>Choose your preferred clinic location to continue.</Text>

            {loadingBranches ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator color="#01538b" size="large" />
                    <Text style={styles.loadingText}>Loading branches…</Text>
                </View>
            ) : branches.length === 0 ? (
                <>
                    <Text style={styles.inputLabel}>
                        Branch Name <Text style={{ color: '#d32f2f' }}>*</Text>
                    </Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="Enter branch name (e.g. Dentime - Marikina)"
                        placeholderTextColor="#bbb"
                        value={selectedBranch}
                        onChangeText={setSelectedBranch}
                    />
                </>
            ) : (
                <View style={styles.branchListVertical}>
                    {branches.map((b) => {
                        const active = selectedBranch === b.name;
                        return (
                            <TouchableOpacity
                                key={b._id}
                                style={[styles.branchCard, active && styles.branchCardSelected]}
                                onPress={() => setSelectedBranch(b.name)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.branchRadioCircle, active && styles.branchRadioSelected]}>
                                    {active && <View style={styles.branchRadioDot} />}
                                </View>
                                <Ionicons
                                    name="location-outline"
                                    size={20}
                                    color={active ? '#01538b' : '#888'}
                                    style={styles.branchCardIcon}
                                />
                                <Text style={[styles.branchCardText, active && styles.branchCardTextSelected]}>
                                    {b.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            <TouchableOpacity
                style={[styles.primaryBtn, !selectedBranch && styles.disabledBtn]}
                onPress={handleNext}
                disabled={!selectedBranch}
                activeOpacity={0.8}
            >
                <Text style={styles.primaryBtnText}>Next →</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    // ── Step 2: Pick a Date ───────────────────────────────────────────────────
    const renderStep2 = () => (
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            <Text style={styles.stepHeading}>Select a Date</Text>
            <Text style={styles.stepSub}>
                {selectedBranch} · Sundays and fully booked dates are unavailable.
            </Text>

            {loadingBlocked && (
                <View style={styles.blockedLoadingRow}>
                    <ActivityIndicator size="small" color="#01538b" />
                    <Text style={styles.blockedLoadingText}>Checking availability…</Text>
                </View>
            )}

            <Calendar
                minDate={today}
                onDayPress={handleDateSelect}
                onMonthChange={handleMonthChange}
                markedDates={buildMarkedDates()}
                markingType="simple"
                disabledDaysIndexes={[0]}
                disableAllTouchEventsForDisabledDays
                theme={{
                    selectedDayBackgroundColor: '#01538b',
                    todayTextColor:             '#01538b',
                    arrowColor:                 '#01538b',
                    dotColor:                   '#e53935',
                    selectedDotColor:           'white',
                    textDayFontWeight:          '600',
                    textMonthFontWeight:        'bold',
                    textDayHeaderFontWeight:    '600',
                    calendarBackground:         'white',
                    textSectionTitleColor:      '#01538b',
                    textDisabledColor:          '#ddd',
                }}
                style={styles.calendar}
            />

            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#01538b' }]} />
                    <Text style={styles.legendText}>Selected</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#e53935' }]} />
                    <Text style={styles.legendText}>Fully Booked</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ddd' }]} />
                    <Text style={styles.legendText}>Unavailable</Text>
                </View>
            </View>

            {selectedDate ? (
                <View style={styles.selectedDatePill}>
                    <Ionicons name="calendar-outline" size={14} color="#01538b" />
                    <Text style={[styles.selectedDateText, { marginLeft: 6 }]}>
                        Selected: {formatDisplayDate(selectedDate)}
                    </Text>
                </View>
            ) : null}

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.primaryBtn,
                        { flex: 1, marginLeft: 10 },
                        !selectedDate && styles.disabledBtn,
                    ]}
                    onPress={handleNext}
                    disabled={!selectedDate}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // ── Step 3: Pick a Time ───────────────────────────────────────────────────
    const renderStep3 = () => {
        const isSlotTaken = (slot12h) =>
            takenSlots.some(t => t === slot12h || to12h(t) === slot12h);

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.stepHeading}>Select a Time Slot</Text>
                <Text style={styles.stepSub}>
                    {selectedBranch} · {formatDisplayDate(selectedDate)}
                </Text>

                {loadingSlots ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color="#01538b" size="large" />
                        <Text style={styles.loadingText}>Checking availability…</Text>
                    </View>
                ) : slotsError ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{slotsError}</Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => fetchSlots(selectedDate)}
                        >
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : allowedSlots.length === 0 ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>
                            No time slots configured for this date. Please contact the clinic.
                        </Text>
                    </View>
                ) : (
                    <>
                        {selectedDate === today &&
                            allowedSlots.every(s =>
                                isSlotTaken(to12h(s)) || isSlotTaken(s) || isSlotPast(s, selectedDate, today)
                            ) && (
                            <View style={styles.warningBox}>
                                <Text style={styles.warningText}>
                                    All slots for today are either taken or no longer available. Please go back and select a different date.
                                </Text>
                            </View>
                        )}

                        <View style={styles.slotGrid}>
                            {allowedSlots.map((slot24) => {
                                const slot12   = to12h(slot24);
                                const taken    = isSlotTaken(slot12) || isSlotTaken(slot24);
                                const past     = isSlotPast(slot24, selectedDate, today);
                                const disabled = taken || past;
                                const selected = selectedTime === slot12;
                                return (
                                    <TouchableOpacity
                                        key={slot24}
                                        style={[
                                            styles.slotChip,
                                            selected        && styles.slotSelected,
                                            taken           && styles.slotTaken,
                                            past && !taken  && styles.slotPast,
                                        ]}
                                        onPress={() => !disabled && setSelectedTime(slot12)}
                                        activeOpacity={disabled ? 1 : 0.7}
                                        disabled={disabled}
                                    >
                                        <Text style={[
                                            styles.slotText,
                                            selected  && styles.slotTextSelected,
                                            disabled  && styles.slotTextTaken,
                                        ]}>
                                            {slot12}
                                        </Text>
                                        {taken          && <Text style={styles.takenLabel}>Taken</Text>}
                                        {past && !taken && <Text style={styles.takenLabel}>Past</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.slotLegendRow}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#01538b' }]} />
                                <Text style={styles.legendText}>Selected</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#e0e0e0' }]} />
                                <Text style={styles.legendText}>Available</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#bbb' }]} />
                                <Text style={styles.legendText}>Taken</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#ffe082' }]} />
                                <Text style={styles.legendText}>Past</Text>
                            </View>
                        </View>
                    </>
                )}

                <View style={styles.navRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
                        <Text style={styles.secondaryBtnText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.primaryBtn,
                            { flex: 1, marginLeft: 10 },
                            (!selectedTime || loadingSlots) && styles.disabledBtn,
                        ]}
                        onPress={handleNext}
                        disabled={!selectedTime || loadingSlots}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryBtnText}>Next →</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    // ── Step 4: Procedure & Notes ─────────────────────────────────────────────
    const renderStep4 = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Procedure & Details</Text>
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

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Additional Notes <Text style={styles.optionalTag}>(optional)</Text>
            </Text>
            <TextInput
                style={styles.notesInput}
                placeholder="E.g. allergies, concerns, or anything your dentist should know…"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
            />

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.primaryBtn,
                        { flex: 1, marginLeft: 10 },
                        !selectedProcedure && styles.disabledBtn,
                    ]}
                    onPress={handleNext}
                    disabled={!selectedProcedure}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // ── Step 5: Review & Confirm ──────────────────────────────────────────────
    const renderStep5 = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Confirm Your Booking</Text>
            <Text style={styles.stepSub}>Please review your appointment details below.</Text>

            <View style={styles.summaryCard}>
                <SummaryRow label="Branch"    value={selectedBranch} />
                <SummaryRow label="Date"      value={formatDisplayDate(selectedDate)} />
                <SummaryRow label="Time"      value={selectedTime || '—'} />
                <SummaryRow label="Procedure" value={selectedProcedure} />
                {notes.trim() ? <SummaryRow label="Notes" value={notes.trim()} /> : null}
            </View>

            <View style={styles.disclaimerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#795548"
                        style={{ marginRight: 8, marginTop: 1 }}
                    />
                    <Text style={[styles.disclaimerText, { flex: 1 }]}>
                        Your appointment is{' '}
                        <Text style={{ fontWeight: 'bold' }}>pending confirmation</Text> by the clinic.
                        You will be notified once it is approved.
                    </Text>
                </View>
            </View>

            <View style={styles.navRow}>
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleBack}
                    disabled={isSubmitting}
                >
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.primaryBtn,
                        { flex: 1, marginLeft: 10 },
                        isSubmitting && styles.disabledBtn,
                    ]}
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

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>{step > 1 ? 'Back' : 'Cancel'}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <View style={{ width: 70 }} />
            </View>

            <StepIndicator current={step} />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {step === 1 && renderStep2()}
                {step === 2 && renderStep3()}
                {step === 3 && renderStep4()}
                {step === 4 && renderStep5()}
            </ScrollView>

            <CustomModal
                visible={modalVisible}
                type={modalType}
                title={modalType === 'success' ? 'Booking Submitted!' : 'Booking Failed'}
                message={modalMessage}
                onClose={handleModalClose}
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header:       { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn:      { padding: 5, width: 70 },
    backText:     { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle:  { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    // Step content
    content:      { padding: 20, paddingBottom: 50 },
    stepHeading:  { fontSize: 20, fontWeight: 'bold', color: '#01538b', marginBottom: 4, marginTop: 4 },
    stepSub:      { fontSize: 13, color: '#888', marginBottom: 16 },

    // Calendar
    calendar:     { borderRadius: 15, elevation: 2, marginBottom: 12, overflow: 'hidden' },

    // Blocked-date loading
    blockedLoadingRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    blockedLoadingText: { marginLeft: 8, fontSize: 12, color: '#888' },

    // Legend
    legendRow:     { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
    slotLegendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16 },
    legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot:     { width: 10, height: 10, borderRadius: 5 },
    legendText:    { fontSize: 11, color: '#888' },

    // Selected date pill — row layout for icon + text
    selectedDatePill: { backgroundColor: '#e8f1f8', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    selectedDateText: { color: '#01538b', fontWeight: '700', fontSize: 13 },

    // Buttons
    primaryBtn:       { backgroundColor: '#01538b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    primaryBtnText:   { color: 'white', fontWeight: 'bold', fontSize: 16 },
    disabledBtn:      { backgroundColor: '#b0bec5' },
    secondaryBtn:     { backgroundColor: 'white', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#01538b', marginTop: 10 },
    secondaryBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 15 },
    navRow:           { flexDirection: 'row', alignItems: 'center' },

    // Loading / error
    loadingBox:   { alignItems: 'center', paddingVertical: 40 },
    loadingText:  { color: '#888', marginTop: 12, fontSize: 14 },
    errorBox:     { backgroundColor: '#fff3f3', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
    errorBoxText: { color: '#d32f2f', fontSize: 13, textAlign: 'center', marginBottom: 10 },
    retryBtn:     { backgroundColor: '#01538b', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryBtnText: { color: 'white', fontWeight: 'bold' },

    // Slot grid
    slotGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    slotChip:         { width: '46%', paddingVertical: 14, borderRadius: 12, backgroundColor: 'white', alignItems: 'center', elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0' },
    slotSelected:     { backgroundColor: '#01538b', borderColor: '#01538b' },
    slotTaken:        { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0', opacity: 0.6 },
    slotText:         { fontWeight: 'bold', color: '#333', fontSize: 14 },
    slotTextSelected: { color: 'white' },
    slotTextTaken:    { color: '#bbb' },
    takenLabel:       { fontSize: 10, color: '#bbb', marginTop: 2 },
    slotPast:         { backgroundColor: '#fff8e1', borderColor: '#ffe082', opacity: 0.75 },

    // Procedures
    procedureList:         { marginBottom: 16 },
    procedureItem:         { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8, elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0' },
    procedureSelected:     { borderColor: '#01538b', backgroundColor: '#e8f1f8' },
    radioCircle:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    radioSelected:         { borderColor: '#01538b' },
    radioDot:              { width: 10, height: 10, borderRadius: 5, backgroundColor: '#01538b' },
    procedureText:         { fontSize: 14, color: '#444', flex: 1 },
    procedureTextSelected: { color: '#01538b', fontWeight: '700' },

    // Branch cards (Step 1)
    branchListVertical:     { marginBottom: 16 },
    branchCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 10, elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0' },
    branchCardSelected:     { borderColor: '#01538b', backgroundColor: '#e8f1f8' },
    branchRadioCircle:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#b0bec5', alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: 'white' },
    branchRadioSelected:    { borderColor: '#01538b' },
    branchRadioDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#01538b' },
    branchCardIcon:         { marginRight: 12 },
    branchCardText:         { flex: 1, fontSize: 14, color: '#444', fontWeight: '600' },
    branchCardTextSelected: { color: '#01538b' },

    // Notes / inputs
    inputLabel:  { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 },
    optionalTag: { fontSize: 12, color: '#aaa', fontWeight: '400' },
    notesInput:  { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 14, color: '#333', elevation: 1, borderWidth: 1.5, borderColor: '#e0e0e0', minHeight: 90, marginBottom: 10 },

    // Summary
    summaryCard:  { backgroundColor: 'white', borderRadius: 15, padding: 20, elevation: 2, marginBottom: 16 },
    summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    summaryLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
    summaryValue: { fontSize: 14, color: '#333', fontWeight: 'bold', maxWidth: '60%', textAlign: 'right' },

    // Disclaimer
    disclaimerCard: { backgroundColor: '#fff8e1', borderRadius: 12, padding: 15, borderLeftWidth: 4, borderLeftColor: '#ffc107', marginBottom: 10 },
    disclaimerText: { fontSize: 13, color: '#795548', lineHeight: 19 },

    // Warnings
    warningBox:  { backgroundColor: '#fff3e0', borderRadius: 10, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#ff9800' },
    warningText: { color: '#e65100', fontSize: 13, lineHeight: 19 },
});
