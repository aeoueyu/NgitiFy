import React, { Fragment, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';
import clinicLogo from '../../assets/images/logo-dentime.svg';

import { useAuth } from '../../hooks/useAuth';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import { regions, provinces, cities } from '../../utils/addressData';
import UserAvatar from '../../components/common/UserAvatar';
import {
    ALLERGY_OPTIONS,
    MEDICAL_CONDITION_OPTIONS,
} from '../../utils/patientIntake';

import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaArrowLeft, FaMapMarkerAlt,
    FaSyringe, FaNotesMedical, FaSearch, FaPlus, FaTimes, FaFilter,
    FaUpload, FaMagic, FaRobot, FaCalendarAlt, FaIdCard, FaFilePdf,
    FaChild, FaVenusMars, FaBirthdayCake
} from 'react-icons/fa';
import Odontogram from '../dentist/Odontogram';

const INITIAL_MEDICAL_HISTORY = {
    lastExam: '',
    bloodType: '',
    allergies: '',
    allergyOther: '',
    conditions: '',
    conditionOther: '',
    medications: '',
    notes: '',
    reasonForConsultation: '',
    physicianName: '',
    physicianSpecialty: '',
    physicianOfficeAddress: '',
    physicianOfficeNumber: '',
    inGoodHealth: '',
    underMedicalTreatment: '',
    medicalTreatmentDetails: '',
    hadSeriousIllnessOrSurgery: '',
    seriousIllnessOrSurgeryDetails: '',
    hadHospitalization: '',
    hospitalizationDetails: '',
    isTakingMedication: '',
    hasAllergies: '',
    usesTobacco: '',
    usesAlcoholOrDrugs: '',
    bleedingTime: '',
    bloodPressure: '',
    isPregnant: '',
    isNursing: '',
    takingBirthControl: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    hasConfidentialInfo: '',
};

const formatAddressDisplay = (addr) => {
    if (!addr) return '—';
    const rName = regions.find(r => r.code === addr.region)?.name || addr.region || '';
    const pName = provinces[addr.region]?.find(p => p.code === addr.province)?.name || addr.province || '';
    const cName = cities[addr.province]?.find(c => c.code === addr.city)?.name || addr.city || '';
    const parts = [addr.houseNumber, addr.street, addr.barangay, cName, pName, rName].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
};

