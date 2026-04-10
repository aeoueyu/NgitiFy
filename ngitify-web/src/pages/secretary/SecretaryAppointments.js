import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryAppointments.module.css';
import modalStyles from '../../styles/owner/StaffModals.module.css'; // CRITICAL RULE: Reusing StaffModals pattern

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

// --- ROBUST MOCK DATA FOR UI TESTING ---
const MOCK_SCHEDULE = [
    { id: 1, patientId: 'PT-2023-0842', patientName: 'Eleanor Vance', procedure: 'Root Canal Therapy', dentistName: 'Dr. Sarah Smith', status: 'In Clinic', duration: '60 Min', rawDate: new Date() },
    { id: 2, patientId: 'PT-2024-1105', patientName: 'Marcus Chen', procedure: 'Routine Prophylaxis', dentistName: 'Dr. Michael Cruz', status: 'Confirmed', duration: '30 Min', rawDate: new Date() },
    { id: 3, patientId: 'PT-2023-0199', patientName: 'Sophia Reyes', procedure: 'Composite Filling', dentistName: 'Dr. Sarah Smith', status: 'Pending', duration: '45 Min', rawDate: new Date() },
    { id: 4, patientId: 'PT-2022-0441', patientName: 'James Wilson', procedure: 'Tooth Extraction', dentistName: 'Dr. Emily Chen', status: 'Completed', duration: '60 Min', rawDate: new Date(new Date().setDate(new Date().getDate() - 1)) },
    { id: 5, patientId: 'PT-2021-0911', patientName: 'David Lee', procedure: 'Braces Adjustment', dentistName: 'Dr. Michael Cruz', status: 'Confirmed', duration: '60 Min', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: 6, patientId: 'PT-2023-0222', patientName: 'Maria Santos', procedure: 'Crown Fitting', dentistName: 'Dr. Emily Chen', status: 'Cancelled', duration: '45 Min', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: 7, patientId: 'PT-2024-0012', patientName: 'Lucas Torres', procedure: 'Wisdom Tooth Extraction', dentistName: 'Dr. Emily Chen', status: 'Completed', duration: '90 Min', rawDate: new Date() },
];

const MOCK_PATIENTS = [
    { id: 'PT-2023-0842', name: 'Eleanor Vance' },
    { id: 'PT-2024-1105', name: 'Marcus Chen' },
    { id: 'PT-2023-0199', name: 'Sophia Reyes' },
    { id: 'PT-2022-0441', name: 'James Wilson' },
    { id: 'PT-2021-0911', name: 'David Lee' },
    { id: 'PT-2023-0222', name: 'Maria Santos' },
    { id: 'PT-2024-0012', name: 'Lucas Torres' }
];

const MOCK_DENTISTS = [
    { id: 'D1', name: 'Dr. Sarah Smith' },
    { id: 'D2', name: 'Dr. Michael Cruz' },
    { id: 'D3', name: 'Dr. Emily Chen' }
];

