import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaEdit,
    FaEye,
    FaFilter,
    FaCheck,
    FaPlus,
    FaSearch,
    FaTimes,
} from 'react-icons/fa';
import { authFetch, publicFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import PatientEMR from '../admin/PatientEMR';
import ConfirmModal from '../../components/common/ConfirmModal';
import wideTable from '../../styles/wideTable.module.css';
import styles from '../../styles/shared/SchedulePage.module.css';

const PROCEDURE_OPTIONS = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
    'Consultation',
    'Teeth Cleaning (Prophylaxis)',
    'Tooth Extraction',
    'Dental Filling',
    'Dental Filling (Composite)',
    'Root Canal Treatment',
    'Orthodontic Consultation',
    'Dental Implant Consultation',
    'Braces / Orthodontic Adjustment',
    'Teeth Whitening',
    'Dentures / Retainers',
    'Crown / Bridge Fitting',
    'Wisdom Tooth Extraction',
    'Oral Surgery',
    'X-Ray / Imaging',
    'X-Ray / Radiograph',
    'Other',
];

const TREATMENT_CATEGORY_OPTIONS = [
    'General',
    'Prophylaxis',
    'Restoration',
    'Extraction',
    'Orthodontics',
    'Endodontics',
    'Prosthodontics',
    'Oral Surgery',
    'Consultation',
    'Other',
];

const inferTreatmentCategory = (procedure = '') => {
    const value = String(procedure || '').toLowerCase();
    if (!value) return 'Other';
    if (value.includes('consult') || value.includes('check-up') || value.includes('checkup')) return 'Consultation';
    if (value.includes('prophy') || value.includes('cleaning') || value.includes('fluoride') || value.includes('sealant')) return 'Prophylaxis';
    if (value.includes('fill') || value.includes('restoration') || value.includes('pasta')) return 'Restoration';
    if (value.includes('root canal')) return 'Endodontics';
    if (value.includes('braces') || value.includes('orthodont')) return 'Orthodontics';
    if (value.includes('denture') || value.includes('crown') || value.includes('retainer')) return 'Prosthodontics';
    if (value.includes('wisdom') || value.includes('odontectomy')) return 'Oral Surgery';
    if (value.includes('extract') || value.includes('bunot')) return 'Extraction';
    return 'Other';
};

const APPOINTMENT_STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    'in-clinic': 'In Clinic',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const APPOINTMENT_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in-clinic', label: 'In Clinic' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const SCHEDULE_SOURCE_OPTIONS = [
    { value: '', label: '--SELECT SOURCE--' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'phonecall', label: 'Phone Call' },
    { value: 'walkin', label: 'Walk-in' },
];

const DATE_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'past', label: 'Past' },
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

const subtractDaysFromDateString = (dateString, daysToSubtract) => (
    addDaysToDateString(dateString, daysToSubtract * -1)
);

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

const getCurrentScheduleStamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
    };
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

const isScheduledInPast = (dateValue, timeValue) => {
    if (!dateValue) return false;
    const base = new Date(`${dateValue}T${timeValue || '23:59'}:00`);
    if (Number.isNaN(base.getTime())) return false;
    return base < new Date();
};

const canMarkEntryComplete = (entry) => {
    if (!entry || entry.status === 'completed' || entry.status === 'cancelled') return false;
    if (entry.status === 'in-clinic') return true;
    if (entry.type === 'appointment') {
        return isScheduledInPast(entry.date, entry.time);
    }
    return false;
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

const normalizeScheduleStatus = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'waiting':
            return 'pending';
        case 'serving':
            return 'in-clinic';
        case 'done':
            return 'completed';
        case 'skipped':
            return 'cancelled';
        default:
            return status || 'pending';
    }
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
    linkedAppointmentId: entry.linkedAppointment || '',
    patientId: entry.patientId || '',
    patientName: entry.patientName || 'Walk-in Patient',
    dentistName: entry.assignedDentist || 'Unassigned',
    date: formatDateInput(entry.createdAt || entry.updatedAt || new Date()),
    time: '',
    branch: entry.branch || '',
    procedure: entry.procedureType || '',
    notes: '',
    status: normalizeScheduleStatus(entry.status),
    statusLabel: APPOINTMENT_STATUS_LABELS[normalizeScheduleStatus(entry.status)] || 'Pending',
    createdAt: entry.createdAt,
    contactNumber: entry.contactNumber || '',
    ticketNumber: entry.ticketNumber || '',
    prioritySort: 2,
    raw: entry,
});

