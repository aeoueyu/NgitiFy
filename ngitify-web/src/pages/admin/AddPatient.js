import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/AddPatient.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import ConsentReviewModal from '../../components/admin/ConsentReviewModal';
import {
    PatientRegistrationSectionCard,
    PatientRegistrationStepper,
} from '../../components/patient/PatientRegistrationFlow';
import { privacyPolicySections, privacyPolicyUpdatedAt, privacyPolicyVersion } from '../../data/consentDocument';
import {
    formatPatientDuplicateLine,
    getPatientDuplicateCandidates,
    getPatientDuplicateSections,
} from '../../utils/patientDuplicateWarnings';
import { PROFILE_IMAGE_SIZE_ERROR, readProfileImageAsDataUrl, isProfileImageTooLarge } from '../../utils/profileImageUpload';
import {
    ALLERGY_OPTIONS,
    ALLERGY_SELECTION_REQUIRED_MESSAGE,
    BIRTHDATE_FUTURE_MESSAGE,
    BLOOD_TYPE_OPTIONS,
    DUPLICATE_EMAIL_MESSAGE,
    INVALID_EMAIL_ADDRESS_MESSAGE,
    INVALID_LANDLINE_FORMAT_MESSAGE,
    INVALID_MOBILE_FORMAT_MESSAGE,
    INVALID_SIGNED_DATE_MESSAGE,
    MEDICAL_CONDITION_OPTIONS,
    NATIONALITY_OPTIONS,
    OCCUPATION_OPTIONS,
    RELIGION_OPTIONS,
    REQUIRED_MESSAGE,
    REQUIRED_WHEN_YES_MESSAGE,
    LAST_DENTAL_VISIT_FUTURE_MESSAGE,
    PHYSICIAN_SPECIALTY_OPTIONS,
    RELATIONSHIP_OPTIONS,
    LANDLINE_PREFIX,
    isAllowedPersonNameInput,
    isValidLandlineNumber,
    isValidMobileNumber,
    toTitleCaseName,
    toLandlinePayload,
    toMobilePayload,
} from '../../utils/patientIntake';
import {
    getTodayDateInManila,
    isFutureDateInManila,
} from '../../utils/dateUtils';
import useRealtimeSystemEmailValidation from '../../hooks/useRealtimeSystemEmailValidation';

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

const getTodayDate = () => getTodayDateInManila();

const INTAKE_STEPS = [
    {
        key: 'identity',
        label: 'Identity',
        description: 'Core patient details, address, and contact identity fields.',
    },
    {
        key: 'contacts',
        label: 'Contacts & Branch',
        description: 'Emergency details, guardian information, and registration branch.',
    },
    {
        key: 'medical',
        label: 'Medical & Dental',
        description: 'Dental history, physician details, and medical questionnaire.',
    },
    {
        key: 'consent',
        label: 'Consent & Review',
        description: 'Final consent review before creating the patient account.',
    },
];

const INTAKE_SECTION_FIELDS = {
    0: [
        'firstName',
        'lastName',
        'birthdate',
        'gender',
        'email',
        'phone',
        'homePhone',
        'workPhone',
        'religionOther',
        'occupationOther',
        'home_region',
        'home_province',
        'home_city',
        'home_barangay',
        'home_street',
        'home_houseNumber',
    ],
    1: [
        'emergencyContactName',
        'emergencyContactRelationship',
        'emergencyContactPhone',
        'guardianName',
        'guardianRelationship',
        'guardianOccupation',
        'guardianOccupationOther',
        'guardianContact',
        'assignedBranch',
    ],
    2: [
        'bloodType',
        'dentalHistory_lastExamDate',
        'dentalHistory_hadTreatmentReaction',
        'dentalHistory_reactionDetails',
        'dentalHistory_hasConfidentialInfo',
        'medicalHistory_inGoodHealth',
        'medicalHistory_underMedicalTreatment',
        'medicalHistory_medicalTreatmentDetails',
        'medicalHistory_hadSeriousIllnessOrSurgery',
        'medicalHistory_seriousIllnessOrSurgeryDetails',
        'medicalHistory_hadHospitalization',
        'medicalHistory_hospitalizationDetails',
        'medicalHistory_isTakingMedication',
        'medicalHistory_medications',
        'medicalHistory_usesTobacco',
        'medicalHistory_usesAlcoholOrDrugs',
        'medicalHistory_hasAllergies',
        'medicalHistory_allergies',
        'medicalHistory_isPregnant',
        'medicalHistory_isNursing',
        'medicalHistory_takingBirthControl',
        'physician_specialtyOther',
        'physician_officeNumber',
    ],
    3: [
        'dataPrivacyConsent_signerName',
        'dataPrivacyConsent_signedAt',
        'dataPrivacyConsent_acknowledged',
        'consentAcknowledgement_signerName',
        'consentAcknowledgement_signedAt',
        'consentAcknowledgement_acknowledged',
    ],
};
const dataPrivacyReviewGroups = [
    { heading: `Data Privacy Notice ${privacyPolicyVersion} - Updated ${privacyPolicyUpdatedAt}`, sections: privacyPolicySections },
];

const NON_VALIDATION_ERROR_KEYS = ['profileImage', 'duplicateCheck'];

