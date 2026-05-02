import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaCheckCircle,
    FaClock,
    FaFileMedical,
    FaPlus,
    FaSearch,
    FaTimes,
    FaTrash,
    FaUserPlus,
    FaBoxOpen,
    FaForward,
    FaSyncAlt,
} from 'react-icons/fa';
import { MdOutlineQueuePlayNext } from 'react-icons/md';
import styles from '../../styles/shared/SchedulePage.module.css';
import modalStyles from '../../styles/admin/StaffModals.module.css';
import wideTable from '../../styles/wideTable.module.css';
import { authFetch, publicFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';
import RegisterGuestPatient from '../admin/RegisterGuestPatient';
import PatientEMR from '../dentist/PatientEMR';
import MaterialUsageLog from '../dentist/MaterialUsageLog';

const APPOINTMENT_STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    'in-clinic': 'In Clinic',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const APPOINTMENT_STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
const QUEUE_STATUS_OPTIONS = ['all', 'waiting', 'serving', 'done', 'skipped'];
const ALL_STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'in-clinic', 'completed', 'cancelled', 'waiting', 'serving', 'done', 'skipped'];
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

const initialWalkInForm = {
    patientName: '',
    contactNumber: '',
    procedureType: '',
    assignedDentist: '',
    branch: '',
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const isSameDate = (value, dateString) => {
    if (!value || !dateString) return false;
    const current = new Date(value);
    if (Number.isNaN(current.getTime())) return false;
    return current.toISOString().split('T')[0] === dateString;
};

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

const isAddressComplete = (address) => (
    ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].every((field) => Boolean(address?.[field]))
);

const getGuestPreRegistrationMeta = (appointment) => {
    if (!appointment.isGuest) return null;
    if (appointment.preRegistrationCompleted) {
        return { label: 'Ready to Register', tone: 'success' };
    }
    if (
        appointment.guestBirthdate &&
        appointment.guestGender &&
        isAddressComplete(appointment.guestCurrentAddress) &&
        isAddressComplete(appointment.guestPermanentAddress)
    ) {
        return { label: 'Ready to Register', tone: 'success' };
    }
    if (appointment.preRegistrationTokenExpiry && new Date(appointment.preRegistrationTokenExpiry) < new Date()) {
        return { label: 'Link Expired', tone: 'danger' };
    }
    if (appointment.rawStatus === 'confirmed') {
        return { label: 'Awaiting Guest Info', tone: 'warning' };
    }
    return null;
};

const extractPatients = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.patients)) return payload.patients;
    return [];
};

const normalizeAppointment = (appointment) => ({
    id: appointment._id || appointment.id,
    type: 'appointment',
    patientId: appointment.patient?._id || appointment.patient || '',
    patientName: appointment.patient?.name
        ? `${appointment.patient.name.first} ${appointment.patient.name.last}`.trim()
        : (appointment.guestName || 'Unknown Patient'),
    patientImage: appointment.patient?.profileImage || null,
    guestName: appointment.guestName || '',
    guestEmail: appointment.guestEmail || '',
    guestPhone: appointment.guestPhone || '',
    guestBirthdate: appointment.guestBirthdate || '',
    guestGender: appointment.guestGender || '',
    guestCurrentAddress: appointment.guestCurrentAddress || null,
    guestPermanentAddress: appointment.guestPermanentAddress || null,
    preRegistrationCompleted: Boolean(appointment.preRegistrationCompleted),
    preRegistrationTokenExpiry: appointment.preRegistrationTokenExpiry || '',
    dentistId: appointment.dentist?._id || appointment.dentist || '',
    dentistName: appointment.dentist?.name
        ? `Dr. ${appointment.dentist.name.first} ${appointment.dentist.name.last}`.trim()
        : 'Unassigned',
    procedure: appointment.procedure || '-',
    status: APPOINTMENT_STATUS_LABELS[appointment.status] || 'Pending',
    rawStatus: appointment.status || 'pending',
    time: appointment.time || '',
    duration: appointment.duration || '-',
    source: appointment.source || 'Walk-in',
    branch: appointment.branch || '',
    rawDate: new Date(appointment.date),
    isGuest: !appointment.patient && appointment.source === 'Smile Hub (Online)',
});

const normalizeQueueEntry = (entry) => ({
    id: entry._id || entry.id,
    type: 'walk-in',
    ticketNumber: entry.ticketNumber,
    patientName: entry.patientName || 'Unknown Patient',
    contactNumber: entry.contactNumber || '',
    procedure: entry.procedureType || '-',
    assignedDentist: entry.assignedDentist ? `Dr. ${entry.assignedDentist}` : 'Unassigned',
    assignedDentistRaw: entry.assignedDentist || '',
    status: entry.status || 'waiting',
    branch: entry.branch || '',
    calledAt: entry.calledAt || '',
    completedAt: entry.completedAt || '',
    createdAt: entry.createdAt || '',
    rawDate: new Date(entry.createdAt || Date.now()),
});

const getAppointmentStatusClass = (status) => {
    switch (status) {
        case 'Pending':
            return styles.statusPending;
        case 'Confirmed':
            return styles.statusConfirmed;
        case 'In Clinic':
            return styles.statusInClinic;
        case 'Completed':
            return styles.statusCompleted;
        case 'Cancelled':
            return styles.statusCancelled;
        default:
            return styles.statusPending;
    }
};

const getQueueStatusClass = (status) => {
    switch (status) {
        case 'serving':
            return styles.statusServing;
        case 'done':
            return styles.statusDone;
        case 'skipped':
            return styles.statusSkipped;
        default:
            return styles.statusWaiting;
    }
};

