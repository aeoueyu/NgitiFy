import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryAppointments.module.css';

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

import {
    FaSearch, FaCalendarAlt, FaUserMd, FaPlus,
    FaClock, FaTimes
} from 'react-icons/fa';

// ─── PROCEDURE OPTIONS ───────────────────────────────────────────────────────
const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Denture Fitting',
    'Wisdom Tooth Extraction', 'Odontogram Assessment', 'X-Ray / Radiograph',
    'Oral Surgery', 'Gum Treatment (Periodontics)', 'Other'
];

// ─── DATA NORMALIZER ─────────────────────────────────────────────────────────
// Maps a raw backend Surgery document to the shape this UI component expects.
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
    rawDate: new Date(s.date),
    notes: s.notes || '',
    remarks: s.remarks || '',
});

export default function SecretaryAppointments() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    // ─── DATA STATE ─────────────────────────────────────────────────────────
    const [allAppointments, setAllAppointments] = useState([]);
    const [patients, setPatients] = useState([]);   // { _id, name }[]
    const [dentists, setDentists] = useState([]);   // { _id, name }[]
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ─── FILTER STATES ───────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [dentistFilter, setDentistFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ─── MODAL STATES ────────────────────────────────────────────────────────
    const [statusChangeTarget, setStatusChangeTarget] = useState(null); // { apt, newStatus }
    const [cancelTarget, setCancelTarget] = useState(null);             // apt
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // ─── BOOKING ENGINE STATES ───────────────────────────────────────────────
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientId: '',
        dentistId: '',
        date: '',
        time: '',
        procedure: '',
        notes: '',
        source: 'Walk-in',
    });
    const [bookingErrors, setBookingErrors] = useState({});

    // ─── FETCH HELPERS ───────────────────────────────────────────────────────
    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);
        try {
            const res = await authFetch('/surgeries');
            if (!res.ok) throw new Error('Failed to load appointments.');
            const data = await res.json();
            setAllAppointments(data.map(normalizeSurgery).sort((a, b) => b.rawDate - a.rawDate));
        } catch (err) {
            console.error('Appointments fetch error:', err);
            addToast('Failed to load clinic schedule.', 'error');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [addToast]);

    // On mount: load appointments, patients list, and dentist list in parallel
    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [aptsRes, patientsRes, dentistsRes] = await Promise.all([
                    authFetch('/surgeries'),
                    authFetch('/patients'),
                    authFetch('/users?role=dentist'),
                ]);

                if (aptsRes.ok) {
                    const data = await aptsRes.json();
                    setAllAppointments(data.map(normalizeSurgery).sort((a, b) => b.rawDate - a.rawDate));
                }
                if (patientsRes.ok) {
                    const data = await patientsRes.json();
                    setPatients(data.filter(u => u.status === 'active'));
                }
                if (dentistsRes.ok) {
                    const data = await dentistsRes.json();
                    setDentists(data.filter(u => u.status === 'active' && !u.isArchived));
                }
            } catch (err) {
                console.error('Initial data fetch error:', err);
                addToast('Failed to connect to the server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllData();
    }, [addToast]);

    // ─── DERIVED DENTIST LIST FOR FILTER ────────────────────────────────────
    const dynamicDentists = useMemo(() => {
        const names = allAppointments.map(apt => apt.dentistName).filter(Boolean);
        return [...new Set(names)].sort();
    }, [allAppointments]);

    // ─── FILTER LOGIC ────────────────────────────────────────────────────────
    const displayedAppointments = allAppointments.filter(apt => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            apt.patientName.toLowerCase().includes(searchLower) ||
            apt.procedure.toLowerCase().includes(searchLower);
        const matchesDentist = dentistFilter === 'All' || apt.dentistName === dentistFilter;
        const matchesStatus  = statusFilter  === 'All' || apt.status.toLowerCase() === statusFilter.toLowerCase();
        let matchesDate = true;
        if (startDate) matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) >= new Date(startDate).setHours(0,0,0,0);
        if (endDate)   matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) <= new Date(endDate).setHours(0,0,0,0);
        return matchesSearch && matchesDentist && matchesStatus && matchesDate;
    });

    // ─── RENDER HELPERS ──────────────────────────────────────────────────────
    const getStatusClass = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'pending':   return styles.statusPending;
            case 'confirmed': return styles.statusConfirmed;
            case 'in clinic': return styles.statusInClinic;
            case 'completed': return styles.statusCompleted;
            case 'cancelled': return styles.statusCancelled;
            default:          return styles.statusPending;
        }
    };

    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    // ─── ACTION HANDLERS ─────────────────────────────────────────────────────

    // Triggered when the status <select> changes — shows confirm modal
    const handleStatusSelectChange = (apt, newStatus) => {
        if (apt.status.toLowerCase() === newStatus.toLowerCase()) return;
        setStatusChangeTarget({ apt, newStatus });
    };

    // Called after user confirms the status change modal
    const confirmStatusChange = async () => {
        if (!statusChangeTarget) return;
        const { apt, newStatus } = statusChangeTarget;
        try {
            const res = await authFetch(`/surgeries/${apt.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Update failed.');
            // Optimistic local update
            setAllAppointments(prev =>
                prev.map(a => a.id === apt.id ? { ...a, status: newStatus } : a)
            );
            addToast(`${apt.patientName}'s appointment updated to ${capitalize(newStatus)}.`, 'success');
        } catch (err) {
            console.error('Status update error:', err);
            addToast('Failed to update appointment status.', 'error');
        } finally {
            setStatusChangeTarget(null);
        }
    };

    // Called after user confirms the cancel modal
    const confirmCancelAppointment = async () => {
        if (!cancelTarget) return;
        try {
            const res = await authFetch(`/surgeries/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!res.ok) throw new Error('Cancellation failed.');
            setAllAppointments(prev =>
                prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'cancelled' } : a)
            );
            addToast(`${cancelTarget.patientName}'s appointment has been cancelled.`, 'info');
        } catch (err) {
            console.error('Cancel error:', err);
            addToast('Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    // ─── BOOKING ENGINE ──────────────────────────────────────────────────────
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
        if (bookingErrors[name]) setBookingErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateBookingForm = () => {
        const errs = {};
        if (!bookingForm.patientId) errs.patientId = 'Please select a patient.';
        if (!bookingForm.dentistId) errs.dentistId = 'Please select a dentist.';
        if (!bookingForm.date)      errs.date = 'Please select a date.';
        if (!bookingForm.time)      errs.time = 'Please enter a time.';
        if (!bookingForm.procedure) errs.procedure = 'Please select a procedure.';
        // Prevent past date-times
        if (bookingForm.date && bookingForm.time) {
            const selected = new Date(`${bookingForm.date}T${bookingForm.time}`);
            if (selected < new Date()) errs.time = 'Cannot book an appointment in the past.';
        }
        setBookingErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        if (!validateBookingForm()) return;
        setIsSubmittingBooking(true);

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

            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', notes: '', source: 'Walk-in' });
            setBookingErrors({});
            // Refresh the list to show the new appointment
            await fetchAppointments(true);
        } catch (err) {
            console.error('Booking error:', err);
            addToast(err.message || 'Failed to book appointment. Please try again.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const handleCloseBookingModal = () => {
        setIsBookingModalOpen(false);
        setBookingErrors({});
        setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', notes: '', source: 'Walk-in' });
    };

    // ─── PATIENT NAME HELPER FOR BOOKING DROPDOWN ───────────────────────────
    const getPatientDisplayName = (p) => {
        if (p.name?.first) return `${p.name.first} ${p.name.last}`;
        return p.email || 'Unknown';
    };

    // ─── RENDER ──────────────────────────────────────────────────────────────
    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles.header}>
                    <div className={styles['header-left']}>
                        <h1 className={styles.title}>All Appointments</h1>
                        <p className={styles.subtitle}>
                            Manage and monitor the clinic's master schedule.
                            {isRefreshing && <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 12 }}>Refreshing…</span>}
                        </p>
                    </div>
                    <button
                        className={styles.bookBtn}
                        onClick={() => setIsBookingModalOpen(true)}
                    >
                        <FaPlus /> Book Appointment
                    </button>
                </header>

                {/* FILTER CONTROLS */}
                <div className={styles.filterCard}>
                    <div className={styles.controlsRow}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search patient name or procedure..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select
                            className={styles.filterSelect}
                            value={dentistFilter}
                            onChange={(e) => setDentistFilter(e.target.value)}
                        >
                            <option value="All">All Dentists</option>
                            {dynamicDentists.map((doc, i) => (
                                <option key={`doc-${i}`} value={doc}>{doc}</option>
                            ))}
                        </select>

                        <select
                            className={styles.filterSelect}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                title="From Date"
                            />
                            <span className={styles.dateSeparator}>-</span>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                title="To Date"
                            />
                        </div>
                    </div>
                </div>

                {/* MASTER LIST */}
                <div className={styles.listContainer}>
                    {isLoading ? (
                        <div className={styles.emptyState} style={{ color: '#01538b' }}>
                            Loading master schedule…
                        </div>
                    ) : displayedAppointments.length > 0 ? (
                        displayedAppointments.map((apt) => (
                            <div key={apt.id} className={styles.appointmentCard}>

                                <div className={styles.timeBlock}>
                                    <p className={styles.dateText}>{formatDateShort(apt.rawDate)}</p>
                                    <p className={styles.timeText}>
                                        <FaClock style={{ fontSize: '11px', color: '#94a3b8' }} />
                                        {apt.time || formatTime(apt.rawDate)} {apt.duration && apt.duration !== '—' ? `• ${apt.duration}` : ''}
                                    </p>
                                </div>

                                <div className={styles.patientBlock}>
                                    <UserAvatar
                                        user={{ name: apt.patientName, profileImage: apt.patientImage }}
                                        size={45}
                                        style={{ border: '2px solid #e0f2fe' }}
                                    />
                                    <div className={styles.patientDetails}>
                                        <p className={styles.patientName}>{apt.patientName}</p>
                                        <p className={styles.treatmentType}>{apt.procedure}</p>
                                    </div>
                                </div>

                                <div className={styles.dentistBlock}>
                                    <p className={styles.dentistLabel}>Attending Dentist</p>
                                    <p className={styles.dentistName}>
                                        <FaUserMd style={{ marginRight: 4 }} />
                                        {apt.dentistName}
                                    </p>
                                </div>

                                <div className={styles.statusBlock}>
                                    <span className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}>
                                        {capitalize(apt.status)}
                                    </span>

                                    {/* Quick status change — only for non-terminal statuses */}
                                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                        <select
                                            className={styles.statusSelect}
                                            value={apt.status}
                                            onChange={(e) => handleStatusSelectChange(apt, e.target.value)}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    )}
                                </div>

                                <div className={styles.actionsBlock}>
                                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                                        <button
                                            className={styles.cancelBtn}
                                            onClick={() => setCancelTarget(apt)}
                                            title="Cancel appointment"
                                        >
                                            <FaTimes /> Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            <p>No appointments match your current filters.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* ─── BOOKING MODAL ─────────────────────────────────────────────── */}
            {isBookingModalOpen && (
                <div className={styles.modalOverlay} onClick={!isSubmittingBooking ? handleCloseBookingModal : undefined}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>Book New Appointment</h3>
                            <button className={styles.closeModalBtn} onClick={handleCloseBookingModal} disabled={isSubmittingBooking}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleBookAppointment} noValidate>
                            {/* Patient */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>PATIENT <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="patientId"
                                    className={styles.formInput}
                                    value={bookingForm.patientId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" hidden>Select Patient</option>
                                    {patients.map(p => (
                                        <option key={p._id} value={p._id}>{getPatientDisplayName(p)}</option>
                                    ))}
                                </select>
                                {bookingErrors.patientId && <span className={styles.errorText}>{bookingErrors.patientId}</span>}
                            </div>

                            {/* Dentist */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>DENTIST <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="dentistId"
                                    className={styles.formInput}
                                    value={bookingForm.dentistId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" hidden>Select Dentist</option>
                                    {dentists.map(d => (
                                        <option key={d._id} value={d._id}>
                                            Dr. {d.name?.first} {d.name?.last}
                                        </option>
                                    ))}
                                </select>
                                {bookingErrors.dentistId && <span className={styles.errorText}>{bookingErrors.dentistId}</span>}
                            </div>

                            {/* Date & Time */}
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>DATE <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={styles.formInput}
                                        value={bookingForm.date}
                                        onChange={handleBookingChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        disabled={isSubmittingBooking}
                                    />
                                    {bookingErrors.date && <span className={styles.errorText}>{bookingErrors.date}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>TIME <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="time"
                                        name="time"
                                        className={styles.formInput}
                                        value={bookingForm.time}
                                        onChange={handleBookingChange}
                                        disabled={isSubmittingBooking}
                                    />
                                    {bookingErrors.time && <span className={styles.errorText}>{bookingErrors.time}</span>}
                                </div>
                            </div>

                            {/* Procedure */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>PROCEDURE <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="procedure"
                                    className={styles.formInput}
                                    value={bookingForm.procedure}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" hidden>Select Procedure</option>
                                    {PROCEDURE_OPTIONS.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                                {bookingErrors.procedure && <span className={styles.errorText}>{bookingErrors.procedure}</span>}
                            </div>

                            {/* Source */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>BOOKING SOURCE</label>
                                <select
                                    name="source"
                                    className={styles.formInput}
                                    value={bookingForm.source}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="Walk-in">Walk-in</option>
                                    <option value="Phone Call">Phone Call</option>
                                    <option value="Smile Hub (Online)">Smile Hub (Online)</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>NOTES (optional)</label>
                                <textarea
                                    name="notes"
                                    className={styles.formInput}
                                    rows={3}
                                    value={bookingForm.notes}
                                    onChange={handleBookingChange}
                                    placeholder="Special instructions, allergies, concerns..."
                                    disabled={isSubmittingBooking}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div className={styles.modalButtonGroup}>
                                <button
                                    type="button"
                                    className={styles.cancelModalBtn}
                                    onClick={handleCloseBookingModal}
                                    disabled={isSubmittingBooking}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={isSubmittingBooking}
                                >
                                    {isSubmittingBooking ? 'Booking…' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── CONFIRM: STATUS CHANGE ────────────────────────────────────── */}
            <ConfirmModal
                isOpen={!!statusChangeTarget}
                title="Update Appointment Status"
                message={`Are you sure you want to change ${statusChangeTarget?.apt?.patientName}'s appointment to "${capitalize(statusChangeTarget?.newStatus)}"?`}
                confirmText="Update Status"
                isDestructive={false}
                onConfirm={confirmStatusChange}
                onCancel={() => setStatusChangeTarget(null)}
            />

            {/* ─── CONFIRM: CANCEL APPOINTMENT ──────────────────────────────── */}
            <ConfirmModal
                isOpen={!!cancelTarget}
                title="Cancel Appointment"
                message={`Are you absolutely sure you want to cancel the appointment for ${cancelTarget?.patientName}? This action will free up the slot in the calendar.`}
                confirmText="Yes, Cancel Appointment"
                isDestructive={true}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setCancelTarget(null)}
            />
        </>
    );
}