import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../../components/common/UserAvatar';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { barangays, cities, provinces, regions } from '../../utils/addressData';
import { getHomeAddress, normalizeAddressForForm } from '../../utils/addressHelpers';
import {
    ALLERGY_OPTIONS,
    BLOOD_TYPE_OPTIONS,
    MEDICAL_CONDITION_OPTIONS,
    NATIONALITY_OPTIONS,
    OCCUPATION_OPTIONS,
    PHYSICIAN_SPECIALTY_OPTIONS,
    RELATIONSHIP_OPTIONS,
    RELIGION_OPTIONS,
    stripLandlinePrefix,
    stripMobilePrefix,
    toLandlinePayload,
    toMobilePayload,
} from '../../utils/patientIntake';
import { getFullName } from '../../utils/patientPortal';
import styles from '../../styles/admin/AdminProfile.module.css';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed', 'Prefer not to say'];
const YES_NO_OPTIONS = [
    { value: '', label: 'Select answer' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
];

const arrayToCsv = (value) => (Array.isArray(value) ? value.join(', ') : String(value || '').trim());
const csvToArray = (value) => String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
const splitKnownAndOther = (values = [], options = []) => {
    const list = Array.isArray(values) ? values : csvToArray(values);
    return {
        selected: list.filter((entry) => options.includes(entry)),
        other: list.filter((entry) => !options.includes(entry)).join(', '),
    };
};
const cloneFormState = (value) => JSON.parse(JSON.stringify(value));
const boolToSelect = (value) => (value === true ? 'yes' : value === false ? 'no' : '');
const selectToBool = (value) => (value === 'yes' ? true : value === 'no' ? false : undefined);

const optionListWithCurrent = (options, current) => {
    const safeCurrent = String(current || '').trim();
    if (!safeCurrent || options.includes(safeCurrent)) return options;
    return [...options, safeCurrent];
};

const formatDateInput = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
};

