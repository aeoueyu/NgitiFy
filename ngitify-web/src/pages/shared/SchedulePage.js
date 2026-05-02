import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FaEdit,
    FaEye,
    FaFilter,
    FaPlus,
    FaSearch,
    FaTimes,
    FaTrashAlt,
    FaUserClock,
} from 'react-icons/fa';
import { authFetch, publicFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import PatientEMR from '../admin/PatientEMR';
import wideTable from '../../styles/wideTable.module.css';
import styles from '../../styles/shared/SchedulePage.module.css';

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

const APPOINTMENT_STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    'in-clinic': 'In Clinic',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const QUEUE_STATUS_LABELS = {
    waiting: 'Waiting',
    serving: 'Serving',
    done: 'Done',
    skipped: 'Skipped',
};

const APPOINTMENT_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in-clinic', label: 'In Clinic' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const QUEUE_STATUS_OPTIONS = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'serving', label: 'Serving' },
    { value: 'done', label: 'Done' },
    { value: 'skipped', label: 'Skipped' },
];

const APPOINTMENT_SOURCE_OPTIONS = [
    { value: 'Walk-in', label: 'Walk-in' },
    { value: 'Phone Call', label: 'Phone Call' },
    { value: 'Smile Hub (Online)', label: 'Online Request' },
];

const DATE_FILTER_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 Days' },
    { value: '7days', label: '7 Days' },
    { value: 'custom', label: 'Custom' },
];

const getTodayString = () => new Date().toISOString().split('T')[0];

const addDaysToDateString = (dateString, daysToAdd) => {
    const baseDate = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(baseDate.getTime())) return dateString;
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    return baseDate.toISOString().split('T')[0];
};

const formatDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const formatDateLabel = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatDateTimeLabel = (dateValue, timeValue) => {
    if (!dateValue) return '-';
    const dateLabel = formatDateLabel(dateValue);
    return timeValue ? `${dateLabel} • ${to12h(timeValue)}` : dateLabel;
};

const formatCreatedAt = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    if (Number.isNaN(hour)) return time24;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const compareTime = (left = '', right = '') => {
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right);
};

const normalizePatientName = (patient) => {
    if (patient?.name?.first) {
        return `${patient.name.first} ${patient.name.last || ''}`.trim();
    }
    if (patient?.firstName) {
        return `${patient.firstName} ${patient.lastName || ''}`.trim();
    }
    if (typeof patient?.name === 'string') {
        return patient.name;
    }
    return '';
};

const normalizeAppointment = (appointment) => ({
    id: appointment._id || appointment.id,
    type: 'appointment',
    patientId: appointment.patient?._id || appointment.patient || '',
    patientName: normalizePatientName(appointment.patient) || appointment.guestName || 'Unknown Patient',
    dentistId: appointment.dentist?._id || appointment.dentist || '',
    dentistName: appointment.dentist?.name
        ? `Dr. ${appointment.dentist.name.first} ${appointment.dentist.name.last}`.trim()
        : 'Unassigned',
    date: formatDateInput(appointment.date),
    time: appointment.time || '',
    branch: appointment.branch || '',
    procedure: appointment.procedure || '',
    notes: appointment.notes || '',
    status: appointment.status || 'pending',
    statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status] || 'Pending',
    createdAt: appointment.createdAt || appointment.updatedAt || appointment.date,
    source: appointment.source || 'Walk-in',
    prioritySort: 1,
    raw: appointment,
});

const normalizeQueueEntry = (entry) => ({
    id: entry._id || entry.id,
    type: 'walkin',
    patientId: entry.patientId || '',
    patientName: entry.patientName || 'Walk-in Patient',
    dentistName: entry.assignedDentist || 'Unassigned',
    date: getTodayString(),
    time: '',
    branch: entry.branch || '',
    procedure: entry.procedureType || '',
    notes: '',
    status: entry.status || 'waiting',
    statusLabel: QUEUE_STATUS_LABELS[entry.status] || 'Waiting',
    createdAt: entry.createdAt,
    contactNumber: entry.contactNumber || '',
    ticketNumber: entry.ticketNumber || '',
    prioritySort: 2,
    raw: entry,
});

const getBadgeClass = (entry) => {
    if (entry.type === 'walkin') return wideTable.statusGray;
    switch ((entry.status || '').toLowerCase()) {
        case 'confirmed':
        case 'serving':
            return wideTable.statusGreen;
        case 'pending':
        case 'waiting':
            return wideTable.statusAmber;
        case 'completed':
        case 'done':
            return wideTable.statusBlue;
        case 'cancelled':
        case 'skipped':
            return wideTable.statusRed;
        default:
            return wideTable.statusGray;
    }
};

