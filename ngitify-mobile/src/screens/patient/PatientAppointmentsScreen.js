import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

function AppointmentCard({ appointment }) {
    const dentistName = getAppointmentDentistLabel(appointment);

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
