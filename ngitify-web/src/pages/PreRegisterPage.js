import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WebsiteShell from '../components/website/WebsiteShell';
import ConsentReviewModal from '../components/admin/ConsentReviewModal';
import {
    PatientRegistrationSectionCard,
    PatientRegistrationStepper,
} from '../components/patient/PatientRegistrationFlow';
import styles from '../styles/website/WebsitePages.module.css';
import { privacyPolicySections, privacyPolicyUpdatedAt, privacyPolicyVersion } from '../data/consentDocument';
import { publicFetch } from '../utils/api';
import { regions, provinces, cities, barangays } from '../utils/addressData';
import {
    ALLERGY_OPTIONS,
    ALLERGY_SELECTION_REQUIRED_MESSAGE,
    BIRTHDATE_FUTURE_MESSAGE,
    BLOOD_TYPE_OPTIONS,
    INVALID_LANDLINE_FORMAT_MESSAGE,
    INVALID_MOBILE_FORMAT_MESSAGE,
    INVALID_SIGNED_DATE_MESSAGE,
    LAST_DENTAL_VISIT_FUTURE_MESSAGE,
    LANDLINE_PREFIX,
    MEDICAL_CONDITION_OPTIONS,
    NATIONALITY_OPTIONS,
    OCCUPATION_OPTIONS,
    PHYSICIAN_SPECIALTY_OPTIONS,
    REQUIRED_MESSAGE,
    REQUIRED_WHEN_YES_MESSAGE,
    RELATIONSHIP_OPTIONS,
    RELIGION_OPTIONS,
    getOtherTextValue,
    getSelectValueWithOther,
    isAllowedPersonNameInput,
    isValidLandlineNumber,
    isValidMobileNumber,
    stripLandlinePrefix,
    stripMobilePrefix,
    toTitleCaseName,
    toLandlinePayload,
    toMobilePayload,
} from '../utils/patientIntake';
import {
    getTodayDateInManila,
    isFutureDateInManila,
    normalizeDateInputValue,
} from '../utils/dateUtils';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };
const initialProfileState = {
    homePhone: '',
    workPhone: '',
    occupation: '',
    occupationOther: '',
    civilStatus: '',
    bloodType: '',
    nationality: '',
    nationalityOther: '',
    religion: '',
    religionOther: '',
    referredBy: '',
    reasonForConsultation: '',
};
const initialEmergencyContact = { name: '', relationship: '', relationshipOther: '', contactNumber: '' };
const initialGuardian = { name: '', relationship: '', relationshipOther: '', contactNumber: '', occupation: '', occupationOther: '' };
const initialPhysician = { name: '', specialty: '', specialtyOther: '', officeAddress: '', officeNumber: '' };
const initialDentalHistory = {
    lastExamDate: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    hasConfidentialInfo: '',
    notes: '',
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

const REQUIRED_MARK = <span style={{ color: '#dc2626' }}> *</span>;

const PRE_REGISTER_FIELD_ORDER = [
    'appointment_guestFirstName',
    'appointment_guestLastName',
    'appointment_guestPhone',
    'appointment_guestBirthdate',
    'appointment_guestGender',
    'profile_occupation',
    'profile_occupationOther',
    'home_region',
    'home_province',
    'home_city',
    'home_barangay',
    'home_street',
    'home_houseNumber',
    'emergencyContact_name',
    'emergencyContact_relationship',
    'emergencyContact_relationshipOther',
    'emergencyContact_contactNumber',
    'guardian_name',
    'guardian_relationship',
    'guardian_relationshipOther',
    'guardian_contactNumber',
    'guardian_occupation',
    'guardian_occupationOther',
    'profile_reasonForConsultation',
    'medicalHistory_inGoodHealth',
    'physician_specialtyOther',
    'dataPrivacyConsent_signerName',
    'dataPrivacyConsent_signedAt',
    'dataPrivacyConsent_acknowledged',
    'consentAcknowledgement_signerName',
    'consentAcknowledgement_signedAt',
    'consentAcknowledgement_acknowledged',
];

const PRE_REGISTER_STEPS = [
    { key: 'identity', label: 'Identity' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'medical', label: 'Medical & Dental' },
    { key: 'consent', label: 'Consent & Review' },
];

const PRE_REGISTER_SECTION_FIELDS = {
    identity: [
        'appointment_guestFirstName',
        'appointment_guestLastName',
        'appointment_guestPhone',
        'appointment_guestBirthdate',
        'appointment_guestGender',
        'profile_occupation',
        'profile_occupationOther',
        'profile_civilStatus',
        'profile_nationality',
        'profile_nationalityOther',
        'profile_religion',
        'profile_religionOther',
        'profile_homePhone',
        'profile_workPhone',
    ],
    contacts: [
        'home_region',
        'home_province',
        'home_city',
        'home_barangay',
        'home_street',
        'home_houseNumber',
        'emergencyContact_name',
        'emergencyContact_relationship',
        'emergencyContact_relationshipOther',
        'emergencyContact_contactNumber',
        'guardian_name',
        'guardian_relationship',
        'guardian_relationshipOther',
        'guardian_contactNumber',
        'guardian_occupation',
        'guardian_occupationOther',
    ],
    medical: [
        'profile_reasonForConsultation',
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
    consent: [
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

const formatDateInputValue = (value) => normalizeDateInputValue(value);

const getTodayDate = () => getTodayDateInManila();

const createConsentState = (signerRole = 'Patient', value = null, version = '') => ({
    acknowledged: Boolean(value?.acknowledged),
    signerName: value?.signerName || '',
    signerRole: value?.signerRole || signerRole,
    signedAt: value?.signedAt ? formatDateInputValue(value.signedAt) : getTodayDate(),
    version: value?.version || version,
});

const formatDate = (value) => {
    if (!value) return 'To be announced';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'To be announced'
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
};

const normalizeMedicalHistoryState = (history = {}) => ({
    ...initialMedicalHistory,
    ...history,
    medications: Array.isArray(history.medications) ? history.medications.join(', ') : (history.medications || ''),
    allergies: Array.isArray(history.allergies) ? history.allergies.filter((entry) => ALLERGY_OPTIONS.includes(entry)) : [],
    allergyOther: Array.isArray(history.allergies) ? history.allergies.filter((entry) => !ALLERGY_OPTIONS.includes(entry)).join(', ') : '',
    conditions: Array.isArray(history.conditions) ? history.conditions.filter((entry) => MEDICAL_CONDITION_OPTIONS.includes(entry)) : [],
    conditionOther: Array.isArray(history.conditions) ? history.conditions.filter((entry) => !MEDICAL_CONDITION_OPTIONS.includes(entry)).join(', ') : '',
    inGoodHealth: history.inGoodHealth === undefined ? '' : (history.inGoodHealth ? 'yes' : 'no'),
    underMedicalTreatment: history.underMedicalTreatment === undefined ? '' : (history.underMedicalTreatment ? 'yes' : 'no'),
    hadSeriousIllnessOrSurgery: history.hadSeriousIllnessOrSurgery === undefined ? '' : (history.hadSeriousIllnessOrSurgery ? 'yes' : 'no'),
    hadHospitalization: history.hadHospitalization === undefined ? '' : (history.hadHospitalization ? 'yes' : 'no'),
    isTakingMedication: history.isTakingMedication === undefined ? '' : (history.isTakingMedication ? 'yes' : 'no'),
    usesTobacco: history.usesTobacco === undefined ? '' : (history.usesTobacco ? 'yes' : 'no'),
    usesAlcoholOrDrugs: history.usesAlcoholOrDrugs === undefined ? '' : (history.usesAlcoholOrDrugs ? 'yes' : 'no'),
    hasAllergies: history.hasAllergies === undefined ? '' : (history.hasAllergies ? 'yes' : 'no'),
    isPregnant: history.isPregnant === undefined ? '' : (history.isPregnant ? 'yes' : 'no'),
    isNursing: history.isNursing === undefined ? '' : (history.isNursing ? 'yes' : 'no'),
    takingBirthControl: history.takingBirthControl === undefined ? '' : (history.takingBirthControl ? 'yes' : 'no'),
});

const normalizeDentalHistoryState = (history = {}) => ({
    ...initialDentalHistory,
    ...history,
    lastExamDate: history.lastExamDate ? new Date(history.lastExamDate).toISOString().split('T')[0] : '',
    hadTreatmentReaction: history.hadTreatmentReaction === undefined ? '' : (history.hadTreatmentReaction ? 'yes' : 'no'),
    hasConfidentialInfo: history.hasConfidentialInfo === undefined ? '' : (history.hasConfidentialInfo ? 'yes' : 'no'),
});

const boolFromSelect = (value) => {
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return undefined;
};

const isFutureDate = (value) => isFutureDateInManila(value);

const scrollToField = (fieldKey) => {
    window.requestAnimationFrame(() => {
        const target = document.querySelector(`[data-field-key="${fieldKey}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusTarget = target.matches('input, select, textarea, button')
            ? target
            : target.querySelector('input, select, textarea, button');
        focusTarget?.focus?.();
    });
};

export default function PreRegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [profile, setProfile] = useState({ ...initialProfileState });
    const [homeAddress, setHomeAddress] = useState({ ...initialAddressState });
    const [emergencyContact, setEmergencyContact] = useState({ ...initialEmergencyContact });
    const [guardian, setGuardian] = useState({ ...initialGuardian });
    const [physician, setPhysician] = useState({ ...initialPhysician });
    const [dentalHistory, setDentalHistory] = useState({ ...initialDentalHistory });
    const [medicalHistory, setMedicalHistory] = useState({ ...initialMedicalHistory });
    const [consentAcknowledgement, setConsentAcknowledgement] = useState(createConsentState('Patient', null, 'Dentime Patient Form v6.1'));
    const [dataPrivacyConsent, setDataPrivacyConsent] = useState(createConsentState('Patient', null, 'Data Privacy Act of 2012'));
    const [errors, setErrors] = useState({});
    const [state, setState] = useState('loading');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [activeStepKey, setActiveStepKey] = useState('identity');

    const patientAge = useMemo(() => getAge(appointmentInfo?.guestBirthdate), [appointmentInfo?.guestBirthdate]);
    const isMinor = patientAge !== null && patientAge < 18;
    const isFemalePatient = useMemo(
        () => String(appointmentInfo?.guestGender || '').trim().toLowerCase() === 'female',
        [appointmentInfo?.guestGender]
    );
    const isPhoneCallPreRegistration = useMemo(
        () => String(appointmentInfo?.source || '').trim() === 'Phone Call',
        [appointmentInfo?.source]
    );
    const activeSteps = useMemo(
        () => (isPhoneCallPreRegistration ? PRE_REGISTER_STEPS.filter((step) => step.key !== 'medical' && step.key !== 'consent') : PRE_REGISTER_STEPS),
        [isPhoneCallPreRegistration]
    );
    const activeStepIndex = useMemo(
        () => Math.max(activeSteps.findIndex((step) => step.key === activeStepKey), 0),
        [activeStepKey, activeSteps]
    );

    const buildValidationErrors = (snapshot) => {
        const nextErrors = {};
        const {
            appointmentInfo: nextAppointmentInfo,
            profile: nextProfile,
            homeAddress: nextHomeAddress,
            emergencyContact: nextEmergencyContact,
            guardian: nextGuardian,
            physician: nextPhysician,
            dentalHistory: nextDentalHistory,
            medicalHistory: nextMedicalHistory,
            consentAcknowledgement: nextConsentAcknowledgement,
            dataPrivacyConsent: nextDataPrivacyConsent,
            isMinor: nextIsMinor,
            isPhoneCallPreRegistration: nextIsPhoneCallPreRegistration,
        } = snapshot;

        if (!String(nextAppointmentInfo?.guestFirstName || '').trim()) nextErrors.appointment_guestFirstName = REQUIRED_MESSAGE;
        if (!String(nextAppointmentInfo?.guestLastName || '').trim()) nextErrors.appointment_guestLastName = REQUIRED_MESSAGE;
        if (!String(nextAppointmentInfo?.guestPhone || '').trim()) nextErrors.appointment_guestPhone = REQUIRED_MESSAGE;
        else if (!isValidMobileNumber(nextAppointmentInfo.guestPhone)) nextErrors.appointment_guestPhone = INVALID_MOBILE_FORMAT_MESSAGE;
        if (!String(nextAppointmentInfo?.guestBirthdate || '').trim()) nextErrors.appointment_guestBirthdate = REQUIRED_MESSAGE;
        else if (isFutureDate(nextAppointmentInfo.guestBirthdate)) nextErrors.appointment_guestBirthdate = BIRTHDATE_FUTURE_MESSAGE;
        if (!String(nextAppointmentInfo?.guestGender || '').trim()) nextErrors.appointment_guestGender = REQUIRED_MESSAGE;

        ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
            if (!String(nextHomeAddress[field] || '').trim()) nextErrors[`home_${field}`] = REQUIRED_MESSAGE;
        });

        if (!nextProfile.occupation) nextErrors.profile_occupation = REQUIRED_MESSAGE;
        if (nextProfile.occupation === 'Other' && !nextProfile.occupationOther.trim()) nextErrors.profile_occupationOther = REQUIRED_MESSAGE;
        if (!nextProfile.civilStatus) nextErrors.profile_civilStatus = REQUIRED_MESSAGE;
        if (!nextProfile.nationality) nextErrors.profile_nationality = REQUIRED_MESSAGE;
        if (!nextProfile.religion) nextErrors.profile_religion = REQUIRED_MESSAGE;
        if (nextProfile.nationality === 'Other' && !nextProfile.nationalityOther.trim()) nextErrors.profile_nationalityOther = REQUIRED_MESSAGE;
        if (nextProfile.religion === 'Other' && !nextProfile.religionOther.trim()) nextErrors.profile_religionOther = REQUIRED_MESSAGE;
        if (nextProfile.homePhone && !isValidLandlineNumber(nextProfile.homePhone)) nextErrors.profile_homePhone = INVALID_LANDLINE_FORMAT_MESSAGE;
        if (nextProfile.workPhone && !isValidLandlineNumber(nextProfile.workPhone)) nextErrors.profile_workPhone = INVALID_LANDLINE_FORMAT_MESSAGE;
        if (!nextIsPhoneCallPreRegistration && !nextProfile.reasonForConsultation.trim()) nextErrors.profile_reasonForConsultation = REQUIRED_MESSAGE;

        if (!nextEmergencyContact.name.trim()) nextErrors.emergencyContact_name = REQUIRED_MESSAGE;
        if (!nextEmergencyContact.relationship.trim()) nextErrors.emergencyContact_relationship = REQUIRED_MESSAGE;
        if (nextEmergencyContact.relationship === 'Other' && !nextEmergencyContact.relationshipOther.trim()) nextErrors.emergencyContact_relationshipOther = REQUIRED_MESSAGE;
        if (!nextEmergencyContact.contactNumber.trim()) nextErrors.emergencyContact_contactNumber = REQUIRED_MESSAGE;
        else if (!isValidMobileNumber(nextEmergencyContact.contactNumber)) nextErrors.emergencyContact_contactNumber = INVALID_MOBILE_FORMAT_MESSAGE;

        if (nextIsMinor) {
            if (!nextGuardian.name.trim()) nextErrors.guardian_name = REQUIRED_MESSAGE;
            if (!nextGuardian.relationship.trim()) nextErrors.guardian_relationship = REQUIRED_MESSAGE;
            if (nextGuardian.relationship === 'Other' && !nextGuardian.relationshipOther.trim()) nextErrors.guardian_relationshipOther = REQUIRED_MESSAGE;
            if (!nextGuardian.contactNumber.trim()) nextErrors.guardian_contactNumber = REQUIRED_MESSAGE;
            else if (!isValidMobileNumber(nextGuardian.contactNumber)) nextErrors.guardian_contactNumber = INVALID_MOBILE_FORMAT_MESSAGE;
            if (!nextGuardian.occupation.trim()) nextErrors.guardian_occupation = REQUIRED_MESSAGE;
            if (nextGuardian.occupation === 'Other' && !nextGuardian.occupationOther.trim()) nextErrors.guardian_occupationOther = REQUIRED_MESSAGE;
        }

        if (!nextIsPhoneCallPreRegistration) {
            if (nextDentalHistory.lastExamDate && isFutureDate(nextDentalHistory.lastExamDate)) nextErrors.dentalHistory_lastExamDate = LAST_DENTAL_VISIT_FUTURE_MESSAGE;
            if (!nextDentalHistory.hadTreatmentReaction) nextErrors.dentalHistory_hadTreatmentReaction = REQUIRED_MESSAGE;
            if (nextDentalHistory.hadTreatmentReaction === 'yes' && !nextDentalHistory.reactionDetails.trim()) nextErrors.dentalHistory_reactionDetails = REQUIRED_WHEN_YES_MESSAGE;
            if (!nextDentalHistory.hasConfidentialInfo) nextErrors.dentalHistory_hasConfidentialInfo = REQUIRED_MESSAGE;

            if (!nextMedicalHistory.inGoodHealth) nextErrors.medicalHistory_inGoodHealth = REQUIRED_MESSAGE;
            if (!nextMedicalHistory.underMedicalTreatment) nextErrors.medicalHistory_underMedicalTreatment = REQUIRED_MESSAGE;
            if (nextMedicalHistory.underMedicalTreatment === 'yes' && !nextMedicalHistory.medicalTreatmentDetails.trim()) nextErrors.medicalHistory_medicalTreatmentDetails = REQUIRED_WHEN_YES_MESSAGE;
            if (!nextMedicalHistory.hadSeriousIllnessOrSurgery) nextErrors.medicalHistory_hadSeriousIllnessOrSurgery = REQUIRED_MESSAGE;
            if (nextMedicalHistory.hadSeriousIllnessOrSurgery === 'yes' && !nextMedicalHistory.seriousIllnessOrSurgeryDetails.trim()) nextErrors.medicalHistory_seriousIllnessOrSurgeryDetails = REQUIRED_WHEN_YES_MESSAGE;
            if (!nextMedicalHistory.hadHospitalization) nextErrors.medicalHistory_hadHospitalization = REQUIRED_MESSAGE;
            if (nextMedicalHistory.hadHospitalization === 'yes' && !nextMedicalHistory.hospitalizationDetails.trim()) nextErrors.medicalHistory_hospitalizationDetails = REQUIRED_WHEN_YES_MESSAGE;
            if (!nextMedicalHistory.isTakingMedication) nextErrors.medicalHistory_isTakingMedication = REQUIRED_MESSAGE;
            if (nextMedicalHistory.isTakingMedication === 'yes' && !nextMedicalHistory.medications.trim()) nextErrors.medicalHistory_medications = REQUIRED_WHEN_YES_MESSAGE;
            if (!nextMedicalHistory.usesTobacco) nextErrors.medicalHistory_usesTobacco = REQUIRED_MESSAGE;
            if (!nextMedicalHistory.usesAlcoholOrDrugs) nextErrors.medicalHistory_usesAlcoholOrDrugs = REQUIRED_MESSAGE;
            if (!nextMedicalHistory.hasAllergies) nextErrors.medicalHistory_hasAllergies = REQUIRED_MESSAGE;
            if (nextMedicalHistory.hasAllergies === 'yes' && nextMedicalHistory.allergies.length === 0 && !nextMedicalHistory.allergyOther.trim()) {
                nextErrors.medicalHistory_allergies = ALLERGY_SELECTION_REQUIRED_MESSAGE;
            }
            if (snapshot.isFemalePatient) {
                if (!nextMedicalHistory.isPregnant) nextErrors.medicalHistory_isPregnant = REQUIRED_MESSAGE;
                if (!nextMedicalHistory.isNursing) nextErrors.medicalHistory_isNursing = REQUIRED_MESSAGE;
                if (!nextMedicalHistory.takingBirthControl) nextErrors.medicalHistory_takingBirthControl = REQUIRED_MESSAGE;
            }

            if (nextPhysician.specialty === 'Other' && !nextPhysician.specialtyOther.trim()) nextErrors.physician_specialtyOther = REQUIRED_MESSAGE;
            if (nextPhysician.officeNumber && !isValidLandlineNumber(nextPhysician.officeNumber)) nextErrors.physician_officeNumber = INVALID_LANDLINE_FORMAT_MESSAGE;

            if (!nextDataPrivacyConsent.signerName.trim()) nextErrors.dataPrivacyConsent_signerName = REQUIRED_MESSAGE;
            if (isFutureDate(nextDataPrivacyConsent.signedAt)) nextErrors.dataPrivacyConsent_signedAt = INVALID_SIGNED_DATE_MESSAGE;
            if (!nextDataPrivacyConsent.acknowledged) nextErrors.dataPrivacyConsent_acknowledged = REQUIRED_MESSAGE;

            if (!nextConsentAcknowledgement.signerName.trim()) nextErrors.consentAcknowledgement_signerName = REQUIRED_MESSAGE;
            if (isFutureDate(nextConsentAcknowledgement.signedAt)) nextErrors.consentAcknowledgement_signedAt = INVALID_SIGNED_DATE_MESSAGE;
            if (!nextConsentAcknowledgement.acknowledged) nextErrors.consentAcknowledgement_acknowledged = REQUIRED_MESSAGE;
        }

        return nextErrors;
    };

    const getSnapshot = (overrides = {}) => ({
        appointmentInfo,
        profile,
        homeAddress,
        emergencyContact,
        guardian,
        physician,
        dentalHistory,
        medicalHistory,
        consentAcknowledgement,
        dataPrivacyConsent,
        isMinor,
        isFemalePatient,
        isPhoneCallPreRegistration,
        ...overrides,
    });

    const syncErrors = (snapshot, keys = null) => {
        const nextErrors = buildValidationErrors(snapshot);
        setErrors((prev) => {
            if (!keys) return nextErrors;
            const merged = { ...prev };
            keys.forEach((key) => {
                if (nextErrors[key]) merged[key] = nextErrors[key];
                else delete merged[key];
            });
            return merged;
        });
        return nextErrors;
    };

    const getStepErrors = (stepKey, snapshot = getSnapshot()) => {
        const nextErrors = buildValidationErrors(snapshot);
        const stepFields = PRE_REGISTER_SECTION_FIELDS[stepKey] || [];
        return stepFields.filter((field) => nextErrors[field]).reduce((accumulator, field) => ({
            ...accumulator,
            [field]: nextErrors[field],
        }), {});
    };

    const focusFirstStepError = (stepKey, snapshot = getSnapshot()) => {
        const stepErrors = getStepErrors(stepKey, snapshot);
        const firstField = (PRE_REGISTER_SECTION_FIELDS[stepKey] || []).find((field) => stepErrors[field]);
        if (firstField) scrollToField(firstField);
        return stepErrors;
    };

    const goToStep = (stepKey) => {
        if (!activeSteps.some((step) => step.key === stepKey)) return;
        setActiveStepKey(stepKey);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    };

    const handleStepAdvance = () => {
        const currentStepKey = activeSteps[activeStepIndex]?.key;
        if (!currentStepKey) return;
        const snapshot = getSnapshot();
        const stepErrors = getStepErrors(currentStepKey, snapshot);
        syncErrors(snapshot, PRE_REGISTER_SECTION_FIELDS[currentStepKey] || []);
        if (Object.keys(stepErrors).length > 0) {
            focusFirstStepError(currentStepKey, snapshot);
            return;
        }
        const nextStep = activeSteps[activeStepIndex + 1];
        if (nextStep) goToStep(nextStep.key);
    };

    const handleStepBack = () => {
        const previousStep = activeSteps[activeStepIndex - 1];
        if (previousStep) goToStep(previousStep.key);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setState('invalid');
                setMessage('This link has expired or is invalid. Please contact the clinic for assistance.');
                return;
            }

            try {
                const response = await publicFetch(`/pre-register/${token}`);
                const data = await response.json().catch(() => ({}));

                if (response.status === 409) {
                    setState('used');
                    setMessage('You have already completed your registration. No further action is needed.');
                    return;
                }
                if (response.status === 410 || response.status === 404) {
                    setState('invalid');
                    setMessage('This link has expired or is invalid. Please contact the clinic for assistance.');
                    return;
                }
                if (!response.ok) {
                    throw new Error(data.message || 'Unable to load your registration link.');
                }

                const nextAge = getAge(data.guestBirthdate);
                const nextSignerRole = nextAge !== null && nextAge < 18 ? 'Parent' : 'Patient';
                const guestProfile = data.guestProfile || {};
                const guestGuardian = data.guestGuardian || {};

                setAppointmentInfo({
                    ...data,
                    guestFirstName: data.guestFirstName || '',
                    guestLastName: data.guestLastName || '',
                    guestPhone: stripMobilePrefix(data.guestPhone || ''),
                    guestEmail: data.guestEmail || '',
                    guestBirthdate: formatDateInputValue(data.guestBirthdate),
                });
                setProfile({
                    ...initialProfileState,
                    ...guestProfile,
                    occupation: getSelectValueWithOther(guestProfile.occupation || '', OCCUPATION_OPTIONS),
                    occupationOther: getOtherTextValue(guestProfile.occupation || '', OCCUPATION_OPTIONS),
                    nationality: getSelectValueWithOther(guestProfile.nationality || initialProfileState.nationality, NATIONALITY_OPTIONS),
                    nationalityOther: getOtherTextValue(guestProfile.nationality || '', NATIONALITY_OPTIONS),
                    religion: getSelectValueWithOther(guestProfile.religion || '', RELIGION_OPTIONS),
                    religionOther: getOtherTextValue(guestProfile.religion || '', RELIGION_OPTIONS),
                    homePhone: stripLandlinePrefix(guestProfile.homePhone || ''),
                    workPhone: stripLandlinePrefix(guestProfile.workPhone || ''),
                });
                setHomeAddress({ ...initialAddressState, ...(data.homeAddress || data.currentAddress || data.permanentAddress || {}) });
                setEmergencyContact({
                    ...initialEmergencyContact,
                    ...(data.guestEmergencyContact || {}),
                    relationship: getSelectValueWithOther(data.guestEmergencyContact?.relationship || '', RELATIONSHIP_OPTIONS),
                    relationshipOther: getOtherTextValue(data.guestEmergencyContact?.relationship || '', RELATIONSHIP_OPTIONS),
                    contactNumber: stripMobilePrefix(data.guestEmergencyContact?.contactNumber || ''),
                });
                setGuardian({
                    ...initialGuardian,
                    ...guestGuardian,
                    relationship: getSelectValueWithOther(guestGuardian.relationship || '', RELATIONSHIP_OPTIONS),
                    relationshipOther: getOtherTextValue(guestGuardian.relationship || '', RELATIONSHIP_OPTIONS),
                    occupation: getSelectValueWithOther(guestGuardian.occupation || '', OCCUPATION_OPTIONS),
                    occupationOther: getOtherTextValue(guestGuardian.occupation || '', OCCUPATION_OPTIONS),
                    contactNumber: stripMobilePrefix(guestGuardian.contactNumber || ''),
                });
                setPhysician({
                    ...initialPhysician,
                    ...(data.guestPhysician || {}),
                    specialty: getSelectValueWithOther(data.guestPhysician?.specialty || '', PHYSICIAN_SPECIALTY_OPTIONS),
                    specialtyOther: getOtherTextValue(data.guestPhysician?.specialty || '', PHYSICIAN_SPECIALTY_OPTIONS),
                    officeNumber: stripLandlinePrefix(data.guestPhysician?.officeNumber || ''),
                });
                setDentalHistory(normalizeDentalHistoryState(data.guestDentalHistory || {}));
                setMedicalHistory(normalizeMedicalHistoryState(data.guestMedicalHistory || {}));
                setConsentAcknowledgement(createConsentState(nextSignerRole, data.guestConsentAcknowledgement, 'Dentime Patient Form v6.1'));
                setDataPrivacyConsent(createConsentState(nextSignerRole, data.guestDataPrivacyConsent, 'Data Privacy Act of 2012'));
                setState('ready');
            } catch (error) {
                setState('invalid');
                setMessage(error.message || 'This link has expired or is invalid. Please contact the clinic for assistance.');
            }
        };

        fetchData();
    }, [token]);

    useEffect(() => {
        setActiveStepKey('identity');
    }, [isPhoneCallPreRegistration, state]);

    const handleAddressChange = (field, value) => {
        const nextHomeAddress = { ...homeAddress, [field]: value };
        if (field === 'region') {
            nextHomeAddress.province = '';
            nextHomeAddress.city = '';
            nextHomeAddress.barangay = '';
        }
        if (field === 'province') {
            nextHomeAddress.city = '';
            nextHomeAddress.barangay = '';
        }
        if (field === 'city') {
            nextHomeAddress.barangay = '';
        }
        setHomeAddress(nextHomeAddress);
        syncErrors(getSnapshot({ homeAddress: nextHomeAddress }), ['home_region', 'home_province', 'home_city', 'home_barangay', 'home_street', 'home_houseNumber']);
    };

    const handleAppointmentInfoChange = (field, value) => {
        const nextAppointmentInfo = { ...(appointmentInfo || {}), [field]: value };
        if (field === 'guestFirstName' || field === 'guestLastName') {
            if (!isAllowedPersonNameInput(value)) return;
            nextAppointmentInfo[field] = toTitleCaseName(value);
        }
        if (field === 'guestPhone') {
            nextAppointmentInfo[field] = value.replace(/\D/g, '').slice(0, 10);
        }
        const nextAge = getAge(nextAppointmentInfo.guestBirthdate);
        const nextSignerRole = nextAge !== null && nextAge < 18 ? 'Parent' : 'Patient';

        setAppointmentInfo(nextAppointmentInfo);
        setConsentAcknowledgement((prev) => (
            prev.signerRole === 'Patient' || prev.signerRole === 'Parent'
                ? { ...prev, signerRole: nextSignerRole }
                : prev
        ));
        setDataPrivacyConsent((prev) => (
            prev.signerRole === 'Patient' || prev.signerRole === 'Parent'
                ? { ...prev, signerRole: nextSignerRole }
                : prev
        ));
        syncErrors(
            getSnapshot({ appointmentInfo: nextAppointmentInfo }),
            ['appointment_guestFirstName', 'appointment_guestLastName', 'appointment_guestPhone', 'appointment_guestBirthdate', 'appointment_guestGender']
        );
    };

    const handleProfileChange = (field, value) => {
        const nextProfile = { ...profile, [field]: value };
        if (field === 'occupation' && value !== 'Other') nextProfile.occupationOther = '';
        if (field === 'nationality' && value !== 'Other') nextProfile.nationalityOther = '';
        if (field === 'religion' && value !== 'Other') nextProfile.religionOther = '';
        if (field === 'reasonForConsultation') {
            setDentalHistory((prev) => ({ ...prev, chiefComplaint: value }));
        }
        setProfile(nextProfile);
        syncErrors(
            getSnapshot({ profile: nextProfile }),
            [
                `profile_${field}`,
                'profile_occupation',
                'profile_occupationOther',
                'profile_nationalityOther',
                'profile_religionOther',
                'profile_reasonForConsultation',
            ]
        );
    };

    const handleLandlineChange = (field, value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        const nextProfile = { ...profile, [field]: digits };
        setProfile(nextProfile);
        syncErrors(getSnapshot({ profile: nextProfile }), [`profile_${field}`]);
    };

    const handleContactChange = (type, field, value) => {
        const setterMap = {
            emergencyContact: [emergencyContact, setEmergencyContact],
            guardian: [guardian, setGuardian],
            physician: [physician, setPhysician],
        };
        const [current, setter] = setterMap[type];
        if (field === 'name' && !isAllowedPersonNameInput(value)) return;
        const next = { ...current, [field]: value };
        if (field === 'name') next[field] = toTitleCaseName(value);
        if (type === 'emergencyContact' && field === 'relationship' && value !== 'Other') next.relationshipOther = '';
        if (type === 'guardian') {
            if (field === 'relationship' && value !== 'Other') next.relationshipOther = '';
            if (field === 'occupation' && value !== 'Other') next.occupationOther = '';
        }
        if (type === 'physician' && field === 'specialty' && value !== 'Other') next.specialtyOther = '';
        setter(next);
        syncErrors(
            getSnapshot({ [type]: next }),
            [
                `${type}_${field}`,
                `${type}_relationshipOther`,
                `${type}_occupation`,
                `${type}_occupationOther`,
                `${type}_specialtyOther`,
            ]
        );
    };

    const handleMobileChange = (type, field, value) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        handleContactChange(type, field, digits);
    };

    const handlePhysicianLandlineChange = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        const nextPhysician = { ...physician, officeNumber: digits };
        setPhysician(nextPhysician);
        syncErrors(getSnapshot({ physician: nextPhysician }), ['physician_officeNumber']);
    };

    const handleDentalChange = (field, value) => {
        const nextDentalHistory = { ...dentalHistory, [field]: value };
        setDentalHistory(nextDentalHistory);
        syncErrors(
            getSnapshot({ dentalHistory: nextDentalHistory }),
            ['dentalHistory_lastExamDate', 'dentalHistory_hadTreatmentReaction', 'dentalHistory_reactionDetails', 'dentalHistory_hasConfidentialInfo']
        );
    };

    const handleMedicalChange = (field, value) => {
        const nextMedicalHistory = { ...medicalHistory, [field]: value };
        setMedicalHistory(nextMedicalHistory);
        syncErrors(
            getSnapshot({ medicalHistory: nextMedicalHistory }),
            [
                `medicalHistory_${field}`,
                'medicalHistory_allergies',
                'medicalHistory_medicalTreatmentDetails',
                'medicalHistory_seriousIllnessOrSurgeryDetails',
                'medicalHistory_hospitalizationDetails',
                'medicalHistory_medications',
            ]
        );
    };

    const handleMedicalArrayToggle = (field, option) => {
        const currentValues = medicalHistory[field];
        const nextValues = currentValues.includes(option)
            ? currentValues.filter((entry) => entry !== option)
            : [...currentValues, option];
        const nextMedicalHistory = { ...medicalHistory, [field]: nextValues };
        setMedicalHistory(nextMedicalHistory);
        syncErrors(getSnapshot({ medicalHistory: nextMedicalHistory }), ['medicalHistory_allergies']);
    };

    const handleConsentChange = (type, field, value) => {
        const source = type === 'privacy' ? dataPrivacyConsent : consentAcknowledgement;
        const setter = type === 'privacy' ? setDataPrivacyConsent : setConsentAcknowledgement;
        if (field === 'signerName' && !isAllowedPersonNameInput(value)) return;
        const next = { ...source, [field]: value };
        if (field === 'signerName') next[field] = toTitleCaseName(value);
        setter(next);
        syncErrors(
            getSnapshot(type === 'privacy' ? { dataPrivacyConsent: next } : { consentAcknowledgement: next }),
            [
                `${type === 'privacy' ? 'dataPrivacyConsent' : 'consentAcknowledgement'}_${field}`,
                `${type === 'privacy' ? 'dataPrivacyConsent' : 'consentAcknowledgement'}_acknowledged`,
            ]
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = syncErrors(getSnapshot(), null);
        if (Object.keys(nextErrors).length > 0) {
            const firstErrorKey = PRE_REGISTER_FIELD_ORDER.find((field) => nextErrors[field]) || Object.keys(nextErrors)[0];
            const targetStep = activeSteps.find((step) => (PRE_REGISTER_SECTION_FIELDS[step.key] || []).includes(firstErrorKey));
            if (targetStep) setActiveStepKey(targetStep.key);
            scrollToField(firstErrorKey);
            return;
        }

        setIsSubmitting(true);
        setMessage('');
        try {
            const response = await publicFetch(`/pre-register/${token}`, {
                method: 'POST',
                body: JSON.stringify({
                    guestFirstName: appointmentInfo?.guestFirstName || '',
                    guestLastName: appointmentInfo?.guestLastName || '',
                    guestPhone: toMobilePayload(appointmentInfo?.guestPhone || ''),
                    guestBirthdate: formatDateInputValue(appointmentInfo?.guestBirthdate),
                    guestGender: appointmentInfo?.guestGender || '',
                    homeAddress,
                    guestProfile: {
                        ...profile,
                        occupation: profile.occupation === 'Other' ? profile.occupationOther.trim() : profile.occupation,
                        nationality: profile.nationality === 'Other' ? profile.nationalityOther.trim() : profile.nationality,
                        religion: profile.religion === 'Other' ? profile.religionOther.trim() : profile.religion,
                        homePhone: toLandlinePayload(profile.homePhone),
                        workPhone: toLandlinePayload(profile.workPhone),
                    },
                    guestEmergencyContact: {
                        ...emergencyContact,
                        relationship: emergencyContact.relationship === 'Other' ? emergencyContact.relationshipOther.trim() : emergencyContact.relationship,
                        contactNumber: toMobilePayload(emergencyContact.contactNumber),
                    },
                    guestGuardian: {
                        ...guardian,
                        relationship: guardian.relationship === 'Other' ? guardian.relationshipOther.trim() : guardian.relationship,
                        occupation: guardian.occupation === 'Other' ? guardian.occupationOther.trim() : guardian.occupation,
                        contactNumber: toMobilePayload(guardian.contactNumber),
                    },
                    guestPhysician: {
                        ...physician,
                        specialty: physician.specialty === 'Other' ? physician.specialtyOther.trim() : physician.specialty,
                        officeNumber: toLandlinePayload(physician.officeNumber),
                    },
                    guestDentalHistory: {
                        ...dentalHistory,
                        chiefComplaint: profile.reasonForConsultation || dentalHistory.notes || '',
                        hadTreatmentReaction: boolFromSelect(dentalHistory.hadTreatmentReaction),
                        hasConfidentialInfo: boolFromSelect(dentalHistory.hasConfidentialInfo),
                    },
                    guestMedicalHistory: {
                        ...medicalHistory,
                        allergies: [...medicalHistory.allergies, ...medicalHistory.allergyOther.split(',').map((entry) => entry.trim()).filter(Boolean)],
                        conditions: [...medicalHistory.conditions, ...medicalHistory.conditionOther.split(',').map((entry) => entry.trim()).filter(Boolean)],
                        medications: medicalHistory.medications.split(',').map((entry) => entry.trim()).filter(Boolean),
                        inGoodHealth: boolFromSelect(medicalHistory.inGoodHealth),
                        underMedicalTreatment: boolFromSelect(medicalHistory.underMedicalTreatment),
                        hadSeriousIllnessOrSurgery: boolFromSelect(medicalHistory.hadSeriousIllnessOrSurgery),
                        hadHospitalization: boolFromSelect(medicalHistory.hadHospitalization),
                        isTakingMedication: boolFromSelect(medicalHistory.isTakingMedication),
                        usesTobacco: boolFromSelect(medicalHistory.usesTobacco),
                        usesAlcoholOrDrugs: boolFromSelect(medicalHistory.usesAlcoholOrDrugs),
                        hasAllergies: boolFromSelect(medicalHistory.hasAllergies),
                        isPregnant: boolFromSelect(medicalHistory.isPregnant),
                        isNursing: boolFromSelect(medicalHistory.isNursing),
                        takingBirthControl: boolFromSelect(medicalHistory.takingBirthControl),
                    },
                    consentAcknowledgement: {
                        ...consentAcknowledgement,
                        signerName: consentAcknowledgement.signerName.trim(),
                        signedAt: consentAcknowledgement.signedAt || getTodayDate(),
                        version: consentAcknowledgement.version || 'Dentime Patient Form v6.1',
                    },
                    dataPrivacyConsent: {
                        ...dataPrivacyConsent,
                        signerName: dataPrivacyConsent.signerName.trim(),
                        signedAt: dataPrivacyConsent.signedAt || getTodayDate(),
                        version: dataPrivacyConsent.version || 'Data Privacy Act of 2012',
                    },
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to save your details.');
            setState('success');
            setMessage('Thank you! Your registration details have been completed. Please check your email for the activation link sent by the clinic, then open it and set up your password.');
        } catch (error) {
            setMessage(error.message || 'Unable to save your details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pageTitle = useMemo(() => {
        if (state === 'success') return 'Registration completed';
        if (state === 'used') return 'Registration already completed';
        if (state === 'invalid') return 'Registration link unavailable';
        return 'Complete your registration';
    }, [state]);

    const availableProvinces = homeAddress.region ? provinces[homeAddress.region] || [] : [];
    const availableCities = homeAddress.province ? cities[homeAddress.province] || [] : [];
    const availableBarangays = homeAddress.city ? barangays[homeAddress.city] || [] : [];

    const renderYesNoField = (label, value, onChange, errorKey, fieldKey) => (
        <div className={styles.fieldGroup} data-field-key={fieldKey}>
            <label className={styles.fieldLabel}>{label}{REQUIRED_MARK}</label>
            <div className={styles.radioGroup}>
                <label className={`${styles.radioOption} ${value === 'yes' ? styles.radioOptionActive : ''}`}>
                    <input
                        type="radio"
                        name={fieldKey}
                        value="yes"
                        checked={value === 'yes'}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <span>Yes</span>
                </label>
                <label className={`${styles.radioOption} ${value === 'no' ? styles.radioOptionActive : ''}`}>
                    <input
                        type="radio"
                        name={fieldKey}
                        value="no"
                        checked={value === 'no'}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <span>No</span>
                </label>
            </div>
            {errors[errorKey] && <span className={styles.errorText}>{errors[errorKey]}</span>}
        </div>
    );

    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection} style={{ gridTemplateColumns: '1fr' }}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>Pre-Registration</p>
                        <h1 className={styles.sectionTitle}>{pageTitle}</h1>
                        {state === 'ready' && appointmentInfo ? (
                            <>
                                <p className={styles.bodyText}>
                                    Hello {appointmentInfo.guestName}, please complete the patient information below for your {appointmentInfo.procedure} appointment on {formatDate(appointmentInfo.appointmentDate)} at {appointmentInfo.branch}.
                                </p>
                                <p className={styles.bodyText}>
                                    The information you provide here will be used to prepare your patient record before your visit and will still be reviewed by the clinic on site.
                                </p>
                                {isPhoneCallPreRegistration && (
                                    <div className={styles.successBanner} style={{ marginTop: '16px' }}>
                                        For phone-call bookings, only your personal and contact information is needed right now. The clinic will finish the medical history, physician details, and consent review when you arrive.
                                    </div>
                                )}
                                <div className={styles.formGrid} style={{ marginTop: '16px' }}>
                                    <div className={styles.fieldGroup} data-field-key="appointment_guestFirstName">
                                        <label className={styles.fieldLabel}>First Name{REQUIRED_MARK}</label>
                                        <input
                                            className={`${styles.fieldInput} ${errors.appointment_guestFirstName ? styles.errorBorder : ''}`}
                                            value={appointmentInfo.guestFirstName || ''}
                                            onChange={(e) => handleAppointmentInfoChange('guestFirstName', e.target.value)}
                                            placeholder="Enter your first name"
                                        />
                                        {errors.appointment_guestFirstName && <span className={styles.errorText}>{errors.appointment_guestFirstName}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="appointment_guestLastName">
                                        <label className={styles.fieldLabel}>Last Name{REQUIRED_MARK}</label>
                                        <input
                                            className={`${styles.fieldInput} ${errors.appointment_guestLastName ? styles.errorBorder : ''}`}
                                            value={appointmentInfo.guestLastName || ''}
                                            onChange={(e) => handleAppointmentInfoChange('guestLastName', e.target.value)}
                                            placeholder="Enter your last name"
                                        />
                                        {errors.appointment_guestLastName && <span className={styles.errorText}>{errors.appointment_guestLastName}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="appointment_guestPhone">
                                        <label className={styles.fieldLabel}>Phone{REQUIRED_MARK}</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.appointment_guestPhone ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input
                                                className={styles.phoneField}
                                                value={appointmentInfo.guestPhone || ''}
                                                onChange={(e) => handleAppointmentInfoChange('guestPhone', e.target.value)}
                                                maxLength={10}
                                                placeholder="9xxxxxxxxx"
                                            />
                                        </div>
                                        {errors.appointment_guestPhone && <span className={styles.errorText}>{errors.appointment_guestPhone}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Email{REQUIRED_MARK}</label>
                                        <input
                                            type="email"
                                            className={styles.fieldInput}
                                            value={appointmentInfo.guestEmail || ''}
                                            readOnly
                                            disabled
                                        />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Branch{REQUIRED_MARK}</label>
                                        <input
                                            className={styles.fieldInput}
                                            value={appointmentInfo.branch || ''}
                                            readOnly
                                            disabled
                                        />
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="appointment_guestBirthdate">
                                        <label className={styles.fieldLabel}>Birthdate{REQUIRED_MARK}</label>
                                        <input
                                            type="date"
                                            className={`${styles.fieldInput} ${errors.appointment_guestBirthdate ? styles.errorBorder : ''}`}
                                            value={formatDateInputValue(appointmentInfo.guestBirthdate)}
                                            onChange={(e) => handleAppointmentInfoChange('guestBirthdate', e.target.value)}
                                            max={getTodayDate()}
                                        />
                                        {errors.appointment_guestBirthdate && <span className={styles.errorText}>{errors.appointment_guestBirthdate}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="appointment_guestGender">
                                        <label className={styles.fieldLabel}>Gender{REQUIRED_MARK}</label>
                                        <select
                                            className={`${styles.fieldSelect} ${errors.appointment_guestGender ? styles.errorBorder : ''}`}
                                            value={appointmentInfo.guestGender || ''}
                                            onChange={(e) => handleAppointmentInfoChange('guestGender', e.target.value)}
                                        >
                                            <option value="">Select gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Prefer not to say">Prefer not to say</option>
                                        </select>
                                        {errors.appointment_guestGender && <span className={styles.errorText}>{errors.appointment_guestGender}</span>}
                                    </div>
                                </div>
                            </>
                        ) : (
                                <p className={styles.bodyText}>{state === 'success' ? 'Your registration has been completed successfully.' : (message || 'Loading your registration link...')}</p>
                            )}
                    </article>

                    {state === 'ready' && (
                        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
                            {message && <div className={styles.errorBanner}>{message}</div>}
                            <PatientRegistrationStepper
                                steps={activeSteps}
                                currentIndex={activeStepIndex}
                                onStepSelect={(index) => {
                                    if (index <= activeStepIndex) {
                                        goToStep(activeSteps[index].key);
                                    }
                                }}
                                isStepLocked={(index) => index > activeStepIndex}
                            />

                            {activeStepKey === 'identity' && (
                            <>
                            <PatientRegistrationSectionCard
                                eyebrow="Identity"
                                title="Identity"
                                description="Review your booking details and complete your personal information below."
                            >
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup} data-field-key="profile_occupation">
                                        <label className={styles.fieldLabel}>Occupation{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.profile_occupation ? styles.errorBorder : ''}`} value={profile.occupation} onChange={(e) => handleProfileChange('occupation', e.target.value)}>
                                            <option value="">Select occupation</option>
                                            {OCCUPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        {errors.profile_occupation && <span className={styles.errorText}>{errors.profile_occupation}</span>}
                                    </div>
                                    {profile.occupation === 'Other' && (
                                        <div className={styles.fieldGroup} data-field-key="profile_occupationOther">
                                            <label className={styles.fieldLabel}>Occupation, If Other{REQUIRED_MARK}</label>
                                            <input className={`${styles.fieldInput} ${errors.profile_occupationOther ? styles.errorBorder : ''}`} value={profile.occupationOther} onChange={(e) => handleProfileChange('occupationOther', e.target.value)} />
                                            {errors.profile_occupationOther && <span className={styles.errorText}>{errors.profile_occupationOther}</span>}
                                        </div>
                                    )}
                                    <div className={styles.fieldGroup} data-field-key="profile_civilStatus">
                                        <label className={styles.fieldLabel}>Civil Status{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.profile_civilStatus ? styles.errorBorder : ''}`} value={profile.civilStatus} onChange={(e) => handleProfileChange('civilStatus', e.target.value)}>
                                            <option value="">Select status</option>
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                            <option value="Widowed">Widowed</option>
                                            <option value="Separated">Separated</option>
                                            <option value="Divorced">Divorced</option>
                                        </select>
                                        {errors.profile_civilStatus && <span className={styles.errorText}>{errors.profile_civilStatus}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="profile_nationality">
                                        <label className={styles.fieldLabel}>Nationality{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.profile_nationality || errors.profile_nationalityOther ? styles.errorBorder : ''}`} value={profile.nationality} onChange={(e) => handleProfileChange('nationality', e.target.value)}>
                                            <option value="">Select nationality</option>
                                            {NATIONALITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        {(errors.profile_nationality || errors.profile_nationalityOther) && <span className={styles.errorText}>{errors.profile_nationality || errors.profile_nationalityOther}</span>}
                                    </div>
                                    {profile.nationality === 'Other' && (
                                        <div className={styles.fieldGroup} data-field-key="profile_nationalityOther">
                                            <label className={styles.fieldLabel}>Nationality, If Other{REQUIRED_MARK}</label>
                                            <input className={`${styles.fieldInput} ${errors.profile_nationalityOther ? styles.errorBorder : ''}`} value={profile.nationalityOther} onChange={(e) => handleProfileChange('nationalityOther', e.target.value)} />
                                            {errors.profile_nationalityOther && <span className={styles.errorText}>{errors.profile_nationalityOther}</span>}
                                        </div>
                                    )}
                                    <div className={styles.fieldGroup} data-field-key="profile_religion">
                                        <label className={styles.fieldLabel}>Religion{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.profile_religion || errors.profile_religionOther ? styles.errorBorder : ''}`} value={profile.religion} onChange={(e) => handleProfileChange('religion', e.target.value)}>
                                            <option value="">Select religion</option>
                                            {RELIGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        {(errors.profile_religion || errors.profile_religionOther) && <span className={styles.errorText}>{errors.profile_religion || errors.profile_religionOther}</span>}
                                    </div>
                                    {profile.religion === 'Other' && (
                                        <div className={styles.fieldGroup} data-field-key="profile_religionOther">
                                            <label className={styles.fieldLabel}>Religion, If Other{REQUIRED_MARK}</label>
                                            <input className={`${styles.fieldInput} ${errors.profile_religionOther ? styles.errorBorder : ''}`} value={profile.religionOther} onChange={(e) => handleProfileChange('religionOther', e.target.value)} />
                                            {errors.profile_religionOther && <span className={styles.errorText}>{errors.profile_religionOther}</span>}
                                        </div>
                                    )}
                                    <div className={styles.fieldGroup} data-field-key="profile_homePhone">
                                        <label className={styles.fieldLabel}>Home Phone</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.profile_homePhone ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                            <input className={styles.phoneField} value={profile.homePhone} onChange={(e) => handleLandlineChange('homePhone', e.target.value)} maxLength={8} placeholder="1234567" />
                                        </div>
                                        {errors.profile_homePhone && <span className={styles.errorText}>{errors.profile_homePhone}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="profile_workPhone">
                                        <label className={styles.fieldLabel}>Work Phone</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.profile_workPhone ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                            <input className={styles.phoneField} value={profile.workPhone} onChange={(e) => handleLandlineChange('workPhone', e.target.value)} maxLength={8} placeholder="1234567" />
                                        </div>
                                        {errors.profile_workPhone && <span className={styles.errorText}>{errors.profile_workPhone}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Referred By</label>
                                        <input className={styles.fieldInput} value={profile.referredBy} onChange={(e) => handleProfileChange('referredBy', e.target.value)} />
                                    </div>
                                </div>
                            </PatientRegistrationSectionCard>
                            <div className={styles.buttonRow}>
                                <button type="button" className={styles.primaryBtn} onClick={handleStepAdvance}>
                                    Continue to Contacts
                                </button>
                            </div>
                            </>
                            )}

                            {activeStepKey === 'contacts' && (
                            <>
                            <PatientRegistrationSectionCard
                                eyebrow="Contacts"
                                title="Contacts"
                                description="Add your address and the people the clinic can contact if needed."
                            >
                                <h4 className={styles.sectionTitle} style={{ fontSize: '1rem', marginTop: '18px' }}>Home Address</h4>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup} data-field-key="home_region">
                                        <label className={styles.fieldLabel}>Region{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.home_region ? styles.errorBorder : ''}`} value={homeAddress.region} onChange={(e) => handleAddressChange('region', e.target.value)}>
                                            <option value="">Select region</option>
                                            {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
                                        </select>
                                        {errors.home_region && <span className={styles.errorText}>{errors.home_region}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="home_province">
                                        <label className={styles.fieldLabel}>Province{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.home_province ? styles.errorBorder : ''}`} value={homeAddress.province} onChange={(e) => handleAddressChange('province', e.target.value)} disabled={!homeAddress.region}>
                                            <option value="">Select province</option>
                                            {availableProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                                        </select>
                                        {errors.home_province && <span className={styles.errorText}>{errors.home_province}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="home_city">
                                        <label className={styles.fieldLabel}>City / Municipality{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.home_city ? styles.errorBorder : ''}`} value={homeAddress.city} onChange={(e) => handleAddressChange('city', e.target.value)} disabled={!homeAddress.province}>
                                            <option value="">Select city</option>
                                            {availableCities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
                                        </select>
                                        {errors.home_city && <span className={styles.errorText}>{errors.home_city}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="home_barangay">
                                        <label className={styles.fieldLabel}>Barangay{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.home_barangay ? styles.errorBorder : ''}`} value={homeAddress.barangay} onChange={(e) => handleAddressChange('barangay', e.target.value)} disabled={!homeAddress.city}>
                                            <option value="">Select barangay</option>
                                            {availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                                        </select>
                                        {errors.home_barangay && <span className={styles.errorText}>{errors.home_barangay}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="home_street">
                                        <label className={styles.fieldLabel}>Street{REQUIRED_MARK}</label>
                                        <input className={`${styles.fieldInput} ${errors.home_street ? styles.errorBorder : ''}`} value={homeAddress.street} onChange={(e) => handleAddressChange('street', e.target.value)} />
                                        {errors.home_street && <span className={styles.errorText}>{errors.home_street}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="home_houseNumber">
                                        <label className={styles.fieldLabel}>House Number{REQUIRED_MARK}</label>
                                        <input className={`${styles.fieldInput} ${errors.home_houseNumber ? styles.errorBorder : ''}`} value={homeAddress.houseNumber} onChange={(e) => handleAddressChange('houseNumber', e.target.value)} />
                                        {errors.home_houseNumber && <span className={styles.errorText}>{errors.home_houseNumber}</span>}
                                    </div>
                                </div>
                            </PatientRegistrationSectionCard>

                            <PatientRegistrationSectionCard
                                title="Emergency Contact"
                                description="Provide the person the clinic can contact if an urgent concern comes up."
                            >
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup} data-field-key="emergencyContact_name">
                                        <label className={styles.fieldLabel}>Emergency Contact Name{REQUIRED_MARK}</label>
                                        <input className={`${styles.fieldInput} ${errors.emergencyContact_name ? styles.errorBorder : ''}`} value={emergencyContact.name} onChange={(e) => handleContactChange('emergencyContact', 'name', e.target.value)} />
                                        {errors.emergencyContact_name && <span className={styles.errorText}>{errors.emergencyContact_name}</span>}
                                    </div>
                                    <div className={styles.fieldGroup} data-field-key="emergencyContact_relationship">
                                        <label className={styles.fieldLabel}>Relationship{REQUIRED_MARK}</label>
                                        <select className={`${styles.fieldSelect} ${errors.emergencyContact_relationship ? styles.errorBorder : ''}`} value={emergencyContact.relationship} onChange={(e) => handleContactChange('emergencyContact', 'relationship', e.target.value)}>
                                            <option value="">Select relationship</option>
                                            {RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        {errors.emergencyContact_relationship && <span className={styles.errorText}>{errors.emergencyContact_relationship}</span>}
                                    </div>
                                    {emergencyContact.relationship === 'Other' && (
                                        <div className={styles.fieldGroup} data-field-key="emergencyContact_relationshipOther">
                                            <label className={styles.fieldLabel}>Relationship, If Other{REQUIRED_MARK}</label>
                                            <input className={`${styles.fieldInput} ${errors.emergencyContact_relationshipOther ? styles.errorBorder : ''}`} value={emergencyContact.relationshipOther} onChange={(e) => handleContactChange('emergencyContact', 'relationshipOther', e.target.value)} />
                                            {errors.emergencyContact_relationshipOther && <span className={styles.errorText}>{errors.emergencyContact_relationshipOther}</span>}
                                        </div>
                                    )}
                                    <div className={styles.fieldGroup} data-field-key="emergencyContact_contactNumber">
                                        <label className={styles.fieldLabel}>Mobile Number{REQUIRED_MARK}</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.emergencyContact_contactNumber ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input className={styles.phoneField} value={emergencyContact.contactNumber} onChange={(e) => handleMobileChange('emergencyContact', 'contactNumber', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                        </div>
                                        {errors.emergencyContact_contactNumber && <span className={styles.errorText}>{errors.emergencyContact_contactNumber}</span>}
                                    </div>
                                </div>
                            </PatientRegistrationSectionCard>

                            {isMinor && (
                                <PatientRegistrationSectionCard
                                    title="Guardian Details"
                                    description="Since the patient is a minor, guardian information is required before proceeding."
                                >
                                    <div className={styles.formGrid}>
                                        <div className={styles.fieldGroup} data-field-key="guardian_name">
                                            <label className={styles.fieldLabel}>Guardian Name{REQUIRED_MARK}</label>
                                            <input className={`${styles.fieldInput} ${errors.guardian_name ? styles.errorBorder : ''}`} value={guardian.name} onChange={(e) => handleContactChange('guardian', 'name', e.target.value)} />
                                            {errors.guardian_name && <span className={styles.errorText}>{errors.guardian_name}</span>}
                                        </div>
                                        <div className={styles.fieldGroup} data-field-key="guardian_occupation">
                                            <label className={styles.fieldLabel}>Occupation{REQUIRED_MARK}</label>
                                            <select className={`${styles.fieldSelect} ${errors.guardian_occupation ? styles.errorBorder : ''}`} value={guardian.occupation} onChange={(e) => handleContactChange('guardian', 'occupation', e.target.value)}>
                                                <option value="">Select occupation</option>
                                                {OCCUPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                            {errors.guardian_occupation && <span className={styles.errorText}>{errors.guardian_occupation}</span>}
                                        </div>
                                        {guardian.occupation === 'Other' && (
                                            <div className={styles.fieldGroup} data-field-key="guardian_occupationOther">
                                                <label className={styles.fieldLabel}>Occupation, If Other{REQUIRED_MARK}</label>
                                                <input className={`${styles.fieldInput} ${errors.guardian_occupationOther ? styles.errorBorder : ''}`} value={guardian.occupationOther} onChange={(e) => handleContactChange('guardian', 'occupationOther', e.target.value)} />
                                                {errors.guardian_occupationOther && <span className={styles.errorText}>{errors.guardian_occupationOther}</span>}
                                            </div>
                                        )}
                                        <div className={styles.fieldGroup} data-field-key="guardian_relationship">
                                            <label className={styles.fieldLabel}>Relationship{REQUIRED_MARK}</label>
                                            <select className={`${styles.fieldSelect} ${errors.guardian_relationship ? styles.errorBorder : ''}`} value={guardian.relationship} onChange={(e) => handleContactChange('guardian', 'relationship', e.target.value)}>
                                                <option value="">Select relationship</option>
                                                {RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                            {errors.guardian_relationship && <span className={styles.errorText}>{errors.guardian_relationship}</span>}
                                        </div>
                                        {guardian.relationship === 'Other' && (
                                            <div className={styles.fieldGroup} data-field-key="guardian_relationshipOther">
                                                <label className={styles.fieldLabel}>Relationship, If Other{REQUIRED_MARK}</label>
                                                <input className={`${styles.fieldInput} ${errors.guardian_relationshipOther ? styles.errorBorder : ''}`} value={guardian.relationshipOther} onChange={(e) => handleContactChange('guardian', 'relationshipOther', e.target.value)} />
                                                {errors.guardian_relationshipOther && <span className={styles.errorText}>{errors.guardian_relationshipOther}</span>}
                                            </div>
                                        )}
                                        <div className={styles.fieldGroup} data-field-key="guardian_contactNumber">
                                            <label className={styles.fieldLabel}>Guardian Phone{REQUIRED_MARK}</label>
                                            <div className={`${styles.phoneInputGroup} ${errors.guardian_contactNumber ? styles.errorBorder : ''}`}>
                                                <span className={styles.phonePrefix}>+63</span>
                                                <input className={styles.phoneField} value={guardian.contactNumber} onChange={(e) => handleMobileChange('guardian', 'contactNumber', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                            </div>
                                            {errors.guardian_contactNumber && <span className={styles.errorText}>{errors.guardian_contactNumber}</span>}
                                        </div>
                                    </div>
                                </PatientRegistrationSectionCard>
                            )}
                            <div className={styles.buttonRow}>
                                <button type="button" className={styles.secondaryBtn} onClick={handleStepBack}>
                                    Back to Identity
                                </button>
                                {isPhoneCallPreRegistration ? (
                                    <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Registration Details'}
                                    </button>
                                ) : (
                                    <button type="button" className={styles.primaryBtn} onClick={handleStepAdvance}>
                                        Continue to Medical & Dental
                                    </button>
                                )}
                            </div>
                            </>
                            )}

                            {!isPhoneCallPreRegistration && activeStepKey === 'medical' && (
                                <>
                                    <PatientRegistrationSectionCard
                                        eyebrow="Medical & Dental"
                                        title="Medical & Dental"
                                        description="Complete your consultation reason, dental history, physician details, and medical background."
                                    >
                                        <div className={styles.formGrid} style={{ marginBottom: '20px' }}>
                                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`} data-field-key="profile_reasonForConsultation">
                                                <label className={styles.fieldLabel}>Reason for Consultation{REQUIRED_MARK}</label>
                                                <textarea className={`${styles.fieldTextarea} ${errors.profile_reasonForConsultation ? styles.errorBorder : ''}`} value={profile.reasonForConsultation} onChange={(e) => handleProfileChange('reasonForConsultation', e.target.value)} />
                                                {errors.profile_reasonForConsultation && <span className={styles.errorText}>{errors.profile_reasonForConsultation}</span>}
                                            </div>
                                        </div>
                                        <div className={styles.intakeSection}>
                                            <h3 className={styles.sectionTitle} style={{ fontSize: '1rem' }}>Dental History</h3>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup} data-field-key="dentalHistory_lastExamDate">
                                                    <label className={styles.fieldLabel}>Last Dental Visit</label>
                                                    <input type="date" className={`${styles.fieldInput} ${errors.dentalHistory_lastExamDate ? styles.errorBorder : ''}`} value={dentalHistory.lastExamDate} onChange={(e) => handleDentalChange('lastExamDate', e.target.value)} max={getTodayDate()} />
                                                    {errors.dentalHistory_lastExamDate && <span className={styles.errorText}>{errors.dentalHistory_lastExamDate}</span>}
                                                </div>
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Reaction or complication after dental treatment?', dentalHistory.hadTreatmentReaction, (value) => handleDentalChange('hadTreatmentReaction', value), 'dentalHistory_hadTreatmentReaction', 'dentalHistory_hadTreatmentReaction')}
                                                <div className={styles.fieldGroup} data-field-key="dentalHistory_reactionDetails">
                                                    <label className={styles.fieldLabel}>If Yes, Please Detail</label>
                                                    <textarea className={`${styles.fieldTextarea} ${errors.dentalHistory_reactionDetails ? styles.errorBorder : ''}`} value={dentalHistory.reactionDetails} onChange={(e) => handleDentalChange('reactionDetails', e.target.value)} />
                                                    {errors.dentalHistory_reactionDetails && <span className={styles.errorText}>{errors.dentalHistory_reactionDetails}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Private or confidential information to discuss in private?', dentalHistory.hasConfidentialInfo, (value) => handleDentalChange('hasConfidentialInfo', value), 'dentalHistory_hasConfidentialInfo', 'dentalHistory_hasConfidentialInfo')}
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Additional Dental Notes</label>
                                                    <textarea className={styles.fieldTextarea} value={dentalHistory.notes} onChange={(e) => handleDentalChange('notes', e.target.value)} />
                                                </div>
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                        </div>

                                        <div className={styles.intakeDivider} />

                                        <div className={styles.intakeSection}>
                                            <h3 className={styles.sectionTitle} style={{ fontSize: '1rem' }}>Attending Physician</h3>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Physician Name</label>
                                                    <input className={styles.fieldInput} value={physician.name} onChange={(e) => handleContactChange('physician', 'name', e.target.value)} />
                                                </div>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Specialty, If Applicable</label>
                                                    <select className={styles.fieldSelect} value={physician.specialty} onChange={(e) => handleContactChange('physician', 'specialty', e.target.value)}>
                                                        <option value="">Select specialty</option>
                                                        {PHYSICIAN_SPECIALTY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {physician.specialty === 'Other' && (
                                                <div className={styles.intakeRow}>
                                                    <div className={styles.fieldGroup} data-field-key="physician_specialtyOther">
                                                        <label className={styles.fieldLabel}>Specialty, If Other{REQUIRED_MARK}</label>
                                                        <input className={`${styles.fieldInput} ${errors.physician_specialtyOther ? styles.errorBorder : ''}`} value={physician.specialtyOther} onChange={(e) => handleContactChange('physician', 'specialtyOther', e.target.value)} />
                                                        {errors.physician_specialtyOther && <span className={styles.errorText}>{errors.physician_specialtyOther}</span>}
                                                    </div>
                                                    <div className={styles.intakeSpacer} />
                                                </div>
                                            )}
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Office Address</label>
                                                    <input className={styles.fieldInput} value={physician.officeAddress} onChange={(e) => handleContactChange('physician', 'officeAddress', e.target.value)} />
                                                </div>
                                                <div className={styles.fieldGroup} data-field-key="physician_officeNumber">
                                                    <label className={styles.fieldLabel}>Office Number</label>
                                                    <div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}>
                                                        <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                                        <input className={styles.phoneField} value={physician.officeNumber} onChange={(e) => handlePhysicianLandlineChange(e.target.value)} maxLength={8} placeholder="1234567" />
                                                    </div>
                                                    {errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.intakeDivider} />

                                        <div className={styles.intakeSection}>
                                            <h3 className={styles.sectionTitle} style={{ fontSize: '1rem' }}>Medical History</h3>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Are you in good health?', medicalHistory.inGoodHealth, (value) => handleMedicalChange('inGoodHealth', value), 'medicalHistory_inGoodHealth', 'medicalHistory_inGoodHealth')}
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Are you under medical treatment now?', medicalHistory.underMedicalTreatment, (value) => handleMedicalChange('underMedicalTreatment', value), 'medicalHistory_underMedicalTreatment', 'medicalHistory_underMedicalTreatment')}
                                                <div className={styles.fieldGroup} data-field-key="medicalHistory_medicalTreatmentDetails">
                                                    <label className={styles.fieldLabel}>If So, What Is the Condition Treated?</label>
                                                    <input className={`${styles.fieldInput} ${errors.medicalHistory_medicalTreatmentDetails ? styles.errorBorder : ''}`} value={medicalHistory.medicalTreatmentDetails} onChange={(e) => handleMedicalChange('medicalTreatmentDetails', e.target.value)} />
                                                    {errors.medicalHistory_medicalTreatmentDetails && <span className={styles.errorText}>{errors.medicalHistory_medicalTreatmentDetails}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Have you ever had serious illness or surgical operation?', medicalHistory.hadSeriousIllnessOrSurgery, (value) => handleMedicalChange('hadSeriousIllnessOrSurgery', value), 'medicalHistory_hadSeriousIllnessOrSurgery', 'medicalHistory_hadSeriousIllnessOrSurgery')}
                                                <div className={styles.fieldGroup} data-field-key="medicalHistory_seriousIllnessOrSurgeryDetails">
                                                    <label className={styles.fieldLabel}>If So, What Is the Illness or Operation?</label>
                                                    <input className={`${styles.fieldInput} ${errors.medicalHistory_seriousIllnessOrSurgeryDetails ? styles.errorBorder : ''}`} value={medicalHistory.seriousIllnessOrSurgeryDetails} onChange={(e) => handleMedicalChange('seriousIllnessOrSurgeryDetails', e.target.value)} />
                                                    {errors.medicalHistory_seriousIllnessOrSurgeryDetails && <span className={styles.errorText}>{errors.medicalHistory_seriousIllnessOrSurgeryDetails}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Have you ever been hospitalized?', medicalHistory.hadHospitalization, (value) => handleMedicalChange('hadHospitalization', value), 'medicalHistory_hadHospitalization', 'medicalHistory_hadHospitalization')}
                                                <div className={styles.fieldGroup} data-field-key="medicalHistory_hospitalizationDetails">
                                                    <label className={styles.fieldLabel}>If So, When and Why?</label>
                                                    <input className={`${styles.fieldInput} ${errors.medicalHistory_hospitalizationDetails ? styles.errorBorder : ''}`} value={medicalHistory.hospitalizationDetails} onChange={(e) => handleMedicalChange('hospitalizationDetails', e.target.value)} />
                                                    {errors.medicalHistory_hospitalizationDetails && <span className={styles.errorText}>{errors.medicalHistory_hospitalizationDetails}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Are you taking any prescription/non-prescription medication?', medicalHistory.isTakingMedication, (value) => handleMedicalChange('isTakingMedication', value), 'medicalHistory_isTakingMedication', 'medicalHistory_isTakingMedication')}
                                                <div className={styles.fieldGroup} data-field-key="medicalHistory_medications">
                                                    <label className={styles.fieldLabel}>If So, Please Specify</label>
                                                    <input className={`${styles.fieldInput} ${errors.medicalHistory_medications ? styles.errorBorder : ''}`} value={medicalHistory.medications} onChange={(e) => handleMedicalChange('medications', e.target.value)} placeholder="Comma-separated values" />
                                                    {errors.medicalHistory_medications && <span className={styles.errorText}>{errors.medicalHistory_medications}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Do you use tobacco products?', medicalHistory.usesTobacco, (value) => handleMedicalChange('usesTobacco', value), 'medicalHistory_usesTobacco', 'medicalHistory_usesTobacco')}
                                                {renderYesNoField('Do you use alcohol, cocaine, or other dangerous drugs?', medicalHistory.usesAlcoholOrDrugs, (value) => handleMedicalChange('usesAlcoholOrDrugs', value), 'medicalHistory_usesAlcoholOrDrugs', 'medicalHistory_usesAlcoholOrDrugs')}
                                            </div>
                                            <div className={styles.intakeRow}>
                                                {renderYesNoField('Are you allergic to any of the following?', medicalHistory.hasAllergies, (value) => handleMedicalChange('hasAllergies', value), 'medicalHistory_hasAllergies', 'medicalHistory_hasAllergies')}
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            <div className={styles.intakeRowSingle}>
                                                <div className={styles.fieldGroup} data-field-key="medicalHistory_allergies">
                                                    <label className={styles.fieldLabel}>Allergies</label>
                                                    <div className={styles.checkboxGrid}>
                                                        {ALLERGY_OPTIONS.map((option) => (
                                                            <label key={option} className={styles.checkboxCard}>
                                                                <input type="checkbox" checked={medicalHistory.allergies.includes(option)} onChange={() => handleMedicalArrayToggle('allergies', option)} />
                                                                <span>{option}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <input className={`${styles.fieldInput} ${errors.medicalHistory_allergies ? styles.errorBorder : ''}`} value={medicalHistory.allergyOther} onChange={(e) => handleMedicalChange('allergyOther', e.target.value)} placeholder="Other allergy" />
                                                    {errors.medicalHistory_allergies && <span className={styles.errorText}>{errors.medicalHistory_allergies}</span>}
                                                </div>
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Bleeding Time</label>
                                                    <input className={styles.fieldInput} value={medicalHistory.bleedingTime} onChange={(e) => handleMedicalChange('bleedingTime', e.target.value)} />
                                                </div>
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                            {isFemalePatient && (
                                                <>
                                                    <div className={styles.intakeRow}>
                                                        {renderYesNoField('Are you pregnant?', medicalHistory.isPregnant, (value) => handleMedicalChange('isPregnant', value), 'medicalHistory_isPregnant', 'medicalHistory_isPregnant')}
                                                        {renderYesNoField('Are you nursing?', medicalHistory.isNursing, (value) => handleMedicalChange('isNursing', value), 'medicalHistory_isNursing', 'medicalHistory_isNursing')}
                                                    </div>
                                                    <div className={styles.intakeRow}>
                                                        {renderYesNoField('Are you taking birth control pills?', medicalHistory.takingBirthControl, (value) => handleMedicalChange('takingBirthControl', value), 'medicalHistory_takingBirthControl', 'medicalHistory_takingBirthControl')}
                                                        <div className={styles.intakeSpacer} />
                                                    </div>
                                                </>
                                            )}
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Blood Type</label>
                                                    <select className={styles.fieldSelect} value={profile.bloodType} onChange={(e) => handleProfileChange('bloodType', e.target.value)}>
                                                        <option value="">Select blood type</option>
                                                        {BLOOD_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                                    </select>
                                                </div>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Blood Pressure</label>
                                                    <input className={styles.fieldInput} value={medicalHistory.bloodPressure} onChange={(e) => handleMedicalChange('bloodPressure', e.target.value)} placeholder="e.g. 120/80" />
                                                </div>
                                            </div>
                                            <div className={styles.intakeRowSingle}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Medical Conditions</label>
                                                    <div className={styles.checkboxGrid}>
                                                        {MEDICAL_CONDITION_OPTIONS.map((option) => (
                                                            <label key={option} className={styles.checkboxCard}>
                                                                <input type="checkbox" checked={medicalHistory.conditions.includes(option)} onChange={() => handleMedicalArrayToggle('conditions', option)} />
                                                                <span>{option}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <input className={styles.fieldInput} style={{ marginTop: '12px' }} value={medicalHistory.conditionOther} onChange={(e) => handleMedicalChange('conditionOther', e.target.value)} placeholder="Other condition" />
                                                </div>
                                            </div>
                                            <div className={styles.intakeRow}>
                                                <div className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>Medical Notes</label>
                                                    <textarea className={styles.fieldTextarea} value={medicalHistory.notes} onChange={(e) => handleMedicalChange('notes', e.target.value)} />
                                                </div>
                                                <div className={styles.intakeSpacer} />
                                            </div>
                                        </div>
                                    </PatientRegistrationSectionCard>

                                    <PatientRegistrationSectionCard
                                        title="Physician Information"
                                        description="If applicable, add the patient's attending physician details."
                                    >
                                        <div className={styles.formGrid}>
                                            <div className={styles.fieldGroup}>
                                                <label className={styles.fieldLabel}>Physician Name</label>
                                                <input className={styles.fieldInput} value={physician.name} onChange={(e) => handleContactChange('physician', 'name', e.target.value)} />
                                            </div>
                                            <div className={styles.fieldGroup}>
                                                <label className={styles.fieldLabel}>Specialty, If Applicable</label>
                                                <select className={styles.fieldSelect} value={physician.specialty} onChange={(e) => handleContactChange('physician', 'specialty', e.target.value)}>
                                                    <option value="">Select specialty</option>
                                                    {PHYSICIAN_SPECIALTY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                                </select>
                                            </div>
                                            {physician.specialty === 'Other' && (
                                                <div className={styles.fieldGroup} data-field-key="physician_specialtyOther">
                                                    <label className={styles.fieldLabel}>Specialty, If Other{REQUIRED_MARK}</label>
                                                    <input className={`${styles.fieldInput} ${errors.physician_specialtyOther ? styles.errorBorder : ''}`} value={physician.specialtyOther} onChange={(e) => handleContactChange('physician', 'specialtyOther', e.target.value)} />
                                                    {errors.physician_specialtyOther && <span className={styles.errorText}>{errors.physician_specialtyOther}</span>}
                                                </div>
                                            )}
                                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                                <label className={styles.fieldLabel}>Office Address</label>
                                                <input className={styles.fieldInput} value={physician.officeAddress} onChange={(e) => handleContactChange('physician', 'officeAddress', e.target.value)} />
                                            </div>
                                            <div className={styles.fieldGroup} data-field-key="physician_officeNumber">
                                                <label className={styles.fieldLabel}>Office Number</label>
                                                <div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}>
                                                    <span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span>
                                                    <input className={styles.phoneField} value={physician.officeNumber} onChange={(e) => handlePhysicianLandlineChange(e.target.value)} maxLength={8} placeholder="1234567" />
                                                </div>
                                                {errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}
                                            </div>
                                        </div>
                                    </PatientRegistrationSectionCard>
                                    <div className={styles.buttonRow}>
                                        <button type="button" className={styles.secondaryBtn} onClick={handleStepBack}>
                                            Back to Contacts
                                        </button>
                                        <button type="button" className={styles.primaryBtn} onClick={handleStepAdvance}>
                                            Continue to Consent & Review
                                        </button>
                                    </div>
                                </>
                            )}

                            {!isPhoneCallPreRegistration && activeStepKey === 'consent' && (
                                <>
                                    <PatientRegistrationSectionCard
                                        eyebrow="Consent & Review"
                                        title="Consent & Review"
                                        description="Review the consent details carefully before submitting your pre-registration."
                                    >
                                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem' }}>Data Privacy Act</h3>
                                        <p className={styles.bodyText} style={{ marginTop: 0, fontSize: '0.95rem' }}>
                                            I authorize Dentime to collect, store, and process the patient&apos;s personal and health information for appointment handling, treatment documentation, follow-up care, and clinic operations in compliance with the Data Privacy Act of 2012.
                                        </p>
                                        <div className={styles.formGrid}>
                                            <div className={styles.fieldGroup} data-field-key="dataPrivacyConsent_signerName">
                                                <label className={styles.fieldLabel}>Signer Name{REQUIRED_MARK}</label>
                                                <input className={`${styles.fieldInput} ${errors.dataPrivacyConsent_signerName ? styles.errorBorder : ''}`} value={dataPrivacyConsent.signerName} onChange={(e) => handleConsentChange('privacy', 'signerName', e.target.value)} />
                                                {errors.dataPrivacyConsent_signerName && <span className={styles.errorText}>{errors.dataPrivacyConsent_signerName}</span>}
                                            </div>
                                            <div className={styles.fieldGroup}>
                                                <label className={styles.fieldLabel}>Signer Role{REQUIRED_MARK}</label>
                                                <select className={styles.fieldSelect} value={dataPrivacyConsent.signerRole} onChange={(e) => handleConsentChange('privacy', 'signerRole', e.target.value)}>
                                                    <option value="Patient">Patient</option>
                                                    <option value="Parent">Parent</option>
                                                    <option value="Guardian">Guardian</option>
                                                </select>
                                            </div>
                                            <div className={styles.fieldGroup} data-field-key="dataPrivacyConsent_signedAt">
                                                <label className={styles.fieldLabel}>Date Signed{REQUIRED_MARK}</label>
                                                <input type="date" className={`${styles.fieldInput} ${errors.dataPrivacyConsent_signedAt ? styles.errorBorder : ''}`} value={dataPrivacyConsent.signedAt} onChange={(e) => handleConsentChange('privacy', 'signedAt', e.target.value)} max={getTodayDate()} />
                                                {errors.dataPrivacyConsent_signedAt && <span className={styles.errorText}>{errors.dataPrivacyConsent_signedAt}</span>}
                                            </div>
                                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`} data-field-key="dataPrivacyConsent_acknowledged">
                                                <label className={styles.fieldLabel}>Data Privacy Acknowledgement{REQUIRED_MARK}</label>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryBtn}
                                                    onClick={() => {
                                                        if (dataPrivacyConsent.acknowledged) {
                                                            handleConsentChange('privacy', 'acknowledged', false);
                                                        } else {
                                                            setIsPrivacyModalOpen(true);
                                                        }
                                                    }}
                                                    style={{ justifySelf: 'start' }}
                                                >
                                                    {dataPrivacyConsent.acknowledged ? 'Undo Privacy Acknowledgement' : 'Review Data Privacy Notice'}
                                                </button>
                                                <p className={styles.helperText} style={{ marginTop: '10px', color: dataPrivacyConsent.acknowledged ? '#166534' : undefined }}>
                                                    {dataPrivacyConsent.acknowledged ? 'Data privacy consent acknowledged.' : 'Please review the full data privacy notice before submitting.'}
                                                </p>
                                                {errors.dataPrivacyConsent_acknowledged && <span className={styles.errorText}>{errors.dataPrivacyConsent_acknowledged}</span>}
                                            </div>
                                        </div>
                                    </PatientRegistrationSectionCard>

                                    <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem' }}>Digital Consent</h3>
                                        <p className={styles.bodyText} style={{ marginTop: 0, fontSize: '0.95rem' }}>
                                            I confirm that the patient or authorized representative has reviewed the intake information, understands that treatment outcomes cannot be guaranteed, and accepts responsibility for the patient&apos;s dental treatment charges.
                                        </p>
                                        <div className={styles.formGrid}>
                                            <div className={styles.fieldGroup} data-field-key="consentAcknowledgement_signerName">
                                                <label className={styles.fieldLabel}>Signer Name{REQUIRED_MARK}</label>
                                                <input className={`${styles.fieldInput} ${errors.consentAcknowledgement_signerName ? styles.errorBorder : ''}`} value={consentAcknowledgement.signerName} onChange={(e) => handleConsentChange('consent', 'signerName', e.target.value)} />
                                                {errors.consentAcknowledgement_signerName && <span className={styles.errorText}>{errors.consentAcknowledgement_signerName}</span>}
                                            </div>
                                            <div className={styles.fieldGroup}>
                                                <label className={styles.fieldLabel}>Signer Role{REQUIRED_MARK}</label>
                                                <select className={styles.fieldSelect} value={consentAcknowledgement.signerRole} onChange={(e) => handleConsentChange('consent', 'signerRole', e.target.value)}>
                                                    <option value="Patient">Patient</option>
                                                    <option value="Parent">Parent</option>
                                                    <option value="Guardian">Guardian</option>
                                                </select>
                                            </div>
                                            <div className={styles.fieldGroup} data-field-key="consentAcknowledgement_signedAt">
                                                <label className={styles.fieldLabel}>Date Signed{REQUIRED_MARK}</label>
                                                <input type="date" className={`${styles.fieldInput} ${errors.consentAcknowledgement_signedAt ? styles.errorBorder : ''}`} value={consentAcknowledgement.signedAt} onChange={(e) => handleConsentChange('consent', 'signedAt', e.target.value)} max={getTodayDate()} />
                                                {errors.consentAcknowledgement_signedAt && <span className={styles.errorText}>{errors.consentAcknowledgement_signedAt}</span>}
                                            </div>
                                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`} data-field-key="consentAcknowledgement_acknowledged">
                                                <label className={styles.fieldLabel}>Consent Review Acknowledgement{REQUIRED_MARK}</label>
                                                <button type="button" className={styles.secondaryBtn} onClick={() => setIsConsentModalOpen(true)} style={{ justifySelf: 'start' }}>
                                                    {consentAcknowledgement.acknowledged ? 'Review Consent Again' : 'View Full Consent Form'}
                                                </button>
                                                <p className={styles.helperText} style={{ marginTop: '10px', color: consentAcknowledgement.acknowledged ? '#166534' : undefined }}>
                                                    {consentAcknowledgement.acknowledged ? 'Consent reviewed and acknowledged.' : 'Please review the full consent form before submitting.'}
                                                </p>
                                                {errors.consentAcknowledgement_acknowledged && <span className={styles.errorText}>{errors.consentAcknowledgement_acknowledged}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.buttonRow}>
                                        <button type="button" className={styles.secondaryBtn} onClick={handleStepBack}>
                                            Back to Medical & Dental
                                        </button>
                                        <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                                            {isSubmitting ? 'Saving...' : 'Save Registration Details'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    )}

                    {(state === 'invalid' || state === 'used') && (
                        <div className={state === 'used' ? styles.successBanner : styles.errorBanner}>{message}</div>
                    )}
                </div>
            </section>

            {state === 'success' && (
                <div className={styles.bookingSuccessOverlay}>
                    <div className={styles.bookingSuccessModal}>
                        <p className={styles.eyebrow} style={{ margin: 0 }}>Pre-Registration</p>
                        <h2 className={styles.sectionTitle} style={{ fontSize: '2rem' }}>Registration completed</h2>
                        <p className={styles.bodyText} style={{ marginTop: 0 }}>
                            Thank you! Your registration details have been completed. Please check your email for the activation link sent by the clinic, then open it and set up your password.
                        </p>
                        <div className={styles.bookingSuccessActions}>
                            <button type="button" className={styles.primaryBtn} onClick={() => navigate('/')}>
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConsentReviewModal
                isOpen={isConsentModalOpen}
                onClose={() => setIsConsentModalOpen(false)}
                onConfirm={() => handleConsentChange('consent', 'acknowledged', true)}
                initiallyAcknowledged={consentAcknowledgement.acknowledged}
            />
            <ConsentReviewModal
                isOpen={isPrivacyModalOpen}
                onClose={() => setIsPrivacyModalOpen(false)}
                onConfirm={() => handleConsentChange('privacy', 'acknowledged', true)}
                initiallyAcknowledged={dataPrivacyConsent.acknowledged}
                title="Data Privacy Consent Review"
                subtitle="Please review the full data privacy notice. The acknowledgement checkbox will only be enabled after scrolling through the entire notice."
                reviewGroups={dataPrivacyReviewGroups}
                acknowledgementLabel="I acknowledge that the patient or authorized representative has reviewed the full data privacy notice."
                confirmLabel="Save Privacy Acknowledgement"
            />
        </WebsiteShell>
    );
}
