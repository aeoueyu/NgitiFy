import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/AddPatient.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import successIcon from '../../assets/alert/success.svg';
import { authFetch } from '../../utils/api';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { useAuth } from '../../hooks/useAuth';
import ConsentReviewModal from '../../components/admin/ConsentReviewModal';
import {
    formatPatientDuplicateLine,
    getPatientDuplicateCandidates,
    getPatientDuplicateSections,
} from '../../utils/patientDuplicateWarnings';
import {
    ALLERGY_OPTIONS,
    MEDICAL_CONDITION_OPTIONS,
    NATIONALITY_OPTIONS,
    RELIGION_OPTIONS,
    PHYSICIAN_SPECIALTY_OPTIONS,
    LANDLINE_PREFIX,
    isValidLandlineNumber,
    isValidMobileNumber,
    stripLandlinePrefix,
    stripMobilePrefix,
    toLandlinePayload,
    toMobilePayload,
    getSelectValueWithOther,
    getOtherTextValue,
} from '../../utils/patientIntake';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

const splitFullName = (fullName = '') => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: parts[0] };
    if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
    return {
        firstName: parts[0],
        middleName: parts.slice(1, -1).join(' '),
        lastName: parts[parts.length - 1],
    };
};

const initialMedicalHistory = {
    inGoodHealth: '',
    underMedicalTreatment: '',
    medicalTreatmentDetails: '',
    hadSeriousIllnessOrSurgery: '',
    seriousIllnessOrSurgeryDetails: '',
    hadHospitalization: '',
    hospitalizationDetails: '',
    isTakingMedication: '',
    medications: '',
    usesTobacco: '',
    usesAlcoholOrDrugs: '',
    hasAllergies: '',
    allergies: [],
    allergyOther: '',
    conditions: [],
    conditionOther: '',
    notes: '',
    bleedingTime: '',
    bloodPressure: '',
    isPregnant: '',
    isNursing: '',
    takingBirthControl: '',
};

const initialDentalHistory = {
    lastExamDate: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    hasConfidentialInfo: '',
};

const initialPhysician = {
    name: '',
    specialty: '',
    specialtyOther: '',
    officeAddress: '',
    officeNumber: '',
};

