import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryAppointments.module.css';
import modalStyles from '../../styles/admin/StaffModals.module.css';
import { authFetch, publicFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';
import RegisterGuestPatient from './RegisterGuestPatient';
import {
    FaSearch,
    FaCalendarAlt,
    FaUserMd,
    FaPlus,
    FaFileMedical,
    FaTimes,
    FaClock,
    FaTrashAlt,
} from 'react-icons/fa';

const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment', 'Braces / Orthodontic Adjustment',
    'Teeth Whitening', 'Crown / Bridge Fitting', 'Wisdom Tooth Extraction',
    'Oral Surgery', 'X-Ray / Radiograph', 'Other',
];

const STATUS_DISPLAY_MAP = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    'in-clinic': 'In Clinic',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const STATUS_API_MAP = {
    Pending: 'pending',
    Confirmed: 'confirmed',
    'In Clinic': 'in-clinic',
    Completed: 'completed',
    Cancelled: 'cancelled',
};

const initialBookingForm = {
    patientId: '',
    dentistId: '',
    date: '',
    time: '',
    procedure: '',
    branch: '',
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const isSlotPast = (slot24, dateStr) => {
    if (!slot24 || !dateStr || dateStr !== getTodayString()) return false;
    const now = new Date();
    const [hour, minute] = slot24.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;
    const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 30;
    return slotMinutes <= bufferMinutes;
};

const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const normalizeSurgery = (surgery) => ({
    id: surgery._id,
    patientId: surgery.patient?._id || surgery.patient,
    patientName: surgery.patient?.name
        ? `${surgery.patient.name.first} ${surgery.patient.name.last}`.trim()
        : (surgery.guestName || 'Unknown Patient'),
    patientImage: surgery.patient?.profileImage || null,
    guestName: surgery.guestName || '',
    guestEmail: surgery.guestEmail || '',
    guestPhone: surgery.guestPhone || '',
    guestBirthdate: surgery.guestBirthdate || '',
    guestGender: surgery.guestGender || '',
    guestCurrentAddress: surgery.guestCurrentAddress || null,
    guestPermanentAddress: surgery.guestPermanentAddress || null,
    preRegistrationCompleted: Boolean(surgery.preRegistrationCompleted),
    preRegistrationTokenExpiry: surgery.preRegistrationTokenExpiry || '',
    dentistId: surgery.dentist?._id || surgery.dentist,
    dentistName: surgery.dentist?.name
        ? `Dr. ${surgery.dentist.name.first} ${surgery.dentist.name.last}`.trim()
        : 'Unassigned',
    procedure: surgery.procedure || '-',
    status: STATUS_DISPLAY_MAP[surgery.status] || 'Pending',
    rawStatus: surgery.status,
    time: surgery.time || '',
    duration: surgery.duration || '-',
    source: surgery.source || 'Walk-in',
    rawDate: new Date(surgery.date),
    branch: surgery.branch || '',
    isGuest: !surgery.patient && surgery.source === 'Smile Hub (Online)',
});

const isAddressComplete = (address) => (
    ['region', 'province', 'city', 'barangay', 'street', 'houseNumber']
        .every((field) => Boolean(address?.[field]))
);

const getGuestPreRegistrationMeta = (appointment) => {
    if (!appointment.isGuest) return null;
    if (appointment.preRegistrationCompleted) {
        return { label: 'Ready to Register', background: '#dcfce7', color: '#166534' };
    }
    if (appointment.guestBirthdate && appointment.guestGender && isAddressComplete(appointment.guestCurrentAddress) && isAddressComplete(appointment.guestPermanentAddress)) {
        return { label: 'Ready to Register', background: '#dcfce7', color: '#166534' };
    }
    if (appointment.preRegistrationTokenExpiry && new Date(appointment.preRegistrationTokenExpiry) < new Date()) {
        return { label: 'Link Expired', background: '#fee2e2', color: '#b91c1c' };
    }
    if (appointment.rawStatus === 'confirmed') {
        return { label: 'Awaiting Guest Info', background: '#fef3c7', color: '#b45309' };
    }
    return null;
};

const extractPatients = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.patients)) return payload.patients;
    return [];
};