const boolToSelect = (value) => value === true ? 'yes' : value === false ? 'no' : '';
const selectToBool = (value) => value === 'yes' ? true : value === 'no' ? false : undefined;
const yesNoDisplay = (value) => value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not answered';
const textDisplay = (value) => value || 'Not specified';
const DATE_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 Days' },
    { value: '7days', label: '7 Days' },
    { value: 'custom', label: 'Custom' },
];
const getTodayString = () => new Date().toISOString().split('T')[0];
const addDays = (dateString, count) => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + count);
    return date.toISOString().split('T')[0];
};
const formatMoney = (value) => {
    const amount = Number(value || 0);
    return `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const formatShortDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : formatDateShort(parsed);
};
const formatLongDate = (value) => {
    if (!value) return 'Not specified';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not specified' : formatDateLong(parsed);
};
const formatDateTimeLong = (value) => {
    if (!value) return 'Not specified';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not specified';
    return parsed.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
const formatYesNoValue = (value) => {
    if (value === true || value === 'yes') return 'Yes';
    if (value === false || value === 'no') return 'No';
    return 'Not answered';
};
const formatListValue = (value) => {
    if (Array.isArray(value)) {
        const cleaned = value.map((item) => String(item || '').trim()).filter(Boolean);
        return cleaned.length ? cleaned.join(', ') : 'Not specified';
    }
    return value ? String(value) : 'Not specified';
};
const normalizeTextValue = (value) => value ? String(value) : 'Not specified';
const buildDetailRows = (pairs = []) => pairs.map(([label, value]) => [label, value || 'Not specified']);
const normalizeTreatmentNotes = (value) => {
    const text = String(value || '').trim();
    return /^\[AUTO-APPOINTMENT:[^\]]+\]$/.test(text) ? '' : text;
};
const RADIOGRAPH_VARIANT_LABELS = {
    basic: 'Basic Enhance',
    selfHosted: 'Self-Hosted AI',
    huggingFace: 'Hugging Face AI',
};
const getNormalizedEnhancementVariants = (radiograph = {}) => {
    const variants = radiograph.enhancementVariants || {};
    return {
        basic: variants.basic || {},
        selfHosted: variants.selfHosted || {},
        huggingFace: variants.huggingFace || {},
    };
};
const getPreferredRadiographUrl = (radiograph, selectedView = 'latest') => {
    if (!radiograph) return '';
    const originalUrl = radiograph.url || radiograph.imageUrl || '';
    const variants = getNormalizedEnhancementVariants(radiograph);
    if (selectedView === 'original') return originalUrl;
    if (selectedView === 'basic') return variants.basic?.url || radiograph.enhancedUrl || originalUrl;
    if (selectedView === 'selfHosted') return variants.selfHosted?.url || radiograph.enhancedUrl || originalUrl;
    if (selectedView === 'huggingFace') return variants.huggingFace?.url || radiograph.enhancedUrl || originalUrl;
    return radiograph.enhancedUrl || originalUrl;
};
const getRadiographViewOptions = (radiograph) => {
    if (!radiograph) return [];
    const variants = getNormalizedEnhancementVariants(radiograph);
    const options = [
        { key: 'original', label: 'Original', available: Boolean(radiograph.url || radiograph.imageUrl) },
        { key: 'latest', label: 'Latest Saved', available: Boolean(radiograph.enhancedUrl) },
        { key: 'basic', label: 'Basic Enhance', available: Boolean(variants.basic?.url) },
        { key: 'selfHosted', label: 'Self-Hosted AI', available: Boolean(variants.selfHosted?.url) },
        { key: 'huggingFace', label: 'Hugging Face AI', available: Boolean(variants.huggingFace?.url) },
    ];
    return options.filter((option) => option.available);
};
const normalizeRadiographRecord = (radiograph = {}) => {
    const rawDateValue = radiograph.date || radiograph.rawDate || radiograph.uploadedAt || radiograph.createdAt || 0;
    const variants = getNormalizedEnhancementVariants(radiograph);
    return {
        ...radiograph,
        id: radiograph._id || radiograph.id,
        rawDate: new Date(rawDateValue),
        type: radiograph.label || radiograph.type || 'Radiograph',
        url: radiograph.url || radiograph.imageUrl || '',
        enhancedUrl: radiograph.enhancedUrl || '',
        enhancementVariants: variants,
        lastEnhancementEngine: radiograph.lastEnhancementEngine || '',
        radiographNumber: radiograph.radiographNumber || '',
        findings: radiograph.findings || '',
        notes: radiograph.notes || '',
    };
};
const normalizeTreatmentLogRecord = (log = {}) => {
    const rawDateValue = log.date || log.rawDate || log.completedAt || log.createdAt || 0;
    const amountCharged = Number(log.amountCharged ?? 0);
    const amountPaid = Number(log.amountPaid ?? 0);
    const computedBalance = Math.max(amountCharged - amountPaid, 0);
    return {
        ...log,
        id: log._id || log.id,
        rawDate: new Date(rawDateValue),
        procedure: log.procedure || log.performedProcedure || log.treatment || log.service || 'Not specified',
        category: log.category || 'Other',
        dentistName: log.dentistName || log.doctor || log.dentist || '',
        tooth: log.tooth || '',
        branch: log.branch || log.branchName || '',
        notes: normalizeTreatmentNotes(log.notes || log.note || log.remarks || ''),
        amountCharged,
        amountPaid,
        balance: Number(log.balance ?? computedBalance),
        nextAppointment: log.nextAppointment || null,
    };
};
const sanitizeFilenamePart = (value) => String(value || '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
const formatAgeDisplay = (age, fallback = 'Age not specified') => {
    if (age === null || age === undefined || Number.isNaN(age)) return fallback;
    return age === 1 ? '1 year old' : `${age} years old`;
};
const PRINT_WIDE_DETAIL_LABELS = new Set([
    'Home Address',
    'Office Address',
    'Reason for Consultation',
    'Condition Being Treated',
    'Illness or Surgery Details',
    'Hospitalization Details',
    'Medication List',
    'Allergies',
    'Medical Conditions',
    'Clinical Notes and Remarks',
]);
const PRINT_FORCED_DETAIL_PAIRS = new Map([
    ['Under Medical Treatment Now', 'Condition Being Treated'],
    ['Serious Illness or Surgery', 'Illness or Surgery Details'],
    ['Hospitalized Before', 'Hospitalization Details'],
    ['Taking Medication', 'Medication List'],
]);
const TREATMENT_HISTORY_COLUMN_WIDTHS = ['9%', '18%', '10%', '12%', '8%', '10%', '8%', '8%', '8%', '9%'];
const isWidePrintDetail = (label, value) => {
    const normalizedValue = String(value || '').trim();
    return PRINT_WIDE_DETAIL_LABELS.has(label)
        || normalizedValue.includes('\n')
        || normalizedValue.length > 72
        || (normalizedValue.includes(', ') && normalizedValue.length > 54);
};
const buildPrintDetailTableRows = (rows = []) => {
    const groupedRows = [];
    let pairedCells = [];

    for (let index = 0; index < rows.length; index += 1) {
        const [label, value] = rows[index];
        const detailCell = {
            label,
            value: value || 'Not specified',
        };
        const forcedPairLabel = PRINT_FORCED_DETAIL_PAIRS.get(label);
        const nextRow = rows[index + 1];

        if (forcedPairLabel && nextRow?.[0] === forcedPairLabel) {
            if (pairedCells.length) {
                groupedRows.push({ type: 'paired', cells: pairedCells });
                pairedCells = [];
            }

            groupedRows.push({
                type: 'paired',
                cells: [
                    detailCell,
                    {
                        label: nextRow[0],
                        value: nextRow[1] || 'Not specified',
                    },
                ],
            });
            index += 1;
            continue;
        }

        if (isWidePrintDetail(label, detailCell.value)) {
            if (pairedCells.length) {
                groupedRows.push({ type: 'paired', cells: pairedCells });
                pairedCells = [];
            }
            groupedRows.push({ type: 'wide', cell: detailCell });
            continue;
        }

        pairedCells.push(detailCell);
        if (pairedCells.length === 2) {
            groupedRows.push({ type: 'paired', cells: pairedCells });
            pairedCells = [];
        }
    }

    if (pairedCells.length) {
        groupedRows.push({ type: 'paired', cells: pairedCells });
    }

    return groupedRows;
};

const ODONTOGRAM_STAGE_LABELS = {
    existing: 'Existing',
    planned: 'Planned',
    completed: 'Completed',
};

const ODONTOGRAM_STATUS_LABELS = {
    healthy: 'Healthy',
    filled: 'Filled',
    decayed: 'Caries / Decayed',
    crown: 'Crown',
    implant: 'Implant',
    bridge: 'Bridge Pontic',
    'extraction-site': 'Extraction Site',
    missing: 'Missing',
    mobility: 'Mobility',
    fractured: 'Fractured',
    'root-canal': 'Root Canal',
    'under-observation': 'Under Observation',
};

const ODONTOGRAM_WORKFLOW_GUIDE = [
    {
        title: 'Decayed tooth',
        detail: 'Record the current caries as existing, then use planned for restoration, root canal, or extraction depending on restorability. Once done, update completed to the final result such as filled, root-canal, extraction-site, or missing.',
    },
    {
        title: 'Fractured tooth',
        detail: 'Start with the fracture as the current finding, then plan the definitive treatment after radiograph and restorability assessment. Completed can end as restoration, crown, root canal, or extraction.',
    },
    {
        title: 'Mobility or periodontal concern',
        detail: 'Use existing for the current condition, planned for periodontal therapy, splinting, or reassessment, and completed only after the actual intervention or final extraction decision is done.',
    },
    {
        title: 'Extraction or missing tooth',
        detail: 'After removal, mark the result as completed and use planned notes for the next step such as healing review, bridge, denture, or implant evaluation.',
    },
];

const getOdontogramStatusLabel = (statusKey) => ODONTOGRAM_STATUS_LABELS[statusKey] || (statusKey ? String(statusKey) : 'Not specified');
const getOdontogramStageLabel = (stageKey) => ODONTOGRAM_STAGE_LABELS[stageKey] || 'Stage';
const formatSurfaceList = (surfaces) => Array.isArray(surfaces) && surfaces.length > 0 ? surfaces.join(', ') : 'Whole tooth / none specified';

const buildOdontogramLogHeadline = (log) => {
    const stageLabel = getOdontogramStageLabel(log.stage).toLowerCase();
    const nextLabel = getOdontogramStatusLabel(log.statusAfter);
    const previousLabel = getOdontogramStatusLabel(log.statusBefore);

    if (log.eventType === 'created') return `${stageLabel} finding recorded as ${nextLabel}`;
    if (log.eventType === 'cleared') return `${stageLabel} finding cleared from ${previousLabel}`;
    return `${stageLabel} finding updated to ${nextLabel}`;
};

const renderInfoBlock = (stylesRef, label, value, extraClassName = '') => (
    <div className={`${stylesRef.infoBlock} ${extraClassName}`.trim()}>
        <span className={stylesRef.infoLabel}>{label}</span>
        <p className={stylesRef.infoValue}>{value}</p>
    </div>
);

export default function PatientEMR({
    patientId: propPatientId,
    onClose,
    embedded = false,
    roleOverride = '',
    forceReadOnly = false,
}) {
    const urlParams = useParams();
    const activePatientId = propPatientId || urlParams.patientId;
    
    const navigate = useNavigate();
    const { user } = useAuth();
    const { config: systemConfig } = useSystemConfig();
    const { addToast } = useToast();
    const effectiveRole = roleOverride || user?.role || 'administrator';
    const isReadOnly = forceReadOnly || effectiveRole === 'secretary';
    const canEditOdontogram = effectiveRole === 'dentist';
    const radiographUploadsEnabled = systemConfig?.featureToggles?.radiographUploads !== false;
    const canEditMedical = !isReadOnly;
    const canAddTreatmentLog = !isReadOnly;
    const canUploadRadiograph = !isReadOnly && radiographUploadsEnabled;
    const canEnhanceRadiograph = effectiveRole === 'dentist' && radiographUploadsEnabled;
    
    // Core States
    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Tab: Medical History States
    const [medicalHistory, setMedicalHistory] = useState(INITIAL_MEDICAL_HISTORY);
    const [isEditingMedical, setIsEditingMedical] = useState(false);
    const [medicalForm, setMedicalForm] = useState(INITIAL_MEDICAL_HISTORY);
    const [isSavingMedical, setIsSavingMedical] = useState(false);

    // Tab: Treatment Logs States
    const [logs, setLogs] = useState([]);
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsRangeFilter, setLogsRangeFilter] = useState('all');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    
    // Add Log Modal
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [newLogForm, setNewLogForm] = useState({
        date: '',
        procedure: '',
        category: 'General',
        tooth: '',
        amountCharged: '',
        amountPaid: '',
        nextAppointment: '',
        branchId: '',
        notes: '',
    });
    const [expandedLogRows, setExpandedLogRows] = useState({});
    const [odontogramLogs, setOdontogramLogs] = useState([]);
    const [expandedOdontogramLogRows, setExpandedOdontogramLogRows] = useState({});

    // Tab: Radiograph States
    const [radiographs, setRadiographs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancingEngine, setEnhancingEngine] = useState('');
    const [selectedRadiographView, setSelectedRadiographView] = useState('latest');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: '', date: '', radiographNumber: '', findings: '', notes: '' });
    const [uploadPreview, setUploadPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

    const [branches, setBranches] = useState([]);
    const patientFullName = patient?.name?.first
        ? `${patient.name.first}${patient.name.middle ? ` ${patient.name.middle}` : ''} ${patient.name.last}`
        : patient?.name || 'Patient';
    const patientPrimaryBranch = patient?.assignedBranches?.[0] || 'Unassigned';
    const patientAge = patient?.birthdate
        ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
        : null;
    const patientRecordFilename = patient?.name?.first || patient?.name?.last
        ? `DentimeDentalClinicPxRecord_${sanitizeFilenamePart(patient?.name?.last)}${sanitizeFilenamePart(patient?.name?.first)}`
        : `DentimeDentalClinicPxRecord_${sanitizeFilenamePart(patientFullName) || 'PatientRecord'}`;

    const loadOdontogramLogs = async (patientIdToLoad) => {
        if (!patientIdToLoad) {
            setOdontogramLogs([]);
            return;
        }

        try {
            const { authFetch } = await import('../../utils/api');
            const response = await authFetch(`/patients/${patientIdToLoad}/odontogram-logs`);
            if (!response.ok) {
                throw new Error((await response.json()).message || 'Failed to load odontogram history.');
            }

            const data = await response.json();
            const normalized = data.map((log) => ({
                ...log,
                id: log._id || log.id,
                rawCreatedAt: new Date(log.createdAt || log.updatedAt || Date.now()),
            }));
            setOdontogramLogs(normalized.sort((a, b) => b.rawCreatedAt - a.rawCreatedAt));
        } catch (error) {
            console.error('Error fetching odontogram history:', error);
            addToast(error.message || 'Failed to load odontogram history.', 'error');
        }
    };

    useEffect(() => {
        if (effectiveRole === 'patient' || isReadOnly) {
            setBranches([]);
            return undefined;
        }

        const fetchBranches = async () => {
            try {
                const { authFetch } = await import('../../utils/api');
                const res = await authFetch('/branches');
                if (res.ok) setBranches(await res.json());
            } catch (e) { console.error('Error fetching branches:', e); }
        };
        fetchBranches();
    }, [effectiveRole, isReadOnly]);

    useEffect(() => {
        if (!activePatientId) return;

        const fetchPatientData = async () => {
            setIsLoading(true);
            try {
                const { authFetch } = await import('../../utils/api');

                const patientRes = await authFetch(`/patients/${activePatientId}`);
                if (patientRes.ok) {
                    const patientData = await patientRes.json();
                    setPatient(patientData);
                    if (patientData.medicalHistory) {
                        const toCSV = (val) =>
                            Array.isArray(val) ? val.join(', ') : (val || '');

                        const allergyList = Array.isArray(patientData.medicalHistory.allergies) ? patientData.medicalHistory.allergies : [];
                        const conditionList = Array.isArray(patientData.medicalHistory.conditions) ? patientData.medicalHistory.conditions : [];
                        const normalizedHistory = {
                            allergies:   toCSV(allergyList.filter((item) => ALLERGY_OPTIONS.includes(item))),
                            allergyOther: toCSV(allergyList.filter((item) => !ALLERGY_OPTIONS.includes(item))),
                            conditions:  toCSV(conditionList.filter((item) => MEDICAL_CONDITION_OPTIONS.includes(item))),
                            conditionOther: toCSV(conditionList.filter((item) => !MEDICAL_CONDITION_OPTIONS.includes(item))),
                            medications: toCSV(patientData.medicalHistory.medications),
                            bloodType:   patientData.bloodType || patientData.medicalHistory.bloodType || '',
                            notes:       patientData.medicalHistory.notes || '',
                            reasonForConsultation: patientData.reasonForConsultation || patientData.dentalHistory?.chiefComplaint || '',
                            physicianName: patientData.physician?.name || '',
                            physicianSpecialty: patientData.physician?.specialty || '',
                            physicianOfficeAddress: patientData.physician?.officeAddress || '',
                            physicianOfficeNumber: patientData.physician?.officeNumber || '',
                            inGoodHealth: boolToSelect(patientData.medicalHistory.inGoodHealth),
                            underMedicalTreatment: boolToSelect(patientData.medicalHistory.underMedicalTreatment),
                            medicalTreatmentDetails: patientData.medicalHistory.medicalTreatmentDetails || '',
                            hadSeriousIllnessOrSurgery: boolToSelect(patientData.medicalHistory.hadSeriousIllnessOrSurgery),
                            seriousIllnessOrSurgeryDetails: patientData.medicalHistory.seriousIllnessOrSurgeryDetails || '',
                            hadHospitalization: boolToSelect(patientData.medicalHistory.hadHospitalization),
                            hospitalizationDetails: patientData.medicalHistory.hospitalizationDetails || '',
                            isTakingMedication: boolToSelect(patientData.medicalHistory.isTakingMedication),
                            hasAllergies: boolToSelect(patientData.medicalHistory.hasAllergies),
                            usesTobacco: boolToSelect(patientData.medicalHistory.usesTobacco),
                            usesAlcoholOrDrugs: boolToSelect(patientData.medicalHistory.usesAlcoholOrDrugs),
                            bleedingTime: patientData.medicalHistory.bleedingTime || '',
                            bloodPressure: patientData.medicalHistory.bloodPressure || '',
                            isPregnant: boolToSelect(patientData.medicalHistory.isPregnant),
                            isNursing: boolToSelect(patientData.medicalHistory.isNursing),
                            takingBirthControl: boolToSelect(patientData.medicalHistory.takingBirthControl),
                            hadTreatmentReaction: boolToSelect(patientData.dentalHistory?.hadTreatmentReaction),
                            reactionDetails: patientData.dentalHistory?.reactionDetails || '',
                            hasConfidentialInfo: patientData.dentalHistory?.hasConfidentialInfo ? 'yes' : patientData.dentalHistory?.hasConfidentialInfo === false ? 'no' : '',
                            lastExam:    patientData.dentalHistory?.lastExamDate
                                            || patientData.medicalHistory.lastExam
                                            || '',
                        };
                        setMedicalHistory(normalizedHistory);
                        setMedicalForm(normalizedHistory);
                    }
                } else {
                    addToast('Failed to load patient record.', 'error');
                }

                const logsRes = await authFetch(`/patients/${activePatientId}/treatment-logs`);
                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    const normalized = logsData.map(normalizeTreatmentLogRecord);
                    setLogs(normalized.sort((a, b) => b.rawDate - a.rawDate));
                }

                const radRes = await authFetch(`/patients/${activePatientId}/radiographs`);
                if (radRes.ok) {
                    const radData = await radRes.json();
                    const normalizedRads = radData.map(normalizeRadiographRecord);
                    setRadiographs(normalizedRads);
                }

                const odontogramLogsRes = await authFetch(`/patients/${activePatientId}/odontogram-logs`);
                if (odontogramLogsRes.ok) {
                    const odontogramLogsData = await odontogramLogsRes.json();
                    const normalizedOdontogramLogs = odontogramLogsData.map((log) => ({
                        ...log,
                        id: log._id || log.id,
                        rawCreatedAt: new Date(log.createdAt || log.updatedAt || Date.now()),
                    }));
                    setOdontogramLogs(normalizedOdontogramLogs.sort((a, b) => b.rawCreatedAt - a.rawCreatedAt));
                }

            } catch (e) {
                console.error('Error fetching patient data:', e);
                addToast('Could not connect to the server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPatientData();
    }, [activePatientId, addToast]);

    const handleBack = () => {
        if (onClose) onClose(); 
        else navigate(-1); 
    };

    const allergyValues = [
        ...(medicalHistory.allergies ? medicalHistory.allergies.split(',').map((item) => item.trim()) : []),
        ...(medicalHistory.allergyOther ? medicalHistory.allergyOther.split(',').map((item) => item.trim()) : []),
    ].filter(Boolean);
    const conditionValues = [
        ...(medicalHistory.conditions ? medicalHistory.conditions.split(',').map((item) => item.trim()) : []),
        ...(medicalHistory.conditionOther ? medicalHistory.conditionOther.split(',').map((item) => item.trim()) : []),
    ].filter(Boolean);

    const reportSections = patient ? [
        {
            title: 'Patient Profile',
            kind: 'details',
            rows: buildDetailRows([
            ['Gender', patient.gender],
            ['Home Phone', patient.homePhone],
            ['Work Phone', patient.workPhone],
            ['Occupation', patient.occupation],
            ['Civil Status', patient.civilStatus],
            ['Nationality', patient.nationality],
            ['Religion', patient.religion],
            ['Blood Type', patient.bloodType || medicalHistory.bloodType],
            ['Referred By', patient.referredBy],
            ['Registration Date', patient.createdAt ? formatLongDate(patient.createdAt) : 'Not specified'],
            ]),
        },
        ...(patient?.guardian?.name ? [{
            title: 'Guardian Information',
            kind: 'details',
            rows: buildDetailRows([
                ['Guardian Name', patient.guardian.name],
                ['Guardian Occupation', patient.guardian.occupation],
                ['Relationship', patient.guardian.relationship],
                ['Guardian Phone', patient.guardian.contactNumber],
            ]),
        }] : []),
        ...((patient?.emergencyContact?.name || patient?.emergencyContact?.contactNumber) ? [{
            title: 'Emergency Contact',
            kind: 'details',
            rows: buildDetailRows([
                ['Emergency Contact', patient.emergencyContact?.name],
                ['Emergency Phone', patient.emergencyContact?.contactNumber],
                ['Relationship', patient.emergencyContact?.relationship],
            ]),
        }] : []),
        {
            title: 'Medical and Dental History',
            kind: 'details',
            rows: buildDetailRows([
            ...((patient?.physician?.name || patient?.physician?.specialty || patient?.physician?.officeAddress || patient?.physician?.officeNumber) ? [
                ["Physician's Name", patient.physician?.name],
                ['Specialty', patient.physician?.specialty],
                ['Office Address', patient.physician?.officeAddress],
                ['Office Number', patient.physician?.officeNumber],
            ] : []),
            ['Last Dental Visit', medicalHistory.lastExam ? formatLongDate(medicalHistory.lastExam) : 'Not specified'],
            ['Reaction After Dental Treatment', formatYesNoValue(medicalHistory.hadTreatmentReaction)],
            ['Reaction Details', medicalHistory.reactionDetails],
            ['Private or Confidential Discussion Needed', formatYesNoValue(medicalHistory.hasConfidentialInfo)],
            ['In Good Health', formatYesNoValue(medicalHistory.inGoodHealth)],
            ['Under Medical Treatment Now', formatYesNoValue(medicalHistory.underMedicalTreatment)],
            ['Condition Being Treated', medicalHistory.medicalTreatmentDetails],
            ['Serious Illness or Surgery', formatYesNoValue(medicalHistory.hadSeriousIllnessOrSurgery)],
            ['Illness or Surgery Details', medicalHistory.seriousIllnessOrSurgeryDetails],
            ['Hospitalized Before', formatYesNoValue(medicalHistory.hadHospitalization)],
            ['Hospitalization Details', medicalHistory.hospitalizationDetails],
            ['Taking Medication', formatYesNoValue(medicalHistory.isTakingMedication)],
            ['Medication List', formatListValue(medicalHistory.medications)],
            ['Uses Tobacco Products', formatYesNoValue(medicalHistory.usesTobacco)],
            ['Uses Alcohol or Dangerous Drugs', formatYesNoValue(medicalHistory.usesAlcoholOrDrugs)],
            ['Has Allergies', formatYesNoValue(medicalHistory.hasAllergies)],
            ['Allergies', allergyValues.join(', ') || 'Not specified'],
            ['Bleeding Time', medicalHistory.bleedingTime],
            ['Pregnant', formatYesNoValue(medicalHistory.isPregnant)],
            ['Nursing', formatYesNoValue(medicalHistory.isNursing)],
            ['Taking Birth Control Pills', formatYesNoValue(medicalHistory.takingBirthControl)],
            ['Blood Type', medicalHistory.bloodType || patient.bloodType],
            ['Blood Pressure', medicalHistory.bloodPressure],
            ['Medical Conditions', conditionValues.join(', ') || 'Not specified'],
            ['Clinical Notes and Remarks', medicalHistory.notes || 'No clinical notes on record.'],
            ]),
        },
        {
            title: 'Treatment History',
            kind: 'table',
            variant: 'treatmentHistory',
            headers: ['Date', 'Procedure', 'Category', 'Dentist', 'Tooth', 'Branch', 'Charged', 'Paid', 'Balance', 'Next Appointment', 'Notes'],
            rows: logs
                .slice()
                .sort((a, b) => b.rawDate - a.rawDate)
                .map((log) => ([
                formatShortDate(log.rawDate),
                log.procedure || 'Not specified',
                log.category || 'Other',
                log.dentistName || log.doctor || log.dentist || '-',
                log.tooth || '-',
                log.branch || '-',
                formatMoney(log.amountCharged),
                formatMoney(log.amountPaid),
                formatMoney(log.balance),
                formatShortDate(log.nextAppointment),
                log.notes || '-',
                ])),
        },
        {
            title: 'Odontogram',
            kind: 'odontogram',
        },
        {
            title: 'Radiograph Records',
            kind: 'radiographs',
            records: radiographs
                .slice()
                .sort((a, b) => b.rawDate - a.rawDate)
                .map((radiograph) => ({
                ...radiograph,
                displayUrl: getPreferredRadiographUrl(radiograph),
                formattedDate: formatShortDate(radiograph.rawDate),
                displayType: normalizeTextValue(radiograph.type || radiograph.label),
                displayNumber: normalizeTextValue(radiograph.radiographNumber),
                displayFindings: normalizeTextValue(radiograph.findings),
                displayNotes: normalizeTextValue(radiograph.notes),
                })),
        },
    ] : [];

    const handleExportPdf = () => {
        if (!patient) return;
        setIsPrintPreviewOpen(true);
    };

    const handlePrintPreview = () => {
        const previousTitle = document.title;
        document.title = patientRecordFilename;
        window.print();
        window.setTimeout(() => {
            document.title = previousTitle;
        }, 1000);
    };

    useEffect(() => {
        if (!isPrintPreviewOpen || !patient) return undefined;

        const previousTitle = document.title;
        document.title = patientRecordFilename;
        document.body.classList.add('print-record-active');

        const handleAfterPrint = () => {
            document.title = previousTitle;
        };

        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            document.title = previousTitle;
            document.body.classList.remove('print-record-active');
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [isPrintPreviewOpen, patient, patientRecordFilename]);

    const renderPrintPreview = () => (
        isPrintPreviewOpen && patient && typeof document !== 'undefined'
            ? createPortal((
            <div className={styles.printPreviewOverlay}>
                <div className={styles.printPreviewCard}>
                    <div className={styles.printPreviewToolbar}>
                        <div>
                            <h2 className={styles.printPreviewTitle}>Formal Patient Record Preview</h2>
                            <p className={styles.printPreviewSubtitle}>Review the clinic document, then print or choose Save as PDF in the browser dialog.</p>
                        </div>
                        <div className={styles.printPreviewActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setIsPrintPreviewOpen(false)}>
                                Close
                            </button>
                            <button type="button" className={styles.saveBtn} onClick={handlePrintPreview}>
                                Print
                            </button>
                        </div>
                    </div>

                    <div className={styles.printSheet}>
                        <div className={styles.printDocumentFrame}>
                            <header className={styles.printHeader}>
                                <div className={styles.printClinicBanner}>
                                    <div className={styles.printClinicBrand}>
                                        <img src={clinicLogo} alt="Dentime Dental Clinic logo" className={styles.printClinicLogo} />
                                    </div>
                                    <span className={styles.printConfidentialTag}>Confidential Clinic Document</span>
                                </div>

                                <div className={styles.printHeaderTop}>
                                    <div>
                                        <h1>Patient Medical and Dental Record</h1>
                                        <p>Official patient profile, clinical history, odontogram, treatment record, and radiograph notes</p>
                                    </div>
                                    <div className={styles.printHeaderMeta}>
                                        <span className={styles.printMetaBadge}>{patientPrimaryBranch}</span>
                                        <span className={styles.printMetaText}>Generated {formatLongDate(new Date())}</span>
                                    </div>
                                </div>
                            </header>

                            <section className={`${styles.printSection} ${styles.printIdentitySection}`}>
                                <div className={styles.printSectionHeader}>
                                    <div className={styles.printSectionTitleWrap}>
                                        <span className={styles.printSectionNumber}>00</span>
                                        <h3>Patient Identification</h3>
                                    </div>
                                </div>

                                <div className={styles.printIdentityGrid}>
                                    <article className={`${styles.printIdentityItem} ${styles.printIdentitySpanTwo}`}>
                                        <span className={styles.printIdentityLabel}>Patient Name</span>
                                        <strong className={styles.printIdentityValue}>{patientFullName}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Patient ID</span>
                                        <strong className={styles.printIdentityValue}>{patient._id || patient.id || 'Not specified'}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Branch</span>
                                        <strong className={styles.printIdentityValue}>{patientPrimaryBranch}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Assigned Dentist</span>
                                        <strong className={styles.printIdentityValue}>{patient.assignedDentistName || 'Not specified'}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Date of Birth</span>
                                        <strong className={styles.printIdentityValue}>{patient.birthdate ? formatLongDate(patient.birthdate) : 'Not specified'}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Age / Sex</span>
                                        <strong className={styles.printIdentityValue}>{`${formatAgeDisplay(patientAge)} / ${patient.gender || 'Sex not specified'}`}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Contact Number</span>
                                        <strong className={styles.printIdentityValue}>{patient.contactNumber || 'Not specified'}</strong>
                                    </article>
                                    <article className={styles.printIdentityItem}>
                                        <span className={styles.printIdentityLabel}>Email Address</span>
                                        <strong className={styles.printIdentityValue}>{patient.email || 'Not specified'}</strong>
                                    </article>
                                    <article className={`${styles.printIdentityItem} ${styles.printIdentitySpanTwo}`}>
                                        <span className={styles.printIdentityLabel}>Home Address</span>
                                        <strong className={styles.printIdentityValue}>{formatAddressDisplay(patient.homeAddress || patient.currentAddress || patient.permanentAddress)}</strong>
                                    </article>
                                    <article className={`${styles.printIdentityItem} ${styles.printIdentitySpanTwo}`}>
                                        <span className={styles.printIdentityLabel}>Reason for Consultation</span>
                                        <strong className={styles.printIdentityValue}>{patient.reasonForConsultation || patient.dentalHistory?.chiefComplaint || 'Not specified'}</strong>
                                    </article>
                                </div>
                            </section>

                            {reportSections.map((section, index) => (
                                <section
                                    key={section.title}
                                    className={`${styles.printSection} ${section.kind === 'odontogram' || section.kind === 'radiographs' ? styles.printPageBreakBefore : ''}`.trim()}
                                >
                                    <div className={styles.printSectionHeader}>
                                        <div className={styles.printSectionTitleWrap}>
                                            <span className={styles.printSectionNumber}>{String(index + 1).padStart(2, '0')}</span>
                                            <h3>{section.title}</h3>
                                        </div>
                                        {section.kind === 'table' ? (
                                            <span className={styles.printSectionHint}>{section.rows.length} record{section.rows.length === 1 ? '' : 's'}</span>
                                        ) : null}
                                        {section.kind === 'radiographs' ? (
                                            <span className={styles.printSectionHint}>{section.records.length} record{section.records.length === 1 ? '' : 's'}</span>
                                        ) : null}
                                        {section.kind === 'odontogram' ? (
                                            <span className={styles.printSectionHint}>FDI Chart View</span>
                                        ) : null}
                                    </div>

                                    {section.kind === 'table' ? (
                                        <div className={styles.printTableWrap}>
                                            <table className={`${styles.printTable} ${section.variant === 'treatmentHistory' ? styles.printTreatmentTable : ''}`.trim()}>
                                                {section.variant === 'treatmentHistory' ? (
                                                    <colgroup>
                                                        {TREATMENT_HISTORY_COLUMN_WIDTHS.map((width, widthIndex) => (
                                                            <col key={`${section.title}-col-${widthIndex}`} style={{ width }} />
                                                        ))}
                                                    </colgroup>
                                                ) : null}
                                                <thead>
                                                    <tr>
                                                        {section.headers.map((header) => (
                                                            <th key={header}>{header}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {section.rows.length > 0 ? section.rows.map((row, rowIndex) => (
                                                        <tr key={`${section.title}-${rowIndex}`}>
                                                            {row.map((cell, cellIndex) => (
                                                                <td key={`${section.title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                                                            ))}
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={section.headers.length} className={styles.printEmptyCell}>
                                                                No records found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : section.kind === 'odontogram' ? (
                                        <div className={styles.printOdontogramWrap}>
                                            <Odontogram patientId={activePatientId} readOnly documentMode />
                                        </div>
                                    ) : section.kind === 'radiographs' ? (
                                        section.records.length > 0 ? (
                                            <div className={styles.printRadiographList}>
                                                {section.records.map((radiograph, radiographIndex) => (
                                                    <article key={radiograph.id || `${section.title}-${radiographIndex}`} className={styles.printRadiographCard}>
                                                        <div className={styles.printRadiographMedia}>
                                                            {radiograph.displayUrl ? (
                                                                <img
                                                                    src={radiograph.displayUrl}
                                                                    alt={`${radiograph.displayType} radiograph`}
                                                                    className={styles.printRadiographImage}
                                                                />
                                                            ) : (
                                                                <div className={styles.printRadiographPlaceholder}>
                                                                    No radiograph image uploaded.
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className={styles.printRadiographContent}>
                                                            <table className={styles.printRadiographMetaTable}>
                                                                <tbody>
                                                                    <tr>
                                                                        <th scope="row">Date</th>
                                                                        <td>{radiograph.formattedDate}</td>
                                                                        <th scope="row">Type</th>
                                                                        <td>{radiograph.displayType}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th scope="row">Radiograph No.</th>
                                                                        <td>{radiograph.displayNumber}</td>
                                                                        <th scope="row">Notes</th>
                                                                        <td>{radiograph.displayNotes}</td>
                                                                    </tr>
                                                                    <tr className={styles.printRadiographWideRow}>
                                                                        <th scope="row">Findings</th>
                                                                        <td colSpan={3}>{radiograph.displayFindings}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={styles.printEmptyState}>No radiograph records found.</div>
                                        )
                                    ) : (
                                        section.rows.length > 0 ? (
                                            <div className={styles.printCompactTableWrap}>
                                                <table className={styles.printCompactTable}>
                                                    <tbody>
                                                        {buildPrintDetailTableRows(section.rows).map((row, rowIndex) => (
                                                            row.type === 'wide' ? (
                                                                <tr key={`${section.title}-${rowIndex}`} className={styles.printCompactWideRow}>
                                                                    <th scope="row">{row.cell.label}</th>
                                                                    <td colSpan={3}>{row.cell.value}</td>
                                                                </tr>
                                                            ) : (
                                                                <tr key={`${section.title}-${rowIndex}`}>
                                                                    <th scope="row">{row.cells[0].label}</th>
                                                                    <td>{row.cells[0].value}</td>
                                                                    {row.cells[1] ? (
                                                                        <>
                                                                            <th scope="row">{row.cells[1].label}</th>
                                                                            <td>{row.cells[1].value}</td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <th className={styles.printCompactSpacerCell} aria-hidden="true"></th>
                                                                            <td className={styles.printCompactSpacerCell} aria-hidden="true"></td>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            )
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className={styles.printEmptyState}>No records found.</div>
                                        )
                                    )}
                                </section>
                            ))}

                            <footer className={styles.printFooter}>
                                <div className={styles.printFooterMeta}>
                                    <span>{patientFullName}</span>
                                    <span>{patient._id || patient.id || 'No record ID'}</span>
                                    <span>{patientPrimaryBranch}</span>
                                </div>
                                <p>This document contains confidential patient information intended for clinic use and records handling only.</p>
                            </footer>
                        </div>
                    </div>
                </div>
            </div>
            ), document.body)
            : null
    );

    // ─── OVERVIEW TAB: Patient Info ────────────────────────────────────────────
    const renderOverview = () => {
        const patientAge = patient?.birthdate
            ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
            : null;
        const homeAddress = patient?.homeAddress || patient?.currentAddress || patient?.permanentAddress || {};

        const infoItem = (label, value, icon = null) => (
            <div className={styles.infoBlock}>
                <span className={styles.infoLabel}>{label}</span>
                <p className={styles.infoValue}>
                    {icon && <span style={{ marginRight: '6px', color: '#94a3b8' }}>{icon}</span>}
                    {value || '—'}
                </p>
            </div>
        );

        return (
            <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle}>Patient Details</h3>
                <div className={styles.infoGrid}>
                    {infoItem('Full Name',
                        patient?.name?.first
                            ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
                            : (typeof patient?.name === 'string' ? patient.name : '—')
                    )}
                    {infoItem('Gender', patient?.gender, <FaVenusMars />)}
                    {infoItem('Date of Birth',
                        patient?.birthdate
                            ? `${formatDateLong(patient.birthdate)}${patientAge !== null ? ` (${formatAgeDisplay(patientAge, '-')})` : ''}`
                            : '—',
                        <FaBirthdayCake />
                    )}
                    {infoItem('Email Address', patient?.email, <FaEnvelope />)}
                    {infoItem('Mobile', patient?.contactNumber || '—', <FaPhoneAlt />)}
                    {infoItem('Patient ID', patient?._id || patient?.id, <FaIdCard />)}
                    {infoItem('Home Phone', patient?.homePhone)}
                    {infoItem('Occupation', patient?.occupation)}
                    {infoItem('Civil Status', patient?.civilStatus)}
                    {infoItem('Blood Type', patient?.bloodType || patient?.medicalHistory?.bloodType)}
                    {infoItem('Work Phone', patient?.workPhone)}
                    {infoItem('Nationality', patient?.nationality)}
                    {infoItem('Religion', patient?.religion)}
                    {infoItem('Assigned Dentist', patient?.assignedDentistName)}
                    {infoItem('Referred By', patient?.referredBy)}
                    {infoItem('Reason for Consultation', patient?.reasonForConsultation || patient?.dentalHistory?.chiefComplaint)}
                </div>

                {patient?.guardian && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>For Minors</h3>
                        <div className={styles.infoGrid}>
                            {infoItem('Guardian Name', patient.guardian.name, <FaChild />)}
                            {infoItem('Guardian Occupation', patient.guardian.occupation)}
                            {infoItem('Relationship', patient.guardian.relationship)}
                            {infoItem('Guardian Phone', patient.guardian.contactNumber, <FaPhoneAlt />)}
                        </div>
                    </>
                )}

                {(patient?.emergencyContact?.name || patient?.emergencyContact?.contactNumber) && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Emergency Contact</h3>
                        <div className={styles.infoGrid}>
                            {infoItem('Emergency Contact', patient.emergencyContact?.name)}
                            {infoItem('Mobile', patient.emergencyContact?.contactNumber, <FaPhoneAlt />)}
                            {infoItem('Relation', patient.emergencyContact?.relationship)}
                        </div>
                    </>
                )}

                {(patient?.physician?.name || patient?.physician?.officeNumber) && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Attending Physician</h3>
                        <div className={styles.infoGrid}>
                            {infoItem('Physician Name', patient?.physician?.name)}
                            {infoItem('Specialty', patient?.physician?.specialty)}
                            {infoItem('Office Address', patient?.physician?.officeAddress)}
                            {infoItem('Office Number', patient?.physician?.officeNumber)}
                        </div>
                    </>
                )}

                {(patient?.dataPrivacyConsent?.signerName || patient?.consentAcknowledgement?.signerName) && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Consent Summary</h3>
                        <div className={`${styles.infoGrid} ${styles.compactInfoGrid}`}>
                            {infoItem('Data Privacy', patient?.dataPrivacyConsent?.acknowledged === true ? 'Yes' : patient?.dataPrivacyConsent?.acknowledged === false ? 'No' : 'Not answered')}
                            {infoItem('Privacy Signer', patient?.dataPrivacyConsent?.signerName)}
                            {infoItem('Privacy Role', patient?.dataPrivacyConsent?.signerRole)}
                            {infoItem('Date Signed', patient?.dataPrivacyConsent?.signedAt ? formatDateLong(patient.dataPrivacyConsent.signedAt) : 'Not specified')}
                            {infoItem('Treatment Consent', patient?.consentAcknowledgement?.acknowledged === true ? 'Yes' : patient?.consentAcknowledgement?.acknowledged === false ? 'No' : 'Not answered')}
                            {infoItem('Consent Signer', patient?.consentAcknowledgement?.signerName)}
                            {infoItem('Consent Role', patient?.consentAcknowledgement?.signerRole)}
                            {infoItem('Consent Signed', patient?.consentAcknowledgement?.signedAt ? formatDateLong(patient.consentAcknowledgement.signedAt) : 'Not specified')}
                        </div>
                    </>
                )}

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Home Address</h3>
                <div className={styles.infoGrid}>
                    {infoItem('House No.', homeAddress?.houseNumber)}
                    {infoItem('Street', homeAddress?.street)}
                    {infoItem('Barangay', homeAddress?.barangay)}
                    {infoItem('City / Municipality', cities[homeAddress?.province]?.find(c => c.code === homeAddress?.city)?.name || homeAddress?.city)}
                    {infoItem('Province', provinces[homeAddress?.region]?.find(p => p.code === homeAddress?.province)?.name || homeAddress?.province)}
                    {infoItem('Region', regions.find(r => r.code === homeAddress?.region)?.name || homeAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Home Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(homeAddress)}
                    </p>
                </div>

            </div>
        );
    };

    // ─── MEDICAL HISTORY & ALERTS TAB ──────────────────────────────────────────
    const handleMedicalFormChange = (e) => {
        const { name, value } = e.target;
        setMedicalForm(prev => ({ ...prev, [name]: value }));
    };

    const getCsvValues = (value) => value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];

    const handleMedicalCheckboxToggle = (field, item) => {
        setMedicalForm((prev) => {
            const values = getCsvValues(prev[field]);
            const nextValues = values.includes(item)
                ? values.filter((entry) => entry !== item)
                : [...values, item];
            return { ...prev, [field]: nextValues.join(', ') };
        });
    };

    const renderYesNoEditor = (label, name) => (
        <div className={styles.formGroup}>
            <label>{label}</label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minHeight: '44px' }}>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="radio" name={name} value="yes" checked={medicalForm[name] === 'yes'} onChange={handleMedicalFormChange} />
                    <span>Yes</span>
                </label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="radio" name={name} value="no" checked={medicalForm[name] === 'no'} onChange={handleMedicalFormChange} />
                    <span>No</span>
                </label>
            </div>
        </div>
    );

    const handleSaveMedical = async (e) => {
        e.preventDefault();
        setIsSavingMedical(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    bloodType: medicalForm.bloodType,
                    reasonForConsultation: medicalForm.reasonForConsultation || undefined,
                    physician: {
                        name: medicalForm.physicianName || undefined,
                        specialty: medicalForm.physicianSpecialty || undefined,
                        officeAddress: medicalForm.physicianOfficeAddress || undefined,
                        officeNumber: medicalForm.physicianOfficeNumber || undefined,
                    },
                    medicalHistory: {
                        bloodType:   medicalForm.bloodType,
                        allergies: [
                            ...getCsvValues(medicalForm.allergies),
                            ...getCsvValues(medicalForm.allergyOther),
                        ],
                        conditions:  [
                            ...getCsvValues(medicalForm.conditions),
                            ...getCsvValues(medicalForm.conditionOther),
                        ],
                        medications: medicalForm.medications
                            ? medicalForm.medications.split(',').map(s => s.trim()).filter(Boolean)
                            : [],
                        notes: medicalForm.notes,
                        inGoodHealth: selectToBool(medicalForm.inGoodHealth),
                        underMedicalTreatment: selectToBool(medicalForm.underMedicalTreatment),
                        medicalTreatmentDetails: medicalForm.medicalTreatmentDetails || undefined,
                        hadSeriousIllnessOrSurgery: selectToBool(medicalForm.hadSeriousIllnessOrSurgery),
                        seriousIllnessOrSurgeryDetails: medicalForm.seriousIllnessOrSurgeryDetails || undefined,
                        hadHospitalization: selectToBool(medicalForm.hadHospitalization),
                        hospitalizationDetails: medicalForm.hospitalizationDetails || undefined,
                        isTakingMedication: selectToBool(medicalForm.isTakingMedication),
                        hasAllergies: selectToBool(medicalForm.hasAllergies),
                        usesTobacco: selectToBool(medicalForm.usesTobacco),
                        usesAlcoholOrDrugs: selectToBool(medicalForm.usesAlcoholOrDrugs),
                        bleedingTime: medicalForm.bleedingTime || undefined,
                        bloodPressure: medicalForm.bloodPressure || undefined,
                        isPregnant: selectToBool(medicalForm.isPregnant),
                        isNursing: selectToBool(medicalForm.isNursing),
                        takingBirthControl: selectToBool(medicalForm.takingBirthControl),
                    },
                    dentalHistory: {
                        chiefComplaint: medicalForm.reasonForConsultation || undefined,
                        lastExamDate: medicalForm.lastExam || undefined,
                        hadTreatmentReaction: selectToBool(medicalForm.hadTreatmentReaction),
                        reactionDetails: medicalForm.reactionDetails || undefined,
                        hasConfidentialInfo: selectToBool(medicalForm.hasConfidentialInfo),
                    },
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            setMedicalHistory(medicalForm);
            setPatient((prev) => prev ? ({
                ...prev,
                bloodType: medicalForm.bloodType,
                reasonForConsultation: medicalForm.reasonForConsultation,
                physician: {
                    ...prev.physician,
                    name: medicalForm.physicianName,
                    specialty: medicalForm.physicianSpecialty,
                    officeAddress: medicalForm.physicianOfficeAddress,
                    officeNumber: medicalForm.physicianOfficeNumber,
                },
                medicalHistory: {
                    ...prev.medicalHistory,
                    bloodType: medicalForm.bloodType,
                    allergies: [...getCsvValues(medicalForm.allergies), ...getCsvValues(medicalForm.allergyOther)],
                    conditions: [...getCsvValues(medicalForm.conditions), ...getCsvValues(medicalForm.conditionOther)],
                    medications: getCsvValues(medicalForm.medications),
                    notes: medicalForm.notes,
                    inGoodHealth: selectToBool(medicalForm.inGoodHealth),
                    underMedicalTreatment: selectToBool(medicalForm.underMedicalTreatment),
                    medicalTreatmentDetails: medicalForm.medicalTreatmentDetails,
                    hadSeriousIllnessOrSurgery: selectToBool(medicalForm.hadSeriousIllnessOrSurgery),
                    seriousIllnessOrSurgeryDetails: medicalForm.seriousIllnessOrSurgeryDetails,
                    hadHospitalization: selectToBool(medicalForm.hadHospitalization),
                    hospitalizationDetails: medicalForm.hospitalizationDetails,
                    isTakingMedication: selectToBool(medicalForm.isTakingMedication),
                    hasAllergies: selectToBool(medicalForm.hasAllergies),
                    usesTobacco: selectToBool(medicalForm.usesTobacco),
                    usesAlcoholOrDrugs: selectToBool(medicalForm.usesAlcoholOrDrugs),
                    bleedingTime: medicalForm.bleedingTime,
                    bloodPressure: medicalForm.bloodPressure,
                    isPregnant: selectToBool(medicalForm.isPregnant),
                    isNursing: selectToBool(medicalForm.isNursing),
                    takingBirthControl: selectToBool(medicalForm.takingBirthControl),
                },
                dentalHistory: {
                    ...prev.dentalHistory,
                    chiefComplaint: medicalForm.reasonForConsultation,
                    lastExamDate: medicalForm.lastExam,
                    hadTreatmentReaction: selectToBool(medicalForm.hadTreatmentReaction),
                    reactionDetails: medicalForm.reactionDetails,
                    hasConfidentialInfo: selectToBool(medicalForm.hasConfidentialInfo),
                },
            }) : prev);
            setIsEditingMedical(false);
            addToast('Medical history updated successfully.', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to update medical history.', 'error');
        } finally {
            setIsSavingMedical(false);
        }
    };

    const handleCancelMedical = () => {
        setMedicalForm(medicalHistory);
        setIsEditingMedical(false);
    };

    const renderTags = (csvString, isWarning = false) => {
        if (!csvString || csvString.trim() === '') return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(i => i !== '');
        return (
            <div className={styles.tagList}>
                {items.map((item, idx) => (
                    <span key={idx} className={`${styles.tag} ${isWarning ? styles.warning : ''}`}>{item}</span>
                ))}
            </div>
        );
    };

    const renderList = (csvString) => {
        if (!csvString || csvString.trim() === '') return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(i => i !== '');
        return (
            <ul style={{ margin: '5px 0 0 15px', color: '#334155', fontWeight: '600', fontSize: '14px' }}>
                {items.map((item, idx) => <li key={idx} style={{marginBottom: '5px'}}>{item}</li>)}
            </ul>
        );
    };

    const renderMedicalHistory = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>Medical & Dental History</h3>
                {canEditMedical && !isEditingMedical && (
                    <button className={styles.actionBtn} onClick={() => setIsEditingMedical(true)}>
                        Edit Medical History
                    </button>
                )}
            </div>

            {isEditingMedical ? (
                <form onSubmit={handleSaveMedical}>
                    <div className={styles.infoGrid} style={{ marginBottom: '20px' }}>
                        <div className={styles.formGroup}>
                            <label>Physician's Name</label>
                            <input type="text" name="physicianName" value={medicalForm.physicianName} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Specialty, If Applicable</label>
                            <input type="text" name="physicianSpecialty" value={medicalForm.physicianSpecialty} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Office Address</label>
                            <input type="text" name="physicianOfficeAddress" value={medicalForm.physicianOfficeAddress} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Office Number</label>
                            <input type="text" name="physicianOfficeNumber" value={medicalForm.physicianOfficeNumber} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Reason for Consultation</label>
                            <input type="text" name="reasonForConsultation" value={medicalForm.reasonForConsultation} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Last Dental Visit</label>
                            <input type="date" name="lastExam" value={medicalForm.lastExam} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        {renderYesNoEditor('Reaction or Complication After Dental Treatment?', 'hadTreatmentReaction')}
                        <div className={styles.formGroup}>
                            <label>If Yes, Please Detail</label>
                            <input type="text" name="reactionDetails" value={medicalForm.reactionDetails} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        {renderYesNoEditor('Private or Confidential Information to Discuss in Private?', 'hasConfidentialInfo')}
                        {renderYesNoEditor('Are You in Good Health?', 'inGoodHealth')}
                        {renderYesNoEditor('Under Medical Treatment Now?', 'underMedicalTreatment')}
                        <div className={styles.formGroup}>
                            <label>Condition Treated</label>
                            <input type="text" name="medicalTreatmentDetails" value={medicalForm.medicalTreatmentDetails} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        {renderYesNoEditor('Serious Illness or Surgical Operation?', 'hadSeriousIllnessOrSurgery')}
                        <div className={styles.formGroup}>
                            <label>Illness or Operation Details</label>
                            <input type="text" name="seriousIllnessOrSurgeryDetails" value={medicalForm.seriousIllnessOrSurgeryDetails} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        {renderYesNoEditor('Ever Been Hospitalized?', 'hadHospitalization')}
                        <div className={styles.formGroup}>
                            <label>Hospitalization Details</label>
                            <input type="text" name="hospitalizationDetails" value={medicalForm.hospitalizationDetails} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        {renderYesNoEditor('Taking Prescription / Non-Prescription Medication?', 'isTakingMedication')}
                        <div className={styles.formGroup}>
                            <label>Medications</label>
                            <input type="text" name="medications" value={medicalForm.medications} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="Comma-separated medications" />
                        </div>
                        {renderYesNoEditor('Use Tobacco Products?', 'usesTobacco')}
                        {renderYesNoEditor('Use Alcohol, Cocaine, or Other Dangerous Drugs?', 'usesAlcoholOrDrugs')}
                        {renderYesNoEditor('Has Allergies?', 'hasAllergies')}
                    </div>

                    <div className={styles.formGroup}>
                        <label>Allergy Checklist</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            {ALLERGY_OPTIONS.map((option) => (
                                <label key={option} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="checkbox" checked={getCsvValues(medicalForm.allergies).includes(option)} onChange={() => handleMedicalCheckboxToggle('allergies', option)} />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                        <input type="text" name="allergyOther" value={medicalForm.allergyOther} onChange={handleMedicalFormChange} className={styles.inputField} style={{ marginTop: '12px' }} placeholder="Other allergy" />
                    </div>

                    <div className={styles.infoGrid} style={{ marginBottom: '20px' }}>
                        <div className={styles.formGroup}>
                            <label>Bleeding Time</label>
                            <input type="text" name="bleedingTime" value={medicalForm.bleedingTime} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                    </div>

                    <div className={styles.infoGrid} style={{ marginBottom: '20px' }}>
                        <div style={{ gridColumn: '1 / -1' }}><p style={{ fontWeight: '700', fontSize: '13px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>For Women Only</p></div>
                        {renderYesNoEditor('Are You Pregnant?', 'isPregnant')}
                        {renderYesNoEditor('Are You Nursing?', 'isNursing')}
                        {renderYesNoEditor('Are You Taking Birth Control Pills?', 'takingBirthControl')}
                        <div className={styles.formGroup}>
                            <label>Blood Type</label>
                            <select name="bloodType" value={medicalForm.bloodType} onChange={handleMedicalFormChange} className={styles.inputField}>
                                <option value="">Select</option>
                                <option value="A+">A+</option><option value="A-">A-</option>
                                <option value="B+">B+</option><option value="B-">B-</option>
                                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                <option value="O+">O+</option><option value="O-">O-</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Blood Pressure</label>
                            <input type="text" name="bloodPressure" value={medicalForm.bloodPressure} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="e.g., 120/80" />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Medical Conditions Checklist</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            {MEDICAL_CONDITION_OPTIONS.map((option) => (
                                <label key={option} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="checkbox" checked={getCsvValues(medicalForm.conditions).includes(option)} onChange={() => handleMedicalCheckboxToggle('conditions', option)} />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                        <input type="text" name="conditionOther" value={medicalForm.conditionOther} onChange={handleMedicalFormChange} className={styles.inputField} style={{ marginTop: '12px' }} placeholder="Other condition" />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Clinical Notes & Remarks</label>
                        <textarea name="notes" value={medicalForm.notes} onChange={handleMedicalFormChange} className={styles.textareaField} placeholder="Add any special instructions or warnings here..." />
                    </div>
                    
                    <div className={styles.formActions}>
                        <button type="button" className={styles.cancelBtn} onClick={handleCancelMedical} disabled={isSavingMedical}>Cancel</button>
                        <button type="submit" className={styles.saveBtn} disabled={isSavingMedical}>
                            {isSavingMedical ? 'Saving...' : 'Save Updates'}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel} style={{ color: '#ef4444' }}><FaSyringe style={{marginRight: '6px'}}/> Allergies (Red Flags)</span>
                            {renderTags(medicalHistory.allergies, true)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}><FaNotesMedical style={{marginRight: '6px'}}/> Pre-existing Conditions</span>
                            {renderTags(medicalHistory.conditions)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Current Medications</span>
                            {renderList(medicalHistory.medications)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Blood Type</span>
                            <p className={styles.infoValue}>{medicalHistory.bloodType || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Last Exam</span>
                            <p className={styles.infoValue}>{medicalHistory.lastExam ? formatDateLong(medicalHistory.lastExam) : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Blood Pressure</span>
                            <p className={styles.infoValue}>{medicalHistory.bloodPressure || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Bleeding Time</span>
                            <p className={styles.infoValue}>{medicalHistory.bleedingTime || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>In Good Health?</span>
                            <p className={styles.infoValue}>{medicalHistory.inGoodHealth === 'yes' ? 'Yes' : medicalHistory.inGoodHealth === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Under Medical Treatment?</span>
                            <p className={styles.infoValue}>{medicalHistory.underMedicalTreatment === 'yes' ? 'Yes' : medicalHistory.underMedicalTreatment === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Condition Treated</span>
                            <p className={styles.infoValue}>{medicalHistory.medicalTreatmentDetails || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Serious Illness / Surgery?</span>
                            <p className={styles.infoValue}>{medicalHistory.hadSeriousIllnessOrSurgery === 'yes' ? 'Yes' : medicalHistory.hadSeriousIllnessOrSurgery === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Illness / Surgery Details</span>
                            <p className={styles.infoValue}>{medicalHistory.seriousIllnessOrSurgeryDetails || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Ever Been Hospitalized?</span>
                            <p className={styles.infoValue}>{medicalHistory.hadHospitalization === 'yes' ? 'Yes' : medicalHistory.hadHospitalization === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Hospitalization Details</span>
                            <p className={styles.infoValue}>{medicalHistory.hospitalizationDetails || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Taking Medication?</span>
                            <p className={styles.infoValue}>{medicalHistory.isTakingMedication === 'yes' ? 'Yes' : medicalHistory.isTakingMedication === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Has Allergies?</span>
                            <p className={styles.infoValue}>{medicalHistory.hasAllergies === 'yes' ? 'Yes' : medicalHistory.hasAllergies === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Uses Tobacco?</span>
                            <p className={styles.infoValue}>{medicalHistory.usesTobacco === 'yes' ? 'Yes' : medicalHistory.usesTobacco === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Uses Alcohol / Drugs?</span>
                            <p className={styles.infoValue}>{medicalHistory.usesAlcoholOrDrugs === 'yes' ? 'Yes' : medicalHistory.usesAlcoholOrDrugs === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Pregnant?</span>
                            <p className={styles.infoValue}>{medicalHistory.isPregnant === 'yes' ? 'Yes' : medicalHistory.isPregnant === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Nursing?</span>
                            <p className={styles.infoValue}>{medicalHistory.isNursing === 'yes' ? 'Yes' : medicalHistory.isNursing === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Taking Birth Control Pills?</span>
                            <p className={styles.infoValue}>{medicalHistory.takingBirthControl === 'yes' ? 'Yes' : medicalHistory.takingBirthControl === 'no' ? 'No' : 'Not specified'}</p>
                        </div>
                    </div>
                    {medicalHistory.notes && (
                        <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '25px' }}>
                            <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                            <p className={styles.infoValue} style={{ color: '#475569', fontStyle: 'italic' }}>"{medicalHistory.notes}"</p>
                        </div>
                    )}
                    <div className={styles.infoGrid} style={{ marginTop: '28px' }}>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Reason for Consultation</span>
                            <p className={styles.infoValue}>{patient?.reasonForConsultation || medicalHistory.chiefComplaint || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Last Dental Visit</span>
                            <p className={styles.infoValue}>{medicalHistory.lastExam ? formatDateLong(medicalHistory.lastExam) : 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Treatment Reaction</span>
                            <p className={styles.infoValue}>
                                {medicalHistory.hadTreatmentReaction === 'yes' ? 'Yes' : medicalHistory.hadTreatmentReaction === 'no' ? 'No' : 'Not specified'}
                            </p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Confidential Information</span>
                            <p className={styles.infoValue}>
                                {medicalHistory.hasConfidentialInfo === 'yes'
                                    ? 'Patient requested a private discussion.'
                                    : medicalHistory.hasConfidentialInfo === 'no'
                                        ? 'No confidential flag recorded.'
                                        : 'Not specified'}
                            </p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Reaction Details</span>
                            <p className={styles.infoValue}>{medicalHistory.reactionDetails || 'Not specified'}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderMedicalHistoryAligned = () => {
        const allergySelections = medicalHistory.allergies
            ? medicalHistory.allergies.split(',').map((item) => item.trim()).filter(Boolean)
            : [];
        const conditionSelections = medicalHistory.conditions
            ? medicalHistory.conditions.split(',').map((item) => item.trim()).filter(Boolean)
            : [];
        const renderChecklist = (options, selected, warning = false) => (
            <div className={styles.checklistGrid}>
                {options.map((option) => {
                    const checked = selected.includes(option);
                    return (
                        <div
                            key={option}
                            className={`${styles.checklistItem} ${checked ? styles.checklistChecked : ''} ${checked && warning ? styles.checklistWarning : ''}`}
                        >
                            <span className={styles.checkboxMark}>{checked ? '☑' : '☐'}</span>
                            <span>{option}</span>
                        </div>
                    );
                })}
            </div>
        );

        return (
            <div className={styles.contentCard}>
                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle}>Medical & Dental History</h3>
                    {canEditMedical && !isEditingMedical && (
                        <button className={styles.actionBtn} onClick={() => setIsEditingMedical(true)}>
                            Edit Medical History
                        </button>
                    )}
                </div>

                {isEditingMedical ? renderMedicalHistory() : (
                    <>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Physician's Name</span><p className={styles.infoValue}>{textDisplay(patient?.physician?.name)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Specialty, If Applicable</span><p className={styles.infoValue}>{textDisplay(patient?.physician?.specialty)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Office Address</span><p className={styles.infoValue}>{textDisplay(patient?.physician?.officeAddress)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Office Number</span><p className={styles.infoValue}>{textDisplay(patient?.physician?.officeNumber)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Reason for Consultation</span><p className={styles.infoValue}>{patient?.reasonForConsultation || medicalHistory.chiefComplaint || 'Not specified'}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Last Dental Visit</span><p className={styles.infoValue}>{medicalHistory.lastExam ? formatDateLong(medicalHistory.lastExam) : 'Not specified'}</p></div>
                        </div>

                        <div className={`${styles.infoGrid} ${styles.pairedInfoGrid}`}>
                            {renderInfoBlock(styles, 'Reaction or Complication After Dental Treatment?', yesNoDisplay(medicalHistory.hadTreatmentReaction))}
                            {renderInfoBlock(styles, 'If Yes, Please Detail', textDisplay(medicalHistory.reactionDetails))}
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Private or Confidential Information to Discuss in Private?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.hasConfidentialInfo)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Are You in Good Health?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.inGoodHealth)}</p></div>
                        </div>

                        <div className={`${styles.infoGrid} ${styles.pairedInfoGrid}`}>
                            {renderInfoBlock(styles, 'Under Medical Treatment Now?', yesNoDisplay(medicalHistory.underMedicalTreatment))}
                            {renderInfoBlock(styles, 'Condition Treated', textDisplay(medicalHistory.medicalTreatmentDetails))}
                        </div>

                        <div className={`${styles.infoGrid} ${styles.pairedInfoGrid}`}>
                            {renderInfoBlock(styles, 'Serious Illness or Surgical Operation?', yesNoDisplay(medicalHistory.hadSeriousIllnessOrSurgery))}
                            {renderInfoBlock(styles, 'Illness or Operation Details', textDisplay(medicalHistory.seriousIllnessOrSurgeryDetails))}
                        </div>

                        <div className={`${styles.infoGrid} ${styles.pairedInfoGrid}`}>
                            {renderInfoBlock(styles, 'Ever Been Hospitalized?', yesNoDisplay(medicalHistory.hadHospitalization))}
                            {renderInfoBlock(styles, 'Hospitalization Details', textDisplay(medicalHistory.hospitalizationDetails))}
                        </div>

                        <div className={`${styles.infoGrid} ${styles.pairedInfoGrid}`}>
                            {renderInfoBlock(styles, 'Taking Prescription / Non-Prescription Medication?', yesNoDisplay(medicalHistory.isTakingMedication))}
                            {renderInfoBlock(styles, 'Medications', medicalHistory.medications || 'Not specified')}
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Use Tobacco Products?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.usesTobacco)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Use Alcohol, Cocaine, or Other Dangerous Drugs?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.usesAlcoholOrDrugs)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Has Allergies?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.hasAllergies)}</p></div>
                        </div>

                        <div className={styles.infoBlock} style={{ marginTop: '28px' }}>
                            <span className={styles.infoLabel} style={{ color: '#ef4444' }}><FaSyringe style={{marginRight: '6px'}} />Allergy Checklist</span>
                            {renderChecklist(ALLERGY_OPTIONS, allergySelections, true)}
                            <p className={styles.infoValue} style={{ marginTop: '12px' }}>Other Allergy: {allergySelections.filter((item) => !ALLERGY_OPTIONS.includes(item)).join(', ') || 'Not specified'}</p>
                        </div>

                        <div className={styles.infoGrid} style={{ marginTop: '28px' }}>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Bleeding Time</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bleedingTime)}</p></div>
                        </div>

                        <div className={styles.infoGrid}>
                            <div style={{ gridColumn: '1 / -1' }}><p style={{ fontWeight: '700', fontSize: '13px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>For Women Only</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Are You Pregnant?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.isPregnant)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Are You Nursing?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.isNursing)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Are You Taking Birth Control Pills?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.takingBirthControl)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Blood Type</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bloodType)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Blood Pressure</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bloodPressure)}</p></div>
                        </div>

                        <div className={styles.infoBlock} style={{ marginTop: '28px' }}>
                            <span className={styles.infoLabel}><FaNotesMedical style={{marginRight: '6px'}} />Medical Conditions Checklist</span>
                            {renderChecklist(MEDICAL_CONDITION_OPTIONS, conditionSelections)}
                            <p className={styles.infoValue} style={{ marginTop: '12px' }}>Other Condition: {conditionSelections.filter((item) => !MEDICAL_CONDITION_OPTIONS.includes(item)).join(', ') || 'Not specified'}</p>
                        </div>

                        <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '25px', marginTop: '28px' }}>
                            <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                            <p className={styles.infoValue} style={{ color: '#475569', fontStyle: 'italic' }}>{medicalHistory.notes ? `"${medicalHistory.notes}"` : 'No clinical notes on record.'}</p>
                        </div>
                    </>
                )}
            </div>
        );
    };

    // ─── TREATMENT LOGS TAB ────────────────────────────────────────────────────
    const handleAddLogSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingLog(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}/treatment-logs`, {
                method: 'POST',
                body: JSON.stringify({
                    date: newLogForm.date,
                    procedure: newLogForm.procedure,
                    category: newLogForm.category,
                    tooth: newLogForm.tooth || 'N/A',
                    amountCharged: newLogForm.amountCharged || 0,
                    amountPaid: newLogForm.amountPaid || 0,
                    nextAppointment: newLogForm.nextAppointment || '',
                    branch: newLogForm.branchId,
                    notes: newLogForm.notes || '',
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save log.');

            const saved = await res.json();
            const newLog = normalizeTreatmentLogRecord({
                ...saved,
                date: saved.date || newLogForm.date,
            });
            setLogs(prev => [newLog, ...prev].sort((a, b) => b.rawDate - a.rawDate));
            setIsAddLogOpen(false);
            setNewLogForm({
                date: '',
                procedure: '',
                category: 'General',
                tooth: '',
                amountCharged: '',
                amountPaid: '',
                nextAppointment: '',
                branchId: '',
                notes: '',
            });
            addToast("Treatment log added successfully.", "success");
        } catch (err) {
            console.error('Add log error:', err);
            addToast(err.message || 'Failed to save treatment log.', 'error');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const toggleLogRow = (logId) => {
        setExpandedLogRows((prev) => ({ ...prev, [logId]: !prev[logId] }));
    };

    const toggleOdontogramLogRow = (logId) => {
        setExpandedOdontogramLogRows((prev) => ({ ...prev, [logId]: !prev[logId] }));
    };

    const normalizedLogRange = (() => {
        if (logsRangeFilter === 'all') {
            return { from: '', to: '' };
        }
        if (logsRangeFilter === '3days') {
            return { from: getTodayString(), to: addDays(getTodayString(), 2) };
        }
        if (logsRangeFilter === '7days') {
            return { from: getTodayString(), to: addDays(getTodayString(), 6) };
        }
        if (logsRangeFilter === 'custom') {
            const from = logsDateFrom || getTodayString();
            const to = logsDateTo || from;
            return from <= to ? { from, to } : { from: to, to: from };
        }
        return { from: getTodayString(), to: getTodayString() };
    })();

    const filteredLogs = logs.filter(log => {
        const searchLower = logsSearchQuery.toLowerCase();
        const matchesSearch =
            (log.procedure || '').toLowerCase().includes(searchLower)
            || (log.dentistName || '').toLowerCase().includes(searchLower)
            || (log.category || '').toLowerCase().includes(searchLower)
            || (log.tooth || '').toLowerCase().includes(searchLower)
            || (log.branch || '').toLowerCase().includes(searchLower)
            || (log.notes || '').toLowerCase().includes(searchLower)
            || String(log.amountCharged || '').includes(searchLower)
            || String(log.amountPaid || '').includes(searchLower)
            || String(log.balance || '').includes(searchLower);
        const matchesCategory = logsCategory === 'All' || log.category === logsCategory;
        const logDateKey = log.rawDate.toISOString().split('T')[0];
        const matchesDate = !normalizedLogRange.from || !normalizedLogRange.to
            ? true
            : (logDateKey >= normalizedLogRange.from && logDateKey <= normalizedLogRange.to);
        return matchesSearch && matchesCategory && matchesDate;
    });

    const renderTreatmentLogs = () => (
        <div className={styles.contentCard}>
                <div className={styles.sectionHeaderRow} style={{ marginBottom: '20px' }}>
                    <h3 className={styles.sectionTitle}>Treatment Logs</h3>
                    {canAddTreatmentLog && (
                        <button className={styles.actionBtn} onClick={() => setIsAddLogOpen(true)}>
                            <FaPlus /> Add Log
                        </button>
                    )}
                </div>

            <div className={scheduleStyles.toolbar}>
                <div className={scheduleStyles.toolbarFilters}>
                    <div className={scheduleStyles.searchWrapper}>
                        <FaSearch className={scheduleStyles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search procedures, dentist, or amounts..."
                            className={scheduleStyles.searchInput}
                            value={logsSearchQuery}
                            onChange={(e) => setLogsSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className={scheduleStyles.pillGroup}>
                        {DATE_FILTER_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`${scheduleStyles.filterPill} ${logsRangeFilter === option.value ? scheduleStyles.activePill : ''}`}
                                onClick={() => setLogsRangeFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {logsRangeFilter === 'custom' && (
                        <div className={scheduleStyles.customDateRange}>
                            <label className={scheduleStyles.dateField}>
                                <span>From</span>
                                <input className={scheduleStyles.formControl} type="date" value={logsDateFrom} max={logsDateTo || undefined} onChange={(e) => setLogsDateFrom(e.target.value)} />
                            </label>
                            <label className={scheduleStyles.dateField}>
                                <span>To</span>
                                <input className={scheduleStyles.formControl} type="date" value={logsDateTo} min={logsDateFrom || undefined} onChange={(e) => setLogsDateTo(e.target.value)} />
                            </label>
                        </div>
                    )}

                    <div className={scheduleStyles.filterSelectWrap}>
                        <FaFilter className={scheduleStyles.filterIcon} />
                        <select className={scheduleStyles.filterSelect} value={logsCategory} onChange={(e) => setLogsCategory(e.target.value)}>
                        <option value="All">All Categories</option>
                        <option value="Prophylaxis">Prophylaxis</option>
                        <option value="Restoration">Restoration</option>
                        <option value="Extraction">Extraction</option>
                        <option value="Orthodontics">Orthodontics</option>
                        <option value="Consultation">Consultation</option>
                        <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className={scheduleStyles.tableContainer}>
                <table className={`${wideTable.table} ${styles.treatmentHistoryTable}`}>
                <thead>
                        <tr>
                            <th>Date</th>
                            <th>Procedure</th>
                            <th>Dentist/s</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log) => {
                            const logId = log.id;
                            const isExpanded = !!expandedLogRows[logId];
                            return (
                            <Fragment key={logId}>
                            <tr>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <div className={scheduleStyles.patientCell}>
                                        <strong>{formatDateShort(log.rawDate)}</strong>
                                        <span>{formatDateLong(log.rawDate)}</span>
                                    </div>
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }} title={log.procedure}>{log.procedure}</td>
                                <td style={{ whiteSpace: 'nowrap' }} title={log.dentistName || log.doctor || log.dentist || '-'}>
                                    {log.dentistName || log.doctor || log.dentist || '-'}
                                </td>
                                <td className={styles.detailsToggleCell}>
                                    <button
                                        type="button"
                                        className={styles.expandInlineBtn}
                                        onClick={() => toggleLogRow(logId)}
                                    >
                                        {isExpanded ? 'Hide' : 'View'}
                                    </button>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className={styles.expandedDetailRow}>
                                    <td colSpan="4">
                                        <div className={styles.expandedDetailPanel}>
                                            <div className={styles.expandedDetailGrid}>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Category</span>
                                                    <p className={styles.expandedDetailValue}>{log.category || 'Other'}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Tooth No./s</span>
                                                    <p className={styles.expandedDetailValue}>{log.tooth || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Branch</span>
                                                    <p className={styles.expandedDetailValue}>{log.branch || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Amount Charged</span>
                                                    <p className={styles.expandedDetailValue}>{formatMoney(log.amountCharged)}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Amount Paid</span>
                                                    <p className={styles.expandedDetailValue}>{formatMoney(log.amountPaid)}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Balance</span>
                                                    <p className={styles.expandedDetailValue}>{formatMoney(log.balance)}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Next Appointment</span>
                                                    <p className={styles.expandedDetailValue}>{formatShortDate(log.nextAppointment)}</p>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Notes</span>
                                                    <p className={styles.expandedDetailValue}>{log.notes || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </Fragment>
                        );
                        })}
                    </tbody>
                </table>
                {filteredLogs.length === 0 && (
                    <div className={scheduleStyles.emptyStateBox}>No results found</div>
                )}
            </div>

            {canAddTreatmentLog && isAddLogOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard} style={{ maxWidth: '720px' }}>
                        <h3 className={styles.modalTitle} style={{ textAlign: 'left', border: 'none', padding: 0, marginBottom: '12px' }}>Add Treatment Log</h3>
                        <p style={{ margin: '0 0 18px 0', color: '#64748b', lineHeight: 1.6 }}>
                            Follow the clinic treatment record and capture the service details in one complete row.
                        </p>
                        <form onSubmit={handleAddLogSubmit} style={{ textAlign: 'left' }}>
                            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '15px' }}>
                                <div className={styles.formGroup}>
                                    <label>Date of Procedure <span style={{color:'red'}}>*</span></label>
                                    <input type="date" required max={getTodayString()} className={styles.inputField} value={newLogForm.date} onChange={(e) => setNewLogForm({...newLogForm, date: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Procedure Name <span style={{color:'red'}}>*</span></label>
                                    <input type="text" required className={styles.inputField} value={newLogForm.procedure} onChange={(e) => setNewLogForm({...newLogForm, procedure: e.target.value})} placeholder="e.g. Extraction" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Category <span style={{color:'red'}}>*</span></label>
                                    <select required className={styles.inputField} value={newLogForm.category} onChange={(e) => setNewLogForm({...newLogForm, category: e.target.value})}>
                                        <option value="General">General</option>
                                        <option value="Prophylaxis">Prophylaxis</option>
                                        <option value="Restoration">Restoration</option>
                                        <option value="Extraction">Extraction</option>
                                        <option value="Orthodontics">Orthodontics</option>
                                        <option value="Consultation">Consultation</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Branch <span style={{color:'red'}}>*</span></label>
                                    <select
                                        required
                                        className={styles.inputField}
                                        value={newLogForm.branchId}
                                        onChange={(e) => setNewLogForm({...newLogForm, branchId: e.target.value})}
                                    >
                                        <option value="" disabled hidden>Select Branch</option>
                                        {branches.map(b => (
                                            <option key={b._id} value={b.name}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Tooth Number(s)</label>
                                    <input type="text" className={styles.inputField} value={newLogForm.tooth} onChange={(e) => setNewLogForm({...newLogForm, tooth: e.target.value})} placeholder="e.g. 45, 46 or All" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Amount Charged <span style={{color:'red'}}>*</span></label>
                                    <input type="number" min="0" step="0.01" required className={styles.inputField} value={newLogForm.amountCharged} onChange={(e) => setNewLogForm({...newLogForm, amountCharged: e.target.value})} placeholder="0.00" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Amount Paid <span style={{color:'red'}}>*</span></label>
                                    <input type="number" min="0" step="0.01" required className={styles.inputField} value={newLogForm.amountPaid} onChange={(e) => setNewLogForm({...newLogForm, amountPaid: e.target.value})} placeholder="0.00" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Balance</label>
                                    <input
                                        type="text"
                                        readOnly
                                        className={styles.inputField}
                                        value={formatMoney(Math.max(Number(newLogForm.amountCharged || 0) - Number(newLogForm.amountPaid || 0), 0))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Next Appointment</label>
                                    <input type="date" className={styles.inputField} value={newLogForm.nextAppointment} onChange={(e) => setNewLogForm({...newLogForm, nextAppointment: e.target.value})} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        className={styles.textareaField}
                                        value={newLogForm.notes}
                                        onChange={(e) => setNewLogForm({...newLogForm, notes: e.target.value})}
                                        placeholder="Clinical notes, remarks, or follow-up instructions"
                                    />
                                </div>
                            </div>
                            <div className={styles.modalButtonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddLogOpen(false)} disabled={isSubmittingLog}>Cancel</button>
                                <button type="submit" className={styles.saveBtn} disabled={isSubmittingLog}>
                                    {isSubmittingLog ? 'Saving...' : 'Save Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RADIOGRAPHS TAB ───────────────────────────────────────────────────────
    const openRadiograph = (img) => {
        setSelectedRadiograph(img);
        setIsEnhancing(false);
        setEnhancingEngine('');
        setSelectedRadiographView(img?.enhancedUrl ? 'latest' : 'original');
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setEnhancingEngine('');
        setSelectedRadiographView('latest');
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            addToast('Image must be under 3MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setUploadPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadForm.label || !uploadForm.date) {
            addToast('Label and date are required.', 'error');
            return;
        }
        if (!uploadPreview) {
            addToast('Please select an image file.', 'error');
            return;
        }
        setIsUploading(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}/radiographs`, {
                method: 'POST',
                body: JSON.stringify({
                    label: uploadForm.label,
                    date: uploadForm.date,
                    radiographNumber: uploadForm.radiographNumber,
                    url: uploadPreview,
                    findings: uploadForm.findings,
                    notes: uploadForm.notes,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Upload failed.');
            const saved = await res.json();
            setRadiographs(prev => [
                normalizeRadiographRecord({
                    ...saved,
                    date: saved.date || uploadForm.date,
                    label: saved.label || uploadForm.label,
                    url: saved.url || uploadPreview,
                    radiographNumber: saved.radiographNumber || uploadForm.radiographNumber,
                    findings: saved.findings || uploadForm.findings,
                    notes: saved.notes || uploadForm.notes,
                }),
                ...prev,
            ]);
            setIsUploadModalOpen(false);
            setUploadForm({ label: '', date: '', radiographNumber: '', findings: '', notes: '' });
            setUploadPreview(null);
            addToast('Radiograph uploaded successfully.', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to upload radiograph.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAIEnhance = async (engine = 'basic') => {
        if (!canEnhanceRadiograph) {
            addToast('Only dentists can use the AI image enhancer for radiographs.', 'error');
            return;
        }

        if (!selectedRadiograph?.id) {
            addToast('Select a radiograph first.', 'error');
            return;
        }

        setIsEnhancing(true);
        setEnhancingEngine(engine);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch('/radiographs/enhance', {
                method: 'POST',
                body: JSON.stringify({
                    patientId: activePatientId,
                    radiographId: selectedRadiograph.id,
                    engine,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Enhancement failed.');

            const normalizedRadiograph = normalizeRadiographRecord(data.radiograph || {});
            setRadiographs((prev) => prev.map((entry) => (
                entry.id === normalizedRadiograph.id ? normalizedRadiograph : entry
            )));
            setSelectedRadiograph(normalizedRadiograph);
            setSelectedRadiographView(engine === 'hugging-face'
                ? 'huggingFace'
                : engine === 'self-hosted'
                    ? 'selfHosted'
                    : 'basic');
            addToast(data.message || 'Enhanced radiograph saved to the patient record.', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to enhance radiograph.', 'error');
        } finally {
            setIsEnhancing(false);
            setEnhancingEngine('');
        }
    };

    const renderRadiographs = () => {
        if (selectedRadiograph) {
            const availableViewOptions = getRadiographViewOptions(selectedRadiograph);
            return (
                <div className={styles.contentCard}>
                    <div className={styles.imageViewerContainer}>
                        <div className={styles.imageViewerHeader}>
                            <button className={styles.backToGalleryBtn} onClick={closeImageModal}>
                                <FaArrowLeft /> Back to Gallery
                            </button>
                            <div className={styles.imageViewerTitleBox}>
                                <h3 className={styles.sectionTitle} style={{ margin: 0, borderLeft: 'none', paddingLeft: 0 }}>
                                    {selectedRadiograph.type}
                                </h3>
                                <p className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {formatDateShort(selectedRadiograph.rawDate)}</p>
                                {selectedRadiograph.radiographNumber ? (
                                    <p className={styles.radioDate}>Radiograph No.: {selectedRadiograph.radiographNumber}</p>
                                ) : null}
                            </div>
                        </div>

                        <div className={styles.largeRadiographWrapper}>
                            <img 
                                src={getPreferredRadiographUrl(selectedRadiograph, selectedRadiographView)} 
                                alt={selectedRadiograph.type} 
                                className={styles.largeRadiograph}
                            />
                            {isEnhancing && (
                                <div className={styles.loadingOverlay}>
                                    <FaRobot className={styles.spinningIcon} />
                                    <span>
                                        {enhancingEngine === 'self-hosted'
                                            ? 'Running self-hosted AI enhancement...'
                                            : enhancingEngine === 'hugging-face'
                                                ? 'Running Hugging Face test harness...'
                                                : 'Enhancing radiograph...'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {canEnhanceRadiograph && selectedRadiograph.url ? (
                            <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                                {availableViewOptions.length ? (
                                    <div className={styles.imageViewerControls} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                                        {availableViewOptions.map((option) => (
                                            <button
                                                key={option.key}
                                                className={styles.aiEnhanceBtn}
                                                type="button"
                                                disabled={isEnhancing}
                                                onClick={() => setSelectedRadiographView(option.key)}
                                                style={{ background: selectedRadiographView === option.key ? '#0f766e' : undefined }}
                                            >
                                                <FaMagic /> {option.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                                <div className={styles.imageViewerControls} style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button
                                        className={styles.aiEnhanceBtn}
                                        onClick={() => handleAIEnhance('basic')}
                                        disabled={isEnhancing}
                                        type="button"
                                    >
                                        {isEnhancing && enhancingEngine === 'basic'
                                            ? 'Processing Basic Enhance...'
                                            : <><FaMagic /> Save Basic Enhance</>}
                                    </button>
                                </div>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
                                    `Basic Enhance` keeps the existing OpenCV pipeline.
                                </p>
                            </div>
                        ) : null}
                        {(selectedRadiograph.findings || selectedRadiograph.notes) && (
                            <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                                {selectedRadiograph.findings ? (
                                    <div className={styles.contentCard}>
                                        <h4 className={styles.sectionTitle} style={{ fontSize: '16px', marginBottom: '8px' }}>Findings / Impression</h4>
                                        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>{selectedRadiograph.findings}</p>
                                    </div>
                                ) : null}
                                {selectedRadiograph.notes ? (
                                    <div className={styles.contentCard}>
                                        <h4 className={styles.sectionTitle} style={{ fontSize: '16px', marginBottom: '8px' }}>Notes</h4>
                                        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>{selectedRadiograph.notes}</p>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.contentCard}>
                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Dental Radiographs (X-Rays)</h3>
                    {canUploadRadiograph && (
                        <button className={styles.uploadBtn} onClick={() => setIsUploadModalOpen(true)}>
                            <FaUpload /> Upload Radiograph
                        </button>
                    )}
                </div>

                {radiographs.length > 0 ? (
                    <div className={styles.radiographGrid}>
                        {radiographs.map(img => (
                            <div key={img.id} className={styles.radioCard} onClick={() => openRadiograph(img)}>
                                <div className={styles.radioThumbnailWrapper}>
                                    <img src={getPreferredRadiographUrl(img)} alt={img.type} className={styles.radioThumbnail} />
                                </div>
                                <div className={styles.radioMeta}>
                                    <h4 className={styles.radioType}>{img.type}</h4>
                                    <span className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {formatDateShort(img.rawDate)}</span>
                                    {img.radiographNumber ? (
                                        <span className={styles.radioDate}>No.: {img.radiographNumber}</span>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        No radiographs or imaging records found for this patient.
                    </div>
                )}
            </div>
        );
    };

    const renderOdontogram = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                    {canEditOdontogram ? 'Interactive Odontogram' : 'Odontogram'}
                </h3>
            </div>
            <Odontogram
                patientId={activePatientId}
                readOnly={!canEditOdontogram}
                onOdontogramSaved={() => loadOdontogramLogs(activePatientId)}
            />

            <div className={styles.contentCard} style={{ marginTop: '22px', background: '#fcfdff' }}>
                <div className={styles.sectionHeaderRow} style={{ marginBottom: '18px' }}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Odontogram History</h3>
                </div>

                {odontogramLogs.length > 0 ? (
                    <div className={scheduleStyles.tableContainer}>
                        <table className={`${wideTable.table} ${styles.treatmentHistoryTable}`}>
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Tooth</th>
                                    <th>Stage</th>
                                    <th>Updated To</th>
                                    <th>Updated By</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {odontogramLogs.map((log) => {
                                    const logId = log.id;
                                    const isExpanded = !!expandedOdontogramLogRows[logId];
                                    const stageLabel = getOdontogramStageLabel(log.stage);
                                    const statusAfterLabel = log.statusAfter ? getOdontogramStatusLabel(log.statusAfter) : 'Cleared';
                                    const statusBeforeLabel = log.statusBefore ? getOdontogramStatusLabel(log.statusBefore) : 'None';

                                    return (
                                        <Fragment key={logId}>
                                            <tr>
                                                <td>
                                                    <div className={scheduleStyles.patientCell}>
                                                        <strong>{formatDateShort(log.rawCreatedAt)}</strong>
                                                        <span>{formatDateTimeLong(log.rawCreatedAt)}</span>
                                                    </div>
                                                </td>
                                                <td>{log.tooth}</td>
                                                <td>{stageLabel}</td>
                                                <td title={buildOdontogramLogHeadline(log)}>{statusAfterLabel}</td>
                                                <td title={log.updatedByName || log.updatedByRole || 'Staff update'}>
                                                    {log.updatedByName || log.updatedByRole || 'Staff update'}
                                                </td>
                                                <td className={styles.detailsToggleCell}>
                                                    <button
                                                        type="button"
                                                        className={styles.expandInlineBtn}
                                                        onClick={() => toggleOdontogramLogRow(logId)}
                                                    >
                                                        {isExpanded ? 'Hide' : 'View'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className={styles.expandedDetailRow}>
                                                    <td colSpan="6">
                                                        <div className={styles.expandedDetailPanel}>
                                                            <div className={styles.expandedDetailGrid}>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>Summary</span>
                                                                    <p className={styles.expandedDetailValue}>{buildOdontogramLogHeadline(log)}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>Update Type</span>
                                                                    <p className={styles.expandedDetailValue}>{log.eventType || 'updated'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>Previous Status</span>
                                                                    <p className={styles.expandedDetailValue}>{statusBeforeLabel}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>New Status</span>
                                                                    <p className={styles.expandedDetailValue}>{statusAfterLabel}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>Previous Surfaces</span>
                                                                    <p className={styles.expandedDetailValue}>{formatSurfaceList(log.surfacesBefore)}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>New Surfaces</span>
                                                                    <p className={styles.expandedDetailValue}>{formatSurfaceList(log.surfacesAfter)}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>Previous Note</span>
                                                                    <p className={styles.expandedDetailValue}>{log.noteBefore || 'None'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className={styles.expandedDetailLabel}>New Note</span>
                                                                    <p className={styles.expandedDetailValue}>{log.noteAfter || 'None'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className={styles.emptyState}>No odontogram updates have been recorded yet.</div>
                )}
            </div>

            <div className={styles.contentCard} style={{ marginTop: '22px' }}>
                <div className={styles.sectionHeaderRow} style={{ marginBottom: '18px' }}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Suggested Tooth Workflow</h3>
                </div>
                <div className={styles.infoGrid}>
                    {ODONTOGRAM_WORKFLOW_GUIDE.map((item) => (
                        <div key={item.title} className={styles.infoBlock}>
                            <span className={styles.infoLabel}>{item.title}</span>
                            <p className={styles.infoValue}>{item.detail}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderUploadModal = () => (
        canUploadRadiograph && isUploadModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '92%', maxWidth: '860px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 15px 40px rgba(0,0,0,0.2)', fontFamily: "'Lexend Deca', sans-serif" }}>
                    <h3 style={{ color: '#01538b', fontSize: '20px', fontWeight: '800', margin: '0 0 20px 0', borderLeft: '4px solid #2dccf6', paddingLeft: '12px' }}>Upload Radiograph</h3>
                    <form onSubmit={handleUploadSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Label / Type <span style={{ color: 'red' }}>*</span></label>
                                <input type="text" className={styles.inputField} placeholder="e.g. Panoramic, Periapical, Bitewing" value={uploadForm.label} onChange={(e) => setUploadForm(p => ({ ...p, label: e.target.value }))} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Date Taken <span style={{ color: 'red' }}>*</span></label>
                                <input type="date" className={styles.inputField} value={uploadForm.date} onChange={(e) => setUploadForm(p => ({ ...p, date: e.target.value }))} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Radiograph Number</label>
                                <input type="text" className={styles.inputField} placeholder="Optional identifier" value={uploadForm.radiographNumber} onChange={(e) => setUploadForm(p => ({ ...p, radiographNumber: e.target.value }))} />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Image File <span style={{ color: 'red' }}>*</span></label>
                                <input type="file" accept="image/*" onChange={handleFileSelect} style={{ fontSize: '13px', fontFamily: "'Lexend Deca', sans-serif", width: '100%' }} />
                            </div>
                        </div>
                        {uploadPreview && (
                            <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                                <img src={uploadPreview} alt="Preview" style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9' }} />
                            </div>
                        )}
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Findings / Impression</label>
                            <textarea className={styles.textareaField} placeholder="Observed findings or impression..." value={uploadForm.findings} onChange={(e) => setUploadForm(p => ({ ...p, findings: e.target.value }))} rows={3} />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Notes (Optional)</label>
                            <textarea className={styles.textareaField} placeholder="Any clinical notes about this image..." value={uploadForm.notes} onChange={(e) => setUploadForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
                        </div>
                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={() => { setIsUploadModalOpen(false); setUploadPreview(null); setUploadForm({ label: '', date: '', radiographNumber: '', findings: '', notes: '' }); }} disabled={isUploading}>Cancel</button>
                            <button type="submit" className={styles.saveBtn} disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    );

    // ─── LOADING STATE ─────────────────────────────────────────────────────────
    // FIX: Show loading INSIDE the modal when onClose is provided
    if (isLoading) {
        const loadingContent = (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: '#01538b', fontWeight: 'bold' }}>
                Loading Electronic Medical Record...
            </div>
        );

        if (onClose) {
            return (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className={styles.overlayBackground} onClick={onClose}></div>
                    <div className={styles.formCard} style={{ backgroundColor: '#f4f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {loadingContent}
                    </div>
                </div>
            );
        }
        return (
            <main className={styles['main-content']}>
                {loadingContent}
            </main>
        );
    }

    if (!patient) {
        const notFoundContent = (
            <div style={{ textAlign: 'center', padding: '100px', color: '#ef4444', fontWeight: 'bold' }}>Patient record not found.</div>
        );
        if (onClose) {
            return (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className={styles.overlayBackground} onClick={onClose}></div>
                    <div className={styles.formCard} style={{ backgroundColor: '#f4f7fa' }}>{notFoundContent}</div>
                </div>
            );
        }
        return <main className={styles['main-content']}>{notFoundContent}</main>;
    }

    const patientPhone = patient?.contactNumber || 'N/A';

    const modalWrapperStyle = onClose ? {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    } : {};

    const innerContent = (
        <div className={onClose ? styles.formCard : ''} style={onClose ? { backgroundColor: '#f4f7fa' } : {}}>
            {!embedded && (
                <div className={styles.headerWrapper}>
                    <div className={styles.headerLeft}>
                        {(onClose || effectiveRole !== 'patient') ? (
                            <button className={styles.backIconButton} onClick={handleBack} title="Back">
                                {onClose ? <FaTimes /> : <FaArrowLeft />}
                            </button>
                        ) : null}
                        <div className={styles.header}>
                            <h1 className={styles.title}>Electronic Medical Record</h1>
                            <p className={styles.subtitle}>Comprehensive clinical profile and treatment history</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.profileHeaderCard}>
                <UserAvatar user={{ name: patient.name, profileImage: patient.profileImage }} size={90} style={{ border: '3px solid #e0f2fe', boxShadow: '0 4px 10px rgba(1,83,139,0.1)' }} />
                <div className={styles.patientMainInfo}>
                    <div className={styles.nameRow}>
                        <h2 className={styles.patientName}>
                            {patient.name?.first ? `${patient.name.first} ${patient.name.last}` : patient.name}
                        </h2>
                        {patient.assignedBranches?.[0] && (
                            <span className={styles.branchBadge}>{patient.assignedBranches[0]} Branch</span>
                        )}
                        <span className={styles.patientId}>ID: {patient._id || patient.id}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaItem}>
                            <FaUserMd className={styles.metaIcon} />
                            {patient.gender}{patientAge ? `, ${patientAge} y/o` : ''}
                            {patient.birthdate ? ` (DOB: ${formatDateShort(patient.birthdate)})` : ''}
                        </span>
                        <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {patientPhone}</span>
                        <span className={styles.metaItem}><FaEnvelope className={styles.metaIcon} /> {patient.email}</span>
                    </div>
                </div>
                <div className={styles.profileHeaderActions}>
                    <button type="button" className={styles.exportActionBtn} onClick={handleExportPdf}>
                        <FaFilePdf /> Export PDF
                    </button>
                </div>
            </div>

            {/* Updated Tab Structure */}
            <div className={styles.tabContainer}>
                <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'medicalHistory' ? styles.active : ''}`} onClick={() => setActiveTab('medicalHistory')}>Medical & Dental History</button>
                <button className={`${styles.tabBtn} ${activeTab === 'treatmentLogs' ? styles.active : ''}`} onClick={() => setActiveTab('treatmentLogs')}>Treatment History</button>
                <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Odontogram</button>
                <button className={`${styles.tabBtn} ${activeTab === 'radiographs' ? styles.active : ''}`} onClick={() => setActiveTab('radiographs')}>Radiographs</button>
            </div>

            <div className={styles.tabContentArea}>
                {activeTab === 'overview'       && renderOverview()}
                {activeTab === 'medicalHistory' && renderMedicalHistoryAligned()}
                {activeTab === 'treatmentLogs'  && renderTreatmentLogs()}
                {activeTab === 'odontogram'     && renderOdontogram()}
                {activeTab === 'radiographs'    && renderRadiographs()}
            </div>
        </div>
    );

    if (onClose) {
        return (
            <div style={modalWrapperStyle}>
                <div className={styles.overlayBackground} onClick={onClose}></div>
                {innerContent}
                {renderUploadModal()}
                {renderPrintPreview()}
            </div>
        );
    }

    if (embedded) {
        return (
            <>
                {innerContent}
                {renderUploadModal()}
                {renderPrintPreview()}
            </>
        );
    }

    return (
        <>
            <main className={styles['main-content']}>{innerContent}</main>
            {renderUploadModal()}
            {renderPrintPreview()}
        </>
    );
}