export default function SecretaryAppointments() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    // Data State
    const [allAppointments, setAllAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [dentistFilter, setDentistFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal Interaction States
    const [statusChangeTarget, setStatusChangeTarget] = useState(null); // { apt, newStatus }
    const [cancelTarget, setCancelTarget] = useState(null); // apt

    // Booking Engine States (Task 4.1)
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientId: '',
        dentistName: '',
        date: '',
        time: '',
        procedure: ''
    });

    // Fetch Initial Data
    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                setIsLoading(true);
                // Future Implementation: const res = await authFetch('/appointments/all');
                
                // Simulate network request
                setTimeout(() => {
                    setAllAppointments(MOCK_SCHEDULE.sort((a, b) => b.rawDate - a.rawDate));
                    setIsLoading(false);
                }, 400);
            } catch (error) {
                console.error("Failed to fetch appointments:", error);
                addToast("Failed to load clinic schedule.", "error");
                setIsLoading(false);
            }
        };
        fetchAppointments();
    }, [addToast]);

    // Extract unique dentists for the dropdown
    const dynamicDentists = useMemo(() => {
        const dentists = allAppointments.map(apt => apt.dentistName).filter(Boolean);
        return [...new Set(dentists)].sort();
    }, [allAppointments]);

    // --- FILTER LOGIC ---
    const displayedAppointments = allAppointments.filter(apt => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = apt.patientName.toLowerCase().includes(searchLower) || 
                              apt.procedure.toLowerCase().includes(searchLower);
        
        const matchesDentist = dentistFilter === 'All' || apt.dentistName === dentistFilter;
        const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
        
        let matchesDate = true;
        if (startDate) {
            matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) >= new Date(startDate).setHours(0,0,0,0);
        }
        if (endDate) {
            matchesDate = matchesDate && new Date(apt.rawDate).setHours(0,0,0,0) <= new Date(endDate).setHours(0,0,0,0);
        }

        return matchesSearch && matchesDentist && matchesStatus && matchesDate;
    });

    // --- RENDER HELPERS ---
    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending': return styles.statusPending;
            case 'Confirmed': return styles.statusConfirmed;
            case 'In Clinic': return styles.statusInClinic;
            case 'Completed': return styles.statusCompleted;
            case 'Cancelled': return styles.statusCancelled;
            default: return styles.statusPending;
        }
    };

    // --- ACTION HANDLERS ---
    const handleStatusSelectChange = (apt, newStatus) => {
        if (apt.status === newStatus) return;
        setStatusChangeTarget({ apt, newStatus });
    };

    const confirmStatusChange = () => {
        if (!statusChangeTarget) return;
        
        const { apt, newStatus } = statusChangeTarget;
        
        // Future: await authFetch(`/appointments/${apt.id}/status`, { method: 'PUT', body: JSON.stringify({status: newStatus}) })
        
        setAllAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: newStatus } : a));
        addToast(`${apt.patientName}'s appointment updated to ${newStatus}.`, "success");
        setStatusChangeTarget(null);
    };

    const confirmCancelAppointment = () => {
        if (!cancelTarget) return;

        // Future: await authFetch(`/appointments/${cancelTarget.id}/cancel`, { method: 'PUT' })
        
        setAllAppointments(prev => prev.map(a => a.id === cancelTarget.id ? { ...a, status: 'Cancelled' } : a));
        addToast(`${cancelTarget.patientName}'s appointment has been cancelled.`, "info");
        setCancelTarget(null);
    };

    // --- BOOKING ENGINE HANDLERS (Task 4.1) ---
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingForm(prev => ({ ...prev, [name]: value }));
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        setIsSubmittingBooking(true);

        try {
            // Future Implementation: await authFetch('/appointments', { method: 'POST', body: JSON.stringify(bookingForm) });
            
            // Simulate network latency
            setTimeout(() => {
                const selectedPatient = MOCK_PATIENTS.find(p => p.id === bookingForm.patientId) || { name: 'Unknown Patient' };
                
                // Construct Date Object
                const [year, month, day] = bookingForm.date.split('-');
                const [hours, minutes] = bookingForm.time.split(':');
                const rawDate = new Date(year, month - 1, day, hours, minutes);

                const newApt = {
                    id: Math.random().toString(),
                    patientId: bookingForm.patientId,
                    patientName: selectedPatient.name,
                    procedure: bookingForm.procedure,
                    dentistName: bookingForm.dentistName,
                    status: 'Confirmed', // Default status for new bookings
                    duration: '60 Min',
                    rawDate: rawDate
                };

                // Add to list and sort chronologically
                setAllAppointments(prev => [newApt, ...prev].sort((a, b) => b.rawDate - a.rawDate));
                
                addToast("Appointment successfully booked!", "success");
                setIsBookingModalOpen(false);
                setIsSubmittingBooking(false);
                setBookingForm({ patientId: '', dentistName: '', date: '', time: '', procedure: '' }); // Reset
            }, 800);
        } catch (error) {
            console.error("Booking error:", error);
            addToast("Failed to book appointment. Please try again.", "error");
            setIsSubmittingBooking(false);
        }
    };

    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles.header}>
                    <div className={styles['header-left']}>
                        <h1 className={styles.title}>All Appointments</h1>
                        <p className={styles.subtitle}>Manage and monitor the clinic's master schedule.</p>
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
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="In Clinic">In Clinic</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
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

                {/* MASTER LIST CONTAINER */}
                <div className={styles.listContainer}>
                    {isLoading ? (
                        <div className={styles.emptyState} style={{ color: '#01538b' }}>
                            Loading master schedule...
                        </div>
                    ) : displayedAppointments.length > 0 ? (
                        displayedAppointments.map((apt) => (
                            <div key={apt.id} className={styles.appointmentCard}>
                                
                                <div className={styles.timeBlock}>
                                    <p className={styles.dateText}>{formatDateShort(apt.rawDate)}</p>
                                    <p className={styles.timeText}>
                                        <FaClock style={{ fontSize: '11px', color: '#94a3b8' }}/> 
                                        {formatTime(apt.rawDate)} • {apt.duration}
                                    </p>
                                </div>
                                
                                <div className={styles.patientBlock}>
                                    <UserAvatar user={{ name: apt.patientName }} size={45} style={{ border: '2px solid #e0f2fe' }} />
                                    <div className={styles.patientDetails}>
                                        <p className={styles.patientName}>{apt.patientName}</p>
                                        <p className={styles.treatmentType}>{apt.procedure}</p>
                                    </div>
                                </div>

                                <div className={styles.dentistBlock}>
                                    <p className={styles.dentistLabel}>Attending Dentist</p>
                                    <p className={styles.dentistName}>
                                        <FaUserMd style={{color: '#94a3b8'}}/> {apt.dentistName}
                                    </p>
                                </div>

                                <div className={styles.actionBlock}>
                                    {/* Interactive Status Dropdown styled as a Badge */}
                                    <select 
                                        className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}
                                        value={apt.status}
                                        onChange={(e) => handleStatusSelectChange(apt, e.target.value)}
                                        title="Update Status"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="In Clinic">In Clinic</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    
                                    <button 
                                        className={styles.iconBtn} 
                                        onClick={() => addToast("Edit functionality coming soon.", "info")}
                                        title="Edit Appointment"
                                    >
                                        <FaEdit />
                                    </button>

                                    {/* Link to Read-Only EMR via navigate parameter */}
                                    <button 
                                        className={styles.viewBtn} 
                                        onClick={() => addToast(`Opening Patient Profile for ${apt.patientName}...`, "info")}
                                        title="View Patient Profile"
                                    >
                                        <FaFileMedical /> View Patient
                                    </button>

                                    <button 
                                        className={`${styles.iconBtn} ${styles.cancelActionBtn}`} 
                                        onClick={() => setCancelTarget(apt)}
                                        title="Cancel Appointment"
                                        disabled={apt.status === 'Cancelled'}
                                        style={{ opacity: apt.status === 'Cancelled' ? 0.4 : 1, cursor: apt.status === 'Cancelled' ? 'not-allowed' : 'pointer' }}
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

            {/* THE BOOKING ENGINE MODAL (Task 4.1) */}
            {isBookingModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '550px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>Book New Appointment</h2>
                            <button className={modalStyles.closeButton} onClick={() => setIsBookingModalOpen(false)}>
                                <FaTimes />
                            </button>
                        </div>
                        
                        <form onSubmit={handleBookAppointment} className={modalStyles.modalBody}>
                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Select Patient <span style={{color: 'red'}}>*</span></label>
                                <select 
                                    name="patientId" 
                                    className={modalStyles.formInput} 
                                    required
                                    value={bookingForm.patientId}
                                    onChange={handleBookingChange}
                                >
                                    <option value="" disabled hidden>-- Choose a Patient --</option>
                                    {MOCK_PATIENTS.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Assigned Dentist <span style={{color: 'red'}}>*</span></label>
                                <select 
                                    name="dentistName" 
                                    className={modalStyles.formInput} 
                                    required
                                    value={bookingForm.dentistName}
                                    onChange={handleBookingChange}
                                >
                                    <option value="" disabled hidden>-- Choose a Dentist --</option>
                                    {MOCK_DENTISTS.map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={modalStyles.formRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Date <span style={{color: 'red'}}>*</span></label>
                                    <input 
                                        type="date" 
                                        name="date" 
                                        className={modalStyles.formInput} 
                                        required 
                                        value={bookingForm.date}
                                        onChange={handleBookingChange}
                                    />
                                </div>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Time <span style={{color: 'red'}}>*</span></label>
                                    <input 
                                        type="time" 
                                        name="time" 
                                        className={modalStyles.formInput} 
                                        required 
                                        value={bookingForm.time}
                                        onChange={handleBookingChange}
                                    />
                                </div>
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Treatment Type / Procedure <span style={{color: 'red'}}>*</span></label>
                                <input 
                                    type="text" 
                                    name="procedure" 
                                    className={modalStyles.formInput} 
                                    placeholder="e.g., Routine Prophylaxis, Consultation" 
                                    required 
                                    value={bookingForm.procedure}
                                    onChange={handleBookingChange}
                                />
                            </div>

                            <div className={modalStyles.formActions}>
                                <button type="button" className={modalStyles.cancelBtn} onClick={() => setIsBookingModalOpen(false)} disabled={isSubmittingBooking}>
                                    Cancel
                                </button>
                                <button type="submit" className={modalStyles.submitBtn} disabled={isSubmittingBooking}>
                                    {isSubmittingBooking ? 'Booking...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Confirm Status Change */}
            <ConfirmModal 
                isOpen={!!statusChangeTarget}
                title="Update Appointment Status"
                message={`Are you sure you want to change the status of ${statusChangeTarget?.apt?.patientName}'s appointment to "${statusChangeTarget?.newStatus}"?`}
                confirmText="Update Status"
                isDestructive={false}
                onConfirm={confirmStatusChange}
                onCancel={() => setStatusChangeTarget(null)}
            />

            {/* MODAL: Confirm Cancellation */}
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