import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../styles/admin/AddPatient.module.css';
import { regions, provinces, cities, barangays, normalizeStoredAddressToCodes } from '../../utils/addressData';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import ConsentReviewModal from '../../components/admin/ConsentReviewModal';
import { privacyPolicySections, privacyPolicyUpdatedAt, privacyPolicyVersion } from '../../data/consentDocument';
import {
    ALLERGY_OPTIONS,
    MEDICAL_CONDITION_OPTIONS,
    NATIONALITY_OPTIONS,
    RELIGION_OPTIONS,
    PHYSICIAN_SPECIALTY_OPTIONS,
    RELATIONSHIP_OPTIONS,
    LANDLINE_PREFIX,
    isAllowedPersonNameInput,
    isValidLandlineNumber,
    isValidMobileNumber,
    stripLandlinePrefix,
    stripMobilePrefix,
    toTitleCaseName,
    toLandlinePayload,
    toMobilePayload,
    getSelectValueWithOther,
    getOtherTextValue,
} from '../../utils/patientIntake';
import {
    getTodayDateInManila,
    isFutureDateInManila,
    normalizeDateInputValue,
} from '../../utils/dateUtils';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };
const initialEmergencyContact = { name: '', relationship: '', contactNumber: '' };
const initialGuardian = { name: '', relationship: '', contactNumber: '', occupation: '' };
const initialPhysician = { name: '', specialty: '', specialtyOther: '', officeAddress: '', officeNumber: '' };
const initialMedicalHistory = {
    allergies: [],
    allergyOther: '',
    conditions: [],
    conditionOther: '',
    medications: '',
    notes: '',
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
};
const initialDentalHistory = {
    lastExamDate: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    hasConfidentialInfo: '',
};

const boolToSelect = (value) => value === true ? 'yes' : value === false ? 'no' : '';
const selectToBool = (value) => value === 'yes' ? true : value === 'no' ? false : undefined;
const formatDateInputValue = (value) => normalizeDateInputValue(value);

const getTodayDate = () => getTodayDateInManila();
const dataPrivacyReviewGroups = [
    { heading: `Data Privacy Notice ${privacyPolicyVersion} - Updated ${privacyPolicyUpdatedAt}`, sections: privacyPolicySections },
];

