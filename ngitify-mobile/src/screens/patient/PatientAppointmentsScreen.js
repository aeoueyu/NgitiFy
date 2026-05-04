import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
};

const formatTime = (time24) => {
    if (!time24) return 'Time to be assigned';
    const [h, m] = time24.split(':');
    const hour = parseInt(h, 10);
    if (Number.isNaN(hour)) return time24;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${suffix}`;
};

const STATUS_STYLES = {
    pending: { bg: '#fff3e0', text: '#e65100', dot: '#ff9800' },
    confirmed: { bg: '#e3f2fd', text: '#01538b', dot: '#2196f3' },
    'in-clinic': { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' },
    completed: { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' },
    cancelled: { bg: '#ffebee', text: '#c62828', dot: '#ef5350' },
};

function AppointmentCard({ appointment }) {
    const statusKey = String(appointment.status || 'pending').toLowerCase();
    const sc = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
    const dentistName = appointment.dentist
        ? `Dr. ${appointment.dentist.name?.first || ''} ${appointment.dentist.name?.last || ''}`.trim()
        : 'To be assigned';

    return (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.cardProcedure}>{appointment.procedure || 'Appointment'}</Text>
                    <Text style={styles.cardMeta}>{formatDate(appointment.date)}</Text>
                    <Text style={styles.cardMeta}>{formatTime(appointment.time)}</Text>
                    <Text style={styles.cardDentist}>{dentistName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                    <Text style={[styles.statusText, { color: sc.text }]}>
                        {statusKey === 'in-clinic' ? 'In Clinic' : `${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`}
                    </Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.metaRow}>
                    <Ionicons name="business-outline" size={14} color="#6b7b88" style={{ marginRight: 6 }} />
                    <Text style={styles.branchText}>{appointment.branch || 'Dentime Dental Clinic'}</Text>
                </View>
                {appointment.notes ? (
                    <Text style={styles.notesText} numberOfLines={2}>
                        Notes: {appointment.notes}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

export default function PatientAppointmentsScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

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
        } catch (fetchError) {
            setError(fetchError.message || 'Could not load appointments.');
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
        const upcomingItems = appointments
            .filter((appt) => ['pending', 'confirmed', 'in-clinic'].includes(appt.status))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const pastItems = appointments
            .filter((appt) => ['completed', 'cancelled'].includes(appt.status))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return { upcoming: upcomingItems, past: pastItems };
    }, [appointments]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Appointments</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentInner}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01538b']} />}
            >
                <TouchableOpacity style={styles.bookButton} onPress={() => navigation.navigate('AppointmentBooking')} activeOpacity={0.82}>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.bookButtonText}>Book New Appointment</Text>
                </TouchableOpacity>

                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator size="large" color="#01538b" />
                        <Text style={styles.stateText}>Loading your appointments...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateCard}>
                        <Ionicons name="warning-outline" size={36} color="#e65100" style={{ marginBottom: 10 }} />
                        <Text style={styles.stateTitle}>Could not load appointments</Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={fetchAppointments}>
                            <Text style={styles.retryBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                        {upcoming.length ? (
                            upcoming.map((appointment) => (
                                <AppointmentCard key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`} appointment={appointment} />
                            ))
                        ) : (
                            <View style={styles.stateCard}>
                                <Ionicons name="calendar-outline" size={32} color="#9aa7b2" style={{ marginBottom: 10 }} />
                                <Text style={styles.stateTitle}>No upcoming appointment</Text>
                                <Text style={styles.stateText}>Your pending, confirmed, or in-clinic visits will appear here.</Text>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>Past / Cancelled Appointments</Text>
                        {past.length ? (
                            past.map((appointment) => (
                                <AppointmentCard key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`} appointment={appointment} />
                            ))
                        ) : (
                            <View style={styles.stateCard}>
                                <Ionicons name="time-outline" size={32} color="#9aa7b2" style={{ marginBottom: 10 }} />
                                <Text style={styles.stateTitle}>No past appointments yet</Text>
                                <Text style={styles.stateText}>Completed and cancelled visits will appear here.</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    content: { flex: 1 },
    contentInner: { padding: 18, paddingBottom: 32 },
    bookButton: { backgroundColor: '#01538b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
    bookButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#284b63', marginBottom: 12, marginTop: 4 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e1e8ed' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardProcedure: { fontSize: 16, fontWeight: '700', color: '#183b56', marginBottom: 6 },
    cardMeta: { fontSize: 13, color: '#5f7384', marginBottom: 4 },
    cardDentist: { fontSize: 13, color: '#01538b', fontWeight: '600' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 99, marginRight: 6 },
    statusText: { fontSize: 12, fontWeight: '700' },
    cardFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eef3f6', paddingTop: 12 },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    branchText: { fontSize: 13, color: '#5f7384' },
    notesText: { marginTop: 8, fontSize: 12, color: '#6b7b88' },
    stateCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e1e8ed' },
    stateTitle: { fontSize: 16, fontWeight: '700', color: '#284b63', marginBottom: 6, textAlign: 'center' },
    stateText: { fontSize: 13, color: '#6b7b88', textAlign: 'center', lineHeight: 20, marginTop: 4 },
    retryBtn: { marginTop: 14, backgroundColor: '#01538b', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
    retryBtnText: { color: '#fff', fontWeight: '700' },
});
