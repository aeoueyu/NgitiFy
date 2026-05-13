import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaArrowRight,
    FaCalendarAlt,
    FaCheckCircle,
    FaClock,
    FaInfoCircle,
    FaRobot,
    FaShieldAlt,
    FaStethoscope,
} from 'react-icons/fa';
import PatientMonthCalendar from '../../components/patient/PatientMonthCalendar';
import {
    PatientEmptyState,
    PatientPageFrame,
    PatientSectionHeader,
    PatientStatusBadge,
} from '../../components/patient/PatientFrame';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import {
    DIRECT_BOOKING_PROCEDURES,
    formatDateDisplay,
    formatTime24,
    toDateKey,
} from '../../utils/patientPortal';
import styles from '../../styles/patient/PatientPortal.module.css';

const STEP_LABELS = ['Date', 'Time', 'Procedure', 'Confirm'];

const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const isSlotPast = (timeValue, selectedDate, todayKey) => {
    if (!timeValue || selectedDate !== todayKey) return false;
    const now = new Date();
    const [hours, minutes] = String(timeValue).split(':').map(Number);
    const slotMinutes = hours * 60 + minutes;
    const nowWithBuffer = now.getHours() * 60 + now.getMinutes() + 30;
    return slotMinutes <= nowWithBuffer;
};

const SummaryRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <span className={styles.infoLabel} style={{ marginBottom: 0 }}>{label}</span>
        <span className={styles.infoValue} style={{ textAlign: 'right' }}>{value || '—'}</span>
    </div>
);

