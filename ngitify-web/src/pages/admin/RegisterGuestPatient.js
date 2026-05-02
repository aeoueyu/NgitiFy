import React, { useEffect, useMemo, useState } from 'react';
import styles from '../../styles/admin/AddPatient.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import successIcon from '../../assets/alert/success.svg';
import { authFetch } from '../../utils/api';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { useAuth } from '../../hooks/useAuth';

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

const stripPhonePrefix = (phone = '') => {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) return digits.slice(2, 12);
    if (digits.startsWith('0') && digits.length >= 11) return digits.slice(1, 11);
    if (digits.startsWith('9')) return digits.slice(0, 10);
    return digits.slice(-10);
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
    chiefComplaint: '',
    lastExamDate: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    notes: '',
    hasConfidentialInfo: false,
};

const initialPhysician = {
    name: '',
    specialty: '',
    officeAddress: '',
    officeNumber: '',
};

const allergyOptions = [
    'Local Anesthetic (ex. Lidocaine)',
    'Penicillin',
    'Aspirin',
    'Antibiotics',
    'Adrenaline',
    'Steroids',
    'Hormones',
    'Antacids',
    'Sulfa Drugs',
    'Alcohol',
    'Latex',
];

const medicalConditionOptions = [
    'High Blood Pressure',
    'Low Blood Pressure',
    'Epilepsy/Convulsions',
    'AIDS or HIV Infection',
    'Hay Fever/Allergies',
    'Respiratory Problems',
    'Fainting Seizure',
    'Rapid Weight Loss',
    'Swollen Ankles',
    'Kidney Disease',
    'Heart Surgery',
    'Heart Attack',
    'Stroke',
    'Heart Disease',
    'Heart Murmur',
    'Hepatitis/Liver Disease',
    'Rheumatic Fever',
    'Asthma',
    'Emphysema',
    'Bleeding Problems',
    'Hepatitis/Jaundice',
    'Tuberculosis',
    'Arthritis/Rheumatism',
    'Diabetes',
    'Chest Pain',
    'Cancer/Tumors',
    'Anemia',
    'Angina',
    'Sexually Transmitted Disease',
    'Stomach Troubles/Ulcers',
    'Blood Diseases',
    'Head Injuries',
    'Radiation Therapy',
    'Joint Replacement/Implant',
    'Thyroid Problem',
    'Other',
];

