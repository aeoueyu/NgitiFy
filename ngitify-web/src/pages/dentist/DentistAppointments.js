import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistAppointments.module.css';
import {
    FaClock, FaFileMedical, FaSearch, FaCalendarAlt,
    FaBoxOpen, FaCheckCircle, FaPlus, FaTimes
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

// Imported Modular Components
import PatientEMR from './PatientEMR';
import MaterialUsageLog from './MaterialUsageLog';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PH_HOLIDAYS = [
    { month: 0,  day: 1,  name: "New Year's Day" },
    { month: 3,  day: 9,  name: "Araw ng Kagitingan" },
    { month: 4,  day: 1,  name: "Labor Day" },
    { month: 5,  day: 12, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 31, name: "New Year's Eve" },
];

const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Wisdom Tooth Extraction',
    'Oral Surgery', 'X-Ray / Radiograph', 'Other',
];

// ─── DATA NORMALIZER ─────────────────────────────────────────────────────────
const normalizeSurgery = (s) => ({
    id: s._id,
    patientId: s.patient?._id || s.patient,
    patientName: s.patient?.name
        ? `${s.patient.name.first} ${s.patient.name.last}`
        : 'Unknown Patient',
    patientImage: s.patient?.profileImage || null,
    procedure: s.procedure || '—',
    status: s.status || 'pending',
    time: s.time || '',
    duration: s.duration || '—',
    rawDate: new Date(s.date),
    notes: s.notes || '',
});