export default function AddPatient({ onClose, onSuccess }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isBranchScopedStaff = user?.role === 'branch-manager' || user?.role === 'secretary';
    const isSecretary = user?.role === 'secretary';

    const fileInputRef = useRef(null);
    const [profileImage, setProfileImage] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [errors, setErrors] = useState({});
    const [duplicateSummary, setDuplicateSummary] = useState(null);
    const [softDuplicateConfirmed, setSoftDuplicateConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);

    const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', gender: '',
        email: '', phone: '',
        homePhone: '', occupation: '', occupationOther: '', civilStatus: '', bloodType: '',
        nationality: 'Filipino', religion: '', religionOther: '',
        workPhone: '', referredBy: '',
        reasonForConsultation: '',
        emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
        guardianName: '', guardianRelationship: '', guardianContact: '', guardianOccupation: '', guardianOccupationOther: '',
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
        dataPrivacyConsent: {
            acknowledged: false,
            signerName: '',
            signerRole: 'Patient',
            signedAt: getTodayDate(),
        },
        homeAddress: { ...initialAddressState },
    });

    useRealtimeSystemEmailValidation({
        email: formData.email,
        enabled: !isLoading,
        setErrors,
    });

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
    };

    const getAge = (d) => { const today = new Date(); const birth = new Date(d); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--; return age; };
    const getMaxDate = () => getTodayDate();
    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;
    const duplicateSections = getPatientDuplicateSections(duplicateSummary);
    const duplicateCandidatePatients = getPatientDuplicateCandidates(duplicateSummary);

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = '';
        if (name === 'email') { if (!value) newError = REQUIRED_MESSAGE; else if (!validateEmail(value)) newError = INVALID_EMAIL_ADDRESS_MESSAGE; }
        else if (name === 'phone' || name === 'guardianContact') { if (!value) newError = REQUIRED_MESSAGE; else if (!isValidMobileNumber(value)) newError = INVALID_MOBILE_FORMAT_MESSAGE; }
        setErrors(prev => ({ ...prev, [name]: newError }));
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (isProfileImageTooLarge(file)) {
            setErrors(prev => ({ ...prev, profileImage: PROFILE_IMAGE_SIZE_ERROR }));
            e.target.value = '';
            return;
        }
        try {
            setErrors(prev => { const n = { ...prev }; delete n.profileImage; return n; });
            setProfileImage(await readProfileImageAsDataUrl(file));
        } catch {
            setErrors(prev => ({ ...prev, profileImage: 'Failed to read the selected image.' }));
        }
    };
    const triggerFileInput = () => fileInputRef.current.click();

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        if ((name === 'occupation' || name === 'guardianOccupation') && value !== 'Other') {
            setErrors(prev => {
                const next = { ...prev };
                delete next[`${name}Other`];
                return next;
            });
        }
        if (['firstName', 'middleName', 'lastName', 'guardianName', 'emergencyContactName'].includes(name)) {
            if (isAllowedPersonNameInput(value)) setFormData({ ...formData, [name]: toTitleCaseName(value) });
            return;
        }
        setFormData((prev) => ({
            ...prev,
            [name]: value,
            ...(name === 'occupation' && value !== 'Other' ? { occupationOther: '' } : {}),
            ...(name === 'guardianOccupation' && value !== 'Other' ? { guardianOccupationOther: '' } : {}),
        }));
    };

    const handlePhoneChange = (fieldName = 'phone') => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (errors[fieldName]) setErrors(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
        setFormData({ ...formData, [fieldName]: value });
    };

    const handleLandlineChange = (fieldName) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        if (errors[fieldName]) setErrors(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
        setFormData({ ...formData, [fieldName]: value });
    };

    const handleGuardianContactChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (errors.guardianContact) setErrors(prev => { const n = { ...prev }; delete n.guardianContact; return n; });
        setFormData({ ...formData, guardianContact: value });
    };

    const handleNestedChange = (section, field, value, formatter) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: formatter ? formatter(value) : value
            }
        }));
    };

    const handleNestedNameChange = (section, field) => (e) => {
        const value = e.target.value;
        if (!isAllowedPersonNameInput(value)) return;
        handleNestedChange(section, field, toTitleCaseName(value));
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

    const handleNestedPhoneChange = (section, field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        const errorKey = `${section}_${field}`;
        if (errors[errorKey]) setErrors(prev => { const n = { ...prev }; delete n[errorKey]; return n; });
        handleNestedChange(section, field, value);
    };

    const handleNestedArrayToggle = (section, field, item) => {
        setFormData(prev => {
            const currentValues = prev[section][field] || [];
            const exists = currentValues.includes(item);
            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: exists ? currentValues.filter(value => value !== item) : [...currentValues, item]
                }
            };
        });
    };

    const handleAddressChange = (field, value) => {
        const errorKey = `home_${field}`;
        if (errors[errorKey]) setErrors(prev => { const n = { ...prev }; delete n[errorKey]; return n; });
        setFormData(prev => {
            const updated = { ...prev.homeAddress, [field]: value };
            if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city') { updated.barangay = ''; }
            return { ...prev, homeAddress: updated };
        });
    };

    const getValidationErrors = (currentFormData = formData) => {
        let newErrors = {}; let isValid = true;
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        const requiredYesNoFields = [
            ['dentalHistory', 'hadTreatmentReaction'],
            ['dentalHistory', 'hasConfidentialInfo'],
            ['medicalHistory', 'inGoodHealth'],
            ['medicalHistory', 'underMedicalTreatment'],
            ['medicalHistory', 'hadSeriousIllnessOrSurgery'],
            ['medicalHistory', 'hadHospitalization'],
            ['medicalHistory', 'isTakingMedication'],
            ['medicalHistory', 'usesTobacco'],
            ['medicalHistory', 'usesAlcoholOrDrugs'],
            ['medicalHistory', 'hasAllergies'],
            ['medicalHistory', 'isPregnant'],
            ['medicalHistory', 'isNursing'],
            ['medicalHistory', 'takingBirthControl'],
        ];
        const computedIsMinor = currentFormData.birthdate && getAge(currentFormData.birthdate) < 18;
        if (computedIsMinor) {
            required.push('guardianName', 'guardianRelationship', 'guardianOccupation');
            if (!currentFormData.guardianContact) { newErrors.guardianContact = REQUIRED_MESSAGE; isValid = false; }
            else if (currentFormData.guardianContact.length !== 10 || currentFormData.guardianContact[0] !== '9') { newErrors.guardianContact = INVALID_MOBILE_FORMAT_MESSAGE; isValid = false; }
        }
        required.forEach(f => { if (!currentFormData[f]) { newErrors[f] = REQUIRED_MESSAGE; isValid = false; } });
        if (!currentFormData.phone) { newErrors.phone = REQUIRED_MESSAGE; isValid = false; }
        else if (currentFormData.phone.length !== 10 || currentFormData.phone[0] !== '9') { newErrors.phone = INVALID_MOBILE_FORMAT_MESSAGE; isValid = false; }
        if (currentFormData.homePhone && !isValidLandlineNumber(currentFormData.homePhone)) { newErrors.homePhone = INVALID_LANDLINE_FORMAT_MESSAGE; isValid = false; }
        if (currentFormData.workPhone && !isValidLandlineNumber(currentFormData.workPhone)) { newErrors.workPhone = INVALID_LANDLINE_FORMAT_MESSAGE; isValid = false; }
        if (!currentFormData.emergencyContactName.trim()) { newErrors.emergencyContactName = REQUIRED_MESSAGE; isValid = false; }
        if (!currentFormData.emergencyContactRelationship.trim()) { newErrors.emergencyContactRelationship = REQUIRED_MESSAGE; isValid = false; }
        if (!currentFormData.emergencyContactPhone) { newErrors.emergencyContactPhone = REQUIRED_MESSAGE; isValid = false; }
        else if (!isValidMobileNumber(currentFormData.emergencyContactPhone)) { newErrors.emergencyContactPhone = INVALID_MOBILE_FORMAT_MESSAGE; isValid = false; }
        if (currentFormData.physician.officeNumber && !isValidLandlineNumber(currentFormData.physician.officeNumber)) { newErrors.physician_officeNumber = INVALID_LANDLINE_FORMAT_MESSAGE; isValid = false; }
        if (currentFormData.email && !validateEmail(currentFormData.email)) { newErrors.email = INVALID_EMAIL_ADDRESS_MESSAGE; isValid = false; }
        else if (errors.email) { newErrors.email = errors.email; isValid = false; }
        if (!currentFormData.consentAcknowledgement.acknowledged) { newErrors.consentAcknowledgement_acknowledged = REQUIRED_MESSAGE; isValid = false; }
        if (!currentFormData.consentAcknowledgement.signerName.trim()) { newErrors.consentAcknowledgement_signerName = REQUIRED_MESSAGE; isValid = false; }
        if (!currentFormData.dataPrivacyConsent.acknowledged) { newErrors.dataPrivacyConsent_acknowledged = REQUIRED_MESSAGE; isValid = false; }
        if (!currentFormData.dataPrivacyConsent.signerName.trim()) { newErrors.dataPrivacyConsent_signerName = REQUIRED_MESSAGE; isValid = false; }
        if (currentFormData.birthdate && isFutureDateInManila(currentFormData.birthdate)) { newErrors.birthdate = BIRTHDATE_FUTURE_MESSAGE; isValid = false; }
        if (currentFormData.dentalHistory.lastExamDate && isFutureDateInManila(currentFormData.dentalHistory.lastExamDate)) { newErrors.dentalHistory_lastExamDate = LAST_DENTAL_VISIT_FUTURE_MESSAGE; isValid = false; }
        if (currentFormData.consentAcknowledgement.signedAt && isFutureDateInManila(currentFormData.consentAcknowledgement.signedAt)) { newErrors.consentAcknowledgement_signedAt = INVALID_SIGNED_DATE_MESSAGE; isValid = false; }
        if (currentFormData.dataPrivacyConsent.signedAt && isFutureDateInManila(currentFormData.dataPrivacyConsent.signedAt)) { newErrors.dataPrivacyConsent_signedAt = INVALID_SIGNED_DATE_MESSAGE; isValid = false; }
        requiredYesNoFields.forEach(([section, field]) => {
            if (!currentFormData[section][field]) {
                newErrors[`${section}_${field}`] = REQUIRED_MESSAGE;
                isValid = false;
            }
        });
        if (currentFormData.dentalHistory.hadTreatmentReaction === 'yes' && !currentFormData.dentalHistory.reactionDetails.trim()) { newErrors.dentalHistory_reactionDetails = REQUIRED_WHEN_YES_MESSAGE; isValid = false; }
        if (currentFormData.medicalHistory.underMedicalTreatment === 'yes' && !currentFormData.medicalHistory.medicalTreatmentDetails.trim()) { newErrors.medicalHistory_medicalTreatmentDetails = REQUIRED_WHEN_YES_MESSAGE; isValid = false; }
        if (currentFormData.medicalHistory.hadSeriousIllnessOrSurgery === 'yes' && !currentFormData.medicalHistory.seriousIllnessOrSurgeryDetails.trim()) { newErrors.medicalHistory_seriousIllnessOrSurgeryDetails = REQUIRED_WHEN_YES_MESSAGE; isValid = false; }
        if (currentFormData.medicalHistory.hadHospitalization === 'yes' && !currentFormData.medicalHistory.hospitalizationDetails.trim()) { newErrors.medicalHistory_hospitalizationDetails = REQUIRED_WHEN_YES_MESSAGE; isValid = false; }
        if (currentFormData.medicalHistory.isTakingMedication === 'yes' && !currentFormData.medicalHistory.medications.trim()) { newErrors.medicalHistory_medications = REQUIRED_WHEN_YES_MESSAGE; isValid = false; }
        if (currentFormData.medicalHistory.hasAllergies === 'yes' && currentFormData.medicalHistory.allergies.length === 0 && !currentFormData.medicalHistory.allergyOther.trim()) { newErrors.medicalHistory_allergies = ALLERGY_SELECTION_REQUIRED_MESSAGE; isValid = false; }
        if (currentFormData.religion === 'Other' && !currentFormData.religionOther.trim()) { newErrors.religionOther = REQUIRED_MESSAGE; isValid = false; }
        if (currentFormData.occupation === 'Other' && !currentFormData.occupationOther.trim()) { newErrors.occupationOther = REQUIRED_MESSAGE; isValid = false; }
        if (currentFormData.guardianOccupation === 'Other' && !currentFormData.guardianOccupationOther.trim()) { newErrors.guardianOccupationOther = REQUIRED_MESSAGE; isValid = false; }
        if (currentFormData.physician.specialty === 'Other' && !currentFormData.physician.specialtyOther.trim()) { newErrors.physician_specialtyOther = REQUIRED_MESSAGE; isValid = false; }
        // Branch is required unless branch manager (auto-assigned)
        if (!isBranchScopedStaff && !currentFormData.assignedBranch) { newErrors.assignedBranch = REQUIRED_MESSAGE; isValid = false; }
        const validateAddr = (addr, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach(f => {
                if (!addr[f]) { newErrors[`${prefix}_${f}`] = REQUIRED_MESSAGE; isValid = false; }
            });
        };
        validateAddr(currentFormData.homeAddress, 'home');
        if (!isValid) {
            return newErrors;
        }
        return newErrors;
    };

    const syncFormErrors = (currentFormData = formData) => {
        const validationErrors = getValidationErrors(currentFormData);
        setErrors((prev) => {
            const preservedEntries = Object.entries(prev).filter(([key]) => NON_VALIDATION_ERROR_KEYS.includes(key));
            return {
                ...Object.fromEntries(preservedEntries),
                ...validationErrors,
            };
        });
        return validationErrors;
    };

    useEffect(() => {
        syncFormErrors(formData);
    }, [formData]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setDuplicateSummary(null);
        setSoftDuplicateConfirmed(false);
        setErrors((prev) => {
            if (!prev.duplicateCheck) return prev;
            const next = { ...prev };
            delete next.duplicateCheck;
            return next;
        });
    }, [formData.firstName, formData.lastName, formData.birthdate, formData.email, formData.phone]);

    const validateForm = () => {
        const newErrors = syncFormErrors(formData);
        const isValid = Object.keys(newErrors).length === 0;
        if (!isValid) {
            const firstErrorField = Object.keys(newErrors)[0];
            if (
                firstErrorField.startsWith('dataPrivacyConsent_')
                || firstErrorField.startsWith('consentAcknowledgement_')
            ) {
                setCurrentStep(3);
            } else if (
                firstErrorField === 'bloodType'
                || firstErrorField.startsWith('medicalHistory_')
                || firstErrorField.startsWith('dentalHistory_')
                || firstErrorField.startsWith('physician_')
            ) {
                setCurrentStep(2);
            } else if (
                firstErrorField.startsWith('emergencyContact')
                || firstErrorField.startsWith('guardian')
                || firstErrorField === 'referredBy'
                || firstErrorField === 'reasonForConsultation'
                || firstErrorField === 'assignedBranch'
            ) {
                setCurrentStep(1);
            } else {
                setCurrentStep(0);
            }

            window.setTimeout(() => {
                const el = document.getElementsByName(firstErrorField)[0];
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                }
            }, 0);
        }
        return isValid;
    };

    const focusFirstStepError = (stepIndex, stepErrors) => {
        const firstStepError = stepErrors[0];
        if (!firstStepError) return;

        window.setTimeout(() => {
            const byName = document.getElementsByName(firstStepError)[0];
            if (byName) {
                byName.scrollIntoView({ behavior: 'smooth', block: 'center' });
                byName.focus();
                return;
            }

            const fallbackField = document.querySelector('input, select, textarea');
            if (fallbackField) {
                fallbackField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 0);
    };

    const handleStepAdvance = async (targetStep = currentStep + 1) => {
        const nextErrors = getValidationErrors(formData);
        const currentStepFields = INTAKE_SECTION_FIELDS[currentStep] || [];
        const currentStepErrors = Object.keys(nextErrors).filter((key) => currentStepFields.includes(key));

        syncFormErrors(formData);

        if (currentStepErrors.length > 0) {
            focusFirstStepError(currentStep, currentStepErrors);
            return;
        }

        if (currentStep === 0 && targetStep > 0) {
            setIsLoading(true);
            try {
                const duplicateResult = await runDuplicateCheck({ enforceIdentity: true, allowSoftContinue: softDuplicateConfirmed });
                if (duplicateResult?.blocked) {
                    return;
                }
            } catch (error) {
                console.error('Error checking patient duplicates:', error);
            } finally {
                setIsLoading(false);
            }
        }

        setCurrentStep(targetStep);
    };

    const handleStepSelect = (targetStep) => {
        if (targetStep <= currentStep) {
            setCurrentStep(targetStep);
            return;
        }

        if (targetStep === currentStep + 1) {
            handleStepAdvance(targetStep);
        }
    };

    const hasFormErrors = Object.keys(getValidationErrors(formData)).length > 0;

    const getPatientRecordPath = (patientId) => {
        if (!patientId) return '';
        if (user?.role === 'administrator') return `/admin/patients/${patientId}/emr`;
        if (user?.role === 'owner') return `/owner/patients/${patientId}/emr`;
        if (user?.role === 'branch-manager') return `/branch-manager/patients/${patientId}/emr`;
        if (user?.role === 'secretary') return `/secretary/patients/${patientId}/emr`;
        if (user?.role === 'dentist') return `/dentist/patients/${patientId}/emr`;
        return '';
    };

    const openExistingPatientRecord = (patientId) => {
        const path = getPatientRecordPath(patientId);
        if (!path) return;
        onClose();
        navigate(path);
    };

    const runDuplicateCheck = async ({ enforceIdentity = false, allowSoftContinue = false } = {}) => {
        const firstName = formData.firstName.trim();
        const lastName = formData.lastName.trim();
        const birthdate = formData.birthdate;
        const email = formData.email.trim();
        const contactNumber = toMobilePayload(formData.phone);

        if (enforceIdentity && (!firstName || !lastName || !birthdate || !email || !formData.phone || !validateEmail(email) || !isValidMobileNumber(formData.phone))) {
            setErrors((prev) => ({
                ...prev,
                duplicateCheck: 'Enter first name, last name, birthdate, email, and mobile first so Dentime can check for existing patient records.',
            }));
            setCurrentStep(0);
            return { blocked: true, summary: null };
        }

        const duplicateResponse = await authFetch('/patients/duplicate-check', {
            method: 'POST',
            body: JSON.stringify({
                firstName,
                lastName,
                birthdate,
                email,
                contactNumber,
            }),
        });
        const duplicateData = await duplicateResponse.json().catch(() => ({}));

        if (!duplicateResponse.ok) {
            return { blocked: false, summary: null };
        }

        setDuplicateSummary(duplicateData?.hasAnyMatch ? duplicateData : null);

        if (duplicateData?.hasAnyMatch) {
            const nextMessage = duplicateData.hasStrongMatch
                ? 'Possible existing patient found. Review the duplicate warning before creating a new record.'
                : duplicateData.exactPhoneMatchCount > 1
                    ? 'This mobile number is already used by multiple patient records. Review the duplicate warning before creating a new patient record.'
                    : 'This mobile number already appears on an existing patient record. Review the duplicate warning before creating a new patient record.';

            if (duplicateData.hasStrongMatch || !allowSoftContinue) {
                setErrors((prev) => ({ ...prev, duplicateCheck: nextMessage }));
                setCurrentStep(0);
                return { blocked: true, summary: duplicateData };
            }
        }

        setErrors((prev) => {
            if (!prev.duplicateCheck) return prev;
            const next = { ...prev };
            delete next.duplicateCheck;
            return next;
        });

        return { blocked: false, summary: duplicateData };
    };

    const handleReviewExistingPatients = async () => {
        setCurrentStep(0);
        setIsLoading(true);
        try {
            await runDuplicateCheck({ enforceIdentity: true, allowSoftContinue: false });
        } catch (error) {
            console.error('Error checking patient duplicates:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        const finalData = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email, contactNumber: toMobilePayload(formData.phone),
            birthdate: formData.birthdate, gender: formData.gender,
            homePhone: toLandlinePayload(formData.homePhone),
            occupation: (formData.occupation === 'Other' ? formData.occupationOther.trim() : formData.occupation) || undefined,
            civilStatus: formData.civilStatus || undefined,
            bloodType: formData.bloodType || undefined,
            nationality: formData.nationality || undefined,
            religion: (formData.religion === 'Other' ? formData.religionOther.trim() : formData.religion) || undefined,
            workPhone: toLandlinePayload(formData.workPhone),
            referredBy: formData.referredBy || undefined,
            reasonForConsultation: formData.reasonForConsultation || undefined,
            profileImage: profileImage,
            assignedBranch: isBranchScopedStaff ? (user.assignedBranch || undefined) : (formData.assignedBranch || undefined),
            assignedBranches: isBranchScopedStaff ? (user.assignedBranch ? [user.assignedBranch] : []) : (formData.assignedBranch ? [formData.assignedBranch] : []),
            emergencyContact: {
                name: formData.emergencyContactName || undefined,
                relationship: formData.emergencyContactRelationship || undefined,
                contactNumber: toMobilePayload(formData.emergencyContactPhone),
            },
            guardian: isMinor ? {
                name: formData.guardianName,
                relationship: formData.guardianRelationship,
                contactNumber: toMobilePayload(formData.guardianContact),
                occupation: (formData.guardianOccupation === 'Other' ? formData.guardianOccupationOther.trim() : formData.guardianOccupation) || undefined
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
                medications: formData.medicalHistory.medications ? formData.medicalHistory.medications.split(',').map(item => item.trim()).filter(Boolean) : undefined,
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
            homeAddress: { country: 'Philippines', ...formData.homeAddress },
        };
        setIsLoading(true);
        try {
            const duplicateCheck = await runDuplicateCheck({
                enforceIdentity: false,
                allowSoftContinue: softDuplicateConfirmed,
            });
            if (duplicateCheck.blocked) return;

            const response = await authFetch('/add-patient', { method: 'POST', body: JSON.stringify(finalData) });
            const data = await response.json();
            if (response.ok) { setShowSuccessModal(true); }
            else if (response.status === 409) {
                if (data.duplicateSummary) setDuplicateSummary(data.duplicateSummary);
                const nextField = data.field || 'duplicateCheck';
                setErrors(prev => ({ ...prev, [nextField]: data.message || DUPLICATE_EMAIL_MESSAGE }));
                if (nextField === 'duplicateCheck') setCurrentStep(0);
                window.setTimeout(() => {
                    const el = document.getElementsByName(nextField)[0];
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus();
                    }
                }, 0);
            } else alert(data.message || 'Failed to add patient');
        } catch (error) { console.error(error); alert('Cannot connect to server.'); }
        finally { setIsLoading(false); }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    const renderAddressFields = (title, isDisabled = false) => {
        const address = formData.homeAddress; const prefix = 'home';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const getError = (field) => errors[`${prefix}_${field}`];
        const getErrorClass = (field) => getError(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={e => handleAddressChange('region', e.target.value)} disabled={isDisabled || isLoading}><option value="" hidden>Select Region</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={e => handleAddressChange('province', e.target.value)} disabled={isDisabled || !address.region || isLoading}><option value="" hidden>Select Province</option>{availableProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={e => handleAddressChange('city', e.target.value)} disabled={isDisabled || !address.province || isLoading}><option value="" hidden>Select City</option>{availableCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={e => handleAddressChange('barangay', e.target.value)} disabled={isDisabled || !address.city || isLoading}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b => <option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={e => handleAddressChange('street', e.target.value)} disabled={isDisabled || isLoading} maxLength={100} placeholder="e.g. Mabini St." />{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={e => handleAddressChange('houseNumber', e.target.value)} disabled={isDisabled || isLoading} maxLength={20} placeholder="e.g. Unit 123" />{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    const renderYesNoField = (label, section, field, value, disabled = false) => (
        <div className={styles.formGroup}>
            <label>{label} <span style={{ color: 'red' }}>*</span></label>
            <div className={styles.radioGroup}>
                <label className={`${styles.radioOption} ${value === 'yes' ? styles.radioOptionActive : ''}`}>
                    <input
                        type="radio"
                        name={`${section}_${field}`}
                        value="yes"
                        checked={value === 'yes'}
                        onChange={(e) => handleNestedChange(section, field, e.target.value)}
                        disabled={disabled}
                    />
                    <span>Yes</span>
                </label>
                <label className={`${styles.radioOption} ${value === 'no' ? styles.radioOptionActive : ''}`}>
                    <input
                        type="radio"
                        name={`${section}_${field}`}
                        value="no"
                        checked={value === 'no'}
                        onChange={(e) => handleNestedChange(section, field, e.target.value)}
                        disabled={disabled}
                    />
                    <span>No</span>
                </label>
            </div>
            {errors[`${section}_${field}`] && <span className={styles.errorText}>{errors[`${section}_${field}`]}</span>}
        </div>
    );

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await authFetch('/branches');
                if (res.ok) { const data = await res.json(); setBranchOptions(data.map(b => b.name)); }
            } catch (e) { console.error('Failed to load branches:', e); }
        };
        fetchBranches();
    }, []);

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isLoading && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isLoading}>
                        <img src={BackIcon} alt="Back" />
                    </button>
                    <div className={styles.header}>
                        <h2>Add New <span className={styles.highlight}>Patient</span></h2>
                        <p>Enter the patient's personal records below.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={triggerFileInput}>
                            {profileImage ? <img src={profileImage} alt="Profile" className={styles.previewImage} /> : <div className={styles.uploadPlaceholder}><span>Upload Photo</span></div>}
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isLoading} />
                        {errors.profileImage && <span className={styles.errorText}>{errors.profileImage}</span>}
                    </div>

                    <PatientRegistrationStepper
                        steps={INTAKE_STEPS}
                        currentIndex={currentStep}
                        onStepSelect={handleStepSelect}
                        isStepLocked={(index) => isLoading || index > currentStep + 1}
                        summaryAction={currentStep === 0 ? (
                            <button
                                type="button"
                                className={styles.flowSecondaryButton}
                                onClick={handleReviewExistingPatients}
                                disabled={isLoading}
                            >
                                Check Existing Patient Records
                            </button>
                        ) : null}
                    />

                    {currentStep === 0 && (
                        <>
                    <PatientRegistrationSectionCard
                        eyebrow="Identity"
                        title="Patient Details"
                        description="Complete the patient's identity, address, and primary contact details before moving to the next section."
                    >
                    {duplicateSections.length > 0 && (
                        <div style={{ marginBottom: '18px', padding: '16px 18px', borderRadius: '16px', border: '1px solid #f8d7a8', background: '#fff8e8' }}>
                            <strong style={{ display: 'block', color: '#8a5b00', marginBottom: '6px' }}>
                                {duplicateSummary?.hasStrongMatch ? 'Possible existing patient found' : 'Possible duplicate details found'}
                            </strong>
                            <span style={{ display: 'block', color: '#7a5b20', fontSize: '13px', lineHeight: '1.5' }}>
                                Review the existing patient matches below before creating a new record.
                            </span>
                            {errors.duplicateCheck && <span className={styles.errorText}>{errors.duplicateCheck}</span>}
                            {duplicateSummary?.hasAnyMatch && !duplicateSummary?.hasStrongMatch && (
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
                                        {softDuplicateConfirmed ? 'Ready to Continue' : 'Continue Anyway'}
                                    </button>
                                </div>
                            )}
                            {softDuplicateConfirmed && duplicateSummary?.hasAnyMatch && !duplicateSummary?.hasStrongMatch && (
                                <span style={{ display: 'block', color: '#166534', fontSize: '13px', marginTop: '10px' }}>
                                    Duplicate review noted. If this is a different patient who shares the same mobile number, submit again to continue.
                                </span>
                            )}
                            {duplicateCandidatePatients.length > 0 && (
                                <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                                    {duplicateCandidatePatients.slice(0, 3).map((patient) => (
                                        <div
                                            key={patient.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                padding: '12px 14px',
                                                borderRadius: '14px',
                                                border: '1px solid #f2c27b',
                                                background: '#fffdfa',
                                            }}
                                        >
                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                <strong style={{ color: '#7c4a03' }}>{patient.name || 'Existing Patient'}</strong>
                                                <span style={{ color: '#6b4f1d', fontSize: '13px' }}>{formatPatientDuplicateLine(patient)}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => openExistingPatientRecord(patient.id)}
                                                style={{
                                                    border: '1px solid #bfdbfe',
                                                    background: '#eff6ff',
                                                    color: '#01538b',
                                                    borderRadius: '999px',
                                                    padding: '10px 16px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Open Existing Record
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

                    {/* Row 1: Names */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isLoading} />{errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}</div>
                        <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} />{errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}</div>
                    </div>

                    <hr className={styles.divider} />
                    {renderAddressFields('Home Address')}

                    {/* Row 2: Birthdate / Gender */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BIRTHDATE <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isLoading} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                        <div className={styles.formGroup}><label>AGE</label><input className={styles.inputField} value={formData.birthdate ? String(getAge(formData.birthdate)) : ''} readOnly disabled /></div>
                        <div className={styles.formGroup}><label>GENDER <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isLoading}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>NATIONALITY</label><select className={styles.inputField} name="nationality" value={formData.nationality} onChange={handlePersonalChange} disabled={isLoading}>{NATIONALITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></div>
                        <div className={styles.formGroup}>
                            <label>RELIGION</label>
                            <select className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religion" value={formData.religion} onChange={handlePersonalChange} disabled={isLoading}>
                                <option value="">Select Religion</option>
                                {RELIGION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                            </select>
                            {errors.religionOther && <span className={styles.errorText}>{errors.religionOther}</span>}
                        </div>
                    </div>

                    {formData.religion === 'Other' && (
                        <div className={styles.row}>
                            <div className={styles.formGroup}><label>RELIGION, IF OTHER</label><input className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religionOther" value={formData.religionOther} onChange={handlePersonalChange} maxLength={50} disabled={isLoading} /></div>
                            <div className={styles.formGroup} />
                        </div>
                    )}

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>HOME PHONE</label>
                            <div className={`${styles.phoneInputGroup} ${errors.homePhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                <input className={styles.phoneField} name="homePhone" value={formData.homePhone} onChange={handleLandlineChange('homePhone')} maxLength={8} placeholder="1234567" disabled={isLoading} />
                            </div>
                            {errors.homePhone && <span className={styles.errorText}>{errors.homePhone}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>WORK PHONE</label>
                            <div className={`${styles.phoneInputGroup} ${errors.workPhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                <input className={styles.phoneField} name="workPhone" value={formData.workPhone} onChange={handleLandlineChange('workPhone')} maxLength={8} placeholder="1234567" disabled={isLoading} />
                            </div>
                            {errors.workPhone && <span className={styles.errorText}>{errors.workPhone}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>MOBILE <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange('phone')} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} maxLength={100} disabled={isLoading} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                        <div className={styles.formGroup}>
                            <label>OCCUPATION</label>
                            <select className={`${styles.inputField} ${errors.occupationOther ? styles.errorBorder : ''}`} name="occupation" value={formData.occupation} onChange={handlePersonalChange} disabled={isLoading}>
                                <option value="">Select occupation</option>
                                {OCCUPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            {errors.occupationOther && <span className={styles.errorText}>{errors.occupationOther}</span>}
                        </div>
                        <div className={styles.formGroup} />
                    </div>
                    {formData.occupation === 'Other' && (
                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>OCCUPATION, IF OTHER</label>
                                <input className={`${styles.inputField} ${errors.occupationOther ? styles.errorBorder : ''}`} name="occupationOther" value={formData.occupationOther} onChange={handlePersonalChange} maxLength={60} disabled={isLoading} />
                                {errors.occupationOther && <span className={styles.errorText}>{errors.occupationOther}</span>}
                            </div>
                            <div className={styles.formGroup} />
                        </div>
                    )}
                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>Cancel</button>
                        <button type="button" className={styles.submitBtn} onClick={() => handleStepAdvance(1)} disabled={isLoading}>Continue to Contacts</button>
                    </div>
                    </PatientRegistrationSectionCard>
                    </>
                    )}

                    {currentStep === 1 && (
                        <>
                    <PatientRegistrationSectionCard
                        eyebrow="Contacts & Branch"
                        title="Emergency Contact"
                        description="Add the patient's emergency details, minor guardian information when needed, and branch assignment."
                    >
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMERGENCY CONTACT NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.emergencyContactName ? styles.errorBorder : ''}`} name="emergencyContactName" value={formData.emergencyContactName} onChange={handlePersonalChange} maxLength={70} disabled={isLoading} />{errors.emergencyContactName && <span className={styles.errorText}>{errors.emergencyContactName}</span>}</div>
                        <div className={styles.formGroup}>
                            <label>MOBILE <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.emergencyContactPhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handlePhoneChange('emergencyContactPhone')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.emergencyContactPhone && <span className={styles.errorText}>{errors.emergencyContactPhone}</span>}
                        </div>
                        <div className={styles.formGroup}><label>RELATION <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.emergencyContactRelationship ? styles.errorBorder : ''}`} name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select relationship</option>{RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.emergencyContactRelationship && <span className={styles.errorText}>{errors.emergencyContactRelationship}</span>}</div>
                    </div>

                    {/* Guardian Info (minors only) */}
                    {isMinor && (
                        <>
                            <hr className={styles.divider} style={{ marginTop: '10px' }} />
                            <h3 className={styles.mainSectionTitle}>For Minors</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>GUARDIAN NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.guardianName ? styles.errorBorder : ''}`} name="guardianName" value={formData.guardianName} onChange={handlePersonalChange} maxLength={70} disabled={isLoading} placeholder="Full Name" />{errors.guardianName && <span className={styles.errorText}>{errors.guardianName}</span>}</div>
                                <div className={styles.formGroup}>
                                    <label>OCCUPATION <span style={{ color: 'red' }}>*</span></label>
                                    <select className={`${styles.inputField} ${errors.guardianOccupation || errors.guardianOccupationOther ? styles.errorBorder : ''}`} name="guardianOccupation" value={formData.guardianOccupation} onChange={handlePersonalChange} disabled={isLoading}>
                                        <option value="">Select occupation</option>
                                        {OCCUPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                    {errors.guardianOccupation && <span className={styles.errorText}>{errors.guardianOccupation}</span>}
                                    {errors.guardianOccupationOther && <span className={styles.errorText}>{errors.guardianOccupationOther}</span>}
                                </div>
                            </div>
                            {formData.guardianOccupation === 'Other' && (
                                <div className={styles.row}>
                                    <div className={styles.formGroup}>
                                        <label>OCCUPATION, IF OTHER <span style={{ color: 'red' }}>*</span></label>
                                        <input className={`${styles.inputField} ${errors.guardianOccupationOther ? styles.errorBorder : ''}`} name="guardianOccupationOther" value={formData.guardianOccupationOther} onChange={handlePersonalChange} maxLength={60} disabled={isLoading} />
                                        {errors.guardianOccupationOther && <span className={styles.errorText}>{errors.guardianOccupationOther}</span>}
                                    </div>
                                    <div className={styles.formGroup} />
                                </div>
                            )}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>RELATIONSHIP <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.guardianRelationship ? styles.errorBorder : ''}`} name="guardianRelationship" value={formData.guardianRelationship} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select relationship</option>{RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.guardianRelationship && <span className={styles.errorText}>{errors.guardianRelationship}</span>}</div>
                                <div className={styles.formGroup}>
                                    <label>GUARDIAN PHONE <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.guardianContact ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="guardianContact" value={formData.guardianContact} onChange={handleGuardianContactChange} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.guardianContact && <span className={styles.errorText}>{errors.guardianContact}</span>}
                        </div>
                        <div className={styles.formGroup} />
                    </div>
                </>
            )}

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>REFERRED BY</label><input className={styles.inputField} name="referredBy" value={formData.referredBy} onChange={handlePersonalChange} maxLength={80} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>REASON FOR CONSULTATION</label><input className={styles.inputField} name="reasonForConsultation" value={formData.reasonForConsultation} onChange={handlePersonalChange} maxLength={150} disabled={isLoading} /></div>
                        <div className={styles.formGroup} />
                    </div>

                    {/* Branch Assignment — required, shown before address */}
                    {!isSecretary && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            {isBranchScopedStaff ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <span className={styles.branchLockedBadge}>🏢 {user.assignedBranch}</span>
                                    <span className={styles.branchLockedNote}>Auto-assigned to your branch</span>
                                </div>
                            ) : (
                                <>
                                    <p className={styles.sectionSubtitle}>Select the branch this patient is registered under.</p>
                                    <div className={styles.row}>
                                        <div className={styles.formGroup}>
                                            <label>BRANCH <span style={{ color: 'red' }}>*</span></label>
                                            <select
                                                className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`}
                                                name="assignedBranch"
                                                value={formData.assignedBranch}
                                                onChange={handlePersonalChange}
                                                disabled={isLoading}
                                            >
                                                <option value="" hidden>Select a branch</option>
                                                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                                        </div>
                                        <div className={styles.formGroup} />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setCurrentStep(0)} disabled={isLoading}>Back to Identity</button>
                        <button type="button" className={styles.submitBtn} onClick={() => handleStepAdvance(2)} disabled={isLoading}>Continue to Medical</button>
                    </div>
                    </PatientRegistrationSectionCard>
                    </>
                    )}

                    {currentStep === 2 && (
                        <>
                    <PatientRegistrationSectionCard
                        eyebrow="Medical & Dental"
                        title="Dental and Medical History"
                        description="Capture the patient's dental background, physician details, and medical questionnaire before consent review."
                    >
                    <h3 className={styles.mainSectionTitle}>Dental History</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>LAST DENTAL VISIT</label><input type="date" className={`${styles.inputField} ${errors.dentalHistory_lastExamDate ? styles.errorBorder : ''}`} value={formData.dentalHistory.lastExamDate} onChange={(e) => handleNestedChange('dentalHistory', 'lastExamDate', e.target.value)} max={getTodayDate()} disabled={isLoading} />{errors.dentalHistory_lastExamDate && <span className={styles.errorText}>{errors.dentalHistory_lastExamDate}</span>}</div>
                        {renderYesNoField('REACTION OR COMPLICATION AFTER DENTAL TREATMENT?', 'dentalHistory', 'hadTreatmentReaction', formData.dentalHistory.hadTreatmentReaction, isLoading)}
                        <div className={styles.formGroup}><label>IF YES, PLEASE DETAIL</label><textarea className={`${styles.textArea} ${errors.dentalHistory_reactionDetails ? styles.errorBorder : ''}`} value={formData.dentalHistory.reactionDetails} onChange={(e) => handleNestedChange('dentalHistory', 'reactionDetails', e.target.value)} rows={3} disabled={isLoading} />{errors.dentalHistory_reactionDetails && <span className={styles.errorText}>{errors.dentalHistory_reactionDetails}</span>}</div>
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('PRIVATE OR CONFIDENTIAL INFORMATION TO DISCUSS IN PRIVATE?', 'dentalHistory', 'hasConfidentialInfo', formData.dentalHistory.hasConfidentialInfo, isLoading)}
                        <div className={styles.formGroup} />
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Attending Physician</h3>
                    <div className={styles.row}>
                                <div className={styles.formGroup}><label>PHYSICIAN NAME</label><input className={styles.inputField} value={formData.physician.name} onChange={handleNestedNameChange('physician', 'name')} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>SPECIALTY, IF APPLICABLE</label><select className={styles.inputField} value={formData.physician.specialty} onChange={(e) => handleNestedChange('physician', 'specialty', e.target.value)} disabled={isLoading}><option value="">Select Specialty</option>{PHYSICIAN_SPECIALTY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></div>
                    </div>
                    {formData.physician.specialty === 'Other' && (
                        <div className={styles.row}>
                            <div className={styles.formGroup}><label>SPECIALTY, IF OTHER</label><input className={`${styles.inputField} ${errors.physician_specialtyOther ? styles.errorBorder : ''}`} value={formData.physician.specialtyOther} onChange={(e) => handleNestedChange('physician', 'specialtyOther', e.target.value)} disabled={isLoading} />{errors.physician_specialtyOther && <span className={styles.errorText}>{errors.physician_specialtyOther}</span>}</div>
                            <div className={styles.formGroup} />
                        </div>
                    )}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>OFFICE ADDRESS</label><input className={styles.inputField} value={formData.physician.officeAddress} onChange={(e) => handleNestedChange('physician', 'officeAddress', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>OFFICE NUMBER</label><div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span><input className={styles.phoneField} value={formData.physician.officeNumber} onChange={handleNestedPhoneChange('physician', 'officeNumber')} maxLength={8} placeholder="1234567" disabled={isLoading} /></div>{errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}</div>
                    </div>

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Medical History</h3>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU IN GOOD HEALTH?', 'medicalHistory', 'inGoodHealth', formData.medicalHistory.inGoodHealth, isLoading)}
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU UNDER MEDICAL TREATMENT NOW?', 'medicalHistory', 'underMedicalTreatment', formData.medicalHistory.underMedicalTreatment, isLoading)}
                        <div className={styles.formGroup}><label>IF SO, WHAT IS THE CONDITION TREATED?</label><input className={`${styles.inputField} ${errors.medicalHistory_medicalTreatmentDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.medicalTreatmentDetails} onChange={(e) => handleNestedChange('medicalHistory', 'medicalTreatmentDetails', e.target.value)} disabled={isLoading} />{errors.medicalHistory_medicalTreatmentDetails && <span className={styles.errorText}>{errors.medicalHistory_medicalTreatmentDetails}</span>}</div>
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('HAVE YOU EVER HAD SERIOUS ILLNESS OR SURGICAL OPERATION?', 'medicalHistory', 'hadSeriousIllnessOrSurgery', formData.medicalHistory.hadSeriousIllnessOrSurgery, isLoading)}
                        <div className={styles.formGroup}><label>IF SO, WHAT IS THE ILLNESS OR OPERATION?</label><input className={`${styles.inputField} ${errors.medicalHistory_seriousIllnessOrSurgeryDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.seriousIllnessOrSurgeryDetails} onChange={(e) => handleNestedChange('medicalHistory', 'seriousIllnessOrSurgeryDetails', e.target.value)} disabled={isLoading} />{errors.medicalHistory_seriousIllnessOrSurgeryDetails && <span className={styles.errorText}>{errors.medicalHistory_seriousIllnessOrSurgeryDetails}</span>}</div>
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('HAVE YOU EVER BEEN HOSPITALIZED?', 'medicalHistory', 'hadHospitalization', formData.medicalHistory.hadHospitalization, isLoading)}
                        <div className={styles.formGroup}><label>IF SO, WHEN AND WHY?</label><input className={`${styles.inputField} ${errors.medicalHistory_hospitalizationDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.hospitalizationDetails} onChange={(e) => handleNestedChange('medicalHistory', 'hospitalizationDetails', e.target.value)} disabled={isLoading} />{errors.medicalHistory_hospitalizationDetails && <span className={styles.errorText}>{errors.medicalHistory_hospitalizationDetails}</span>}</div>
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU TAKING ANY PRESCRIPTION/NON-PRESCRIPTION MEDICATION?', 'medicalHistory', 'isTakingMedication', formData.medicalHistory.isTakingMedication, isLoading)}
                        <div className={styles.formGroup}><label>IF SO, PLEASE SPECIFY</label><input className={`${styles.inputField} ${errors.medicalHistory_medications ? styles.errorBorder : ''}`} value={formData.medicalHistory.medications} onChange={(e) => handleNestedChange('medicalHistory', 'medications', e.target.value)} disabled={isLoading} />{errors.medicalHistory_medications && <span className={styles.errorText}>{errors.medicalHistory_medications}</span>}</div>
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('DO YOU USE TOBACCO PRODUCTS?', 'medicalHistory', 'usesTobacco', formData.medicalHistory.usesTobacco, isLoading)}
                        {renderYesNoField('DO YOU USE ALCOHOL, COCAINE, OR OTHER DANGEROUS DRUGS?', 'medicalHistory', 'usesAlcoholOrDrugs', formData.medicalHistory.usesAlcoholOrDrugs, isLoading)}
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU ALLERGIC TO ANY OF THE FOLLOWING?', 'medicalHistory', 'hasAllergies', formData.medicalHistory.hasAllergies, isLoading)}
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>ALLERGIES</label>
                            <div className={styles.checkboxGrid}>
                                {ALLERGY_OPTIONS.map(option => (
                                    <label key={option} className={styles.checkboxOption}>
                                        <input type="checkbox" checked={formData.medicalHistory.allergies.includes(option)} onChange={() => handleNestedArrayToggle('medicalHistory', 'allergies', option)} disabled={isLoading} />
                                        <span>{option}</span>
                                    </label>
                                ))}
                            </div>
                            <input className={`${styles.inputField} ${errors.medicalHistory_allergies ? styles.errorBorder : ''}`} style={{ marginTop: '12px' }} value={formData.medicalHistory.allergyOther} onChange={(e) => handleNestedChange('medicalHistory', 'allergyOther', e.target.value)} placeholder="Other allergy" disabled={isLoading} />
                            {errors.medicalHistory_allergies && <span className={styles.errorText}>{errors.medicalHistory_allergies}</span>}
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BLEEDING TIME</label><input className={styles.inputField} value={formData.medicalHistory.bleedingTime} onChange={(e) => handleNestedChange('medicalHistory', 'bleedingTime', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU PREGNANT?', 'medicalHistory', 'isPregnant', formData.medicalHistory.isPregnant, isLoading)}
                        {renderYesNoField('ARE YOU NURSING?', 'medicalHistory', 'isNursing', formData.medicalHistory.isNursing, isLoading)}
                    </div>
                    <div className={styles.row}>
                        {renderYesNoField('ARE YOU TAKING BIRTH CONTROL PILLS?', 'medicalHistory', 'takingBirthControl', formData.medicalHistory.takingBirthControl, isLoading)}
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BLOOD TYPE</label><select className={styles.inputField} name="bloodType" value={formData.bloodType} onChange={handlePersonalChange} disabled={isLoading}><option value="">Select Blood Type</option>{BLOOD_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                        <div className={styles.formGroup}><label>BLOOD PRESSURE</label><input className={styles.inputField} value={formData.medicalHistory.bloodPressure} onChange={(e) => handleNestedChange('medicalHistory', 'bloodPressure', e.target.value)} placeholder="e.g. 120/80" disabled={isLoading} /></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>MEDICAL CONDITIONS</label>
                            <div className={styles.checkboxGrid}>
                                {MEDICAL_CONDITION_OPTIONS.map(option => (
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
                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setCurrentStep(1)} disabled={isLoading}>Back to Contacts</button>
                        <button type="button" className={styles.submitBtn} onClick={() => handleStepAdvance(3)} disabled={isLoading}>Continue to Consent</button>
                    </div>
                    </PatientRegistrationSectionCard>
                    </>
                    )}

                    {currentStep === 3 && (
                        <>
                    <PatientRegistrationSectionCard
                        eyebrow="Consent & Review"
                        title="Consent and Final Review"
                        description="Review the registration summary, then complete the privacy and consent acknowledgements before saving the patient record."
                    >
                    <div className={styles.reviewPanel}>
                        <strong className={styles.reviewPanelTitle}>Quick Review</strong>
                        <div className={styles.reviewGrid}>
                            <div>
                                <span>Patient</span>
                                <strong>{`${formData.firstName} ${formData.lastName}`.trim() || 'Not yet filled'}</strong>
                            </div>
                            <div>
                                <span>Registered Branch</span>
                                <strong>{(isBranchScopedStaff ? user?.assignedBranch : formData.assignedBranch) || 'Not selected'}</strong>
                            </div>
                            <div>
                                <span>Mobile</span>
                                <strong>{formData.phone ? `+63${formData.phone}` : 'Not yet filled'}</strong>
                            </div>
                            <div>
                                <span>Emergency Contact</span>
                                <strong>{formData.emergencyContactName || 'Not yet filled'}</strong>
                            </div>
                        </div>
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
                                <input
                                    className={`${styles.inputField} ${errors.dataPrivacyConsent_signerName ? styles.errorBorder : ''}`}
                                    name="dataPrivacyConsent_signerName"
                                    value={formData.dataPrivacyConsent.signerName}
                                    onChange={handleNestedNameChange('dataPrivacyConsent', 'signerName')}
                                    disabled={isLoading}
                                />
                                {errors.dataPrivacyConsent_signerName && <span className={styles.errorText}>{errors.dataPrivacyConsent_signerName}</span>}
                            </div>
                            <div className={styles.formGroup}>
                                <label>PRIVACY SIGNER ROLE <span style={{ color: 'red' }}>*</span></label>
                                <select className={styles.inputField} name="dataPrivacyConsent_signerRole" value={formData.dataPrivacyConsent.signerRole} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signerRole', e.target.value)} disabled={isLoading}>
                                    <option value="Patient">Patient</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>DATE SIGNED <span style={{ color: 'red' }}>*</span></label>
                                <input type="date" className={`${styles.inputField} ${errors.dataPrivacyConsent_signedAt ? styles.errorBorder : ''}`} name="dataPrivacyConsent_signedAt" value={formData.dataPrivacyConsent.signedAt} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isLoading} />
                                {errors.dataPrivacyConsent_signedAt && <span className={styles.errorText}>{errors.dataPrivacyConsent_signedAt}</span>}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (formData.dataPrivacyConsent.acknowledged) {
                                        handlePrivacyAcknowledged(false);
                                    } else {
                                        setIsPrivacyModalOpen(true);
                                    }
                                }}
                                disabled={isLoading}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: '#01538b', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
                            >
                                {formData.dataPrivacyConsent.acknowledged ? 'Undo privacy acknowledgement' : 'Review and acknowledge data privacy consent'}
                            </button>
                            <span style={{ fontSize: '12px', color: formData.dataPrivacyConsent.acknowledged ? '#166534' : '#64748b', fontWeight: 600 }}>
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
                                    name="consentAcknowledgement_signerName"
                                    value={formData.consentAcknowledgement.signerName}
                                    onChange={handleNestedNameChange('consentAcknowledgement', 'signerName')}
                                    disabled={isLoading}
                                />
                                {errors.consentAcknowledgement_signerName && <span className={styles.errorText}>{errors.consentAcknowledgement_signerName}</span>}
                            </div>
                            <div className={styles.formGroup}>
                                <label>SIGNER ROLE <span style={{ color: 'red' }}>*</span></label>
                                <select className={styles.inputField} name="consentAcknowledgement_signerRole" value={formData.consentAcknowledgement.signerRole} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signerRole', e.target.value)} disabled={isLoading}>
                                    <option value="Patient">Patient</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>DATE SIGNED <span style={{ color: 'red' }}>*</span></label>
                                <input type="date" className={`${styles.inputField} ${errors.consentAcknowledgement_signedAt ? styles.errorBorder : ''}`} name="consentAcknowledgement_signedAt" value={formData.consentAcknowledgement.signedAt} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isLoading} />
                                {errors.consentAcknowledgement_signedAt && <span className={styles.errorText}>{errors.consentAcknowledgement_signedAt}</span>}
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

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setCurrentStep(2)} disabled={isLoading}>Back to Medical</button>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading || hasFormErrors}>{isLoading ? 'ADDING PATIENT...' : 'ADD PATIENT'}</button>
                    </div>
                    </PatientRegistrationSectionCard>
                    </>
                    )}
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>New patient has been successfully added to the system.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}

            <ConsentReviewModal
                isOpen={isConsentModalOpen}
                onClose={() => setIsConsentModalOpen(false)}
                onConfirm={handleConsentAcknowledged}
                initiallyAcknowledged={formData.consentAcknowledgement.acknowledged}
            />
            <ConsentReviewModal
                isOpen={isPrivacyModalOpen}
                onClose={() => setIsPrivacyModalOpen(false)}
                onConfirm={handlePrivacyAcknowledged}
                initiallyAcknowledged={formData.dataPrivacyConsent.acknowledged}
                title="Data Privacy Consent Review"
                subtitle="Please review the full data privacy notice. The acknowledgement checkbox will only be enabled after the complete notice has been viewed."
                reviewGroups={dataPrivacyReviewGroups}
                acknowledgementLabel="I acknowledge that the patient or authorized representative has reviewed the full data privacy notice."
                confirmLabel="Save Privacy Acknowledgement"
            />
        </div>
    );
}