const selectToBool = (value) => {
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return undefined;
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

export default function RegisterGuestPatient({ appointment, onClose, onSuccess }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isBranchScopedStaff = user?.role === 'branch-manager' || user?.role === 'secretary';
    const isSecretary = user?.role === 'secretary';
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [duplicateSummary, setDuplicateSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [registrationMode, setRegistrationMode] = useState('create-new');
    const [registeredPatient, setRegisteredPatient] = useState(null);
    const [selectedExistingPatientId, setSelectedExistingPatientId] = useState('');
    const [softDuplicateConfirmed, setSoftDuplicateConfirmed] = useState(false);

    const nameParts = useMemo(() => splitFullName(appointment?.patientName || appointment?.guestName || ''), [appointment]);

    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        birthdate: '',
        gender: '',
        email: '',
        phone: '',
        homePhone: '',
        occupation: '',
        civilStatus: '',
        bloodType: '',
        nationality: 'Filipino',
        religion: '',
        religionOther: '',
        workPhone: '',
        referredBy: '',
        reasonForConsultation: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactPhone: '',
        guardianName: '',
        guardianRelationship: '',
        guardianContact: '',
        guardianOccupation: '',
        assignedBranch: '',
        dentalHistory: { ...initialDentalHistory },
        medicalHistory: { ...initialMedicalHistory },
        physician: { ...initialPhysician },
        consentAcknowledgement: {
            acknowledged: false,
            signerName: '',
            signerRole: 'Patient',
            signedAt: getTodayDate(),
        },
        currentAddress: { ...initialAddressState },
        permanentAddress: { ...initialAddressState },
        dataPrivacyConsent: {
            acknowledged: false,
            signerName: '',
            signerRole: 'Patient',
            signedAt: getTodayDate(),
        },
    });

    useEffect(() => {
        const nextCurrentAddress = { ...initialAddressState, ...(appointment?.guestCurrentAddress || {}) };
        const nextPermanentAddress = { ...initialAddressState, ...(appointment?.guestPermanentAddress || {}) };
        const guestProfile = appointment?.guestProfile || {};
        const guestEmergencyContact = appointment?.guestEmergencyContact || {};
        const guestGuardian = appointment?.guestGuardian || {};
        const guestPhysician = appointment?.guestPhysician || {};
        const guestDentalHistory = appointment?.guestDentalHistory || {};
        const guestMedicalHistory = appointment?.guestMedicalHistory || {};

        setFormData((prev) => ({
            ...prev,
            firstName: nameParts.firstName,
            middleName: nameParts.middleName,
            lastName: nameParts.lastName,
            birthdate: appointment?.guestBirthdate ? new Date(appointment.guestBirthdate).toISOString().split('T')[0] : prev.birthdate,
            gender: appointment?.guestGender || prev.gender,
            email: appointment?.guestEmail || '',
            phone: stripMobilePrefix(appointment?.guestPhone || ''),
            homePhone: stripLandlinePrefix(guestProfile.homePhone || ''),
            occupation: guestProfile.occupation || prev.occupation,
            civilStatus: guestProfile.civilStatus || prev.civilStatus,
            bloodType: guestProfile.bloodType || prev.bloodType,
            nationality: guestProfile.nationality || prev.nationality,
            religion: getSelectValueWithOther(guestProfile.religion || prev.religion, RELIGION_OPTIONS),
            religionOther: getOtherTextValue(guestProfile.religion || prev.religion, RELIGION_OPTIONS),
            workPhone: stripLandlinePrefix(guestProfile.workPhone || ''),
            referredBy: guestProfile.referredBy || prev.referredBy,
            reasonForConsultation: guestProfile.reasonForConsultation || guestDentalHistory.chiefComplaint || prev.reasonForConsultation,
            emergencyContactName: guestEmergencyContact.name || '',
            emergencyContactRelationship: guestEmergencyContact.relationship || '',
            emergencyContactPhone: stripMobilePrefix(guestEmergencyContact.contactNumber || ''),
            guardianName: guestGuardian.name || '',
            guardianRelationship: guestGuardian.relationship || '',
            guardianContact: stripMobilePrefix(guestGuardian.contactNumber || ''),
            guardianOccupation: guestGuardian.occupation || '',
            assignedBranch: isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || '') : (appointment?.branch || ''),
            dentalHistory: {
                ...prev.dentalHistory,
                lastExamDate: guestDentalHistory.lastExamDate ? new Date(guestDentalHistory.lastExamDate).toISOString().split('T')[0] : prev.dentalHistory.lastExamDate,
                hadTreatmentReaction: guestDentalHistory.hadTreatmentReaction === undefined
                    ? prev.dentalHistory.hadTreatmentReaction
                    : (guestDentalHistory.hadTreatmentReaction ? 'yes' : 'no'),
                reactionDetails: guestDentalHistory.reactionDetails || prev.dentalHistory.reactionDetails,
                hasConfidentialInfo: guestDentalHistory.hasConfidentialInfo === undefined
                    ? prev.dentalHistory.hasConfidentialInfo
                    : (guestDentalHistory.hasConfidentialInfo ? 'yes' : 'no'),
            },
            medicalHistory: {
                ...prev.medicalHistory,
                inGoodHealth: guestMedicalHistory.inGoodHealth === undefined ? prev.medicalHistory.inGoodHealth : (guestMedicalHistory.inGoodHealth ? 'yes' : 'no'),
                underMedicalTreatment: guestMedicalHistory.underMedicalTreatment === undefined ? prev.medicalHistory.underMedicalTreatment : (guestMedicalHistory.underMedicalTreatment ? 'yes' : 'no'),
                medicalTreatmentDetails: guestMedicalHistory.medicalTreatmentDetails || prev.medicalHistory.medicalTreatmentDetails,
                hadSeriousIllnessOrSurgery: guestMedicalHistory.hadSeriousIllnessOrSurgery === undefined ? prev.medicalHistory.hadSeriousIllnessOrSurgery : (guestMedicalHistory.hadSeriousIllnessOrSurgery ? 'yes' : 'no'),
                seriousIllnessOrSurgeryDetails: guestMedicalHistory.seriousIllnessOrSurgeryDetails || prev.medicalHistory.seriousIllnessOrSurgeryDetails,
                hadHospitalization: guestMedicalHistory.hadHospitalization === undefined ? prev.medicalHistory.hadHospitalization : (guestMedicalHistory.hadHospitalization ? 'yes' : 'no'),
                hospitalizationDetails: guestMedicalHistory.hospitalizationDetails || prev.medicalHistory.hospitalizationDetails,
                isTakingMedication: guestMedicalHistory.isTakingMedication === undefined ? prev.medicalHistory.isTakingMedication : (guestMedicalHistory.isTakingMedication ? 'yes' : 'no'),
                medications: Array.isArray(guestMedicalHistory.medications) ? guestMedicalHistory.medications.join(', ') : (guestMedicalHistory.medications || prev.medicalHistory.medications),
                usesTobacco: guestMedicalHistory.usesTobacco === undefined ? prev.medicalHistory.usesTobacco : (guestMedicalHistory.usesTobacco ? 'yes' : 'no'),
                usesAlcoholOrDrugs: guestMedicalHistory.usesAlcoholOrDrugs === undefined ? prev.medicalHistory.usesAlcoholOrDrugs : (guestMedicalHistory.usesAlcoholOrDrugs ? 'yes' : 'no'),
                hasAllergies: guestMedicalHistory.hasAllergies === undefined ? prev.medicalHistory.hasAllergies : (guestMedicalHistory.hasAllergies ? 'yes' : 'no'),
                allergies: Array.isArray(guestMedicalHistory.allergies) ? guestMedicalHistory.allergies.filter((entry) => ALLERGY_OPTIONS.includes(entry)) : prev.medicalHistory.allergies,
                allergyOther: Array.isArray(guestMedicalHistory.allergies) ? guestMedicalHistory.allergies.filter((entry) => !ALLERGY_OPTIONS.includes(entry)).join(', ') : prev.medicalHistory.allergyOther,
                conditions: Array.isArray(guestMedicalHistory.conditions) ? guestMedicalHistory.conditions.filter((entry) => MEDICAL_CONDITION_OPTIONS.includes(entry)) : prev.medicalHistory.conditions,
                conditionOther: Array.isArray(guestMedicalHistory.conditions) ? guestMedicalHistory.conditions.filter((entry) => !MEDICAL_CONDITION_OPTIONS.includes(entry)).join(', ') : prev.medicalHistory.conditionOther,
                notes: guestMedicalHistory.notes || prev.medicalHistory.notes,
                bleedingTime: guestMedicalHistory.bleedingTime || prev.medicalHistory.bleedingTime,
                bloodPressure: guestMedicalHistory.bloodPressure || prev.medicalHistory.bloodPressure,
                isPregnant: guestMedicalHistory.isPregnant === undefined ? prev.medicalHistory.isPregnant : (guestMedicalHistory.isPregnant ? 'yes' : 'no'),
                isNursing: guestMedicalHistory.isNursing === undefined ? prev.medicalHistory.isNursing : (guestMedicalHistory.isNursing ? 'yes' : 'no'),
                takingBirthControl: guestMedicalHistory.takingBirthControl === undefined ? prev.medicalHistory.takingBirthControl : (guestMedicalHistory.takingBirthControl ? 'yes' : 'no'),
            },
            physician: {
                ...prev.physician,
                name: guestPhysician.name || prev.physician.name,
                specialty: getSelectValueWithOther(guestPhysician.specialty || prev.physician.specialty, PHYSICIAN_SPECIALTY_OPTIONS),
                specialtyOther: getOtherTextValue(guestPhysician.specialty || prev.physician.specialty, PHYSICIAN_SPECIALTY_OPTIONS),
                officeAddress: guestPhysician.officeAddress || prev.physician.officeAddress,
                officeNumber: stripLandlinePrefix(guestPhysician.officeNumber || ''),
            },
            currentAddress: nextCurrentAddress,
            permanentAddress: nextPermanentAddress,
        }));
    }, [appointment, isBranchScopedStaff, nameParts, user?.assignedBranch]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await authFetch('/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranchOptions(data.map((branch) => branch.name));
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        };
        fetchBranches();
    }, []);

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
    };

    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
    const getAge = (d) => { const today = new Date(); const birth = new Date(d); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--; return age; };
    const getMaxDate = () => new Date().toISOString().split('T')[0];
    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;
    const isLinkMode = registrationMode === 'link-existing';
    const patientRecordPath = useMemo(() => {
        const patientId = registeredPatient?._id || registeredPatient?.id;
        if (!patientId) return '';
        const role = user?.role || '';
        if (role === 'administrator') return `/admin/patients/${patientId}/emr`;
        if (role === 'owner') return `/owner/patients/${patientId}/emr`;
        if (role === 'branch-manager') return `/branch-manager/patients/${patientId}/emr`;
        if (role === 'secretary') return `/secretary/patients/${patientId}/emr`;
        if (role === 'dentist') return `/dentist/patients/${patientId}/emr`;
        return '';
    }, [registeredPatient, user?.role]);
    const duplicateCandidatePatients = useMemo(
        () => getPatientDuplicateCandidates(duplicateSummary),
        [duplicateSummary]
    );
    const selectedExistingPatient = useMemo(
        () => duplicateCandidatePatients.find((patient) => patient.id === selectedExistingPatientId) || null,
        [duplicateCandidatePatients, selectedExistingPatientId]
    );
    const hasSoftDuplicateWarning = Boolean(duplicateSummary?.hasAnyMatch && !duplicateSummary?.hasStrongMatch);

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = '';
        if (name === 'email') {
            if (!value) newError = 'Required';
            else if (!validateEmail(value)) newError = 'Enter a valid email address.';
        } else if (name === 'phone' || name === 'guardianContact') {
            if (!value) newError = 'Required';
            else if (!isValidMobileNumber(value)) newError = 'Invalid format (9xxxxxxxxx)';
        } else if (['homePhone', 'workPhone'].includes(name) && value && !isValidLandlineNumber(value)) {
            newError = 'Invalid landline format';
        }
        setErrors((prev) => ({ ...prev, [name]: newError }));
    };

    const handleSelectExistingPatient = (patient) => {
        if (!patient?.id) return;

        const selectedNameParts = splitFullName(patient.name || '');
        setRegistrationMode('link-existing');
        setSelectedExistingPatientId(patient.id);
        setSoftDuplicateConfirmed(false);
        setFormData((prev) => ({
            ...prev,
            firstName: selectedNameParts.firstName || prev.firstName,
            middleName: selectedNameParts.middleName || prev.middleName,
            lastName: selectedNameParts.lastName || prev.lastName,
            birthdate: patient.birthdate || prev.birthdate,
            email: patient.email || prev.email,
            phone: stripMobilePrefix(patient.contactNumber || prev.phone),
            assignedBranch: isBranchScopedStaff
                ? (user?.assignedBranch || appointment?.branch || prev.assignedBranch)
                : (patient.assignedBranch || appointment?.branch || prev.assignedBranch),
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.duplicateCheck;
            delete next.existingPatientId;
            delete next.email;
            return next;
        });
    };

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (['firstName', 'middleName', 'lastName', 'birthdate', 'email'].includes(name)) {
            setDuplicateSummary(null);
            setSoftDuplicateConfirmed(false);
            setErrors((prev) => {
                if (!prev.duplicateCheck && !prev.existingPatientId) return prev;
                const next = { ...prev };
                delete next.duplicateCheck;
                delete next.existingPatientId;
                return next;
            });
        }
        if (selectedExistingPatientId && ['firstName', 'middleName', 'lastName', 'birthdate', 'email'].includes(name)) {
            setSelectedExistingPatientId('');
        }
        if (errors[name]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
        if (['firstName', 'middleName', 'lastName', 'guardianName'].includes(name)) {
            if (value === '' || /^[a-zA-Z\s.-]+$/.test(value)) {
                setFormData((prev) => ({ ...prev, [name]: toTitleCase(value) }));
            }
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (fieldName) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (fieldName === 'phone') {
            setDuplicateSummary(null);
            setSoftDuplicateConfirmed(false);
            setErrors((prev) => {
                if (!prev.duplicateCheck && !prev.existingPatientId) return prev;
                const next = { ...prev };
                delete next.duplicateCheck;
                delete next.existingPatientId;
                return next;
            });
        }
        if (selectedExistingPatientId && fieldName === 'phone') {
            setSelectedExistingPatientId('');
        }
        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleLandlineChange = (fieldName) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleAddressChange = (type, field, value) => {
        const errorKey = `${type === 'currentAddress' ? 'current' : 'permanent'}_${field}`;
        if (errors[errorKey]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[errorKey];
                return next;
            });
        }
        setFormData((prev) => {
            const updated = { ...prev[type], [field]: value };
            if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city') { updated.barangay = ''; }
            return { ...prev, [type]: updated };
        });
    };

    const handleNestedChange = (section, field, value) => {
        setFormData((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            }
        }));
    };

    const handleConsentAcknowledged = (acknowledged) => {
        setFormData((prev) => ({
            ...prev,
            consentAcknowledgement: {
                ...prev.consentAcknowledgement,
                acknowledged,
            }
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.consentAcknowledgement_acknowledged;
            return next;
        });
    };

    const handlePrivacyAcknowledged = (acknowledged) => {
        setFormData((prev) => ({
            ...prev,
            dataPrivacyConsent: {
                ...prev.dataPrivacyConsent,
                acknowledged,
            }
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.dataPrivacyConsent_acknowledged;
            return next;
        });
    };

    const handleNestedLandlineChange = (section, field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        const errorKey = `${section}_${field}`;
        if (errors[errorKey]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[errorKey];
                return next;
            });
        }
        handleNestedChange(section, field, value);
    };

    const handleNestedArrayToggle = (section, field, item) => {
        setFormData((prev) => {
            const currentValues = prev[section][field] || [];
            const exists = currentValues.includes(item);
            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: exists ? currentValues.filter((value) => value !== item) : [...currentValues, item],
                }
            };
        });
    };

    const validateForm = () => {
        const nextErrors = {};
        let isValid = true;
        const required = isLinkMode
            ? ['firstName', 'lastName', 'birthdate', 'email']
            : ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        required.forEach((field) => {
            if (!formData[field]) {
                nextErrors[field] = 'Required';
                isValid = false;
            }
        });

        if (isLinkMode) {
            if (formData.email && !validateEmail(formData.email)) {
                nextErrors.email = 'Invalid email address.';
                isValid = false;
            }
            if (duplicateSummary?.requiresManualSelection && !selectedExistingPatientId) {
                nextErrors.existingPatientId = 'Select the correct existing patient account before linking this appointment.';
                isValid = false;
            }
            setErrors(nextErrors);
            return isValid;
        }

        if (!formData.phone) {
            nextErrors.phone = 'Required';
            isValid = false;
        } else if (!isValidMobileNumber(formData.phone)) {
            nextErrors.phone = 'Invalid format';
            isValid = false;
        }
        if (formData.homePhone && !isValidLandlineNumber(formData.homePhone)) {
            nextErrors.homePhone = 'Invalid landline format';
            isValid = false;
        }
        if (formData.workPhone && !isValidLandlineNumber(formData.workPhone)) {
            nextErrors.workPhone = 'Invalid landline format';
            isValid = false;
        }
        if (formData.emergencyContactPhone && !isValidMobileNumber(formData.emergencyContactPhone)) {
            nextErrors.emergencyContactPhone = 'Invalid format';
            isValid = false;
        }
        if (formData.physician.officeNumber && !isValidLandlineNumber(formData.physician.officeNumber)) {
            nextErrors.physician_officeNumber = 'Invalid landline format';
            isValid = false;
        }

        if (formData.email && !validateEmail(formData.email)) {
            nextErrors.email = 'Invalid email address.';
            isValid = false;
        }
        if (!formData.consentAcknowledgement.acknowledged) {
            nextErrors.consentAcknowledgement_acknowledged = 'Required';
            isValid = false;
        }
        if (!formData.consentAcknowledgement.signerName.trim()) {
            nextErrors.consentAcknowledgement_signerName = 'Required';
            isValid = false;
        }
        if (!formData.dataPrivacyConsent.acknowledged) {
            nextErrors.dataPrivacyConsent_acknowledged = 'Required';
            isValid = false;
        }
        if (!formData.dataPrivacyConsent.signerName.trim()) {
            nextErrors.dataPrivacyConsent_signerName = 'Required';
            isValid = false;
        }

        if (!isBranchScopedStaff && !formData.assignedBranch) {
            nextErrors.assignedBranch = 'Required';
            isValid = false;
        }

        if (isMinor) {
            ['guardianName', 'guardianRelationship'].forEach((field) => {
                if (!formData[field]) {
                    nextErrors[field] = 'Required';
                    isValid = false;
                }
            });
            if (!formData.guardianContact) {
                nextErrors.guardianContact = 'Required';
                isValid = false;
            } else if (!isValidMobileNumber(formData.guardianContact)) {
                nextErrors.guardianContact = 'Invalid format';
                isValid = false;
            }
        }

        if (formData.religion === 'Other' && !formData.religionOther.trim()) {
            nextErrors.religionOther = 'Required';
            isValid = false;
        }
        if (formData.physician.specialty === 'Other' && !formData.physician.specialtyOther.trim()) {
            nextErrors.physician_specialtyOther = 'Required';
            isValid = false;
        }

        const validateAddr = (addr, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
                if (!addr[field]) {
                    nextErrors[`${prefix}_${field}`] = 'Required';
                    isValid = false;
                }
            });
        };

        validateAddr(formData.currentAddress, 'current');
        setErrors(nextErrors);
        return isValid;
    };

    const renderAddressFields = (type, title, isDisabled = false) => {
        const address = formData[type];
        const prefix = type === 'currentAddress' ? 'current' : 'permanent';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const getError = (field) => errors[`${prefix}_${field}`];
        const getErrorClass = (field) => getError(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                {title ? <h3 className={styles.sectionTitle}>{title}</h3> : null}
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={(e) => handleAddressChange(type, 'region', e.target.value)} disabled={isDisabled || isLoading}><option value="" hidden>Select Region</option>{regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={(e) => handleAddressChange(type, 'province', e.target.value)} disabled={isDisabled || !address.region || isLoading}><option value="" hidden>Select Province</option>{availableProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={(e) => handleAddressChange(type, 'city', e.target.value)} disabled={isDisabled || !address.province || isLoading}><option value="" hidden>Select City</option>{availableCities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={(e) => handleAddressChange(type, 'barangay', e.target.value)} disabled={isDisabled || !address.city || isLoading}><option value="" hidden>Select Barangay</option>{availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={(e) => handleAddressChange(type, 'street', e.target.value)} disabled={isDisabled || isLoading} maxLength={100} placeholder="e.g. Mabini St." />{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={(e) => handleAddressChange(type, 'houseNumber', e.target.value)} disabled={isDisabled || isLoading} maxLength={20} placeholder="e.g. Unit 123" />{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const payload = {
            name: {
                first: formData.firstName,
                middle: formData.middleName,
                last: formData.lastName,
            },
            registrationMode,
            existingPatientId: selectedExistingPatientId || undefined,
            email: formData.email.trim(),
            contactNumber: toMobilePayload(formData.phone),
            birthdate: formData.birthdate,
            gender: formData.gender,
            homePhone: toLandlinePayload(formData.homePhone),
            occupation: formData.occupation || undefined,
            civilStatus: formData.civilStatus || undefined,
            bloodType: formData.bloodType || undefined,
            nationality: formData.nationality || undefined,
            religion: (formData.religion === 'Other' ? formData.religionOther.trim() : formData.religion) || undefined,
            workPhone: toLandlinePayload(formData.workPhone),
            referredBy: formData.referredBy || undefined,
            reasonForConsultation: formData.reasonForConsultation || undefined,
            assignedBranch: isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || undefined) : (formData.assignedBranch || undefined),
            assignedBranches: [isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || '') : (formData.assignedBranch || '')].filter(Boolean),
            emergencyContact: {
                name: formData.emergencyContactName || undefined,
                relationship: formData.emergencyContactRelationship || undefined,
                contactNumber: toMobilePayload(formData.emergencyContactPhone),
            },
            guardian: isMinor ? {
                name: formData.guardianName,
                relationship: formData.guardianRelationship,
                contactNumber: toMobilePayload(formData.guardianContact),
                occupation: formData.guardianOccupation || undefined,
            } : null,
            dentalHistory: {
                chiefComplaint: formData.reasonForConsultation || undefined,
                lastExamDate: formData.dentalHistory.lastExamDate || undefined,
                hadTreatmentReaction: selectToBool(formData.dentalHistory.hadTreatmentReaction),
                reactionDetails: formData.dentalHistory.reactionDetails || undefined,
                hasConfidentialInfo: selectToBool(formData.dentalHistory.hasConfidentialInfo),
            },
            medicalHistory: {
                inGoodHealth: selectToBool(formData.medicalHistory.inGoodHealth),
                underMedicalTreatment: selectToBool(formData.medicalHistory.underMedicalTreatment),
                medicalTreatmentDetails: formData.medicalHistory.medicalTreatmentDetails || undefined,
                hadSeriousIllnessOrSurgery: selectToBool(formData.medicalHistory.hadSeriousIllnessOrSurgery),
                seriousIllnessOrSurgeryDetails: formData.medicalHistory.seriousIllnessOrSurgeryDetails || undefined,
                hadHospitalization: selectToBool(formData.medicalHistory.hadHospitalization),
                hospitalizationDetails: formData.medicalHistory.hospitalizationDetails || undefined,
                isTakingMedication: selectToBool(formData.medicalHistory.isTakingMedication),
                medications: formData.medicalHistory.medications ? formData.medicalHistory.medications.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
                usesTobacco: selectToBool(formData.medicalHistory.usesTobacco),
                usesAlcoholOrDrugs: selectToBool(formData.medicalHistory.usesAlcoholOrDrugs),
                hasAllergies: selectToBool(formData.medicalHistory.hasAllergies),
                allergies: [...formData.medicalHistory.allergies, ...(formData.medicalHistory.allergyOther ? [formData.medicalHistory.allergyOther.trim()] : [])].filter(Boolean),
                conditions: [...formData.medicalHistory.conditions, ...(formData.medicalHistory.conditionOther ? [formData.medicalHistory.conditionOther.trim()] : [])].filter(Boolean),
                notes: formData.medicalHistory.notes || undefined,
                bleedingTime: formData.medicalHistory.bleedingTime || undefined,
                bloodPressure: formData.medicalHistory.bloodPressure || undefined,
                isPregnant: selectToBool(formData.medicalHistory.isPregnant),
                isNursing: selectToBool(formData.medicalHistory.isNursing),
                takingBirthControl: selectToBool(formData.medicalHistory.takingBirthControl),
            },
            physician: {
                name: formData.physician.name || undefined,
                specialty: (formData.physician.specialty === 'Other' ? formData.physician.specialtyOther.trim() : formData.physician.specialty) || undefined,
                officeAddress: formData.physician.officeAddress || undefined,
                officeNumber: toLandlinePayload(formData.physician.officeNumber),
            },
            consentAcknowledgement: {
                acknowledged: Boolean(formData.consentAcknowledgement.acknowledged),
                signerName: formData.consentAcknowledgement.signerName.trim() || undefined,
                signerRole: formData.consentAcknowledgement.signerRole || (isMinor ? 'Parent/Guardian' : 'Patient'),
                signedAt: formData.consentAcknowledgement.signedAt || new Date().toISOString(),
                version: 'Dentime Patient Form v6.1',
            },
            dataPrivacyConsent: {
                acknowledged: Boolean(formData.dataPrivacyConsent.acknowledged),
                signerName: formData.dataPrivacyConsent.signerName.trim() || undefined,
                signerRole: formData.dataPrivacyConsent.signerRole || (isMinor ? 'Parent/Guardian' : 'Patient'),
                signedAt: formData.dataPrivacyConsent.signedAt || new Date().toISOString(),
                version: 'Data Privacy Act of 2012',
            },
            currentAddress: { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: { country: 'Philippines', ...formData.currentAddress },
        };
        setIsLoading(true);

        try {
            if (!isLinkMode) {
                const duplicateResponse = await authFetch('/patients/duplicate-check', {
                    method: 'POST',
                    body: JSON.stringify({
                        firstName: formData.firstName.trim(),
                        lastName: formData.lastName.trim(),
                        birthdate: formData.birthdate,
                        email: formData.email.trim(),
                        contactNumber: payload.contactNumber,
                    }),
                });
                const duplicateData = await duplicateResponse.json().catch(() => ({}));
                if (duplicateResponse.ok && duplicateData?.hasAnyMatch) {
                    setDuplicateSummary(duplicateData);
                    if (duplicateData.hasStrongMatch) {
                        setErrors((prev) => ({ ...prev, duplicateCheck: 'Possible existing patient found. Review the duplicate warning before creating a new record.' }));
                        setIsLoading(false);
                        return;
                    }
                    if (!softDuplicateConfirmed) {
                        setErrors((prev) => ({
                            ...prev,
                            duplicateCheck: duplicateData.exactPhoneMatchCount > 1
                                ? 'This mobile number is already used by multiple patient records. Review the duplicate list below before creating a new patient from this guest appointment.'
                                : 'This mobile number already appears on an existing patient record. Review the duplicate list below before creating a new patient from this guest appointment.',
                        }));
                        setIsLoading(false);
                        return;
                    }
                }
            }

            const response = await authFetch(`/admin/appointments/${appointment.id}/register-guest`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok) {
                setRegisteredPatient(data.patient || null);
                setSuccessMessage(data.message || 'Guest appointment registered successfully.');
                setShowSuccessModal(true);
            } else if ([404, 409].includes(response.status)) {
                if (data.duplicateSummary) setDuplicateSummary(data.duplicateSummary);
                setErrors((prev) => ({
                    ...prev,
                    [data.field || (isLinkMode ? 'email' : 'duplicateCheck')]: data.message || 'Email already exists.',
                }));
            } else {
                alert(data.message || 'Failed to register guest patient.');
            }
        } catch (error) {
            console.error(error);
            alert('Cannot connect to server.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess?.(registeredPatient);
        onClose?.();
    };

    const handleOpenPatientRecord = () => {
        if (!patientRecordPath) {
            handleSuccessClose();
            return;
        }
        setShowSuccessModal(false);
        onSuccess?.(registeredPatient);
        onClose?.();
        navigate(patientRecordPath);
    };

    const duplicateSections = getPatientDuplicateSections(duplicateSummary);

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isLoading && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isLoading}>
                        <img src={BackIcon} alt="Back" />
                    </button>
                    <div className={styles.header}>
                        <h2>Register <span className={styles.highlight}>Guest Patient</span></h2>
                        <p>Complete the missing details to convert this guest appointment into a patient account.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    {duplicateSections.length > 0 && !isLinkMode && (
                        <div style={{ marginBottom: '18px', padding: '16px 18px', borderRadius: '16px', border: '1px solid #f8d7a8', background: '#fff8e8' }}>
                            <strong style={{ display: 'block', color: '#8a5b00', marginBottom: '6px' }}>
                                {duplicateSummary?.hasStrongMatch ? 'Possible existing patient found' : 'Possible duplicate details found'}
                            </strong>
                            <span style={{ display: 'block', color: '#7a5b20', fontSize: '13px', lineHeight: '1.5' }}>
                                Review the existing patient matches below before creating a new patient account from this guest booking.
                            </span>
                            {errors.duplicateCheck && <span className={styles.errorText}>{errors.duplicateCheck}</span>}
                            {hasSoftDuplicateWarning && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSoftDuplicateConfirmed(true);
                                            setErrors((prev) => {
                                                const next = { ...prev };
                                                delete next.duplicateCheck;
                                                return next;
                                            });
                                        }}
                                        style={{
                                            border: '1px solid #0f766e',
                                            background: softDuplicateConfirmed ? '#0f766e' : '#ecfdf5',
                                            color: softDuplicateConfirmed ? '#fff' : '#0f766e',
                                            borderRadius: '999px',
                                            padding: '10px 16px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {softDuplicateConfirmed ? 'Ready to Create New Patient' : 'Continue Creating New Patient'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRegistrationMode('link-existing')}
                                        style={{
                                            border: '1px solid #b45309',
                                            background: '#fff7ed',
                                            color: '#9a3412',
                                            borderRadius: '999px',
                                            padding: '10px 16px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Review Existing Patient Accounts
                                    </button>
                                </div>
                            )}
                            {softDuplicateConfirmed && hasSoftDuplicateWarning && (
                                <span style={{ display: 'block', color: '#166534', fontSize: '13px', marginTop: '10px' }}>
                                    Duplicate review noted. If this guest is really a different person who shares the same mobile number, submit again to create the new patient account.
                                </span>
                            )}
                            {duplicateCandidatePatients.length > 0 && (
                                <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                                    {duplicateCandidatePatients.slice(0, 4).map((patient) => (
                                        <div
                                            key={patient.id}
                                            style={{
                                                border: '1px solid #f2c27b',
                                                borderRadius: '14px',
                                                padding: '12px 14px',
                                                background: '#fffdfa',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <div style={{ display: 'grid', gap: '4px', minWidth: '220px' }}>
                                                <strong style={{ color: '#7c4a03' }}>{patient.name || 'Existing Patient'}</strong>
                                                <span style={{ color: '#6b4f1d', fontSize: '13px' }}>{formatPatientDuplicateLine(patient)}</span>
                                                {patient.matchLabels?.length > 0 && (
                                                    <span style={{ color: '#8a5b00', fontSize: '12px', fontWeight: 700 }}>
                                                        Matches: {patient.matchLabels.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectExistingPatient(patient)}
                                                style={{
                                                    border: '1px solid #01538b',
                                                    background: '#eff6ff',
                                                    color: '#01538b',
                                                    borderRadius: '999px',
                                                    padding: '10px 16px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Link This Patient
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {duplicateSections.map((section) => (
                                <div key={section.key} style={{ marginTop: '10px' }}>
                                    <div style={{ color: '#6b4f1d', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{section.label}</div>
                                    <ul style={{ margin: '6px 0 0 18px', padding: 0, color: '#5c4520' }}>
                                        {section.items.slice(0, 3).map((patient) => (
                                            <li key={`${section.key}-${patient.id}`} style={{ marginBottom: '4px' }}>
                                                {formatPatientDuplicateLine(patient)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.addressSection}>
                        <h3 className={styles.mainSectionTitle}>Conversion Flow</h3>
                        <p className={styles.sectionSubtitle}>
                            Choose whether this appointment should link to an existing patient account or create a new patient account.
                        </p>
                        <div className={styles.radioGroup}>
                            <button
                                type="button"
                                className={`${styles.radioOption} ${!isLinkMode ? styles.radioOptionActive : ''}`}
                                onClick={() => {
                                    setRegistrationMode('create-new');
                                    setSelectedExistingPatientId('');
                                    setErrors({});
                                }}
                                disabled={isLoading}
                            >
                                Create New Patient
                            </button>
                            <button
                                type="button"
                                className={`${styles.radioOption} ${isLinkMode ? styles.radioOptionActive : ''}`}
                                onClick={() => {
                                    setRegistrationMode('link-existing');
                                    setErrors({});
                                }}
                                disabled={isLoading}
                            >
                                Link Existing Patient
                            </button>
                        </div>
                        <p className={styles.sectionSubtitle} style={{ marginTop: '12px', marginBottom: 0 }}>
                            {isLinkMode
                                ? 'Only the matching patient identity fields are required. If the email is not already a patient account, no new account will be created.'
                                : 'Create a full patient account from this guest appointment. Pre-registered details stay prefilled so staff only needs to review and complete the missing fields.'}
                        </p>
                        {isLinkMode && selectedExistingPatient && (
                            <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '14px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                <strong style={{ display: 'block', color: '#1d4ed8', marginBottom: '4px' }}>Selected Existing Patient</strong>
                                <span style={{ color: '#1e3a8a', fontSize: '13px' }}>{formatPatientDuplicateLine(selectedExistingPatient)}</span>
                            </div>
                        )}
                        {isLinkMode && errors.existingPatientId && (
                            <span className={styles.errorText} style={{ display: 'block', marginTop: '10px' }}>
                                {errors.existingPatientId}
                            </span>
                        )}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Patient Details</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BIRTHDATE <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isLoading} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                        <div className={styles.formGroup}><label>GENDER {!isLinkMode && <span style={{ color: 'red' }}>*</span>}</label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isLoading}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} disabled={isLoading} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                        <div className={styles.formGroup}>
                            <label>MOBILE {!isLinkMode && <span style={{ color: 'red' }}>*</span>}</label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange('phone')} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {!isLinkMode && (
                        <>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>OCCUPATION</label><input className={styles.inputField} name="occupation" value={formData.occupation} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>CIVIL STATUS</label><select className={styles.inputField} name="civilStatus" value={formData.civilStatus} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option><option value="Divorced">Divorced</option></select></div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BLOOD TYPE</label><select className={styles.inputField} name="bloodType" value={formData.bloodType} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Blood Type</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>
                        <div className={styles.formGroup} />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>HOME PHONE</label>
                            <div className={`${styles.phoneInputGroup} ${errors.homePhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                <input className={styles.phoneField} name="homePhone" value={formData.homePhone} onChange={handleLandlineChange('homePhone')} onBlur={handleBlur} maxLength={8} placeholder="1234567" disabled={isLoading} />
                            </div>
                            {errors.homePhone && <span className={styles.errorText}>{errors.homePhone}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>WORK PHONE</label>
                            <div className={`${styles.phoneInputGroup} ${errors.workPhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                <input className={styles.phoneField} name="workPhone" value={formData.workPhone} onChange={handleLandlineChange('workPhone')} onBlur={handleBlur} maxLength={8} placeholder="1234567" disabled={isLoading} />
                            </div>
                            {errors.workPhone && <span className={styles.errorText}>{errors.workPhone}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>NATIONALITY</label><select className={styles.inputField} name="nationality" value={formData.nationality} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Nationality</option>{NATIONALITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                        <div className={styles.formGroup}><label>RELIGION</label><select className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religion" value={formData.religion} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Religion</option>{RELIGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.religionOther && <span className={styles.errorText}>{errors.religionOther}</span>}</div>
                    </div>
                    {formData.religion === 'Other' && (
                        <div className={styles.row}>
                            <div className={styles.formGroup}><label>RELIGION, IF OTHER</label><input className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religionOther" value={formData.religionOther} onChange={handlePersonalChange} disabled={isLoading} />{errors.religionOther && <span className={styles.errorText}>{errors.religionOther}</span>}</div>
                            <div className={styles.formGroup} />
                        </div>
                    )}

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>REASON FOR CONSULTATION</label><input className={styles.inputField} name="reasonForConsultation" value={formData.reasonForConsultation} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>REFERRED BY</label><input className={styles.inputField} name="referredBy" value={formData.referredBy} onChange={handlePersonalChange} disabled={isLoading} /></div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BLOOD TYPE</label>
                            <select className={styles.inputField} name="bloodType" value={formData.bloodType} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Blood Type</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select>
                        </div>
                        <div className={styles.formGroup} />
                    </div>

                    <hr className={styles.divider} style={{ marginTop: '10px' }} />
                    <h3 className={styles.mainSectionTitle}>Emergency Contact</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>CONTACT NAME</label><input className={styles.inputField} name="emergencyContactName" value={formData.emergencyContactName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>RELATIONSHIP</label><input className={styles.inputField} name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handlePersonalChange} disabled={isLoading} /></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CONTACT NUMBER</label>
                            <div className={`${styles.phoneInputGroup} ${errors.emergencyContactPhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handlePhoneChange('emergencyContactPhone')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.emergencyContactPhone && <span className={styles.errorText}>{errors.emergencyContactPhone}</span>}
                        </div>
                        <div className={styles.formGroup} />
                    </div>

                    {isMinor && (
                        <>
                            <hr className={styles.divider} style={{ marginTop: '10px' }} />
                            <h3 className={styles.mainSectionTitle}>Guardian Information</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>GUARDIAN NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.guardianName ? styles.errorBorder : ''}`} name="guardianName" value={formData.guardianName} onChange={handlePersonalChange} disabled={isLoading} />{errors.guardianName && <span className={styles.errorText}>{errors.guardianName}</span>}</div>
                                <div className={styles.formGroup}><label>RELATIONSHIP <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.guardianRelationship ? styles.errorBorder : ''}`} name="guardianRelationship" value={formData.guardianRelationship} onChange={handlePersonalChange} disabled={isLoading} />{errors.guardianRelationship && <span className={styles.errorText}>{errors.guardianRelationship}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>GUARDIAN PHONE <span style={{ color: 'red' }}>*</span></label>
                                    <div className={`${styles.phoneInputGroup} ${errors.guardianContact ? styles.errorBorder : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input className={styles.phoneField} name="guardianContact" value={formData.guardianContact} onChange={handlePhoneChange('guardianContact')} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                                    </div>
                                    {errors.guardianContact && <span className={styles.errorText}>{errors.guardianContact}</span>}
                                </div>
                                <div className={styles.formGroup}><label>GUARDIAN OCCUPATION</label><input className={styles.inputField} name="guardianOccupation" value={formData.guardianOccupation} onChange={handlePersonalChange} disabled={isLoading} /></div>
                            </div>
                        </>
                    )}

                    {!isSecretary && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            {isBranchScopedStaff ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <span className={styles.branchLockedBadge}>Branch: {user?.assignedBranch}</span>
                                    <span className={styles.branchLockedNote}>Auto-assigned to your branch</span>
                                </div>
                            ) : (
                                <div className={styles.row}>
                                    <div className={styles.formGroup}>
                                        <label>BRANCH <span style={{ color: 'red' }}>*</span></label>
                                        <select className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`} name="assignedBranch" value={formData.assignedBranch} onChange={handlePersonalChange} disabled={isLoading}>
                                            <option value="" hidden>Select a branch</option>
                                            {branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                                        </select>
                                        {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                                    </div>
                                    <div className={styles.formGroup} />
                                </div>
                            )}
                        </>
                    )}

                    <hr className={styles.divider} />
                    {renderAddressFields('currentAddress', 'Home Address')}

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Dental History</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>LAST DENTAL VISIT</label><input type="date" className={styles.inputField} value={formData.dentalHistory.lastExamDate} onChange={(e) => handleNestedChange('dentalHistory', 'lastExamDate', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>REACTION OR COMPLICATION AFTER DENTAL TREATMENT?</label><select className={styles.inputField} value={formData.dentalHistory.hadTreatmentReaction} onChange={(e) => handleNestedChange('dentalHistory', 'hadTreatmentReaction', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>IF YES, PLEASE DETAIL</label><textarea className={styles.textArea} value={formData.dentalHistory.reactionDetails} onChange={(e) => handleNestedChange('dentalHistory', 'reactionDetails', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>DO YOU HAVE ANY PRIVATE OR CONFIDENTIAL INFORMATION YOU WISH TO DISCUSS IN PRIVATE AND NOT WRITE DOWN?</label><select className={styles.inputField} value={formData.dentalHistory.hasConfidentialInfo} onChange={(e) => handleNestedChange('dentalHistory', 'hasConfidentialInfo', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Medical History</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>IN GOOD HEALTH?</label><select className={styles.inputField} value={formData.medicalHistory.inGoodHealth} onChange={(e) => handleNestedChange('medicalHistory', 'inGoodHealth', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                        <div className={styles.formGroup}><label>UNDER MEDICAL TREATMENT NOW?</label><select className={styles.inputField} value={formData.medicalHistory.underMedicalTreatment} onChange={(e) => handleNestedChange('medicalHistory', 'underMedicalTreatment', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>CONDITION TREATED</label><textarea className={styles.textArea} value={formData.medicalHistory.medicalTreatmentDetails} onChange={(e) => handleNestedChange('medicalHistory', 'medicalTreatmentDetails', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>SERIOUS ILLNESS OR SURGICAL OPERATION?</label><select className={styles.inputField} value={formData.medicalHistory.hadSeriousIllnessOrSurgery} onChange={(e) => handleNestedChange('medicalHistory', 'hadSeriousIllnessOrSurgery', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>ILLNESS OR OPERATION DETAILS</label><textarea className={styles.textArea} value={formData.medicalHistory.seriousIllnessOrSurgeryDetails} onChange={(e) => handleNestedChange('medicalHistory', 'seriousIllnessOrSurgeryDetails', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>EVER BEEN HOSPITALIZED?</label><select className={styles.inputField} value={formData.medicalHistory.hadHospitalization} onChange={(e) => handleNestedChange('medicalHistory', 'hadHospitalization', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>HOSPITALIZATION DETAILS</label><textarea className={styles.textArea} value={formData.medicalHistory.hospitalizationDetails} onChange={(e) => handleNestedChange('medicalHistory', 'hospitalizationDetails', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>TAKING PRESCRIPTION / NON-PRESCRIPTION MEDICATION?</label><select className={styles.inputField} value={formData.medicalHistory.isTakingMedication} onChange={(e) => handleNestedChange('medicalHistory', 'isTakingMedication', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>MEDICATIONS</label><textarea className={styles.textArea} value={formData.medicalHistory.medications} onChange={(e) => handleNestedChange('medicalHistory', 'medications', e.target.value)} placeholder="Comma-separated values" rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>USES TOBACCO PRODUCTS?</label><select className={styles.inputField} value={formData.medicalHistory.usesTobacco} onChange={(e) => handleNestedChange('medicalHistory', 'usesTobacco', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>USES ALCOHOL / COCAINE / DANGEROUS DRUGS?</label><select className={styles.inputField} value={formData.medicalHistory.usesAlcoholOrDrugs} onChange={(e) => handleNestedChange('medicalHistory', 'usesAlcoholOrDrugs', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                        <div className={styles.formGroup}><label>HAS ALLERGIES?</label><select className={styles.inputField} value={formData.medicalHistory.hasAllergies} onChange={(e) => handleNestedChange('medicalHistory', 'hasAllergies', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>ALLERGIES</label>
                            <div className={styles.checkboxGrid}>
                                {ALLERGY_OPTIONS.map((option) => (
                                    <label key={option} className={styles.checkboxOption}>
                                        <input type="checkbox" checked={formData.medicalHistory.allergies.includes(option)} onChange={() => handleNestedArrayToggle('medicalHistory', 'allergies', option)} disabled={isLoading} />
                                        <span>{option}</span>
                                    </label>
                                ))}
                            </div>
                            <input className={styles.inputField} style={{ marginTop: '12px' }} value={formData.medicalHistory.allergyOther} onChange={(e) => handleNestedChange('medicalHistory', 'allergyOther', e.target.value)} placeholder="Other allergy" disabled={isLoading} />
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BLEEDING TIME</label><input className={styles.inputField} value={formData.medicalHistory.bleedingTime} onChange={(e) => handleNestedChange('medicalHistory', 'bleedingTime', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>BLOOD PRESSURE</label><input className={styles.inputField} value={formData.medicalHistory.bloodPressure} onChange={(e) => handleNestedChange('medicalHistory', 'bloodPressure', e.target.value)} placeholder="e.g. 120/80" disabled={isLoading} /></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>PREGNANT?</label><select className={styles.inputField} value={formData.medicalHistory.isPregnant} onChange={(e) => handleNestedChange('medicalHistory', 'isPregnant', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                        <div className={styles.formGroup}><label>NURSING?</label><select className={styles.inputField} value={formData.medicalHistory.isNursing} onChange={(e) => handleNestedChange('medicalHistory', 'isNursing', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>TAKING BIRTH CONTROL PILLS?</label><select className={styles.inputField} value={formData.medicalHistory.takingBirthControl} onChange={(e) => handleNestedChange('medicalHistory', 'takingBirthControl', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>MEDICAL CONDITIONS</label>
                            <div className={styles.checkboxGrid}>
                                {MEDICAL_CONDITION_OPTIONS.map((option) => (
                                    <label key={option} className={styles.checkboxOption}>
                                        <input type="checkbox" checked={formData.medicalHistory.conditions.includes(option)} onChange={() => handleNestedArrayToggle('medicalHistory', 'conditions', option)} disabled={isLoading} />
                                        <span>{option}</span>
                                    </label>
                                ))}
                            </div>
                            <input className={styles.inputField} style={{ marginTop: '12px' }} value={formData.medicalHistory.conditionOther} onChange={(e) => handleNestedChange('medicalHistory', 'conditionOther', e.target.value)} placeholder="Other condition" disabled={isLoading} />
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>MEDICAL NOTES</label><textarea className={styles.textArea} value={formData.medicalHistory.notes} onChange={(e) => handleNestedChange('medicalHistory', 'notes', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup} />
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Attending Physician</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>PHYSICIAN NAME</label><input className={styles.inputField} value={formData.physician.name} onChange={(e) => handleNestedChange('physician', 'name', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>SPECIALTY, IF APPLICABLE</label><select className={styles.inputField} value={formData.physician.specialty} onChange={(e) => handleNestedChange('physician', 'specialty', e.target.value)} disabled={isLoading}><option value="">Select Specialty</option>{PHYSICIAN_SPECIALTY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                    </div>
                    {formData.physician.specialty === 'Other' && (
                        <div className={styles.row}>
                            <div className={styles.formGroup}><label>SPECIALTY, IF OTHER</label><input className={`${styles.inputField} ${errors.physician_specialtyOther ? styles.errorBorder : ''}`} value={formData.physician.specialtyOther} onChange={(e) => handleNestedChange('physician', 'specialtyOther', e.target.value)} disabled={isLoading} />{errors.physician_specialtyOther && <span className={styles.errorText}>{errors.physician_specialtyOther}</span>}</div>
                            <div className={styles.formGroup} />
                        </div>
                    )}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>OFFICE ADDRESS</label><input className={styles.inputField} value={formData.physician.officeAddress} onChange={(e) => handleNestedChange('physician', 'officeAddress', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>OFFICE NUMBER</label><div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span><input className={styles.phoneField} value={formData.physician.officeNumber} onChange={handleNestedLandlineChange('physician', 'officeNumber')} maxLength={8} placeholder="1234567" disabled={isLoading} /></div>{errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}</div>
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Data Privacy Act</h3>
                    <div className={styles.addressSection}>
                        <p style={{ margin: '0 0 16px 0', color: '#475569', lineHeight: 1.6, fontSize: '14px' }}>
                            I authorize Dentime to collect, store, and process the patient&apos;s personal and health information for appointment handling, treatment documentation, follow-up care, and clinic operations in compliance with the Data Privacy Act of 2012.
                        </p>
                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>PRIVACY SIGNER NAME <span style={{ color: 'red' }}>*</span></label>
                                <input className={`${styles.inputField} ${errors.dataPrivacyConsent_signerName ? styles.errorBorder : ''}`} value={formData.dataPrivacyConsent.signerName} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signerName', e.target.value)} disabled={isLoading} />
                                {errors.dataPrivacyConsent_signerName && <span className={styles.errorText}>{errors.dataPrivacyConsent_signerName}</span>}
                            </div>
                            <div className={styles.formGroup}>
                                <label>PRIVACY SIGNER ROLE</label>
                                <select className={styles.inputField} value={formData.dataPrivacyConsent.signerRole} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signerRole', e.target.value)} disabled={isLoading}>
                                    <option value="Patient">Patient</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>DATE SIGNED</label>
                                <input type="date" className={styles.inputField} value={formData.dataPrivacyConsent.signedAt} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isLoading} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => handlePrivacyAcknowledged(!formData.dataPrivacyConsent.acknowledged)}
                                disabled={isLoading}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: '#01538b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {formData.dataPrivacyConsent.acknowledged ? 'Undo privacy acknowledgement' : 'Acknowledge data privacy consent'}
                            </button>
                            <span style={{ fontSize: '14px', color: formData.dataPrivacyConsent.acknowledged ? '#166534' : '#64748b', fontWeight: 600 }}>
                                {formData.dataPrivacyConsent.acknowledged ? 'Data privacy consent acknowledged.' : 'Data privacy consent has not been acknowledged yet.'}
                            </span>
                        </div>
                        {errors.dataPrivacyConsent_acknowledged && <span className={styles.errorText}>{errors.dataPrivacyConsent_acknowledged}</span>}
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Digital Consent</h3>
                    <div className={styles.addressSection}>
                        <p style={{ margin: '0 0 16px 0', color: '#475569', lineHeight: 1.6, fontSize: '14px' }}>
                            I confirm that the patient or authorized representative has reviewed the intake information, understands that treatment outcomes cannot be guaranteed, and accepts responsibility for the patient&apos;s dental treatment charges.
                        </p>
                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>SIGNER NAME <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    className={`${styles.inputField} ${errors.consentAcknowledgement_signerName ? styles.errorBorder : ''}`}
                                    value={formData.consentAcknowledgement.signerName}
                                    onChange={(e) => handleNestedChange('consentAcknowledgement', 'signerName', e.target.value)}
                                    disabled={isLoading}
                                />
                                {errors.consentAcknowledgement_signerName && <span className={styles.errorText}>{errors.consentAcknowledgement_signerName}</span>}
                            </div>
                            <div className={styles.formGroup}>
                                <label>SIGNER ROLE</label>
                                <select className={styles.inputField} value={formData.consentAcknowledgement.signerRole} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signerRole', e.target.value)} disabled={isLoading}>
                                    <option value="Patient">Patient</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>DATE SIGNED</label>
                                <input type="date" className={styles.inputField} value={formData.consentAcknowledgement.signedAt} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isLoading} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setIsConsentModalOpen(true)}
                                disabled={isLoading}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: '#01538b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                View full consent form
                            </button>
                            <span style={{ fontSize: '14px', color: formData.consentAcknowledgement.acknowledged ? '#166534' : '#64748b', fontWeight: 600 }}>
                                {formData.consentAcknowledgement.acknowledged ? 'Consent reviewed and acknowledged.' : 'Consent has not been acknowledged yet.'}
                            </span>
                        </div>
                        {errors.consentAcknowledgement_acknowledged && <span className={styles.errorText}>{errors.consentAcknowledgement_acknowledged}</span>}
                    </div>
                        </>
                    )}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading
                                ? (isLinkMode ? 'LINKING...' : 'REGISTERING...')
                                : (isLinkMode ? 'LINK PATIENT' : 'REGISTER PATIENT')}
                        </button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>{successMessage}</p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {patientRecordPath && (
                                <button className={styles.modalButton} onClick={handleOpenPatientRecord}>OPEN PATIENT RECORD</button>
                            )}
                            <button
                                className={styles.modalButton}
                                onClick={handleSuccessClose}
                                style={patientRecordPath ? { background: '#e2e8f0', color: '#1e293b', boxShadow: 'none' } : undefined}
                            >
                                DONE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConsentReviewModal
                isOpen={isConsentModalOpen}
                onClose={() => setIsConsentModalOpen(false)}
                onConfirm={handleConsentAcknowledged}
                initiallyAcknowledged={formData.consentAcknowledgement.acknowledged}
            />
        </div>
    );
}
