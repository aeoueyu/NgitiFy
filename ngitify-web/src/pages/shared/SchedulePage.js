import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaEdit,
    FaEye,
    FaFilter,
    FaCheck,
    FaDownload,
    FaFilePdf,
    FaPlus,
    FaSearch,
    FaTimes,
} from 'react-icons/fa';
import { authFetch, publicFetch } from '../../utils/api';
import { downloadCsvFile, openPrintReport } from '../../utils/exportHelpers';
import { useAuth } from '../../hooks/useAuth';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { useToast } from '../../context/ToastContext';
import PatientEMR from '../admin/PatientEMR';
import RegisterGuestPatient from '../admin/RegisterGuestPatient';
import ConfirmModal from '../../components/common/ConfirmModal';
import wideTable from '../../styles/wideTable.module.css';
import styles from '../../styles/shared/SchedulePage.module.css';

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

const ALL_STATUS_VALUES = APPOINTMENT_STATUS_OPTIONS.map((option) => option.value);
const NEEDS_ACTION_STATUS_VALUES = ['pending', 'confirmed', 'in-clinic'];
const ACTIVE_BOOKING_STATUS_VALUES = ['pending', 'confirmed'];
const HISTORY_STATUS_VALUES = ['completed', 'cancelled'];
const LOCKED_SCHEDULE_STATUSES = new Set(['completed', 'cancelled']);

const WORKFLOW_FILTER_OPTIONS = [
    { value: 'needs-action', label: 'Needs Action', statuses: NEEDS_ACTION_STATUS_VALUES },
    { value: 'active', label: 'Active Only', statuses: ACTIVE_BOOKING_STATUS_VALUES },
    { value: 'history', label: 'History', statuses: HISTORY_STATUS_VALUES },
    { value: 'all', label: 'All Statuses', statuses: ALL_STATUS_VALUES },
];

const STATUS_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in-clinic', 'cancelled'],
    'in-clinic': ['completed'],
    completed: [],
    cancelled: [],
};

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
    { value: 'custom', label: 'Custom' },
];

const EDIT_MODE_CONFIG = {
    full: {
        title: 'Update Schedule Entry',
        subtitle: 'Review and update the editable schedule details below.',
        submitLabel: 'Save Changes',
        confirmMessage: 'Are you sure you want to update this schedule entry?',
    },
    reschedule: {
        title: 'Reschedule Appointment',
        subtitle: 'Move this appointment to a new date or time without changing the patient record.',
        submitLabel: 'Save Reschedule',
        confirmMessage: 'Are you sure you want to reschedule this appointment?',
    },
    reassign: {
        title: 'Reassign Dentist',
        subtitle: 'Change the assigned dentist while keeping the rest of this schedule entry the same.',
        submitLabel: 'Save Assignment',
        confirmMessage: 'Are you sure you want to reassign this schedule entry?',
    },
    notes: {
        title: 'Update Schedule Notes',
        subtitle: 'Add or revise the internal note for this schedule entry.',
        submitLabel: 'Save Notes',
        confirmMessage: 'Are you sure you want to update these notes?',
    },
};

const MANILA_TIME_ZONE = 'Asia/Manila';
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const formatDateKey = (value = new Date()) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(
        dateKeyFormatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const getTodayString = () => formatDateKey(new Date());

const addDaysToDateString = (dateString, daysToAdd) => {
    const baseDate = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(baseDate.getTime())) return dateString;
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    return formatDateKey(baseDate);
};

const findNextAvailableDate = (startDate, blockedDateList = [], maxDaysToCheck = 90) => {
    const blockedSet = new Set(Array.isArray(blockedDateList) ? blockedDateList : []);
    let candidate = startDate || getTodayString();
    for (let index = 0; index <= maxDaysToCheck; index += 1) {
        if (!blockedSet.has(candidate)) return candidate;
        candidate = addDaysToDateString(candidate, 1);
    }
    return startDate || getTodayString();
};

const subtractDaysFromDateString = (dateString, daysToSubtract) => (
    addDaysToDateString(dateString, daysToSubtract * -1)
);

const formatDateInput = (value) => {
    if (!value) return '';
    return formatDateKey(value);
};

const formatDateLabel = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-PH', {
        timeZone: MANILA_TIME_ZONE,
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

const isScheduleLocked = (entry) => LOCKED_SCHEDULE_STATUSES.has(normalizeScheduleStatus(entry?.status));
const isScheduleEditable = (entry) => !['in-clinic', 'completed', 'cancelled'].includes(normalizeScheduleStatus(entry?.status));
const areStatusSetsEqual = (left = [], right = []) => (
    left.length === right.length && left.every((value) => right.includes(value))
);

const deriveWorkflowFilterFromStatuses = (statuses = []) => {
    const matchedPreset = WORKFLOW_FILTER_OPTIONS.find((option) => areStatusSetsEqual(statuses, option.statuses));
    return matchedPreset?.value || 'custom';
};
const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '');
const normalizeSchedulePhoneInput = (value = '') => {
    const digits = normalizePhoneDigits(value);
    if (digits.startsWith('63')) return digits.slice(2, 12);
    if (digits.startsWith('0')) return digits.slice(1, 11);
    if (digits.startsWith('9')) return digits.slice(0, 10);
    return digits.slice(-10);
};

const normalizeAppointment = (appointment) => {
    const normalizedSource = String(appointment.source || '').trim().toLowerCase();
    const sourceKind = normalizedSource === 'walk-in'
        ? 'walkin'
        : (normalizedSource === 'phone call' ? 'phonecall' : 'appointment');
    const sourceLabel = sourceKind === 'walkin'
        ? 'Walk-in'
        : (sourceKind === 'phonecall' ? 'Phone Call' : 'Appointment');
    return {
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
        contactNumber: appointment.patient?.contactNumber || appointment.guestPhone || '',
        source: appointment.source || 'Walk-in',
        sourceKind,
        sourceLabel,
        prioritySort: 1,
        raw: appointment,
    };
};

const isGuestAppointmentEntry = (entry) => (
    entry?.type === 'appointment'
    && !entry?.patientId
    && ['Smile Hub (Online)', 'Phone Call'].includes(entry?.raw?.source || entry?.source)
);

const isAddressComplete = (address) => (
    ['region', 'province', 'city', 'barangay', 'street', 'houseNumber']
        .every((field) => Boolean(address?.[field]))
);

const hasCompleteGuestIntake = (appointment) => (
    Boolean(appointment?.raw?.guestBirthdate) &&
    Boolean(appointment?.raw?.guestGender) &&
    isAddressComplete(appointment?.raw?.guestHomeAddress || appointment?.raw?.guestCurrentAddress || appointment?.raw?.guestPermanentAddress) &&
    Boolean(appointment?.raw?.guestProfile?.occupation) &&
    Boolean(appointment?.raw?.guestEmergencyContact?.name) &&
    Boolean(appointment?.raw?.guestEmergencyContact?.relationship) &&
    Boolean(appointment?.raw?.guestEmergencyContact?.contactNumber) &&
    Boolean(appointment?.raw?.guestDentalHistory?.chiefComplaint) &&
    appointment?.raw?.guestMedicalHistory?.inGoodHealth !== undefined
);

