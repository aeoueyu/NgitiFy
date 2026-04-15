import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/Appointments.module.css';
import {
    FaPlus, FaSearch, FaRobot, FaUserMd,
    FaGlobe, FaPhoneAlt, FaWalking
} from 'react-icons/fa';

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Wisdom Tooth Extraction',
    'Oral Surgery', 'X-Ray / Radiograph', 'Other',
];

const SOURCE_OPTIONS = ['Walk-in', 'Phone Call', 'Smile Hub (Online)'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Returns true if d is a real, non-NaN Date object */
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

// ─── DATA NORMALIZER ─────────────────────────────────────────────────────────
// FIX: Hardened against null/undefined patient, dentist, or date fields.
const normalizeSurgery = (s) => {
    // Build a valid Date or null – never an Invalid Date object
    const rawDate = s.date ? new Date(s.date) : null;
    const date = isValidDate(rawDate) ? rawDate : null;

    // Build patient name safely
    let patientName = 'Unknown Patient';
    if (s.patient?.name) {
        const first = s.patient.name.first || '';
        const last  = s.patient.name.last  || '';
        const full  = `${first} ${last}`.trim();
        if (full) patientName = full;
    }

    // Build dentist name safely
    let dentist = 'Unassigned';
    if (s.dentist?.name) {
        const first = s.dentist.name.first || '';
        const last  = s.dentist.name.last  || '';
        const full  = `${first} ${last}`.trim();
        if (full) dentist = `Dr. ${full}`;
    }

    return {
        id:         s._id,
        patientId:  s.patient?._id || s.patient,
        patientName,
        dentistId:  s.dentist?._id || s.dentist,
        dentist,
        procedure:  s.procedure || '—',
        status:     s.status
                        ? s.status.charAt(0).toUpperCase() + s.status.slice(1)
                        : 'Pending',
        time:   s.time   || '—',
        source: s.source || 'Walk-in',
        date,               // null | valid Date
        notes:  s.notes  || '',
    };
};

export default function Appointments() {
    const { addToast } = useToast();

    // ─── DATA STATE ──────────────────────────────────────────────────────────
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients]         = useState([]);
    const [dentists, setDentists]         = useState([]);
    const [isLoading, setIsLoading]       = useState(true);

    // ─── CALENDAR & FILTER STATE ─────────────────────────────────────────────
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate]         = useState(new Date());
    const [searchQuery, setSearchQuery]           = useState('');
    const [currentPage, setCurrentPage]           = useState(1);
    const ITEMS_PER_PAGE = 5;

    // ─── MODAL STATE ─────────────────────────────────────────────────────────
    const [isAddModalOpen, setIsAddModalOpen]         = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [cancelTarget, setCancelTarget]             = useState(null);
    const [isSubmitting, setIsSubmitting]             = useState(false);
    const [timeError, setTimeError]                   = useState('');
    const [formErrors, setFormErrors]                 = useState({});

    const [bookingForm, setBookingForm] = useState({
        patientId: '', dentistId: '', date: '', time: '',
        procedure: '', source: 'Walk-in', notes: '',
    });

    // ─── FETCH ───────────────────────────────────────────────────────────────
    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await authFetch('/surgeries');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setAppointments(data.map(normalizeSurgery));
        } catch {
            addToast('Failed to load appointments.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            try {
                const [aptsRes, patientsRes, dentistsRes] = await Promise.all([
                    authFetch('/surgeries'),
                    authFetch('/patients'),
                    authFetch('/users?role=dentist'),
                ]);
                if (aptsRes.ok)     setAppointments((await aptsRes.json()).map(normalizeSurgery));
                if (patientsRes.ok) setPatients((await patientsRes.json()).filter(u => u.status === 'active'));
                if (dentistsRes.ok) setDentists((await dentistsRes.json()).filter(u => u.status === 'active' && !u.isArchived));
            } catch {
                addToast('Failed to connect to server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        loadAll();
    }, [addToast]);

    useEffect(() => { setCurrentPage(1); }, [selectedDate, searchQuery]);

    // ─── FILTER & PAGINATION ─────────────────────────────────────────────────
    // FIX: Skip any appointments with null/invalid dates entirely.
    const filteredAppointments = appointments.filter(apt => {
        if (!apt.date || !isValidDate(apt.date)) return false;
        const matchesDate   = apt.date.toDateString() === selectedDate.toDateString();
        const matchesSearch =
            apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            apt.procedure.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDate && matchesSearch;
    });

    const totalPages           = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE);
    const startIndex           = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAppointments = filteredAppointments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // ─── CALENDAR LOGIC ───────────────────────────────────────────────────────
    const getCalendarDays = () => {
        const year           = currentMonthView.getFullYear();
        const month          = currentMonthView.getMonth();
        const firstDay       = new Date(year, month, 1).getDay();
        const daysInMonth    = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days           = [];

        for (let i = firstDay - 1; i >= 0; i--)
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            days.push({
                num:  i,
                faded: false,
                active:   currentDate.toDateString() === selectedDate.toDateString(),
                isToday:  currentDate.toDateString() === new Date().toDateString(),
                // FIX: Only compare appointments with valid dates
                hasEvent: appointments.some(apt =>
                    apt.date && isValidDate(apt.date) &&
                    apt.date.toDateString() === currentDate.toDateString()
                ),
                date: currentDate,
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        for (let i = 1; i <= totalCells - days.length; i++)
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });

        return days;
    };

    const handlePrevMonth  = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth  = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    const handleDateClick  = (day) => {
        setSelectedDate(day.date);
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays     = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected  = selectedDate.toDateString() === new Date().toDateString();

    // ─── RENDER HELPERS ───────────────────────────────────────────────────────
    const getStatusClass = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'confirmed': return styles.statusConfirmed;
            case 'pending':   return styles.statusPending;
            case 'completed': return styles.statusCompleted;
            case 'cancelled': return styles.statusCancelled;
            default: return '';
        }
    };

    const getSourceIcon = (source = '') => {
        if (source.includes('Smile Hub')) return <FaGlobe />;
        if (source.includes('Phone'))     return <FaPhoneAlt />;
        if (source.includes('Walk-in'))   return <FaWalking />;
        if (source.includes('AI'))        return <FaRobot />;
        return null;
    };

    // FIX: Fully hardened against empty, null, or single-character names.
    const getInitials = (name = '') => {
        if (!name || typeof name !== 'string') return '?';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        const first = parts[0][0] || '';
        const last  = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
        return (first + last).toUpperCase() || '?';
    };

    const getPatientName = (p) => p.name?.first ? `${p.name.first} ${p.name.last}` : p.email || 'Unknown';

    // ─── BOOKING HANDLERS ─────────────────────────────────────────────────────
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
        if (name === 'time' || name === 'date') setTimeError('');
        if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
    };

    const getTodayDateString = () => new Date().toISOString().split('T')[0];

    const handleSaveAppointment = async (e) => {
        e.preventDefault();
        setTimeError('');

        if (bookingForm.date && bookingForm.time) {
            const dt = new Date(`${bookingForm.date}T${bookingForm.time}`);
            if (dt < new Date()) {
                setTimeError('Cannot book an appointment for a time that has already passed today.');
                return;
            }
        }

        const errs = {};
        if (!bookingForm.patientId) errs.patientId = 'Required';
        if (!bookingForm.dentistId) errs.dentistId = 'Required';
        if (!bookingForm.procedure) errs.procedure = 'Required';
        if (!bookingForm.date)      errs.date      = 'Required';
        if (!bookingForm.time)      errs.time      = 'Required';
        setFormErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setIsSubmitting(true);
        try {
            const res = await authFetch('/surgeries', {
                method: 'POST',
                body: JSON.stringify({
                    patient:   bookingForm.patientId,
                    dentist:   bookingForm.dentistId,
                    date:      bookingForm.date,
                    time:      bookingForm.time,
                    procedure: bookingForm.procedure,
                    source:    bookingForm.source,
                    notes:     bookingForm.notes,
                    status:    'confirmed',
                    branch:    'Marikina Branch',
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Booking failed.');
            addToast('Appointment booked successfully!', 'success');
            setIsAddModalOpen(false);
            resetForm();
            await fetchAppointments(true);
        } catch (err) {
            addToast(err.message || 'Failed to book appointment.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', source: 'Walk-in', notes: '' });
        setFormErrors({});
        setTimeError('');
    };

    const handleOpenModal  = () => { resetForm(); setIsAddModalOpen(true); };
    const handleCloseModal = () => { setIsAddModalOpen(false); resetForm(); };

    const handleConfirmCancel = async () => {
        if (!cancelTarget) return;
        try {
            const res = await authFetch(`/surgeries/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!res.ok) throw new Error();
            setAppointments(prev => prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'Cancelled' } : a));
            addToast(`${cancelTarget.patientName}'s appointment cancelled.`, 'info');
        } catch {
            addToast('Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    // ─── SAFE DATE FORMATTER ─────────────────────────────────────────────────
    // FIX: Wraps toLocaleDateString so it never throws on an invalid date.
    const formatDate = (date) => {
        if (!date || !isValidDate(date)) return 'Unknown Date';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            {/* PAGE HEADER */}
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Appointments</h1>
                    <p className={styles.subtitle}>Manage patient schedules and daily clinic appointments.</p>
                </div>
                <button className={styles.addBtn} onClick={handleOpenModal}>
                    <FaPlus /> Add Appointment
                </button>
            </div>

            {/* ── ORIGINAL LAYOUT: calendar+AI on left | list on right ─────── */}
            <div className={styles.mainGrid}>

                {/* LEFT COLUMN: Calendar + AI Panel */}
                <div className={styles.leftColumn}>

                    <div className={styles.calendarCard}>
                        <div className={styles.calendarHeader}>
                            <h3 className={styles.monthText}>{dynamicMonthYear}</h3>
                            <div className={styles.calNav}>
                                <button className={styles.calNavBtn} onClick={handlePrevMonth}>&lt;</button>
                                <button className={styles.calNavBtn} onClick={handleNextMonth}>&gt;</button>
                            </div>
                        </div>

                        <div className={styles.calendarGrid}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className={styles.dayName}>{day}</div>
                            ))}
                            {calendarDays.map((day, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        ${styles.dateNum}
                                        ${day.faded   ? styles.faded  : ''}
                                        ${day.isToday && !day.faded ? styles.today : ''}
                                        ${day.active  ? styles.active : ''}
                                    `}
                                >
                                    {day.num}
                                    {day.hasEvent && (
                                        <div className={`${styles.eventDot} ${day.active ? styles.white : ''}`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Panel */}
                    <div className={styles.aiPanel}>
                        <div className={styles.aiHeader}>
                            <div className={styles.aiIconWrapper}><FaRobot /></div>
                            <h4 className={styles.aiTitle}>AI Predictive Insights</h4>
                        </div>
                        <p className={styles.aiMessage}>
                            AI appointment insights will be available in a future update.
                        </p>
                        <button className={styles.aiActionBtn} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                            Coming Soon
                        </button>
                    </div>
                </div>

                {/* RIGHT COLUMN: Appointment List */}
                <div className={styles.listCard}>

                    <div className={styles.listHeaderSticky}>
                        <div className={styles.listHeaderTop}>
                            <h3 className={styles.listTitle}>
                                {isTodaySelected
                                    ? "Today's Schedule"
                                    : `Schedule for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </h3>
                        </div>
                        <div className={styles.searchWrapperFull}>
                            <FaSearch className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search patient name or procedure..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.appointmentList}>
                        {isLoading ? (
                            <div className={styles.emptyState} style={{ color: '#01538b' }}>
                                Loading appointments…
                            </div>
                        ) : paginatedAppointments.length > 0 ? (
                            paginatedAppointments.map((apt) => (
                                <div
                                    key={apt.id}
                                    className={styles.appointmentItem}
                                    onClick={() => setSelectedAppointment(apt)}
                                >
                                    <div className={styles.itemTopRow}>
                                        <div className={styles.patientInfo}>
                                            <div className={styles.patientAvatar}>{getInitials(apt.patientName)}</div>
                                            <div className={styles.patientDetails}>
                                                <p className={styles.patientName}>{apt.patientName}</p>
                                                <p className={styles.treatmentType}>{apt.procedure}</p>
                                            </div>
                                        </div>
                                        <div className={styles.appointmentTimeInfo}>
                                            <p className={styles.timeText}>{apt.time}</p>
                                            <span className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}>
                                                {apt.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.itemBottomRow}>
                                        <span className={styles.metaBadge} title="Assigned Dentist">
                                            <FaUserMd className={styles.metaIcon} /> {apt.dentist}
                                        </span>
                                        <span className={styles.metaBadge} title="Booking Source">
                                            <span className={styles.metaIcon}>{getSourceIcon(apt.source)}</span>
                                            {apt.source}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No appointments found for this day.</p>
                            </div>
                        )}
                    </div>

                    <div className={styles.paginationContainer}>
                        <span>
                            Showing {filteredAppointments.length === 0 ? 0 : startIndex + 1} to{' '}
                            {Math.min(startIndex + ITEMS_PER_PAGE, filteredAppointments.length)} of{' '}
                            {filteredAppointments.length} entries
                        </span>
                        <div className={styles.pageControls}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1 || filteredAppointments.length === 0}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages || filteredAppointments.length === 0}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── ADD APPOINTMENT MODAL (compact) ──────────────────────────── */}
            {isAddModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard} style={{ padding: '28px 32px', maxWidth: '500px' }}>
                        <h3 className={styles.modalTitle} style={{ fontSize: '20px', paddingBottom: '14px' }}>
                            Add Appointment
                        </h3>
                        <form onSubmit={handleSaveAppointment} noValidate>

                            {/* Patient */}
                            <div className={styles.row} style={{ marginTop: '14px', marginBottom: '0' }}>
                                <div className={styles.formGroup}>
                                    <label>PATIENT <span style={{ color: 'red' }}>*</span></label>
                                    <select name="patientId" className={styles.inputField} value={bookingForm.patientId} onChange={handleFormChange} disabled={isSubmitting}>
                                        <option value="" hidden>Select Patient</option>
                                        {patients.map(p => <option key={p._id} value={p._id}>{getPatientName(p)}</option>)}
                                    </select>
                                    {formErrors.patientId && <span className={styles.errorText}>{formErrors.patientId}</span>}
                                </div>
                            </div>

                            {/* Procedure */}
                            <div className={styles.row} style={{ marginBottom: '0' }}>
                                <div className={styles.formGroup}>
                                    <label>PROCEDURE <span style={{ color: 'red' }}>*</span></label>
                                    <select name="procedure" className={styles.inputField} value={bookingForm.procedure} onChange={handleFormChange} disabled={isSubmitting}>
                                        <option value="" hidden>Select Procedure</option>
                                        {PROCEDURE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    {formErrors.procedure && <span className={styles.errorText}>{formErrors.procedure}</span>}
                                </div>
                            </div>

                            {/* Dentist + Source */}
                            <div className={styles.row} style={{ marginBottom: '0' }}>
                                <div className={styles.formGroup}>
                                    <label>DENTIST <span style={{ color: 'red' }}>*</span></label>
                                    <select name="dentistId" className={styles.inputField} value={bookingForm.dentistId} onChange={handleFormChange} disabled={isSubmitting}>
                                        <option value="" hidden>Select Dentist</option>
                                        {dentists.map(d => <option key={d._id} value={d._id}>Dr. {d.name?.first} {d.name?.last}</option>)}
                                    </select>
                                    {formErrors.dentistId && <span className={styles.errorText}>{formErrors.dentistId}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>SOURCE</label>
                                    <select name="source" className={styles.inputField} value={bookingForm.source} onChange={handleFormChange} disabled={isSubmitting}>
                                        {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Date + Time */}
                            <div className={styles.row} style={{ marginBottom: '0' }}>
                                <div className={styles.formGroup}>
                                    <label>DATE <span style={{ color: 'red' }}>*</span></label>
                                    <input type="date" name="date" className={styles.inputField} value={bookingForm.date} onChange={handleFormChange} min={getTodayDateString()} disabled={isSubmitting} />
                                    {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>TIME <span style={{ color: 'red' }}>*</span></label>
                                    <input type="time" name="time" className={`${styles.inputField} ${timeError ? styles.errorBorder : ''}`} value={bookingForm.time} onChange={handleFormChange} disabled={isSubmitting} />
                                </div>
                            </div>

                            {timeError && (
                                <div style={{ textAlign: 'right', marginTop: '-14px', marginBottom: '8px' }}>
                                    <span className={styles.errorText} style={{ display: 'inline-block' }}>{timeError}</span>
                                </div>
                            )}

                            <div className={styles.modalButtonGroup} style={{ marginTop: '20px', paddingTop: '16px' }}>
                                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal} disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving…' : 'Save Appointment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── VIEW MODAL ────────────────────────────────────────────────── */}
            {selectedAppointment && (
                <div className={styles.modalOverlay} onClick={() => setSelectedAppointment(null)}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '28px 32px' }}>
                        <h3 className={styles.modalTitle} style={{ fontSize: '20px', paddingBottom: '14px' }}>
                            Appointment Details
                        </h3>
                        <div style={{ marginTop: '16px', textAlign: 'left' }}>
                            {[
                                ['Patient Name',     selectedAppointment.patientName],
                                ['Assigned Dentist', selectedAppointment.dentist],
                                ['Procedure',        selectedAppointment.procedure],
                                // FIX: Use safe formatDate() instead of calling toLocaleDateString() directly.
                                ['Date',             formatDate(selectedAppointment.date)],
                                ['Time',             selectedAppointment.time],
                                ['Booking Source',   selectedAppointment.source],
                            ].map(([label, value]) => (
                                <div key={label} className={styles.viewDetailRow}>
                                    <span className={styles.viewLabel}>{label}</span>
                                    <p className={styles.viewValue}>{value}</p>
                                </div>
                            ))}
                            <div className={styles.viewDetailRow} style={{ borderBottom: 'none' }}>
                                <span className={styles.viewLabel}>Status</span>
                                <span className={`${styles.statusBadge} ${getStatusClass(selectedAppointment.status)}`}>
                                    {selectedAppointment.status}
                                </span>
                            </div>
                        </div>
                        <div className={styles.modalButtonGroup} style={{ marginTop: '16px', paddingTop: '16px' }}>
                            {selectedAppointment.status !== 'Cancelled' && selectedAppointment.status !== 'Completed' && (
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => { setSelectedAppointment(null); setCancelTarget(selectedAppointment); }}
                                >
                                    Cancel Appointment
                                </button>
                            )}
                            <button type="button" className={styles.submitBtn} onClick={() => setSelectedAppointment(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── CONFIRM CANCEL ───────────────────────────────────────────── */}
            <ConfirmModal
                isOpen={!!cancelTarget}
                title="Cancel Appointment"
                message={`Are you sure you want to cancel the appointment for ${cancelTarget?.patientName}?`}
                confirmText="Yes, Cancel Appointment"
                isDestructive={true}
                onConfirm={handleConfirmCancel}
                onCancel={() => setCancelTarget(null)}
            />
        </div>
    );
}