const getBadgeClass = (entry) => {
    switch ((entry.status || '').toLowerCase()) {
        case 'confirmed':
            return wideTable.statusGreen;
        case 'pending':
            return wideTable.statusAmber;
        case 'completed':
            return wideTable.statusBlue;
        case 'cancelled':
            return wideTable.statusRed;
        case 'in-clinic':
            return wideTable.statusGray;
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
    source: '',
    contactNumber: '',
    assignedDentist: '',
});

export default function SchedulePage() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const role = user?.role || '';
    const currentUserId = user?.userId || user?.id || user?._id || '';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';

    const isAdmin = role === 'administrator';
    const isOwner = role === 'owner';
    const isBranchManager = role === 'branch-manager';
    const isSecretary = role === 'secretary';
    const isDentist = role === 'dentist';

    const canManageQueue = isAdmin || isBranchManager || isSecretary;
    const canViewQueue = canManageQueue || isDentist;
    const canCreateSchedule = isAdmin || isOwner || isBranchManager || isSecretary;
    const canEditSchedule = isAdmin || isOwner || isBranchManager || isSecretary;
    const canChooseBranch = isAdmin || isOwner;
    const canChooseDentist = !isDentist;

    const [appointments, setAppointments] = useState([]);
    const [queueEntries, setQueueEntries] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('all');
    const [customDateFrom, setCustomDateFrom] = useState(getTodayString());
    const [customDateTo, setCustomDateTo] = useState(getTodayString());
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(APPOINTMENT_STATUS_OPTIONS.map((option) => option.value));
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState('all');

    const [formState, setFormState] = useState(buildInitialForm({ assignedBranch, currentUserId, role }));
    const [formErrors, setFormErrors] = useState({});
    const [editingEntry, setEditingEntry] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);
    const [pendingStatusTarget, setPendingStatusTarget] = useState(null);
    const [completeTarget, setCompleteTarget] = useState(null);
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionForm, setCompletionForm] = useState({
        performedProcedure: '',
        category: 'Other',
        tooth: '',
        amountCharged: '',
        amountPaid: '',
        nextAppointment: '',
        notes: '',
    });
    const [completionError, setCompletionError] = useState('');
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotError, setSlotError] = useState('');

    const [viewEntry, setViewEntry] = useState(null);

    const todayString = getTodayString();
    const selectedDateRange = useMemo(() => {
        if (dateFilter === 'all') {
            return { from: '', to: '' };
        }
        if (dateFilter === 'past') {
            return { from: subtractDaysFromDateString(todayString, 3650), to: addDaysToDateString(todayString, -1) };
        }
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
    const statusFilterLabel = useMemo(() => {
        if (statusFilter.length === APPOINTMENT_STATUS_OPTIONS.length) return 'All Statuses';
        if (statusFilter.length === 0) return 'No Status';
        return `${statusFilter.length} Status${statusFilter.length === 1 ? '' : 'es'} Selected`;
    }, [statusFilter]);
    const resetFormState = useCallback(() => {
        setFormState(buildInitialForm({ assignedBranch, currentUserId, role }));
        setFormErrors({});
        setAllowedSlots([]);
        setTakenSlots([]);
        setSlotError('');
        setEditingEntry(null);
    }, [assignedBranch, currentUserId, role]);

    const toggleStatusFilter = useCallback((value) => {
        setStatusFilter((prev) => {
            if (value === 'all') {
                return APPOINTMENT_STATUS_OPTIONS.map((option) => option.value);
            }
            return prev.includes(value)
                ? prev.filter((entry) => entry !== value)
                : [...prev, value];
        });
    }, []);

    const fetchPageData = useCallback(async ({ silent = false, suppressErrorToast = false } = {}) => {
        if (!silent) {
            setLoading(true);
        }
        try {
            const appointmentParams = new URLSearchParams();
            if (selectedDateRange.from) appointmentParams.set('dateFrom', selectedDateRange.from);
            if (selectedDateRange.to) appointmentParams.set('dateTo', selectedDateRange.to);
            const requests = [
                authFetch(appointmentParams.toString()
                    ? `/appointments?${appointmentParams.toString()}`
                    : '/appointments'),
                authFetch('/patients?limit=200'),
                authFetch('/users?role=dentist'),
            ];

            if (canViewQueue) {
                const queueParams = new URLSearchParams();
                if (selectedDateRange.from) queueParams.set('dateFrom', selectedDateRange.from);
                if (selectedDateRange.to) queueParams.set('dateTo', selectedDateRange.to);
                requests.push(authFetch(queueParams.toString() ? `/queue?${queueParams.toString()}` : '/queue'));
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
            if (canViewQueue) {
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
            if (!suppressErrorToast) {
                addToast(error.message || 'Failed to load the schedule.', 'error');
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [addToast, assignedBranch, canChooseBranch, canViewQueue, selectedDateRange.from, selectedDateRange.to]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    useEffect(() => {
        const refreshData = () => {
            fetchPageData({ silent: true, suppressErrorToast: true });
        };

        const intervalId = window.setInterval(refreshData, 30000);
        const handleFocus = () => refreshData();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshData();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
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
            email: patient.email || '',
            contactNumber: patient.contactNumber || '',
            branch: patient.assignedBranch || patient.assignedBranches?.[0] || '',
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
        const baseList = isDentist
            ? activeList.filter((entry) => entry.id === currentUserId)
            : activeList;
        return formState.branch
            ? baseList.filter((entry) => !entry.branch || entry.branch === formState.branch)
            : baseList;
    }, [currentUserId, dentists, formState.branch, isDentist]);

    const procedureOptions = useMemo(() => {
        const savedProcedure = String(formState.procedure || '').trim();
        return savedProcedure && !PROCEDURE_OPTIONS.includes(savedProcedure)
            ? [savedProcedure, ...PROCEDURE_OPTIONS]
            : PROCEDURE_OPTIONS;
    }, [formState.procedure]);

    const patientSearchOptions = useMemo(
        () => patientOptions.map((patient) => `${patient.name}${patient.email ? ` (${patient.email})` : ''}`),
        [patientOptions]
    );

    const combinedRows = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const rows = [
            ...appointments,
            ...queueEntries,
        ];

        return rows
            .filter((entry) => {
                const matchesType = typeFilter === 'all' || entry.type === typeFilter;
                const matchesStatus = statusFilter.length === 0 || statusFilter.includes(entry.status);
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
    }, [appointments, queueEntries, searchQuery, statusFilter, typeFilter]);

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
            status: entry.status || 'pending',
            source: entry.type === 'walkin'
                ? 'walkin'
                : (entry.source === 'Phone Call' ? 'phonecall' : 'appointment'),
            contactNumber: entry.contactNumber || '',
            assignedDentist: entry.type === 'walkin' ? (entry.dentistName === 'Unassigned' ? '' : entry.dentistName) : '',
        };
        setFormState(nextState);
        setFormErrors({});
        setEditingEntry(entry);
        setIsFormOpen(true);
    };

    const openStatusUpdateModal = (entry, nextStatus) => {
        openEditModal({
            ...entry,
            status: nextStatus,
        });
    };

    const closeFormModal = () => {
        setIsFormOpen(false);
        resetFormState();
    };

    const openCompleteModal = (entry) => {
        setCompleteTarget(entry);
        const performedProcedure = entry.procedure || '';
        setCompletionForm({
            performedProcedure,
            category: inferTreatmentCategory(performedProcedure),
            tooth: '',
            amountCharged: '',
            amountPaid: '',
            nextAppointment: '',
            notes: '',
        });
        setCompletionError('');
    };

    const handleFormFieldChange = (event) => {
        const { name, value } = event.target;
        setFormState((prev) => {
            const next = { ...prev, [name]: value };
            const applyMatchedPatient = (matchedPatient) => {
                next.patientId = matchedPatient.id;
                next.patientName = matchedPatient.name;
                next.contactNumber = matchedPatient.contactNumber;

                if (matchedPatient.branch && matchedPatient.branch !== next.branch) {
                    next.branch = matchedPatient.branch;
                    next.time = '';
                    next.dentistId = '';
                    next.assignedDentist = '';
                }
            };

            if (name === 'source') {
                const nextType = value === 'walkin' ? 'walkin' : 'appointment';
                next.formType = nextType;
                if (value === 'walkin') {
                    next.status = 'in-clinic';
                } else if (value === 'phonecall') {
                    next.status = 'confirmed';
                } else {
                    next.status = 'pending';
                }
                next.date = nextType === 'walkin' ? todayString : prev.date || todayString;
                next.time = '';
                if (nextType === 'walkin') {
                    next.dentistId = '';
                }
            }
            if (name === 'patientId') {
                const matchedPatient = patientOptions.find((entry) => entry.id === value);
                if (matchedPatient) {
                    applyMatchedPatient(matchedPatient);
                }
            }
            if (name === 'patientName') {
                const matchedPatient = patientOptions.find((entry) => (
                    value === entry.name
                    || value === entry.email
                    || value === `${entry.name}${entry.email ? ` (${entry.email})` : ''}`
                ));
                if (matchedPatient) {
                    applyMatchedPatient(matchedPatient);
                } else if (prev.formType === 'walkin') {
                    next.patientId = '';
                }
            }
            if (name === 'dentistId') {
                const matchedDentist = dentistOptions.find((entry) => entry.id === value);
                next.assignedDentist = matchedDentist?.name || '';
            }
            if (name === 'status' && value === 'in-clinic' && next.formType === 'appointment') {
                const currentStamp = getCurrentScheduleStamp();
                next.date = currentStamp.date;
                next.time = currentStamp.time;
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

    const validateForm = () => {
        const nextErrors = {};
        const activeBranch = formState.branch || assignedBranch;

        if (!activeBranch) nextErrors.branch = 'Select a branch.';
        if (!formState.source) nextErrors.source = 'Select a source.';
        if (formState.formType === 'appointment') {
            if (!formState.patientId) nextErrors.patientId = 'Select a patient.';
            if (!formState.dentistId && canChooseDentist) nextErrors.dentistId = 'Select a dentist.';
            if (!formState.date) nextErrors.date = 'Choose an appointment date.';
            if (!formState.time) nextErrors.time = 'Choose an appointment time.';
            if (formState.status !== 'in-clinic' && formState.time && !availableSlots.includes(formState.time)) {
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

    const submitScheduleForm = async () => {
        const activeBranch = formState.branch || assignedBranch;
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
                    source: formState.source === 'phonecall' ? 'Phone Call' : 'Appointment',
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
                const currentStamp = getCurrentScheduleStamp();
                const payload = {
                    patient: formState.patientId || null,
                    branch: activeBranch,
                    dentist: canChooseDentist ? (formState.dentistId || null) : currentUserId,
                    date: currentStamp.date,
                    time: currentStamp.time,
                    procedure: formState.procedure.trim(),
                    notes: formState.notes || '',
                    status: 'in-clinic',
                    source: 'Walk-in',
                    guestName: formState.patientId ? '' : formState.patientName.trim(),
                    contactNumber: formState.contactNumber.trim(),
                };

                const response = await authFetch(
                    editingEntry?.linkedAppointmentId
                        ? `/appointments/${editingEntry.linkedAppointmentId}`
                        : '/appointments',
                    {
                        method: editingEntry?.linkedAppointmentId ? 'PUT' : 'POST',
                        body: JSON.stringify(payload),
                    }
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save the walk-in appointment.');
                }
                addToast(
                    editingEntry?.linkedAppointmentId
                        ? 'Walk-in appointment updated successfully.'
                        : 'Walk-in appointment added successfully.',
                    'success'
                );
            }

            closeFormModal();
            await fetchPageData();
        } catch (error) {
            addToast(error.message || 'Could not save this schedule entry.', 'error');
        } finally {
            setIsSubmitting(false);
            setIsConfirmingSave(false);
        }
    };

    const handleSubmitForm = async (event) => {
        event.preventDefault();
        if (!validateForm()) return;
        setIsConfirmingSave(true);
    };

    const handleMarkAsComplete = async () => {
        if (!completeTarget) return;
        if (
            completeTarget.type === 'appointment'
            && completeTarget.status !== 'in-clinic'
            && !isScheduledInPast(completeTarget.date, completeTarget.time)
        ) {
            addToast('Only past or checked-in appointments can be marked as completed.', 'error');
            setCompleteTarget(null);
            return;
        }
        if (!completionForm.performedProcedure || !completionForm.category || completionForm.amountCharged === '' || completionForm.amountPaid === '' || !completionForm.notes.trim()) {
            setCompletionError('Please complete the treatment details before marking this schedule as complete.');
            return;
        }

        setIsCompleting(true);
        try {
            const endpoint = completeTarget.type === 'appointment'
                ? `/appointments/${completeTarget.id}/status`
                : `/queue/${completeTarget.id}/status`;
            const method = completeTarget.type === 'appointment' ? 'PUT' : 'PATCH';
            const payload = {
                status: 'completed',
                performedProcedure: completionForm.performedProcedure || completeTarget.procedure || '',
                category: completionForm.category,
                tooth: completionForm.tooth.trim(),
                amountCharged: Number(completionForm.amountCharged),
                amountPaid: Number(completionForm.amountPaid),
                nextAppointment: completionForm.nextAppointment || null,
                notes: completionForm.notes.trim(),
            };
            const response = await authFetch(endpoint, {
                method,
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Failed to mark this schedule as complete.');
            }
            addToast('Schedule marked as completed.', 'success');
            setCompleteTarget(null);
            setCompletionForm({
                performedProcedure: '',
                category: 'Other',
                tooth: '',
                amountCharged: '',
                amountPaid: '',
                nextAppointment: '',
                notes: '',
            });
            setCompletionError('');
            await fetchPageData();
        } catch (error) {
            addToast(error.message || 'Failed to mark this schedule as complete.', 'error');
        } finally {
            setIsCompleting(false);
        }
    };

    const submitQuickStatusUpdate = async () => {
        if (!pendingStatusTarget?.entry || !pendingStatusTarget?.status) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/appointments/${pendingStatusTarget.entry.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: pendingStatusTarget.status }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update the appointment status.');
            }
            addToast(`Appointment updated to ${APPOINTMENT_STATUS_LABELS[pendingStatusTarget.status] || pendingStatusTarget.status}.`, 'success');
            setPendingStatusTarget(null);
            await fetchPageData();
        } catch (error) {
            addToast(error.message || 'Failed to update the appointment status.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderFormModal = () => {
        if (!isFormOpen) return null;

        const activeBranch = formState.branch || assignedBranch;
        const showWalkInFields = formState.formType === 'walkin';
        const patientManagementPath = {
            administrator: '/admin/patients',
            owner: '/owner/patients',
            'branch-manager': '/branch-manager/patients',
            secretary: '/secretary/patients',
        }[role];

        return (
            <div className={styles.modalOverlay}>
                <div className={styles.wideModal}>
                    <div className={styles.modalHeader}>
                        <div>
                            <h2 className={styles.modalTitle}>
                                {editingEntry ? 'Update Schedule Entry' : 'Create Schedule Entry'}
                            </h2>
                            <p className={styles.modalSubtitle}>
                                Search an existing patient first, or add a new patient before saving this schedule entry.
                            </p>
                        </div>
                        <button type="button" className={styles.closeButton} onClick={closeFormModal}>
                            <FaTimes />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitForm} className={styles.modalBody}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Source <span className={styles.requiredMark}>*</span></label>
                                <select
                                    name="source"
                                    className={styles.formControl}
                                    value={formState.source}
                                    onChange={handleFormFieldChange}
                                >
                                    {SCHEDULE_SOURCE_OPTIONS.filter((option) => canManageQueue || option.value !== 'walkin').map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                {formErrors.source && <span className={styles.errorText}>{formErrors.source}</span>}
                            </div>

                            {canChooseBranch && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Branch <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        name="branch"
                                        className={styles.formControl}
                                        value={formState.branch}
                                        onChange={handleFormFieldChange}
                                    >
                                        <option value="">--SELECT BRANCH--</option>
                                        {branchOptions.map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                    </select>
                                    {formErrors.branch && <span className={styles.errorText}>{formErrors.branch}</span>}
                                </div>
                            )}

                            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>Select Patient <span className={styles.requiredMark}>*</span></label>
                                <div className={styles.patientSearchRow}>
                                    <div>
                                        <input
                                            list="schedule-patient-search"
                                            type="text"
                                            name="patientName"
                                            className={styles.formControl}
                                            value={showWalkInFields ? formState.patientName : (formState.patientId ? `${formState.patientName}${patientOptions.find((entry) => entry.id === formState.patientId)?.email ? ` (${patientOptions.find((entry) => entry.id === formState.patientId)?.email})` : ''}` : formState.patientName)}
                                            onChange={handleFormFieldChange}
                                            placeholder="Search patient name or email"
                                        />
                                        <datalist id="schedule-patient-search">
                                            {patientSearchOptions.map((option) => (
                                                <option key={option} value={option} />
                                            ))}
                                        </datalist>
                                    </div>
                                    {patientManagementPath && (
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => {
                                                closeFormModal();
                                                navigate(patientManagementPath, { state: { openAddModal: true } });
                                            }}
                                        >
                                            <FaPlus />
                                            Add New Patient
                                        </button>
                                    )}
                                </div>
                                {(formErrors.patientId || formErrors.patientName) && (
                                    <span className={styles.errorText}>{formErrors.patientId || formErrors.patientName}</span>
                                )}
                            </div>

                            {canChooseDentist ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Dentist <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        name="dentistId"
                                        className={styles.formControl}
                                        value={formState.dentistId}
                                        onChange={handleFormFieldChange}
                                        disabled={false}
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
                                    <label className={styles.formLabel}>Dentist</label>
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
                                    <label className={styles.formLabel}>Date <span className={styles.requiredMark}>*</span></label>
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
                                <label className={styles.formLabel}>Status <span className={styles.requiredMark}>*</span></label>
                                <select
                                    name="status"
                                    className={styles.formControl}
                                    value={formState.status}
                                    onChange={handleFormFieldChange}
                                    disabled={showWalkInFields}
                                >
                                    {APPOINTMENT_STATUS_OPTIONS.filter((option) => option.value !== 'completed').map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>
                                    {showWalkInFields ? 'Chief Complaint / Procedure' : 'Procedure'} <span className={styles.requiredMark}>*</span>
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
                                        {procedureOptions.map((procedure) => (
                                            <option key={procedure} value={procedure}>{procedure}</option>
                                        ))}
                                    </select>
                                )}
                                {formErrors.procedure && <span className={styles.errorText}>{formErrors.procedure}</span>}
                            </div>

                            {!showWalkInFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Time <span className={styles.requiredMark}>*</span></label>
                                    {!formState.date || !activeBranch ? (
                                        <div className={styles.helperText}>Select a branch and date first to load available time slots.</div>
                                    ) : loadingSlots ? (
                                        <div className={styles.helperText}>Loading available time slots...</div>
                                    ) : slotError ? (
                                        <div className={styles.helperError}>{slotError}</div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className={styles.helperText}>No available slots for the selected date.</div>
                                    ) : (
                                        <select
                                            name="time"
                                            className={styles.formControl}
                                            value={formState.time}
                                            onChange={handleFormFieldChange}
                                        >
                                            <option value="">Select time</option>
                                            {availableSlots.map((slot) => (
                                                <option key={slot} value={slot}>{to12h(slot)}</option>
                                            ))}
                                        </select>
                                    )}
                                    {formErrors.time && <span className={styles.errorText}>{formErrors.time}</span>}
                                </div>
                            )}

                            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>Notes</label>
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
                            {viewEntry.patientId && isDentist ? (
                                <div className={styles.emptyStateBox}>
                                    <p style={{ margin: '0 0 14px 0' }}>Open the patient record as a full page from the dentist workspace.</p>
                                    <button
                                        type="button"
                                        className={styles.primaryButton}
                                        onClick={() => {
                                            const patientId = viewEntry.patientId;
                                            setViewEntry(null);
                                            navigate(`/dentist/patients/${patientId}/emr`);
                                        }}
                                    >
                                        Open Full EMR Page
                                    </button>
                                </div>
                            ) : viewEntry.patientId ? (
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
                            Appointments and walk-ins are shown in one schedule view, with branch-aware dentist filtering and a patient search flow that matches registration.
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

                        <label className={styles.filterSelectWrap}>
                            <FaFilter className={styles.filterIcon} />
                            <select className={styles.filterSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                                <option value="all">All Types</option>
                                <option value="appointment">Appointments</option>
                                {canViewQueue && <option value="walkin">Walk-ins</option>}
                            </select>
                        </label>

                        <div className={styles.multiSelectWrap}>
                            <button
                                type="button"
                                className={`${styles.filterSelect} ${styles.dropdownLikeButton}`}
                                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                            >
                                {statusFilterLabel}
                            </button>
                            {isStatusMenuOpen && (
                                <div className={styles.multiSelectMenu}>
                                    <label className={styles.multiSelectOption}>
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.length === APPOINTMENT_STATUS_OPTIONS.length}
                                            onChange={() => toggleStatusFilter('all')}
                                        />
                                        <span>All</span>
                                    </label>
                                    {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                                        <label key={option.value} className={styles.multiSelectOption}>
                                            <input
                                                type="checkbox"
                                                checked={statusFilter.includes(option.value)}
                                                onChange={() => toggleStatusFilter(option.value)}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {dateFilter === 'custom' && (
                    <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
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
                    </div>
                )}

                <div className={`${styles.tableContainer} ${wideTable.tableWrapper}`}>
                    <table className={`${styles.userTable} ${wideTable.table}`}>
                        <thead>
                            <tr>
                                <th style={{ width: '42px', textAlign: 'center' }}>#</th>
                                <th>NAME</th>
                                <th style={{ width: '140px' }}>DATE</th>
                                <th style={{ width: '118px' }}>SOURCE</th>
                                <th>DENTIST</th>
                                <th style={{ width: '118px' }}>STATUS</th>
                                <th style={{ width: '96px', textAlign: 'center' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        Loading schedule entries...
                                    </td>
                                </tr>
                            ) : combinedRows.length > 0 ? (
                                combinedRows.map((entry, index) => (
                                    <tr key={`${entry.type}-${entry.id}`}>
                                        <td style={{ textAlign: 'center', width: '42px' }}>{index + 1}</td>
                                        <td className={wideTable.wrapCell}>
                                            <div className={styles.patientCell}>
                                                <strong>{entry.patientName}</strong>
                                                <span>{entry.branch || 'No branch'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.patientCell}>
                                                <strong>{formatDateLabel(entry.date)}</strong>
                                                <span>{entry.time ? to12h(entry.time) : 'Walk-in entry'}</span>
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
                                            <div className={`${styles.actionRow} ${wideTable.iconActions}`}>
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.viewIconButton}`}
                                                    onClick={() => setViewEntry(entry)}
                                                    title="View"
                                                    aria-label="View"
                                                >
                                                    <FaEye />
                                                </button>
                                                {canEditSchedule && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.editIconButton}`}
                                                        onClick={() => openEditModal(entry)}
                                                        title="Update Schedule Entry"
                                                        aria-label="Update Schedule Entry"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                )}
                                                {canEditSchedule && entry.type === 'appointment' && entry.status === 'pending' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.completeIconButton}`}
                                                        onClick={() => openStatusUpdateModal(entry, 'confirmed')}
                                                        title="Prepare and confirm appointment"
                                                        aria-label="Prepare and confirm appointment"
                                                    >
                                                        <FaCheck />
                                                    </button>
                                                )}
                                                {canEditSchedule && entry.type === 'appointment' && entry.status === 'confirmed' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.completeIconButton}`}
                                                        onClick={() => setPendingStatusTarget({ entry, status: 'in-clinic' })}
                                                        title="Mark as In Clinic"
                                                        aria-label="Mark as In Clinic"
                                                    >
                                                        <FaCheck />
                                                    </button>
                                                )}
                                                {canEditSchedule && entry.status !== 'completed' && entry.status !== 'cancelled' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.completeIconButton}`}
                                                        onClick={() => openCompleteModal(entry)}
                                                        title={canMarkEntryComplete(entry) ? 'Mark as Complete' : 'This schedule cannot be completed yet.'}
                                                        aria-label="Mark as Complete"
                                                        disabled={!canMarkEntryComplete(entry)}
                                                    >
                                                        <FaCheck />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
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
                isOpen={isConfirmingSave}
                title="Save Schedule Changes"
                message="Are you sure you want to save these schedule changes? This will immediately update the record."
                confirmText={isSubmitting ? 'Saving...' : 'Yes, Save Changes'}
                onConfirm={submitScheduleForm}
                onCancel={() => !isSubmitting && setIsConfirmingSave(false)}
            />
            <ConfirmModal
                isOpen={!!pendingStatusTarget}
                title="Update Appointment Status"
                message={`Are you sure you want to update the status into ${pendingStatusTarget?.status ? APPOINTMENT_STATUS_LABELS[pendingStatusTarget.status] : 'the selected status'}?`}
                confirmText={isSubmitting ? 'Updating...' : 'Yes, Update Status'}
                onConfirm={submitQuickStatusUpdate}
                onCancel={() => !isSubmitting && setPendingStatusTarget(null)}
            />
            {completeTarget && (
                <div className={styles.modalOverlay}>
                    <div className={styles.wideModal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Mark Schedule as Complete</h2>
                                <p className={styles.modalSubtitle}>Enter the treatment details so the EMR treatment history is recorded completely in one step.</p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeButton}
                                onClick={() => {
                                    if (isCompleting) return;
                                    setCompleteTarget(null);
                                    setCompletionError('');
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Booked Procedure</label>
                                    <input type="text" className={styles.formControl} value={completeTarget.procedure || ''} disabled />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Procedure Performed <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        className={styles.formControl}
                                        value={completionForm.performedProcedure}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setCompletionForm((prev) => ({
                                                ...prev,
                                                performedProcedure: value,
                                                category: prev.category === 'Other' || !prev.category ? inferTreatmentCategory(value) : prev.category,
                                            }));
                                            setCompletionError('');
                                        }}
                                    >
                                        <option value="">Select the procedure performed</option>
                                        {procedureOptions.map((procedure) => (
                                            <option key={procedure} value={procedure}>{procedure}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Treatment Category <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        className={styles.formControl}
                                        value={completionForm.category}
                                        onChange={(event) => {
                                            setCompletionForm((prev) => ({ ...prev, category: event.target.value }));
                                            setCompletionError('');
                                        }}
                                    >
                                        {TREATMENT_CATEGORY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Tooth Number/s</label>
                                    <input
                                        type="text"
                                        className={styles.formControl}
                                        value={completionForm.tooth}
                                        onChange={(event) => setCompletionForm((prev) => ({ ...prev, tooth: event.target.value }))}
                                        placeholder="e.g. 11, 12 or All"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Amount Charged <span className={styles.requiredMark}>*</span></label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={styles.formControl}
                                        value={completionForm.amountCharged}
                                        onChange={(event) => {
                                            setCompletionForm((prev) => ({ ...prev, amountCharged: event.target.value }));
                                            setCompletionError('');
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Amount Paid <span className={styles.requiredMark}>*</span></label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={styles.formControl}
                                        value={completionForm.amountPaid}
                                        onChange={(event) => {
                                            setCompletionForm((prev) => ({ ...prev, amountPaid: event.target.value }));
                                            setCompletionError('');
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Balance</label>
                                    <input
                                        type="text"
                                        className={styles.formControl}
                                        value={`PHP ${Math.max(Number(completionForm.amountCharged || 0) - Number(completionForm.amountPaid || 0), 0).toFixed(2)}`}
                                        disabled
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Next Appointment</label>
                                    <input
                                        type="date"
                                        className={styles.formControl}
                                        value={completionForm.nextAppointment}
                                        onChange={(event) => setCompletionForm((prev) => ({ ...prev, nextAppointment: event.target.value }))}
                                    />
                                </div>
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                    <label className={styles.formLabel}>Dentist Notes <span className={styles.requiredMark}>*</span></label>
                                    <textarea
                                        className={styles.textareaControl}
                                        value={completionForm.notes}
                                        onChange={(event) => {
                                            setCompletionForm((prev) => ({ ...prev, notes: event.target.value }));
                                            setCompletionError('');
                                        }}
                                        placeholder="Describe the procedure, findings, patient condition, and follow-up instructions."
                                        rows={4}
                                    />
                                </div>
                            </div>
                            {completionError && <div className={styles.errorText}>{completionError}</div>}
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => {
                                        if (isCompleting) return;
                                        setCompleteTarget(null);
                                        setCompletionError('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={handleMarkAsComplete}
                                    disabled={isCompleting}
                                >
                                    {isCompleting ? 'Completing...' : 'Yes, Mark Complete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
