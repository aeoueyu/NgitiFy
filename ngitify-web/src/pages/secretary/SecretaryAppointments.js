import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryAppointments.module.css';
import modalStyles from '../../styles/admin/StaffModals.module.css'; // matches original import

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

import {
    FaSearch, FaCalendarAlt, FaUserMd, FaPlus,
    FaFileMedical, FaEdit, FaTimes, FaClock
} from 'react-icons/fa';

// ─── PROCEDURE OPTIONS ───────────────────────────────────────────────────────
const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Wisdom Tooth Extraction',
    'Oral Surgery', 'X-Ray / Radiograph', 'Other',
];

// ─── DATA NORMALIZER ─────────────────────────────────────────────────────────
// ✅ FIX Bug 27: Map 'in-clinic' (DB value) → 'In Clinic' (display label)
const STATUS_DISPLAY_MAP = {
    'pending':   'Pending',
    'confirmed': 'Confirmed',
    'in-clinic': 'In Clinic',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
};

const normalizeSurgery = (s) => ({
    id:           s._id,
    patientId:    s.patient?._id || s.patient,
    patientName:  s.patient?.name
        ? `${s.patient.name.first} ${s.patient.name.last}`
        : 'Unknown Patient',
    patientImage: s.patient?.profileImage || null,
    dentistId:    s.dentist?._id || s.dentist,
    dentistName:  s.dentist?.name
        ? `Dr. ${s.dentist.name.first} ${s.dentist.name.last}`
        : 'Unassigned',
    procedure:    s.procedure || '—',
    status:       STATUS_DISPLAY_MAP[s.status] || 'Pending',
    time:         s.time     || '',
    duration:     s.duration || '—',
    source:       s.source   || 'Walk-in',
    rawDate:      new Date(s.date),
    notes:        s.notes    || '',
});

