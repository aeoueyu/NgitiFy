import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaCalendarAlt, FaClinicMedical, FaInfoCircle, FaNotesMedical, FaRegClock } from 'react-icons/fa';
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
import PatientBooking from './PatientBooking';

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'To be assigned';
};

const getAppointmentId = (appointment) => appointment?._id || appointment?.id || `${appointment?.date}-${appointment?.time}-${appointment?.procedure}`;

function DetailRow({ label, value }) {
    return (
        <div className={styles.timelineItem}>
            <span className={styles.timelineDot} />
            <div>
                <h4 className={styles.timelineTitle}>{label}</h4>
                <p className={styles.timelineText}>{value || 'Not specified'}</p>
            </div>
        </div>
    );
}

function AppointmentCard({ appointment, onSelect }) {
    return (
        <button
            type="button"
            className={`${styles.listCard} ${styles.listCardButton}`}
            onClick={() => onSelect(appointment)}
            aria-label={`View details for ${appointment.procedure || 'appointment'} on ${formatDateDisplay(appointment.date, { weekday: 'short' })} at ${formatTime24(appointment.time)}`}
        >
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
                    <strong className={styles.noticeTitle}>
                        Notes
                    </strong>
                    {appointment.notes}
                </div>
            ) : null}
        </button>
    );
}

