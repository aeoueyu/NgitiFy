import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryEditPatient.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import {
    PatientRegistrationSectionCard,
    PatientRegistrationStepper,
} from '../../components/patient/PatientRegistrationFlow';
import { PROFILE_IMAGE_SIZE_ERROR, readProfileImageAsDataUrl, isProfileImageTooLarge } from '../../utils/profileImageUpload';
import useRealtimeSystemEmailValidation from '../../hooks/useRealtimeSystemEmailValidation';
import {
    INVALID_EMAIL_ADDRESS_MESSAGE,
    INVALID_MOBILE_FORMAT_MESSAGE,
    REQUIRED_MESSAGE,
} from '../../utils/patientIntake';

const NON_VALIDATION_ERROR_KEYS = ['profileImage'];

const SECRETARY_PATIENT_STEPS = [
    {
        key: 'identity',
        label: 'Identity',
        description: 'Core patient details, address, and primary contact information.',
    },
    {
        key: 'contacts',
        label: 'Contacts',
        description: 'Guardian details and final patient review before saving.',
    },
];

const SECRETARY_PATIENT_SECTION_FIELDS = {
    0: [
        'firstName',
        'lastName',
        'birthdate',
        'gender',
        'email',
        'phone',
        'home_region',
        'home_province',
        'home_city',
        'home_barangay',
        'home_street',
        'home_houseNumber',
    ],
    1: [
        'guardianName',
        'guardianRelationship',
        'guardianContact',
    ],
};

const initialAddress = {
    country: 'Philippines', region: '', province: '',
    city: '', barangay: '', houseNumber: '', street: '',
};

