import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClinicMedical, FaNotesMedical, FaRegClock } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import {
    formatDateDisplay,
    formatTime24,
} from '../../utils/patientPortal';
import {
    PatientEmptyState,
    PatientPageFrame,
    PatientSectionHeader,
    PatientStatusBadge,
} from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'To be assigned';
};

function AppointmentCard({ appointment }) {
    return (
        <article className={styles.listCard}>
            <div className={styles.listHeader}>
                <div>
                    <h3 className={styles.listTitle}>{appointment.procedure || 'Appointment'}</h3>
                    <p className={styles.listMeta}>{getDentistLabel(appointment)}</p>
                </div>
                <PatientStatusBadge status={appointment.status} />
            </div>

            <div className={styles.detailPills}>
                <span className={styles.detailPill}><FaCalendarAlt /> {formatDateDisplay(appointment.date, { weekday: 'short' })}</span>
                <span className={styles.detailPill}><FaRegClock /> {formatTime24(appointment.time)}</span>
                <span className={styles.detailPill}><FaClinicMedical /> {appointment.branch || 'Dentime Dental Clinic'}</span>
            </div>

            {appointment.notes ? (
                <div className={styles.noticeBox}>
                    <strong style={{ display: 'block', marginBottom: '6px', color: '#17364a' }}>Notes</strong>
                    {appointment.notes}
                </div>
            ) : null}
        </article>
    );
}

export default function PatientAppointments() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAppointments = useCallback(async () => {
        if (!user?.id) return;
        try {
            setError('');
            const response = await authFetch(`/appointments?patientId=${user.id}`);
            const payload = await response.json().catch(() => []);
            if (!response.ok) {
                throw new Error(payload?.message || 'Could not load appointments.');
            }
            setAppointments(Array.isArray(payload) ? payload : []);
        } catch (fetchError) {
            setAppointments([]);
            setError(fetchError.message || 'Could not load appointments.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchAppointments();
        const handleFocus = () => fetchAppointments();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchAppointments]);

    const { upcoming, past } = useMemo(() => {
        const nextItems = appointments
            .filter((item) => ['pending', 'confirmed', 'in-clinic'].includes(item.status))
            .sort((left, right) => new Date(left.date) - new Date(right.date));
        const historyItems = appointments
            .filter((item) => ['completed', 'cancelled'].includes(item.status))
            .sort((left, right) => new Date(right.date) - new Date(left.date));
        return { upcoming: nextItems, past: historyItems };
    }, [appointments]);

    return (
        <PatientPageFrame
            title="Visits"
            subtitle="Appointments and visit history from your patient mobile experience, rebuilt for the web dashboard."
            actions={(
                <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/book')}>
                    Book New Appointment
                </button>
            )}
        >
            <div className={styles.heroGrid}>
                <section className={`${styles.heroCard} ${styles.heroCardDark}`}>
                    <span className={styles.heroTag}>Visit Timeline</span>
                    <h2 className={styles.heroTitle}>Everything in one place</h2>
                    <p className={styles.heroText}>
                        Review your upcoming bookings, in-clinic progress, and completed or cancelled visits without switching devices.
                    </p>
                </section>
                <section className={styles.metricGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 0 }}>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Upcoming</span>
                        <h3 className={styles.metricValue}>{upcoming.length}</h3>
                        <p className={styles.metricSub}>Pending, confirmed, or in-clinic</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Past Visits</span>
                        <h3 className={styles.metricValue}>{past.length}</h3>
                        <p className={styles.metricSub}>Completed or cancelled</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Assigned Branch</span>
                        <h3 className={styles.metricValue} style={{ fontSize: '23px' }}>{user?.assignedBranch || 'Pending'}</h3>
                        <p className={styles.metricSub}>Where your web booking slots are sourced</p>
                    </article>
                </section>
            </div>

            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading your appointments...</span>
                </div>
            ) : error ? (
                <PatientEmptyState
                    icon={<FaNotesMedical />}
                    title="Could not load appointments"
                    message={error}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchAppointments}>
                            Try Again
                        </button>
                    )}
                />
            ) : (
                <>
                    <section style={{ marginBottom: '24px' }}>
                        <PatientSectionHeader
                            eyebrow="Scheduled"
                            title="Upcoming Visits"
                            description="Your pending, confirmed, and in-clinic appointments."
                        />
                        {upcoming.length ? upcoming.map((appointment) => (
                            <AppointmentCard
                                key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`}
                                appointment={appointment}
                            />
                        )) : (
                            <PatientEmptyState
                                icon={<FaCalendarAlt />}
                                title="No upcoming appointment"
                                message="Your next mobile or web appointment request will appear here after it is submitted."
                            />
                        )}
                    </section>

                    <section>
                        <PatientSectionHeader
                            eyebrow="History"
                            title="Past Visits"
                            description="Completed and cancelled appointments across your patient record."
                        />
                        {past.length ? past.map((appointment) => (
                            <AppointmentCard
                                key={appointment._id || `${appointment.date}-${appointment.time}-${appointment.procedure}`}
                                appointment={appointment}
                            />
                        )) : (
                            <PatientEmptyState
                                icon={<FaRegClock />}
                                title="No visit history yet"
                                message="Completed and cancelled appointments will show here once you start using the clinic schedule."
                            />
                        )}
                    </section>
                </>
            )}
        </PatientPageFrame>
    );
}