export default function PatientAppointments() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAppointment, setSelectedAppointment] = useState(null);

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
            .filter((item) => ['pending', 'confirmed', 'in-clinic'].includes(String(item.status || '').toLowerCase()))
            .sort((left, right) => new Date(left.date) - new Date(right.date));
        const historyItems = appointments
            .filter((item) => ['completed', 'cancelled'].includes(String(item.status || '').toLowerCase()))
            .sort((left, right) => new Date(right.date) - new Date(left.date));
        return { upcoming: nextItems, past: historyItems };
    }, [appointments]);
    const isBookingMode = searchParams.get('mode') === 'book';
    const activeTab = isBookingMode ? 'book' : (searchParams.get('tab') === 'history' ? 'history' : 'upcoming');

    const setHubTab = (tab) => {
        if (tab === 'book') {
            setSearchParams({ mode: 'book' });
            return;
        }
        setSearchParams(tab === 'history' ? { tab: 'history' } : {});
    };
    const renderHubTabs = () => (
        <div className={styles.tabs} role="tablist" aria-label="Appointment hub sections">
            {[
                ['upcoming', `Upcoming (${upcoming.length})`],
                ['history', `History (${past.length})`],
                ['book', 'Book Appointment'],
            ].map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === key}
                    className={`${styles.tabButton} ${activeTab === key ? styles.tabButtonActive : ''}`}
                    onClick={() => setHubTab(key)}
                >
                    {label}
                </button>
            ))}
        </div>
    );

    if (isBookingMode) {
        return (
            <PatientBooking
                onExit={() => {
                    fetchAppointments();
                    setSearchParams({}, { replace: true });
                }}
                hubNav={renderHubTabs()}
            />
        );
    }

    return (
        <PatientPageFrame
            title="My Appointments"
            subtitle="Your complete appointment hub for upcoming visits, history, details, and booking."
            actions={(
                <button type="button" className={styles.buttonPrimary} onClick={() => setSearchParams({ mode: 'book' })}>
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

            {renderHubTabs()}

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
                    {activeTab === 'upcoming' ? (
                    <section style={{ marginBottom: '24px' }} role="tabpanel">
                        <PatientSectionHeader
                            eyebrow="Scheduled"
                            title="Upcoming"
                            description="Your pending, confirmed, and in-clinic appointments. Select a card to view details."
                        />
                        {upcoming.length ? upcoming.map((appointment) => (
                            <AppointmentCard
                                key={getAppointmentId(appointment)}
                                appointment={appointment}
                                onSelect={setSelectedAppointment}
                            />
                        )) : (
                            <PatientEmptyState
                                icon={<FaCalendarAlt />}
                                title="No upcoming appointment"
                                message="Your next mobile or web appointment request will appear here after it is submitted."
                                action={(
                                    <button type="button" className={styles.buttonPrimary} onClick={() => setHubTab('book')}>
                                        Book Appointment
                                    </button>
                                )}
                            />
                        )}
                    </section>
                    ) : null}

                    {activeTab === 'history' ? (
                    <section role="tabpanel">
                        <PatientSectionHeader
                            eyebrow="History"
                            title="Appointment History"
                            description="Completed and cancelled appointments across your patient record. Select a card to view details."
                        />
                        {past.length ? past.map((appointment) => (
                            <AppointmentCard
                                key={getAppointmentId(appointment)}
                                appointment={appointment}
                                onSelect={setSelectedAppointment}
                            />
                        )) : (
                            <PatientEmptyState
                                icon={<FaRegClock />}
                                title="No visit history yet"
                                message="Completed and cancelled appointments will show here once you start using the clinic schedule."
                            />
                        )}
                    </section>
                    ) : null}

                    {selectedAppointment ? (
                        <div className={styles.modalOverlay}>
                            <div
                                className={styles.modalCard}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="appointment-detail-title"
                                aria-describedby="appointment-detail-summary"
                            >
                                <div className={styles.modalHeader}>
                                    <div>
                                        <h3 id="appointment-detail-title" className={styles.modalTitle}>
                                            {selectedAppointment.procedure || 'Appointment Details'}
                                        </h3>
                                        <p id="appointment-detail-summary" className={styles.modalSubtitle}>
                                            {formatDateDisplay(selectedAppointment.date, { weekday: 'short' })} at {formatTime24(selectedAppointment.time)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.modalClose}
                                        onClick={() => setSelectedAppointment(null)}
                                        aria-label="Close appointment details"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className={styles.detailPills}>
                                    <PatientStatusBadge status={selectedAppointment.status} />
                                    <span className={styles.detailPill}><FaCalendarAlt /> {formatDateDisplay(selectedAppointment.date, { weekday: 'short' })}</span>
                                    <span className={styles.detailPill}><FaRegClock /> {formatTime24(selectedAppointment.time)}</span>
                                    <span className={styles.detailPill}><FaClinicMedical /> {selectedAppointment.branch || 'Dentime Dental Clinic'}</span>
                                </div>
                                <div className={styles.timeline}>
                                    <DetailRow label="Dentist" value={getDentistLabel(selectedAppointment)} />
                                    <DetailRow label="Source" value={selectedAppointment.source || 'Patient booking'} />
                                    <DetailRow label="Notes" value={selectedAppointment.notes || 'No patient note recorded.'} />
                                    {selectedAppointment.remarks ? <DetailRow label="Clinic Remarks" value={selectedAppointment.remarks} /> : null}
                                    {selectedAppointment.preOpInstructions ? <DetailRow label="Pre-op Instructions" value={selectedAppointment.preOpInstructions} /> : null}
                                    {selectedAppointment.cancellationReason ? <DetailRow label="Cancellation Reason" value={selectedAppointment.cancellationReason} /> : null}
                                </div>
                                <div className={styles.noticeBox} style={{ marginTop: '18px' }}>
                                    <FaInfoCircle style={{ marginRight: '8px' }} />
                                    For cancellation, rescheduling, or status changes, please contact your assigned clinic branch. Those actions are handled by authorized clinic staff.
                                </div>
                                <div className={styles.heroActions}>
                                    <button type="button" className={styles.buttonSecondary} onClick={() => setSelectedAppointment(null)}>
                                        Close
                                    </button>
                                    <button type="button" className={styles.buttonPrimary} onClick={() => { setSelectedAppointment(null); setHubTab('book'); }}>
                                        Start Booking
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </PatientPageFrame>
    );
}