const buildInitialForm = (profile = {}) => {
    const normalizedAddress = normalizeAddressForForm(getHomeAddress(profile));
    const medicalHistory = profile.medicalHistory || {};
    const dentalHistory = profile.dentalHistory || {};
    const physician = profile.physician || {};
    const guardian = profile.guardian || {};
    const allergies = splitKnownAndOther(medicalHistory.allergies, ALLERGY_OPTIONS);
    const conditions = splitKnownAndOther(medicalHistory.conditions, MEDICAL_CONDITION_OPTIONS);

    return {
        firstName: profile?.name?.first || '',
        middleName: profile?.name?.middle || '',
        lastName: profile?.name?.last || '',
        birthdate: formatDateInput(profile.birthdate),
        gender: profile.gender || '',
        contactNumber: stripMobilePrefix(profile.contactNumber || ''),
        homePhone: stripLandlinePrefix(profile.homePhone || ''),
        workPhone: stripLandlinePrefix(profile.workPhone || ''),
        occupation: profile.occupation || '',
        civilStatus: profile.civilStatus || '',
        nationality: profile.nationality || 'Filipino',
        religion: profile.religion || '',
        bloodType: profile.bloodType || medicalHistory.bloodType || '',
        referredBy: profile.referredBy || '',
        reasonForConsultation: profile.reasonForConsultation || dentalHistory.chiefComplaint || '',
        emergencyName: profile.emergencyContact?.name || '',
        emergencyRelationship: profile.emergencyContact?.relationship || '',
        emergencyPhone: stripMobilePrefix(profile.emergencyContact?.contactNumber || ''),
        guardianName: guardian.name || '',
        guardianRelationship: guardian.relationship || '',
        guardianPhone: stripMobilePrefix(guardian.contactNumber || ''),
        guardianOccupation: guardian.occupation || '',
        physicianName: physician.name || '',
        physicianSpecialty: physician.specialty || '',
        physicianOfficeAddress: physician.officeAddress || '',
        physicianOfficeNumber: stripLandlinePrefix(physician.officeNumber || ''),
        dentalLastExamDate: formatDateInput(dentalHistory.lastExamDate),
        dentalHadTreatmentReaction: boolToSelect(dentalHistory.hadTreatmentReaction),
        dentalReactionDetails: dentalHistory.reactionDetails || '',
        dentalHasConfidentialInfo: boolToSelect(dentalHistory.hasConfidentialInfo),
        dentalNotes: dentalHistory.notes || '',
        inGoodHealth: boolToSelect(medicalHistory.inGoodHealth),
        underMedicalTreatment: boolToSelect(medicalHistory.underMedicalTreatment),
        medicalTreatmentDetails: medicalHistory.medicalTreatmentDetails || '',
        hadSeriousIllnessOrSurgery: boolToSelect(medicalHistory.hadSeriousIllnessOrSurgery),
        seriousIllnessOrSurgeryDetails: medicalHistory.seriousIllnessOrSurgeryDetails || '',
        hadHospitalization: boolToSelect(medicalHistory.hadHospitalization),
        hospitalizationDetails: medicalHistory.hospitalizationDetails || '',
        isTakingMedication: boolToSelect(medicalHistory.isTakingMedication),
        medications: arrayToCsv(medicalHistory.medications),
        usesTobacco: boolToSelect(medicalHistory.usesTobacco),
        usesAlcoholOrDrugs: boolToSelect(medicalHistory.usesAlcoholOrDrugs),
        hasAllergies: boolToSelect(medicalHistory.hasAllergies),
        allergies: allergies.selected,
        allergyOther: allergies.other,
        conditions: conditions.selected,
        conditionOther: conditions.other,
        bleedingTime: medicalHistory.bleedingTime || '',
        bloodPressure: medicalHistory.bloodPressure || '',
        isPregnant: boolToSelect(medicalHistory.isPregnant),
        isNursing: boolToSelect(medicalHistory.isNursing),
        takingBirthControl: boolToSelect(medicalHistory.takingBirthControl),
        medicalNotes: medicalHistory.notes || '',
        region: normalizedAddress.region || '',
        province: normalizedAddress.province || '',
        city: normalizedAddress.city || '',
        barangay: normalizedAddress.barangay || '',
        street: normalizedAddress.street || '',
        houseNumber: normalizedAddress.houseNumber || '',
        profileImage: profile.profileImage || '',
    };
};

const RequiredMark = () => <span style={{ color: 'red' }}>*</span>;