export default function DentistAppointments() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    // ─── DATA STATE ──────────────────────────────────────────────────────────
    const [allAppointments, setAllAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── HEADER / PROFILE STATE ──────────────────────────────────────────────
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // ─── EMR MODAL ───────────────────────────────────────────────────────────
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // ─── MATERIAL LOGGER MODAL ───────────────────────────────────────────────
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [selectedAptForMaterial, setSelectedAptForMaterial] = useState(null);

    // ─── COMPLETE CONFIRM MODAL ──────────────────────────────────────────────
    const [completeTarget, setCompleteTarget] = useState(null);

    // ─── FILTER STATES ───────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [procedureFilter, setProcedureFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ─── CALENDAR STATES ─────────────────────────────────────────────────────
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // ─── BOOKING MODAL STATE ─────────────────────────────────────────────────
    const [patients, setPatients]               = useState([]);
    const [dentists, setDentists]               = useState([]);
    const [branches, setBranches]               = useState([]);
    const [isBookingModalOpen, setIsBookingModalOpen]     = useState(false);
    const [isSubmittingBooking, setIsSubmittingBooking]   = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientId: '',
        dentistId: '',
        date: '',
        time: '',
        procedure: '',
        branchId: '',   // BUG 20 FIX: was hardcoded 'Marikina Branch'
    });

    // ─── FETCH APPOINTMENTS ──────────────────────────────────────────────────
    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const dentistId = user?.id || user?._id;
            const endpoint = dentistId
                ? `/surgeries?dentistId=${dentistId}`
                : '/surgeries';
            const res = await authFetch(endpoint);
            if (!res.ok) throw new Error('Failed to load appointments.');
            const data = await res.json();
            setAllAppointments(data.map(normalizeSurgery).sort((a, b) => a.rawDate - b.rawDate));
        } catch (err) {
            console.error('Appointment fetch error:', err);
            addToast('Failed to load your schedule.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, addToast]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    // ─── FETCH PATIENTS, DENTISTS, BRANCHES FOR BOOKING MODAL ───────────────
    useEffect(() => {
        const loadBookingData = async () => {
            try {
                const [patientsRes, dentistsRes, branchesRes] = await Promise.all([
                    authFetch('/patients'),
                    authFetch('/users?role=dentist'),
                    authFetch('/branches'),
                ]);
                if (patientsRes.ok)  setPatients((await patientsRes.json()).filter(u => u.status === 'active'));
                if (dentistsRes.ok)  setDentists((await dentistsRes.json()).filter(u => u.status === 'active' && !u.isArchived));
                if (branchesRes.ok)  setBranches(await branchesRes.json());
            } catch (err) {
                console.error('Failed to load booking data:', err);
            }
        };
        loadBookingData();
    }, []);

    // ─── DYNAMIC PROCEDURE LIST ───────────────────────────────────────────────
    const dynamicProcedures = useMemo(() => {
        const procs = allAppointments.map(apt => apt.procedure).filter(Boolean);
        return [...new Set(procs)].sort();
    }, [allAppointments]);

    // ─── FILTER LOGIC ─────────────────────────────────────────────────────────
    const displayedAppointments = allAppointments.filter(apt => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            apt.patientName.toLowerCase().includes(searchLower) ||
            apt.procedure.toLowerCase().includes(searchLower);
        const matchesProcedure = procedureFilter === 'All' || apt.procedure === procedureFilter;
        let matchesDate = true;
        if (startDate || endDate) {
            if (startDate) matchesDate = matchesDate && new Date(apt.rawDate) >= new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && new Date(apt.rawDate) <= end;
            }
        } else {
            matchesDate = apt.rawDate.toDateString() === selectedDate.toDateString();
        }
        return matchesSearch && matchesProcedure && matchesDate;
    });

    // ─── CALENDAR LOGIC ───────────────────────────────────────────────────────
    const getCalendarDays = () => {
        const year = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            const isSelected = currentDate.toDateString() === selectedDate.toDateString();
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const hasEvent = allAppointments.some(apt => apt.rawDate.toDateString() === currentDate.toDateString());
            const holidayObj = PH_HOLIDAYS.find(h => h.month === month && h.day === i);
            days.push({
                num: i,
                active: isSelected,
                isToday,
                hasEvent,
                isHoliday: !!holidayObj,
                holidayName: holidayObj?.name || null,
                date: currentDate,
                faded: false,
            });
        }
        const totalCells = days.length > 35 ? 42 : 35;
        for (let i = 1; i <= totalCells - days.length; i++) {
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });
        }
        return days;
    };

    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));

    const handleDateClick = (day) => {
        setSelectedDate(day.date);
        setStartDate('');
        setEndDate('');
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // ─── RENDER HELPERS ───────────────────────────────────────────────────────
    const getStatusClass = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'confirmed':  return styles['status-pending'];
            case 'pending':    return styles['status-pending'];
            case 'in clinic':  return styles['status-in-clinic'];
            case 'completed':
            case 'done':       return styles['status-done'];
            default:           return styles['status-pending'];
        }
    };

    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const getPatientName = (p) => p.name?.first ? `${p.name.first} ${p.name.last}` : p.email || 'Unknown';

    // ─── ACTION HANDLERS ──────────────────────────────────────────────────────
    const handleLogoutClick = () => { setIsProfileOpen(false); setShowLogoutModal(true); };
    const handleProfileNavigation = () => { setIsProfileOpen(false); navigate('/dentist/profile'); };
    const handleViewEMR = (patientId) => { setSelectedPatientId(patientId); setIsEMRModalOpen(true); };
    const handleOpenMaterialLog = (apt) => { setSelectedAptForMaterial(apt); setIsMaterialModalOpen(true); };

    const handleConfirmComplete = async () => {
        if (!completeTarget) return;
        try {
            const res = await authFetch(`/surgeries/${completeTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'completed' }),
            });
            if (!res.ok) throw new Error('Failed to mark complete.');
            setAllAppointments(prev =>
                prev.map(a => a.id === completeTarget.id ? { ...a, status: 'completed' } : a)
            );
            addToast(`${completeTarget.patientName}'s appointment marked as Completed.`, 'success');
        } catch (err) {
            console.error('Complete error:', err);
            addToast('Failed to update appointment.', 'error');
        } finally {
            setCompleteTarget(null);
        }
    };

    // ─── BOOKING HANDLERS ─────────────────────────────────────────────────────
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
    };

    const resetBookingForm = () => {
        setBookingForm({ patientId: '', dentistId: '', date: '', time: '', procedure: '', branchId: '' });
    };

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
                    branch:    bookingForm.branchId,  // BUG 20 FIX: no longer hardcoded
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Booking failed.');
            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            resetBookingForm();
            await fetchAppointments(true);
        } catch (err) {
            addToast(err.message || 'Failed to book appointment. Please try again.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const dentistDisplayName = user?.name?.first ? `${user.name.first} ${user.name.last}` : 'Dentist';

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Clinical Appointments</h1>
                        <p className={styles['subtitle']}>Manage your patient schedule, access EMRs, and log materials.</p>
                    </div>
                    <div className={styles['header-right']}>
                        {/* BUG 20 FIX: Book Appointment button */}
                        <button
                            className={styles['bookBtn']}
                            onClick={() => { resetBookingForm(); setIsBookingModalOpen(true); }}
                        >
                            <FaPlus /> Book Appointment
                        </button>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, Dr. {dentistDisplayName.split(' ')[0]}!</span>
                            <span className={styles['user-role']}>Dentist</span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <UserAvatar user={{ name: dentistDisplayName, profileImage: user?.profileImage }} size={45} />
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={handleProfileNavigation}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/dentist/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={handleLogoutClick}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* FILTER CONTROLS */}
                <div className={styles.controlsRow}>
                    <div className={styles.searchFilterGroup}>
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
                            value={procedureFilter}
                            onChange={(e) => setProcedureFilter(e.target.value)}
                        >
                            <option value="All">All Procedures</option>
                            {dynamicProcedures.map((proc, i) => (
                                <option key={`proc-${i}`} value={proc}>{proc}</option>
                            ))}
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input type="date" className={styles.dateInput} value={startDate} onChange={(e) => setStartDate(e.target.value)} title="From Date" />
                            <span className={styles.dateSeparator}>-</span>
                            <input type="date" className={styles.dateInput} value={endDate} onChange={(e) => setEndDate(e.target.value)} title="To Date" />
                        </div>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    {/* LEFT: APPOINTMENT LIST */}
                    <div className={styles['left-column']}>
                        <div className={styles['listContainer']} style={{ height: '100%' }}>
                            {isLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#01538b' }}>Loading your schedule…</div>
                            ) : displayedAppointments.length > 0 ? (
                                displayedAppointments.map((apt) => (
                                    <div key={apt.id} className={styles['appointment-item']}>

                                        <div className={styles['time-block']}>
                                            <p className={styles['time-text']}>{formatDateShort(apt.rawDate)}</p>
                                            <p className={styles['stat-desc']}>
                                                <FaClock style={{ fontSize: '10px' }} /> {apt.time || '—'} • {apt.duration}
                                            </p>
                                        </div>

                                        <div className={styles['patient-block']}>
                                            <UserAvatar
                                                user={{ name: apt.patientName, profileImage: apt.patientImage }}
                                                size={45}
                                                style={{ border: '2px solid #e0f2fe' }}
                                            />
                                            <div className={styles['patient-details']}>
                                                <p className={styles['patient-name']}>{apt.patientName}</p>
                                                <p className={styles['treatment-type']}>{apt.procedure}</p>
                                            </div>
                                        </div>

                                        <div className={styles['action-block']}>
                                            <span className={`${styles['status-badge']} ${getStatusClass(apt.status)}`}>
                                                {capitalize(apt.status)}
                                            </span>

                                            <button className={styles['emr-btn']} onClick={() => handleViewEMR(apt.patientId)}>
                                                <FaFileMedical /> View EMR
                                            </button>

                                            {(apt.status === 'confirmed' || apt.status === 'pending') && (
                                                <button
                                                    className={styles['logMaterialsBtn']}
                                                    style={{ background: '#16a34a', color: '#fff' }}
                                                    onClick={() => setCompleteTarget(apt)}
                                                >
                                                    <FaCheckCircle /> Mark Done
                                                </button>
                                            )}

                                            {(apt.status === 'completed' || apt.status === 'done') && (
                                                <button className={styles['logMaterialsBtn']} onClick={() => handleOpenMaterialLog(apt)}>
                                                    <FaBoxOpen /> Log Materials
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles['empty-state']}>
                                    <p>No appointments match your current filters.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: CALENDAR */}
                    <div className={styles['right-column']}>
                        <div className={styles['calendar-card']}>
                            <div className={styles['calendar-header']}>
                                <h3 className={styles['month-text']}>{dynamicMonthYear}</h3>
                                <div className={styles['cal-nav']}>
                                    <button className={styles['cal-nav-btn']} onClick={handlePrevMonth}>&lt;</button>
                                    <button className={styles['cal-nav-btn']} onClick={handleNextMonth}>&gt;</button>
                                </div>
                            </div>

                            <div className={styles['calendar-grid']}>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                    <div key={day} className={styles['day-name']}>{day}</div>
                                ))}
                                {calendarDays.map((day, idx) => (
                                    <div
                                        key={idx}
                                        title={day.holidayName || ''}
                                        onClick={() => handleDateClick(day)}
                                        className={`
                                            ${styles['date-num']}
                                            ${day.faded ? styles['faded'] : ''}
                                            ${day.isToday && !day.faded ? styles['today'] : ''}
                                            ${day.active && !startDate && !endDate ? styles['active'] : ''}
                                            ${day.isHoliday && !day.faded ? styles['holiday'] : ''}
                                        `}
                                    >
                                        {day.num}
                                        {day.hasEvent && (
                                            <div className={`${styles['event-dot']} ${day.active && !startDate && !endDate ? styles['white'] : ''}`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ─── BOOK APPOINTMENT MODAL ───────────────────────────────────── */}
            {isBookingModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '520px' }}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Book New Appointment</h2>
                            <button
                                className={styles.closeButton}
                                onClick={() => { setIsBookingModalOpen(false); resetBookingForm(); }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleBookAppointment} className={styles.modalBody}>

                            {/* Patient */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Select Patient <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="patientId"
                                    className={styles.formInput}
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
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Assigned Dentist <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="dentistId"
                                    className={styles.formInput}
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

                            {/* Branch — BUG 20 FIX */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Branch <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="branchId"
                                    className={styles.formInput}
                                    required
                                    value={bookingForm.branchId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Select Branch --</option>
                                    {branches.map(b => (
                                        <option key={b._id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date + Time */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Date <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={styles.formInput}
                                        required
                                        value={bookingForm.date}
                                        onChange={handleBookingChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        disabled={isSubmittingBooking}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Time <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="time"
                                        name="time"
                                        className={styles.formInput}
                                        required
                                        value={bookingForm.time}
                                        onChange={handleBookingChange}
                                        disabled={isSubmittingBooking}
                                    />
                                </div>
                            </div>

                            {/* Procedure */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Procedure <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                    name="procedure"
                                    className={styles.formInput}
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

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => { setIsBookingModalOpen(false); resetBookingForm(); }}
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

            {/* EMR MODAL */}
            {isEMRModalOpen && selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => setIsEMRModalOpen(false)}
                    onEdit={() => addToast('Edit Profile action coming soon', 'info')}
                />
            )}

            {/* MATERIAL LOGGER MODAL */}
            {isMaterialModalOpen && selectedAptForMaterial && (
                <MaterialUsageLog
                    appointment={selectedAptForMaterial}
                    onClose={() => { setIsMaterialModalOpen(false); setSelectedAptForMaterial(null); }}
                />
            )}

            {/* CONFIRM MARK COMPLETE */}
            <ConfirmModal
                isOpen={!!completeTarget}
                title="Mark Appointment as Completed"
                message={`Mark ${completeTarget?.patientName}'s appointment (${completeTarget?.procedure}) as completed?`}
                confirmText="Yes, Mark Done"
                isDestructive={false}
                onConfirm={handleConfirmComplete}
                onCancel={() => setCompleteTarget(null)}
            />

            {/* LOGOUT CONFIRM */}
            <ConfirmModal
                isOpen={showLogoutModal}
                title="Confirm Logout"
                message="Are you sure you want to end your session and logout of the system?"
                confirmText="Yes, Logout"
                isDestructive={true}
                onConfirm={logout}
                onCancel={() => setShowLogoutModal(false)}
            />
        </>
    );
}