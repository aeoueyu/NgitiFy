import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Animated, TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import CustomModal from '../../components/CustomModal';
import { logActivity } from '../../utils/logActivity';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';
import {
    DEFAULT_DIRECT_BOOKING_PROCEDURES,
    loadPublicAppointmentProcedures,
} from '../../utils/systemConfig';

const STEP_LABELS = ['Date', 'Time', 'Procedure', 'Confirm'];
const MANILA_TIME_ZONE = 'Asia/Manila';
const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const manilaDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});
const getManilaDateParts = (value = new Date()) => Object.fromEntries(
    manilaDateTimeFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value])
);
const getDateKeyInManila = (value = new Date()) => {
    const parts = Object.fromEntries(
        manilaDateFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};
const getTodayString = () => getDateKeyInManila(new Date());
const toMonthString = (value) => (
    typeof value === 'string'
        ? String(value).slice(0, 7)
        : getDateKeyInManila(value).slice(0, 7)
);

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month, 10) - 1]} ${day}, ${year}`;
};

const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const isSlotPast = (slot24, dateStr, todayStr) => {
    if (dateStr !== todayStr) return false;
    const nowParts = getManilaDateParts(new Date());
    const [hour, minute] = slot24.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;
    const bufferMinutes = (Number(nowParts.hour) * 60) + Number(nowParts.minute) + 30;
    return slotMinutes <= bufferMinutes;
};

function StepIndicator({ current }) {
    return (
        <View style={indicator.row}>
            {STEP_LABELS.map((label, index) => {
                const step = index + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <React.Fragment key={label}>
                        <View style={indicator.item}>
                            <View style={[
                                indicator.circle,
                                active && indicator.activeCircle,
                                done && indicator.doneCircle,
                            ]}>
                                {done
                                    ? <Ionicons name="checkmark" size={13} color="white" />
                                    : <Text style={[indicator.num, active && indicator.activeNum]}>{step}</Text>}
                            </View>
                            <Text style={[indicator.label, active && indicator.activeLabel]}>{label}</Text>
                        </View>
                        {index < STEP_LABELS.length - 1 && (
                            <View style={[indicator.line, done && indicator.doneLine]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

function SummaryRow({ label, value }) {
    return (
        <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
        </View>
    );
}

export default function AppointmentBookingScreen({ navigation }) {
    const { userToken, userInfo, API_BASE_URL } = useContext(AuthContext);
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState('');
    const [blockedDates, setBlockedDates] = useState([]);
    const [loadingBlocked, setLoadingBlocked] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(toMonthString(new Date()));
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedProcedure, setSelectedProcedure] = useState('');
    const [availableProcedures, setAvailableProcedures] = useState(DEFAULT_DIRECT_BOOKING_PROCEDURES);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [privacySummaryViewed, setPrivacySummaryViewed] = useState(false);
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState('success');
    const [modalMessage, setModalMessage] = useState('');
    const [duplicateAppt, setDuplicateAppt] = useState(null);

    const assignedBranch = userInfo?.assignedBranch || '';
    const hasActiveRequest = Boolean(duplicateAppt);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const today = getTodayString();

    const fetchDuplicateAppointment = useCallback(async () => {
        if (!userToken) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/my-active`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setDuplicateAppt(data.hasActive ? data.appointment : null);
        } catch {
            // Keep booking available even if the duplicate check fails.
        }
    }, [API_BASE_URL, userToken]);

    useEffect(() => {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }, [fadeAnim, step]);

    useEffect(() => {
        fetchDuplicateAppointment();
    }, [fetchDuplicateAppointment]);

    const fetchProcedureOptions = useCallback(async () => {
        try {
            const procedures = await loadPublicAppointmentProcedures(API_BASE_URL, { forceRefresh: true });
            setAvailableProcedures(procedures);
        } catch {
            setAvailableProcedures(DEFAULT_DIRECT_BOOKING_PROCEDURES);
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        fetchProcedureOptions();
    }, [fetchProcedureOptions]);

    useEffect(() => {
        if (selectedProcedure && !availableProcedures.includes(selectedProcedure)) {
            setSelectedProcedure('');
        }
    }, [availableProcedures, selectedProcedure]);

    const fetchBlockedDates = useCallback(async (month) => {
        if (!assignedBranch) {
            setBlockedDates([]);
            return;
        }
        setLoadingBlocked(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/appointments/blocked-dates?month=${month}&branch=${encodeURIComponent(assignedBranch)}`,
                { headers: { Authorization: `Bearer ${userToken}` } },
            );
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || 'Could not load blocked dates.');
            setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
        } catch {
            setBlockedDates([]);
        } finally {
            setLoadingBlocked(false);
        }
    }, [API_BASE_URL, assignedBranch, userToken]);

    useEffect(() => {
        fetchBlockedDates(currentMonth);
    }, [currentMonth, fetchBlockedDates]);

    const fetchSlots = useCallback(async (date, { preserveSelection = false } = {}) => {
        if (!assignedBranch) {
            setSlotsError('Your account does not have an assigned branch yet. Please contact the clinic before booking an appointment.');
            setAllowedSlots([]);
            setTakenSlots([]);
            return;
        }
        setLoadingSlots(true);
        setSlotsError('');
        if (!preserveSelection) {
            setSelectedTime('');
        }
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/appointments/slots?date=${date}&branch=${encodeURIComponent(assignedBranch)}`,
                { headers: { Authorization: `Bearer ${userToken}` } },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || 'Failed to fetch slots');
            const nextAllowedSlots = Array.isArray(data.allowedSlots) ? data.allowedSlots : [];
            const nextTakenSlots = Array.isArray(data.takenSlots) ? data.takenSlots : [];
            setAllowedSlots(nextAllowedSlots);
            setTakenSlots(nextTakenSlots);
            if (preserveSelection && selectedTime) {
                const stillAvailable = nextAllowedSlots.includes(selectedTime) && !nextTakenSlots.includes(selectedTime);
                if (!stillAvailable) {
                    setSelectedTime('');
                }
            }
        } catch (error) {
            setSlotsError(error?.message || 'Could not load time slots. Please try again.');
            setAllowedSlots([]);
            setTakenSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [API_BASE_URL, assignedBranch, selectedTime, userToken]);

    useEffect(() => {
        if (!userToken) return undefined;

        const refreshBookingState = () => {
            fetchDuplicateAppointment();
            fetchProcedureOptions();
            fetchBlockedDates(currentMonth);
            if (selectedDate) {
                fetchSlots(selectedDate, { preserveSelection: true });
            }
        };

        const intervalId = setInterval(refreshBookingState, 30000);
        const unsubscribe = navigation.addListener('focus', refreshBookingState);

        return () => {
            clearInterval(intervalId);
            unsubscribe();
        };
    }, [
        currentMonth,
        fetchBlockedDates,
        fetchDuplicateAppointment,
        fetchProcedureOptions,
        fetchSlots,
        navigation,
        selectedDate,
        userToken,
    ]);

    const buildMarkedDates = () => {
        const marked = {};
        blockedDates.forEach((dateStr) => {
            marked[dateStr] = {
                disabled: true,
                disableTouchEvent: true,
                marked: true,
                dotColor: '#e53935',
                customStyles: {
                    container: { backgroundColor: '#ffebee', borderRadius: 6 },
                    text: { color: '#e57373', textDecorationLine: 'line-through' },
                },
            };
        });
        if (selectedDate) {
            marked[selectedDate] = {
                selected: true,
                selectedColor: '#01538b',
            };
        }
        return marked;
    };

    const handleDateSelect = (day) => {
        const date = new Date(`${day.dateString}T12:00:00`);
        if (date.getDay() === 0) return;
        if (blockedDates.includes(day.dateString)) return;
        setSelectedDate(day.dateString);
        fetchSlots(day.dateString);
    };

    const handleMonthChange = (month) => {
        setCurrentMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
    };

    const handleNext = () => {
        if (!assignedBranch) {
            Alert.alert(
                'Assigned Branch Required',
                'Your account does not have an assigned branch yet. Please contact the clinic before booking an appointment.',
            );
            return;
        }

        if (step < 4) setStep((prev) => prev + 1);
    };

    const handleBack = () => {
        if (step > 1) {
            setStep((prev) => prev - 1);
        } else {
            navigation.goBack();
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify({
                    date: selectedDate,
                    time: selectedTime,
                    procedure: selectedProcedure,
                    notes: notes.trim() || 'For consultation',
                    branch: assignedBranch,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setModalType('success');
                setModalMessage(
                    `Your appointment request for ${formatDisplayDate(selectedDate)}${selectedTime ? ` at ${to12h(selectedTime)}` : ''} has been submitted. The clinic will confirm your schedule shortly.`,
                );
                logActivity(
                    'APPOINTMENT_REQUEST',
                    `Requested ${selectedProcedure} on ${formatDisplayDate(selectedDate)} at ${to12h(selectedTime)}`,
                    userToken,
                    API_BASE_URL,
                );
                setModalVisible(true);
                return;
            }
            if (res.status === 409 && data.code === 'ACTIVE_APPOINTMENT_EXISTS' && data.appointment) {
                setDuplicateAppt(data.appointment);
                return;
            }
            setModalType('error');
            setModalMessage(data.message || 'Booking failed. Please try again.');
            setModalVisible(true);
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
        if (modalType === 'success') navigation.navigate('PatientTabs', { screen: 'PatientDashboardMain' });
    };

    const renderDuplicateState = () => {
        const apptDateStr = duplicateAppt?.date ? getDateKeyInManila(duplicateAppt.date) : '';
        return (
            <View style={styles.duplicateCard}>
                <View style={styles.duplicateIconWrap}>
                    <Ionicons name="calendar-clear-outline" size={20} color="#9a6700" />
                </View>
                <Text style={styles.duplicateTitle}>You already have an active appointment request</Text>
                <Text style={styles.duplicateText}>
                    Dentime only allows one active mobile appointment request at a time so the clinic can manage your slot accurately.
                </Text>
                <View style={styles.duplicateSummary}>
                    <SummaryRow label="Status" value={duplicateAppt?.status || 'Pending'} />
                    <SummaryRow label="Procedure" value={duplicateAppt?.procedure || 'Clinic Appointment'} />
                    <SummaryRow label="Date" value={apptDateStr ? formatDisplayDate(apptDateStr) : 'Scheduled date'} />
                    <SummaryRow label="Time" value={duplicateAppt?.time ? to12h(duplicateAppt.time) : 'To be confirmed'} />
                    <SummaryRow label="Branch" value={duplicateAppt?.branch || assignedBranch || 'Assigned branch'} />
                </View>
                <Text style={styles.duplicateHint}>
                    Wait until this appointment is completed or cancelled before sending another booking request.
                </Text>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => navigation.navigate('PatientTabs', { screen: 'PatientDashboardMain' })}
                    activeOpacity={0.82}
                >
                    <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderDateStep = () => (
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            <Text style={styles.stepHeading}>Select a Date</Text>
            <Text style={styles.stepSub}>{assignedBranch} · Sundays and fully booked dates are unavailable.</Text>

            <View style={styles.branchBanner}>
                <Ionicons name="business-outline" size={16} color="#01538b" />
                <Text style={styles.branchBannerText}>Appointments will be routed automatically to your assigned branch: {assignedBranch || 'No branch assigned'}</Text>
            </View>

            {loadingBlocked && (
                <View style={styles.blockedLoadingRow}>
                    <ActivityIndicator size="small" color="#01538b" />
                    <Text style={styles.blockedLoadingText}>Checking availability...</Text>
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
                    todayTextColor: '#01538b',
                    arrowColor: '#01538b',
                    dotColor: '#e53935',
                    selectedDotColor: 'white',
                    textDayFontWeight: '600',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    calendarBackground: 'white',
                    textSectionTitleColor: '#01538b',
                    textDisabledColor: '#ddd',
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
                    <Text style={[styles.selectedDateText, { marginLeft: 6 }]}>Selected: {formatDisplayDate(selectedDate)}</Text>
                </View>
            ) : null}

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, !selectedDate && styles.disabledBtn]}
                    onPress={handleNext}
                    disabled={!selectedDate}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderTimeStep = () => {
        const isSlotTaken = (slot24) => takenSlots.some((slot) => slot === slot24);

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.stepHeading}>Select a Time Slot</Text>
                <Text style={styles.stepSub}>{assignedBranch} · {formatDisplayDate(selectedDate)}</Text>

                {loadingSlots ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color="#01538b" size="large" />
                        <Text style={styles.loadingText}>Checking availability...</Text>
                    </View>
                ) : slotsError ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{slotsError}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchSlots(selectedDate)}>
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : allowedSlots.length === 0 ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>No time slots are configured for this date yet. Please choose another date.</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.slotGrid}>
                            {allowedSlots.map((slot24) => {
                                const slot12 = to12h(slot24);
                                const taken = isSlotTaken(slot24);
                                const past = isSlotPast(slot24, selectedDate, today);
                                const disabled = taken || past;
                                const selected = selectedTime === slot24;
                                return (
                                    <TouchableOpacity
                                        key={slot24}
                                        style={[
                                            styles.slotChip,
                                            selected && styles.slotSelected,
                                            taken && styles.slotTaken,
                                            past && !taken && styles.slotPast,
                                        ]}
                                        onPress={() => !disabled && setSelectedTime(slot24)}
                                        disabled={disabled}
                                        activeOpacity={disabled ? 1 : 0.72}
                                    >
                                        <Text style={[
                                            styles.slotText,
                                            selected && styles.slotTextSelected,
                                            disabled && styles.slotTextTaken,
                                        ]}>
                                            {slot12}
                                        </Text>
                                        {taken && <Text style={styles.takenLabel}>Taken</Text>}
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
                        style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, (!selectedTime || loadingSlots) && styles.disabledBtn]}
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

    const renderProcedureStep = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Procedure and Details</Text>
            <Text style={styles.stepSub}>Choose the Dentime service that best matches your visit.</Text>
            <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerText}>
                    Patients may directly request only the services currently enabled for online booking. Any additional procedure needed after assessment or treatment will be recorded by the clinic.
                </Text>
            </View>

            <View style={styles.procedureList}>
                {availableProcedures.map((procedure) => {
                    const selected = selectedProcedure === procedure;
                    return (
                        <TouchableOpacity
                            key={procedure}
                            style={[styles.procedureItem, selected && styles.procedureSelected]}
                            onPress={() => setSelectedProcedure(procedure)}
                            activeOpacity={0.72}
                        >
                            <View style={[styles.radioCircle, selected && styles.radioSelected]}>
                                {selected && <View style={styles.radioDot} />}
                            </View>
                            <Text style={[styles.procedureText, selected && styles.procedureTextSelected]}>{procedure}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Additional Notes <Text style={styles.optionalTag}>(optional)</Text></Text>
            <TextInput
                style={styles.notesInput}
                placeholder="Examples: for consultation, 2nd adjustment, sensitivity on left molar"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
            />

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
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

    const renderConfirmStep = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.stepHeading}>Confirm Your Booking</Text>
            <Text style={styles.stepSub}>Review your request before sending it to the clinic.</Text>

            <View style={styles.summaryCard}>
                <SummaryRow label="Assigned Branch" value={assignedBranch} />
                <SummaryRow label="Date" value={formatDisplayDate(selectedDate)} />
                <SummaryRow label="Time" value={selectedTime ? to12h(selectedTime) : '—'} />
                <SummaryRow label="Procedure" value={selectedProcedure} />
                {notes.trim() ? <SummaryRow label="Notes" value={notes.trim()} /> : null}
            </View>

            <TouchableOpacity
                style={[styles.privacyCard, privacyAccepted && styles.privacyCardActive, !privacySummaryViewed && styles.privacyCardDisabled]}
                onPress={() => setPrivacyAccepted((prev) => !prev)}
                disabled={!privacySummaryViewed}
                activeOpacity={0.82}
                accessibilityState={{ disabled: !privacySummaryViewed, checked: privacyAccepted }}
            >
                <View style={[styles.radioCircle, privacyAccepted && styles.radioSelected]}>
                    {privacyAccepted && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.privacyText}>
                    {privacySummaryViewed
                        ? 'I have reviewed the NgitiFy Privacy Policy and consent to the use of my information for appointment scheduling and clinic communications.'
                        : 'View the Privacy Policy Summary below before this consent option becomes available.'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {
                setPrivacySummaryViewed(true);
                setPrivacyModalVisible(true);
            }} activeOpacity={0.75} style={styles.privacyLinkRow}>
                <Ionicons name="document-text-outline" size={16} color="#01538b" />
                <Text style={styles.privacyLinkText}>View Privacy Policy Summary</Text>
            </TouchableOpacity>

            <View style={styles.disclaimerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle-outline" size={16} color="#795548" style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={[styles.disclaimerText, { flex: 1 }]}>
                        Your booking request will remain <Text style={{ fontWeight: 'bold' }}>pending confirmation</Text> until the clinic approves it.
                    </Text>
                </View>
            </View>

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack} disabled={isSubmitting}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, (isSubmitting || !privacyAccepted) && styles.disabledBtn]}
                    onPress={handleSubmit}
                    disabled={isSubmitting || !privacyAccepted}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Submit Booking</Text>}
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>{step > 1 ? 'Back' : 'Cancel'}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <View style={{ width: 70 }} />
            </View>

            {!hasActiveRequest && <StepIndicator current={step} />}

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {hasActiveRequest
                    ? renderDuplicateState()
                    : (
                        <>
                            {step === 1 && renderDateStep()}
                            {step === 2 && renderTimeStep()}
                            {step === 3 && renderProcedureStep()}
                            {step === 4 && renderConfirmStep()}
                        </>
                    )}
            </ScrollView>


            <CustomModal
                visible={modalVisible}
                type={modalType}
                title={modalType === 'success' ? 'Booking Submitted!' : 'Booking Failed'}
                message={modalMessage}
                onClose={handleModalClose}
            />

            <Modal
                visible={privacyModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPrivacyModalVisible(false)}
            >
                <View style={styles.privacyModalOverlay}>
                    <View style={styles.privacyModalCard}>
                        <Text style={styles.privacyModalTitle}>NgitiFy Privacy Policy</Text>
                        <Text style={styles.privacyModalMeta}>Version v1.0 • Updated May 3, 2026</Text>
                        <Text style={styles.privacyModalText}>
                            We collect the details you enter here to schedule your appointment, coordinate with your assigned branch, confirm your visit, and keep the clinic record aligned with your patient account.
                        </Text>
                        <Text style={styles.privacyModalText}>
                            Authorized clinic staff may access this information for scheduling, treatment preparation, follow-up communication, and legal recordkeeping under the Data Privacy Act of 2012.
                        </Text>
                        <Text style={styles.privacyModalText}>
                            You may ask the clinic to review, correct, or clarify the personal information attached to your booking at any time.
                        </Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => setPrivacyModalVisible(false)} activeOpacity={0.82}>
                            <Text style={styles.primaryBtnText}>I Understand</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const indicator = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 16, backgroundColor: 'white', elevation: 1 },
    item: { alignItems: 'center', flex: 0 },
    circle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    activeCircle: { backgroundColor: '#01538b' },
    doneCircle: { backgroundColor: '#4caf50' },
    num: { fontSize: 11, fontWeight: 'bold', color: '#999' },
    activeNum: { color: 'white' },
    label: { fontSize: 9, color: '#aaa', fontWeight: '600' },
    activeLabel: { color: '#01538b' },
    line: { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginBottom: 16, marginHorizontal: 2 },
    doneLine: { backgroundColor: '#4caf50' },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 70 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    content: { padding: 20, paddingBottom: 48 },
    stepHeading: { fontSize: 20, fontWeight: 'bold', color: '#01538b', marginBottom: 4, marginTop: 4 },
    stepSub: { fontSize: 13, color: '#888', marginBottom: 16 },
    branchBanner: { backgroundColor: '#e8f1f8', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
    branchBannerText: { color: '#01538b', fontSize: 13, flex: 1, lineHeight: 18 },
    calendar: { borderRadius: 15, elevation: 2, marginBottom: 12, overflow: 'hidden' },
    blockedLoadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    blockedLoadingText: { marginLeft: 8, fontSize: 12, color: '#888' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
    slotLegendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, color: '#888' },
    selectedDatePill: { backgroundColor: '#e8f1f8', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    selectedDateText: { color: '#01538b', fontWeight: '700', fontSize: 13 },
    primaryBtn: { backgroundColor: '#01538b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    disabledBtn: { backgroundColor: '#b0bec5' },
    secondaryBtn: { backgroundColor: 'white', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#01538b', marginTop: 10 },
    secondaryBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 15 },
    navRow: { flexDirection: 'row', alignItems: 'center' },
    loadingBox: { alignItems: 'center', paddingVertical: 40 },
    loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
    errorBox: { backgroundColor: '#fff3f3', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
    errorBoxText: { color: '#d32f2f', fontSize: 13, textAlign: 'center', marginBottom: 10 },
    retryBtn: { backgroundColor: '#01538b', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryBtnText: { color: 'white', fontWeight: 'bold' },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    slotChip: { width: '47%', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'white', borderWidth: 1.2, borderColor: '#d9e2e8', alignItems: 'center' },
    slotSelected: { backgroundColor: '#01538b', borderColor: '#01538b' },
    slotTaken: { backgroundColor: '#eceff1', borderColor: '#cfd8dc' },
    slotPast: { backgroundColor: '#fff8e1', borderColor: '#ffe082' },
    slotText: { color: '#01538b', fontWeight: '700' },
    slotTextSelected: { color: 'white' },
    slotTextTaken: { color: '#90a4ae' },
    takenLabel: { fontSize: 11, color: '#78909c', marginTop: 4, fontWeight: '700' },
    procedureList: { gap: 10 },
    procedureItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', padding: 14, borderRadius: 14, borderWidth: 1.2, borderColor: '#dde6eb' },
    procedureSelected: { borderColor: '#01538b', backgroundColor: '#e8f1f8' },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.6, borderColor: '#9db1be', alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: '#01538b' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#01538b' },
    procedureText: { color: '#284b63', flex: 1 },
    procedureTextSelected: { color: '#01538b', fontWeight: '700' },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#35576a' },
    optionalTag: { color: '#78909c', fontWeight: '500' },
    notesInput: { marginTop: 8, minHeight: 110, borderWidth: 1.2, borderColor: '#d8e2e8', borderRadius: 14, backgroundColor: 'white', padding: 14, color: '#284b63' },
    summaryCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, gap: 12, marginBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    summaryLabel: { color: '#607d8b', fontWeight: '700', flex: 1 },
    summaryValue: { color: '#284b63', flex: 1.4, textAlign: 'right' },
    duplicateCard: { backgroundColor: 'white', borderRadius: 18, padding: 20, gap: 14, borderWidth: 1, borderColor: '#f4d48b' },
    duplicateIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff8e1', alignItems: 'center', justifyContent: 'center' },
    duplicateTitle: { color: '#8a5b00', fontSize: 20, fontWeight: '800' },
    duplicateText: { color: '#6d4c41', lineHeight: 20 },
    duplicateSummary: { backgroundColor: '#fffdf7', borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: '#f5e6b7' },
    duplicateHint: { color: '#607d8b', fontSize: 13, lineHeight: 18 },
    disclaimerCard: { backgroundColor: '#fff8e1', borderRadius: 14, padding: 14, marginBottom: 16 },
    disclaimerText: { color: '#6d4c41', lineHeight: 19 },
    privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1.2, borderColor: '#d8e2e8', marginBottom: 16 },
    privacyCardActive: { borderColor: '#01538b', backgroundColor: '#e8f1f8' },
    privacyCardDisabled: { opacity: 0.55 },
    privacyText: { flex: 1, color: '#284b63', lineHeight: 20 },
    privacyLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: -4, marginBottom: 16 },
    privacyLinkText: { color: '#01538b', fontWeight: '700' },
    privacyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'center', padding: 20 },
    privacyModalCard: { backgroundColor: 'white', borderRadius: 18, padding: 20, gap: 12 },
    privacyModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    privacyModalMeta: { color: '#607d8b', fontWeight: '600' },
    privacyModalText: { color: '#284b63', lineHeight: 21 },
});