export default function PatientBooking() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedProcedure, setSelectedProcedure] = useState('');
    const [notes, setNotes] = useState('');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
    const [blockedDates, setBlockedDates] = useState([]);
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [loadingBlockedDates, setLoadingBlockedDates] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loadingDuplicate, setLoadingDuplicate] = useState(true);
    const [bookingError, setBookingError] = useState('');
    const [duplicateAppointment, setDuplicateAppointment] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [dayCapacityReached, setDayCapacityReached] = useState(false);
    const [appointmentCount, setAppointmentCount] = useState(0);
    const [maxAppointmentsPerDay, setMaxAppointmentsPerDay] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [successModal, setSuccessModal] = useState(false);

    const assignedBranch = user?.assignedBranch || '';
    const todayKey = toDateKey(new Date());

    const fetchDuplicateAppointment = useCallback(async () => {
        setLoadingDuplicate(true);
        try {
            const response = await authFetch('/appointments/my-active');
            if (!response.ok) {
                throw new Error('Could not check your current appointment request.');
            }
            const payload = await response.json();
            setDuplicateAppointment(payload?.hasActive ? payload.appointment || null : null);
        } catch (error) {
            setDuplicateAppointment(null);
            setBookingError(error.message || 'Could not check your active appointment request.');
        } finally {
            setLoadingDuplicate(false);
        }
    }, []);

    const fetchBlockedDates = useCallback(async () => {
        if (!assignedBranch) {
            setBlockedDates([]);
            return;
        }

        setLoadingBlockedDates(true);
        try {
            const response = await authFetch(`/appointments/blocked-dates?month=${toMonthKey(currentMonth)}&branch=${encodeURIComponent(assignedBranch)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Could not load blocked dates.');
            }
            setBlockedDates(Array.isArray(payload.blockedDates) ? payload.blockedDates : []);
        } catch (error) {
            setBlockedDates([]);
            setBookingError(error.message || 'Could not load blocked dates.');
        } finally {
            setLoadingBlockedDates(false);
        }
    }, [assignedBranch, currentMonth]);

    const fetchSlots = useCallback(async (dateKey, { preserveSelection = false } = {}) => {
        if (!assignedBranch) {
            setBookingError('Your patient account does not have an assigned branch yet. Please contact the clinic before booking an appointment.');
            setAllowedSlots([]);
            setTakenSlots([]);
            return;
        }

        setLoadingSlots(true);
        setBookingError('');
        if (!preserveSelection) {
            setSelectedTime('');
        }

        try {
            const response = await authFetch(`/appointments/slots?date=${dateKey}&branch=${encodeURIComponent(assignedBranch)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Could not load available time slots.');
            }

            const nextAllowedSlots = Array.isArray(payload.allowedSlots) ? payload.allowedSlots : [];
            const nextTakenSlots = Array.isArray(payload.takenSlots) ? payload.takenSlots : [];

            setAllowedSlots(nextAllowedSlots);
            setTakenSlots(nextTakenSlots);
            setDayCapacityReached(Boolean(payload.dayCapacityReached));
            setAppointmentCount(Number(payload.appointmentCount || 0));
            setMaxAppointmentsPerDay(Number(payload.maxAppointmentsPerDay || 0));

            if (preserveSelection && selectedTime) {
                const stillAvailable = nextAllowedSlots.includes(selectedTime) && !nextTakenSlots.includes(selectedTime);
                if (!stillAvailable) {
                    setSelectedTime('');
                }
            }
        } catch (error) {
            setAllowedSlots([]);
            setTakenSlots([]);
            setDayCapacityReached(false);
            setBookingError(error.message || 'Could not load available time slots.');
        } finally {
            setLoadingSlots(false);
        }
    }, [assignedBranch, selectedTime]);

    useEffect(() => {
        fetchDuplicateAppointment();
    }, [fetchDuplicateAppointment]);

    useEffect(() => {
        fetchBlockedDates();
    }, [fetchBlockedDates]);

    useEffect(() => {
        if (!selectedDate) return undefined;

        const refresh = () => {
            fetchDuplicateAppointment();
            fetchBlockedDates();
            fetchSlots(selectedDate, { preserveSelection: true });
        };

        const intervalId = window.setInterval(refresh, 30000);
        const handleFocus = () => refresh();
        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchBlockedDates, fetchDuplicateAppointment, fetchSlots, selectedDate]);

    const marks = useMemo(() => {
        const nextMarks = {
            [todayKey]: {
                highlight: true,
                metaLabel: 'Today',
            },
        };

        blockedDates.forEach((dateKey) => {
            nextMarks[dateKey] = {
                disabled: true,
                accent: true,
                dotColor: '#e53935',
                metaLabel: 'Full',
            };
        });

        if (selectedDate) {
            nextMarks[selectedDate] = {
                ...(nextMarks[selectedDate] || {}),
                selected: true,
                dotColor: nextMarks[selectedDate]?.dotColor || '',
                metaLabel: nextMarks[selectedDate]?.metaLabel || '',
            };
        }

        return nextMarks;
    }, [blockedDates, selectedDate, todayKey]);

    const renderedSlots = useMemo(() => (
        allowedSlots.map((slot) => {
            const taken = takenSlots.includes(slot);
            const past = isSlotPast(slot, selectedDate, todayKey);
            return {
                slot,
                taken,
                past,
                disabled: taken || past,
                selected: selectedTime === slot,
            };
        })
    ), [allowedSlots, takenSlots, selectedDate, selectedTime, todayKey]);

    const handleDateSelection = (dateKey, cell) => {
        if (cell?.muted) return;
        if (dateKey < todayKey) return;
        if (blockedDates.includes(dateKey)) return;

        setSelectedDate(dateKey);
        setSelectedTime('');
        fetchSlots(dateKey);
    };

    const handleMonthChange = (direction) => {
        setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
    };

    const goNext = () => setStep((current) => Math.min(current + 1, STEP_LABELS.length));
    const goBack = () => setStep((current) => Math.max(current - 1, 1));

    const submitBooking = async () => {
        if (!selectedDate || !selectedTime || !selectedProcedure) return;

        setSubmitting(true);
        setBookingError('');
        try {
            const response = await authFetch('/appointments/request', {
                method: 'POST',
                body: JSON.stringify({
                    date: selectedDate,
                    time: selectedTime,
                    procedure: selectedProcedure,
                    notes: notes.trim() || 'For consultation',
                    branch: assignedBranch,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 409) {
                    setDuplicateAppointment(payload.appointment || {
                        date: selectedDate,
                        time: selectedTime,
                        procedure: selectedProcedure,
                        status: 'pending',
                        branch: assignedBranch,
                    });
                }
                throw new Error(payload.message || 'Booking failed. Please try again.');
            }

            addToast('Appointment request submitted successfully.', 'success');
            setSuccessModal(true);
        } catch (error) {
            setBookingError(error.message || 'Booking failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const canMoveForward = (
        (step === 1 && Boolean(selectedDate))
        || (step === 2 && Boolean(selectedTime))
        || (step === 3 && Boolean(selectedProcedure))
        || (step === 4 && privacyAccepted && !submitting)
    );

    const summaryDetails = [
        ['Assigned Branch', assignedBranch || 'No branch assigned'],
        ['Date', selectedDate ? formatDateDisplay(selectedDate, { weekday: 'short' }) : 'Pick a date'],
        ['Time', selectedTime ? formatTime24(selectedTime) : 'Pick a slot'],
        ['Procedure', selectedProcedure || 'Select a procedure'],
        ['Notes', notes.trim() || 'No additional note'],
    ];

    if (loadingDuplicate) {
        return (
            <PatientPageFrame
                title="Book Appointment"
                subtitle="Preparing your patient booking flow..."
            >
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Checking your current booking status...</span>
                </div>
            </PatientPageFrame>
        );
    }

    return (
        <PatientPageFrame
            title="Book Appointment"
            subtitle="The patient mobile booking flow, rebuilt for web and still locked to your assigned branch."
            actions={(
                <>
                    <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/appointments')}>
                        View Appointments
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/ai-companion?tab=visit-window')}>
                        Visit Window
                    </button>
                </>
            )}
        >
            {!assignedBranch ? (
                <PatientEmptyState
                    icon={<FaCalendarAlt />}
                    title="Assigned branch required"
                    message="Your patient account does not have an assigned branch yet. Please contact the clinic before sending a web booking request."
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/profile')}>
                            Open My Profile
                        </button>
                    )}
                />
            ) : duplicateAppointment ? (
                <section className={styles.heroGrid}>
                    <article className={styles.heroCard}>
                        <span className={styles.heroEyebrow}>Active Request</span>
                        <h2 className={styles.heroTitle} style={{ color: '#8a5b00' }}>
                            You already have an active appointment request
                        </h2>
                        <p className={styles.heroText} style={{ color: '#6d4c41' }}>
                            Dentime allows one active patient booking request at a time so the clinic can manage branch capacity accurately.
                        </p>
                        <div className={styles.detailPills}>
                            <span className={styles.detailPill}>{duplicateAppointment.branch || assignedBranch}</span>
                            <PatientStatusBadge status={duplicateAppointment.status} />
                        </div>
                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/appointments')}>
                                Review Appointment
                            </button>
                            <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/dashboard')}>
                                Back to Dashboard
                            </button>
                        </div>
                    </article>

                    <article className={styles.summaryCard}>
                        <PatientSectionHeader eyebrow="Current Request" title="What is already pending" />
                        <div className={styles.timeline}>
                            <SummaryRow label="Procedure" value={duplicateAppointment.procedure} />
                            <SummaryRow label="Date" value={formatDateDisplay(duplicateAppointment.date)} />
                            <SummaryRow label="Time" value={duplicateAppointment.time ? formatTime24(duplicateAppointment.time) : 'To be confirmed'} />
                            <SummaryRow label="Branch" value={duplicateAppointment.branch || assignedBranch} />
                            <SummaryRow label="Status" value={duplicateAppointment.status || 'Pending'} />
                        </div>
                    </article>
                </section>
            ) : (
                <>
                    <section className={styles.heroGrid}>
                        <article className={styles.heroCard}>
                            <span className={styles.heroEyebrow}>Assigned Branch Booking</span>
                            <h2 className={styles.heroTitle} style={{ color: '#17364a', fontSize: '30px' }}>
                                {assignedBranch}
                            </h2>
                            <p className={styles.heroText} style={{ color: '#5f7a8d' }}>
                                Your web booking request is automatically routed to the same clinic branch assigned to your patient account, just like on mobile.
                            </p>
                            <div className={styles.detailPills}>
                                <span className={styles.detailPill}><FaShieldAlt /> One active request at a time</span>
                                <span className={styles.detailPill}><FaStethoscope /> {DIRECT_BOOKING_PROCEDURES.length} direct-book procedures</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                                {STEP_LABELS.map((label, index) => {
                                    const currentStep = index + 1;
                                    const isActive = step === currentStep;
                                    const isDone = currentStep < step;
                                    return (
                                        <React.Fragment key={label}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div
                                                    style={{
                                                        width: '34px',
                                                        height: '34px',
                                                        borderRadius: '999px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 800,
                                                        background: isDone ? '#16a34a' : isActive ? '#01538b' : '#e2e8f0',
                                                        color: isDone || isActive ? '#ffffff' : '#64748b',
                                                        boxShadow: isActive ? '0 10px 18px rgba(1, 83, 139, 0.18)' : 'none',
                                                    }}
                                                >
                                                    {isDone ? '✓' : currentStep}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '12px', fontWeight: 800, color: isActive ? '#01538b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Step {currentStep}
                                                    </div>
                                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#17364a' }}>{label}</div>
                                                </div>
                                            </div>
                                            {index < STEP_LABELS.length - 1 ? (
                                                <div style={{ width: '28px', height: '2px', background: currentStep < step ? '#16a34a' : '#d7e3eb' }} />
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </article>

                        <article className={styles.summaryCard}>
                            <PatientSectionHeader
                                eyebrow="Request Summary"
                                title="Booking snapshot"
                            />
                            <div className={styles.timeline}>
                                {summaryDetails.map(([label, value]) => (
                                    <SummaryRow key={label} label={label} value={value} />
                                ))}
                            </div>
                            <div className={styles.noticeBox} style={{ marginTop: '16px' }}>
                                The clinic still confirms your request before it becomes final. Online patient booking stays limited to check-up or prophylaxis requests.
                            </div>
                        </article>
                    </section>

                    <section className={styles.splitGrid}>
                        <article className={styles.infoCard}>
                            {step === 1 ? (
                                <>
                                    <PatientSectionHeader
                                        eyebrow="Step 1"
                                        title="Select a date"
                                        description="Sundays and fully booked dates are disabled. Calendar availability refreshes from live Dentime booking data."
                                    />
                                    {loadingBlockedDates ? (
                                        <div className={styles.loaderBox}>
                                            <span className={styles.loaderText}>Checking fully booked dates...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <PatientMonthCalendar
                                                currentMonth={currentMonth}
                                                selectedDate={selectedDate}
                                                marks={marks}
                                                disableSundays={true}
                                                onChangeMonth={handleMonthChange}
                                                onSelectDate={handleDateSelection}
                                            />
                                            <div className={styles.detailPills} style={{ marginTop: '18px' }}>
                                                <span className={styles.detailPill}><FaInfoCircle /> Today is highlighted</span>
                                                <span className={styles.detailPill}><FaCalendarAlt /> Full dates are marked in the calendar</span>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : null}

                            {step === 2 ? (
                                <>
                                    <PatientSectionHeader
                                        eyebrow="Step 2"
                                        title="Choose a time slot"
                                        description={`${assignedBranch} • ${selectedDate ? formatDateDisplay(selectedDate, { weekday: 'short' }) : 'Select a date first'}`}
                                    />
                                    {loadingSlots ? (
                                        <div className={styles.loaderBox}>
                                            <span className={styles.loaderText}>Loading available time slots...</span>
                                        </div>
                                    ) : renderedSlots.length ? (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                                                {renderedSlots.map((item) => (
                                                    <button
                                                        key={item.slot}
                                                        type="button"
                                                        onClick={() => !item.disabled && setSelectedTime(item.slot)}
                                                        disabled={item.disabled}
                                                        style={{
                                                            borderRadius: '18px',
                                                            border: item.selected ? '1px solid #01538b' : '1px solid rgba(1, 83, 139, 0.12)',
                                                            padding: '16px',
                                                            background: item.selected
                                                                ? '#01538b'
                                                                : item.taken
                                                                    ? '#edf2f7'
                                                                    : item.past
                                                                        ? '#fff8e1'
                                                                        : '#ffffff',
                                                            color: item.selected ? '#ffffff' : item.taken ? '#94a3b8' : '#17364a',
                                                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                                                            textAlign: 'left',
                                                            boxShadow: item.selected ? '0 12px 24px rgba(1, 83, 139, 0.16)' : 'none',
                                                            opacity: item.disabled && !item.selected ? 0.92 : 1,
                                                        }}
                                                    >
                                                        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>{formatTime24(item.slot)}</div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700 }}>
                                                            {item.taken ? 'Already taken' : item.past ? 'Past for today' : 'Available'}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className={styles.noticeBox}>
                                                {dayCapacityReached
                                                    ? `This day has already reached the branch limit of ${maxAppointmentsPerDay || 'the configured'} appointments.`
                                                    : `${appointmentCount} active appointments are already using this date${maxAppointmentsPerDay ? ` out of ${maxAppointmentsPerDay}` : ''}.`}
                                            </div>
                                        </>
                                    ) : (
                                        <PatientEmptyState
                                            icon={<FaClock />}
                                            title="No bookable slots available"
                                            message={dayCapacityReached
                                                ? 'This day is already at full branch capacity. Please choose another date.'
                                                : 'There are no remaining bookable slots for the selected date right now.'}
                                        />
                                    )}
                                </>
                            ) : null}

                            {step === 3 ? (
                                <>
                                    <PatientSectionHeader
                                        eyebrow="Step 3"
                                        title="Procedure and notes"
                                        description="Patients can only request the same narrow online-booking procedures allowed on mobile."
                                    />
                                    <div style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
                                        {DIRECT_BOOKING_PROCEDURES.map((procedure) => {
                                            const selected = selectedProcedure === procedure;
                                            return (
                                                <button
                                                    key={procedure}
                                                    type="button"
                                                    onClick={() => setSelectedProcedure(procedure)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '14px',
                                                        borderRadius: '18px',
                                                        border: selected ? '1px solid #01538b' : '1px solid rgba(1, 83, 139, 0.12)',
                                                        background: selected ? '#eef7fc' : '#ffffff',
                                                        padding: '16px',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '999px',
                                                            border: `2px solid ${selected ? '#01538b' : '#9fb2bf'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {selected ? <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#01538b' }} /> : null}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: '#17364a', marginBottom: '4px' }}>{procedure}</div>
                                                        <div style={{ fontSize: '13px', color: '#698191' }}>
                                                            The clinic records any additional treatment after the in-person assessment.
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <label className={styles.field}>
                                        <span className={styles.label}>Additional Notes</span>
                                        <textarea
                                            className={styles.textarea}
                                            value={notes}
                                            onChange={(event) => setNotes(event.target.value)}
                                            placeholder="Examples: sensitivity on left molar, follow-up cleaning, for consultation"
                                        />
                                    </label>
                                </>
                            ) : null}

                            {step === 4 ? (
                                <>
                                    <PatientSectionHeader
                                        eyebrow="Step 4"
                                        title="Review and confirm"
                                        description="Double-check your request before sending it to the clinic."
                                    />
                                    <article className={styles.summaryCard} style={{ marginBottom: '16px' }}>
                                        <div className={styles.timeline}>
                                            {summaryDetails.map(([label, value]) => (
                                                <SummaryRow key={label} label={label} value={value} />
                                            ))}
                                        </div>
                                    </article>
                                    <button
                                        type="button"
                                        onClick={() => setPrivacyAccepted((current) => !current)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '14px',
                                            padding: '18px',
                                            borderRadius: '18px',
                                            border: privacyAccepted ? '1px solid #01538b' : '1px solid rgba(1, 83, 139, 0.12)',
                                            background: privacyAccepted ? '#eef7fc' : '#ffffff',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            marginBottom: '12px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '999px',
                                                border: `2px solid ${privacyAccepted ? '#01538b' : '#9fb2bf'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {privacyAccepted ? <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#01538b' }} /> : null}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#17364a', marginBottom: '6px' }}>I consent to the privacy policy for booking use</div>
                                            <div style={{ fontSize: '13px', color: '#698191', lineHeight: 1.6 }}>
                                                Dentime may use this information for appointment scheduling, clinic communication, and keeping your patient record aligned with your assigned branch.
                                            </div>
                                        </div>
                                    </button>
                                    <button type="button" className={styles.buttonGhost} onClick={() => setPrivacyModalOpen(true)}>
                                        View Privacy Policy Summary
                                    </button>
                                </>
                            ) : null}

                            {bookingError ? (
                                <section className={styles.alertCard} style={{ marginTop: '18px' }}>
                                    <span className={styles.toolIcon} style={{ background: 'rgba(220, 38, 38, 0.08)', color: '#b91c1c' }}>
                                        <FaInfoCircle />
                                    </span>
                                    <div>
                                        <h3 className={styles.alertTitle} style={{ color: '#991b1b' }}>Booking issue</h3>
                                        <p className={styles.alertText} style={{ color: '#7f1d1d' }}>{bookingError}</p>
                                    </div>
                                </section>
                            ) : null}

                            <div className={styles.heroActions} style={{ marginTop: '22px' }}>
                                <button type="button" className={styles.buttonGhost} onClick={step === 1 ? () => navigate('/patient/dashboard') : goBack} disabled={submitting}>
                                    {step === 1 ? 'Cancel' : 'Back'}
                                </button>
                                {step < STEP_LABELS.length ? (
                                    <button
                                        type="button"
                                        className={styles.buttonPrimary}
                                        onClick={goNext}
                                        disabled={!canMoveForward}
                                        style={{ opacity: canMoveForward ? 1 : 0.65 }}
                                    >
                                        Continue <FaArrowRight style={{ marginLeft: '8px' }} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className={styles.buttonPrimary}
                                        onClick={submitBooking}
                                        disabled={!canMoveForward}
                                        style={{ opacity: canMoveForward ? 1 : 0.65 }}
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Booking'}
                                    </button>
                                )}
                            </div>
                        </article>

                        <aside>
                            <PatientSectionHeader eyebrow="Need To Know" title="Patient booking rules" />
                            <article className={styles.listCard}>
                                <div className={styles.listHeader}>
                                    <div>
                                        <h3 className={styles.listTitle}>Assigned branch only</h3>
                                        <p className={styles.listMeta}>{assignedBranch}</p>
                                    </div>
                                    <FaShieldAlt color="#01538b" />
                                </div>
                                <p className={styles.toolText}>
                                    You cannot choose a different branch here. Availability and blocked dates are sourced from your assigned patient branch to avoid scheduling mistakes.
                                </p>
                            </article>

                            <article className={styles.listCard}>
                                <div className={styles.listHeader}>
                                    <div>
                                        <h3 className={styles.listTitle}>Direct-book procedures only</h3>
                                        <p className={styles.listMeta}>Same as the mobile booking rules</p>
                                    </div>
                                    <FaStethoscope color="#01538b" />
                                </div>
                                <div className={styles.timeline}>
                                    {DIRECT_BOOKING_PROCEDURES.map((procedure) => (
                                        <div key={procedure}>
                                            <span className={styles.infoLabel}>Allowed</span>
                                            <p className={styles.infoValue}>{procedure}</p>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className={styles.listCard}>
                                <div className={styles.listHeader}>
                                    <div>
                                        <h3 className={styles.listTitle}>Need guidance first?</h3>
                                        <p className={styles.listMeta}>NgitiBot and AI Companion are still available</p>
                                    </div>
                                    <FaRobot color="#01538b" />
                                </div>
                                <p className={styles.toolText}>
                                    If you are unsure whether you should book a check-up or prophylaxis, open the patient AI tools first and then come back to this booking flow.
                                </p>
                                <div className={styles.heroActions}>
                                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/chatbot')}>
                                        Open NgitiBot
                                    </button>
                                </div>
                            </article>
                        </aside>
                    </section>
                </>
            )}

            {privacyModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>NgitiFy Privacy Policy Summary</h3>
                                <p className={styles.modalSubtitle}>Version v1.0 • Updated May 3, 2026</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setPrivacyModalOpen(false)}>×</button>
                        </div>
                        <div className={styles.timeline}>
                            <p className={styles.infoValue}>
                                We collect the details in this form to schedule your appointment, coordinate with your assigned branch, confirm your visit, and keep your clinic record aligned with your patient account.
                            </p>
                            <p className={styles.infoValue}>
                                Authorized clinic staff may access this information for scheduling, treatment preparation, follow-up communication, and legal recordkeeping under the Data Privacy Act of 2012.
                            </p>
                            <p className={styles.infoValue}>
                                You may ask the clinic to review, correct, or clarify the personal information attached to your booking at any time.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {successModal ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle} style={{ color: '#15803d' }}>Booking Submitted</h3>
                                <p className={styles.modalSubtitle}>Your request is now waiting for clinic confirmation.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setSuccessModal(false)}>×</button>
                        </div>
                        <div className={styles.timeline}>
                            <div className={styles.noticeBox} style={{ background: '#f0fdf4', color: '#166534', borderColor: 'rgba(34, 197, 94, 0.14)' }}>
                                <FaCheckCircle style={{ marginRight: '8px' }} />
                                Your appointment request for {formatDateDisplay(selectedDate)} at {formatTime24(selectedTime)} has been sent to {assignedBranch}.
                            </div>
                            <SummaryRow label="Procedure" value={selectedProcedure} />
                            <SummaryRow label="Date" value={formatDateDisplay(selectedDate)} />
                            <SummaryRow label="Time" value={formatTime24(selectedTime)} />
                            <SummaryRow label="Status" value="Pending clinic confirmation" />
                        </div>
                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/appointments')}>
                                Go to My Appointments
                            </button>
                            <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/dashboard')}>
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
