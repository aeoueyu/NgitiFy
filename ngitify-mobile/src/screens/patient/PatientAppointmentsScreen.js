import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { AuthContext } from '../../context/AuthContext';
import {
    Header,
    PrimaryButton,
    Screen,
    SectionLabel,
    StatusChip,
    SurfaceCard,
} from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';
const { classifyPatientAppointments } = require('../../utils/patientVisitHistory');
const PATIENT_CHANGEABLE_STATUSES = new Set(['pending', 'confirmed']);
const MANILA_TIME_ZONE = 'Asia/Manila';
const manilaDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const getDateKeyInManila = (value = new Date()) => {
    const parts = Object.fromEntries(
        manilaDateFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatTime = (time24) => {
    if (!time24) return 'Time to be assigned';
    const [hourText, minute] = time24.split(':');
    const hour = parseInt(hourText, 10);
    if (Number.isNaN(hour)) return time24;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const getAppointmentDentistLabel = (appointment) => {
    if (appointment?.dentist) {
        return `Dr. ${appointment.dentist.name?.first || ''} ${appointment.dentist.name?.last || ''}`.trim();
    }
    if (appointment?.dentistName) {
        return appointment.dentistName;
    }
    return 'To be assigned';
};

function AppointmentCard({ appointment, onCancel, onReschedule }) {
    const dentistName = getAppointmentDentistLabel(appointment);
    const canChange = PATIENT_CHANGEABLE_STATUSES.has(String(appointment?.status || '').toLowerCase())
        && appointment?.isArchived !== true
        && appointment?.isQueueEntry !== true;

    return (
        <SurfaceCard style={styles.appointmentCard}>
            <View style={styles.appointmentTopRow}>
                <View style={styles.appointmentCopy}>
                    <Text style={styles.procedureText}>{appointment.procedure || 'Appointment'}</Text>
                    <Text style={styles.dentistText}>{dentistName}</Text>
                </View>
                <StatusChip
                    status={appointment.status}
                    label={appointment.status === 'in-clinic' ? 'In Clinic' : appointment.status}
                />
            </View>

            <View style={styles.detailPills}>
                <View style={styles.detailPill}>
                    <Ionicons name="calendar-outline" size={14} color={mobileTheme.colors.primaryDark} />
                    <Text style={styles.detailPillText}>{formatDate(appointment.date)}</Text>
                </View>
                <View style={styles.detailPill}>
                    <Ionicons name="time-outline" size={14} color={mobileTheme.colors.primaryDark} />
                    <Text style={styles.detailPillText}>{formatTime(appointment.time)}</Text>
                </View>
            </View>

            <View style={styles.metaRow}>
                <Ionicons name="business-outline" size={15} color={mobileTheme.colors.textSoft} />
                <Text style={styles.metaText}>{appointment.branch || 'Dentime Dental Clinic'}</Text>
            </View>

            {appointment.notes ? (
                <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
            ) : null}

            {canChange ? (
                <View style={styles.appointmentActions}>
                    <TouchableOpacity
                        style={styles.rescheduleButton}
                        onPress={() => onReschedule(appointment)}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Reschedule ${appointment.procedure || 'appointment'}`}
                    >
                        <Ionicons name="calendar-outline" size={16} color={mobileTheme.colors.primaryDark} />
                        <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => onCancel(appointment)}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel ${appointment.procedure || 'appointment'}`}
                    >
                        <Ionicons name="close-circle-outline" size={16} color="#b91c1c" />
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </SurfaceCard>
    );
}

function EmptyState({ icon, title, subtitle }) {
    return (
        <SurfaceCard style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
                <Ionicons name={icon} size={22} color={mobileTheme.colors.primaryDark} />
            </View>
            <Text style={styles.stateTitle}>{title}</Text>
            <Text style={styles.stateText}>{subtitle}</Text>
        </SurfaceCard>
    );
}

function PastVisitRow({ appointment }) {
    return <View style={styles.pastVisitRow}>
        <View style={styles.pastVisitCopy}>
            <Text style={styles.pastVisitTitle} numberOfLines={1}>{appointment.procedure || 'Dental visit'}</Text>
            <Text style={styles.pastVisitMeta} numberOfLines={1}>{formatDate(appointment.date)} · {getAppointmentDentistLabel(appointment)}</Text>
        </View>
        <StatusChip status={appointment.status} label={appointment.status} />
    </View>;
}

export default function PatientAppointmentsScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showAllPast, setShowAllPast] = useState(false);
    const [actionMode, setActionMode] = useState('');
    const [actionTarget, setActionTarget] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const fetchAppointments = useCallback(async () => {
        if (!userToken || !userId) return;

        try {
            setError('');
            const res = await fetch(`${API_BASE_URL}/api/appointments?patientId=${userId}`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data?.message || 'Could not load appointments.');
            setAppointments(Array.isArray(data) ? data : []);
        } catch {
            setError("We couldn't load your visits. Check your connection and try again.");
            setAppointments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [API_BASE_URL, userId, userToken]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchAppointments);
        return unsub;
    }, [fetchAppointments, navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAppointments();
    };

    const closeAction = () => {
        setActionMode('');
        setActionTarget(null);
        setActionReason('');
        setActionError('');
        setRescheduleDate('');
        setRescheduleTime('');
        setAvailableSlots([]);
    };

    const openCancel = (appointment) => {
        setActionTarget(appointment);
        setActionMode('cancel');
        setActionReason('');
        setActionError('');
    };

    const openReschedule = (appointment) => {
        setActionTarget(appointment);
        setActionMode('reschedule');
        setActionReason('');
        setActionError('');
        setRescheduleDate(getDateKeyInManila(appointment.date));
        setRescheduleTime(appointment.time || '');
    };

    const fetchRescheduleSlots = useCallback(async (appointment, date) => {
        if (!appointment?._id || !date) return;
        setLoadingSlots(true);
        setActionError('');
        try {
            const query = [
                `date=${encodeURIComponent(date)}`,
                `branch=${encodeURIComponent(appointment.branch || '')}`,
                `excludeAppointmentId=${encodeURIComponent(appointment._id)}`,
            ].join('&');
            const res = await fetch(`${API_BASE_URL}/api/appointments/slots?${query}`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Could not load available time slots.');
            const taken = new Set(Array.isArray(data.takenSlots) ? data.takenSlots : []);
            const nextSlots = (Array.isArray(data.allowedSlots) ? data.allowedSlots : [])
                .filter((slot) => !taken.has(slot));
            setAvailableSlots(nextSlots);
            setRescheduleTime((current) => nextSlots.includes(current) ? current : '');
        } catch (slotError) {
            setAvailableSlots([]);
            setRescheduleTime('');
            setActionError(slotError?.message || 'Could not load available time slots.');
        } finally {
            setLoadingSlots(false);
        }
    }, [API_BASE_URL, userToken]);

    useEffect(() => {
        if (actionMode !== 'reschedule' || !actionTarget || !rescheduleDate) return;
        fetchRescheduleSlots(actionTarget, rescheduleDate);
    }, [actionMode, actionTarget, fetchRescheduleSlots, rescheduleDate]);

    const submitCancellation = async () => {
        if (!actionTarget?._id) return;
        setActionSubmitting(true);
        setActionError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/${actionTarget._id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify({
                    status: 'cancelled',
                    cancellationReason: actionReason.trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Unable to cancel this appointment.');
            closeAction();
            await fetchAppointments();
            Alert.alert('Appointment Cancelled', 'Your appointment has been cancelled successfully.');
        } catch (cancelError) {
            setActionError(cancelError?.message || 'Unable to cancel this appointment.');
        } finally {
            setActionSubmitting(false);
        }
    };

    const submitReschedule = async () => {
        if (!actionTarget?._id || !rescheduleDate || !rescheduleTime) {
            setActionError('Select a new date and an available time.');
            return;
        }
        setActionSubmitting(true);
        setActionError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/${actionTarget._id}/reschedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify({
                    newDate: rescheduleDate,
                    newTime: rescheduleTime,
                    reason: actionReason.trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Unable to reschedule this appointment.');
            closeAction();
            await fetchAppointments();
            Alert.alert('Appointment Rescheduled', `Your appointment is now scheduled for ${formatDate(rescheduleDate)} at ${formatTime(rescheduleTime)}.`);
        } catch (rescheduleError) {
            setActionError(rescheduleError?.message || 'Unable to reschedule this appointment.');
        } finally {
            setActionSubmitting(false);
        }
    };

    const { upcoming, past } = useMemo(() => {
        return classifyPatientAppointments(appointments);
    }, [appointments]);

    return (
        <Screen>
            <Header
                title="Visits"
                subtitle="Appointments and visit history"
            />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[mobileTheme.colors.primaryDark]}
                        tintColor={mobileTheme.colors.primaryDark}
                    />
                )}
            >
                <SurfaceCard style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.heroCopy}>
                            <Text style={styles.heroTitle}>Your visit timeline</Text>
                            <Text style={styles.heroSubtitle}>
                                Review upcoming bookings and your completed clinic visits in one place.
                            </Text>
                        </View>
                        <View style={styles.heroIconBubble}>
                            <Ionicons name="calendar-outline" size={24} color="#ffffff" />
                        </View>
                    </View>

                    <View style={styles.heroStatsRow}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{upcoming.length}</Text>
                            <Text style={styles.heroStatLabel}>Upcoming</Text>
                        </View>
                        <View style={styles.heroStatDivider} />
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{past.length}</Text>
                            <Text style={styles.heroStatLabel}>Completed or Cancelled</Text>
                        </View>
                    </View>

                    <PrimaryButton
                        label="Book Appointment"
                        icon="add-outline"
                        onPress={() => navigation.navigate('AppointmentBooking')}
                        style={styles.heroButton}
                        textStyle={styles.heroButtonText}
                        iconColor={mobileTheme.colors.primaryDark}
                    />
                </SurfaceCard>

                {loading ? (
                    <SurfaceCard style={styles.loaderCard}>
                        <ActivityIndicator size="large" color={mobileTheme.colors.primaryDark} />
                        <Text style={styles.loaderText}>Loading your appointments...</Text>
                    </SurfaceCard>
                ) : error ? (
                    <SurfaceCard style={styles.errorCard}>
                        <View style={styles.stateIconWrap}>
                            <Ionicons name="warning-outline" size={22} color={mobileTheme.colors.primaryDark} />
                        </View>
                        <Text style={styles.stateTitle}>Could not load appointments</Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchAppointments} activeOpacity={0.82}>
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                    </SurfaceCard>
                ) : (
                    <>
                        <SectionLabel
                            eyebrow="Scheduled"
                            title="Upcoming Visits"
                            style={styles.sectionHeader}
                        />
                        {upcoming.length ? (
                            upcoming.map((appointment) => (
                                <AppointmentCard
                                    key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`}
                                    appointment={appointment}
                                    onCancel={openCancel}
                                    onReschedule={openReschedule}
                                />
                            ))
                        ) : (
                            <EmptyState
                                icon="calendar-clear-outline"
                                title="No upcoming appointment"
                                subtitle="Your pending, confirmed, and in-clinic appointments will appear here."
                            />
                        )}

                        <SectionLabel
                            eyebrow="History"
                            title="Past Visits"
                            style={styles.sectionHeader}
                        />
                        {past.length ? (
                            past.slice(0, 4).map((appointment) => (
                                <PastVisitRow
                                    key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`}
                                    appointment={appointment}
                                />
                            ))
                        ) : (
                            <EmptyState
                                icon="time-outline"
                                title="No visit history yet"
                                subtitle="Completed and cancelled appointments will show up here after your clinic activity grows."
                            />
                        )}
                        {past.length > 4 ? <TouchableOpacity style={styles.viewAllButton} onPress={() => setShowAllPast(true)} accessibilityRole="button">
                            <Text style={styles.viewAllText}>View all past visits ({past.length})</Text><Ionicons name="chevron-forward" size={18} color={mobileTheme.colors.primaryDark} />
                        </TouchableOpacity> : null}
                    </>
                )}
            </ScrollView>
            <Modal visible={showAllPast} animationType="slide" onRequestClose={() => setShowAllPast(false)}>
                <Screen><Header title="Past Visits" subtitle={`${past.length} saved visits`} onBack={() => setShowAllPast(false)} />
                    <FlatList data={past} keyExtractor={(item, index) => item._id || `past-${index}`} renderItem={({ item }) => <PastVisitRow appointment={item} />} contentContainerStyle={styles.historyList} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} />
                </Screen>
            </Modal>
            <Modal
                visible={Boolean(actionMode && actionTarget)}
                animationType="slide"
                onRequestClose={actionSubmitting ? undefined : closeAction}
            >
                <Screen>
                    <Header
                        title={actionMode === 'cancel' ? 'Cancel Appointment' : 'Reschedule Appointment'}
                        subtitle={actionTarget?.procedure || 'Appointment'}
                        onBack={actionSubmitting ? undefined : closeAction}
                    />
                    <ScrollView contentContainerStyle={styles.actionContent} showsVerticalScrollIndicator={false}>
                        <SurfaceCard style={styles.actionSummaryCard}>
                            <Text style={styles.actionSummaryTitle}>{actionTarget?.procedure || 'Appointment'}</Text>
                            <Text style={styles.actionSummaryMeta}>
                                {formatDate(actionTarget?.date)} at {formatTime(actionTarget?.time)}
                            </Text>
                            <Text style={styles.actionSummaryMeta}>{actionTarget?.branch || 'Dentime Dental Clinic'}</Text>
                        </SurfaceCard>

                        {actionMode === 'cancel' ? (
                            <SurfaceCard style={styles.actionCard}>
                                <View style={styles.warningRow}>
                                    <Ionicons name="warning-outline" size={22} color="#b91c1c" />
                                    <Text style={styles.warningText}>Cancelling cannot be undone from the patient app.</Text>
                                </View>
                                <Text style={styles.inputLabel}>Cancellation reason (optional)</Text>
                                <TextInput
                                    style={styles.reasonInput}
                                    value={actionReason}
                                    onChangeText={setActionReason}
                                    placeholder="Tell the clinic why you need to cancel"
                                    placeholderTextColor={mobileTheme.colors.textSoft}
                                    multiline
                                    editable={!actionSubmitting}
                                />
                            </SurfaceCard>
                        ) : null}

                        {actionMode === 'reschedule' ? (
                            <>
                                <SurfaceCard style={styles.calendarCard}>
                                    <Text style={styles.inputLabel}>Choose a new date</Text>
                                    <Calendar
                                        minDate={getDateKeyInManila()}
                                        current={rescheduleDate || getDateKeyInManila()}
                                        onDayPress={(day) => {
                                            const selected = new Date(`${day.dateString}T12:00:00`);
                                            if (selected.getDay() === 0) {
                                                setActionError('Appointments cannot be requested on Sundays.');
                                                return;
                                            }
                                            setActionError('');
                                            setRescheduleDate(day.dateString);
                                            setRescheduleTime('');
                                        }}
                                        markedDates={rescheduleDate ? {
                                            [rescheduleDate]: { selected: true, selectedColor: mobileTheme.colors.primaryDark },
                                        } : {}}
                                        theme={{
                                            todayTextColor: mobileTheme.colors.primaryDark,
                                            arrowColor: mobileTheme.colors.primaryDark,
                                            textDayFontWeight: '600',
                                            textMonthFontWeight: '700',
                                        }}
                                    />
                                </SurfaceCard>
                                <SurfaceCard style={styles.actionCard}>
                                    <Text style={styles.inputLabel}>Choose an available time</Text>
                                    {loadingSlots ? (
                                        <View style={styles.slotLoader}>
                                            <ActivityIndicator color={mobileTheme.colors.primaryDark} />
                                            <Text style={styles.slotLoaderText}>Checking available times...</Text>
                                        </View>
                                    ) : availableSlots.length ? (
                                        <View style={styles.slotGrid}>
                                            {availableSlots.map((slot) => {
                                                const selected = rescheduleTime === slot;
                                                return (
                                                    <TouchableOpacity
                                                        key={slot}
                                                        style={[styles.slotButton, selected && styles.slotButtonSelected]}
                                                        onPress={() => setRescheduleTime(slot)}
                                                        disabled={actionSubmitting}
                                                        accessibilityRole="button"
                                                        accessibilityState={{ selected }}
                                                    >
                                                        <Text style={[styles.slotButtonText, selected && styles.slotButtonTextSelected]}>{formatTime(slot)}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ) : !actionError ? (
                                        <Text style={styles.emptySlotsText}>No available times remain on this date. Choose another date.</Text>
                                    ) : null}
                                    <Text style={styles.inputLabel}>Reason (optional)</Text>
                                    <TextInput
                                        style={styles.reasonInput}
                                        value={actionReason}
                                        onChangeText={setActionReason}
                                        placeholder="Tell the clinic why you need a different schedule"
                                        placeholderTextColor={mobileTheme.colors.textSoft}
                                        multiline
                                        editable={!actionSubmitting}
                                    />
                                </SurfaceCard>
                            </>
                        ) : null}

                        {actionError ? <Text style={styles.actionError} accessibilityRole="alert">{actionError}</Text> : null}

                        <View style={styles.actionFooter}>
                            <TouchableOpacity style={styles.actionBackButton} onPress={closeAction} disabled={actionSubmitting} activeOpacity={0.82}>
                                <Text style={styles.actionBackText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    actionMode === 'cancel' ? styles.confirmCancelButton : styles.confirmRescheduleButton,
                                    (actionSubmitting || (actionMode === 'reschedule' && (!rescheduleDate || !rescheduleTime))) && styles.disabledButton,
                                ]}
                                onPress={actionMode === 'cancel' ? submitCancellation : submitReschedule}
                                disabled={actionSubmitting || (actionMode === 'reschedule' && (!rescheduleDate || !rescheduleTime))}
                                activeOpacity={0.82}
                            >
                                {actionSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                                <Text style={styles.confirmActionText}>
                                    {actionSubmitting
                                        ? 'Saving...'
                                        : actionMode === 'cancel' ? 'Confirm Cancellation' : 'Confirm Reschedule'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Screen>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 18,
        paddingBottom: 120,
    },
    heroCard: {
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: mobileTheme.colors.primary,
        borderColor: '#0e72b1',
    },
    heroButtonText: { color: mobileTheme.colors.primaryDark },
    pastVisitRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: mobileTheme.colors.border, backgroundColor: mobileTheme.colors.surface },
    pastVisitCopy: { flex: 1, paddingRight: 10 },
    pastVisitTitle: { color: mobileTheme.colors.text, fontSize: 15, fontWeight: '700' },
    pastVisitMeta: { marginTop: 5, color: mobileTheme.colors.textMuted, fontSize: 12 },
    viewAllButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
    viewAllText: { color: mobileTheme.colors.primaryDark, fontSize: 13, fontWeight: '700' },
    historyList: { paddingHorizontal: 18, paddingBottom: 36 },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    heroCopy: {
        flex: 1,
        paddingRight: 12,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 13,
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.86)',
    },
    heroIconBubble: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 22,
        marginBottom: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    heroStat: {
        flex: 1,
    },
    heroStatDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 12,
    },
    heroStatValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 4,
    },
    heroStatLabel: {
        fontSize: 11,
        lineHeight: 15,
        color: 'rgba(255, 255, 255, 0.84)',
    },
    heroButton: {
        backgroundColor: '#ffffff',
    },
    sectionHeader: {
        marginTop: 4,
        marginBottom: 14,
    },
    appointmentCard: {
        marginBottom: 12,
        padding: 18,
    },
    appointmentTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    appointmentCopy: {
        flex: 1,
        paddingRight: 10,
    },
    procedureText: {
        fontSize: 17,
        lineHeight: 23,
        fontWeight: '700',
        color: mobileTheme.colors.text,
        marginBottom: 6,
    },
    dentistText: {
        fontSize: 13,
        color: mobileTheme.colors.primaryDark,
        fontWeight: '600',
    },
    detailPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        marginHorizontal: -4,
    },
    detailPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: mobileTheme.colors.surfaceAlt,
        borderRadius: mobileTheme.radii.pill,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 4,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
    },
    detailPillText: {
        marginLeft: 6,
        fontSize: 12,
        color: mobileTheme.colors.primaryDark,
        fontWeight: '600',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        marginLeft: 7,
        fontSize: 13,
        color: mobileTheme.colors.textMuted,
    },
    notesBox: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: mobileTheme.colors.border,
    },
    notesLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: mobileTheme.colors.textSoft,
        marginBottom: 6,
    },
    notesText: {
        fontSize: 13,
        lineHeight: 19,
        color: mobileTheme.colors.textMuted,
    },
    appointmentActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: mobileTheme.colors.border,
    },
    rescheduleButton: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: mobileTheme.colors.primaryDark,
        backgroundColor: mobileTheme.colors.primarySoft,
    },
    rescheduleButtonText: { color: mobileTheme.colors.primaryDark, fontSize: 13, fontWeight: '700' },
    cancelButton: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
    },
    cancelButtonText: { color: '#b91c1c', fontSize: 13, fontWeight: '700' },
    actionContent: { paddingHorizontal: 18, paddingBottom: 48 },
    actionSummaryCard: { marginBottom: 12, backgroundColor: mobileTheme.colors.primarySoft },
    actionSummaryTitle: { color: mobileTheme.colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
    actionSummaryMeta: { color: mobileTheme.colors.textMuted, fontSize: 13, lineHeight: 20 },
    actionCard: { marginBottom: 12 },
    calendarCard: { marginBottom: 12, padding: 12 },
    warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 18 },
    warningText: { flex: 1, color: '#991b1b', fontSize: 13, lineHeight: 20 },
    inputLabel: { color: mobileTheme.colors.text, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 9 },
    reasonInput: {
        minHeight: 100,
        padding: 14,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        borderRadius: 14,
        backgroundColor: mobileTheme.colors.surfaceAlt,
        color: mobileTheme.colors.text,
        fontSize: 14,
        lineHeight: 20,
        textAlignVertical: 'top',
    },
    slotLoader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
    slotLoaderText: { color: mobileTheme.colors.textMuted, fontSize: 13 },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    slotButton: { minWidth: '30%', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, alignItems: 'center' },
    slotButtonSelected: { backgroundColor: mobileTheme.colors.primaryDark, borderColor: mobileTheme.colors.primaryDark },
    slotButtonText: { color: mobileTheme.colors.primaryDark, fontSize: 12, fontWeight: '700' },
    slotButtonTextSelected: { color: '#ffffff' },
    emptySlotsText: { color: mobileTheme.colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 20 },
    actionError: { marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#fef2f2', color: '#991b1b', fontSize: 13, lineHeight: 19 },
    actionFooter: { flexDirection: 'row', gap: 10, marginTop: 4 },
    actionBackButton: { minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: mobileTheme.colors.border },
    actionBackText: { color: mobileTheme.colors.primaryDark, fontSize: 14, fontWeight: '700' },
    confirmCancelButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#b91c1c' },
    confirmRescheduleButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: mobileTheme.colors.primaryDark },
    confirmActionText: { color: '#ffffff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
    disabledButton: { opacity: 0.55 },
    loaderCard: {
        alignItems: 'center',
        paddingVertical: 32,
        marginBottom: 12,
    },
    loaderText: {
        marginTop: 12,
        color: mobileTheme.colors.textMuted,
        fontSize: 14,
    },
    errorCard: {
        alignItems: 'center',
        paddingVertical: 28,
        marginBottom: 12,
    },
    stateCard: {
        alignItems: 'center',
        paddingVertical: 28,
        marginBottom: 12,
    },
    stateIconWrap: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: mobileTheme.colors.primarySoft,
        marginBottom: 12,
    },
    stateTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: mobileTheme.colors.text,
        marginBottom: 6,
        textAlign: 'center',
    },
    stateText: {
        fontSize: 13,
        lineHeight: 20,
        color: mobileTheme.colors.textMuted,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: mobileTheme.colors.primary,
        borderRadius: mobileTheme.radii.pill,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    retryButtonText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
});