export default function SecretaryAppointments() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    // ─── DATA STATE ─────────────────────────────────────────────────────────
    const [allAppointments, setAllAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── FILTER STATES ───────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [dentistFilter, setDentistFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ─── MODAL STATES ────────────────────────────────────────────────────────
    const [statusChangeTarget, setStatusChangeTarget] = useState(null); // { apt, newStatus }
    const [cancelTarget, setCancelTarget] = useState(null);             // apt

    // ─── BOOKING ENGINE STATES ───────────────────────────────────────────────
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientId: '',
        dentistId: '',
        date: '',
        time: '',
        procedure: '',
    });

    // ─── FETCH ───────────────────────────────────────────────────────────────
    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await authFetch('/surgeries');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setAllAppointments(data.map(normalizeSurgery).sort((a, b) => b.rawDate - a.rawDate));
        } catch {
            addToast('Failed to load clinic schedule.', 'error');
        } finally {
            setIsLoading(false);
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
                if (aptsRes.ok)     setAllAppointments((await aptsRes.json()).map(normalizeSurgery).sort((a, b) => b.rawDate - a.rawDate));
                if (patientsRes.ok) setPatients((await patientsRes.json()).filter(u => u.status === 'active'));
                if (dentistsRes.ok) setDentists((await dentistsRes.json()).filter(u => u.status === 'active' && !u.isArchived));
            } catch {
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
        const matchesStatus  = statusFilter  === 'All' || apt.status === statusFilter;
        let matchesDate = true;
        if (startDate) matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) >= new Date(startDate).setHours(0,0,0,0);
        if (endDate)   matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) <= new Date(endDate).setHours(0,0,0,0);
        return matchesSearch && matchesDentist && matchesStatus && matchesDate;
    });

    // ─── RENDER HELPERS ──────────────────────────────────────────────────────
    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending':   return styles.statusPending;
            case 'Confirmed': return styles.statusConfirmed;
            case 'In Clinic': return styles.statusInClinic;
            case 'Completed': return styles.statusCompleted;
            case 'Cancelled': return styles.statusCancelled;
            default:          return styles.statusPending;
        }
    };

    // ─── ACTION HANDLERS ─────────────────────────────────────────────────────

    // Status dropdown change → show confirm modal
    const handleStatusSelectChange = (apt, newStatus) => {
        if (apt.status === newStatus) return;
        setStatusChangeTarget({ apt, newStatus });
    };

    // Confirmed status change → hit backend
    // ✅ FIX Bug 27: Map display label back to the DB enum value before sending to API
    const STATUS_API_MAP = {
        'Pending':   'pending',
        'Confirmed': 'confirmed',
        'In Clinic': 'in-clinic',
        'Completed': 'completed',
        'Cancelled': 'cancelled',
    };

    const confirmStatusChange = async () => {
        if (!statusChangeTarget) return;
        const { apt, newStatus } = statusChangeTarget;
        try {
            const res = await authFetch(`/surgeries/${apt.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: STATUS_API_MAP[newStatus] || newStatus.toLowerCase() }),
            });
            if (!res.ok) throw new Error();
            setAllAppointments(prev =>
                prev.map(a => a.id === apt.id ? { ...a, status: newStatus } : a)
            );
            addToast(`${apt.patientName}'s appointment updated to ${newStatus}.`, 'success');
        } catch {
            addToast('Failed to update appointment status.', 'error');
        } finally {
            setStatusChangeTarget(null);
        }
    };

    // Confirmed cancel → hit backend
    const confirmCancelAppointment = async () => {
        if (!cancelTarget) return;
        try {
            const res = await authFetch(`/surgeries/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!res.ok) throw new Error();
            setAllAppointments(prev => prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'Cancelled' } : a));
            addToast(`${cancelTarget.patientName}'s appointment has been cancelled.`, 'info');
        } catch {
            addToast('Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    // ─── BOOKING ENGINE ──────────────────────────────────────────────────────
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
    };

    const getPatientName = (p) => p.name?.first ? `${p.name.first} ${p.name.last}` : p.email || 'Unknown';

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        setIsSubmittingBooking(true);
        try {
            const res = await authFetch('/surgeries', {
                method: 'POST',
                body: JSON.stringify({
                    patient:   bookingForm.patientId,
                    dentist:   bookingForm.dentistId,
                    date:      bookingForm.date,
                    time:      bookingForm.time,
                    procedure: bookingForm.procedure,
                    status:    'confirmed',
                    source:    'Walk-in',
                    branch:    'Marikina Branch',
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Booking failed.');
            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '' });
            await fetchAppointments(true);
        } catch (err) {
            addToast(err.message || 'Failed to book appointment. Please try again.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    // ─── RENDER ──────────────────────────────────────────────────────────────
    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles.header}>
                    <div className={styles['header-left']}>
                        <h1 className={styles.title}>All Appointments</h1>
                        <p className={styles.subtitle}>Manage and monitor the clinic's master schedule.</p>
                    </div>
                    <button className={styles.bookBtn} onClick={() => setIsBookingModalOpen(true)}>
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
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="In Clinic">In Clinic</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input type="date" className={styles.dateInput} value={startDate} onChange={(e) => setStartDate(e.target.value)} title="From Date" />
                            <span className={styles.dateSeparator}>-</span>
                            <input type="date" className={styles.dateInput} value={endDate}   onChange={(e) => setEndDate(e.target.value)} title="To Date" />
                        </div>
                    </div>
                </div>

                {/* MASTER LIST CONTAINER */}
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
                                        {apt.time || formatTime(apt.rawDate)} {apt.duration !== '—' ? `• ${apt.duration}` : ''}
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
                                        <FaUserMd style={{ color: '#94a3b8' }} /> {apt.dentistName}
                                    </p>
                                </div>

                                {/* ACTION BLOCK — mirrors original class names */}
                                <div className={styles.actionBlock}>
                                    {/* Status as a styled dropdown — matches original pattern */}
                                    <select
                                        className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}
                                        value={apt.status}
                                        onChange={(e) => handleStatusSelectChange(apt, e.target.value)}
                                        title="Update Status"
                                        disabled={apt.status === 'Cancelled' || apt.status === 'Completed'}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="In Clinic">In Clinic</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>

                                    <button
                                        className={styles.iconBtn}
                                        onClick={() => addToast('Edit functionality coming soon.', 'info')}
                                        title="Edit Appointment"
                                    >
                                        <FaEdit />
                                    </button>

                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => addToast(`Opening Patient Profile for ${apt.patientName}…`, 'info')}
                                        title="View Patient Profile"
                                    >
                                        <FaFileMedical /> View Patient
                                    </button>

                                    <button
                                        className={`${styles.iconBtn} ${styles.cancelActionBtn}`}
                                        onClick={() => setCancelTarget(apt)}
                                        title="Cancel Appointment"
                                        disabled={apt.status === 'Cancelled' || apt.status === 'Completed'}
                                        style={{
                                            opacity: (apt.status === 'Cancelled' || apt.status === 'Completed') ? 0.4 : 1,
                                            cursor:  (apt.status === 'Cancelled' || apt.status === 'Completed') ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            No appointments match your current filters.
                        </div>
                    )}
                </div>
            </main>

            {/* ─── BOOKING MODAL (uses modalStyles from StaffModals) ────────── */}
            {isBookingModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '520px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>Book New Appointment</h2>
                            <button className={modalStyles.closeButton} onClick={() => setIsBookingModalOpen(false)}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleBookAppointment} className={modalStyles.modalBody}>

                            {/* Patient */}
                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>
                                    Select Patient <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="patientId"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.patientId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Choose a Patient --</option>
                                    {patients.map(p => (
                                        <option key={p._id} value={p._id}>{getPatientName(p)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dentist */}
                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>
                                    Assigned Dentist <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="dentistId"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.dentistId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Choose a Dentist --</option>
                                    {dentists.map(d => (
                                        <option key={d._id} value={d._id}>
                                            Dr. {d.name?.first} {d.name?.last}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date + Time */}
                            <div className={modalStyles.formRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Date <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={modalStyles.formInput}
                                        required
                                        value={bookingForm.date}
                                        onChange={handleBookingChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        disabled={isSubmittingBooking}
                                    />
                                </div>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Time <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="time"
                                        name="time"
                                        className={modalStyles.formInput}
                                        required
                                        value={bookingForm.time}
                                        onChange={handleBookingChange}
                                        disabled={isSubmittingBooking}
                                    />
                                </div>
                            </div>

                            {/* Procedure */}
                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>
                                    Procedure <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="procedure"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.procedure}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Select Procedure --</option>
                                    {PROCEDURE_OPTIONS.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={modalStyles.formActions}>
                                <button
                                    type="button"
                                    className={modalStyles.cancelBtn}
                                    onClick={() => setIsBookingModalOpen(false)}
                                    disabled={isSubmittingBooking}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={modalStyles.submitBtn}
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
                message={`Are you sure you want to change ${statusChangeTarget?.apt?.patientName}'s appointment to "${statusChangeTarget?.newStatus}"?`}
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