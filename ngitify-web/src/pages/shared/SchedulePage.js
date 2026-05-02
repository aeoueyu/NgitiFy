import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaPlus } from 'react-icons/fa';
import { authFetch, publicFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import ScheduleDetailPanel from '../../components/shared/ScheduleDetailPanel';
import modalStyles from '../../styles/admin/StaffModals.module.css';
import styles from '../../styles/shared/SchedulePage.module.css';

const VIEW_OPTIONS = ['week', 'day'];
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const PROCEDURE_OPTIONS = [
    'Consultation',
    'Teeth Cleaning (Prophylaxis)',
    'Tooth Extraction',
    'Dental Filling (Composite)',
    'Root Canal Treatment',
    'Braces / Orthodontic Adjustment',
    'Teeth Whitening',
    'Crown / Bridge Fitting',
    'Wisdom Tooth Extraction',
    'Oral Surgery',
    'X-Ray / Radiograph',
    'Other',
];

const initialBookingForm = {
    patientId: '',
    dentistId: '',
    date: '',
    time: '',
    procedure: '',
    branch: '',
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const startOfWeek = (date) => {
    const value = new Date(date);
    const day = value.getDay();
    const diff = value.getDate() - day + (day === 0 ? -6 : 1);
    value.setDate(diff);
    value.setHours(0, 0, 0, 0);
    return value;
};

const addDays = (date, amount) => {
    const value = new Date(date);
    value.setDate(value.getDate() + amount);
    return value;
};

const formatInputDate = (date) => new Date(date).toISOString().split('T')[0];

const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const buildTimeSlots = () => {
    const slots = [];
    for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
        slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
};

const normalizeAppointment = (appointment) => ({
    id: appointment._id || appointment.id,
    patientId: appointment.patient?._id || appointment.patient || '',
    patientName: appointment.patient?.name
        ? `${appointment.patient.name.first} ${appointment.patient.name.last}`.trim()
        : (appointment.guestName || 'Unknown Patient'),
    procedure: appointment.procedure || '-',
    status: appointment.status || 'pending',
    dentistName: appointment.dentist?.name
        ? `Dr. ${appointment.dentist.name.first} ${appointment.dentist.name.last}`.trim()
        : 'Unassigned',
    dentistId: appointment.dentist?._id || appointment.dentist || '',
    branch: appointment.branch || '',
    date: formatInputDate(appointment.date),
    rawDate: new Date(appointment.date),
    time: appointment.time || '',
    source: appointment.source || 'Walk-in',
    details: appointment,
});

const getStatusTone = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'completed':
            return styles.statusCompleted;
        case 'cancelled':
            return styles.statusCancelled;
        case 'pending':
            return styles.statusPending;
        default:
            return styles.statusConfirmed;
    }
};