export default function AdminAppointments() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const role = user?.role || 'administrator';
    const isBranchManager = role === 'branch-manager';
    const isOwner = role === 'owner';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';
    const bookingBranch = isBranchManager ? assignedBranch : '';

    const [allAppointments, setAllAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dentistFilter, setDentistFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [branchFilter, setBranchFilter] = useState(isBranchManager ? assignedBranch : 'All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusChangeTarget, setStatusChangeTarget] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [guestRegistrationTarget, setGuestRegistrationTarget] = useState(null);
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState({ ...initialBookingForm, branch: bookingBranch });
    const [bookingErrors, setBookingErrors] = useState({});
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [slotsError, setSlotsError] = useState('');

    const patientRouteBase = isBranchManager
        ? '/branch-manager/patients'
        : isOwner
            ? '/owner/patients'
            : '/admin/patients';

    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await authFetch('/appointments');
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
                const requests = [
                    authFetch('/appointments'),
                    authFetch('/patients'),
                    authFetch('/users?role=dentist'),
                ];

                if (!isBranchManager) {
                    requests.push(authFetch('/branches?all=true'));
                }

                const [aptsRes, patientsRes, dentistsRes, branchesRes] = await Promise.all(requests);

                if (aptsRes.ok) {
                    setAllAppointments((await aptsRes.json()).map(normalizeSurgery).sort((a, b) => b.rawDate - a.rawDate));
                }
                if (patientsRes.ok) {
                    const patientPayload = await patientsRes.json();
                    setPatients(extractPatients(patientPayload).filter((entry) => entry.status === 'active'));
                }
                if (dentistsRes.ok) {
                    setDentists((await dentistsRes.json()).filter((entry) => entry.status === 'active' && !entry.isArchived));
                }
                if (branchesRes?.ok) {
                    setBranches(await branchesRes.json());
                } else if (isBranchManager && assignedBranch) {
                    setBranches([{ _id: assignedBranch, name: assignedBranch }]);
                }
            } catch {
                addToast('Failed to connect to the server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [addToast, assignedBranch, isBranchManager]);

    useEffect(() => {
        const selectedBranch = bookingForm.branch || assignedBranch;
        if (!bookingForm.date || !selectedBranch) {
            setAllowedSlots([]);
            setTakenSlots([]);
            setSlotsError('');
            return;
        }

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setSlotsError('');
            try {
                const response = await publicFetch(`/public/appointments/slots?date=${bookingForm.date}&branch=${encodeURIComponent(selectedBranch)}`);
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.message || 'Could not load appointment slots.');
                }
                const data = await response.json();
                setAllowedSlots(Array.isArray(data.allowedSlots) ? data.allowedSlots : []);
                setTakenSlots(Array.isArray(data.takenSlots) ? data.takenSlots : []);
            } catch (error) {
                setAllowedSlots([]);
                setTakenSlots([]);
                setSlotsError(error.message || 'Could not load appointment slots.');
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [assignedBranch, bookingForm.branch, bookingForm.date]);

    const dynamicDentists = useMemo(() => {
        const names = allAppointments.map((apt) => apt.dentistName).filter(Boolean);
        return [...new Set(names)].sort();
    }, [allAppointments]);

    const displayedAppointments = allAppointments.filter((apt) => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            apt.patientName.toLowerCase().includes(searchLower) ||
            apt.procedure.toLowerCase().includes(searchLower);
        const matchesDentist = dentistFilter === 'All' || apt.dentistName === dentistFilter;
        const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
        const matchesBranch = branchFilter === 'All' || apt.branch === branchFilter;
        let matchesDate = true;
        if (startDate) matchesDate = matchesDate && new Date(apt.rawDate).setHours(0, 0, 0, 0) >= new Date(startDate).setHours(0, 0, 0, 0);
        if (endDate) matchesDate = matchesDate && new Date(apt.rawDate).setHours(0, 0, 0, 0) <= new Date(endDate).setHours(0, 0, 0, 0);
        return matchesSearch && matchesDentist && matchesStatus && matchesDate && matchesBranch;
    });

    const visibleSlots = useMemo(
        () => allowedSlots.filter((slot) => !takenSlots.includes(slot) && !isSlotPast(slot, bookingForm.date)),
        [allowedSlots, bookingForm.date, takenSlots]
    );

    const branchOptions = useMemo(() => {
        if (isBranchManager && assignedBranch) return [assignedBranch];
        return [...new Set(branches.map((branch) => branch.name).filter(Boolean))].sort();
    }, [assignedBranch, branches, isBranchManager]);

    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending':
                return styles.statusPending;
            case 'Confirmed':
                return styles.statusConfirmed;
            case 'In Clinic':
                return styles['status-in-clinic'];
            case 'Completed':
                return styles.statusCompleted;
            case 'Cancelled':
                return styles.statusCancelled;
            default:
                return styles.statusPending;
        }
    };

    const handleStatusSelectChange = (appointment, newStatus) => {
        if (appointment.status === newStatus) return;
        setStatusChangeTarget({ appointment, newStatus });
    };

    const confirmStatusChange = async () => {
        if (!statusChangeTarget) return;
        const { appointment, newStatus } = statusChangeTarget;
        try {
            const res = await authFetch(`/appointments/${appointment.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: STATUS_API_MAP[newStatus] || newStatus.toLowerCase() }),
            });
            if (!res.ok) throw new Error();
            setAllAppointments((prev) => prev.map((item) => (
                item.id === appointment.id
                    ? { ...item, status: newStatus, rawStatus: STATUS_API_MAP[newStatus] || item.rawStatus }
                    : item
            )));
            addToast(`${appointment.patientName}'s appointment updated to ${newStatus}.`, 'success');
        } catch {
            addToast('Failed to update appointment status.', 'error');
        } finally {
            setStatusChangeTarget(null);
        }
    };

    const confirmCancelAppointment = async () => {
        if (!cancelTarget) return;
        try {
            const res = await authFetch(`/appointments/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!res.ok) throw new Error();
            setAllAppointments((prev) => prev.map((item) => (
                item.id === cancelTarget.id ? { ...item, status: 'Cancelled', rawStatus: 'cancelled' } : item
            )));
            addToast(
                cancelTarget.isGuest
                    ? `${cancelTarget.patientName}'s guest request has been declined.`
                    : `${cancelTarget.patientName}'s appointment has been cancelled.`,
                'info'
            );
        } catch {
            addToast('Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    const confirmDeleteAppointment = async () => {
        if (!deleteTarget) return;
        try {
            const res = await authFetch(`/appointments/${deleteTarget.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            setAllAppointments((prev) => prev.filter((item) => item.id !== deleteTarget.id));
            addToast('Appointment archived successfully.', 'success');
        } catch {
            addToast('Failed to archive appointment.', 'error');
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleBookingChange = (event) => {
        const { name, value } = event.target;
        setBookingForm((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'date' || name === 'branch') next.time = '';
            return next;
        });
        if (bookingErrors[name]) {
            setBookingErrors((prev) => ({ ...prev, [name]: '' }));
        }
        if (name === 'date' || name === 'branch') {
            setBookingErrors((prev) => ({ ...prev, time: '', branch: name === 'branch' ? '' : prev.branch }));
        }
    };

    const handleTimeSelect = (slot) => {
        setBookingForm((prev) => ({ ...prev, time: slot }));
        setBookingErrors((prev) => ({ ...prev, time: '' }));
    };

    const getPatientName = (patient) => (
        patient.name?.first ? `${patient.name.first} ${patient.name.last}`.trim() : patient.email || 'Unknown'
    );

    const validateBookingForm = () => {
        const nextErrors = {};

        if (!bookingForm.patientId) nextErrors.patientId = 'Select a patient.';
        if (!bookingForm.dentistId) nextErrors.dentistId = 'Select a dentist.';
        if (!bookingForm.date) nextErrors.date = 'Choose an appointment date.';
        if (!bookingForm.time) nextErrors.time = 'Choose an available time slot.';
        else if (!visibleSlots.includes(bookingForm.time)) nextErrors.time = 'Choose an available time slot.';
        if (!bookingForm.procedure) nextErrors.procedure = 'Select a procedure.';
        if (!isBranchManager && !bookingForm.branch) nextErrors.branch = 'Select a branch.';

        setBookingErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleBookAppointment = async (event) => {
        event.preventDefault();
        const finalBranch = isBranchManager ? assignedBranch : bookingForm.branch;
        if (!finalBranch) {
            addToast('Please select a branch before booking.', 'error');
            return;
        }
        if (!validateBookingForm()) return;

        setIsSubmittingBooking(true);
        try {
            const res = await authFetch('/appointments', {
                method: 'POST',
                body: JSON.stringify({
                    patient: bookingForm.patientId,
                    dentist: bookingForm.dentistId,
                    date: bookingForm.date,
                    time: bookingForm.time,
                    procedure: bookingForm.procedure,
                    status: 'confirmed',
                    source: 'Walk-in',
                    branch: finalBranch,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Booking failed.');
            }

            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            setBookingForm({ ...initialBookingForm, branch: bookingBranch });
            setBookingErrors({});
            await fetchAppointments(true);
        } catch (error) {
            addToast(error.message || 'Failed to book appointment. Please try again.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const handleOpenBooking = () => {
        setBookingForm({ ...initialBookingForm, branch: bookingBranch });
        setBookingErrors({});
        setSlotsError('');
        setAllowedSlots([]);
        setTakenSlots([]);
        setIsBookingModalOpen(true);
    };

    const handleGuestRegistrationSuccess = async () => {
        setGuestRegistrationTarget(null);
        await fetchAppointments(true);
    };

    const handleConfirmGuestAppointment = async (appointment) => {
        try {
            const response = await authFetch(`/appointments/${appointment.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'confirmed' }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to confirm guest appointment.');
            addToast('Guest appointment confirmed. A pre-registration link was sent to the guest.', 'success');
            await fetchAppointments(true);
        } catch (error) {
            addToast(error.message || 'Failed to confirm guest appointment.', 'error');
        }
    };

    const handleOpenGuestRegistration = (appointment) => {
        setGuestRegistrationTarget(appointment);
    };

    const handleResendPreRegistration = async (appointment) => {
        try {
            const response = await authFetch(`/admin/appointments/${appointment.id}/resend-pre-register`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to resend pre-registration link.');
            addToast('Pre-registration link resent successfully.', 'success');
            await fetchAppointments(true);
        } catch (error) {
            addToast(error.message || 'Unable to process guest appointment.', 'error');
        }
    };

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles.header}>
                    <div className={styles['header-left']}>
                        <h1 className={styles.title}>All Appointments</h1>
                        <p className={styles.subtitle}>
                            {isBranchManager
                                ? 'Manage and monitor the clinic schedule for your assigned branch.'
                                : 'Manage and monitor the clinic schedule across appointments.'}
                        </p>
                    </div>
                    <button className={styles.bookBtn} onClick={handleOpenBooking}>
                        <FaPlus /> Book Appointment
                    </button>
                </header>

                <div className={styles.filterCard}>
                    <div className={styles.controlsRow}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search patient name or procedure..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>

                        {!isBranchManager && (
                            <select className={styles.filterSelect} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                                <option value="All">All Branches</option>
                                {branchOptions.map((branch) => (
                                    <option key={branch} value={branch}>{branch}</option>
                                ))}
                            </select>
                        )}

                        <select className={styles.filterSelect} value={dentistFilter} onChange={(event) => setDentistFilter(event.target.value)}>
                            <option value="All">All Dentists</option>
                            {dynamicDentists.map((dentist) => (
                                <option key={dentist} value={dentist}>{dentist}</option>
                            ))}
                        </select>

                        <select className={styles.filterSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="In Clinic">In Clinic</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input type="date" className={styles.dateInput} value={startDate} onChange={(event) => setStartDate(event.target.value)} title="From Date" />
                            <span className={styles.dateSeparator}>-</span>
                            <input type="date" className={styles.dateInput} value={endDate} onChange={(event) => setEndDate(event.target.value)} title="To Date" />
                        </div>
                    </div>
                </div>

                <div className={styles.listContainer}>
                    {isLoading ? (
                        <div className={styles.emptyState} style={{ color: '#01538b' }}>
                            Loading master schedule...
                        </div>
                    ) : displayedAppointments.length > 0 ? (
                        displayedAppointments.map((appointment) => (
                            <div key={appointment.id} className={styles.appointmentCard}>
                                <div className={styles.timeBlock}>
                                    <p className={styles.dateText}>{formatDateShort(appointment.rawDate)}</p>
                                    <p className={styles.timeText}>
                                        <FaClock style={{ fontSize: '11px', color: '#94a3b8' }} />
                                        {appointment.time || formatTime(appointment.rawDate)} {appointment.duration !== '-' ? `• ${appointment.duration}` : ''}
                                    </p>
                                </div>

                                <div className={styles.patientBlock}>
                                    <UserAvatar
                                        user={{ name: appointment.patientName, profileImage: appointment.patientImage }}
                                        size={45}
                                        style={{ border: '2px solid #e0f2fe' }}
                                    />
                                    <div className={styles.patientDetails}>
                                        <p className={styles.patientName}>{appointment.patientName}</p>
                                        {appointment.isGuest && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    background: '#fff7ed',
                                                    color: '#c2410c',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.04em',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    Guest
                                                </span>
                                                {getGuestPreRegistrationMeta(appointment) && (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '4px 10px',
                                                        borderRadius: '999px',
                                                        background: getGuestPreRegistrationMeta(appointment).background,
                                                        color: getGuestPreRegistrationMeta(appointment).color,
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.04em',
                                                        textTransform: 'uppercase',
                                                    }}>
                                                        {getGuestPreRegistrationMeta(appointment).label}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <p className={styles.treatmentType}>
                                            {appointment.procedure}{appointment.branch ? ` • ${appointment.branch}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className={styles.dentistBlock}>
                                    <p className={styles.dentistLabel}>Attending Dentist</p>
                                    <p className={styles.dentistName}>
                                        <FaUserMd style={{ color: '#94a3b8' }} /> {appointment.dentistName}
                                    </p>
                                </div>

                                <div className={styles.actionBlock}>
                                    {appointment.isGuest ? (
                                        <span className={`${styles.statusBadge} ${getStatusClass(appointment.status)}`} style={{ pointerEvents: 'none' }}>
                                            {appointment.status}
                                        </span>
                                    ) : (
                                        <select
                                            className={`${styles.statusBadge} ${getStatusClass(appointment.status)}`}
                                            value={appointment.status}
                                            onChange={(event) => handleStatusSelectChange(appointment, event.target.value)}
                                            title="Update Status"
                                            disabled={appointment.status === 'Cancelled' || appointment.status === 'Completed'}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="In Clinic">In Clinic</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    )}

                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => navigate(`${patientRouteBase}/${appointment.patientId}/emr`)}
                                        title="View Patient EMR"
                                        disabled={!appointment.patientId}
                                    >
                                        <FaFileMedical /> View Patient
                                    </button>

                                    {appointment.isGuest && appointment.rawStatus === 'pending' && (
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleConfirmGuestAppointment(appointment)}
                                            title="Confirm guest request and send pre-registration email"
                                            style={{ background: '#01538b', color: '#fff' }}
                                        >
                                            Confirm Request
                                        </button>
                                    )}

                                    {appointment.isGuest && appointment.rawStatus === 'confirmed' && getGuestPreRegistrationMeta(appointment)?.label === 'Ready to Register' && (
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleOpenGuestRegistration(appointment)}
                                            title="Register guest as patient"
                                            style={{ background: '#01538b', color: '#fff' }}
                                        >
                                            Register Guest
                                        </button>
                                    )}

                                    {appointment.isGuest && appointment.rawStatus === 'confirmed' && getGuestPreRegistrationMeta(appointment)?.label !== 'Ready to Register' && (
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleResendPreRegistration(appointment)}
                                            title="Resend pre-registration link"
                                            style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}
                                        >
                                            Resend Link
                                        </button>
                                    )}

                                    <button
                                        className={`${styles.iconBtn} ${styles.cancelActionBtn}`}
                                        onClick={() => setCancelTarget(appointment)}
                                        title={appointment.isGuest ? 'Decline Guest Request' : 'Cancel Appointment'}
                                        disabled={appointment.status === 'Cancelled' || appointment.status === 'Completed'}
                                        style={{
                                            opacity: (appointment.status === 'Cancelled' || appointment.status === 'Completed') ? 0.4 : 1,
                                            cursor: (appointment.status === 'Cancelled' || appointment.status === 'Completed') ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <FaTimes />
                                    </button>

                                    <button
                                        className={`${styles.iconBtn} ${styles.cancelActionBtn}`}
                                        onClick={() => setDeleteTarget(appointment)}
                                        title="Archive Appointment"
                                    >
                                        <FaTrashAlt />
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

            {isBookingModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '560px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>Book New Appointment</h2>
                            <button
                                className={modalStyles.closeButton}
                                onClick={() => {
                                    setIsBookingModalOpen(false);
                                    setBookingForm({ ...initialBookingForm, branch: bookingBranch });
                                    setBookingErrors({});
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleBookAppointment} className={modalStyles.modalBody}>
                            {!isBranchManager && (
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Branch <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        name="branch"
                                        className={modalStyles.formInput}
                                        required
                                        value={bookingForm.branch}
                                        onChange={handleBookingChange}
                                        disabled={isSubmittingBooking}
                                    >
                                        <option value="" disabled hidden>-- Choose a Branch --</option>
                                        {branchOptions.map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                    </select>
                                    {bookingErrors.branch && <span className={modalStyles.errorMessage}>{bookingErrors.branch}</span>}
                                </div>
                            )}

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Select Patient <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="patientId"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.patientId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Choose a Patient --</option>
                                    {patients.map((patient) => (
                                        <option key={patient._id} value={patient._id}>{getPatientName(patient)}</option>
                                    ))}
                                </select>
                                {bookingErrors.patientId && <span className={modalStyles.errorMessage}>{bookingErrors.patientId}</span>}
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Assigned Dentist <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="dentistId"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.dentistId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Choose a Dentist --</option>
                                    {dentists.map((dentist) => (
                                        <option key={dentist._id} value={dentist._id}>
                                            Dr. {dentist.name?.first} {dentist.name?.last}
                                        </option>
                                    ))}
                                </select>
                                {bookingErrors.dentistId && <span className={modalStyles.errorMessage}>{bookingErrors.dentistId}</span>}
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Date <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="date"
                                    name="date"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.date}
                                    onChange={handleBookingChange}
                                    min={getTodayString()}
                                    disabled={isSubmittingBooking}
                                />
                                {bookingErrors.date && <span className={modalStyles.errorMessage}>{bookingErrors.date}</span>}
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Preferred Time <span style={{ color: 'red' }}>*</span></label>
                                {(!bookingForm.date || (!isBranchManager && !bookingForm.branch)) ? (
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                                        {isBranchManager ? 'Select a date first to view available time slots.' : 'Select a branch and date first to view available time slots.'}
                                    </p>
                                ) : loadingSlots ? (
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Loading available time slots...</p>
                                ) : slotsError ? (
                                    <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{slotsError}</p>
                                ) : visibleSlots.length === 0 ? (
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>No available slots for the selected date.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {visibleSlots.map((slot) => {
                                            const isSelected = bookingForm.time === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => handleTimeSelect(slot)}
                                                    style={{
                                                        border: isSelected ? '1px solid #01538b' : '1px solid #cbd5e1',
                                                        background: isSelected ? '#e0f2fe' : '#fff',
                                                        color: isSelected ? '#01538b' : '#334155',
                                                        borderRadius: '999px',
                                                        padding: '8px 14px',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {to12h(slot)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {bookingErrors.time && <span className={modalStyles.errorMessage}>{bookingErrors.time}</span>}
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Procedure <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="procedure"
                                    className={modalStyles.formInput}
                                    required
                                    value={bookingForm.procedure}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Select Procedure --</option>
                                    {PROCEDURE_OPTIONS.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                                {bookingErrors.procedure && <span className={modalStyles.errorMessage}>{bookingErrors.procedure}</span>}
                            </div>

                            {isBranchManager && !assignedBranch && (
                                <div className={modalStyles.errorMessage}>
                                    This branch manager account does not have an assigned branch yet, so booking is unavailable.
                                </div>
                            )}

                            <div className={modalStyles.formActions}>
                                <button
                                    type="button"
                                    className={modalStyles.cancelBtn}
                                    onClick={() => {
                                        setIsBookingModalOpen(false);
                                        setBookingForm({ ...initialBookingForm, branch: bookingBranch });
                                        setBookingErrors({});
                                    }}
                                    disabled={isSubmittingBooking}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className={modalStyles.submitBtn} disabled={isSubmittingBooking || (isBranchManager && !assignedBranch)}>
                                    {isSubmittingBooking ? 'Booking...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {guestRegistrationTarget && (
                <RegisterGuestPatient
                    appointment={guestRegistrationTarget}
                    onClose={() => setGuestRegistrationTarget(null)}
                    onSuccess={handleGuestRegistrationSuccess}
                />
            )}

            <ConfirmModal
                isOpen={!!statusChangeTarget}
                title="Update Appointment Status"
                message={`Are you sure you want to change ${statusChangeTarget?.appointment?.patientName}'s appointment to "${statusChangeTarget?.newStatus}"?`}
                confirmText="Update Status"
                isDestructive={false}
                onConfirm={confirmStatusChange}
                onCancel={() => setStatusChangeTarget(null)}
            />

            <ConfirmModal
                isOpen={!!cancelTarget}
                title={cancelTarget?.isGuest ? 'Decline Guest Request' : 'Cancel Appointment'}
                message={
                    cancelTarget?.isGuest
                        ? `Are you sure you want to decline the guest appointment request for ${cancelTarget?.patientName}? A decline email will be sent automatically.`
                        : `Are you absolutely sure you want to cancel the appointment for ${cancelTarget?.patientName}? This action will free up the slot in the calendar.`
                }
                confirmText={cancelTarget?.isGuest ? 'Yes, Decline Request' : 'Yes, Cancel Appointment'}
                isDestructive={true}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setCancelTarget(null)}
            />

            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Archive Appointment"
                message={`Are you sure you want to archive the appointment for ${deleteTarget?.patientName}?`}
                confirmText="Yes, Archive"
                isDestructive={true}
                onConfirm={confirmDeleteAppointment}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
}