function ScheduleFilters({
    activeTypeTab,
    activeStatusFilter,
    selectedDate,
    searchQuery,
    onSearchChange,
    onDateChange,
    onStatusChange,
    statusOptions,
}) {
    return (
        <div className={styles.filterCard}>
            <div className={styles.filterRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={`Search ${activeTypeTab === 'walk-ins' ? 'walk-ins' : 'patients or procedures'}...`}
                    />
                </div>

                <label className={styles.dateField}>
                    <span className={styles.fieldLabel}>Date</span>
                    <input
                        type="date"
                        className={styles.dateInput}
                        value={selectedDate}
                        onChange={(event) => onDateChange(event.target.value)}
                    />
                </label>
            </div>

            <div className={styles.statusChips}>
                {statusOptions.map((status) => {
                    const label = status === 'all'
                        ? 'All'
                        : status
                            .split('-')
                            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                            .join(' ');
                    return (
                        <button
                            key={status}
                            type="button"
                            className={`${styles.statusChip} ${activeStatusFilter === status ? styles.statusChipActive : ''}`}
                            onClick={() => onStatusChange(status)}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AppointmentsTable({
    appointments,
    isDentist,
    canManageAppointments,
    canManageGuests,
    patientRouteBase,
    onStatusChange,
    onViewPatient,
    onCancel,
    onArchive,
    onConfirmGuest,
    onRegisterGuest,
    onResendGuest,
    onMarkDone,
    onLogMaterials,
}) {
    return (
        <div className={`${styles.tableWrapper} ${wideTable.tableWrapper}`}>
            <table className={`${styles.table} ${wideTable.table}`}>
                <thead>
                    <tr>
                        <th>Patient</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Dentist</th>
                        <th>Procedure</th>
                        <th>Branch</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {appointments.length > 0 ? appointments.map((appointment) => {
                        const guestMeta = getGuestPreRegistrationMeta(appointment);
                        return (
                            <tr key={appointment.id}>
                                <td>
                                    <div className={styles.patientCell}>
                                        <UserAvatar
                                            user={{ name: appointment.patientName, profileImage: appointment.patientImage }}
                                            size={38}
                                        />
                                        <div className={styles.patientMeta}>
                                            <span className={styles.patientName}>{appointment.patientName}</span>
                                            {appointment.isGuest && (
                                                <span className={`${styles.metaBadge} ${styles.metaBadgeGuest}`}>Guest</span>
                                            )}
                                            {guestMeta && (
                                                <span className={`${styles.metaBadge} ${styles[`metaBadge${guestMeta.tone.charAt(0).toUpperCase()}${guestMeta.tone.slice(1)}`]}`}>
                                                    {guestMeta.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td>{formatDateShort(appointment.rawDate)}</td>
                                <td>{appointment.time ? to12h(appointment.time) : '-'}</td>
                                <td>{appointment.dentistName}</td>
                                <td>{appointment.procedure}</td>
                                <td>{appointment.branch || '-'}</td>
                                <td>{appointment.source}</td>
                                <td>
                                    {canManageAppointments && !appointment.isGuest ? (
                                        <select
                                            className={`${styles.statusSelect} ${getAppointmentStatusClass(appointment.status)}`}
                                            value={appointment.status}
                                            onChange={(event) => onStatusChange(appointment, event.target.value)}
                                            disabled={appointment.status === 'Cancelled' || appointment.status === 'Completed'}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="In Clinic">In Clinic</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    ) : (
                                        <span className={`${styles.statusPill} ${getAppointmentStatusClass(appointment.status)}`}>
                                            {appointment.status}
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <div className={styles.actionRow}>
                                        {isDentist ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className={styles.actionButton}
                                                    onClick={() => onViewPatient(appointment)}
                                                    disabled={!appointment.patientId}
                                                >
                                                    <FaFileMedical /> View EMR
                                                </button>
                                                {(appointment.rawStatus === 'confirmed' || appointment.rawStatus === 'pending') && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles.successAction}`}
                                                        onClick={() => onMarkDone(appointment)}
                                                    >
                                                        <FaCheckCircle /> Mark Done
                                                    </button>
                                                )}
                                                {(appointment.rawStatus === 'completed' || appointment.rawStatus === 'done') && (
                                                    <button
                                                        type="button"
                                                        className={styles.actionButton}
                                                        onClick={() => onLogMaterials(appointment)}
                                                    >
                                                        <FaBoxOpen /> Log Materials
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className={styles.actionButton}
                                                    onClick={() => onViewPatient(appointment)}
                                                    disabled={!appointment.patientId}
                                                >
                                                    <FaFileMedical /> View Patient
                                                </button>

                                                {canManageGuests && appointment.isGuest && appointment.rawStatus === 'pending' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles.primaryAction}`}
                                                        onClick={() => onConfirmGuest(appointment)}
                                                    >
                                                        Confirm Request
                                                    </button>
                                                )}

                                                {canManageGuests && appointment.isGuest && appointment.rawStatus === 'confirmed' && guestMeta?.label === 'Ready to Register' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles.primaryAction}`}
                                                        onClick={() => onRegisterGuest(appointment)}
                                                    >
                                                        Register Guest
                                                    </button>
                                                )}

                                                {canManageGuests && appointment.isGuest && appointment.rawStatus === 'confirmed' && guestMeta?.label !== 'Ready to Register' && (
                                                    <button
                                                        type="button"
                                                        className={styles.actionButton}
                                                        onClick={() => onResendGuest(appointment)}
                                                    >
                                                        Resend Link
                                                    </button>
                                                )}

                                                {canManageAppointments && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className={`${styles.iconButton} ${styles.warnIconButton}`}
                                                            onClick={() => onCancel(appointment)}
                                                            disabled={appointment.status === 'Cancelled' || appointment.status === 'Completed'}
                                                            title={appointment.isGuest ? 'Decline guest request' : 'Cancel appointment'}
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.iconButton} ${styles.dangerIconButton}`}
                                                            onClick={() => onArchive(appointment)}
                                                            title="Archive appointment"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr>
                            <td colSpan="9" className={styles.emptyCell}>No appointments match the current filters.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function WalkInsTable({ entries, canManageQueue, onCall, onSkip, onDone, onRemove }) {
    return (
        <div className={`${styles.tableWrapper} ${wideTable.tableWrapper}`}>
            <table className={`${styles.table} ${wideTable.table}`}>
                <thead>
                    <tr>
                        <th>Ticket</th>
                        <th>Patient</th>
                        <th>Contact</th>
                        <th>Procedure</th>
                        <th>Dentist</th>
                        <th>Branch</th>
                        <th>Status</th>
                        <th>Queued</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.length > 0 ? entries.map((entry) => (
                        <tr key={entry.id}>
                            <td>#{String(entry.ticketNumber || 0).padStart(3, '0')}</td>
                            <td>{entry.patientName}</td>
                            <td>{entry.contactNumber || '-'}</td>
                            <td>{entry.procedure}</td>
                            <td>{entry.assignedDentist}</td>
                            <td>{entry.branch || '-'}</td>
                            <td>
                                <span className={`${styles.statusPill} ${getQueueStatusClass(entry.status)}`}>
                                    {entry.status}
                                </span>
                            </td>
                            <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td>
                                <div className={styles.actionRow}>
                                    {canManageQueue && entry.status === 'waiting' && (
                                        <>
                                            <button type="button" className={styles.actionButton} onClick={() => onCall(entry)}>
                                                <MdOutlineQueuePlayNext /> Call
                                            </button>
                                            <button type="button" className={styles.actionButton} onClick={() => onSkip(entry)}>
                                                <FaForward /> Skip
                                            </button>
                                        </>
                                    )}
                                    {canManageQueue && entry.status === 'serving' && (
                                        <button type="button" className={`${styles.actionButton} ${styles.successAction}`} onClick={() => onDone(entry)}>
                                            <FaCheckCircle /> Done
                                        </button>
                                    )}
                                    {canManageQueue && entry.status !== 'done' && (
                                        <button type="button" className={`${styles.iconButton} ${styles.dangerIconButton}`} onClick={() => onRemove(entry)}>
                                            <FaTrash />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="9" className={styles.emptyCell}>No walk-ins are in today&apos;s queue.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function AllScheduleTable({
    rows,
    isDentist,
    canManageAppointments,
    canManageGuests,
    canManageQueue,
    onStatusChange,
    onViewPatient,
    onCancel,
    onArchive,
    onConfirmGuest,
    onRegisterGuest,
    onResendGuest,
    onMarkDone,
    onLogMaterials,
    onCall,
    onSkip,
    onDone,
    onRemove,
}) {
    return (
        <div className={`${styles.tableWrapper} ${wideTable.tableWrapper}`}>
            <table className={`${styles.table} ${wideTable.table}`}>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Patient</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Dentist</th>
                        <th>Procedure</th>
                        <th>Branch</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length > 0 ? rows.map((row) => {
                        if (row.type === 'appointment') {
                            const guestMeta = getGuestPreRegistrationMeta(row);
                            return (
                                <tr key={`appointment-${row.id}`}>
                                    <td><span className={`${styles.metaBadge} ${styles.metaBadgeGuest}`}>Appointment</span></td>
                                    <td>
                                        <div className={styles.patientCell}>
                                            <UserAvatar user={{ name: row.patientName, profileImage: row.patientImage }} size={38} />
                                            <div className={styles.patientMeta}>
                                                <span className={styles.patientName}>{row.patientName}</span>
                                                {row.isGuest && <span className={`${styles.metaBadge} ${styles.metaBadgeGuest}`}>Guest</span>}
                                                {guestMeta && (
                                                    <span className={`${styles.metaBadge} ${styles[`metaBadge${guestMeta.tone.charAt(0).toUpperCase()}${guestMeta.tone.slice(1)}`]}`}>
                                                        {guestMeta.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>{formatDateShort(row.rawDate)}</td>
                                    <td>{row.time ? to12h(row.time) : '-'}</td>
                                    <td>{row.dentistName}</td>
                                    <td>{row.procedure}</td>
                                    <td>{row.branch || '-'}</td>
                                    <td>
                                        {canManageAppointments && !row.isGuest ? (
                                            <select
                                                className={`${styles.statusSelect} ${getAppointmentStatusClass(row.status)}`}
                                                value={row.status}
                                                onChange={(event) => onStatusChange(row, event.target.value)}
                                                disabled={row.status === 'Cancelled' || row.status === 'Completed'}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="In Clinic">In Clinic</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        ) : (
                                            <span className={`${styles.statusPill} ${getAppointmentStatusClass(row.status)}`}>{row.status}</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.actionRow}>
                                            {isDentist ? (
                                                <>
                                                    <button type="button" className={styles.actionButton} onClick={() => onViewPatient(row)} disabled={!row.patientId}>
                                                        <FaFileMedical /> View EMR
                                                    </button>
                                                    {(row.rawStatus === 'confirmed' || row.rawStatus === 'pending') && (
                                                        <button type="button" className={`${styles.actionButton} ${styles.successAction}`} onClick={() => onMarkDone(row)}>
                                                            <FaCheckCircle /> Mark Done
                                                        </button>
                                                    )}
                                                    {(row.rawStatus === 'completed' || row.rawStatus === 'done') && (
                                                        <button type="button" className={styles.actionButton} onClick={() => onLogMaterials(row)}>
                                                            <FaBoxOpen /> Log Materials
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <button type="button" className={styles.actionButton} onClick={() => onViewPatient(row)} disabled={!row.patientId}>
                                                        <FaFileMedical /> View Patient
                                                    </button>
                                                    {canManageGuests && row.isGuest && row.rawStatus === 'pending' && (
                                                        <button type="button" className={`${styles.actionButton} ${styles.primaryAction}`} onClick={() => onConfirmGuest(row)}>
                                                            Confirm Request
                                                        </button>
                                                    )}
                                                    {canManageGuests && row.isGuest && row.rawStatus === 'confirmed' && guestMeta?.label === 'Ready to Register' && (
                                                        <button type="button" className={`${styles.actionButton} ${styles.primaryAction}`} onClick={() => onRegisterGuest(row)}>
                                                            Register Guest
                                                        </button>
                                                    )}
                                                    {canManageGuests && row.isGuest && row.rawStatus === 'confirmed' && guestMeta?.label !== 'Ready to Register' && (
                                                        <button type="button" className={styles.actionButton} onClick={() => onResendGuest(row)}>
                                                            Resend Link
                                                        </button>
                                                    )}
                                                    {canManageAppointments && (
                                                        <>
                                                            <button type="button" className={`${styles.iconButton} ${styles.warnIconButton}`} onClick={() => onCancel(row)} disabled={row.status === 'Cancelled' || row.status === 'Completed'}>
                                                                <FaTimes />
                                                            </button>
                                                            <button type="button" className={`${styles.iconButton} ${styles.dangerIconButton}`} onClick={() => onArchive(row)}>
                                                                <FaTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={`walkin-${row.id}`}>
                                <td><span className={`${styles.metaBadge} ${styles.metaBadgeWarning}`}>Walk-In</span></td>
                                <td>{row.patientName}</td>
                                <td>{formatDateShort(row.rawDate)}</td>
                                <td>{row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td>{row.assignedDentist}</td>
                                <td>{row.procedure}</td>
                                <td>{row.branch || '-'}</td>
                                <td><span className={`${styles.statusPill} ${getQueueStatusClass(row.status)}`}>{row.status}</span></td>
                                <td>
                                    <div className={styles.actionRow}>
                                        {canManageQueue && row.status === 'waiting' && (
                                            <>
                                                <button type="button" className={styles.actionButton} onClick={() => onCall(row)}>
                                                    <MdOutlineQueuePlayNext /> Call
                                                </button>
                                                <button type="button" className={styles.actionButton} onClick={() => onSkip(row)}>
                                                    <FaForward /> Skip
                                                </button>
                                            </>
                                        )}
                                        {canManageQueue && row.status === 'serving' && (
                                            <button type="button" className={`${styles.actionButton} ${styles.successAction}`} onClick={() => onDone(row)}>
                                                <FaCheckCircle /> Done
                                            </button>
                                        )}
                                        {canManageQueue && row.status !== 'done' && (
                                            <button type="button" className={`${styles.iconButton} ${styles.dangerIconButton}`} onClick={() => onRemove(row)}>
                                                <FaTrash />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr>
                            <td colSpan="9" className={styles.emptyCell}>No schedule items match the current filters.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function SchedulePagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;
    return (
        <div className={styles.pagination}>
            <button type="button" className={styles.pageButton} disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
                Previous
            </button>
            <span className={styles.pageSummary}>Page {currentPage} of {totalPages}</span>
            <button type="button" className={styles.pageButton} disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
                Next
            </button>
        </div>
    );
}

export default function SchedulePage() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const role = user?.role || '';
    const currentUserId = user?.userId || user?.id || user?._id || '';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';

    const isAdminLike = role === 'administrator' || role === 'co-administrator';
    const isBranchManager = role === 'branch-manager';
    const isSecretary = role === 'secretary';
    const isOwner = role === 'owner';
    const isDentist = role === 'dentist';
    const canManageAppointments = isAdminLike || isBranchManager || isSecretary;
    const canManageQueue = isAdminLike || isBranchManager || isSecretary;
    const canBookAppointment = canManageAppointments;
    const canAddWalkIns = canManageQueue;
    const canManageGuests = isAdminLike || isBranchManager;

    const patientRouteBase = isSecretary
        ? '/secretary/patients'
        : isBranchManager
            ? '/branch-manager/patients'
            : isOwner
                ? '/owner/patients'
                : '/admin/patients';

    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [activeTypeTab, setActiveTypeTab] = useState('all');
    const [activeStatusFilter, setActiveStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [appointments, setAppointments] = useState([]);
    const [queueEntries, setQueueEntries] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [queueLoading, setQueueLoading] = useState(false);

    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingForm, setBookingForm] = useState({ ...initialBookingForm, branch: assignedBranch || '' });
    const [bookingErrors, setBookingErrors] = useState({});
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');

    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
    const [walkInForm, setWalkInForm] = useState({ ...initialWalkInForm, branch: assignedBranch || '' });
    const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);

    const [statusChangeTarget, setStatusChangeTarget] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [queueActionTarget, setQueueActionTarget] = useState(null);
    const [guestRegistrationTarget, setGuestRegistrationTarget] = useState(null);

    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedAppointmentForMaterial, setSelectedAppointmentForMaterial] = useState(null);
    const [completeTarget, setCompleteTarget] = useState(null);

    const queueTabsAvailable = canManageQueue;
    const tabConfig = useMemo(() => {
        const tabs = [
            { key: 'all', label: 'All' },
            { key: 'appointments', label: 'Appointments' },
        ];
        if (queueTabsAvailable) {
            tabs.push({ key: 'walk-ins', label: 'Walk-ins' });
        }
        return tabs;
    }, [queueTabsAvailable]);

    useEffect(() => {
        if (!queueTabsAvailable && activeTypeTab === 'walk-ins') {
            setActiveTypeTab('all');
        }
    }, [activeTypeTab, queueTabsAvailable]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate, activeTypeTab, activeStatusFilter, searchQuery]);

    useEffect(() => {
        const statusOptions = activeTypeTab === 'appointments'
            ? APPOINTMENT_STATUS_OPTIONS
            : activeTypeTab === 'walk-ins'
                ? QUEUE_STATUS_OPTIONS
                : (queueTabsAvailable ? ALL_STATUS_OPTIONS : APPOINTMENT_STATUS_OPTIONS);

        if (!statusOptions.includes(activeStatusFilter)) {
            setActiveStatusFilter('all');
        }
    }, [activeStatusFilter, activeTypeTab, queueTabsAvailable]);

    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const endpoint = isDentist && currentUserId
                ? `/appointments?dentistId=${currentUserId}`
                : '/appointments';
            const response = await authFetch(endpoint);
            if (!response.ok) throw new Error('Failed to load appointments.');
            const data = await response.json();
            const normalized = Array.isArray(data) ? data.map(normalizeAppointment) : [];
            setAppointments(normalized.sort((a, b) => a.rawDate - b.rawDate));
        } catch (error) {
            addToast(error.message || 'Failed to load appointments.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, currentUserId, isDentist]);

    const fetchQueue = useCallback(async (silent = false) => {
        if (!canManageQueue) {
            setQueueEntries([]);
            return;
        }
        if (!silent) setQueueLoading(true);
        try {
            const response = await authFetch('/queue');
            if (!response.ok) throw new Error('Failed to load queue.');
            const data = await response.json();
            const normalized = Array.isArray(data) ? data.map(normalizeQueueEntry) : [];
            setQueueEntries(normalized.sort((a, b) => (a.ticketNumber || 0) - (b.ticketNumber || 0)));
        } catch (error) {
            if (!silent) addToast(error.message || 'Failed to load queue.', 'error');
        } finally {
            setQueueLoading(false);
        }
    }, [addToast, canManageQueue]);

    const fetchLookupData = useCallback(async () => {
        if (!canBookAppointment && !canAddWalkIns) return;
        try {
            const requests = [authFetch('/users?role=dentist')];
            if (canBookAppointment) {
                requests.unshift(authFetch('/patients'));
            }
            if (isAdminLike) {
                requests.push(authFetch('/branches?all=true'));
            }

            const responses = await Promise.all(requests);
            let offset = 0;

            if (canBookAppointment) {
                const patientsRes = responses[offset];
                offset += 1;
                if (patientsRes.ok) {
                    const patientPayload = await patientsRes.json();
                    setPatients(extractPatients(patientPayload).filter((entry) => entry.status === 'active'));
                }
            }

            const dentistsRes = responses[offset];
            offset += 1;
            if (dentistsRes.ok) {
                const dentistPayload = await dentistsRes.json();
                setDentists(dentistPayload.filter((entry) => entry.status === 'active' && !entry.isArchived));
            }

            if (isAdminLike) {
                const branchesRes = responses[offset];
                if (branchesRes?.ok) {
                    setBranches(await branchesRes.json());
                }
            } else if (assignedBranch) {
                setBranches([{ _id: assignedBranch, name: assignedBranch }]);
            }
        } catch {
            addToast('Failed to load booking options.', 'error');
        }
    }, [addToast, assignedBranch, canAddWalkIns, canBookAppointment, isAdminLike]);

    useEffect(() => {
        fetchAppointments();
        fetchQueue();
        fetchLookupData();
    }, [fetchAppointments, fetchLookupData, fetchQueue]);

    useEffect(() => {
        if (!canManageQueue) return undefined;
        const interval = setInterval(() => {
            fetchQueue(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [canManageQueue, fetchQueue]);

    useEffect(() => {
        const selectedBranch = bookingForm.branch || assignedBranch;
        if (!bookingForm.date || !selectedBranch || !canBookAppointment) {
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
    }, [assignedBranch, bookingForm.branch, bookingForm.date, canBookAppointment]);

    const visibleSlots = useMemo(
        () => allowedSlots.filter((slot) => !takenSlots.includes(slot) && !isSlotPast(slot, bookingForm.date)),
        [allowedSlots, bookingForm.date, takenSlots]
    );

    const branchOptions = useMemo(() => {
        if (!isAdminLike) return assignedBranch ? [assignedBranch] : [];
        return [...new Set(branches.map((branch) => branch.name).filter(Boolean))].sort();
    }, [assignedBranch, branches, isAdminLike]);

    const todayQueueEntries = useMemo(() => {
        const branchScopedEntries = (!isBranchManager && !isSecretary) || !assignedBranch
            ? queueEntries
            : queueEntries.filter((entry) => !entry.branch || entry.branch === assignedBranch);
        return branchScopedEntries.filter((entry) => isSameDate(entry.createdAt || entry.rawDate, getTodayString()));
    }, [assignedBranch, isBranchManager, isSecretary, queueEntries]);

    const visibleAppointments = useMemo(() => {
        const scopedAppointments = (!isBranchManager && !isSecretary) || !assignedBranch
            ? appointments
            : appointments.filter((appointment) => !appointment.branch || appointment.branch === assignedBranch);
        return scopedAppointments.filter((appointment) => isSameDate(appointment.rawDate, selectedDate));
    }, [appointments, assignedBranch, isBranchManager, isSecretary, selectedDate]);

    const allRows = useMemo(() => {
        const merged = [
            ...visibleAppointments,
            ...todayQueueEntries,
        ];
        return merged.sort((a, b) => {
            const left = a.type === 'walk-in' ? (a.createdAt || a.rawDate) : `${selectedDate}T${a.time || '00:00'}`;
            const right = b.type === 'walk-in' ? (b.createdAt || b.rawDate) : `${selectedDate}T${b.time || '00:00'}`;
            return new Date(left) - new Date(right);
        });
    }, [selectedDate, todayQueueEntries, visibleAppointments]);

    const statusOptions = activeTypeTab === 'appointments'
        ? APPOINTMENT_STATUS_OPTIONS
        : activeTypeTab === 'walk-ins'
            ? QUEUE_STATUS_OPTIONS
            : (queueTabsAvailable ? ALL_STATUS_OPTIONS : APPOINTMENT_STATUS_OPTIONS);

    const dataset = useMemo(() => {
        const baseRows = activeTypeTab === 'appointments'
            ? visibleAppointments
            : activeTypeTab === 'walk-ins'
                ? todayQueueEntries
                : allRows;

        const searchLower = searchQuery.trim().toLowerCase();
        return baseRows.filter((row) => {
            const matchesSearch = !searchLower || [
                row.patientName,
                row.procedure,
                row.type === 'appointment' ? row.dentistName : row.assignedDentist,
            ].filter(Boolean).some((value) => value.toLowerCase().includes(searchLower));

            if (!matchesSearch) return false;

            if (activeStatusFilter === 'all') return true;

            if (row.type === 'appointment') {
                return row.rawStatus === activeStatusFilter;
            }

            return row.status === activeStatusFilter;
        });
    }, [activeStatusFilter, activeTypeTab, allRows, searchQuery, todayQueueEntries, visibleAppointments]);

    const totalPages = Math.max(1, Math.ceil(dataset.length / pageSize));
    const pagedRows = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return dataset.slice(start, start + pageSize);
    }, [currentPage, dataset]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const tabCounts = useMemo(() => ({
        all: allRows.length,
        appointments: visibleAppointments.length,
        'walk-ins': todayQueueEntries.length,
    }), [allRows.length, todayQueueEntries.length, visibleAppointments.length]);

    const appointmentRows = pagedRows.filter((row) => row.type === 'appointment');
    const walkInRows = pagedRows.filter((row) => row.type === 'walk-in');

    const resetBookingModal = () => {
        setBookingForm({ ...initialBookingForm, branch: assignedBranch || '' });
        setBookingErrors({});
        setAllowedSlots([]);
        setTakenSlots([]);
        setSlotsError('');
    };

    const resetWalkInModal = () => {
        setWalkInForm({ ...initialWalkInForm, branch: assignedBranch || '' });
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
            setBookingErrors((prev) => ({ ...prev, time: '' }));
        }
    };

    const validateBookingForm = () => {
        const nextErrors = {};
        const finalBranch = isAdminLike ? bookingForm.branch : assignedBranch;

        if (!bookingForm.patientId) nextErrors.patientId = 'Select a patient.';
        if (!bookingForm.dentistId) nextErrors.dentistId = 'Select a dentist.';
        if (!bookingForm.date) nextErrors.date = 'Choose an appointment date.';
        if (!bookingForm.time || !visibleSlots.includes(bookingForm.time)) nextErrors.time = 'Choose an available time slot.';
        if (!bookingForm.procedure) nextErrors.procedure = 'Select a procedure.';
        if (!finalBranch) nextErrors.branch = 'Select a branch.';

        setBookingErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleBookAppointment = async (event) => {
        event.preventDefault();
        if (!validateBookingForm()) return;

        const finalBranch = isAdminLike ? bookingForm.branch : assignedBranch;
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
                    branch: finalBranch,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Booking failed.');
            }
            addToast('Appointment successfully booked!', 'success');
            setIsBookingModalOpen(false);
            resetBookingModal();
            await fetchAppointments(true);
        } catch (error) {
            addToast(error.message || 'Failed to book appointment.', 'error');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const handleWalkInSubmit = async (event) => {
        event.preventDefault();
        if (!walkInForm.patientName.trim()) {
            addToast('Patient name is required.', 'error');
            return;
        }
        if (walkInForm.contactNumber && !/^09\d{9}$/.test(walkInForm.contactNumber)) {
            addToast('Contact number must follow the 09XXXXXXXXX format.', 'error');
            return;
        }

        const payload = {
            patientName: walkInForm.patientName,
            contactNumber: walkInForm.contactNumber,
            procedureType: walkInForm.procedureType,
            assignedDentist: walkInForm.assignedDentist,
        };

        const finalBranch = isAdminLike ? walkInForm.branch : assignedBranch;
        if (finalBranch) payload.branch = finalBranch;
        if (isAdminLike && !finalBranch) {
            addToast('Please select a branch.', 'error');
            return;
        }

        setIsSubmittingWalkIn(true);
        try {
            const response = await authFetch('/queue', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Failed to add walk-in.');
            }
            addToast(`Ticket #${String(data.ticketNumber).padStart(3, '0')} created for ${data.patientName}.`, 'success');
            setIsWalkInModalOpen(false);
            resetWalkInModal();
            await fetchQueue(true);
        } catch (error) {
            addToast(error.message || 'Failed to add walk-in.', 'error');
        } finally {
            setIsSubmittingWalkIn(false);
        }
    };

    const handleQueueAction = async (entry, nextStatus) => {
        try {
            const response = await authFetch(`/queue/${entry.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to update queue status.');
            }
            const updated = await response.json();
            setQueueEntries((prev) => prev.map((item) => (item.id === entry.id ? normalizeQueueEntry(updated) : item)));
            const labels = { serving: 'called in', done: 'marked as done', skipped: 'skipped' };
            addToast(`Ticket #${String(entry.ticketNumber).padStart(3, '0')} ${labels[nextStatus] || 'updated'}.`, 'success');
        } catch (error) {
            addToast(error.message || 'Failed to update queue status.', 'error');
        } finally {
            setQueueActionTarget(null);
        }
    };

    const handleQueueRemove = async (entry) => {
        try {
            const response = await authFetch(`/queue/${entry.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to remove entry.');
            setQueueEntries((prev) => prev.filter((item) => item.id !== entry.id));
            addToast(`Ticket #${String(entry.ticketNumber).padStart(3, '0')} removed from queue.`, 'success');
        } catch (error) {
            addToast(error.message || 'Failed to remove entry.', 'error');
        } finally {
            setQueueActionTarget(null);
        }
    };

    const handleAppointmentStatusChange = (appointment, nextStatus) => {
        if (appointment.status === nextStatus) return;
        setStatusChangeTarget({ appointment, nextStatus });
    };

    const confirmAppointmentStatusChange = async () => {
        if (!statusChangeTarget) return;
        const { appointment, nextStatus } = statusChangeTarget;
        try {
            const response = await authFetch(`/appointments/${appointment.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: nextStatus.toLowerCase().replace(/\s+/g, '-') }),
            });
            if (!response.ok) throw new Error('Failed to update appointment status.');
            setAppointments((prev) => prev.map((item) => (
                item.id === appointment.id
                    ? { ...item, status: nextStatus, rawStatus: nextStatus.toLowerCase().replace(/\s+/g, '-') }
                    : item
            )));
            addToast(`${appointment.patientName}'s appointment updated to ${nextStatus}.`, 'success');
        } catch (error) {
            addToast(error.message || 'Failed to update appointment status.', 'error');
        } finally {
            setStatusChangeTarget(null);
        }
    };

    const confirmCancelAppointment = async () => {
        if (!cancelTarget) return;
        try {
            const response = await authFetch(`/appointments/${cancelTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!response.ok) throw new Error('Failed to cancel appointment.');
            setAppointments((prev) => prev.map((item) => (
                item.id === cancelTarget.id ? { ...item, status: 'Cancelled', rawStatus: 'cancelled' } : item
            )));
            addToast(
                cancelTarget.isGuest
                    ? `${cancelTarget.patientName}'s guest request has been declined.`
                    : `${cancelTarget.patientName}'s appointment has been cancelled.`,
                'info'
            );
        } catch (error) {
            addToast(error.message || 'Failed to cancel appointment.', 'error');
        } finally {
            setCancelTarget(null);
        }
    };

    const confirmArchiveAppointment = async () => {
        if (!archiveTarget) return;
        try {
            const response = await authFetch(`/appointments/${archiveTarget.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to archive appointment.');
            setAppointments((prev) => prev.filter((item) => item.id !== archiveTarget.id));
            addToast('Appointment archived successfully.', 'success');
        } catch (error) {
            addToast(error.message || 'Failed to archive appointment.', 'error');
        } finally {
            setArchiveTarget(null);
        }
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

    const handleViewPatient = (appointment) => {
        if (!appointment.patientId) return;
        if (isDentist) {
            setSelectedPatientId(appointment.patientId);
            setIsEMRModalOpen(true);
            return;
        }
        if (isSecretary) {
            navigate(`/secretary/patients/${appointment.patientId}`);
            return;
        }
        navigate(`${patientRouteBase}/${appointment.patientId}/emr`);
    };

    const handleMarkDone = async () => {
        if (!completeTarget) return;
        try {
            const response = await authFetch(`/appointments/${completeTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'completed' }),
            });
            if (!response.ok) throw new Error('Failed to mark appointment as completed.');
            setAppointments((prev) => prev.map((item) => (
                item.id === completeTarget.id
                    ? { ...item, status: 'Completed', rawStatus: 'completed' }
                    : item
            )));
            addToast(`${completeTarget.patientName}'s appointment marked as completed.`, 'success');
        } catch (error) {
            addToast(error.message || 'Failed to update appointment.', 'error');
        } finally {
            setCompleteTarget(null);
        }
    };

    return (
        <>
            <main className={styles.page}>
                <header className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Schedule</h1>
                        <p className={styles.pageSubtitle}>
                            {isDentist
                                ? 'Review your appointments for the selected day in one table-first schedule.'
                                : 'Monitor appointments and today&apos;s queue from one shared schedule page.'}
                        </p>
                    </div>

                    <div className={styles.headerActions}>
                        {canManageQueue && (
                            <button type="button" className={styles.secondaryButton} onClick={() => fetchQueue()} title="Refresh today&apos;s queue">
                                <FaSyncAlt /> Refresh Queue
                            </button>
                        )}
                        {canBookAppointment && (
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => {
                                    resetBookingModal();
                                    setIsBookingModalOpen(true);
                                }}
                            >
                                <FaPlus /> Book Appointment
                            </button>
                        )}
                        {canAddWalkIns && (
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => {
                                    resetWalkInModal();
                                    setIsWalkInModalOpen(true);
                                }}
                            >
                                <FaUserPlus /> New Walk-In
                            </button>
                        )}
                    </div>
                </header>

                <div className={styles.tabRow}>
                    {tabConfig.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`${styles.tabButton} ${activeTypeTab === tab.key ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTypeTab(tab.key)}
                        >
                            {tab.label}
                            <span className={styles.tabCount}>{tabCounts[tab.key] || 0}</span>
                        </button>
                    ))}
                </div>

                <ScheduleFilters
                    activeTypeTab={activeTypeTab}
                    activeStatusFilter={activeStatusFilter}
                    selectedDate={selectedDate}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onDateChange={setSelectedDate}
                    onStatusChange={setActiveStatusFilter}
                    statusOptions={statusOptions}
                />

                {queueTabsAvailable && selectedDate !== getTodayString() && activeTypeTab !== 'appointments' && (
                    <p className={styles.queueNote}>
                        Walk-ins always reflect today&apos;s queue even when you change the appointment date.
                    </p>
                )}

                {(loading || (queueLoading && activeTypeTab !== 'appointments')) ? (
                    <div className={styles.stateCard}>Loading schedule...</div>
                ) : (
                    <div className={styles.tableCard}>
                        {activeTypeTab === 'walk-ins' ? (
                            <WalkInsTable
                                entries={walkInRows}
                                canManageQueue={canManageQueue}
                                onCall={(entry) => setQueueActionTarget({ kind: 'serving', entry })}
                                onSkip={(entry) => setQueueActionTarget({ kind: 'skipped', entry })}
                                onDone={(entry) => setQueueActionTarget({ kind: 'done', entry })}
                                onRemove={(entry) => setQueueActionTarget({ kind: 'remove', entry })}
                            />
                        ) : activeTypeTab === 'appointments' ? (
                            <AppointmentsTable
                                appointments={appointmentRows}
                                isDentist={isDentist}
                                canManageAppointments={canManageAppointments}
                                canManageGuests={canManageGuests}
                                patientRouteBase={patientRouteBase}
                                onStatusChange={handleAppointmentStatusChange}
                                onViewPatient={handleViewPatient}
                                onCancel={setCancelTarget}
                                onArchive={setArchiveTarget}
                                onConfirmGuest={handleConfirmGuestAppointment}
                                onRegisterGuest={setGuestRegistrationTarget}
                                onResendGuest={handleResendPreRegistration}
                                onMarkDone={setCompleteTarget}
                                onLogMaterials={setSelectedAppointmentForMaterial}
                            />
                        ) : (
                            <AllScheduleTable
                                rows={pagedRows}
                                isDentist={isDentist}
                                canManageAppointments={canManageAppointments}
                                canManageGuests={canManageGuests}
                                canManageQueue={canManageQueue}
                                onStatusChange={handleAppointmentStatusChange}
                                onViewPatient={handleViewPatient}
                                onCancel={setCancelTarget}
                                onArchive={setArchiveTarget}
                                onConfirmGuest={handleConfirmGuestAppointment}
                                onRegisterGuest={setGuestRegistrationTarget}
                                onResendGuest={handleResendPreRegistration}
                                onMarkDone={setCompleteTarget}
                                onLogMaterials={setSelectedAppointmentForMaterial}
                                onCall={(entry) => setQueueActionTarget({ kind: 'serving', entry })}
                                onSkip={(entry) => setQueueActionTarget({ kind: 'skipped', entry })}
                                onDone={(entry) => setQueueActionTarget({ kind: 'done', entry })}
                                onRemove={(entry) => setQueueActionTarget({ kind: 'remove', entry })}
                            />
                        )}

                        <SchedulePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </main>

            {isBookingModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '620px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>Book New Appointment</h2>
                            <button
                                type="button"
                                className={modalStyles.closeButton}
                                onClick={() => {
                                    setIsBookingModalOpen(false);
                                    resetBookingModal();
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleBookAppointment} className={modalStyles.modalBody}>
                            {isAdminLike && (
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Branch <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        name="branch"
                                        className={modalStyles.formInput}
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
                                    value={bookingForm.patientId}
                                    onChange={handleBookingChange}
                                    disabled={isSubmittingBooking}
                                >
                                    <option value="" disabled hidden>-- Choose a Patient --</option>
                                    {patients.map((patient) => (
                                        <option key={patient._id} value={patient._id}>
                                            {patient.name?.first ? `${patient.name.first} ${patient.name.last}`.trim() : patient.email || 'Unknown'}
                                        </option>
                                    ))}
                                </select>
                                {bookingErrors.patientId && <span className={modalStyles.errorMessage}>{bookingErrors.patientId}</span>}
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Assigned Dentist <span style={{ color: 'red' }}>*</span></label>
                                <select
                                    name="dentistId"
                                    className={modalStyles.formInput}
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

                            <div className={styles.modalGrid}>
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Date <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={modalStyles.formInput}
                                        value={bookingForm.date}
                                        onChange={handleBookingChange}
                                        min={getTodayString()}
                                        disabled={isSubmittingBooking}
                                    />
                                    {bookingErrors.date && <span className={modalStyles.errorMessage}>{bookingErrors.date}</span>}
                                </div>

                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Procedure <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        name="procedure"
                                        className={modalStyles.formInput}
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
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Preferred Time <span style={{ color: 'red' }}>*</span></label>
                                {!bookingForm.date || (!assignedBranch && isAdminLike && !bookingForm.branch) ? (
                                    <p className={styles.inlineInfo}>Select a branch and date first to view available time slots.</p>
                                ) : loadingSlots ? (
                                    <p className={styles.inlineInfo}>Loading available time slots...</p>
                                ) : slotsError ? (
                                    <p className={styles.inlineError}>{slotsError}</p>
                                ) : visibleSlots.length === 0 ? (
                                    <p className={styles.inlineInfo}>No available slots for the selected date.</p>
                                ) : (
                                    <div className={styles.slotList}>
                                        {visibleSlots.map((slot) => {
                                            const isSelected = bookingForm.time === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    className={`${styles.slotButton} ${isSelected ? styles.slotButtonActive : ''}`}
                                                    onClick={() => setBookingForm((prev) => ({ ...prev, time: slot }))}
                                                >
                                                    <FaClock /> {to12h(slot)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {bookingErrors.time && <span className={modalStyles.errorMessage}>{bookingErrors.time}</span>}
                            </div>

                            {(!assignedBranch && !isAdminLike) && (
                                <div className={modalStyles.errorMessage}>
                                    This account does not have an assigned branch yet, so booking is unavailable.
                                </div>
                            )}

                            <div className={modalStyles.formActions}>
                                <button
                                    type="button"
                                    className={modalStyles.cancelBtn}
                                    onClick={() => {
                                        setIsBookingModalOpen(false);
                                        resetBookingModal();
                                    }}
                                    disabled={isSubmittingBooking}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={modalStyles.submitBtn}
                                    disabled={isSubmittingBooking || (!assignedBranch && !isAdminLike)}
                                >
                                    {isSubmittingBooking ? 'Booking...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isWalkInModalOpen && (
                <div className={modalStyles.modalOverlay}>
                    <div className={modalStyles.modalContent} style={{ maxWidth: '560px' }}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>New Walk-In Patient</h2>
                            <button type="button" className={modalStyles.closeButton} onClick={() => setIsWalkInModalOpen(false)}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className={modalStyles.modalBody}>
                            {isAdminLike && (
                                <div className={modalStyles.formGroup}>
                                    <label className={modalStyles.formLabel}>Branch <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        name="branch"
                                        className={modalStyles.formInput}
                                        value={walkInForm.branch}
                                        onChange={(event) => setWalkInForm((prev) => ({ ...prev, branch: event.target.value }))}
                                        disabled={isSubmittingWalkIn}
                                    >
                                        <option value="" disabled hidden>-- Choose a Branch --</option>
                                        {branchOptions.map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Patient Name <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    name="patientName"
                                    className={modalStyles.formInput}
                                    value={walkInForm.patientName}
                                    onChange={(event) => setWalkInForm((prev) => ({ ...prev, patientName: event.target.value }))}
                                    placeholder="e.g. Juan Dela Cruz"
                                    disabled={isSubmittingWalkIn}
                                />
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Contact Number</label>
                                <input
                                    name="contactNumber"
                                    className={modalStyles.formInput}
                                    value={walkInForm.contactNumber}
                                    onChange={(event) => setWalkInForm((prev) => ({
                                        ...prev,
                                        contactNumber: event.target.value.replace(/[^0-9]/g, '').slice(0, 11),
                                    }))}
                                    placeholder="e.g. 09123456789"
                                    disabled={isSubmittingWalkIn}
                                />
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Procedure / Concern</label>
                                <select
                                    name="procedureType"
                                    className={modalStyles.formInput}
                                    value={walkInForm.procedureType}
                                    onChange={(event) => setWalkInForm((prev) => ({ ...prev, procedureType: event.target.value }))}
                                    disabled={isSubmittingWalkIn}
                                >
                                    <option value="">- Select or leave blank -</option>
                                    {PROCEDURE_OPTIONS.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={modalStyles.formGroup}>
                                <label className={modalStyles.formLabel}>Assign Dentist</label>
                                <select
                                    name="assignedDentist"
                                    className={modalStyles.formInput}
                                    value={walkInForm.assignedDentist}
                                    onChange={(event) => setWalkInForm((prev) => ({ ...prev, assignedDentist: event.target.value }))}
                                    disabled={isSubmittingWalkIn}
                                >
                                    <option value="">- Select a dentist -</option>
                                    {dentists.map((dentist) => (
                                        <option key={dentist._id} value={`${dentist.name?.first} ${dentist.name?.last}`}>
                                            Dr. {dentist.name?.first} {dentist.name?.last}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={modalStyles.formActions}>
                                <button type="button" className={modalStyles.cancelBtn} onClick={() => setIsWalkInModalOpen(false)} disabled={isSubmittingWalkIn}>
                                    Cancel
                                </button>
                                <button type="submit" className={modalStyles.submitBtn} disabled={isSubmittingWalkIn}>
                                    {isSubmittingWalkIn ? 'Adding...' : 'Add to Queue'}
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
                    onSuccess={async () => {
                        setGuestRegistrationTarget(null);
                        await fetchAppointments(true);
                    }}
                />
            )}

            {isEMRModalOpen && selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => {
                        setIsEMRModalOpen(false);
                        setSelectedPatientId(null);
                    }}
                />
            )}

            {selectedAppointmentForMaterial && (
                <MaterialUsageLog
                    appointment={selectedAppointmentForMaterial}
                    onClose={() => setSelectedAppointmentForMaterial(null)}
                    onSuccess={() => fetchAppointments(true)}
                />
            )}

            <ConfirmModal
                isOpen={!!statusChangeTarget}
                title="Update Appointment Status"
                message={`Are you sure you want to change ${statusChangeTarget?.appointment?.patientName}'s appointment to "${statusChangeTarget?.nextStatus}"?`}
                confirmText="Update Status"
                isDestructive={false}
                onConfirm={confirmAppointmentStatusChange}
                onCancel={() => setStatusChangeTarget(null)}
            />

            <ConfirmModal
                isOpen={!!cancelTarget}
                title={cancelTarget?.isGuest ? 'Decline Guest Request' : 'Cancel Appointment'}
                message={
                    cancelTarget?.isGuest
                        ? `Are you sure you want to decline the guest appointment request for ${cancelTarget?.patientName}?`
                        : `Are you sure you want to cancel the appointment for ${cancelTarget?.patientName}?`
                }
                confirmText={cancelTarget?.isGuest ? 'Yes, Decline Request' : 'Yes, Cancel Appointment'}
                isDestructive={true}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setCancelTarget(null)}
            />

            <ConfirmModal
                isOpen={!!archiveTarget}
                title="Archive Appointment"
                message={`Are you sure you want to archive the appointment for ${archiveTarget?.patientName}?`}
                confirmText="Yes, Archive"
                isDestructive={true}
                onConfirm={confirmArchiveAppointment}
                onCancel={() => setArchiveTarget(null)}
            />

            <ConfirmModal
                isOpen={!!queueActionTarget}
                title={queueActionTarget?.kind === 'remove' ? 'Remove from Queue' : 'Update Queue Status'}
                message={
                    queueActionTarget?.kind === 'remove'
                        ? `Remove Ticket #${String(queueActionTarget?.entry?.ticketNumber || 0).padStart(3, '0')} from the queue?`
                        : `Are you sure you want to update Ticket #${String(queueActionTarget?.entry?.ticketNumber || 0).padStart(3, '0')}?`
                }
                confirmText={queueActionTarget?.kind === 'remove' ? 'Yes, Remove' : 'Confirm'}
                isDestructive={queueActionTarget?.kind === 'remove'}
                onConfirm={() => {
                    if (!queueActionTarget) return;
                    if (queueActionTarget.kind === 'remove') {
                        handleQueueRemove(queueActionTarget.entry);
                        return;
                    }
                    handleQueueAction(queueActionTarget.entry, queueActionTarget.kind);
                }}
                onCancel={() => setQueueActionTarget(null)}
            />

            <ConfirmModal
                isOpen={!!completeTarget}
                title="Mark Appointment as Completed"
                message={`Mark ${completeTarget?.patientName}'s appointment (${completeTarget?.procedure}) as completed?`}
                confirmText="Yes, Mark Done"
                isDestructive={false}
                onConfirm={handleMarkDone}
                onCancel={() => setCompleteTarget(null)}
            />
        </>
    );
}