export default function EditPatient({ patientId, onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const [profileImage, setProfileImage] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [errors, setErrors] = useState({});
    const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [initialData, setInitialData] = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);

    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        birthdate: '',
        gender: '',
        email: '',
        phone: '',
        assignedBranch: '',
        nationality: 'Filipino',
        religion: '',
        religionOther: '',
        homePhone: '',
        occupation: '',
        civilStatus: '',
        bloodType: '',
        workPhone: '',
        referredBy: '',
        reasonForConsultation: '',
        homeAddress: { ...initialAddressState },
        emergencyContact: { ...initialEmergencyContact },
        guardian: { ...initialGuardian },
        physician: { ...initialPhysician },
        medicalHistory: { ...initialMedicalHistory },
        dentalHistory: { ...initialDentalHistory },
        consentAcknowledgement: { acknowledged: false, signerName: '', signerRole: 'Patient', signedAt: getTodayDate() },
        dataPrivacyConsent: { acknowledged: false, signerName: '', signerRole: 'Patient', signedAt: getTodayDate() },
    });

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
    };

    const getAge = (dateValue) => {
        const today = new Date();
        const birth = new Date(dateValue);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDelta = today.getMonth() - birth.getMonth();
        if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const getMaxDate = () => getTodayDate();
    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;

    useEffect(() => {
        const fetchPatientData = async () => {
            try {
                const response = await authFetch(`/patients/${patientId}`);
                if (!response.ok) {
                    alert('Failed to load patient data.');
                    onClose();
                    return;
                }

                const data = await response.json();
                const homeAddress = {
                    ...initialAddressState,
                    ...normalizeStoredAddressToCodes(data.homeAddress || data.currentAddress || data.permanentAddress || {}),
                };
                const mapped = {
                    firstName: data.name?.first || '',
                    middleName: data.name?.middle || '',
                    lastName: data.name?.last || '',
                    birthdate: data.birthdate ? formatDateInputValue(data.birthdate) : '',
                    gender: data.gender || '',
                    email: data.email || '',
                    phone: stripMobilePrefix(data.contactNumber || ''),
                    assignedBranch: data.assignedBranch || data.assignedBranches?.[0] || '',
                    nationality: data.nationality || 'Filipino',
                    religion: getSelectValueWithOther(data.religion || '', RELIGION_OPTIONS),
                    religionOther: getOtherTextValue(data.religion || '', RELIGION_OPTIONS),
                    homePhone: stripLandlinePrefix(data.homePhone || ''),
                    occupation: data.occupation || '',
                    civilStatus: data.civilStatus || '',
                    bloodType: data.bloodType || '',
                    workPhone: stripLandlinePrefix(data.workPhone || ''),
                    referredBy: data.referredBy || '',
                    reasonForConsultation: data.reasonForConsultation || data.dentalHistory?.chiefComplaint || '',
                    homeAddress,
                    emergencyContact: {
                        name: data.emergencyContact?.name || '',
                        relationship: data.emergencyContact?.relationship || '',
                        contactNumber: stripMobilePrefix(data.emergencyContact?.contactNumber || ''),
                    },
                    guardian: {
                        name: data.guardian?.name || '',
                        relationship: data.guardian?.relationship || '',
                        contactNumber: stripMobilePrefix(data.guardian?.contactNumber || ''),
                        occupation: data.guardian?.occupation || '',
                    },
                    physician: {
                        name: data.physician?.name || '',
                        specialty: getSelectValueWithOther(data.physician?.specialty || '', PHYSICIAN_SPECIALTY_OPTIONS),
                        specialtyOther: getOtherTextValue(data.physician?.specialty || '', PHYSICIAN_SPECIALTY_OPTIONS),
                        officeAddress: data.physician?.officeAddress || '',
                        officeNumber: stripLandlinePrefix(data.physician?.officeNumber || ''),
                    },
                    medicalHistory: {
                        allergies: Array.isArray(data.medicalHistory?.allergies) ? data.medicalHistory.allergies.filter((entry) => ALLERGY_OPTIONS.includes(entry)) : [],
                        allergyOther: Array.isArray(data.medicalHistory?.allergies) ? data.medicalHistory.allergies.filter((entry) => !ALLERGY_OPTIONS.includes(entry)).join(', ') : '',
                        conditions: Array.isArray(data.medicalHistory?.conditions) ? data.medicalHistory.conditions.filter((entry) => MEDICAL_CONDITION_OPTIONS.includes(entry)) : [],
                        conditionOther: Array.isArray(data.medicalHistory?.conditions) ? data.medicalHistory.conditions.filter((entry) => !MEDICAL_CONDITION_OPTIONS.includes(entry)).join(', ') : '',
                        medications: Array.isArray(data.medicalHistory?.medications) ? data.medicalHistory.medications.join(', ') : '',
                        notes: data.medicalHistory?.notes || '',
                        inGoodHealth: boolToSelect(data.medicalHistory?.inGoodHealth),
                        underMedicalTreatment: boolToSelect(data.medicalHistory?.underMedicalTreatment),
                        medicalTreatmentDetails: data.medicalHistory?.medicalTreatmentDetails || '',
                        hadSeriousIllnessOrSurgery: boolToSelect(data.medicalHistory?.hadSeriousIllnessOrSurgery),
                        seriousIllnessOrSurgeryDetails: data.medicalHistory?.seriousIllnessOrSurgeryDetails || '',
                        hadHospitalization: boolToSelect(data.medicalHistory?.hadHospitalization),
                        hospitalizationDetails: data.medicalHistory?.hospitalizationDetails || '',
                        isTakingMedication: boolToSelect(data.medicalHistory?.isTakingMedication),
                        hasAllergies: boolToSelect(data.medicalHistory?.hasAllergies),
                        usesTobacco: boolToSelect(data.medicalHistory?.usesTobacco),
                        usesAlcoholOrDrugs: boolToSelect(data.medicalHistory?.usesAlcoholOrDrugs),
                        bleedingTime: data.medicalHistory?.bleedingTime || '',
                        bloodPressure: data.medicalHistory?.bloodPressure || '',
                        isPregnant: boolToSelect(data.medicalHistory?.isPregnant),
                        isNursing: boolToSelect(data.medicalHistory?.isNursing),
                        takingBirthControl: boolToSelect(data.medicalHistory?.takingBirthControl),
                    },
                    dentalHistory: {
                        lastExamDate: data.dentalHistory?.lastExamDate ? formatDateInputValue(data.dentalHistory.lastExamDate) : '',
                        hadTreatmentReaction: boolToSelect(data.dentalHistory?.hadTreatmentReaction),
                        reactionDetails: data.dentalHistory?.reactionDetails || '',
                        hasConfidentialInfo: boolToSelect(data.dentalHistory?.hasConfidentialInfo),
                    },
                    consentAcknowledgement: {
                        acknowledged: Boolean(data.consentAcknowledgement?.acknowledged),
                        signerName: data.consentAcknowledgement?.signerName || '',
                        signerRole: data.consentAcknowledgement?.signerRole || 'Patient',
                        signedAt: data.consentAcknowledgement?.signedAt ? formatDateInputValue(data.consentAcknowledgement.signedAt) : getTodayDate(),
                    },
                    dataPrivacyConsent: {
                        acknowledged: Boolean(data.dataPrivacyConsent?.acknowledged),
                        signerName: data.dataPrivacyConsent?.signerName || '',
                        signerRole: data.dataPrivacyConsent?.signerRole || 'Patient',
                        signedAt: data.dataPrivacyConsent?.signedAt ? formatDateInputValue(data.dataPrivacyConsent.signedAt) : getTodayDate(),
                    },
                };

                setFormData(mapped);
                setInitialData(mapped);
                setProfileImage(data.profileImage || null);
                setInitialProfileImage(data.profileImage || null);
            } catch (error) {
                console.error('Error fetching patient:', error);
                alert('Cannot connect to server.');
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (patientId) fetchPatientData();
    }, [patientId, onClose]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const response = await authFetch('/branches');
                if (response.ok) {
                    const data = await response.json();
                    setBranchOptions(data.map((branch) => branch.name));
                }
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        if (hasTriedSubmit && !isLoading) {
            validateForm({ scrollToError: false });
        }
    }, [formData, hasTriedSubmit, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const hasChanges = useMemo(
        () => (initialData ? JSON.stringify(formData) !== JSON.stringify(initialData) : false) || profileImage !== initialProfileImage,
        [formData, initialData, initialProfileImage, profileImage]
    );

    const clearError = (key) => {
        if (!errors[key]) return;
        setErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        clearError(name);
        if (['firstName', 'middleName', 'lastName'].includes(name)) {
            if (isAllowedPersonNameInput(value)) {
                setFormData((prev) => ({ ...prev, [name]: toTitleCaseName(value) }));
            }
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (name) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        clearError(name);
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleLandlineChange = (name) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        clearError(name);
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleNestedChange = (section, field, value, formatter) => {
        clearError(`${section}_${field}`);
        setFormData((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: formatter ? formatter(value) : value,
            },
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
        clearError('consentAcknowledgement_acknowledged');
    };

    const handlePrivacyAcknowledged = (acknowledged) => {
        setFormData((prev) => ({
            ...prev,
            dataPrivacyConsent: {
                ...prev.dataPrivacyConsent,
                acknowledged,
            }
        }));
        clearError('dataPrivacyConsent_acknowledged');
    };

    const handleNestedPhoneChange = (section, field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        clearError(`${section}_${field}`);
        setFormData((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const handleNestedLandlineChange = (section, field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 8) return;
        clearError(`${section}_${field}`);
        setFormData((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
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
                },
            };
        });
    };

    const handleAddressChange = (field, value) => {
        clearError(`home_${field}`);
        setFormData((prev) => {
            const updated = { ...prev.homeAddress, [field]: value };
            if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city') { updated.barangay = ''; }
            return { ...prev, homeAddress: updated };
        });
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = '';
        if (name === 'email') {
            if (!value) newError = 'Required';
            else if (!validateEmail(value)) newError = 'Enter a valid email address.';
        } else if (name === 'phone' && value && !isValidMobileNumber(value)) {
            newError = 'Invalid format (9xxxxxxxxx)';
        } else if (['homePhone', 'workPhone'].includes(name) && value && !isValidLandlineNumber(value)) {
            newError = 'Invalid landline format';
        }
        setErrors((prev) => ({ ...prev, [name]: newError }));
    };

    const validateForm = ({ scrollToError = true } = {}) => {
        const nextErrors = {};
        let isValid = true;
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

        ['firstName', 'lastName', 'birthdate', 'gender', 'email'].forEach((field) => {
            if (!formData[field]) {
                nextErrors[field] = 'Required';
                isValid = false;
            }
        });

        if (!formData.phone) {
            nextErrors.phone = 'Required';
            isValid = false;
        } else if (formData.phone.length !== 10 || formData.phone[0] !== '9') {
            nextErrors.phone = 'Invalid format';
            isValid = false;
        }

        if (formData.email && !validateEmail(formData.email)) {
            nextErrors.email = 'Invalid email address.';
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

        const validateAddr = (address, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
                if (!address[field]) {
                    nextErrors[`${prefix}_${field}`] = 'Required';
                    isValid = false;
                }
            });
        };
        validateAddr(formData.homeAddress, 'home');

        if (!formData.emergencyContact.name?.trim()) {
            nextErrors.emergencyContact_name = 'Required';
            isValid = false;
        }
        if (!formData.emergencyContact.relationship?.trim()) {
            nextErrors.emergencyContact_relationship = 'Required';
            isValid = false;
        }
        if (!formData.emergencyContact.contactNumber) {
            nextErrors.emergencyContact_contactNumber = 'Required';
            isValid = false;
        } else if (!isValidMobileNumber(formData.emergencyContact.contactNumber)) {
            nextErrors.emergencyContact_contactNumber = 'Invalid format';
            isValid = false;
        }

        if (isMinor) {
            ['name', 'relationship', 'occupation'].forEach((field) => {
                if (!formData.guardian[field]) {
                    nextErrors[`guardian_${field}`] = 'Required';
                    isValid = false;
                }
            });
            if (!formData.guardian.contactNumber) {
                nextErrors.guardian_contactNumber = 'Required';
                isValid = false;
            } else if (!isValidMobileNumber(formData.guardian.contactNumber)) {
                nextErrors.guardian_contactNumber = 'Invalid format';
                isValid = false;
            }
        }

        if (formData.physician.officeNumber && !isValidLandlineNumber(formData.physician.officeNumber)) {
            nextErrors.physician_officeNumber = 'Invalid landline format';
            isValid = false;
        }
        if (formData.religion === 'Other' && !formData.religionOther.trim()) {
            nextErrors.religionOther = 'Required';
            isValid = false;
        }
        if (formData.physician.specialty === 'Other' && !formData.physician.specialtyOther.trim()) {
            nextErrors.physician_specialtyOther = 'Required';
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
        if (formData.birthdate && isFutureDateInManila(formData.birthdate)) {
            nextErrors.birthdate = 'Birthdate cannot be in the future';
            isValid = false;
        }
        if (formData.dentalHistory.lastExamDate && isFutureDateInManila(formData.dentalHistory.lastExamDate)) {
            nextErrors.dentalHistory_lastExamDate = 'Last dental visit cannot be in the future';
            isValid = false;
        }
        if (formData.consentAcknowledgement.signedAt && isFutureDateInManila(formData.consentAcknowledgement.signedAt)) {
            nextErrors.consentAcknowledgement_signedAt = 'Invalid signed date';
            isValid = false;
        }
        if (formData.dataPrivacyConsent.signedAt && isFutureDateInManila(formData.dataPrivacyConsent.signedAt)) {
            nextErrors.dataPrivacyConsent_signedAt = 'Invalid signed date';
            isValid = false;
        }
        requiredYesNoFields.forEach(([section, field]) => {
            if (!formData[section][field]) {
                nextErrors[`${section}_${field}`] = 'Required';
                isValid = false;
            }
        });

        setErrors(nextErrors);
        if (!isValid && scrollToError) {
            const firstErroredKey = Object.keys(nextErrors)[0];
            const el = document.getElementsByName(firstErroredKey)[0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            }
        }
        return isValid;
    };

    const renderAddressFields = (title, disabled = false) => {
        const address = formData.homeAddress;
        const prefix = 'home';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const errorFor = (field) => errors[`${prefix}_${field}`];
        const errorClass = (field) => errorFor(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                {title ? <h3 className={styles.sectionTitle}>{title}</h3> : null}
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${errorClass('region')}`} value={address.region} onChange={(e) => handleAddressChange('region', e.target.value)} disabled={disabled || isSaving}><option value="" hidden>Select Region</option>{regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}</select>{errorFor('region') && <span className={styles.errorText}>{errorFor('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${errorClass('province')}`} value={address.province} onChange={(e) => handleAddressChange('province', e.target.value)} disabled={disabled || !address.region || isSaving}><option value="" hidden>Select Province</option>{availableProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}</select>{errorFor('province') && <span className={styles.errorText}>{errorFor('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${errorClass('city')}`} value={address.city} onChange={(e) => handleAddressChange('city', e.target.value)} disabled={disabled || !address.province || isSaving}><option value="" hidden>Select City</option>{availableCities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}</select>{errorFor('city') && <span className={styles.errorText}>{errorFor('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${errorClass('barangay')}`} value={address.barangay} onChange={(e) => handleAddressChange('barangay', e.target.value)} disabled={disabled || !address.city || isSaving}><option value="" hidden>Select Barangay</option>{availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}</select>{errorFor('barangay') && <span className={styles.errorText}>{errorFor('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${errorClass('street')}`} value={address.street} onChange={(e) => handleAddressChange('street', e.target.value)} disabled={disabled || isSaving} maxLength={100} placeholder="e.g. Mabini St." />{errorFor('street') && <span className={styles.errorText}>{errorFor('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${errorClass('houseNumber')}`} value={address.houseNumber} onChange={(e) => handleAddressChange('houseNumber', e.target.value)} disabled={disabled || isSaving} maxLength={20} placeholder="e.g. Unit 123" />{errorFor('houseNumber') && <span className={styles.errorText}>{errorFor('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setHasTriedSubmit(true);
        if (!validateForm()) return;
        setIsSaving(true);

        const finalData = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email,
            contactNumber: toMobilePayload(formData.phone),
            birthdate: formData.birthdate,
            gender: formData.gender,
            profileImage,
            nationality: formData.nationality || undefined,
            religion: (formData.religion === 'Other' ? formData.religionOther.trim() : formData.religion) || undefined,
            homePhone: toLandlinePayload(formData.homePhone),
            occupation: formData.occupation || undefined,
            civilStatus: formData.civilStatus || undefined,
            bloodType: formData.bloodType || undefined,
            workPhone: toLandlinePayload(formData.workPhone),
            referredBy: formData.referredBy || undefined,
            reasonForConsultation: formData.reasonForConsultation || undefined,
            emergencyContact: {
                name: formData.emergencyContact.name || undefined,
                relationship: formData.emergencyContact.relationship || undefined,
                contactNumber: toMobilePayload(formData.emergencyContact.contactNumber),
            },
            guardian: isMinor ? {
                name: formData.guardian.name,
                relationship: formData.guardian.relationship,
                contactNumber: toMobilePayload(formData.guardian.contactNumber),
                occupation: formData.guardian.occupation || undefined,
            } : null,
            physician: {
                name: formData.physician.name || undefined,
                specialty: (formData.physician.specialty === 'Other' ? formData.physician.specialtyOther.trim() : formData.physician.specialty) || undefined,
                officeAddress: formData.physician.officeAddress || undefined,
                officeNumber: toLandlinePayload(formData.physician.officeNumber),
            },
            medicalHistory: {
                allergies: [...formData.medicalHistory.allergies, ...(formData.medicalHistory.allergyOther ? [formData.medicalHistory.allergyOther.trim()] : [])].filter(Boolean),
                conditions: [...formData.medicalHistory.conditions, ...(formData.medicalHistory.conditionOther ? [formData.medicalHistory.conditionOther.trim()] : [])].filter(Boolean),
                medications: formData.medicalHistory.medications ? formData.medicalHistory.medications.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
                notes: formData.medicalHistory.notes || undefined,
                inGoodHealth: selectToBool(formData.medicalHistory.inGoodHealth),
                underMedicalTreatment: selectToBool(formData.medicalHistory.underMedicalTreatment),
                medicalTreatmentDetails: formData.medicalHistory.medicalTreatmentDetails || undefined,
                hadSeriousIllnessOrSurgery: selectToBool(formData.medicalHistory.hadSeriousIllnessOrSurgery),
                seriousIllnessOrSurgeryDetails: formData.medicalHistory.seriousIllnessOrSurgeryDetails || undefined,
                hadHospitalization: selectToBool(formData.medicalHistory.hadHospitalization),
                hospitalizationDetails: formData.medicalHistory.hospitalizationDetails || undefined,
                isTakingMedication: selectToBool(formData.medicalHistory.isTakingMedication),
                hasAllergies: selectToBool(formData.medicalHistory.hasAllergies),
                usesTobacco: selectToBool(formData.medicalHistory.usesTobacco),
                usesAlcoholOrDrugs: selectToBool(formData.medicalHistory.usesAlcoholOrDrugs),
                bleedingTime: formData.medicalHistory.bleedingTime || undefined,
                bloodPressure: formData.medicalHistory.bloodPressure || undefined,
                isPregnant: selectToBool(formData.medicalHistory.isPregnant),
                isNursing: selectToBool(formData.medicalHistory.isNursing),
                takingBirthControl: selectToBool(formData.medicalHistory.takingBirthControl),
            },
            dentalHistory: {
                chiefComplaint: formData.reasonForConsultation || undefined,
                lastExamDate: formData.dentalHistory.lastExamDate || undefined,
                hadTreatmentReaction: selectToBool(formData.dentalHistory.hadTreatmentReaction),
                reactionDetails: formData.dentalHistory.reactionDetails || undefined,
                hasConfidentialInfo: selectToBool(formData.dentalHistory.hasConfidentialInfo),
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

        try {
            const response = await authFetch(`/patients/${patientId}`, {
                method: 'PUT',
                body: JSON.stringify(finalData),
            });
            const data = await response.json();
            if (response.ok) {
                setShowSuccessModal(true);
            } else if (response.status === 409) {
                setErrors((prev) => ({ ...prev, email: data.message || 'Email already exists.' }));
            } else {
                alert(data.message || 'Failed to update patient');
            }
        } catch (error) {
            console.error(error);
            alert('Cannot connect to server.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderTextArea = (label, value, onChange, placeholder, name) => (
        <div className={styles.formGroup}>
            <label>{label}</label>
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={isSaving}
                className={styles.inputField}
                style={{ minHeight: '120px', borderRadius: '20px', padding: '14px 20px', resize: 'vertical' }}
            />
        </div>
    );

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

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess();
        onClose();
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b', fontWeight: 'bold' }}>
                        Loading Patient Data...
                    </div>
                ) : (
                    <>
                        <div className={styles.headerWrapper}>
                            <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                                <img src={BackIcon} alt="Back" />
                            </button>
                            <div className={styles.header}>
                                <h2>Edit <span className={styles.highlight}>Patient</span> Profile</h2>
                                <p>Update the patient's records below.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} noValidate>
                            <div className={styles.uploadSection}>
                                <div className={styles.imageWrapper} onClick={triggerFileInput}>
                                    {profileImage ? <img src={profileImage} alt="Profile" className={styles.previewImage} /> : <div className={styles.uploadPlaceholder}><span>Upload Photo</span></div>}
                                </div>
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isSaving} />
                            </div>

                            <h3 className={styles.mainSectionTitle}>Patient Details</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} disabled={isSaving} />{errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}</div>
                                <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} disabled={isSaving} /></div>
                                <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} disabled={isSaving} />{errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}</div>
                            </div>
                            <hr className={styles.divider} />
                            {renderAddressFields('Home Address')}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>BIRTHDAY <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isSaving} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                                <div className={styles.formGroup}><label>AGE</label><input className={styles.inputField} value={formData.birthdate ? getAge(formData.birthdate) : ''} readOnly disabled /></div>
                                <div className={styles.formGroup}><label>GENDER <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isSaving}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>NATIONALITY</label><select className={styles.inputField} name="nationality" value={formData.nationality} onChange={handlePersonalChange} disabled={isSaving}><option value="">Select Nationality</option>{NATIONALITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                                <div className={styles.formGroup}><label>RELIGION</label><select className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religion" value={formData.religion} onChange={handlePersonalChange} disabled={isSaving}><option value="">Select Religion</option>{RELIGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.religionOther && <span className={styles.errorText}>{errors.religionOther}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {formData.religion === 'Other' ? <div className={styles.formGroup}><label>RELIGION, IF OTHER</label><input className={`${styles.inputField} ${errors.religionOther ? styles.errorBorder : ''}`} name="religionOther" value={formData.religionOther} onChange={handlePersonalChange} disabled={isSaving} />{errors.religionOther && <span className={styles.errorText}>{errors.religionOther}</span>}</div> : <div className={styles.formGroup} />}
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>HOME PHONE</label><div className={`${styles.phoneInputGroup} ${errors.homePhone ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span><input className={styles.phoneField} name="homePhone" value={formData.homePhone} onChange={handleLandlineChange('homePhone')} onBlur={handleBlur} maxLength={8} placeholder="1234567" disabled={isSaving} /></div>{errors.homePhone && <span className={styles.errorText}>{errors.homePhone}</span>}</div>
                                <div className={styles.formGroup}><label>WORK PHONE</label><div className={`${styles.phoneInputGroup} ${errors.workPhone ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span><input className={styles.phoneField} name="workPhone" value={formData.workPhone} onChange={handleLandlineChange('workPhone')} onBlur={handleBlur} maxLength={8} placeholder="1234567" disabled={isSaving} /></div>{errors.workPhone && <span className={styles.errorText}>{errors.workPhone}</span>}</div>
                                <div className={styles.formGroup}><label>MOBILE <span style={{ color: 'red' }}>*</span></label><div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>+63</span><input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange('phone')} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} /></div>{errors.phone && <span className={styles.errorText}>{errors.phone}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} disabled={isSaving} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                                <div className={styles.formGroup}><label>OCCUPATION</label><input className={styles.inputField} name="occupation" value={formData.occupation} onChange={handlePersonalChange} disabled={isSaving} /></div>
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>EMERGENCY CONTACT NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.emergencyContact_name ? styles.errorBorder : ''}`} name="emergencyContact_name" value={formData.emergencyContact.name} onChange={handleNestedNameChange('emergencyContact', 'name')} disabled={isSaving} />{errors.emergencyContact_name && <span className={styles.errorText}>{errors.emergencyContact_name}</span>}</div>
                                <div className={styles.formGroup}><label>MOBILE <span style={{ color: 'red' }}>*</span></label><div className={`${styles.phoneInputGroup} ${errors.emergencyContact_contactNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>+63</span><input className={styles.phoneField} value={formData.emergencyContact.contactNumber} onChange={handleNestedPhoneChange('emergencyContact', 'contactNumber')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} /></div>{errors.emergencyContact_contactNumber && <span className={styles.errorText}>{errors.emergencyContact_contactNumber}</span>}</div>
                                <div className={styles.formGroup}><label>RELATION <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.emergencyContact_relationship ? styles.errorBorder : ''}`} value={formData.emergencyContact.relationship} onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)} disabled={isSaving}><option value="">Select relationship</option>{RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.emergencyContact_relationship && <span className={styles.errorText}>{errors.emergencyContact_relationship}</span>}</div>
                            </div>
                            {isMinor && (
                                <>
                                    <hr className={styles.divider} />
                                    <h3 className={styles.mainSectionTitle}>For Minors</h3>
                                    <div className={styles.row}>
                                        <div className={styles.formGroup}><label>GUARDIAN NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.guardian_name ? styles.errorBorder : ''}`} value={formData.guardian.name} onChange={handleNestedNameChange('guardian', 'name')} disabled={isSaving} />{errors.guardian_name && <span className={styles.errorText}>{errors.guardian_name}</span>}</div>
                                        <div className={styles.formGroup}><label>OCCUPATION</label><input className={styles.inputField} value={formData.guardian.occupation} onChange={(e) => handleNestedChange('guardian', 'occupation', e.target.value)} disabled={isSaving} /></div>
                                    </div>
                                    <div className={styles.row}>
                                        <div className={styles.formGroup}><label>RELATIONSHIP <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.guardian_relationship ? styles.errorBorder : ''}`} value={formData.guardian.relationship} onChange={(e) => handleNestedChange('guardian', 'relationship', e.target.value)} disabled={isSaving}><option value="">Select relationship</option>{RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errors.guardian_relationship && <span className={styles.errorText}>{errors.guardian_relationship}</span>}</div>
                                        <div className={styles.formGroup}><label>GUARDIAN PHONE <span style={{ color: 'red' }}>*</span></label><div className={`${styles.phoneInputGroup} ${errors.guardian_contactNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>+63</span><input className={styles.phoneField} value={formData.guardian.contactNumber} onChange={handleNestedPhoneChange('guardian', 'contactNumber')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} /></div>{errors.guardian_contactNumber && <span className={styles.errorText}>{errors.guardian_contactNumber}</span>}</div>
                                    </div>
                                </>
                            )}

                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>REFERRED BY</label><input className={styles.inputField} name="referredBy" value={formData.referredBy} onChange={handlePersonalChange} disabled={isSaving} /></div>
                                <div className={styles.formGroup}><label>REASON FOR CONSULTATION</label><input className={styles.inputField} name="reasonForConsultation" value={formData.reasonForConsultation} onChange={handlePersonalChange} disabled={isSaving} /></div>
                                <div className={styles.formGroup} />
                            </div>

                            {(isBranchManager || branchOptions.length > 0) && (
                                <>
                                    <hr className={styles.divider} />
                                    <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: '#e0f0ff', color: '#01538b', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '13px' }}>
                                            Branch: {formData.assignedBranch || 'No branch assigned'}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '13px' }}>
                                            Branch changes are handled from the dedicated Transfer Branch action in Manage Patients.
                                        </span>
                                    </div>
                                </>
                            )}

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Dental History</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>LAST DENTAL VISIT</label><input type="date" className={`${styles.inputField} ${errors.dentalHistory_lastExamDate ? styles.errorBorder : ''}`} value={formData.dentalHistory.lastExamDate} onChange={(e) => handleNestedChange('dentalHistory', 'lastExamDate', e.target.value)} max={getTodayDate()} disabled={isSaving} />{errors.dentalHistory_lastExamDate && <span className={styles.errorText}>{errors.dentalHistory_lastExamDate}</span>}</div>
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('REACTION OR COMPLICATION AFTER DENTAL TREATMENT?', 'dentalHistory', 'hadTreatmentReaction', formData.dentalHistory.hadTreatmentReaction, isSaving)}
                                <div className={styles.formGroup}><label>IF YES, PLEASE DETAIL</label><input className={`${styles.inputField} ${errors.dentalHistory_reactionDetails ? styles.errorBorder : ''}`} value={formData.dentalHistory.reactionDetails} onChange={(e) => handleNestedChange('dentalHistory', 'reactionDetails', e.target.value)} disabled={isSaving} />{errors.dentalHistory_reactionDetails && <span className={styles.errorText}>{errors.dentalHistory_reactionDetails}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('DO YOU HAVE ANY PRIVATE OR CONFIDENTIAL INFORMATION YOU WISH TO DISCUSS IN PRIVATE AND NOT WRITE DOWN?', 'dentalHistory', 'hasConfidentialInfo', formData.dentalHistory.hasConfidentialInfo, isSaving)}
                                <div className={styles.formGroup} />
                            </div>

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Attending Physician</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>PHYSICIAN NAME</label><input className={styles.inputField} value={formData.physician.name} onChange={handleNestedNameChange('physician', 'name')} disabled={isSaving} /></div>
                                <div className={styles.formGroup}><label>SPECIALTY, IF APPLICABLE</label><select className={styles.inputField} value={formData.physician.specialty} onChange={(e) => handleNestedChange('physician', 'specialty', e.target.value)} disabled={isSaving}><option value="">Select Specialty</option>{PHYSICIAN_SPECIALTY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                            </div>
                            {formData.physician.specialty === 'Other' && (
                                <div className={styles.row}>
                                    <div className={styles.formGroup}><label>SPECIALTY, IF OTHER</label><input className={`${styles.inputField} ${errors.physician_specialtyOther ? styles.errorBorder : ''}`} value={formData.physician.specialtyOther} onChange={(e) => handleNestedChange('physician', 'specialtyOther', e.target.value)} disabled={isSaving} />{errors.physician_specialtyOther && <span className={styles.errorText}>{errors.physician_specialtyOther}</span>}</div>
                                    <div className={styles.formGroup} />
                                </div>
                            )}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>OFFICE ADDRESS</label><input className={styles.inputField} value={formData.physician.officeAddress} onChange={(e) => handleNestedChange('physician', 'officeAddress', e.target.value)} disabled={isSaving} /></div>
                                <div className={styles.formGroup}><label>OFFICE NUMBER</label><div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>{LANDLINE_PREFIX}</span><input className={styles.phoneField} value={formData.physician.officeNumber} onChange={handleNestedLandlineChange('physician', 'officeNumber')} maxLength={8} placeholder="1234567" disabled={isSaving} /></div>{errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}</div>
                            </div>

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Medical History</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>BLEEDING TIME</label><input className={styles.inputField} value={formData.medicalHistory.bleedingTime} onChange={(e) => handleNestedChange('medicalHistory', 'bleedingTime', e.target.value)} disabled={isSaving} /></div>
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU IN GOOD HEALTH?', 'medicalHistory', 'inGoodHealth', formData.medicalHistory.inGoodHealth, isSaving)}
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU UNDER MEDICAL TREATMENT NOW?', 'medicalHistory', 'underMedicalTreatment', formData.medicalHistory.underMedicalTreatment, isSaving)}
                                <div className={styles.formGroup}><label>IF SO, WHAT IS THE CONDITION TREATED?</label><input className={`${styles.inputField} ${errors.medicalHistory_medicalTreatmentDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.medicalTreatmentDetails} onChange={(e) => handleNestedChange('medicalHistory', 'medicalTreatmentDetails', e.target.value)} disabled={isSaving} />{errors.medicalHistory_medicalTreatmentDetails && <span className={styles.errorText}>{errors.medicalHistory_medicalTreatmentDetails}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('HAVE YOU EVER HAD SERIOUS ILLNESS OR SURGICAL OPERATION?', 'medicalHistory', 'hadSeriousIllnessOrSurgery', formData.medicalHistory.hadSeriousIllnessOrSurgery, isSaving)}
                                <div className={styles.formGroup}><label>IF SO, WHAT IS THE ILLNESS OR OPERATION?</label><input className={`${styles.inputField} ${errors.medicalHistory_seriousIllnessOrSurgeryDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.seriousIllnessOrSurgeryDetails} onChange={(e) => handleNestedChange('medicalHistory', 'seriousIllnessOrSurgeryDetails', e.target.value)} disabled={isSaving} />{errors.medicalHistory_seriousIllnessOrSurgeryDetails && <span className={styles.errorText}>{errors.medicalHistory_seriousIllnessOrSurgeryDetails}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('HAVE YOU EVER BEEN HOSPITALIZED?', 'medicalHistory', 'hadHospitalization', formData.medicalHistory.hadHospitalization, isSaving)}
                                <div className={styles.formGroup}><label>IF SO, WHEN AND WHY?</label><input className={`${styles.inputField} ${errors.medicalHistory_hospitalizationDetails ? styles.errorBorder : ''}`} value={formData.medicalHistory.hospitalizationDetails} onChange={(e) => handleNestedChange('medicalHistory', 'hospitalizationDetails', e.target.value)} disabled={isSaving} />{errors.medicalHistory_hospitalizationDetails && <span className={styles.errorText}>{errors.medicalHistory_hospitalizationDetails}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU TAKING ANY PRESCRIPTION/NON-PRESCRIPTION MEDICATION?', 'medicalHistory', 'isTakingMedication', formData.medicalHistory.isTakingMedication, isSaving)}
                                <div className={styles.formGroup}><label>IF SO, PLEASE SPECIFY</label><input className={`${styles.inputField} ${errors.medicalHistory_medications ? styles.errorBorder : ''}`} value={formData.medicalHistory.medications} onChange={(e) => handleNestedChange('medicalHistory', 'medications', e.target.value)} disabled={isSaving} />{errors.medicalHistory_medications && <span className={styles.errorText}>{errors.medicalHistory_medications}</span>}</div>
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('DO YOU USE TOBACCO PRODUCTS?', 'medicalHistory', 'usesTobacco', formData.medicalHistory.usesTobacco, isSaving)}
                                {renderYesNoField('DO YOU USE ALCOHOL, COCAINE, OR OTHER DANGEROUS DRUGS?', 'medicalHistory', 'usesAlcoholOrDrugs', formData.medicalHistory.usesAlcoholOrDrugs, isSaving)}
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU ALLERGIC TO ANY OF THE FOLLOWING?', 'medicalHistory', 'hasAllergies', formData.medicalHistory.hasAllergies, isSaving)}
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>BLEEDING TIME</label><input className={styles.inputField} value={formData.medicalHistory.bleedingTime} onChange={(e) => handleNestedChange('medicalHistory', 'bleedingTime', e.target.value)} disabled={isSaving} /></div>
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU PREGNANT?', 'medicalHistory', 'isPregnant', formData.medicalHistory.isPregnant, isSaving)}
                                {renderYesNoField('ARE YOU NURSING?', 'medicalHistory', 'isNursing', formData.medicalHistory.isNursing, isSaving)}
                            </div>
                            <div className={styles.row}>
                                {renderYesNoField('ARE YOU TAKING BIRTH CONTROL PILLS?', 'medicalHistory', 'takingBirthControl', formData.medicalHistory.takingBirthControl, isSaving)}
                                <div className={styles.formGroup} />
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>ALLERGIES</label>
                                    <div className={styles.checkboxGrid}>
                                        {ALLERGY_OPTIONS.map((option) => (
                                            <label key={option} className={styles.checkboxOption}>
                                                <input type="checkbox" checked={formData.medicalHistory.allergies.includes(option)} onChange={() => handleNestedArrayToggle('medicalHistory', 'allergies', option)} disabled={isSaving} />
                                                <span>{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <input className={`${styles.inputField} ${errors.medicalHistory_allergies ? styles.errorBorder : ''}`} style={{ marginTop: '12px' }} value={formData.medicalHistory.allergyOther} onChange={(e) => handleNestedChange('medicalHistory', 'allergyOther', e.target.value)} placeholder="Other allergy" disabled={isSaving} />
                                    {errors.medicalHistory_allergies && <span className={styles.errorText}>{errors.medicalHistory_allergies}</span>}
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>MEDICAL CONDITIONS</label>
                                    <div className={styles.checkboxGrid}>
                                        {MEDICAL_CONDITION_OPTIONS.map((option) => (
                                            <label key={option} className={styles.checkboxOption}>
                                                <input type="checkbox" checked={formData.medicalHistory.conditions.includes(option)} onChange={() => handleNestedArrayToggle('medicalHistory', 'conditions', option)} disabled={isSaving} />
                                                <span>{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <input className={styles.inputField} style={{ marginTop: '12px' }} value={formData.medicalHistory.conditionOther} onChange={(e) => handleNestedChange('medicalHistory', 'conditionOther', e.target.value)} placeholder="Other condition" disabled={isSaving} />
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>BLOOD TYPE</label><select className={styles.inputField} name="bloodType" value={formData.bloodType} onChange={handlePersonalChange} disabled={isSaving}><option value="">Select Blood Type</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>
                                <div className={styles.formGroup}><label>BLOOD PRESSURE</label><input className={styles.inputField} value={formData.medicalHistory.bloodPressure} onChange={(e) => handleNestedChange('medicalHistory', 'bloodPressure', e.target.value)} placeholder="e.g. 120/80" disabled={isSaving} /></div>
                            </div>
                            <div className={styles.row}>
                                {renderTextArea('MEDICAL NOTES', formData.medicalHistory.notes, (e) => handleNestedChange('medicalHistory', 'notes', e.target.value), 'Hospitalization, illness history, medical remarks, etc.', 'medicalNotes')}
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
                                        <input className={`${styles.inputField} ${errors.dataPrivacyConsent_signerName ? styles.errorBorder : ''}`} name="dataPrivacyConsent_signerName" value={formData.dataPrivacyConsent.signerName} onChange={handleNestedNameChange('dataPrivacyConsent', 'signerName')} disabled={isSaving} />
                                        {errors.dataPrivacyConsent_signerName && <span className={styles.errorText}>{errors.dataPrivacyConsent_signerName}</span>}
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>PRIVACY SIGNER ROLE <span style={{ color: 'red' }}>*</span></label>
                                        <select className={styles.inputField} name="dataPrivacyConsent_signerRole" value={formData.dataPrivacyConsent.signerRole} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signerRole', e.target.value)} disabled={isSaving}>
                                            <option value="Patient">Patient</option>
                                            <option value="Parent">Parent</option>
                                            <option value="Guardian">Guardian</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>DATE SIGNED <span style={{ color: 'red' }}>*</span></label>
                                        <input type="date" className={`${styles.inputField} ${errors.dataPrivacyConsent_signedAt ? styles.errorBorder : ''}`} name="dataPrivacyConsent_signedAt" value={formData.dataPrivacyConsent.signedAt} onChange={(e) => handleNestedChange('dataPrivacyConsent', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isSaving} />
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
                                        disabled={isSaving}
                                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: '#01538b', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
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
                                        <input className={`${styles.inputField} ${errors.consentAcknowledgement_signerName ? styles.errorBorder : ''}`} name="consentAcknowledgement_signerName" value={formData.consentAcknowledgement.signerName} onChange={handleNestedNameChange('consentAcknowledgement', 'signerName')} disabled={isSaving} />
                                        {errors.consentAcknowledgement_signerName && <span className={styles.errorText}>{errors.consentAcknowledgement_signerName}</span>}
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>SIGNER ROLE <span style={{ color: 'red' }}>*</span></label>
                                        <select className={styles.inputField} name="consentAcknowledgement_signerRole" value={formData.consentAcknowledgement.signerRole} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signerRole', e.target.value)} disabled={isSaving}>
                                            <option value="Patient">Patient</option>
                                            <option value="Parent">Parent</option>
                                            <option value="Guardian">Guardian</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>DATE SIGNED <span style={{ color: 'red' }}>*</span></label>
                                        <input type="date" className={`${styles.inputField} ${errors.consentAcknowledgement_signedAt ? styles.errorBorder : ''}`} name="consentAcknowledgement_signedAt" value={formData.consentAcknowledgement.signedAt} onChange={(e) => handleNestedChange('consentAcknowledgement', 'signedAt', e.target.value)} max={getTodayDate()} disabled={isSaving} />
                                        {errors.consentAcknowledgement_signedAt && <span className={styles.errorText}>{errors.consentAcknowledgement_signedAt}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsConsentModalOpen(true)}
                                        disabled={isSaving}
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
                                <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>CANCEL</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>{isSaving ? 'SAVING CHANGES...' : 'UPDATE PATIENT'}</button>
                            </div>
                        </form>
                    </>
                )}
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>The patient's profile has been successfully updated.</p>
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
