import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/Appointments.module.css';
import {
    FaPlus, FaSearch, FaUserMd,
    FaGlobe, FaPhoneAlt, FaWalking, FaTimes
} from 'react-icons/fa';

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';
import ConfirmModal from '../../components/common/ConfirmModal';
import UserAvatar from '../../components/common/UserAvatar';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Denture Fitting',
    'Wisdom Tooth Extraction', 'Odontogram Assessment', 'X-Ray / Radiograph',
    'Oral Surgery', 'Gum Treatment (Periodontics)', 'Other',
];

// ─── DATA NORMALIZER ─────────────────────────────────────────────────────────
const normalizeSurgery = (s) => ({
    id: s._id,
    patientId: s.patient?._id || s.patient,
    patientName: s.patient?.name
        ? `${s.patient.name.first} ${s.patient.name.last}`
        : 'Unknown Patient',
    patientImage: s.patient?.profileImage || null,
    dentistId: s.dentist?._id || s.dentist,
    dentistName: s.dentist?.name
        ? `Dr. ${s.dentist.name.first} ${s.dentist.name.last}`
        : 'Unassigned',
    procedure: s.procedure || '—',
    status: s.status || 'pending',
    time: s.time || '',
    duration: s.duration || '—',
    source: s.source || 'Walk-in',
    date: new Date(s.date),
    notes: s.notes || '',
});