const selectToBool = (value) => {
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return undefined;
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

export default function RegisterGuestPatient({ appointment, onClose, onSuccess }) {
    const { user } = useAuth();
    const isBranchScopedStaff = user?.role === 'branch-manager' || user?.role === 'secretary';
    const isSecretary = user?.role === 'secretary';
    const [isSameAddress, setIsSameAddress] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);

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
        workPhone: '',
        referredBy: '',
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
    });

    useEffect(() => {
        const nextCurrentAddress = { ...initialAddressState, ...(appointment?.guestCurrentAddress || {}) };
        const nextPermanentAddress = { ...initialAddressState, ...(appointment?.guestPermanentAddress || {}) };
        const sameAddress = JSON.stringify(nextCurrentAddress) === JSON.stringify(nextPermanentAddress);

        setFormData((prev) => ({
            ...prev,
            firstName: nameParts.firstName,
            middleName: nameParts.middleName,
            lastName: nameParts.lastName,
            birthdate: appointment?.guestBirthdate ? new Date(appointment.guestBirthdate).toISOString().split('T')[0] : prev.birthdate,
            gender: appointment?.guestGender || prev.gender,
            email: appointment?.guestEmail || '',
            phone: stripPhonePrefix(appointment?.guestPhone || ''),
            assignedBranch: isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || '') : (appointment?.branch || ''),
            currentAddress: nextCurrentAddress,
            permanentAddress: nextPermanentAddress,
        }));
        setIsSameAddress(sameAddress);
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
        const formatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formatRegex.test(email)) return false;
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        return allowedDomains.includes(email.split('@')[1].toLowerCase());
    };

    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
    const getAge = (d) => { const today = new Date(); const birth = new Date(d); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--; return age; };
    const getMaxDate = () => new Date().toISOString().split('T')[0];
    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = '';
        if (name === 'email') {
            if (!value) newError = 'Required';
            else if (!validateEmail(value)) newError = 'Invalid domain (e.g. gmail.com)';
        } else if (name === 'phone' || name === 'guardianContact') {
            if (!value) newError = 'Required';
            else if (value.length !== 10 || value[0] !== '9') newError = 'Invalid format (9xxxxxxxxx)';
        }
        setErrors((prev) => ({ ...prev, [name]: newError }));
    };

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
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
            if (type === 'currentAddress' && isSameAddress) {
                return { ...prev, currentAddress: updated, permanentAddress: updated };
            }
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

    const handleNestedPhoneChange = (section, field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
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

    const handleSameAddressToggle = (e) => {
        const checked = e.target.checked;
        setIsSameAddress(checked);
        if (checked) {
            setFormData((prev) => ({ ...prev, permanentAddress: { ...prev.currentAddress } }));
            setErrors((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((key) => {
                    if (key.startsWith('permanent_')) delete next[key];
                });
                return next;
            });
        } else {
            setFormData((prev) => ({ ...prev, permanentAddress: { ...initialAddressState } }));
        }
    };

    const validateForm = () => {
        const nextErrors = {};
        let isValid = true;
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        required.forEach((field) => {
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
        if (formData.homePhone && (formData.homePhone.length !== 10 || formData.homePhone[0] !== '9')) {
            nextErrors.homePhone = 'Invalid format';
            isValid = false;
        }
        if (formData.workPhone && (formData.workPhone.length !== 10 || formData.workPhone[0] !== '9')) {
            nextErrors.workPhone = 'Invalid format';
            isValid = false;
        }
        if (formData.emergencyContactPhone && (formData.emergencyContactPhone.length !== 10 || formData.emergencyContactPhone[0] !== '9')) {
            nextErrors.emergencyContactPhone = 'Invalid format';
            isValid = false;
        }
        if (formData.physician.officeNumber && (formData.physician.officeNumber.length !== 10 || formData.physician.officeNumber[0] !== '9')) {
            nextErrors.physician_officeNumber = 'Invalid format';
            isValid = false;
        }

        if (formData.email && !validateEmail(formData.email)) {
            nextErrors.email = 'Invalid domain';
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
            } else if (formData.guardianContact.length !== 10 || formData.guardianContact[0] !== '9') {
                nextErrors.guardianContact = 'Invalid format';
                isValid = false;
            }
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
        if (!isSameAddress) validateAddr(formData.permanentAddress, 'permanent');

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

        setIsLoading(true);
        const payload = {
            name: {
                first: formData.firstName,
                middle: formData.middleName,
                last: formData.lastName,
            },
            email: formData.email.trim(),
            contactNumber: `+63${formData.phone}`,
            birthdate: formData.birthdate,
            gender: formData.gender,
            homePhone: formData.homePhone ? `+63${formData.homePhone}` : undefined,
            occupation: formData.occupation || undefined,
            civilStatus: formData.civilStatus || undefined,
            bloodType: formData.bloodType || undefined,
            nationality: formData.nationality || undefined,
            religion: formData.religion || undefined,
            workPhone: formData.workPhone ? `+63${formData.workPhone}` : undefined,
            referredBy: formData.referredBy || undefined,
            assignedBranch: isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || undefined) : (formData.assignedBranch || undefined),
            assignedBranches: [isBranchScopedStaff ? (user?.assignedBranch || appointment?.branch || '') : (formData.assignedBranch || '')].filter(Boolean),
            emergencyContact: {
                name: formData.emergencyContactName || undefined,
                relationship: formData.emergencyContactRelationship || undefined,
                contactNumber: formData.emergencyContactPhone ? `+63${formData.emergencyContactPhone}` : undefined,
            },
            guardian: isMinor ? {
                name: formData.guardianName,
                relationship: formData.guardianRelationship,
                contactNumber: `+63${formData.guardianContact}`,
                occupation: formData.guardianOccupation || undefined,
            } : null,
            dentalHistory: {
                chiefComplaint: formData.dentalHistory.chiefComplaint || undefined,
                lastExamDate: formData.dentalHistory.lastExamDate || undefined,
                notes: formData.dentalHistory.notes || undefined,
                hadTreatmentReaction: selectToBool(formData.dentalHistory.hadTreatmentReaction),
                reactionDetails: formData.dentalHistory.reactionDetails || undefined,
                hasConfidentialInfo: Boolean(formData.dentalHistory.hasConfidentialInfo),
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
                specialty: formData.physician.specialty || undefined,
                officeAddress: formData.physician.officeAddress || undefined,
                officeNumber: formData.physician.officeNumber ? `+63${formData.physician.officeNumber}` : undefined,
            },
            consentAcknowledgement: {
                acknowledged: Boolean(formData.consentAcknowledgement.acknowledged),
                signerName: formData.consentAcknowledgement.signerName.trim() || undefined,
                signerRole: formData.consentAcknowledgement.signerRole || (isMinor ? 'Parent/Guardian' : 'Patient'),
                signedAt: formData.consentAcknowledgement.signedAt || new Date().toISOString(),
                version: 'Dentime Patient Form v6.1',
            },
            currentAddress: { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress ? { country: 'Philippines', ...formData.currentAddress } : { country: 'Philippines', ...formData.permanentAddress },
        };

        try {
            const response = await authFetch(`/admin/appointments/${appointment.id}/register-guest`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok) {
                setSuccessMessage(data.message || 'Guest appointment registered successfully.');
                setShowSuccessModal(true);
            } else if (response.status === 409) {
                setErrors((prev) => ({ ...prev, email: data.message || 'Email already exists.' }));
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
        onSuccess?.();
        onClose?.();
    };

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
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} disabled={isLoading} /></div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BIRTHDATE <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isLoading} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                        <div className={styles.formGroup}><label>GENDER <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isLoading}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} disabled={isLoading} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange('phone')} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

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
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="homePhone" value={formData.homePhone} onChange={handlePhoneChange('homePhone')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.homePhone && <span className={styles.errorText}>{errors.homePhone}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>WORK PHONE</label>
                            <div className={`${styles.phoneInputGroup} ${errors.workPhone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="workPhone" value={formData.workPhone} onChange={handlePhoneChange('workPhone')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.workPhone && <span className={styles.errorText}>{errors.workPhone}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>NATIONALITY</label><input className={styles.inputField} name="nationality" value={formData.nationality} onChange={handlePersonalChange} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>RELIGION</label><input className={styles.inputField} name="religion" value={formData.religion} onChange={handlePersonalChange} disabled={isLoading} /></div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>REASON FOR CONSULTATION</label><input className={styles.inputField} value={formData.dentalHistory.chiefComplaint} onChange={(e) => handleNestedChange('dentalHistory', 'chiefComplaint', e.target.value)} disabled={isLoading} /></div>
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
                    {renderAddressFields('currentAddress', 'Current Address')}
                    <div className={styles.permanentHeader}>
                        <h3 className={styles.sectionTitle}>Permanent Address</h3>
                        <div className={styles.checkboxContainer}>
                            <input type="checkbox" id="guestSameAddress" checked={isSameAddress} onChange={handleSameAddressToggle} disabled={isLoading} />
                            <label htmlFor="guestSameAddress">Same as Current Address</label>
                        </div>
                    </div>
                    {isSameAddress ? <div className={styles.disabledOverlay}>{renderAddressFields('permanentAddress', '', true)}</div> : renderAddressFields('permanentAddress', '')}

                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Dental History</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>LAST DENTAL VISIT</label><input type="date" className={styles.inputField} value={formData.dentalHistory.lastExamDate} onChange={(e) => handleNestedChange('dentalHistory', 'lastExamDate', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>REACTION OR COMPLICATION AFTER DENTAL TREATMENT?</label><select className={styles.inputField} value={formData.dentalHistory.hadTreatmentReaction} onChange={(e) => handleNestedChange('dentalHistory', 'hadTreatmentReaction', e.target.value)} disabled={isLoading}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>IF YES, PLEASE DETAIL</label><textarea className={styles.textArea} value={formData.dentalHistory.reactionDetails} onChange={(e) => handleNestedChange('dentalHistory', 'reactionDetails', e.target.value)} rows={3} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>DENTAL HISTORY NOTES</label><textarea className={styles.textArea} value={formData.dentalHistory.notes} onChange={(e) => handleNestedChange('dentalHistory', 'notes', e.target.value)} rows={3} disabled={isLoading} /></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CONFIDENTIAL INFORMATION</label>
                            <div className={styles.checkboxContainer} style={{ marginTop: '8px' }}>
                                <input type="checkbox" checked={formData.dentalHistory.hasConfidentialInfo} onChange={(e) => handleNestedChange('dentalHistory', 'hasConfidentialInfo', e.target.checked)} disabled={isLoading} />
                                <label>Patient wants to discuss private information verbally</label>
                            </div>
                        </div>
                        <div className={styles.formGroup} />
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
                                {allergyOptions.map((option) => (
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
                                {medicalConditionOptions.map((option) => (
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
                        <div className={styles.formGroup}><label>SPECIALTY</label><input className={styles.inputField} value={formData.physician.specialty} onChange={(e) => handleNestedChange('physician', 'specialty', e.target.value)} disabled={isLoading} /></div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>OFFICE ADDRESS</label><input className={styles.inputField} value={formData.physician.officeAddress} onChange={(e) => handleNestedChange('physician', 'officeAddress', e.target.value)} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>OFFICE NUMBER</label><div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>+63</span><input className={styles.phoneField} value={formData.physician.officeNumber} onChange={handleNestedPhoneChange('physician', 'officeNumber')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} /></div>{errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}</div>
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
                        <div className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                checked={formData.consentAcknowledgement.acknowledged}
                                onChange={(e) => handleNestedChange('consentAcknowledgement', 'acknowledged', e.target.checked)}
                                disabled={isLoading}
                            />
                            <label>I acknowledge and record this consent digitally.</label>
                        </div>
                        {errors.consentAcknowledgement_acknowledged && <span className={styles.errorText}>{errors.consentAcknowledgement_acknowledged}</span>}
                    </div>

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>{isLoading ? 'REGISTERING...' : 'REGISTER PATIENT'}</button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>{successMessage}</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