const extractCollection = (payload, fallbackKey) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[fallbackKey])) return payload[fallbackKey];
    return [];
};

const buildInitialForm = ({ assignedBranch, currentUserId, role }) => ({
    formType: 'appointment',
    patientId: '',
    patientName: '',
    dentistId: role === 'dentist' ? currentUserId : '',
    branch: assignedBranch || '',
    date: getTodayString(),
    time: '',
    procedure: '',
    notes: '',
    status: 'pending',
    source: 'Walk-in',
    contactNumber: '',
    assignedDentist: '',
});

export default function SchedulePage() {
    const { user } = useAuth();
    const { addToast } = useToast();

    const role = user?.role || '';
    const currentUserId = user?.userId || user?.id || user?._id || '';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';

    const isAdmin = role === 'administrator';
    const isOwner = role === 'owner';
    const isBranchManager = role === 'branch-manager';
    const isSecretary = role === 'secretary';
    const isDentist = role === 'dentist';

    const canManageQueue = isAdmin || isBranchManager || isSecretary;
    const canCreateSchedule = isAdmin || isOwner || isBranchManager || isSecretary || isDentist;
    const canChooseBranch = isAdmin || isOwner;
    const canChooseDentist = !isDentist;

    const [appointments, setAppointments] = useState([]);
    const [queueEntries, setQueueEntries] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('today');
    const [customDateFrom, setCustomDateFrom] = useState(getTodayString());
    const [customDateTo, setCustomDateTo] = useState(getTodayString());
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const [formState, setFormState] = useState(buildInitialForm({ assignedBranch, currentUserId, role }));
    const [formErrors, setFormErrors] = useState({});
    const [editingEntry, setEditingEntry] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotError, setSlotError] = useState('');

    const [viewEntry, setViewEntry] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);

    const todayString = getTodayString();
    const selectedDateRange = useMemo(() => {
        if (dateFilter === '3days') {
            return { from: todayString, to: addDaysToDateString(todayString, 2) };
        }
        if (dateFilter === '7days') {
            return { from: todayString, to: addDaysToDateString(todayString, 6) };
        }
        if (dateFilter === 'custom') {
            const normalizedFrom = customDateFrom || todayString;
            const normalizedTo = customDateTo || normalizedFrom;
            return normalizedFrom <= normalizedTo
                ? { from: normalizedFrom, to: normalizedTo }
                : { from: normalizedTo, to: normalizedFrom };
        }
        return { from: todayString, to: todayString };
    }, [customDateFrom, customDateTo, dateFilter, todayString]);
    const rangeIncludesToday = selectedDateRange.from <= todayString && selectedDateRange.to >= todayString;

    const resetFormState = useCallback(() => {
        setFormState(buildInitialForm({ assignedBranch, currentUserId, role }));
        setFormErrors({});
        setAllowedSlots([]);
        setTakenSlots([]);
        setSlotError('');
        setEditingEntry(null);
    }, [assignedBranch, currentUserId, role]);

    const fetchPageData = useCallback(async () => {
        setLoading(true);
        try {
            const requests = [
                authFetch(`/appointments?dateFrom=${selectedDateRange.from}&dateTo=${selectedDateRange.to}`),
                authFetch('/patients'),
                authFetch('/users?role=dentist'),
            ];

            if (canManageQueue) {
                requests.push(authFetch('/queue'));
            }

            if (canChooseBranch) {
                requests.push(authFetch('/branches?all=true'));
            }

            const responses = await Promise.all(requests);
            const appointmentsResponse = responses[0];
            const patientsResponse = responses[1];
            const dentistsResponse = responses[2];

            if (appointmentsResponse.ok) {
                const appointmentData = await appointmentsResponse.json();
                setAppointments(extractCollection(appointmentData, 'appointments').map(normalizeAppointment));
            } else {
                throw new Error('Failed to load appointments.');
            }

            if (patientsResponse.ok) {
                const patientPayload = await patientsResponse.json();
                const patientItems = extractCollection(patientPayload, 'patients');
                setPatients(patientItems.filter((entry) => entry.status === 'active'));
            } else {
                setPatients([]);
            }

            if (dentistsResponse.ok) {
                const dentistItems = await dentistsResponse.json();
                const activeDentists = extractCollection(dentistItems, 'users').length
                    ? extractCollection(dentistItems, 'users')
                    : dentistItems;
                setDentists(
                    activeDentists.filter((entry) => entry.status === 'active' && !entry.isArchived)
                );
            } else {
                setDentists([]);
            }

            let nextIndex = 3;
            if (canManageQueue) {
                const queueResponse = responses[nextIndex];
                nextIndex += 1;
                if (queueResponse?.ok) {
                    const queueData = await queueResponse.json();
                    setQueueEntries(extractCollection(queueData, 'entries').map(normalizeQueueEntry));
                } else {
                    setQueueEntries([]);
                }
            } else {
                setQueueEntries([]);
            }

            if (canChooseBranch) {
                const branchResponse = responses[nextIndex];
                if (branchResponse?.ok) {
                    const branchData = await branchResponse.json();
                    setBranches(extractCollection(branchData, 'branches').length
                        ? extractCollection(branchData, 'branches')
                        : branchData);
                } else {
                    setBranches([]);
                }
            } else if (assignedBranch) {
                setBranches([{ _id: assignedBranch, name: assignedBranch }]);
            } else {
                setBranches([]);
            }
        } catch (error) {
            addToast(error.message || 'Failed to load the schedule.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, assignedBranch, canChooseBranch, canManageQueue, selectedDateRange.from, selectedDateRange.to]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    useEffect(() => {
        if (formState.formType !== 'appointment') {
            setAllowedSlots([]);
            setTakenSlots([]);
            setSlotError('');
            return;
        }

        const activeBranch = formState.branch || assignedBranch;
        if (!formState.date || !activeBranch) {
            setAllowedSlots([]);
            setTakenSlots([]);
            setSlotError('');
            return;
        }

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setSlotError('');
            try {
                const response = await publicFetch(
                    `/public/appointments/slots?date=${formState.date}&branch=${encodeURIComponent(activeBranch)}`
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Could not load appointment slots.');
                }
                setAllowedSlots(Array.isArray(data.allowedSlots) ? data.allowedSlots : []);
                setTakenSlots(Array.isArray(data.takenSlots) ? data.takenSlots : []);
            } catch (error) {
                setAllowedSlots([]);
                setTakenSlots([]);
                setSlotError(error.message || 'Could not load appointment slots.');
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [assignedBranch, formState.branch, formState.date, formState.formType]);

    const availableSlots = useMemo(() => {
        const visible = allowedSlots.filter((slot) => !takenSlots.includes(slot));
        if (
            editingEntry?.type === 'appointment'
            && formState.time
            && !visible.includes(formState.time)
            && allowedSlots.includes(formState.time)
        ) {
            return [formState.time, ...visible];
        }
        return visible;
    }, [allowedSlots, editingEntry, formState.time, takenSlots]);

    const patientOptions = useMemo(
        () => patients.map((patient) => ({
            id: patient._id,
            name: normalizePatientName(patient) || patient.email || 'Unknown Patient',
            contactNumber: patient.contactNumber || '',
        })),
        [patients]
    );

    const branchOptions = useMemo(() => {
        if (canChooseBranch) {
            return [...new Set(branches.map((entry) => entry.name).filter(Boolean))].sort();
        }
        return assignedBranch ? [assignedBranch] : [];
    }, [assignedBranch, branches, canChooseBranch]);

    const dentistOptions = useMemo(() => {
        const activeList = dentists.map((dentist) => ({
            id: dentist._id || dentist.id,
            name: `Dr. ${dentist.name?.first || ''} ${dentist.name?.last || ''}`.trim(),
            branch: dentist.assignedBranch || dentist.assignedBranches?.[0] || '',
        }));
        return isDentist
            ? activeList.filter((entry) => entry.id === currentUserId)
            : activeList;
    }, [currentUserId, dentists, isDentist]);

    const combinedRows = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const rows = [
            ...appointments,
            ...(rangeIncludesToday ? queueEntries : []),
        ];

        return rows
            .filter((entry) => {
                const matchesType = typeFilter === 'all' || entry.type === typeFilter;
                const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
                if (!normalizedQuery) return matchesType && matchesStatus;

                const haystack = [
                    entry.patientName,
                    entry.dentistName,
                    entry.branch,
                    entry.procedure,
                    entry.notes,
                    entry.statusLabel,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return matchesType && matchesStatus && haystack.includes(normalizedQuery);
            })
            .sort((left, right) => {
                if (left.prioritySort !== right.prioritySort) {
                    return left.prioritySort - right.prioritySort;
                }
                const dateCompare = (left.date || '').localeCompare(right.date || '');
                if (dateCompare !== 0) return dateCompare;
                if (left.type === 'appointment' && right.type === 'appointment') {
                    const timeCompare = compareTime(left.time, right.time);
                    if (timeCompare !== 0) return timeCompare;
                    return new Date(left.createdAt) - new Date(right.createdAt);
                }
                if (left.type === 'walkin' && right.type === 'walkin') {
                    return (left.ticketNumber || 0) - (right.ticketNumber || 0);
                }
                return 0;
            });
    }, [appointments, queueEntries, rangeIncludesToday, searchQuery, statusFilter, typeFilter]);

    const openCreateModal = () => {
        resetFormState();
        setIsFormOpen(true);
    };

    const openEditModal = (entry) => {
        const nextState = {
            formType: entry.type,
            patientId: entry.patientId || '',
            patientName: entry.patientName || '',
            dentistId:
                entry.type === 'appointment'
                    ? entry.dentistId || (isDentist ? currentUserId : '')
                    : '',
            branch: entry.branch || assignedBranch || '',
            date: entry.date || todayString,
            time: entry.time || '',
            procedure: entry.procedure || '',
            notes: entry.notes || '',
            status: entry.status || (entry.type === 'appointment' ? 'pending' : 'waiting'),
            source: entry.source || 'Walk-in',
            contactNumber: entry.contactNumber || '',
            assignedDentist: entry.type === 'walkin' ? (entry.dentistName === 'Unassigned' ? '' : entry.dentistName) : '',
        };
        setFormState(nextState);
        setFormErrors({});
        setEditingEntry(entry);
        setIsFormOpen(true);
    };

    const closeFormModal = () => {
        setIsFormOpen(false);
        resetFormState();
    };

    const handleFormFieldChange = (event) => {
        const { name, value } = event.target;
        setFormState((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'formType') {
                next.status = value === 'walkin' ? 'waiting' : 'pending';
                next.date = value === 'walkin' ? todayString : prev.date || todayString;
                next.time = '';
                next.source = value === 'walkin' ? 'Walk-in' : prev.source || 'Walk-in';
            }
            if (name === 'patientId') {
                const matchedPatient = patientOptions.find((entry) => entry.id === value);
                if (matchedPatient) {
                    next.patientName = matchedPatient.name;
                    next.contactNumber = matchedPatient.contactNumber;
                }
            }
            if (name === 'date' || name === 'branch') {
                next.time = '';
            }
            return next;
        });
        if (formErrors[name]) {
            setFormErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const handleSelectSlot = (slot) => {
        setFormState((prev) => ({ ...prev, time: slot }));
        setFormErrors((prev) => ({ ...prev, time: '' }));
    };

    const validateForm = () => {
        const nextErrors = {};
        const activeBranch = formState.branch || assignedBranch;

        if (!activeBranch) nextErrors.branch = 'Select a branch.';
        if (formState.formType === 'appointment') {
            if (!formState.patientId) nextErrors.patientId = 'Select a patient.';
            if (!formState.dentistId && canChooseDentist) nextErrors.dentistId = 'Select a dentist.';
            if (!formState.date) nextErrors.date = 'Choose an appointment date.';
            if (!formState.time) nextErrors.time = 'Choose an appointment time.';
            if (formState.time && !availableSlots.includes(formState.time)) {
                nextErrors.time = 'Choose one of the available time slots.';
            }
            if (!formState.procedure) nextErrors.procedure = 'Select a procedure.';
        } else {
            if (!formState.patientName.trim()) nextErrors.patientName = 'Enter the walk-in patient name.';
            if (!formState.procedure.trim()) nextErrors.procedure = 'Enter the chief complaint or procedure.';
        }

        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmitForm = async (event) => {
        event.preventDefault();
        if (!validateForm()) return;

        const activeBranch = formState.branch || assignedBranch;
        const selectedDentist = dentistOptions.find((entry) => entry.id === formState.dentistId);

        setIsSubmitting(true);
        try {
            if (formState.formType === 'appointment') {
                const payload = {
                    patient: formState.patientId,
                    dentist: canChooseDentist ? formState.dentistId : currentUserId,
                    branch: activeBranch,
                    date: formState.date,
                    time: formState.time,
                    procedure: formState.procedure,
                    notes: formState.notes,
                    status: formState.status,
                    source: formState.source,
                };

                const response = await authFetch(
                    editingEntry?.type === 'appointment'
                        ? `/appointments/${editingEntry.id}`
                        : '/appointments',
                    {
                        method: editingEntry?.type === 'appointment' ? 'PUT' : 'POST',
                        body: JSON.stringify(payload),
                    }
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save the appointment.');
                }
                addToast(
                    editingEntry?.type === 'appointment'
                        ? 'Appointment updated successfully.'
                        : 'Appointment created successfully.',
                    'success'
                );
            } else {
                const payload = {
                    patientName: formState.patientName.trim(),
                    patientId: formState.patientId || null,
                    branch: activeBranch,
                    assignedDentist: formState.assignedDentist || selectedDentist?.name || '',
                    procedureType: formState.procedure.trim(),
                    contactNumber: formState.contactNumber.trim(),
                    status: formState.status,
                };

                const response = await authFetch(
                    editingEntry?.type === 'walkin'
                        ? `/queue/${editingEntry.id}`
                        : '/queue',
                    {
                        method: editingEntry?.type === 'walkin' ? 'PUT' : 'POST',
                        body: JSON.stringify(payload),
                    }
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save the walk-in entry.');
                }
                addToast(
                    editingEntry?.type === 'walkin'
                        ? 'Walk-in queue entry updated successfully.'
                        : 'Walk-in queue entry added successfully.',
                    'success'
                );
            }

            closeFormModal();
            await fetchPageData();
        } catch (error) {
            addToast(error.message || 'Could not save this schedule entry.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelEntry = async () => {
        if (!cancelTarget) return;
        try {
            if (cancelTarget.type === 'appointment') {
                const response = await authFetch(`/appointments/${cancelTarget.id}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'cancelled' }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to cancel the appointment.');
                }
            } else {
                const response = await authFetch(`/queue/${cancelTarget.id}`, { method: 'DELETE' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to remove the walk-in entry.');
                }
            }

            addToast(
                cancelTarget.type === 'appointment'
                    ? 'Appointment cancelled successfully.'
                    : 'Walk-in queue entry removed successfully.',
                'success'
            );
            setCancelTarget(null);
            await fetchPageData();
        } catch (error) {
            addToast(error.message || 'Unable to complete that action.', 'error');
        }
    };

    const renderFormModal = () => {
        if (!isFormOpen) return null;

        const activeBranch = formState.branch || assignedBranch;
        const showWalkInFields = formState.formType === 'walkin';

        return (
            <div className={styles.modalOverlay}>
                <div className={styles.wideModal}>
                    <div className={styles.modalHeader}>
                        <div>
                            <h2 className={styles.modalTitle}>
                                {editingEntry ? 'Edit Schedule Entry' : 'Create Schedule Entry'}
                            </h2>
                            <p className={styles.modalSubtitle}>
                                {showWalkInFields
                                    ? 'Walk-ins are saved to today\'s branch queue.'
                                    : 'Appointments are scheduled into the clinic calendar.'}
                            </p>
                        </div>
                        <button type="button" className={styles.closeButton} onClick={closeFormModal}>
                            <FaTimes />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitForm} className={styles.modalBody}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Entry Type</label>
                                <select
                                    name="formType"
                                    className={styles.formControl}
                                    value={formState.formType}
                                    onChange={handleFormFieldChange}
                                    disabled={Boolean(editingEntry)}
                                >
                                    <option value="appointment">Appointment</option>
                                    {canManageQueue && <option value="walkin">Walk-in</option>}
                                </select>
                            </div>

                            {!showWalkInFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Source</label>
                                    <select
                                        name="source"
                                        className={styles.formControl}
                                        value={formState.source}
                                        onChange={handleFormFieldChange}
                                    >
                                        {APPOINTMENT_SOURCE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {canChooseBranch && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Branch</label>
                                    <select
                                        name="branch"
                                        className={styles.formControl}
                                        value={formState.branch}
                                        onChange={handleFormFieldChange}
                                    >
                                        <option value="">Select branch</option>
                                        {branchOptions.map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                    </select>
                                    {formErrors.branch && <span className={styles.errorText}>{formErrors.branch}</span>}
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Patient</label>
                                <select
                                    name="patientId"
                                    className={styles.formControl}
                                    value={formState.patientId}
                                    onChange={handleFormFieldChange}
                                >
                                    <option value="">Select patient</option>
                                    {patientOptions.map((patient) => (
                                        <option key={patient.id} value={patient.id}>{patient.name}</option>
                                    ))}
                                </select>
                                {formErrors.patientId && <span className={styles.errorText}>{formErrors.patientId}</span>}
                            </div>

                            {showWalkInFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Walk-in Name</label>
                                    <input
                                        type="text"
                                        name="patientName"
                                        className={styles.formControl}
                                        value={formState.patientName}
                                        onChange={handleFormFieldChange}
                                        placeholder="Enter walk-in patient name"
                                    />
                                    {formErrors.patientName && <span className={styles.errorText}>{formErrors.patientName}</span>}
                                </div>
                            )}

                            {canChooseDentist ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Dentist Assigned</label>
                                    <select
                                        name="dentistId"
                                        className={styles.formControl}
                                        value={formState.dentistId}
                                        onChange={handleFormFieldChange}
                                        disabled={showWalkInFields}
                                    >
                                        <option value="">{showWalkInFields ? 'Optional for walk-ins' : 'Select dentist'}</option>
                                        {dentistOptions.map((dentist) => (
                                            <option key={dentist.id} value={dentist.id}>{dentist.name}</option>
                                        ))}
                                    </select>
                                    {formErrors.dentistId && <span className={styles.errorText}>{formErrors.dentistId}</span>}
                                </div>
                            ) : (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Dentist Assigned</label>
                                    <input
                                        type="text"
                                        className={styles.formControl}
                                        value={dentistOptions.find((entry) => entry.id === currentUserId)?.name || 'Current dentist'}
                                        readOnly
                                    />
                                </div>
                            )}

                            {showWalkInFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Display Dentist Name</label>
                                    <input
                                        type="text"
                                        name="assignedDentist"
                                        className={styles.formControl}
                                        value={formState.assignedDentist}
                                        onChange={handleFormFieldChange}
                                        placeholder="Optional"
                                    />
                                </div>
                            )}

                            {showWalkInFields ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Contact Number</label>
                                    <input
                                        type="text"
                                        name="contactNumber"
                                        className={styles.formControl}
                                        value={formState.contactNumber}
                                        onChange={handleFormFieldChange}
                                        placeholder="Optional"
                                    />
                                </div>
                            ) : (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Appointment Date</label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={styles.formControl}
                                        value={formState.date}
                                        onChange={handleFormFieldChange}
                                        min={todayString}
                                    />
                                    {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    {showWalkInFields ? 'Queue Status' : 'Appointment Status'}
                                </label>
                                <select
                                    name="status"
                                    className={styles.formControl}
                                    value={formState.status}
                                    onChange={handleFormFieldChange}
                                >
                                    {(showWalkInFields ? QUEUE_STATUS_OPTIONS : APPOINTMENT_STATUS_OPTIONS).map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>
                                    {showWalkInFields ? 'Chief Complaint / Procedure' : 'Procedure'}
                                </label>
                                {showWalkInFields ? (
                                    <input
                                        type="text"
                                        name="procedure"
                                        className={styles.formControl}
                                        value={formState.procedure}
                                        onChange={handleFormFieldChange}
                                        placeholder="Enter walk-in concern"
                                    />
                                ) : (
                                    <select
                                        name="procedure"
                                        className={styles.formControl}
                                        value={formState.procedure}
                                        onChange={handleFormFieldChange}
                                    >
                                        <option value="">Select procedure</option>
                                        {PROCEDURE_OPTIONS.map((procedure) => (
                                            <option key={procedure} value={procedure}>{procedure}</option>
                                        ))}
                                    </select>
                                )}
                                {formErrors.procedure && <span className={styles.errorText}>{formErrors.procedure}</span>}
                            </div>

                            {!showWalkInFields && (
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                    <label className={styles.formLabel}>Appointment Time</label>
                                    {!formState.date || !activeBranch ? (
                                        <div className={styles.helperText}>Select a branch and date first to load available time slots.</div>
                                    ) : loadingSlots ? (
                                        <div className={styles.helperText}>Loading available time slots...</div>
                                    ) : slotError ? (
                                        <div className={styles.helperError}>{slotError}</div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className={styles.helperText}>No available slots for the selected date.</div>
                                    ) : (
                                        <div className={styles.slotList}>
                                            {availableSlots.map((slot) => (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    className={`${styles.slotButton} ${formState.time === slot ? styles.slotButtonActive : ''}`}
                                                    onClick={() => handleSelectSlot(slot)}
                                                >
                                                    {to12h(slot)}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {formErrors.time && <span className={styles.errorText}>{formErrors.time}</span>}
                                </div>
                            )}

                            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>Notes / Chief Complaint</label>
                                <textarea
                                    name="notes"
                                    rows="4"
                                    className={styles.textareaControl}
                                    value={formState.notes}
                                    onChange={handleFormFieldChange}
                                    placeholder="Optional notes for the clinic team"
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={closeFormModal} disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editingEntry ? 'Save Changes' : 'Create Entry'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const renderViewModal = () => {
        if (!viewEntry) return null;

        return (
            <div className={styles.modalOverlay}>
                <div className={styles.viewerModal}>
                    <div className={styles.modalHeader}>
                        <div>
                            <h2 className={styles.modalTitle}>Schedule Details</h2>
                            <p className={styles.modalSubtitle}>
                                {viewEntry.type === 'appointment'
                                    ? 'Appointment details with linked patient record.'
                                    : 'Walk-in queue details with linked EMR when available.'}
                            </p>
                        </div>
                        <button type="button" className={styles.closeButton} onClick={() => setViewEntry(null)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className={styles.viewerBody}>
                        <section className={styles.viewerSummary}>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Patient</span>
                                <span className={styles.summaryValue}>{viewEntry.patientName}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Type</span>
                                <span className={styles.summaryValue}>{viewEntry.type === 'appointment' ? 'Appointment' : 'Walk-in'}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Date & Time</span>
                                <span className={styles.summaryValue}>
                                    {viewEntry.type === 'appointment'
                                        ? formatDateTimeLabel(viewEntry.date, viewEntry.time)
                                        : `${formatDateLabel(todayString)} • Queue Ticket ${viewEntry.ticketNumber || '-'}`}
                                </span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Dentist</span>
                                <span className={styles.summaryValue}>{viewEntry.dentistName}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Status</span>
                                <span className={`${wideTable.statusBadge} ${getBadgeClass(viewEntry)}`}>{viewEntry.statusLabel}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>Created At</span>
                                <span className={styles.summaryValue}>{formatCreatedAt(viewEntry.createdAt)}</span>
                            </div>
                        </section>

                        <section className={styles.notesPanel}>
                            <h3 className={styles.panelTitle}>Operational Notes</h3>
                            <dl className={styles.detailList}>
                                <div className={styles.detailItem}>
                                    <dt>Branch</dt>
                                    <dd>{viewEntry.branch || '-'}</dd>
                                </div>
                                <div className={styles.detailItem}>
                                    <dt>Procedure</dt>
                                    <dd>{viewEntry.procedure || '-'}</dd>
                                </div>
                                {viewEntry.type === 'appointment' ? (
                                    <div className={styles.detailItem}>
                                        <dt>Source</dt>
                                        <dd>{viewEntry.source || '-'}</dd>
                                    </div>
                                ) : (
                                    <div className={styles.detailItem}>
                                        <dt>Contact Number</dt>
                                        <dd>{viewEntry.contactNumber || '-'}</dd>
                                    </div>
                                )}
                                <div className={styles.detailItem}>
                                    <dt>Notes</dt>
                                    <dd>{viewEntry.notes || 'No notes recorded.'}</dd>
                                </div>
                            </dl>
                        </section>

                        <section className={styles.emrPanel}>
                            <div className={styles.emrHeader}>
                                <h3 className={styles.panelTitle}>Patient EMR</h3>
                                {!viewEntry.patientId && (
                                    <span className={styles.inlineNote}>No linked patient record for this entry.</span>
                                )}
                            </div>
                            {viewEntry.patientId ? (
                                <PatientEMR
                                    patientId={viewEntry.patientId}
                                    embedded
                                    roleOverride={role || 'administrator'}
                                />
                            ) : (
                                <div className={styles.emptyStateBox}>
                                    Link this walk-in to a patient account to open the full EMR here.
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className={styles.page}>
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.pageTitle}>Schedule Management</h1>
                        <p className={styles.pageSubtitle}>
                            Appointments and walk-ins are shown in one schedule view, with quick date pills and a custom range when you need it.
                        </p>
                    </div>
                    {canCreateSchedule && (
                        <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                            <FaPlus />
                            Add Schedule Entry
                        </button>
                    )}
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.toolbarFilters}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search patient, dentist, branch, or procedure"
                                className={styles.searchInput}
                            />
                        </div>

                        <div className={styles.pillGroup}>
                            {DATE_FILTER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`${styles.filterPill} ${dateFilter === option.value ? styles.activePill : ''}`}
                                    onClick={() => setDateFilter(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {dateFilter === 'custom' && (
                            <div className={styles.customDateRange}>
                                <label className={styles.dateField}>
                                    <span>From</span>
                                    <input
                                        type="date"
                                        value={customDateFrom}
                                        onChange={(event) => setCustomDateFrom(event.target.value)}
                                        className={styles.filterSelect}
                                    />
                                </label>
                                <label className={styles.dateField}>
                                    <span>To</span>
                                    <input
                                        type="date"
                                        value={customDateTo}
                                        min={customDateFrom || undefined}
                                        onChange={(event) => setCustomDateTo(event.target.value)}
                                        className={styles.filterSelect}
                                    />
                                </label>
                            </div>
                        )}

                        <label className={styles.filterSelectWrap}>
                            <FaFilter className={styles.filterIcon} />
                            <select className={styles.filterSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                                <option value="all">All Types</option>
                                <option value="appointment">Appointments</option>
                                {canManageQueue && <option value="walkin">Walk-ins</option>}
                            </select>
                        </label>

                        <label className={styles.filterSelectWrap}>
                            <select className={styles.filterSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                <option value="all">All Statuses</option>
                                {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                                {canManageQueue && QUEUE_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {canManageQueue && !rangeIncludesToday && (
                        <div className={styles.queueNote}>
                            <FaUserClock />
                            Walk-ins only appear when the selected range includes today.
                        </div>
                    )}
                </div>

                <div className={`${styles.tableContainer} ${wideTable.tableWrapper}`}>
                    <table className={`${styles.userTable} ${wideTable.table}`}>
                        <thead>
                            <tr>
                                <th style={{ width: '56px', textAlign: 'center' }}>#</th>
                                <th>Patient Name</th>
                                <th style={{ width: '150px' }}>Type</th>
                                <th>Dentist Assigned</th>
                                <th style={{ width: '150px' }}>Status</th>
                                <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        Loading schedule entries...
                                    </td>
                                </tr>
                            ) : combinedRows.length > 0 ? (
                                combinedRows.map((entry, index) => (
                                    <tr key={`${entry.type}-${entry.id}`}>
                                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                                        <td className={wideTable.wrapCell}>
                                            <div className={styles.patientCell}>
                                                <strong>{entry.patientName}</strong>
                                                <span>{entry.branch || 'No branch'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${wideTable.statusBadge} ${entry.type === 'appointment' ? wideTable.statusBlue : wideTable.statusGray}`}>
                                                {entry.type === 'appointment' ? 'Appointment' : 'Walk-in'}
                                            </span>
                                        </td>
                                        <td>{entry.dentistName}</td>
                                        <td>
                                            <span className={`${wideTable.statusBadge} ${getBadgeClass(entry)}`}>
                                                {entry.statusLabel}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className={styles.actionRow}>
                                                <button type="button" className={styles.viewButton} onClick={() => setViewEntry(entry)}>
                                                    <FaEye /> View
                                                </button>
                                                {canCreateSchedule && (
                                                    <button type="button" className={styles.editButton} onClick={() => openEditModal(entry)}>
                                                        <FaEdit /> Edit
                                                    </button>
                                                )}
                                                {canCreateSchedule && (
                                                    <button type="button" className={styles.cancelButton} onClick={() => setCancelTarget(entry)}>
                                                        <FaTrashAlt /> {entry.type === 'appointment' ? 'Cancel' : 'Delete'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        No schedule entries found for the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {renderFormModal()}
            {renderViewModal()}

            <ConfirmModal
                isOpen={Boolean(cancelTarget)}
                title={cancelTarget?.type === 'appointment' ? 'Cancel Appointment' : 'Delete Walk-in Entry'}
                message={
                    cancelTarget?.type === 'appointment'
                        ? `Cancel the appointment for ${cancelTarget?.patientName}? The record will stay visible with a cancelled badge.`
                        : `Delete the walk-in queue entry for ${cancelTarget?.patientName}?`
                }
                confirmText={cancelTarget?.type === 'appointment' ? 'Yes, Cancel Appointment' : 'Yes, Delete Entry'}
                isDestructive={true}
                onConfirm={handleCancelEntry}
                onCancel={() => setCancelTarget(null)}
            />
        </>
    );
}
