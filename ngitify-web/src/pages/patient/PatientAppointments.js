import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaCalendarAlt, FaClinicMedical, FaInfoCircle, FaNotesMedical, FaRegClock } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import {
    formatDateDisplay,
    formatTime24,
    toDateKey,
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
const PATIENT_CHANGEABLE_STATUSES = new Set(['pending', 'confirmed']);

const getManilaTodayKey = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

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
    const { addToast } = useToast();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [actionMode, setActionMode] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '', reason: '' });
    const [validationErrors, setValidationErrors] = useState({});
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

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

    const closeAppointmentDetails = () => {
        setSelectedAppointment(null);
        setActionMode('');
        setActionError('');
        setCancellationReason('');
        setRescheduleForm({ date: '', time: '', reason: '' });
        setValidationErrors({});
        setAvailableSlots([]);
    };

    const openCancelAction = () => {
        setActionMode('cancel');
        setActionError('');
        setCancellationReason('');
        setValidationErrors({});
    };

    const openRescheduleAction = () => {
        const date = toDateKey(selectedAppointment?.date);
        setActionMode('reschedule');
        setActionError('');
        setValidationErrors({});
        setRescheduleForm({
            date,
            time: selectedAppointment?.time || '',
            reason: '',
        });
    };

    const fetchRescheduleSlots = useCallback(async (appointment, date) => {
        if (!appointment || !date) {
            setAvailableSlots([]);
            return;
        }

        setLoadingSlots(true);
        setActionError('');
        try {
            const appointmentId = getAppointmentId(appointment);
            const branch = appointment.branch || user?.assignedBranch || '';
            const query = new URLSearchParams({
                date,
                branch,
                excludeAppointmentId: appointmentId,
            });
            const response = await authFetch(`/appointments/slots?${query.toString()}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Could not load available time slots.');

            const takenSlots = new Set(Array.isArray(payload.takenSlots) ? payload.takenSlots : []);
            const nextSlots = (Array.isArray(payload.allowedSlots) ? payload.allowedSlots : [])
                .filter((slot) => !takenSlots.has(slot));
            setAvailableSlots(nextSlots);
            setRescheduleForm((current) => ({
                ...current,
                time: nextSlots.includes(current.time) ? current.time : '',
            }));
        } catch (slotError) {
            setAvailableSlots([]);
            setActionError(slotError.message || 'Could not load available time slots.');
        } finally {
            setLoadingSlots(false);
        }
    }, [user?.assignedBranch]);

    useEffect(() => {
        if (actionMode !== 'reschedule' || !rescheduleForm.date || !selectedAppointment) return;
        fetchRescheduleSlots(selectedAppointment, rescheduleForm.date);
    }, [actionMode, fetchRescheduleSlots, rescheduleForm.date, selectedAppointment]);

    const submitCancellation = async () => {
        if (!selectedAppointment) return;
        setActionSubmitting(true);
        setActionError('');
        try {
            const response = await authFetch(`/appointments/${getAppointmentId(selectedAppointment)}/status`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: 'cancelled',
                    cancellationReason: cancellationReason.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to cancel this appointment.');
            closeAppointmentDetails();
            await fetchAppointments();
            addToast('Appointment cancelled successfully.', 'success');
        } catch (cancelError) {
            setActionError(cancelError.message || 'Unable to cancel this appointment.');
        } finally {
            setActionSubmitting(false);
        }
    };

    const submitReschedule = async (event) => {
        event.preventDefault();
        const nextValidationErrors = {};
        if (!rescheduleForm.date) nextValidationErrors.date = 'Please select a new appointment date.';
        if (!rescheduleForm.time) nextValidationErrors.time = 'Please select an available appointment time.';
        setValidationErrors(nextValidationErrors);
        if (!selectedAppointment || Object.keys(nextValidationErrors).length > 0) {
            return;
        }

        setActionSubmitting(true);
        setActionError('');
        try {
            const response = await authFetch(`/appointments/${getAppointmentId(selectedAppointment)}/reschedule`, {
                method: 'POST',
                body: JSON.stringify({
                    newDate: rescheduleForm.date,
                    newTime: rescheduleForm.time,
                    reason: rescheduleForm.reason.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to reschedule this appointment.');
            closeAppointmentDetails();
            await fetchAppointments();
            addToast('Appointment rescheduled successfully.', 'success');
        } catch (rescheduleError) {
            setActionError(rescheduleError.message || 'Unable to reschedule this appointment.');
        } finally {
            setActionSubmitting(false);
        }
    };

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
    const selectedStatus = String(selectedAppointment?.status || '').toLowerCase();
    const canChangeSelectedAppointment = PATIENT_CHANGEABLE_STATUSES.has(selectedStatus)
        && selectedAppointment?.isArchived !== true
        && selectedAppointment?.isQueueEntry !== true;

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
                                        onClick={closeAppointmentDetails}
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
                                {actionMode === 'cancel' ? (
                                    <div className={styles.actionPanel}>
                                        <label className={styles.field}>
                                            <span className={styles.label}>Cancellation reason (optional)</span>
                                            <textarea
                                                className={styles.textarea}
                                                value={cancellationReason}
                                                onChange={(event) => setCancellationReason(event.target.value)}
                                                placeholder="Tell the clinic why you need to cancel"
                                                disabled={actionSubmitting}
                                            />
                                        </label>
                                        <p className={styles.helpText}>Cancelling cannot be undone from the patient portal.</p>
                                    </div>
                                ) : null}
                                {actionMode === 'reschedule' ? (
                                    <form id="patient-reschedule-form" className={styles.actionPanel} onSubmit={submitReschedule}>
                                        <div className={styles.formGrid}>
                                            <label className={`${styles.field} ${validationErrors.date ? styles.fieldInvalid : ''}`}>
                                                <span className={styles.label}>New date</span>
                                                <input
                                                    type="date"
                                                    className={`${styles.input} ${validationErrors.date ? styles.inputInvalid : ''}`}
                                                    min={getManilaTodayKey()}
                                                    value={rescheduleForm.date}
                                                    onChange={(event) => {
                                                        setRescheduleForm((current) => ({ ...current, date: event.target.value, time: '' }));
                                                        setValidationErrors((current) => ({ ...current, date: '', time: '' }));
                                                    }}
                                                    disabled={actionSubmitting}
                                                    aria-invalid={Boolean(validationErrors.date)}
                                                    aria-describedby={validationErrors.date ? 'reschedule-date-error' : undefined}
                                                />
                                                {validationErrors.date ? <span id="reschedule-date-error" className={styles.fieldError} role="alert">{validationErrors.date}</span> : null}
                                            </label>
                                            <label className={`${styles.field} ${validationErrors.time ? styles.fieldInvalid : ''}`}>
                                                <span className={styles.label}>Available time</span>
                                                <select
                                                    className={`${styles.select} ${validationErrors.time ? styles.inputInvalid : ''}`}
                                                    value={rescheduleForm.time}
                                                    onChange={(event) => {
                                                        setRescheduleForm((current) => ({ ...current, time: event.target.value }));
                                                        setValidationErrors((current) => ({ ...current, time: '' }));
                                                    }}
                                                    disabled={actionSubmitting || loadingSlots || availableSlots.length === 0}
                                                    aria-invalid={Boolean(validationErrors.time)}
                                                    aria-describedby={validationErrors.time ? 'reschedule-time-error' : undefined}
                                                >
                                                    <option value="">{loadingSlots ? 'Loading slots...' : 'Select a time'}</option>
                                                    {availableSlots.map((slot) => (
                                                        <option key={slot} value={slot}>{formatTime24(slot)}</option>
                                                    ))}
                                                </select>
                                                {validationErrors.time ? <span id="reschedule-time-error" className={styles.fieldError} role="alert">{validationErrors.time}</span> : null}
                                            </label>
                                            <label className={`${styles.field} ${styles.fieldWide}`}>
                                                <span className={styles.label}>Reason (optional)</span>
                                                <textarea
                                                    className={styles.textarea}
                                                    value={rescheduleForm.reason}
                                                    onChange={(event) => setRescheduleForm((current) => ({ ...current, reason: event.target.value }))}
                                                    placeholder="Tell the clinic why you need a different schedule"
                                                    disabled={actionSubmitting}
                                                />
                                            </label>
                                        </div>
                                        {!loadingSlots && rescheduleForm.date && availableSlots.length === 0 && !actionError ? (
                                            <p className={styles.helpText}>No available times remain on this date. Please choose another date.</p>
                                        ) : null}
                                    </form>
                                ) : null}
                                {actionError ? (
                                    <div className={styles.actionError} role="alert">{actionError}</div>
                                ) : null}
                                {!canChangeSelectedAppointment ? (
                                    <div className={styles.noticeBox} style={{ marginTop: '18px' }}>
                                        <FaInfoCircle style={{ marginRight: '8px' }} />
                                        This appointment can no longer be cancelled or rescheduled from the patient portal. Contact your assigned clinic branch if you need help.
                                    </div>
                                ) : null}
                                <div className={styles.heroActions}>
                                    {actionMode ? (
                                        <button type="button" className={styles.buttonSecondary} onClick={() => { setActionMode(''); setActionError(''); setValidationErrors({}); }} disabled={actionSubmitting}>
                                            Back
                                        </button>
                                    ) : (
                                        <button type="button" className={styles.buttonSecondary} onClick={closeAppointmentDetails}>
                                            Close
                                        </button>
                                    )}
                                    {canChangeSelectedAppointment && !actionMode ? (
                                        <>
                                            <button type="button" className={styles.buttonSecondary} onClick={openRescheduleAction}>
                                                Reschedule
                                            </button>
                                            <button type="button" className={styles.buttonDanger} onClick={openCancelAction}>
                                                Cancel Appointment
                                            </button>
                                        </>
                                    ) : null}
                                    {actionMode === 'cancel' ? (
                                        <button type="button" className={styles.buttonDanger} onClick={submitCancellation} disabled={actionSubmitting}>
                                            {actionSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                                        </button>
                                    ) : null}
                                    {actionMode === 'reschedule' ? (
                                        <button type="submit" form="patient-reschedule-form" className={styles.buttonPrimary} disabled={actionSubmitting || loadingSlots}>
                                            {actionSubmitting ? 'Saving...' : 'Confirm Reschedule'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </PatientPageFrame>
    );
}