const getGuestPreRegistrationMeta = (appointment) => {
    if (!isGuestAppointmentEntry(appointment)) return null;
    if (appointment?.raw?.preRegistrationCompleted) {
        return { label: 'Ready to Register', tone: 'ready' };
    }
    if (hasCompleteGuestIntake(appointment)) {
        return { label: 'Ready to Register', tone: 'ready' };
    }
    if (appointment?.raw?.preRegistrationTokenExpiry && new Date(appointment.raw.preRegistrationTokenExpiry) < new Date()) {
        return { label: 'Link Expired', tone: 'expired' };
    }
    if (appointment?.status === 'confirmed') {
        return { label: 'Awaiting Guest Info', tone: 'waiting' };
    }
    return null;
};

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
    sourceKind: 'walkin',
    sourceLabel: 'Walk-in',
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

const getSourceBadgeClass = (entry) => {
    if (entry?.sourceKind === 'walkin') return styles.sourceBadgeWalkin;
    if (entry?.sourceKind === 'phonecall') return styles.sourceBadgePhone;
    return styles.sourceBadgeAppointment;
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
    guestEmail: '',
    assignedDentist: '',
});

export default function SchedulePage() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { config: systemConfig, loading: systemConfigLoading } = useSystemConfig();

    const role = user?.role || '';
    const currentUserId = user?.userId || user?.id || user?._id || '';
    const assignedBranch = user?.assignedBranch || user?.assignedBranches?.[0] || '';

    const isAdmin = role === 'administrator';
    const isOwner = role === 'owner';
    const isBranchManager = role === 'branch-manager';
    const isSecretary = role === 'secretary';
    const isDentist = role === 'dentist';
    const isQueueEnabled = systemConfig?.featureToggles?.queueManagement !== false;

    const canManageQueue = isQueueEnabled && (isAdmin || isBranchManager || isSecretary);
    const canViewQueue = isQueueEnabled && (canManageQueue || isDentist);
    const canCreateSchedule = isAdmin || isOwner || isBranchManager || isSecretary;
    const canEditSchedule = isAdmin || isOwner || isBranchManager || isSecretary;
    const canChooseBranch = isAdmin || isOwner;
    const canChooseDentist = !isDentist;
    const clinicProcedureOptions = useMemo(() => (
        (Array.isArray(systemConfig?.clinicProcedures) ? systemConfig.clinicProcedures : [])
            .map((procedure) => String(procedure || '').trim())
            .filter(Boolean)
    ), [systemConfig?.clinicProcedures]);
    const appointmentProcedureOptions = useMemo(() => {
        const configuredProcedures = (Array.isArray(systemConfig?.onlineBookingProcedures)
            ? systemConfig.onlineBookingProcedures
            : [])
            .map((procedure) => String(procedure || '').trim())
            .filter(Boolean);

        if (configuredProcedures.length > 0) {
            return configuredProcedures;
        }

        if (clinicProcedureOptions.length > 0) {
            return clinicProcedureOptions.slice(0, 2);
        }

        return [];
    }, [clinicProcedureOptions, systemConfig?.onlineBookingProcedures]);

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
    const [workflowFilter, setWorkflowFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState(ALL_STATUS_VALUES);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState('all');
    const [patientFilter, setPatientFilter] = useState('');
    const [procedureFilter, setProcedureFilter] = useState('');
    const [dentistFilter, setDentistFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');

    const [formState, setFormState] = useState(buildInitialForm({ assignedBranch, currentUserId, role }));
    const [formErrors, setFormErrors] = useState({});
    const [editingEntry, setEditingEntry] = useState(null);
    const [editMode, setEditMode] = useState('full');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);
    const [pendingStatusTarget, setPendingStatusTarget] = useState(null);
    const [completeTarget, setCompleteTarget] = useState(null);
    const [guestRegistrationTarget, setGuestRegistrationTarget] = useState(null);
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionForm, setCompletionForm] = useState({
        performedProcedure: '',
        category: 'Other',
        tooth: '',
        amountCharged: '',
        amountPaid: '',
        nextAppointment: '',
    });
    const [completionError, setCompletionError] = useState('');
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [blockedDates, setBlockedDates] = useState([]);
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
        if (workflowFilter === 'needs-action') return 'Needs Action';
        if (workflowFilter === 'active') return 'Active Only';
        if (workflowFilter === 'history') return 'History';
        if (statusFilter.length === ALL_STATUS_VALUES.length) return 'All Statuses';
        if (statusFilter.length === 0) return 'No Status';
        return `${statusFilter.length} Status${statusFilter.length === 1 ? '' : 'es'} Selected`;
    }, [statusFilter, workflowFilter]);
    const resetFormState = useCallback(() => {
        setFormState(buildInitialForm({ assignedBranch, currentUserId, role }));
        setFormErrors({});
        setAllowedSlots([]);
        setTakenSlots([]);
        setSlotError('');
        setEditingEntry(null);
        setEditMode('full');
    }, [assignedBranch, currentUserId, role]);

    const toggleStatusFilter = useCallback((value) => {
        let nextStatuses = [];
        setStatusFilter((prev) => {
            nextStatuses = value === 'all'
                ? ALL_STATUS_VALUES
                : (prev.includes(value)
                    ? prev.filter((entry) => entry !== value)
                    : [...prev, value]);
            return nextStatuses;
        });
        setWorkflowFilter(deriveWorkflowFilterFromStatuses(nextStatuses));
    }, []);

    const applyWorkflowFilter = useCallback((value) => {
        const matchedPreset = WORKFLOW_FILTER_OPTIONS.find((option) => option.value === value);
        if (!matchedPreset) return;
        setWorkflowFilter(matchedPreset.value);
        setStatusFilter(matchedPreset.statuses);
        setIsStatusMenuOpen(false);
    }, []);

    const fetchPageData = useCallback(async ({ silent = false, suppressErrorToast = false } = {}) => {
        if (systemConfigLoading) {
            return;
        }
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
                queueParams.set('includeHistory', 'true');
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
    }, [addToast, assignedBranch, canChooseBranch, canViewQueue, selectedDateRange.from, selectedDateRange.to, systemConfigLoading]);

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
            setBlockedDates([]);
            return;
        }

        const activeBranch = formState.branch || assignedBranch;
        if (!activeBranch) {
            setBlockedDates([]);
            return;
        }

        const activeMonth = formState.date ? formState.date.slice(0, 7) : '';
        const fetchBlockedDates = async () => {
            try {
                const blockedDatesUrl = activeMonth
                    ? `/public/appointments/blocked-dates?branch=${encodeURIComponent(activeBranch)}&month=${activeMonth}`
                    : `/public/appointments/blocked-dates?branch=${encodeURIComponent(activeBranch)}`;
                const response = await publicFetch(
                    blockedDatesUrl
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Could not load blocked dates.');
                }
                setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
            } catch {
                setBlockedDates([]);
            }
        };

        fetchBlockedDates();
    }, [assignedBranch, formState.branch, formState.date, formState.formType, todayString]);

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

    const minBookableDate = useMemo(
        () => findNextAvailableDate(todayString, blockedDates),
        [blockedDates, todayString]
    );

    useEffect(() => {
        if (formState.formType !== 'appointment') return;
        if (!formState.date) return;
        if (formState.date < minBookableDate) {
            setFormState((prev) => ({ ...prev, date: minBookableDate, time: '' }));
        }
    }, [formState.date, formState.formType, minBookableDate]);

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

    const phoneCallDuplicateMatches = useMemo(() => {
        if (formState.source !== 'phonecall' || formState.patientId) return [];

        const normalizedEmail = String(formState.guestEmail || '').trim().toLowerCase();
        const normalizedPhone = normalizePhoneDigits(formState.contactNumber);

        const matches = patientOptions.filter((entry) => {
            const emailMatch = normalizedEmail && String(entry.email || '').trim().toLowerCase() === normalizedEmail;
            const phoneMatch = normalizedPhone && normalizePhoneDigits(entry.contactNumber) === normalizedPhone;
            return emailMatch || phoneMatch;
        });

        return matches.sort((left, right) => {
            const leftEmailMatch = normalizedEmail && String(left.email || '').trim().toLowerCase() === normalizedEmail;
            const rightEmailMatch = normalizedEmail && String(right.email || '').trim().toLowerCase() === normalizedEmail;
            if (leftEmailMatch && !rightEmailMatch) return -1;
            if (!leftEmailMatch && rightEmailMatch) return 1;
            return String(left.name || '').localeCompare(String(right.name || ''));
        });
    }, [formState.contactNumber, formState.guestEmail, formState.patientId, formState.source, patientOptions]);
    const phoneCallExistingPatientMatch = phoneCallDuplicateMatches?.[0] || null;

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
    const reportBranchOptions = useMemo(() => (
        [...new Set([
            ...branches.map((entry) => entry.name),
            ...appointments.map((entry) => entry.branch),
            ...queueEntries.map((entry) => entry.branch),
            assignedBranch,
        ].filter(Boolean))].sort()
    ), [appointments, assignedBranch, branches, queueEntries]);
    const reportDentistOptions = useMemo(() => (
        [...new Set([
            ...dentistOptions.map((entry) => entry.name),
            ...appointments.map((entry) => entry.dentistName),
            ...queueEntries.map((entry) => entry.dentistName),
        ].filter(Boolean))].sort()
    ), [appointments, dentistOptions, queueEntries]);
    const reportProcedureOptions = useMemo(() => (
        [...new Set([
            ...clinicProcedureOptions,
            ...appointments.map((entry) => entry.procedure),
            ...queueEntries.map((entry) => entry.procedure),
        ].filter(Boolean))].sort((left, right) => left.localeCompare(right))
    ), [appointments, clinicProcedureOptions, queueEntries]);

    const scheduleProcedureOptions = useMemo(() => {
        const savedProcedure = String(formState.procedure || '').trim();
        const baseList = formState.formType === 'appointment'
            ? appointmentProcedureOptions
            : clinicProcedureOptions;
        return savedProcedure && !baseList.includes(savedProcedure)
            ? [savedProcedure, ...baseList]
            : baseList;
    }, [appointmentProcedureOptions, clinicProcedureOptions, formState.formType, formState.procedure]);

    const completionProcedureOptions = useMemo(() => {
        const savedProcedure = String(completionForm.performedProcedure || completeTarget?.procedure || '').trim();
        const baseList = clinicProcedureOptions;
        return savedProcedure && !baseList.includes(savedProcedure)
            ? [savedProcedure, ...baseList]
            : baseList;
    }, [clinicProcedureOptions, completeTarget?.procedure, completionForm.performedProcedure]);

    const editingBaseStatus = editingEntry?.status || formState.status || 'pending';
    const editableStatusOptions = useMemo(() => {
        const currentStatus = editingBaseStatus || 'pending';
        if (!editingEntry) {
            return APPOINTMENT_STATUS_OPTIONS.filter((option) => option.value === (formState.status || currentStatus));
        }

        const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
        const allowedValues = [currentStatus, ...allowedTransitions];
        return APPOINTMENT_STATUS_OPTIONS.filter((option) => allowedValues.includes(option.value));
    }, [editingBaseStatus, editingEntry, formState.status]);

    const statusFieldDisabled = useMemo(() => {
        if (!editingEntry) return true;
        if (formState.formType === 'walkin') return true;
        if (editingBaseStatus === 'in-clinic') return true;
        return ['completed', 'cancelled'].includes(editingBaseStatus);
    }, [editingBaseStatus, editingEntry, formState.formType]);

    const patientSearchOptions = useMemo(
        () => patientOptions.map((patient) => `${patient.name}${patient.email ? ` (${patient.email})` : ''}`),
        [patientOptions]
    );
    const resetReportFilters = useCallback(() => {
        setPatientFilter('');
        setProcedureFilter('');
        setDentistFilter('');
        setBranchFilter('');
        setTypeFilter('all');
        setSearchQuery('');
        setDateFilter('all');
        setCustomDateFrom(todayString);
        setCustomDateTo(todayString);
        applyWorkflowFilter('all');
    }, [applyWorkflowFilter, todayString]);

    const rowsBeforeStatusFilter = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const normalizedPatientFilter = patientFilter.trim().toLowerCase();
        const normalizedProcedureFilter = procedureFilter.trim().toLowerCase();
        const normalizedDentistFilter = dentistFilter.trim().toLowerCase();
        const normalizedBranchFilter = branchFilter.trim().toLowerCase();
        const rows = [
            ...appointments,
            ...queueEntries.filter((entry) => !entry.linkedAppointmentId),
        ];

        return rows.filter((entry) => {
            const matchesType = typeFilter === 'all'
                || (typeFilter === 'walkin'
                    ? entry.sourceKind === 'walkin'
                    : (typeFilter === 'phonecall'
                        ? entry.sourceKind === 'phonecall'
                        : entry.sourceKind === 'appointment'));
            const matchesPatient = !normalizedPatientFilter || String(entry.patientName || '').toLowerCase().includes(normalizedPatientFilter);
            const matchesProcedure = !normalizedProcedureFilter || String(entry.procedure || '').toLowerCase() === normalizedProcedureFilter;
            const matchesDentist = !normalizedDentistFilter || String(entry.dentistName || '').toLowerCase() === normalizedDentistFilter;
            const matchesBranch = !normalizedBranchFilter || String(entry.branch || '').toLowerCase() === normalizedBranchFilter;
            if (!matchesType || !matchesPatient || !matchesProcedure || !matchesDentist || !matchesBranch) {
                return false;
            }
            if (!normalizedQuery) return true;

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

            return haystack.includes(normalizedQuery);
        });
    }, [appointments, branchFilter, dentistFilter, patientFilter, procedureFilter, queueEntries, searchQuery, typeFilter]);

    const combinedRows = useMemo(() => (
        rowsBeforeStatusFilter
            .filter((entry) => statusFilter.length === 0 || statusFilter.includes(entry.status))
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
            })
    ), [rowsBeforeStatusFilter, statusFilter]);
    const exportRows = useMemo(() => (
        combinedRows.map((entry) => ([
            entry.patientName || 'Unknown Patient',
            formatDateLabel(entry.date),
            entry.time ? to12h(entry.time) : 'Walk-in entry',
            entry.sourceLabel || 'Appointment',
            entry.dentistName || 'Unassigned',
            entry.branch || 'No branch',
            entry.procedure || '-',
            entry.statusLabel || 'Pending',
            entry.contactNumber ? `+63 ${normalizeSchedulePhoneInput(entry.contactNumber)}` : '',
            entry.notes || '',
            formatCreatedAt(entry.createdAt),
        ]))
    ), [combinedRows]);
    const handleExportCsv = useCallback(() => {
        downloadCsvFile(
            `schedule_records_${new Date().toISOString().slice(0, 10)}.csv`,
            ['Patient Name', 'Date', 'Time', 'Source', 'Dentist', 'Branch', 'Procedure', 'Status', 'Contact Number', 'Notes', 'Created At'],
            exportRows,
        );
    }, [exportRows]);
    const handleExportPdf = useCallback(() => {
        openPrintReport({
            title: 'Schedule Records Report',
            subtitle: 'Dentime Dental Clinic - NgitiFy',
            summaryItems: [
                { label: 'Visible Records', value: combinedRows.length },
                { label: 'Date Filter', value: dateFilter === 'custom' ? `${customDateFrom || '-'} to ${customDateTo || '-'}` : DATE_FILTER_OPTIONS.find((option) => option.value === dateFilter)?.label || 'All' },
                { label: 'Source Filter', value: typeFilter === 'all' ? 'All Types' : (typeFilter === 'phonecall' ? 'Phone Calls' : (typeFilter === 'walkin' ? 'Walk-ins' : 'Appointments')) },
                { label: 'Status Filter', value: statusFilterLabel },
                { label: 'Patient Filter', value: patientFilter || 'All Patients' },
                { label: 'Procedure Filter', value: procedureFilter || 'All Procedures' },
                { label: 'Dentist Filter', value: dentistFilter || 'All Dentists' },
                { label: 'Branch Filter', value: branchFilter || 'All Branches' },
            ],
            sections: [
                {
                    title: 'Schedule Listing',
                    headers: ['Patient Name', 'Date', 'Time', 'Source', 'Dentist', 'Branch', 'Procedure', 'Status', 'Contact Number', 'Notes', 'Created At'],
                    rows: exportRows,
                },
            ],
            orientation: 'landscape',
        });
    }, [branchFilter, combinedRows.length, customDateFrom, customDateTo, dateFilter, dentistFilter, exportRows, patientFilter, procedureFilter, statusFilterLabel, typeFilter]);

    const openCreateModal = () => {
        resetFormState();
        setEditMode('full');
        setIsFormOpen(true);
    };

    const openEditModal = (entry, mode = 'full') => {
        if (!isScheduleEditable(entry)) {
            addToast(
                normalizeScheduleStatus(entry?.status) === 'in-clinic'
                    ? 'In-clinic schedules can no longer be edited. Use the complete action to finish the visit.'
                    : 'Completed and cancelled schedules can no longer be edited.',
                'info'
            );
            return;
        }
        if (isScheduleLocked(entry)) {
            addToast('Completed and cancelled schedules can no longer be edited.', 'info');
            return;
        }

        const nextState = {
            formType: entry.sourceKind === 'walkin' ? 'walkin' : 'appointment',
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
            source: entry.sourceKind === 'walkin'
                ? 'walkin'
                : (entry.sourceKind === 'phonecall' ? 'phonecall' : 'appointment'),
            contactNumber: normalizeSchedulePhoneInput(entry.contactNumber || ''),
            guestEmail: entry?.raw?.guestEmail || '',
            assignedDentist: entry.sourceKind === 'walkin' ? (entry.dentistName === 'Unassigned' ? '' : entry.dentistName) : '',
        };
        setFormState(nextState);
        setFormErrors({});
        setEditingEntry(entry);
        setEditMode(mode);
        setIsFormOpen(true);
    };

    const closeFormModal = () => {
        setIsFormOpen(false);
        setEditMode('full');
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

    const selectExistingPhoneCallPatient = useCallback((matchedPatient) => {
        if (!matchedPatient?.id) return;

        setFormState((prev) => {
            const next = { ...prev };
            next.patientId = matchedPatient.id;
            next.patientName = matchedPatient.name;
            next.contactNumber = normalizeSchedulePhoneInput(matchedPatient.contactNumber || '');
            next.guestEmail = String(matchedPatient.email || '').trim().toLowerCase();

            if (matchedPatient.branch && matchedPatient.branch !== next.branch) {
                next.branch = matchedPatient.branch;
                next.time = '';
                next.dentistId = '';
                next.assignedDentist = '';
            }

            return next;
        });
        setFormErrors((prev) => {
            const next = { ...prev };
            delete next.patientId;
            delete next.patientName;
            delete next.contactNumber;
            delete next.guestEmail;
            return next;
        });
    }, []);

    const handleFormFieldChange = (event) => {
        const { name, value } = event.target;
        setFormState((prev) => {
            const nextValue = name === 'contactNumber'
                ? normalizeSchedulePhoneInput(value)
                : (name === 'guestEmail' ? String(value || '').trim().toLowerCase() : value);
            const next = { ...prev, [name]: nextValue };
            const applyMatchedPatient = (matchedPatient) => {
                next.patientId = matchedPatient.id;
                next.patientName = matchedPatient.name;
                next.contactNumber = normalizeSchedulePhoneInput(matchedPatient.contactNumber);
                next.guestEmail = '';

                if (matchedPatient.branch && matchedPatient.branch !== next.branch) {
                    next.branch = matchedPatient.branch;
                    next.time = '';
                    next.dentistId = '';
                    next.assignedDentist = '';
                }
            };
            const matchPatientByIdentity = ({ email = '', phone = '' }) => patientOptions.find((entry) => (
                (email && String(entry.email || '').trim().toLowerCase() === String(email).trim().toLowerCase())
                || (phone && normalizePhoneDigits(entry.contactNumber) === normalizePhoneDigits(phone))
            )) || null;

            if (name === 'source') {
                const nextType = value === 'walkin' ? 'walkin' : 'appointment';
                next.formType = nextType;
                if (value === 'walkin') {
                    next.status = 'in-clinic';
                } else if (value === 'phonecall') {
                    next.status = 'confirmed';
                    next.contactNumber = '';
                } else {
                    next.status = 'pending';
                    next.guestEmail = '';
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
                    nextValue === entry.name
                    || nextValue === entry.email
                    || nextValue === `${entry.name}${entry.email ? ` (${entry.email})` : ''}`
                ));
                if (matchedPatient) {
                    applyMatchedPatient(matchedPatient);
                } else if (prev.formType === 'walkin' || prev.source === 'phonecall') {
                    next.patientId = '';
                }
            }
            if (prev.source === 'phonecall' && !prev.patientId && (name === 'guestEmail' || name === 'contactNumber')) {
                const matchedPatient = matchPatientByIdentity({
                    email: name === 'guestEmail' ? nextValue : next.guestEmail,
                    phone: name === 'contactNumber' ? nextValue : next.contactNumber,
                });
                if (matchedPatient) {
                    applyMatchedPatient(matchedPatient);
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
        if (['patientId', 'patientName', 'contactNumber', 'guestEmail'].includes(name) && formErrors.patientId) {
            setFormErrors((prev) => ({ ...prev, patientId: '' }));
        }
    };

    const validateForm = () => {
        const nextErrors = {};
        const activeBranch = formState.branch || assignedBranch;
        const isGuestAppointment = isGuestAppointmentEntry(editingEntry);
        const isPhoneCallGuest = formState.source === 'phonecall' && !formState.patientId;
        const activeEditMode = editingEntry ? editMode : 'full';
        const requiresIdentityFields = !editingEntry || activeEditMode === 'full';
        const requiresDentistField = !editingEntry || ['full', 'reassign'].includes(activeEditMode);
        const requiresDateFields = formState.formType !== 'walkin' && (!editingEntry || ['full', 'reschedule'].includes(activeEditMode));
        const requiresProcedureField = !editingEntry || activeEditMode === 'full';
        const shouldCheckPhoneCallDuplicates = isPhoneCallGuest && requiresIdentityFields;

        if (!activeBranch) nextErrors.branch = 'Select a branch.';
        if ((!editingEntry || activeEditMode === 'full') && !formState.source) nextErrors.source = 'Select a source.';
        if (formState.formType === 'appointment') {
            if (requiresIdentityFields && !formState.patientId && !isGuestAppointment && !isPhoneCallGuest) nextErrors.patientId = 'Select a patient.';
            if (requiresIdentityFields && isPhoneCallGuest && !formState.patientName.trim()) nextErrors.patientName = 'Enter the caller or patient name.';
            if (requiresDentistField && !formState.dentistId && canChooseDentist) nextErrors.dentistId = 'Select a dentist.';
            if (requiresDateFields && !formState.date) nextErrors.date = 'Choose an appointment date.';
            if (requiresDateFields && formState.date && blockedDates.includes(formState.date)) {
                nextErrors.date = formState.date === todayString
                    ? 'Same-day booking is no longer available for today. Please choose another date.'
                    : 'That appointment date is no longer available. Please choose another date.';
            }
            if (requiresDateFields && formState.date && formState.date < minBookableDate) {
                nextErrors.date = 'Choose the next available appointment date.';
            }
            if (requiresDateFields && !formState.time) nextErrors.time = 'Choose an appointment time.';
            if (requiresDateFields && formState.status !== 'in-clinic' && formState.time && !availableSlots.includes(formState.time)) {
                nextErrors.time = 'Choose one of the available time slots.';
            }
            if (requiresProcedureField && !formState.procedure) nextErrors.procedure = 'Select a procedure.';
            if (requiresIdentityFields && isPhoneCallGuest) {
                if (!formState.contactNumber.trim()) {
                    nextErrors.contactNumber = 'Enter the caller contact number.';
                } else if (!/^9\d{9}$/.test(formState.contactNumber.trim())) {
                    nextErrors.contactNumber = 'Use the 9xxxxxxxxx mobile format.';
                }
                if (!formState.guestEmail.trim()) {
                    nextErrors.guestEmail = 'Enter the caller email address.';
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.guestEmail.trim())) {
                    nextErrors.guestEmail = 'Enter a valid email address.';
                }
                if (shouldCheckPhoneCallDuplicates && phoneCallDuplicateMatches.length > 0) {
                    nextErrors.patientId = phoneCallDuplicateMatches.length > 1
                        ? 'This phone number or email matches multiple patient accounts. Select the correct existing patient account before saving this phone-call booking.'
                        : 'This phone number or email already belongs to an existing patient. Select that patient account instead of saving a new guest booking.';
                }
            }
        } else {
            if (!formState.patientName.trim()) nextErrors.patientName = 'Enter the walk-in patient name.';
            if (requiresProcedureField && !formState.procedure.trim()) nextErrors.procedure = 'Select a procedure.';
        }

        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submitScheduleForm = async () => {
        const activeBranch = formState.branch || assignedBranch;
        setIsSubmitting(true);
        try {
            if (formState.formType === 'appointment') {
                const isGuestAppointment = isGuestAppointmentEntry(editingEntry);
                const isPhoneCallGuest = formState.source === 'phonecall' && !formState.patientId;
                const mappedSource = formState.source === 'phonecall'
                    ? 'Phone Call'
                    : (isGuestAppointment ? (editingEntry?.raw?.source || 'Smile Hub (Online)') : 'Appointment');
                const payload = {
                    patient: formState.patientId || null,
                    dentist: canChooseDentist ? formState.dentistId : currentUserId,
                    branch: activeBranch,
                    date: formState.date,
                    time: formState.time,
                    procedure: formState.procedure,
                    notes: formState.notes,
                    status: formState.status,
                    source: mappedSource,
                    ...(isGuestAppointment ? { guestName: formState.patientName.trim() || editingEntry?.raw?.guestName || '' } : {}),
                    ...(isPhoneCallGuest ? {
                        guestName: formState.patientName.trim(),
                        guestPhone: formState.contactNumber.trim(),
                        guestEmail: formState.guestEmail.trim().toLowerCase(),
                    } : {}),
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
                    if (data.field) {
                        const nextField = data.field === 'patient' ? 'patientId' : data.field;
                        setFormErrors((prev) => ({ ...prev, [nextField]: data.message || 'Please review this field.' }));
                    }
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
                const walkInAppointmentId = editingEntry?.type === 'appointment'
                    ? editingEntry.id
                    : (editingEntry?.linkedAppointmentId || '');
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

                const isLegacyQueueEdit = editingEntry?.type === 'walkin' && !walkInAppointmentId;
                const endpoint = isLegacyQueueEdit
                    ? `/queue/${editingEntry.id}`
                    : (walkInAppointmentId ? `/appointments/${walkInAppointmentId}` : '/appointments');
                const method = isLegacyQueueEdit
                    ? 'PUT'
                    : (walkInAppointmentId ? 'PUT' : 'POST');
                const requestBody = isLegacyQueueEdit
                    ? {
                        patientName: formState.patientName.trim(),
                        patientId: formState.patientId || '',
                        branch: activeBranch,
                        assignedDentist: dentistOptions.find((entry) => entry.id === formState.dentistId)?.name
                            || formState.assignedDentist
                            || '',
                        procedureType: formState.procedure.trim(),
                        contactNumber: formState.contactNumber.trim(),
                        status: 'in-clinic',
                    }
                    : payload;

                const response = await authFetch(endpoint, {
                    method,
                    body: JSON.stringify(requestBody),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save the walk-in appointment.');
                }
                addToast(
                    walkInAppointmentId || isLegacyQueueEdit
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
        if (!editingEntry) {
            await submitScheduleForm();
            return;
        }
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
        if (!completionForm.performedProcedure || !completionForm.category || completionForm.amountCharged === '' || completionForm.amountPaid === '') {
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

    const handleConfirmGuestAppointment = async (entry) => {
        if (!entry?.id) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/appointments/${entry.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'confirmed' }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to confirm guest appointment.');
            addToast('Guest appointment confirmed. A pre-registration link was sent to the guest.', 'success');
            await fetchPageData({ silent: true });
            if (viewEntry?.id === entry.id) {
                setViewEntry(null);
            }
        } catch (error) {
            addToast(error.message || 'Failed to confirm guest appointment.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendPreRegistration = async (entry) => {
        if (!entry?.id) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/admin/appointments/${entry.id}/resend-pre-register`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to resend pre-registration link.');
            addToast(data.message || 'Pre-registration link resent successfully.', 'success');
            await fetchPageData({ silent: true });
        } catch (error) {
            addToast(error.message || 'Unable to process guest appointment.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderFormModal = () => {
        if (!isFormOpen) return null;

        const activeBranch = formState.branch || assignedBranch;
        const showWalkInFields = formState.formType === 'walkin';
        const isGuestAppointment = isGuestAppointmentEntry(editingEntry);
        const isPhoneCallGuest = formState.source === 'phonecall' && !formState.patientId;
        const activeEditMode = editingEntry ? editMode : 'full';
        const editModeConfig = EDIT_MODE_CONFIG[activeEditMode] || EDIT_MODE_CONFIG.full;
        const isTaskEditMode = Boolean(editingEntry && activeEditMode !== 'full');
        const showSourceField = !editingEntry || activeEditMode === 'full';
        const showBranchField = canChooseBranch && (!editingEntry || activeEditMode === 'full');
        const showDentistField = !editingEntry || ['full', 'reassign'].includes(activeEditMode);
        const showGuestIdentityFields = isPhoneCallGuest && (!editingEntry || activeEditMode === 'full');
        const showDateField = !showWalkInFields && (!editingEntry || ['full', 'reschedule'].includes(activeEditMode));
        const showStatusField = editingEntry && activeEditMode === 'full';
        const showProcedureField = !editingEntry || activeEditMode === 'full';
        const showNotesField = !editingEntry || ['full', 'notes'].includes(activeEditMode);
        const canEditUnlinkedGuestIdentity = !editingEntry
            || (editingEntry?.type === 'appointment' && !editingEntry?.patientId && editingEntry?.sourceKind === 'phonecall');
        const autoStatusLabel = APPOINTMENT_STATUS_LABELS[formState.status] || 'Pending';
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
                                {editingEntry ? editModeConfig.title : 'Create Schedule Entry'}
                            </h2>
                            <p className={styles.modalSubtitle}>
                                {editingEntry
                                    ? editModeConfig.subtitle
                                    : 'Search an existing patient first, or add a new patient before saving this schedule entry.'}
                            </p>
                        </div>
                        <button type="button" className={styles.closeButton} onClick={closeFormModal}>
                            <FaTimes />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitForm} className={styles.modalBody}>
                        {editingEntry && isTaskEditMode && (
                            <div className={styles.taskEditBanner}>
                                <div className={styles.taskEditPill}>
                                    <span>Patient</span>
                                    <strong>{formState.patientName || 'Walk-in Patient'}</strong>
                                </div>
                                <div className={styles.taskEditPill}>
                                    <span>Branch</span>
                                    <strong>{formState.branch || assignedBranch || '-'}</strong>
                                </div>
                                <div className={styles.taskEditPill}>
                                    <span>Current Schedule</span>
                                    <strong>{editingEntry.type === 'appointment' ? formatDateTimeLabel(formState.date, formState.time) : 'Walk-in / In Clinic'}</strong>
                                </div>
                                <div className={styles.taskEditPill}>
                                    <span>Status</span>
                                    <strong>{APPOINTMENT_STATUS_LABELS[editingEntry.status] || editingEntry.status || 'Pending'}</strong>
                                </div>
                            </div>
                        )}
                        <div className={styles.formGrid}>
                            {showSourceField && (
                                <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Source <span className={styles.requiredMark}>*</span></label>
                                <select
                                    name="source"
                                    className={styles.formControl}
                                    value={formState.source}
                                    onChange={handleFormFieldChange}
                                    disabled={!!editingEntry}
                                >
                                    {SCHEDULE_SOURCE_OPTIONS.filter((option) => canManageQueue || option.value !== 'walkin').map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                {formErrors.source && <span className={styles.errorText}>{formErrors.source}</span>}
                                </div>
                            )}

                            {showBranchField && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Branch <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        name="branch"
                                        className={styles.formControl}
                                        value={formState.branch}
                                        onChange={handleFormFieldChange}
                                        disabled={!!editingEntry}
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
                                <label className={styles.formLabel}>
                                    {editingEntry ? 'Patient Name' : ((isGuestAppointment || formState.source === 'phonecall') ? 'Guest / Patient' : 'Select Patient')}
                                    {!isGuestAppointment && !isPhoneCallGuest && <span className={styles.requiredMark}>*</span>}
                                </label>
                                <div className={styles.patientSearchRow}>
                                    <div>
                                        <input
                                            list="schedule-patient-search"
                                            type="text"
                                            name="patientName"
                                            className={styles.formControl}
                                            value={showWalkInFields || isPhoneCallGuest
                                                ? formState.patientName
                                                : (formState.patientId ? `${formState.patientName}${patientOptions.find((entry) => entry.id === formState.patientId)?.email ? ` (${patientOptions.find((entry) => entry.id === formState.patientId)?.email})` : ''}` : formState.patientName)}
                                            onChange={handleFormFieldChange}
                                            placeholder={editingEntry ? 'Patient name' : ((isGuestAppointment || formState.source === 'phonecall') ? 'Guest name or linked patient' : 'Search patient name or email')}
                                            disabled={!canEditUnlinkedGuestIdentity || isTaskEditMode}
                                        />
                                        {canEditUnlinkedGuestIdentity && !isTaskEditMode && (
                                            <datalist id="schedule-patient-search">
                                                {patientSearchOptions.map((option) => (
                                                    <option key={option} value={option} />
                                                ))}
                                            </datalist>
                                        )}
                                    </div>
                                    {!editingEntry && !isTaskEditMode && patientManagementPath && (
                                        <button
                                            type="button"
                                            className={`${styles.primaryButton} ${styles.addPatientButton}`}
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
                                {phoneCallDuplicateMatches.length > 0 && (
                                    <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                                        <span className={styles.helperError}>
                                            {phoneCallDuplicateMatches.length > 1
                                                ? 'Multiple existing patient accounts use this caller mobile number or email. Select the correct patient before saving this phone-call booking.'
                                                : `Possible duplicate found: ${phoneCallExistingPatientMatch?.name || 'Existing patient'}${phoneCallExistingPatientMatch?.email ? ` (${phoneCallExistingPatientMatch.email})` : ''}. Select the existing patient account before saving this phone-call booking.`}
                                        </span>
                                        {phoneCallDuplicateMatches.map((patient) => (
                                            <div
                                                key={patient.id}
                                                style={{
                                                    border: '1px solid #dbeafe',
                                                    borderRadius: '14px',
                                                    background: '#f8fbff',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <div style={{ display: 'grid', gap: '4px' }}>
                                                    <strong style={{ color: '#0f172a' }}>{patient.name}</strong>
                                                    <span style={{ color: '#475569', fontSize: '13px' }}>
                                                        {[patient.email || '', patient.contactNumber ? `+63 ${normalizeSchedulePhoneInput(patient.contactNumber)}` : '', patient.branch || ''].filter(Boolean).join(' | ')}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={() => selectExistingPhoneCallPatient(patient)}
                                                >
                                                    Use This Patient
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {showDentistField && (canChooseDentist ? (
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
                            ))}

                            {showGuestIdentityFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Contact Number <span className={styles.requiredMark}>*</span></label>
                                    <div className={styles.helperText} style={{ marginBottom: '8px' }}>Use the caller&apos;s mobile number in 9xxxxxxxxx format so they can complete registration later.</div>
                                    <div className={`${styles.phoneInputGroup} ${formErrors.contactNumber ? styles.errorBorder : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input
                                            type="text"
                                            name="contactNumber"
                                            className={styles.phoneField}
                                            value={formState.contactNumber}
                                            onChange={handleFormFieldChange}
                                            placeholder="9xxxxxxxxx"
                                            maxLength={10}
                                            inputMode="numeric"
                                        />
                                    </div>
                                    {formErrors.contactNumber && <span className={styles.errorText}>{formErrors.contactNumber}</span>}
                                </div>
                            )}

                            {showWalkInFields && activeEditMode === 'full' ? (
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
                            ) : showDateField ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Date <span className={styles.requiredMark}>*</span></label>
                                    <input
                                        type="date"
                                        name="date"
                                        className={styles.formControl}
                                        value={formState.date}
                                        onChange={handleFormFieldChange}
                                        min={minBookableDate}
                                    />
                                    {blockedDates.includes(todayString) && minBookableDate !== todayString && (
                                        <span className={styles.helperText}>Today is no longer bookable because all remaining clinic slots have passed or are already taken.</span>
                                    )}
                                    {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                                </div>
                            ) : null}

                            {showStatusField ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Status <span className={styles.requiredMark}>*</span></label>
                                    <select
                                        name="status"
                                        className={styles.formControl}
                                        value={formState.status}
                                        onChange={handleFormFieldChange}
                                        disabled={statusFieldDisabled}
                                    >
                                        {editableStatusOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {statusFieldDisabled && editingEntry && editingBaseStatus === 'in-clinic' && (
                                        <span className={styles.helperText}>Use the complete action to mark an in-clinic schedule as completed.</span>
                                    )}
                                    {statusFieldDisabled && editingEntry && ['completed', 'cancelled'].includes(editingBaseStatus) && (
                                        <span className={styles.helperText}>Completed and cancelled schedules can no longer change status.</span>
                                    )}
                                </div>
                            ) : !editingEntry ? (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Status</label>
                                    <div className={styles.helperText}>This entry will be created as <strong>{autoStatusLabel}</strong> based on the selected source.</div>
                                </div>
                            ) : null}

                            {showGuestIdentityFields && (
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Email Address <span className={styles.requiredMark}>*</span></label>
                                    <div className={styles.helperText} style={{ marginBottom: '8px' }}>We&apos;ll use this to send the pre-registration link after the booking is saved.</div>
                                    <input
                                        type="email"
                                        name="guestEmail"
                                        className={styles.formControl}
                                        value={formState.guestEmail}
                                        onChange={handleFormFieldChange}
                                        placeholder="name@example.com"
                                    />
                                    {formErrors.guestEmail && <span className={styles.errorText}>{formErrors.guestEmail}</span>}
                                </div>
                            )}

                            {showProcedureField && (
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                <label className={styles.formLabel}>
                                    Procedure <span className={styles.requiredMark}>*</span>
                                </label>
                                <select
                                    name="procedure"
                                    className={styles.formControl}
                                    value={formState.procedure}
                                    onChange={handleFormFieldChange}
                                >
                                    <option value="">Select procedure</option>
                                    {scheduleProcedureOptions.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                                {formErrors.procedure && <span className={styles.errorText}>{formErrors.procedure}</span>}
                                </div>
                            )}

                            {showDateField && (
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

                            {showNotesField && (
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
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={closeFormModal} disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editingEntry ? editModeConfig.submitLabel : 'Create Entry'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const renderViewModal = () => {
        if (!viewEntry) return null;
        const guestPreRegistrationMeta = getGuestPreRegistrationMeta(viewEntry);

        return (
            <div className={styles.modalOverlay}>
                <div className={styles.viewerModal}>
                    <div className={styles.modalHeader}>
                        <div>
                            <h2 className={styles.modalTitle}>Schedule Details</h2>
                            <p className={styles.modalSubtitle}>
                                {viewEntry.type === 'appointment'
                                    ? (viewEntry.patientId
                                        ? 'Appointment details with linked patient record.'
                                        : 'Appointment details with no linked patient record yet.')
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
                                <span className={styles.summaryValue}>{viewEntry.sourceLabel || 'Appointment'}</span>
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
                            {isGuestAppointmentEntry(viewEntry) && (
                                <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
                                    <div className={styles.detailItem}>
                                        <dt>Guest Registration Status</dt>
                                        <dd>{guestPreRegistrationMeta?.label || 'Pending Confirmation'}</dd>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {viewEntry.status === 'pending' && (
                                            <button
                                                type="button"
                                                className={styles.primaryButton}
                                                onClick={() => handleConfirmGuestAppointment(viewEntry)}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? 'Confirming...' : 'Confirm Request'}
                                            </button>
                                        )}
                                        {viewEntry.status === 'confirmed' && guestPreRegistrationMeta?.label === 'Ready to Register' && (
                                            <button
                                                type="button"
                                                className={styles.primaryButton}
                                                onClick={() => setGuestRegistrationTarget(viewEntry)}
                                            >
                                                Register / Link Patient
                                            </button>
                                        )}
                                        {viewEntry.status === 'confirmed' && guestPreRegistrationMeta?.label !== 'Ready to Register' && (
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                onClick={() => handleResendPreRegistration(viewEntry)}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? 'Sending...' : 'Resend Link'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {canEditSchedule && isScheduleEditable(viewEntry) && (
                                <div className={styles.workflowActionPanel}>
                                    <div className={styles.workflowActionHeader}>
                                        <strong>Quick Update Actions</strong>
                                        <span>Use a focused update path for faster schedule changes.</span>
                                    </div>
                                    <div className={styles.workflowActionGrid}>
                                        {viewEntry.type === 'appointment' && viewEntry.status !== 'in-clinic' && (
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                onClick={() => {
                                                    setViewEntry(null);
                                                    openEditModal(viewEntry, 'reschedule');
                                                }}
                                            >
                                                Reschedule
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => {
                                                setViewEntry(null);
                                                openEditModal(viewEntry, 'reassign');
                                            }}
                                        >
                                            Reassign Dentist
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => {
                                                setViewEntry(null);
                                                openEditModal(viewEntry, 'notes');
                                            }}
                                        >
                                            Update Notes
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.primaryButton}
                                            onClick={() => {
                                                setViewEntry(null);
                                                openEditModal(viewEntry, 'full');
                                            }}
                                        >
                                            Full Update
                                        </button>
                                    </div>
                                </div>
                            )}
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
                    <div className={styles.headerContent}>
                        <h1 className={styles.pageTitle}>Schedule Management</h1>
                        <p className={styles.pageSubtitle}>
                            Appointments, phone calls, and walk-ins are shown in one schedule view, with branch-aware dentist filtering, multi-filter record exports, and a patient search flow that matches registration.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleExportPdf}
                            disabled={combinedRows.length === 0}
                        >
                            <FaFilePdf />
                            Export PDF
                        </button>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleExportCsv}
                            disabled={combinedRows.length === 0}
                        >
                            <FaDownload />
                            Export CSV
                        </button>
                        {canCreateSchedule && (
                            <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                                <FaPlus />
                                Add Schedule Entry
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.toolbar}>
                    <div className={`${styles.toolbarFilters} ${styles.inlineFilterRow}`}>
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
                                <option value="phonecall">Phone Calls</option>
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
                            <span className={styles.rangeHint}>Use the same From and To date for a single-day schedule export.</span>
                        </div>
                    </div>
                )}

                <div className={styles.reportFilterPanel}>
                    <div className={styles.reportFilterHeader}>
                        <div>
                            <strong>Schedule Record Filters</strong>
                            <span>Combine patient, procedure, dentist, branch, source, date, and status before exporting.</span>
                        </div>
                        <button type="button" className={styles.secondaryButton} onClick={resetReportFilters}>
                            Clear Filters
                        </button>
                    </div>
                    <div className={styles.reportFilterGrid}>
                        <label className={styles.filterField}>
                            <span>Patient Name</span>
                            <input
                                type="search"
                                value={patientFilter}
                                onChange={(event) => setPatientFilter(event.target.value)}
                                placeholder="Filter by patient name"
                                className={styles.searchInput}
                            />
                        </label>
                        <label className={styles.filterField}>
                            <span>Procedure</span>
                            <select
                                className={styles.filterSelect}
                                value={procedureFilter}
                                onChange={(event) => setProcedureFilter(event.target.value)}
                            >
                                <option value="">All Procedures</option>
                                {reportProcedureOptions.map((procedure) => (
                                    <option key={procedure} value={procedure}>{procedure}</option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.filterField}>
                            <span>Dentist</span>
                            <select
                                className={styles.filterSelect}
                                value={dentistFilter}
                                onChange={(event) => setDentistFilter(event.target.value)}
                            >
                                <option value="">All Dentists</option>
                                {reportDentistOptions.map((dentistName) => (
                                    <option key={dentistName} value={dentistName}>{dentistName}</option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.filterField}>
                            <span>Branch</span>
                            <select
                                className={styles.filterSelect}
                                value={branchFilter}
                                onChange={(event) => setBranchFilter(event.target.value)}
                            >
                                <option value="">All Branches</option>
                                {reportBranchOptions.map((branchName) => (
                                    <option key={branchName} value={branchName}>{branchName}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

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
                                <th style={{ width: '188px', textAlign: 'center' }}>ACTIONS</th>
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
                                            <span className={`${wideTable.statusBadge} ${getSourceBadgeClass(entry)}`}>
                                                {entry.sourceLabel || 'Appointment'}
                                            </span>
                                        </td>
                                        <td>{entry.dentistName}</td>
                                        <td>
                                            <span className={`${wideTable.statusBadge} ${getBadgeClass(entry)}`}>
                                                {entry.statusLabel}
                                            </span>
                                        </td>
                                        <td className={styles.actionCell}>
                                            <div className={styles.actionGrid}>
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.viewIconButton}`}
                                                    onClick={() => setViewEntry(entry)}
                                                    title="View"
                                                    aria-label="View"
                                                >
                                                    <FaEye />
                                                </button>
                                                {canEditSchedule && isScheduleEditable(entry) && (
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
                                                        onClick={() => setPendingStatusTarget({ entry, status: 'confirmed' })}
                                                        title="Confirm Appointment"
                                                        aria-label="Confirm Appointment"
                                                    >
                                                        <FaCheck />
                                                    </button>
                                                )}
                                                {canEditSchedule && entry.type === 'appointment' && entry.status === 'pending' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.deleteIconButton}`}
                                                        onClick={() => setPendingStatusTarget({ entry, status: 'cancelled' })}
                                                        title="Cancel Appointment"
                                                        aria-label="Cancel Appointment"
                                                    >
                                                        <FaTimes />
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
                                                {canEditSchedule && entry.type === 'appointment' && entry.status === 'confirmed' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.deleteIconButton}`}
                                                        onClick={() => setPendingStatusTarget({ entry, status: 'cancelled' })}
                                                        title="Cancel Appointment"
                                                        aria-label="Cancel Appointment"
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                )}
                                                {canEditSchedule && entry.status === 'in-clinic' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${wideTable.iconAction} ${styles.completeIconButton}`}
                                                        onClick={() => openCompleteModal(entry)}
                                                        title="Mark as Complete"
                                                        aria-label="Mark as Complete"
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
            {guestRegistrationTarget && (
                <RegisterGuestPatient
                    appointment={guestRegistrationTarget}
                    onClose={() => setGuestRegistrationTarget(null)}
                    onSuccess={async () => {
                        setGuestRegistrationTarget(null);
                        setViewEntry(null);
                        await fetchPageData({ silent: true });
                    }}
                />
            )}
            <ConfirmModal
                isOpen={!!editingEntry && isConfirmingSave}
                title={EDIT_MODE_CONFIG[editMode]?.title || 'Update Schedule Entry'}
                message={EDIT_MODE_CONFIG[editMode]?.confirmMessage || 'Are you sure you want to update this schedule entry?'}
                confirmText={isSubmitting ? 'Saving...' : 'Yes, Update Schedule'}
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
                                        {completionProcedureOptions.map((procedure) => (
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