export default function SchedulePage() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();

    const role = user?.role || '';
    const currentUserId = user?.userId || user?.id || user?._id || '';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';

    const isAdmin = role === 'administrator';
    const isBranchManager = role === 'branch-manager';
    const isSecretary = role === 'secretary';
    const isDentist = role === 'dentist';
    const canBookAppointment = isAdmin || isBranchManager || isSecretary;

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [viewMode, setViewMode] = useState('week');
    const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingForm, setBookingForm] = useState({ ...initialBookingForm, branch: assignedBranch || '' });
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);

    const timeSlots = useMemo(() => buildTimeSlots(), []);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = isDentist && currentUserId
                ? `/appointments?dentistId=${currentUserId}`
                : '/appointments';
            const response = await authFetch(endpoint);
            if (!response.ok) throw new Error('Failed to load appointments.');
            const data = await response.json();
            const normalized = Array.isArray(data) ? data.map(normalizeAppointment) : [];
            const scoped = normalized.filter((appointment) => {
                if ((isBranchManager || isSecretary) && assignedBranch) {
                    return !appointment.branch || appointment.branch === assignedBranch;
                }
                return true;
            });
            setAppointments(scoped.sort((left, right) => new Date(`${left.date}T${left.time || '00:00'}`) - new Date(`${right.date}T${right.time || '00:00'}`)));
            if (!selectedAppointmentId && scoped.length > 0) {
                setSelectedAppointmentId(scoped[0].id);
            }
        } catch (error) {
            addToast(error.message || 'Failed to load schedule.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, assignedBranch, currentUserId, isBranchManager, isDentist, isSecretary, selectedAppointmentId]);

    const fetchBookingData = useCallback(async () => {
        if (!canBookAppointment) return;
        try {
            const requests = [authFetch('/patients'), authFetch('/users?role=dentist')];
            if (isAdmin) requests.push(authFetch('/branches?all=true'));
            const responses = await Promise.all(requests);
            const patientsRes = responses[0];
            const dentistsRes = responses[1];
            const branchesRes = responses[2];

            if (patientsRes.ok) {
                const payload = await patientsRes.json();
                const items = Array.isArray(payload) ? payload : (payload.patients || []);
                setPatients(items.filter((entry) => entry.status === 'active'));
            }
            if (dentistsRes.ok) {
                const dentistItems = await dentistsRes.json();
                setDentists(dentistItems.filter((entry) => entry.status === 'active' && !entry.isArchived));
            }
            if (branchesRes?.ok) {
                setBranches(await branchesRes.json());
            } else if (assignedBranch) {
                setBranches([{ _id: assignedBranch, name: assignedBranch }]);
            }
        } catch {
            addToast('Failed to load booking options.', 'error');
        }
    }, [addToast, assignedBranch, canBookAppointment, isAdmin]);

    useEffect(() => {
        fetchAppointments();
        fetchBookingData();
    }, [fetchAppointments, fetchBookingData]);

    useEffect(() => {
        const activeBranch = isAdmin ? bookingForm.branch : assignedBranch;
        if (!bookingForm.date || !activeBranch) {
            setAllowedSlots([]);
            setTakenSlots([]);
            return;
        }

        const fetchSlots = async () => {
            try {
                const response = await publicFetch(`/public/appointments/slots?date=${bookingForm.date}&branch=${encodeURIComponent(activeBranch)}`);
                if (!response.ok) throw new Error();
                const data = await response.json();
                setAllowedSlots(Array.isArray(data.allowedSlots) ? data.allowedSlots : []);
                setTakenSlots(Array.isArray(data.takenSlots) ? data.takenSlots : []);
            } catch {
                setAllowedSlots([]);
                setTakenSlots([]);
            }
        };

        fetchSlots();
    }, [assignedBranch, bookingForm.branch, bookingForm.date, isAdmin]);

    const visibleSlots = useMemo(
        () => allowedSlots.filter((slot) => !takenSlots.includes(slot)),
        [allowedSlots, takenSlots]
    );

    const activeDate = useMemo(() => new Date(selectedDate), [selectedDate]);
    const weekStart = useMemo(() => startOfWeek(activeDate), [activeDate]);
    const visibleDates = useMemo(() => {
        if (viewMode === 'day') return [activeDate];
        return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    }, [activeDate, viewMode, weekStart]);

    const appointmentsByCell = useMemo(() => {
        const map = new Map();
        appointments.forEach((appointment) => {
            const key = `${appointment.date}_${appointment.time}`;
            const existing = map.get(key) || [];
            existing.push(appointment);
            map.set(key, existing);
        });
        return map;
    }, [appointments]);

    const selectedAppointment = useMemo(
        () => appointments.find((appointment) => appointment.id === selectedAppointmentId) || null,
        [appointments, selectedAppointmentId]
    );

    const headerLabel = useMemo(() => {
        if (viewMode === 'day') {
            return new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        const end = addDays(weekStart, 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }, [selectedDate, viewMode, weekStart]);

    const shiftRange = (direction) => {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + (viewMode === 'day' ? direction : direction * 7));
        setSelectedDate(formatInputDate(nextDate));
    };

    const submitBooking = async (event) => {
        event.preventDefault();
        const branch = isAdmin ? bookingForm.branch : assignedBranch;
        if (!branch) {
            addToast('A branch is required for booking.', 'error');
            return;
        }
        setIsSubmittingBooking(true);
        try {
            const response = await authFetch('/appointments', {
                method: 'POST',
                body: JSON.stringify({
                    patient: bookingForm.patientId,
                    dentist: bookingForm.dentistId,
                    date: bookingForm.date,
                    time: bookingForm.time,
                    procedure: bookingForm.procedure,
                    status: 'confirmed',
                    source: 'Walk-in',
                    branch,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Booking failed.');
            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            setBookingForm({ ...initialBookingForm, branch: assignedBranch || '' });
            await fetchAppointments();
        } catch (error) {
            addToast(error.message || 'Failed to book appointment.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const handleOpenEmr = (href) => {
        if (!href) return;
        navigate(href);
    };

    return (
        <>
            <div className={styles.page}>
                <section className={styles.calendarPanel}>
                    <header className={styles.pageHeader}>
                        <div>
                            <h1 className={styles.pageTitle}>Schedule</h1>
                            <p className={styles.pageSubtitle}>Compact reservation view for daily clinic operations.</p>
                        </div>
                        <div className={styles.headerActions}>
                            {VIEW_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`${styles.viewButton} ${viewMode === option ? styles.viewButtonActive : ''}`}
                                    onClick={() => setViewMode(option)}
                                >
                                    {option === 'week' ? 'Week' : 'Day'}
                                </button>
                            ))}
                            {canBookAppointment && (
                                <button type="button" className={styles.primaryButton} onClick={() => setIsBookingModalOpen(true)}>
                                    <FaPlus /> Book Appointment
                                </button>
                            )}
                        </div>
                    </header>

                    <div className={styles.navBar}>
                        <div className={styles.navGroup}>
                            <button type="button" className={styles.navButton} onClick={() => shiftRange(-1)}>
                                <FaChevronLeft />
                            </button>
                            <button type="button" className={styles.navButton} onClick={() => shiftRange(1)}>
                                <FaChevronRight />
                            </button>
                            <button type="button" className={styles.todayButton} onClick={() => setSelectedDate(getTodayString())}>
                                Today
                            </button>
                        </div>

                        <div className={styles.rangeLabel}>{headerLabel}</div>

                        <label className={styles.datePicker}>
                            <FaCalendarAlt />
                            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                        </label>
                    </div>

                    {loading ? (
                        <div className={styles.loadingState}>Loading appointments...</div>
                    ) : (
                        <div className={styles.calendarGrid}>
                            <div className={styles.timeColumn}>
                                <div className={styles.gridHeaderSpacer} />
                                {timeSlots.map((slot) => (
                                    <div key={slot} className={styles.timeSlot}>{to12h(slot)}</div>
                                ))}
                            </div>

                            <div className={styles.dayColumns}>
                                <div className={styles.dayHeaderRow} style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                                    {visibleDates.map((date) => (
                                        <div key={date.toISOString()} className={styles.dayHeader}>
                                            <span className={styles.dayName}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                            <span className={styles.dayDate}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.dayBody} style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                                    {visibleDates.map((date) => (
                                        <div key={date.toISOString()} className={styles.dayColumn}>
                                            {timeSlots.map((slot) => {
                                                const cellKey = `${formatInputDate(date)}_${slot}`;
                                                const cellAppointments = appointmentsByCell.get(cellKey) || [];
                                                return (
                                                    <div key={cellKey} className={styles.slotCell}>
                                                        {cellAppointments.map((appointment) => (
                                                            <button
                                                                key={appointment.id}
                                                                type="button"
                                                                className={`${styles.appointmentBlock} ${getStatusTone(appointment.status)} ${selectedAppointmentId === appointment.id ? styles.appointmentBlockActive : ''}`}
                                                                onClick={() => setSelectedAppointmentId(appointment.id)}
                                                            >
                                                                <span className={styles.blockTitle}>{appointment.patientName}</span>
                                                                <span className={styles.blockMeta}>{appointment.procedure}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <ScheduleDetailPanel
                    role={role}
                    selectedAppointment={selectedAppointment}
                    statusTone={selectedAppointment ? getStatusTone(selectedAppointment.status) : ''}
                    onOpenEmr={handleOpenEmr}
                    to12h={to12h}
                />
            </div>

            {isBookingModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '560px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>Book New Appointment</h2>
                            <button type="button" className={modalStyles.closeButton} onClick={() => setIsBookingModalOpen(false)}>×</button>
                        </div>

                        <form onSubmit={submitBooking} className={modalStyles.modalBody}>
                            {isAdmin && (
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Branch</label>
                                    <select name="branch" className={modalStyles.formInput} value={bookingForm.branch} onChange={(event) => setBookingForm((prev) => ({ ...prev, branch: event.target.value }))}>
                                        <option value="" disabled hidden>-- Choose a Branch --</option>
                                        {branches.map((branch) => <option key={branch._id || branch.name} value={branch.name}>{branch.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Patient</label>
                                <select name="patientId" className={modalStyles.formInput} value={bookingForm.patientId} onChange={(event) => setBookingForm((prev) => ({ ...prev, patientId: event.target.value }))}>
                                    <option value="" disabled hidden>-- Choose a Patient --</option>
                                    {patients.map((patient) => <option key={patient._id} value={patient._id}>{patient.name?.first ? `${patient.name.first} ${patient.name.last}`.trim() : patient.email}</option>)}
                                </select>
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Dentist</label>
                                <select name="dentistId" className={modalStyles.formInput} value={bookingForm.dentistId} onChange={(event) => setBookingForm((prev) => ({ ...prev, dentistId: event.target.value }))}>
                                    <option value="" disabled hidden>-- Choose a Dentist --</option>
                                    {dentists.map((dentist) => <option key={dentist._id} value={dentist._id}>Dr. {dentist.name?.first} {dentist.name?.last}</option>)}
                                </select>
                            </div>

                            <div className={styles.modalGrid}>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Date</label>
                                    <input type="date" name="date" className={modalStyles.formInput} value={bookingForm.date} min={getTodayString()} onChange={(event) => setBookingForm((prev) => ({ ...prev, date: event.target.value, time: '' }))} />
                                </div>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Procedure</label>
                                    <select name="procedure" className={modalStyles.formInput} value={bookingForm.procedure} onChange={(event) => setBookingForm((prev) => ({ ...prev, procedure: event.target.value }))}>
                                        <option value="" disabled hidden>-- Select Procedure --</option>
                                        {PROCEDURE_OPTIONS.map((procedure) => <option key={procedure} value={procedure}>{procedure}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Time Slot</label>
                                <div className={styles.slotList}>
                                    {visibleSlots.map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            className={`${styles.slotButton} ${bookingForm.time === slot ? styles.slotButtonActive : ''}`}
                                            onClick={() => setBookingForm((prev) => ({ ...prev, time: slot }))}
                                        >
                                            {to12h(slot)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={modalStyles.formActions}>
                                <button type="button" className={modalStyles.cancelBtn} onClick={() => setIsBookingModalOpen(false)} disabled={isSubmittingBooking}>Cancel</button>
                                <button type="submit" className={modalStyles.submitBtn} disabled={isSubmittingBooking}>{isSubmittingBooking ? 'Booking...' : 'Confirm Booking'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