export default function SecretaryEditPatient() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);
    const touchedFieldsRef = useRef({});

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);
    const [errors, setErrors] = useState({});
    const [initialData, setInitialData] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', gender: '', email: '', phone: '',
        guardianName: '', guardianRelationship: '', guardianContact: '',
        homeAddress: { ...initialAddress },
    });

    useRealtimeSystemEmailValidation({
        email: formData.email,
        excludeId: patientId,
        enabled: !isLoading && !isSaving,
        setErrors,
    });

    useEffect(() => {
        if (!patientId) return;
        const load = async () => {
            try {
                const res = await authFetch(`/patients/${patientId}`);
                if (!res.ok) throw new Error();
                const data = await res.json();

                let phone = data.contactNumber || '';
                if (phone.startsWith('+63')) phone = phone.slice(3);
                let guardianPhone = data.guardian?.contactNumber || '';
                if (guardianPhone.startsWith('+63')) guardianPhone = guardianPhone.slice(3);

                const birthdateValue = (data.birthdate || data.dob || data.dateOfBirth)
                    ? new Date(data.birthdate || data.dob || data.dateOfBirth).toISOString().split('T')[0]
                    : '';

                const homeAddress = { ...initialAddress, ...(data.homeAddress || data.currentAddress || data.permanentAddress || {}) };

                const filled = {
                    firstName: data.name?.first || '',
                    middleName: data.name?.middle || '',
                    lastName: data.name?.last || '',
                    birthdate: birthdateValue,
                    gender: data.gender || '',
                    email: data.email || '',
                    phone,
                    guardianName: data.guardian?.name || '',
                    guardianRelationship: data.guardian?.relationship || '',
                    guardianContact: guardianPhone,
                    homeAddress,
                };

                setFormData(filled);
                setInitialData(filled);
                if (data.profileImage) {
                    setProfileImage(data.profileImage);
                    setInitialProfileImage(data.profileImage);
                }
            } catch {
                addToast('Failed to load patient data.', 'error');
                navigate('/secretary/patients');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [patientId, navigate, addToast]);

    const hasChanges = initialData
        ? JSON.stringify(formData) !== JSON.stringify(initialData) || profileImage !== initialProfileImage
        : false;

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

    const toTitleCase = (str) =>
        str.toLowerCase().replace(/(?:^|\\s|-|\\.)\\S/g, (c) => c.toUpperCase());

    const getAge = (dateValue) => {
        const today = new Date();
        const birth = new Date(dateValue);
        let age = today.getFullYear() - birth.getFullYear();
        const monthOffset = today.getMonth() - birth.getMonth();
        if (monthOffset < 0 || (monthOffset === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;
    const maxDate = new Date().toISOString().split('T')[0];

    const markFieldsTouched = (fieldKeys = []) => {
        const nextTouched = { ...touchedFieldsRef.current };
        let hasChanges = false;

        fieldKeys.forEach((fieldKey) => {
            if (!fieldKey || nextTouched[fieldKey]) return;
            nextTouched[fieldKey] = true;
            hasChanges = true;
        });

        if (hasChanges) {
            touchedFieldsRef.current = nextTouched;
        }
    };

    const getValidationErrors = () => {
        const newErrors = {};
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        if (isMinor) {
            required.push('guardianName', 'guardianRelationship');
            if (!formData.guardianContact) newErrors.guardianContact = REQUIRED_MESSAGE;
            else if (formData.guardianContact.length !== 10 || formData.guardianContact[0] !== '9') {
                newErrors.guardianContact = INVALID_MOBILE_FORMAT_MESSAGE;
            }
        }

        required.forEach((field) => {
            if (!formData[field]) newErrors[field] = REQUIRED_MESSAGE;
        });

        if (!formData.phone) newErrors.phone = REQUIRED_MESSAGE;
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9') {
            newErrors.phone = INVALID_MOBILE_FORMAT_MESSAGE;
        }

        if (formData.email && !validateEmail(formData.email)) {
            newErrors.email = INVALID_EMAIL_ADDRESS_MESSAGE;
        }

        ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
            if (!formData.homeAddress[field]) newErrors[`home_${field}`] = REQUIRED_MESSAGE;
        });

        return newErrors;
    };

    const syncFormErrors = (currentFormData = formData, { keys = null, reveal = false } = {}) => {
        const validationErrors = getValidationErrors(currentFormData);
        setErrors((prev) => {
            const preservedEntries = Object.entries(prev).filter(([key]) => NON_VALIDATION_ERROR_KEYS.includes(key));
            const next = Object.fromEntries(preservedEntries);
            const candidateKeys = keys
                ? [...new Set(keys)]
                : [...new Set([
                    ...Object.keys(validationErrors),
                    ...Object.keys(prev).filter((key) => !NON_VALIDATION_ERROR_KEYS.includes(key)),
                ])];

            candidateKeys.forEach((key) => {
                const shouldDisplay = reveal || touchedFieldsRef.current[key] || Boolean(prev[key]);
                if (!shouldDisplay) return;
                if (validationErrors[key]) next[key] = validationErrors[key];
            });

            return next;
        });

        return validationErrors;
    };

    const revalidateFields = (nextFormData, fieldKeys = []) => {
        if (!fieldKeys.length) return;
        syncFormErrors(nextFormData, { keys: fieldKeys });
    };

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        let nextValue = value;
        const nameFields = ['firstName', 'middleName', 'lastName', 'guardianName'];
        if (nameFields.includes(name)) {
            if (value !== '' && !/^[a-zA-Z\\s.-]+$/.test(value)) return;
            nextValue = toTitleCase(value);
        }

        const nextFormData = { ...formData, [name]: nextValue };
        setFormData(nextFormData);
        revalidateFields(nextFormData, [name]);
    };

    const handlePhoneChange = (field) => (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        const nextFormData = { ...formData, [field]: value };
        setFormData(nextFormData);
        revalidateFields(nextFormData, [field]);
    };

    const handleBlur = (e) => {
        const fieldKey = e.target.name;
        if (!fieldKey) return;
        markFieldsTouched([fieldKey]);
        syncFormErrors(formData, { keys: [fieldKey] });
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (isProfileImageTooLarge(file)) {
            setErrors((prev) => ({ ...prev, profileImage: PROFILE_IMAGE_SIZE_ERROR }));
            e.target.value = '';
            return;
        }
        try {
            setErrors((prev) => {
                const next = { ...prev };
                delete next.profileImage;
                return next;
            });
            setProfileImage(await readProfileImageAsDataUrl(file));
        } catch {
            setErrors((prev) => ({ ...prev, profileImage: 'Failed to read the selected image.' }));
        }
    };

    const handleAddressChange = (field, value) => {
        const updated = { ...formData.homeAddress, [field]: value };
        if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
        if (field === 'province') { updated.city = ''; updated.barangay = ''; }
        if (field === 'city') { updated.barangay = ''; }

        const nextFormData = { ...formData, homeAddress: updated };
        setFormData(nextFormData);

        const addressFieldsToRevalidate = [`home_${field}`];
        if (field === 'region') addressFieldsToRevalidate.push('home_province', 'home_city', 'home_barangay');
        if (field === 'province') addressFieldsToRevalidate.push('home_city', 'home_barangay');
        if (field === 'city') addressFieldsToRevalidate.push('home_barangay');

        revalidateFields(nextFormData, addressFieldsToRevalidate);
    };

    const focusFirstStepError = (stepIndex, fieldKeys = []) => {
        if (!fieldKeys.length) return;
        const firstKey = fieldKeys[0];
        if (stepIndex !== currentStep) setCurrentStep(stepIndex);

        setTimeout(() => {
            const el = document.getElementsByName(firstKey)[0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            }
        }, 0);
    };

    const validateForm = () => {
        markFieldsTouched(Object.keys(getValidationErrors(formData)));
        const newErrors = syncFormErrors(formData, { reveal: true });
        const isValid = Object.keys(newErrors).length === 0;
        if (!isValid) {
            const el = document.getElementsByName(Object.keys(newErrors)[0])[0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            }
        }
        return isValid;
    };

    const handleStepAdvance = (targetStep = currentStep + 1) => {
        const nextErrors = getValidationErrors();
        const currentStepFields = SECRETARY_PATIENT_SECTION_FIELDS[currentStep] || [];
        const currentStepErrors = Object.keys(nextErrors).filter((key) => currentStepFields.includes(key));

        markFieldsTouched(currentStepFields);
        syncFormErrors(formData, { keys: currentStepFields, reveal: true });

        if (currentStepErrors.length > 0) {
            focusFirstStepError(currentStep, currentStepErrors);
            return;
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSaving(true);

        const payload = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email,
            contactNumber: `+63${formData.phone}`,
            birthdate: formData.birthdate,
            gender: formData.gender,
            profileImage,
            guardian: isMinor ? {
                name: formData.guardianName,
                relationship: formData.guardianRelationship,
                contactNumber: `+63${formData.guardianContact}`,
            } : null,
            homeAddress: { country: 'Philippines', ...formData.homeAddress },
        };

        try {
            const res = await authFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) {
                setShowSuccess(true);
            } else if (res.status === 409) {
                setErrors((prev) => ({ ...prev, [data.field]: data.message }));
            } else {
                addToast(data.message || 'Failed to update patient.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const renderAddress = (title, disabled = false) => {
        const addr = formData.homeAddress;
        const prefix = 'home';
        const availableProvinces = addr.region ? provinces[addr.region] || [] : [];
        const availableCities = addr.province ? cities[addr.province] || [] : [];
        const availableBarangays = addr.city ? barangays[addr.city] || [] : [];
        const errorFor = (field) => errors[`${prefix}_${field}`];
        const errorClass = (field) => errorFor(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                {title && <h3 className={styles.sectionTitle}>{title}</h3>}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>REGION <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_region`} className={`${styles.inputField} ${errorClass('region')}`} value={addr.region} onChange={(e) => handleAddressChange('region', e.target.value)} disabled={disabled || isSaving}>
                            <option value="" hidden>Select Region</option>
                            {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
                        </select>
                        {errorFor('region') && <span className={styles.errorText}>{errorFor('region')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>PROVINCE <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_province`} className={`${styles.inputField} ${errorClass('province')}`} value={addr.province} onChange={(e) => handleAddressChange('province', e.target.value)} disabled={disabled || !addr.region || isSaving}>
                            <option value="" hidden>Select Province</option>
                            {availableProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                        </select>
                        {errorFor('province') && <span className={styles.errorText}>{errorFor('province')}</span>}
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>CITY / MUNICIPALITY <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_city`} className={`${styles.inputField} ${errorClass('city')}`} value={addr.city} onChange={(e) => handleAddressChange('city', e.target.value)} disabled={disabled || !addr.province || isSaving}>
                            <option value="" hidden>Select City</option>
                            {availableCities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
                        </select>
                        {errorFor('city') && <span className={styles.errorText}>{errorFor('city')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>BARANGAY <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_barangay`} className={`${styles.inputField} ${errorClass('barangay')}`} value={addr.barangay} onChange={(e) => handleAddressChange('barangay', e.target.value)} disabled={disabled || !addr.city || isSaving}>
                            <option value="" hidden>Select Barangay</option>
                            {availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                        </select>
                        {errorFor('barangay') && <span className={styles.errorText}>{errorFor('barangay')}</span>}
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>STREET <span className={styles.req}>*</span></label>
                        <input name={`${prefix}_street`} className={`${styles.inputField} ${errorClass('street')}`} value={addr.street} onChange={(e) => handleAddressChange('street', e.target.value)} disabled={disabled || isSaving} maxLength={100} placeholder="e.g. Mabini St." />
                        {errorFor('street') && <span className={styles.errorText}>{errorFor('street')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>HOUSE NO. <span className={styles.req}>*</span></label>
                        <input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${errorClass('houseNumber')}`} value={addr.houseNumber} onChange={(e) => handleAddressChange('houseNumber', e.target.value)} disabled={disabled || isSaving} maxLength={20} placeholder="e.g. Unit 123" />
                        {errorFor('houseNumber') && <span className={styles.errorText}>{errorFor('houseNumber')}</span>}
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.loadingState}>Loading patient data...</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={() => navigate(`/secretary/patients/${patientId}`)} disabled={isSaving}>
                    <FaArrowLeft /> Back to Profile
                </button>
                <div>
                    <h1 className={styles.pageTitle}>Edit Patient Profile</h1>
                    <p className={styles.pageSubtitle}>Update the patient's demographic and contact information.</p>
                </div>
            </div>

            <div className={styles.formCard}>
                <form onSubmit={handleSubmit} onBlurCapture={handleBlur} noValidate>
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={() => fileInputRef.current.click()}>
                            {profileImage
                                ? <img src={profileImage} alt="Profile" className={styles.previewImage} />
                                : <div className={styles.uploadPlaceholder}><span>Upload Photo</span><span className={styles.uploadHint}>Click to change</span></div>}
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                        {errors.profileImage && <span className={styles.errorText}>{errors.profileImage}</span>}
                    </div>

                    <PatientRegistrationStepper
                        steps={SECRETARY_PATIENT_STEPS}
                        currentIndex={currentStep}
                        onStepSelect={handleStepSelect}
                        isStepLocked={(index) => isSaving || index > currentStep + 1}
                    />

                    {currentStep === 0 && (
                        <PatientRegistrationSectionCard
                            eyebrow="Identity"
                            title="Patient Details"
                            description="Update the patient's identity, address, and primary contact details before moving on."
                        >
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>FIRST NAME <span className={styles.req}>*</span></label>
                                    <input name="firstName" className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isSaving} />
                                    {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>MIDDLE NAME</label>
                                    <input name="middleName" className={styles.inputField} value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>LAST NAME <span className={styles.req}>*</span></label>
                                    <input name="lastName" className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving} />
                                    {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>BIRTHDATE <span className={styles.req}>*</span></label>
                                    <input type="date" name="birthdate" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} value={formData.birthdate} onChange={handlePersonalChange} max={maxDate} disabled={isSaving} />
                                    {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>AGE</label>
                                    <input className={styles.inputField} value={formData.birthdate ? getAge(formData.birthdate) : ''} readOnly disabled />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>GENDER <span className={styles.req}>*</span></label>
                                    <select name="gender" className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} value={formData.gender} onChange={handlePersonalChange} disabled={isSaving}>
                                        <option value="" hidden>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                    {errors.gender && <span className={styles.errorText}>{errors.gender}</span>}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>EMAIL ADDRESS <span className={styles.req}>*</span></label>
                                    <input type="email" name="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} value={formData.email} onChange={handlePersonalChange} maxLength={100} disabled={isSaving} />
                                    {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>PHONE NUMBER <span className={styles.req}>*</span></label>
                                    <div className={`${styles.phoneGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input name="phone" className={styles.phoneField} value={formData.phone} onChange={handlePhoneChange('phone')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} />
                                    </div>
                                    {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                                </div>
                                <div className={styles.formGroup} />
                            </div>

                            {renderAddress('Home Address')}

                            <div className={styles.buttonRow}>
                                <button type="button" className={styles.cancelBtn} onClick={() => navigate(`/secretary/patients/${patientId}`)} disabled={isSaving}>
                                    Cancel
                                </button>
                                <button type="button" className={styles.submitBtn} onClick={() => handleStepAdvance(1)} disabled={isSaving}>
                                    Continue to Contacts
                                </button>
                            </div>
                        </PatientRegistrationSectionCard>
                    )}

                    {currentStep === 1 && (
                        <PatientRegistrationSectionCard
                            eyebrow="Contacts"
                            title="Guardian and Review"
                            description="Review the patient details and update guardian information if the patient is still a minor."
                        >
                            {isMinor ? (
                                <>
                                    <div className={styles.row}>
                                        <div className={styles.formGroup}>
                                            <label>GUARDIAN NAME <span className={styles.req}>*</span></label>
                                            <input name="guardianName" className={`${styles.inputField} ${errors.guardianName ? styles.errorBorder : ''}`} value={formData.guardianName} onChange={handlePersonalChange} maxLength={70} disabled={isSaving} placeholder="Full Name" />
                                            {errors.guardianName && <span className={styles.errorText}>{errors.guardianName}</span>}
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>RELATIONSHIP <span className={styles.req}>*</span></label>
                                            <input name="guardianRelationship" className={`${styles.inputField} ${errors.guardianRelationship ? styles.errorBorder : ''}`} value={formData.guardianRelationship} onChange={handlePersonalChange} maxLength={30} disabled={isSaving} placeholder="e.g. Mother, Father" />
                                            {errors.guardianRelationship && <span className={styles.errorText}>{errors.guardianRelationship}</span>}
                                        </div>
                                    </div>
                                    <div className={styles.row}>
                                        <div className={styles.formGroup}>
                                            <label>GUARDIAN PHONE <span className={styles.req}>*</span></label>
                                            <div className={`${styles.phoneGroup} ${errors.guardianContact ? styles.errorBorder : ''}`}>
                                                <span className={styles.phonePrefix}>+63</span>
                                                <input name="guardianContact" className={styles.phoneField} value={formData.guardianContact} onChange={handlePhoneChange('guardianContact')} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} />
                                            </div>
                                            {errors.guardianContact && <span className={styles.errorText}>{errors.guardianContact}</span>}
                                        </div>
                                        <div className={styles.formGroup} />
                                    </div>
                                </>
                            ) : (
                                <div className={styles.infoPanel}>
                                    <strong>No guardian details required.</strong>
                                    <span>The patient is 18 or older based on the current birthdate.</span>
                                </div>
                            )}

                            <div className={styles.reviewCard}>
                                <div className={styles.reviewGrid}>
                                    <div>
                                        <span className={styles.reviewLabel}>Patient</span>
                                        <strong>{[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') || 'Not provided'}</strong>
                                    </div>
                                    <div>
                                        <span className={styles.reviewLabel}>Email</span>
                                        <strong>{formData.email || 'Not provided'}</strong>
                                    </div>
                                    <div>
                                        <span className={styles.reviewLabel}>Mobile</span>
                                        <strong>{formData.phone ? `+63${formData.phone}` : 'Not provided'}</strong>
                                    </div>
                                    <div>
                                        <span className={styles.reviewLabel}>Changes</span>
                                        <strong>{hasChanges ? 'Unsaved updates ready' : 'No changes yet'}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.buttonRow}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setCurrentStep(0)} disabled={isSaving}>
                                    Back to Identity
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </PatientRegistrationSectionCard>
                    )}
                </form>
            </div>

            {showSuccess && (
                <div className={styles.successOverlay}>
                    <div className={styles.successCard}>
                        <FaCheckCircle className={styles.successIcon} />
                        <h3 className={styles.successTitle}>Profile Updated!</h3>
                        <p className={styles.successMsg}>The patient's information has been successfully updated.</p>
                        <button className={styles.successBtn} onClick={() => navigate(`/secretary/patients/${patientId}`)}>
                            Back to Profile
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