export default function PatientEditProfile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { addToast } = useToast();
    const { user } = useAuth();

    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState(null);
    const [initialFormData, setInitialFormData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const availableProvinces = useMemo(() => (formData?.region ? (provinces[formData.region] || []) : []), [formData?.region]);
    const availableCities = useMemo(() => (formData?.province ? (cities[formData.province] || []) : []), [formData?.province]);
    const availableBarangays = useMemo(() => (formData?.city ? (barangays[formData.city] || []) : []), [formData?.city]);

    const fetchProfile = useCallback(async () => {
        const userId = user?.id || user?.userId || user?._id;
        if (!userId) return;

        try {
            setLoading(true);
            setError('');
            const response = await authFetch(`/user/${userId}`);
            if (!response.ok) throw new Error('Could not load your patient profile.');
            const payload = await response.json();
            const nextForm = buildInitialForm(payload);
            setProfile(payload);
            setFormData(nextForm);
            setInitialFormData(cloneFormState(nextForm));
        } catch (fetchError) {
            setProfile(null);
            setFormData(null);
            setInitialFormData(null);
            setError(fetchError.message || 'Could not load your patient profile.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.userId, user?._id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const hasChanges = useMemo(() => {
        if (!formData || !initialFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(initialFormData);
    }, [formData, initialFormData]);

    const handleFieldChange = (field, value) => {
        setSaveError('');
        setFieldErrors((current) => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
        setFormData((current) => {
            const next = { ...current, [field]: value };
            if (field === 'gender' && value === 'Male') {
                next.isPregnant = '';
                next.isNursing = '';
                next.takingBirthControl = '';
            }
            return next;
        });
    };

    const handleCheckboxToggle = (field, option) => {
        setSaveError('');
        setFieldErrors((current) => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
        setFormData((current) => {
            const values = Array.isArray(current[field]) ? current[field] : [];
            const nextValues = values.includes(option)
                ? values.filter((entry) => entry !== option)
                : [...values, option];
            return { ...current, [field]: nextValues };
        });
    };

    const handleAddressChange = (field, value) => {
        setSaveError('');
        setFieldErrors((current) => {
            const errorKey = `address_${field}`;
            if (!current[errorKey]) return current;
            const next = { ...current };
            delete next[errorKey];
            return next;
        });
        setFormData((current) => {
            const next = { ...current, [field]: value };
            if (field === 'region') {
                next.province = '';
                next.city = '';
                next.barangay = '';
            }
            if (field === 'province') {
                next.city = '';
                next.barangay = '';
            }
            if (field === 'city') {
                next.barangay = '';
            }
            return next;
        });
    };

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const encoded = String(reader.result || '');
            if (encoded.length > 1.5 * 1024 * 1024) {
                setSaveError('Profile image must stay under 1.5MB.');
                return;
            }
            handleFieldChange('profileImage', encoded);
        };
        reader.readAsDataURL(file);
    };

    const getRegionName = (code) => regions.find((entry) => entry.code === code)?.name || '';
    const getProvinceName = (code) => availableProvinces.find((entry) => entry.code === code)?.name
        || Object.values(provinces).flat().find((entry) => entry.code === code)?.name
        || '';
    const getCityName = (code) => availableCities.find((entry) => entry.code === code)?.name
        || Object.values(cities).flat().find((entry) => entry.code === code)?.name
        || '';

    const validateForm = () => {
        const nextErrors = {};
        const requireField = (field, message = 'Required') => {
            if (!String(formData[field] || '').trim()) nextErrors[field] = message;
        };
        const requireYesNo = (field) => requireField(field);

        requireField('firstName');
        requireField('lastName');
        requireField('birthdate');
        requireField('gender');
        requireField('contactNumber');
        requireField('emergencyName');
        requireField('emergencyRelationship');
        requireField('emergencyPhone');
        requireYesNo('dentalHadTreatmentReaction');
        requireYesNo('dentalHasConfidentialInfo');
        requireYesNo('inGoodHealth');
        requireYesNo('underMedicalTreatment');
        requireYesNo('hadSeriousIllnessOrSurgery');
        requireYesNo('hadHospitalization');
        requireYesNo('isTakingMedication');
        requireYesNo('usesTobacco');
        requireYesNo('usesAlcoholOrDrugs');
        requireYesNo('hasAllergies');

        if (formData.gender !== 'Male') {
            requireYesNo('isPregnant');
            requireYesNo('isNursing');
            requireYesNo('takingBirthControl');
        }

        if (formData.dentalHadTreatmentReaction === 'yes') requireField('dentalReactionDetails', 'Required when answer is Yes');
        if (formData.underMedicalTreatment === 'yes') requireField('medicalTreatmentDetails', 'Required when answer is Yes');
        if (formData.hadSeriousIllnessOrSurgery === 'yes') requireField('seriousIllnessOrSurgeryDetails', 'Required when answer is Yes');
        if (formData.hadHospitalization === 'yes') requireField('hospitalizationDetails', 'Required when answer is Yes');
        if (formData.isTakingMedication === 'yes') requireField('medications', 'Required when answer is Yes');
        if (formData.hasAllergies === 'yes' && !formData.allergies.length && !formData.allergyOther.trim()) {
            nextErrors.allergies = 'Select or enter at least one allergy';
        }

        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            setFieldErrors(nextErrors);
            return 'Please complete all required fields.';
        }
        if (formData.contactNumber && !/^[0-9]{10}$/.test(formData.contactNumber)) {
            nextErrors.contactNumber = 'Invalid format';
            setFieldErrors(nextErrors);
            return 'Contact number must use 10 digits, for example 9xxxxxxxxx.';
        }
        if (formData.emergencyPhone && !/^[0-9]{10}$/.test(formData.emergencyPhone)) {
            nextErrors.emergencyPhone = 'Invalid format';
            setFieldErrors(nextErrors);
            return 'Emergency contact number must use 10 digits, for example 9xxxxxxxxx.';
        }
        if (formData.guardianPhone && !/^[0-9]{10}$/.test(formData.guardianPhone)) {
            nextErrors.guardianPhone = 'Invalid format';
            setFieldErrors(nextErrors);
            return 'Guardian contact number must use 10 digits, for example 9xxxxxxxxx.';
        }
        if (Object.keys(nextErrors).length) {
            setFieldErrors(nextErrors);
            return 'Please complete all required fields.';
        }
        setFieldErrors({});
        return '';
    };

    const handleSave = async (event) => {
        event.preventDefault();
        const userId = user?.id || user?.userId || user?._id;
        if (!formData || !userId) return;

        setSaveError('');
        const validationError = validateForm();
        if (validationError) {
            setSaveError(validationError);
            return;
        }

        const homeAddress = {
            country: 'Philippines',
            region: getRegionName(formData.region),
            province: getProvinceName(formData.province),
            city: getCityName(formData.city),
            barangay: formData.barangay,
            street: formData.street.trim(),
            houseNumber: formData.houseNumber.trim(),
        };

        const payload = {
            name: {
                first: formData.firstName.trim(),
                middle: formData.middleName.trim(),
                last: formData.lastName.trim(),
            },
            contactNumber: formData.contactNumber ? toMobilePayload(formData.contactNumber) : '',
            birthdate: formData.birthdate || '',
            gender: formData.gender || '',
            homePhone: formData.homePhone ? toLandlinePayload(formData.homePhone) : '',
            workPhone: formData.workPhone ? toLandlinePayload(formData.workPhone) : '',
            occupation: formData.occupation || '',
            civilStatus: formData.civilStatus || '',
            nationality: formData.nationality || '',
            religion: formData.religion || '',
            bloodType: formData.bloodType || '',
            referredBy: formData.referredBy.trim(),
            reasonForConsultation: formData.reasonForConsultation.trim(),
            emergencyContact: {
                name: formData.emergencyName.trim(),
                relationship: formData.emergencyRelationship,
                contactNumber: formData.emergencyPhone ? toMobilePayload(formData.emergencyPhone) : '',
            },
            guardian: {
                name: formData.guardianName.trim(),
                relationship: formData.guardianRelationship,
                contactNumber: formData.guardianPhone ? toMobilePayload(formData.guardianPhone) : '',
                occupation: formData.guardianOccupation,
            },
            physician: {
                name: formData.physicianName.trim(),
                specialty: formData.physicianSpecialty,
                officeAddress: formData.physicianOfficeAddress.trim(),
                officeNumber: formData.physicianOfficeNumber ? toLandlinePayload(formData.physicianOfficeNumber) : '',
            },
            dentalHistory: {
                chiefComplaint: formData.reasonForConsultation.trim(),
                lastExamDate: formData.dentalLastExamDate || undefined,
                hadTreatmentReaction: selectToBool(formData.dentalHadTreatmentReaction),
                reactionDetails: formData.dentalReactionDetails.trim(),
                hasConfidentialInfo: selectToBool(formData.dentalHasConfidentialInfo),
                notes: formData.dentalNotes.trim(),
            },
            medicalHistory: {
                bloodType: formData.bloodType || '',
                inGoodHealth: selectToBool(formData.inGoodHealth),
                underMedicalTreatment: selectToBool(formData.underMedicalTreatment),
                medicalTreatmentDetails: formData.medicalTreatmentDetails.trim(),
                hadSeriousIllnessOrSurgery: selectToBool(formData.hadSeriousIllnessOrSurgery),
                seriousIllnessOrSurgeryDetails: formData.seriousIllnessOrSurgeryDetails.trim(),
                hadHospitalization: selectToBool(formData.hadHospitalization),
                hospitalizationDetails: formData.hospitalizationDetails.trim(),
                isTakingMedication: selectToBool(formData.isTakingMedication),
                medications: csvToArray(formData.medications),
                usesTobacco: selectToBool(formData.usesTobacco),
                usesAlcoholOrDrugs: selectToBool(formData.usesAlcoholOrDrugs),
                hasAllergies: selectToBool(formData.hasAllergies),
                allergies: [...formData.allergies, ...csvToArray(formData.allergyOther)],
                conditions: [...formData.conditions, ...csvToArray(formData.conditionOther)],
                bleedingTime: formData.bleedingTime.trim(),
                bloodPressure: formData.bloodPressure.trim(),
                isPregnant: formData.gender === 'Male' ? null : selectToBool(formData.isPregnant),
                isNursing: formData.gender === 'Male' ? null : selectToBool(formData.isNursing),
                takingBirthControl: formData.gender === 'Male' ? null : selectToBool(formData.takingBirthControl),
                notes: formData.medicalNotes.trim(),
            },
            homeAddress,
            permanentAddress: homeAddress,
            currentAddress: homeAddress,
            profileImage: formData.profileImage || '',
        };

        setSaving(true);
        try {
            const response = await authFetch(`/user/update-profile/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            const responsePayload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(responsePayload.message || 'Failed to save your profile changes.');
            }

            const updatedProfile = responsePayload.user || responsePayload;
            const nextForm = buildInitialForm(updatedProfile);
            setProfile(updatedProfile);
            setFormData(nextForm);
            setInitialFormData(cloneFormState(nextForm));
            window.dispatchEvent(new Event('ngitify-profile-updated'));
            addToast('Your patient profile has been updated.', 'success');
            navigate('/patient/profile');
        } catch (saveFailure) {
            setSaveError(saveFailure.message || 'Failed to save your profile changes.');
        } finally {
            setSaving(false);
        }
    };

    const renderFieldError = (field) => (
        fieldErrors[field] ? <span className={styles.errorText}>{fieldErrors[field]}</span> : null
    );

    const renderInput = (label, field, options = {}) => (
        <div className={styles.formGroup} style={options.wide ? { flex: '1 1 100%' } : undefined}>
            <label>{label} {options.required ? <RequiredMark /> : null}</label>
            <input
                type={options.type || 'text'}
                className={`${styles.inputField} ${fieldErrors[field] ? styles.errorBorder : ''}`}
                value={formData[field] || ''}
                onChange={(event) => handleFieldChange(field, event.target.value)}
                max={options.max}
                maxLength={options.maxLength}
                placeholder={options.placeholder}
                disabled={saving || options.disabled}
            />
            {renderFieldError(field)}
        </div>
    );

    const renderTextarea = (label, field, options = {}) => (
        <div className={styles.formGroup} style={{ flex: '1 1 100%' }}>
            <label>{label} {options.required ? <RequiredMark /> : null}</label>
            <textarea
                className={`${styles.inputField} ${styles.textareaField} ${fieldErrors[field] ? styles.errorBorder : ''}`}
                value={formData[field] || ''}
                onChange={(event) => handleFieldChange(field, event.target.value)}
                disabled={saving}
            />
            {renderFieldError(field)}
        </div>
    );

    const renderSelect = (label, field, options, config = {}) => (
        <div className={styles.formGroup}>
            <label>{label} {config.required ? <RequiredMark /> : null}</label>
            <select
                className={`${styles.inputField} ${fieldErrors[field] ? styles.errorBorder : ''}`}
                value={formData[field] || ''}
                onChange={(event) => handleFieldChange(field, event.target.value)}
                disabled={saving || config.disabled}
            >
                <option value="">{config.placeholder || 'Select option'}</option>
                {optionListWithCurrent(options, formData[field]).map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            {renderFieldError(field)}
        </div>
    );

    const renderYesNo = (label, field, options = {}) => (
        <div className={styles.formGroup}>
            <label>{label} {options.required ? <RequiredMark /> : null}</label>
            <select
                className={`${styles.inputField} ${fieldErrors[field] ? styles.errorBorder : ''}`}
                value={formData[field] || ''}
                onChange={(event) => handleFieldChange(field, event.target.value)}
                disabled={saving}
            >
                {YES_NO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            {renderFieldError(field)}
        </div>
    );

    const renderCheckboxGroup = (label, field, options, otherField, config = {}) => (
        <div className={styles.formGroup} style={{ flex: '1 1 100%' }}>
            <label>{label} {config.required ? <RequiredMark /> : null}</label>
            <div className={styles.checkboxGrid}>
                {options.map((option) => (
                    <label key={option} className={styles.checkboxOption}>
                        <input
                            type="checkbox"
                            checked={(formData[field] || []).includes(option)}
                            onChange={() => handleCheckboxToggle(field, option)}
                            disabled={saving}
                        />
                        <span>{option}</span>
                    </label>
                ))}
            </div>
            {otherField ? (
                <input
                    className={`${styles.inputField} ${fieldErrors[field] ? styles.errorBorder : ''}`}
                    style={{ marginTop: '12px' }}
                    value={formData[otherField] || ''}
                    onChange={(event) => handleFieldChange(otherField, event.target.value)}
                    placeholder={config.otherPlaceholder || 'Other'}
                    disabled={saving}
                />
            ) : null}
            {renderFieldError(field)}
        </div>
    );

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#01538b' }}>
                    <h2>Loading Profile Form...</h2>
                </div>
            </div>
        );
    }

    if (error || !formData) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: '600' }}>
                    <p>{error || 'Your patient information could not be loaded.'}</p>
                    <button type="button" className={styles.editBtn} onClick={fetchProfile}>
                        TRY AGAIN
                    </button>
                </div>
            </div>
        );
    }

    const fullName = getFullName(profile || user);

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Edit Profile</h1>
                    <p className={styles.subtitle}>Update the patient details submitted during registration.</p>
                </div>
            </div>

            <div className={styles.card}>
                <form onSubmit={handleSave} noValidate>
                    <div className={styles.profileSection}>
                        <div className={styles.imageWrapper}>
                            <UserAvatar
                                user={{ name: fullName, profileImage: formData.profileImage }}
                                size={100}
                                style={{ border: '3px solid #2dccf6' }}
                            />
                            <div className={styles.imageOverlay} onClick={() => fileInputRef.current?.click()}>
                                CHANGE
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                        </div>
                        <div className={styles.profileText}>
                            <h2>{fullName || 'Patient'}</h2>
                            <span className={styles.roleTag}>Patient Account</span>
                        </div>
                    </div>

                    {saveError ? <div style={{ color: '#dc3545', fontWeight: 700, marginBottom: '18px' }}>{saveError}</div> : null}

                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                    <div className={styles.row}>
                        {renderInput('FIRST NAME', 'firstName', { required: true })}
                        {renderInput('MIDDLE NAME', 'middleName')}
                        {renderInput('LAST NAME', 'lastName', { required: true })}
                    </div>
                    <div className={styles.row}>
                        {renderInput('BIRTHDATE', 'birthdate', { type: 'date', max: new Date().toISOString().split('T')[0], required: true })}
                        {renderSelect('GENDER', 'gender', GENDER_OPTIONS, { required: true })}
                        {renderSelect('CIVIL STATUS', 'civilStatus', CIVIL_STATUS_OPTIONS)}
                    </div>
                    <div className={styles.row}>
                        {renderSelect('NATIONALITY', 'nationality', NATIONALITY_OPTIONS)}
                        {renderSelect('RELIGION', 'religion', RELIGION_OPTIONS)}
                        {renderSelect('OCCUPATION', 'occupation', OCCUPATION_OPTIONS)}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Contact and Consultation Details</h3>
                    <div className={styles.row}>
                        {renderInput('MOBILE NUMBER', 'contactNumber', { placeholder: '9xxxxxxxxx', maxLength: 10, required: true })}
                        {renderInput('HOME PHONE', 'homePhone', { placeholder: '1234567', maxLength: 8 })}
                        {renderInput('WORK PHONE', 'workPhone', { placeholder: '1234567', maxLength: 8 })}
                    </div>
                    <div className={styles.row}>
                        {renderInput('REFERRED BY', 'referredBy')}
                        {renderInput('REASON FOR CONSULTATION', 'reasonForConsultation', { wide: true })}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Emergency Contact and Guardian</h3>
                    <div className={styles.row}>
                        {renderInput('EMERGENCY CONTACT NAME', 'emergencyName', { required: true })}
                        {renderSelect('RELATIONSHIP', 'emergencyRelationship', RELATIONSHIP_OPTIONS, { required: true })}
                        {renderInput('EMERGENCY CONTACT NUMBER', 'emergencyPhone', { placeholder: '9xxxxxxxxx', maxLength: 10, required: true })}
                    </div>
                    <div className={styles.row}>
                        {renderInput('GUARDIAN NAME', 'guardianName')}
                        {renderSelect('GUARDIAN RELATIONSHIP', 'guardianRelationship', RELATIONSHIP_OPTIONS)}
                        {renderInput('GUARDIAN CONTACT NUMBER', 'guardianPhone', { placeholder: '9xxxxxxxxx', maxLength: 10 })}
                    </div>
                    <div className={styles.row}>
                        {renderSelect('GUARDIAN OCCUPATION', 'guardianOccupation', OCCUPATION_OPTIONS)}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Dental History</h3>
                    <div className={styles.row}>
                        {renderInput('LAST DENTAL VISIT', 'dentalLastExamDate', { type: 'date', max: new Date().toISOString().split('T')[0] })}
                        {renderYesNo('REACTION OR COMPLICATION AFTER DENTAL TREATMENT?', 'dentalHadTreatmentReaction', { required: true })}
                        {renderYesNo('PRIVATE OR CONFIDENTIAL INFORMATION TO DISCUSS IN PRIVATE?', 'dentalHasConfidentialInfo', { required: true })}
                    </div>
                    <div className={styles.row}>
                        {renderTextarea('IF YES, PLEASE DETAIL', 'dentalReactionDetails', { required: formData.dentalHadTreatmentReaction === 'yes' })}
                        {renderTextarea('DENTAL NOTES', 'dentalNotes')}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Physician Details</h3>
                    <div className={styles.row}>
                        {renderInput('PHYSICIAN NAME', 'physicianName')}
                        {renderSelect('SPECIALTY, IF APPLICABLE', 'physicianSpecialty', PHYSICIAN_SPECIALTY_OPTIONS)}
                        {renderInput('OFFICE NUMBER', 'physicianOfficeNumber', { placeholder: '1234567', maxLength: 8 })}
                    </div>
                    <div className={styles.row}>
                        {renderInput('OFFICE ADDRESS', 'physicianOfficeAddress', { wide: true })}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Medical History</h3>
                    <div className={styles.row}>
                        {renderSelect('BLOOD TYPE', 'bloodType', BLOOD_TYPE_OPTIONS)}
                        {renderYesNo('ARE YOU IN GOOD HEALTH?', 'inGoodHealth', { required: true })}
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('ARE YOU UNDER MEDICAL TREATMENT NOW?', 'underMedicalTreatment', { required: true })}
                        {renderInput('IF SO, WHAT IS THE CONDITION TREATED?', 'medicalTreatmentDetails', { required: formData.underMedicalTreatment === 'yes' })}
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('HAVE YOU EVER HAD SERIOUS ILLNESS OR SURGICAL OPERATION?', 'hadSeriousIllnessOrSurgery', { required: true })}
                        {renderInput('IF SO, WHAT IS THE ILLNESS OR OPERATION?', 'seriousIllnessOrSurgeryDetails', { required: formData.hadSeriousIllnessOrSurgery === 'yes' })}
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('HAVE YOU EVER BEEN HOSPITALIZED?', 'hadHospitalization', { required: true })}
                        {renderInput('IF SO, WHEN AND WHY?', 'hospitalizationDetails', { required: formData.hadHospitalization === 'yes' })}
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('ARE YOU TAKING ANY PRESCRIPTION/NON-PRESCRIPTION MEDICATION?', 'isTakingMedication', { required: true })}
                        {renderInput('IF SO, PLEASE SPECIFY', 'medications', { required: formData.isTakingMedication === 'yes' })}
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('DO YOU USE TOBACCO PRODUCTS?', 'usesTobacco', { required: true })}
                        {renderYesNo('DO YOU USE ALCOHOL, COCAINE, OR OTHER DANGEROUS DRUGS?', 'usesAlcoholOrDrugs', { required: true })}
                    </div>
                    <div className={styles.row}>
                        {renderYesNo('ARE YOU ALLERGIC TO ANY OF THE FOLLOWING?', 'hasAllergies', { required: true })}
                        <div className={styles.formGroup} />
                    </div>
                    <div className={styles.row}>
                        {renderCheckboxGroup('ALLERGIES', 'allergies', ALLERGY_OPTIONS, 'allergyOther', {
                            required: formData.hasAllergies === 'yes',
                            otherPlaceholder: 'Other allergy',
                        })}
                    </div>
                    <div className={styles.row}>
                        {renderInput('BLEEDING TIME', 'bleedingTime')}
                        {renderInput('BLOOD PRESSURE', 'bloodPressure', { placeholder: 'e.g. 120/80' })}
                    </div>
                    {formData.gender !== 'Male' ? (
                        <>
                            <div className={styles.row}>
                                {renderYesNo('ARE YOU PREGNANT?', 'isPregnant', { required: true })}
                                {renderYesNo('ARE YOU NURSING?', 'isNursing', { required: true })}
                            </div>
                            <div className={styles.row}>
                                {renderYesNo('ARE YOU TAKING BIRTH CONTROL PILLS?', 'takingBirthControl', { required: true })}
                                <div className={styles.formGroup} />
                            </div>
                        </>
                    ) : null}
                    <div className={styles.row}>
                        {renderCheckboxGroup('MEDICAL CONDITIONS', 'conditions', MEDICAL_CONDITION_OPTIONS, 'conditionOther', {
                            otherPlaceholder: 'Other condition',
                        })}
                    </div>
                    <div className={styles.row}>
                        {renderTextarea('MEDICAL NOTES', 'medicalNotes')}
                    </div>

                    <h3 className={styles.mainSectionTitle}>Home Address</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>REGION</label>
                            <select className={styles.inputField} value={formData.region} onChange={(event) => handleAddressChange('region', event.target.value)} disabled={saving}>
                                <option value="">Select region</option>
                                {regions.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>PROVINCE</label>
                            <select className={styles.inputField} value={formData.province} onChange={(event) => handleAddressChange('province', event.target.value)} disabled={saving || !formData.region}>
                                <option value="">Select province</option>
                                {availableProvinces.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CITY / MUNICIPALITY</label>
                            <select className={styles.inputField} value={formData.city} onChange={(event) => handleAddressChange('city', event.target.value)} disabled={saving || !formData.province}>
                                <option value="">Select city</option>
                                {availableCities.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>BARANGAY</label>
                            <select className={styles.inputField} value={formData.barangay} onChange={(event) => handleAddressChange('barangay', event.target.value)} disabled={saving || !formData.city}>
                                <option value="">Select barangay</option>
                                {availableBarangays.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className={styles.row}>
                        {renderInput('HOUSE NO. / BLK / LOT', 'houseNumber')}
                        {renderInput('STREET', 'street')}
                    </div>

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={() => navigate('/patient/profile')} disabled={saving}>
                            CANCEL
                        </button>
                        <button type="button" className={styles.cancelBtn} onClick={() => setFormData(cloneFormState(initialFormData))} disabled={saving || !hasChanges}>
                            RESET
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={saving || !hasChanges}>
                            {saving ? 'SAVING...' : 'SAVE CHANGES'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