export default function Appointments() {
    // ─── DATA STATE ──────────────────────────────────────────────────────────
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { addToast } = useToast();

    // ─── CALENDAR & FILTER STATE ─────────────────────────────────────────────
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // ─── MODAL STATE ─────────────────────────────────────────────────────────
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeError, setTimeError] = useState('');
    const [formErrors, setFormErrors] = useState({});

    const [bookingForm, setBookingForm] = useState({
        patientId: '',
        dentistId: '',
        date: '',
        time: '',
        procedure: '',
        notes: '',
        source: 'Walk-in',
    });

    // ─── FETCH ───────────────────────────────────────────────────────────────
    const fetchAppointments = useCallback(async (silent = false) => {
        if (silent) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const res = await authFetch('/surgeries');
            if (!res.ok) throw new Error('Failed to fetch appointments.');
            const data = await res.json();
            setAppointments(data.map(normalizeSurgery));
        } catch (err) {
            console.error('Appointment fetch error:', err);
            addToast('Failed to load appointments.', 'error');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [addToast]);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [aptsRes, patientsRes, dentistsRes] = await Promise.all([
                    authFetch('/surgeries'),
                    authFetch('/patients'),
                    authFetch('/users?role=dentist'),
                ]);
                if (aptsRes.ok)      setAppointments((await aptsRes.json()).map(normalizeSurgery));
                if (patientsRes.ok)  setPatients((await patientsRes.json()).filter(u => u.status === 'active'));
                if (dentistsRes.ok)  setDentists((await dentistsRes.json()).filter(u => u.status === 'active' && !u.isArchived));
            } catch (err) {
                console.error('Initial fetch error:', err);
                addToast('Failed to connect to server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllData();
    }, [addToast]);

    // Reset pagination when date or search changes
    useEffect(() => { setCurrentPage(1); }, [selectedDate, searchQuery]);

    // ─── FILTER LOGIC ─────────────────────────────────────────────────────────
    const filteredAppointments = appointments.filter(apt => {
        const matchesDate = apt.date.toDateString() === selectedDate.toDateString();
        const matchesSearch = apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              apt.procedure.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDate && matchesSearch;
    });

    const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE);
    const paginatedAppointments = filteredAppointments.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // ─── CALENDAR LOGIC ───────────────────────────────────────────────────────
    const getCalendarDays = () => {
        const year = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = firstDay - 1; i >= 0; i--)
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            days.push({
                num: i,
                active: currentDate.toDateString() === selectedDate.toDateString(),
                isToday: currentDate.toDateString() === new Date().toDateString(),
                hasEvent: appointments.some(apt => apt.date.toDateString() === currentDate.toDateString()),
                date: currentDate,
                faded: false,
            });
        }
        const totalCells = days.length > 35 ? 42 : 35;
        for (let i = 1; i <= totalCells - days.length; i++)
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });

        return days;
    };

    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    const handleDateClick = (day) => {
        setSelectedDate(day.date);
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

    // ─── RENDER HELPERS ───────────────────────────────────────────────────────
    const getStatusClass = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'confirmed':  return styles.statusConfirmed;
            case 'pending':    return styles.statusPending;
            case 'completed':  return styles.statusCompleted;
            case 'cancelled':  return styles.statusCancelled;
            default:           return '';
        }
    };

    const getSourceIcon = (source) => {
        if (!source) return null;
        if (source.includes('Smile Hub')) return <FaGlobe />;
        if (source.includes('Phone'))     return <FaPhoneAlt />;
        if (source.includes('Walk-in'))   return <FaWalking />;
        return null;
    };

    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const getPatientDisplayName = (p) =>
        p.name?.first ? `${p.name.first} ${p.name.last}` : p.email || 'Unknown';

    // ─── BOOKING HANDLERS ─────────────────────────────────────────────────────
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
        if (name === 'time' || name === 'date') setTimeError('');
    };

    const validateForm = () => {
        const errs = {};
        if (!bookingForm.patientId) errs.patientId = 'Please select a patient.';
        if (!bookingForm.dentistId) errs.dentistId = 'Please select a dentist.';
        if (!bookingForm.date)      errs.date = 'Please select a date.';
        if (!bookingForm.time)      errs.time = 'Please select a time.';
        if (!bookingForm.procedure) errs.procedure = 'Please select a procedure.';
        if (bookingForm.date && bookingForm.time) {
            const selected = new Date(`${bookingForm.date}T${bookingForm.time}`);
            if (selected < new Date()) {
                setTimeError('Cannot book an appointment for a time that has already passed.');
                errs.time = 'Past time.';
            }
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSaveAppointment = async (e) => {
        e.preventDefault();
        setTimeError('');
        if (!validateForm()) return;
        setIsSubmitting(true);

        try {
            const payload = {
                patient:   bookingForm.patientId,
                dentist:   bookingForm.dentistId,
                date:      bookingForm.date,
                time:      bookingForm.time,
                procedure: bookingForm.procedure,
                notes:     bookingForm.notes,
                source:    bookingForm.source,
                status:    'confirmed',
                branch:    'Marikina Branch',
            };

            const res = await authFetch('/surgeries', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Booking failed.');
            }

            addToast('Appointment booked successfully!', 'success');
            setIsAddModalOpen(false);
            setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', notes: '', source: 'Walk-in' });
            setFormErrors({});
            await fetchAppointments(true);
        } catch (err) {
            console.error('Booking error:', err);
            addToast(err.message || 'Failed to book appointment.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', notes: '', source: 'Walk-in' });
        setFormErrors({});
        setTimeError('');
    };

    // Cancel an appointment
    const handleConfirmCancel = async () => {
        if (!cancelTarget) return;
        try {
            const res = await authFetch(`/surgeries/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!res.ok) throw new Error('Cancellation failed.');
            setAppointments(prev =>
                prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'cancelled' } : a)
            );
            addToast(`${cancelTarget.patientName}'s appointment has been cancelled.`, 'info');
        } catch (err) {
            addToast('Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            {/* PAGE HEADER */}
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Appointments</h1>
                    <p className={styles.subtitle}>
                        Manage patient schedules and daily clinic appointments.
                        {isRefreshing && <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 12 }}>Refreshing…</span>}
                    </p>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaPlus /> Add Appointment
                </button>
            </div>

            <div className={styles.mainGrid}>
                {/* LEFT: APPOINTMENT LIST */}
                <div className={styles.leftColumn}>
                    {/* SEARCH BAR */}
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search patient or procedure..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* DATE HEADER */}
                    <div className={styles.listHeader}>
                        <h3 className={styles.listTitle}>
                            {isTodaySelected ? "Today's Appointments" : `Appointments — ${formatDateShort(selectedDate)}`}
                        </h3>
                        <span className={styles.listCount}>{filteredAppointments.length} total</span>
                    </div>

                    {/* APPOINTMENT LIST */}
                    <div className={styles.listContainer}>
                        {isLoading ? (
                            <div className={styles.emptyState} style={{ color: '#01538b' }}>Loading appointments…</div>
                        ) : paginatedAppointments.length > 0 ? (
                            paginatedAppointments.map((apt) => (
                                <div
                                    key={apt.id}
                                    className={styles.appointmentCard}
                                    onClick={() => setSelectedAppointment(apt)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.aptLeft}>
                                        <UserAvatar user={{ name: apt.patientName, profileImage: apt.patientImage }} size={42} />
                                        <div className={styles.aptInfo}>
                                            <p className={styles.patientName}>{apt.patientName}</p>
                                            <p className={styles.procedureName}>{apt.procedure}</p>
                                            <p className={styles.dentistLabel}>
                                                <FaUserMd style={{ fontSize: 11 }} /> {apt.dentistName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={styles.aptRight}>
                                        <p className={styles.aptTime}>{apt.time || '—'}</p>
                                        <div className={styles.sourceRow}>
                                            {getSourceIcon(apt.source)}
                                            <span className={styles.sourceText}>{apt.source}</span>
                                        </div>
                                        <span className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}>
                                            {capitalize(apt.status)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No appointments scheduled for this day.</p>
                            </div>
                        )}
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                &lt;
                            </button>
                            <span className={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: CALENDAR */}
                <div className={styles.rightColumn}>
                    <div className={styles.calendarCard}>
                        <div className={styles.calendarHeader}>
                            <h3 className={styles.monthText}>{dynamicMonthYear}</h3>
                            <div className={styles.calNav}>
                                <button className={styles.calNavBtn} onClick={handlePrevMonth}>&lt;</button>
                                <button className={styles.calNavBtn} onClick={handleNextMonth}>&gt;</button>
                            </div>
                        </div>

                        <div className={styles.calendarGrid}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <div key={d} className={styles.dayName}>{d}</div>
                            ))}
                            {calendarDays.map((day, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        ${styles.dateNum}
                                        ${day.faded  ? styles.faded  : ''}
                                        ${day.isToday && !day.faded ? styles.today  : ''}
                                        ${day.active  && !day.faded ? styles.active : ''}
                                    `}
                                >
                                    {day.num}
                                    {day.hasEvent && <div className={`${styles.eventDot} ${day.active ? styles.white : ''}`} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── ADD APPOINTMENT MODAL ─────────────────────────────────────── */}
            {isAddModalOpen && (
                <div className={styles.modalOverlay} onClick={!isSubmitting ? handleCloseModal : undefined}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 className={styles.modalTitle}>Book New Appointment</h3>
                            <button onClick={handleCloseModal} disabled={isSubmitting} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#64748b' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAppointment} noValidate>
                            {/* Patient */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>PATIENT <span style={{ color: 'red' }}>*</span></label>
                                <select name="patientId" className={styles.inputField} value={bookingForm.patientId} onChange={handleFormChange} disabled={isSubmitting}>
                                    <option value="" hidden>Select Patient</option>
                                    {patients.map(p => <option key={p._id} value={p._id}>{getPatientDisplayName(p)}</option>)}
                                </select>
                                {formErrors.patientId && <span className={styles.errorText}>{formErrors.patientId}</span>}
                            </div>

                            {/* Dentist */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>DENTIST <span style={{ color: 'red' }}>*</span></label>
                                <select name="dentistId" className={styles.inputField} value={bookingForm.dentistId} onChange={handleFormChange} disabled={isSubmitting}>
                                    <option value="" hidden>Select Dentist</option>
                                    {dentists.map(d => <option key={d._id} value={d._id}>Dr. {d.name?.first} {d.name?.last}</option>)}
                                </select>
                                {formErrors.dentistId && <span className={styles.errorText}>{formErrors.dentistId}</span>}
                            </div>

                            {/* Procedure */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>PROCEDURE <span style={{ color: 'red' }}>*</span></label>
                                <select name="procedure" className={styles.inputField} value={bookingForm.procedure} onChange={handleFormChange} disabled={isSubmitting}>
                                    <option value="" hidden>Select Procedure</option>
                                    {PROCEDURE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                {formErrors.procedure && <span className={styles.errorText}>{formErrors.procedure}</span>}
                            </div>

                            {/* Date & Time */}
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>DATE <span style={{ color: 'red' }}>*</span></label>
                                    <input type="date" name="date" className={styles.inputField} value={bookingForm.date} onChange={handleFormChange} min={new Date().toISOString().split('T')[0]} disabled={isSubmitting} />
                                    {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>TIME <span style={{ color: 'red' }}>*</span></label>
                                    <input type="time" name="time" className={styles.inputField} value={bookingForm.time} onChange={handleFormChange} disabled={isSubmitting} />
                                    {(timeError || formErrors.time) && <span className={styles.errorText}>{timeError || formErrors.time}</span>}
                                </div>
                            </div>

                            {/* Source */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>BOOKING SOURCE</label>
                                <select name="source" className={styles.inputField} value={bookingForm.source} onChange={handleFormChange} disabled={isSubmitting}>
                                    <option value="Walk-in">Walk-in</option>
                                    <option value="Phone Call">Phone Call</option>
                                    <option value="Smile Hub (Online)">Smile Hub (Online)</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>NOTES (optional)</label>
                                <textarea name="notes" className={styles.inputField} rows={3} value={bookingForm.notes} onChange={handleFormChange} placeholder="Special instructions or concerns..." disabled={isSubmitting} style={{ resize: 'vertical' }} />
                            </div>

                            <div className={styles.modalButtonGroup}>
                                <button type="button" className={styles.cancelModalBtn} onClick={handleCloseModal} disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Booking…' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── VIEW APPOINTMENT DETAIL MODAL ────────────────────────────── */}
            {selectedAppointment && (
                <div className={styles.modalOverlay} onClick={() => setSelectedAppointment(null)}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h3 className={styles.modalTitle}>Appointment Details</h3>

                        <div style={{ marginTop: '30px', textAlign: 'left' }}>
                            {[
                                ['Patient Name',    selectedAppointment.patientName],
                                ['Assigned Dentist', selectedAppointment.dentistName],
                                ['Procedure',        selectedAppointment.procedure],
                                ['Date',             selectedAppointment.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
                                ['Time',             selectedAppointment.time || '—'],
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
                                    {capitalize(selectedAppointment.status)}
                                </span>
                            </div>
                            {selectedAppointment.notes && (
                                <div className={styles.viewDetailRow} style={{ borderBottom: 'none', flexDirection: 'column', gap: 4 }}>
                                    <span className={styles.viewLabel}>Notes</span>
                                    <p className={styles.viewValue} style={{ color: '#475569' }}>{selectedAppointment.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalButtonGroup} style={{ marginTop: '20px' }}>
                            {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                                <button
                                    type="button"
                                    className={styles.cancelModalBtn}
                                    onClick={() => { setSelectedAppointment(null); setCancelTarget(selectedAppointment); }}
                                >
                                    Cancel Appointment
                                </button>
                            )}
                            <button type="button" className={styles.submitBtn} style={{ width: '100%' }} onClick={() => setSelectedAppointment(null)}>
                                Close
                            </button>
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