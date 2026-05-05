import React, { Fragment, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';

import { useAuth } from '../../hooks/useAuth';
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
    FaUpload, FaMagic, FaRobot, FaCalendarAlt, FaIdCard,
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
    const { addToast } = useToast();
    const effectiveRole = roleOverride || user?.role || 'administrator';
    const isReadOnly = forceReadOnly || effectiveRole === 'secretary';
    const canEditMedical = !isReadOnly;
    const canAddTreatmentLog = !isReadOnly;
    const canUploadRadiograph = !isReadOnly;
    
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
    const [logsRangeFilter, setLogsRangeFilter] = useState('today');
    const [logsDateFrom, setLogsDateFrom] = useState(getTodayString());
    const [logsDateTo, setLogsDateTo] = useState(getTodayString());
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
        notes: '',
        branchId: '',
    });
    const [expandedLogRows, setExpandedLogRows] = useState({});

    // Tab: Radiograph States
    const [radiographs, setRadiographs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: '', date: '', radiographNumber: '', findings: '', notes: '' });
    const [uploadPreview, setUploadPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const [branches, setBranches] = useState([]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const { authFetch } = await import('../../utils/api');
                const res = await authFetch('/branches');
                if (res.ok) setBranches(await res.json());
            } catch (e) { console.error('Error fetching branches:', e); }
        };
        fetchBranches();
    }, []);

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
                    const normalized = logsData.map(log => ({
                        ...log,
                        id: log._id || log.id,
                        rawDate: new Date(log.date || log.rawDate),
                    }));
                    setLogs(normalized.sort((a, b) => b.rawDate - a.rawDate));
                }

                const radRes = await authFetch(`/patients/${activePatientId}/radiographs`);
                if (radRes.ok) {
                    const radData = await radRes.json();
                    const normalizedRads = radData.map(r => ({
                        ...r,
                        id: r._id || r.id,
                        rawDate: new Date(r.date || r.uploadedAt || r.createdAt),
                        type: r.label || r.type || 'Radiograph',
                        url: r.url || r.imageUrl,
                        radiographNumber: r.radiographNumber || '',
                        findings: r.findings || '',
                    }));
                    setRadiographs(normalizedRads);
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

    // ─── OVERVIEW TAB: Patient Info ────────────────────────────────────────────
    const renderOverview = () => {
        const patientAge = patient?.birthdate
            ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
            : null;

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
                            ? `${formatDateLong(patient.birthdate)}${patientAge !== null ? ` (${patientAge} years old)` : ''}` 
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
                    {infoItem('House No.', patient?.currentAddress?.houseNumber)}
                    {infoItem('Street', patient?.currentAddress?.street)}
                    {infoItem('Barangay', patient?.currentAddress?.barangay)}
                    {infoItem('City / Municipality', cities[patient?.currentAddress?.province]?.find(c => c.code === patient?.currentAddress?.city)?.name || patient?.currentAddress?.city)}
                    {infoItem('Province', provinces[patient?.currentAddress?.region]?.find(p => p.code === patient?.currentAddress?.province)?.name || patient?.currentAddress?.province)}
                    {infoItem('Region', regions.find(r => r.code === patient?.currentAddress?.region)?.name || patient?.currentAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Home Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(patient?.currentAddress)}
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
                            <label>Bleeding Time</label>
                            <input type="text" name="bleedingTime" value={medicalForm.bleedingTime} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Blood Pressure</label>
                            <input type="text" name="bloodPressure" value={medicalForm.bloodPressure} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="e.g., 120/80" />
                        </div>
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
                        {renderYesNoEditor('Pregnant?', 'isPregnant')}
                        {renderYesNoEditor('Nursing?', 'isNursing')}
                        {renderYesNoEditor('Taking Birth Control Pills?', 'takingBirthControl')}
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
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Blood Type</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bloodType)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Bleeding Time</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bleedingTime)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Blood Pressure</span><p className={styles.infoValue}>{textDisplay(medicalHistory.bloodPressure)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Are You in Good Health?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.inGoodHealth)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Use Tobacco Products?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.usesTobacco)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Use Alcohol, Cocaine, or Other Dangerous Drugs?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.usesAlcoholOrDrugs)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Has Allergies?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.hasAllergies)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Pregnant?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.isPregnant)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Nursing?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.isNursing)}</p></div>
                            <div className={styles.infoBlock}><span className={styles.infoLabel}>Taking Birth Control Pills?</span><p className={styles.infoValue}>{yesNoDisplay(medicalHistory.takingBirthControl)}</p></div>
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

                        <div className={styles.infoBlock} style={{ marginTop: '28px' }}>
                            <span className={styles.infoLabel} style={{ color: '#ef4444' }}><FaSyringe style={{marginRight: '6px'}} />Allergy Checklist</span>
                            {renderChecklist(ALLERGY_OPTIONS, allergySelections, true)}
                            <p className={styles.infoValue} style={{ marginTop: '12px' }}>Other Allergy: {allergySelections.filter((item) => !ALLERGY_OPTIONS.includes(item)).join(', ') || 'Not specified'}</p>
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
                    notes: newLogForm.notes,
                    branch: newLogForm.branchId,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save log.');

            const saved = await res.json();
            const newLog = {
                ...saved,
                id: saved._id || saved.id,
                rawDate: new Date(saved.date || newLogForm.date),
            };
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
                notes: '',
                branchId: '',
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

    const normalizedLogRange = (() => {
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
            || (log.notes || '').toLowerCase().includes(searchLower)
            || (log.dentistName || '').toLowerCase().includes(searchLower)
            || String(log.amountCharged || '').includes(searchLower)
            || String(log.amountPaid || '').includes(searchLower)
            || String(log.balance || '').includes(searchLower);
        const matchesCategory = logsCategory === 'All' || log.category === logsCategory;
        const logDateKey = log.rawDate.toISOString().split('T')[0];
        const matchesDate = logDateKey >= normalizedLogRange.from && logDateKey <= normalizedLogRange.to;
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
                            placeholder="Search procedures, dentist, or notes..."
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
                            <th style={{ width: '12%' }}>Date</th>
                            <th style={{ width: '10%' }}>Tooth No./s</th>
                            <th style={{ width: '18%' }}>Procedure</th>
                            <th style={{ width: '16%' }}>Dentist/s</th>
                            <th style={{ width: '12%' }}>Amount Charged</th>
                            <th style={{ width: '11%' }}>Amount Paid</th>
                            <th style={{ width: '9%' }}>Balance</th>
                            <th style={{ width: '12%' }}>Next Appointment</th>
                            <th style={{ width: '8%' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.length > 0 ? (
                            filteredLogs.map((log) => {
                                const logId = log.id;
                                const isExpanded = !!expandedLogRows[logId];
                                return (
                                <Fragment key={logId}>
                                <tr>
                                    <td className={styles.singleLineCell}>
                                        <div className={scheduleStyles.patientCell}>
                                            <strong>{formatDateShort(log.rawDate)}</strong>
                                            <span>{formatDateLong(log.rawDate)}</span>
                                        </div>
                                    </td>
                                    <td className={styles.singleLineCell} title={log.tooth || '-'}>
                                        {log.tooth || '-'}
                                    </td>
                                    <td className={styles.singleLineCell} title={log.procedure}>{log.procedure}</td>
                                    <td className={styles.singleLineCell} title={log.dentistName || log.doctor || log.dentist || '-'}>
                                        {log.dentistName || log.doctor || log.dentist || '-'}
                                    </td>
                                    <td className={styles.singleLineCell} title={formatMoney(log.amountCharged)}>
                                        {formatMoney(log.amountCharged)}
                                    </td>
                                    <td className={styles.singleLineCell} title={formatMoney(log.amountPaid)}>
                                        {formatMoney(log.amountPaid)}
                                    </td>
                                    <td className={styles.singleLineCell} title={formatMoney(log.balance)}>
                                        {formatMoney(log.balance)}
                                    </td>
                                    <td className={styles.singleLineCell} title={formatShortDate(log.nextAppointment)}>
                                        {formatShortDate(log.nextAppointment)}
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
                                        <td colSpan="9">
                                            <div className={styles.expandedDetailPanel}>
                                                <div className={styles.expandedDetailGrid}>
                                                    <div>
                                                        <span className={styles.expandedDetailLabel}>Category</span>
                                                        <p className={styles.expandedDetailValue}>{log.category || 'Other'}</p>
                                                    </div>
                                                    <div>
                                                        <span className={styles.expandedDetailLabel}>Branch</span>
                                                        <p className={styles.expandedDetailValue}>{log.branch || '-'}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className={styles.expandedDetailLabel}>Dentist Notes</span>
                                                    <p className={styles.expandedDetailValue}>{log.notes || 'No notes recorded.'}</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </Fragment>
                            );
                            })
                        ) : (
                            <tr>
                                <td colSpan="9" className={scheduleStyles.emptyStateBox}>No treatment logs match the current filters.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {canAddTreatmentLog && isAddLogOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard} style={{ maxWidth: '720px' }}>
                        <h3 className={styles.modalTitle} style={{ textAlign: 'left', border: 'none', padding: 0, marginBottom: '12px' }}>Add Treatment Log</h3>
                        <p style={{ margin: '0 0 18px 0', color: '#64748b', lineHeight: 1.6 }}>
                            Follow the clinic treatment record: enter the service details on one row, then use dentist notes for the expandable remarks below the history row.
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
                            </div>
                            <div className={styles.formGroup}>
                                <label>Dentist Notes <span style={{color:'red'}}>*</span></label>
                                <textarea required className={styles.textareaField} value={newLogForm.notes} onChange={(e) => setNewLogForm({...newLogForm, notes: e.target.value})} placeholder="Describe the procedure, patient condition, dentist remarks, and any follow-up instructions." />
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
        setIsEnhanced(false);
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
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
            setRadiographs(prev => [{
                ...saved,
                id: saved._id || saved.id,
                rawDate: new Date(saved.date || uploadForm.date),
                type: saved.label || uploadForm.label,
                url: saved.url || uploadPreview,
                radiographNumber: saved.radiographNumber || uploadForm.radiographNumber,
                findings: saved.findings || uploadForm.findings,
            }, ...prev]);
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

    const handleAIEnhance = () => {
        if (isEnhanced) { setIsEnhanced(false); return; }
        setIsEnhancing(true);
        setTimeout(() => {
            setIsEnhancing(false);
            setIsEnhanced(true);
            addToast("AI Enhancement applied successfully.", "success");
        }, 1500);
    };

    const renderRadiographs = () => {
        if (selectedRadiograph) {
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
                                src={selectedRadiograph.url} 
                                alt={selectedRadiograph.type} 
                                className={`${styles.largeRadiograph} ${isEnhanced ? styles.enhancedImage : ''}`}
                            />
                            {isEnhancing && (
                                <div className={styles.loadingOverlay}>
                                    <FaRobot className={styles.spinningIcon} />
                                    <span>AI is clarifying image...</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.imageViewerControls}>
                            <button 
                                className={styles.aiEnhanceBtn} 
                                onClick={handleAIEnhance}
                                disabled={isEnhancing}
                            >
                                {isEnhancing ? (
                                    <>Processing...</>
                                ) : isEnhanced ? (
                                    <><FaMagic /> Revert to Original</>
                                ) : (
                                    <><FaMagic /> AI Enhance Clarity</>
                                )}
                            </button>
                        </div>
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
                                    <img src={img.url} alt={img.type} className={styles.radioThumbnail} />
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
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Interactive Dental Chart</h3>
            </div>
            <Odontogram patientId={activePatientId} /> 
        </div>
    );

    const renderUploadModal = () => (
        canUploadRadiograph && isUploadModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '90%', maxWidth: '480px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)', fontFamily: "'Lexend Deca', sans-serif" }}>
                    <h3 style={{ color: '#01538b', fontSize: '20px', fontWeight: '800', margin: '0 0 20px 0', borderLeft: '4px solid #2dccf6', paddingLeft: '12px' }}>Upload Radiograph</h3>
                    <form onSubmit={handleUploadSubmit}>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Label / Type <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" className={styles.inputField} placeholder="e.g. Panoramic, Periapical, Bitewing" value={uploadForm.label} onChange={(e) => setUploadForm(p => ({ ...p, label: e.target.value }))} required />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Date Taken <span style={{ color: 'red' }}>*</span></label>
                            <input type="date" className={styles.inputField} value={uploadForm.date} onChange={(e) => setUploadForm(p => ({ ...p, date: e.target.value }))} required />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Radiograph Number</label>
                            <input type="text" className={styles.inputField} placeholder="Optional identifier" value={uploadForm.radiographNumber} onChange={(e) => setUploadForm(p => ({ ...p, radiographNumber: e.target.value }))} />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Image File <span style={{ color: 'red' }}>*</span></label>
                            <input type="file" accept="image/*" onChange={handleFileSelect} style={{ fontSize: '13px', fontFamily: "'Lexend Deca', sans-serif" }} />
                            {uploadPreview && (
                                <img src={uploadPreview} alt="Preview" style={{ marginTop: '10px', width: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9' }} />
                            )}
                        </div>
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

    const patientAge = patient?.birthdate
        ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
        : null;
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
                        <button className={styles.backIconButton} onClick={handleBack} title="Back">
                            {onClose ? <FaTimes /> : <FaArrowLeft />}
                        </button>
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
            </div>

            {/* Updated Tab Structure */}
            <div className={styles.tabContainer}>
                <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'medicalHistory' ? styles.active : ''}`} onClick={() => setActiveTab('medicalHistory')}>Medical & Dental History</button>
                <button className={`${styles.tabBtn} ${activeTab === 'treatmentLogs' ? styles.active : ''}`} onClick={() => setActiveTab('treatmentLogs')}>Treatment Logs</button>
                <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Dental Chart</button>
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
            </div>
        );
    }

    if (embedded) {
        return (
            <>
                {innerContent}
                {renderUploadModal()}
            </>
        );
    }

    return (
        <>
            <main className={styles['main-content']}>{innerContent}</main>
            {renderUploadModal()}
        </>
    );
}
