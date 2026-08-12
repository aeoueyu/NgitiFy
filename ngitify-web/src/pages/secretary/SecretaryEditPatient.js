import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryEditPatient.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { PROFILE_IMAGE_SIZE_ERROR, readProfileImageAsDataUrl, isProfileImageTooLarge } from '../../utils/profileImageUpload';
import useRealtimeSystemEmailValidation from '../../hooks/useRealtimeSystemEmailValidation';
import {
    INVALID_EMAIL_ADDRESS_MESSAGE,
    INVALID_MOBILE_FORMAT_MESSAGE,
    REQUIRED_MESSAGE,
} from '../../utils/patientIntake';

const NON_VALIDATION_ERROR_KEYS = ['profileImage'];

const initialAddress = {
    country: 'Philippines', region: '', province: '',
    city: '', barangay: '', houseNumber: '', street: '',
};

export default function SecretaryEditPatient() {
    const { patientId } = useParams();
    const navigate      = useNavigate();
    const { addToast }  = useToast();
    const fileInputRef  = useRef(null);

    const [isLoading, setIsLoading]         = useState(true);
    const [isSaving, setIsSaving]           = useState(false);
    const [showSuccess, setShowSuccess]     = useState(false);
    const [profileImage, setProfileImage]   = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);
    const [errors, setErrors]               = useState({});
    const [initialData, setInitialData]     = useState(null);

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

    // ── Load patient data ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!patientId) return;
        const load = async () => {
            try {
                const res = await authFetch(`/patients/${patientId}`);
                if (!res.ok) throw new Error();
                const d = await res.json();

                let phone = d.contactNumber || '';
                if (phone.startsWith('+63')) phone = phone.slice(3);
                let guardianPhone = d.guardian?.contactNumber || '';
                if (guardianPhone.startsWith('+63')) guardianPhone = guardianPhone.slice(3);

                const dob = (d.birthdate || d.dob || d.dateOfBirth)
                    ? new Date(d.birthdate || d.dob || d.dateOfBirth).toISOString().split('T')[0]
                    : '';

                const homeAddress = { ...initialAddress, ...(d.homeAddress || d.currentAddress || d.permanentAddress || {}) };

                const filled = {
                    firstName:            d.name?.first    || '',
                    middleName:           d.name?.middle   || '',
                    lastName:             d.name?.last     || '',
                    birthdate:            dob,
                    gender:               d.gender         || '',
                    email:                d.email          || '',
                    phone,
                    guardianName:         d.guardian?.name         || '',
                    guardianRelationship: d.guardian?.relationship || '',
                    guardianContact:      guardianPhone,
                    homeAddress,
                };
                setFormData(filled);
                setInitialData(filled);
                if (d.profileImage) {
                    setProfileImage(d.profileImage);
                    setInitialProfileImage(d.profileImage);
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

    // ── Helpers ───────────────────────────────────────────────────────────────
    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
    };

    const toTitleCase = (str) =>
        str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, c => c.toUpperCase());

    const getAge = (d) => {
        const today = new Date(); const birth = new Date(d);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const isMinor = formData.birthdate && getAge(formData.birthdate) < 18;
    const maxDate  = new Date().toISOString().split('T')[0];

    const clearError = (key) =>
        setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        clearError(name);
        const nameFields = ['firstName','middleName','lastName','guardianName'];
        if (nameFields.includes(name)) {
            if (value === '' || /^[a-zA-Z\s.-]+$/.test(value))
                setFormData(prev => ({ ...prev, [name]: toTitleCase(value) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (field) => (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 10) return;
        clearError(field);
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if (name === 'email') {
            if (!value) setErrors(p => ({ ...p, email: REQUIRED_MESSAGE }));
            else if (!validateEmail(value)) setErrors(p => ({ ...p, email: INVALID_EMAIL_ADDRESS_MESSAGE }));
        }
        if (name === 'phone' || name === 'guardianContact') {
            if (!value) setErrors(p => ({ ...p, [name]: REQUIRED_MESSAGE }));
            else if (value.length !== 10 || value[0] !== '9')
                setErrors(p => ({ ...p, [name]: INVALID_MOBILE_FORMAT_MESSAGE }));
        }
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

    const handleAddressChange = (field, value) => {
        clearError(`home_${field}`);
        setFormData(prev => {
            const updated = { ...prev.homeAddress, [field]: value };
            if (field === 'region')   { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            if (field === 'city')     { updated.barangay = ''; }
            return { ...prev, homeAddress: updated };
        });
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const getValidationErrors = () => {
        const newErrors = {};
        const required = ['firstName','lastName','birthdate','email'];
        if (isMinor) {
            required.push('guardianName','guardianRelationship');
            if (!formData.guardianContact) { newErrors.guardianContact = REQUIRED_MESSAGE; }
            else if (formData.guardianContact.length !== 10 || formData.guardianContact[0] !== '9')
                { newErrors.guardianContact = INVALID_MOBILE_FORMAT_MESSAGE; }
        }
        required.forEach(f => { if (!formData[f]) { newErrors[f] = REQUIRED_MESSAGE; } });
        if (!formData.phone) { newErrors.phone = REQUIRED_MESSAGE; }
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9')
            { newErrors.phone = INVALID_MOBILE_FORMAT_MESSAGE; }
        if (formData.email && !validateEmail(formData.email))
            { newErrors.email = INVALID_EMAIL_ADDRESS_MESSAGE; }

        const validateAddr = (addr, prefix) => {
            ['region','province','city','barangay','street','houseNumber'].forEach(f => {
                if (!addr[f]) { newErrors[`${prefix}_${f}`] = REQUIRED_MESSAGE; }
            });
        };
        validateAddr(formData.homeAddress, 'home');
        return newErrors;
    };

    const syncFormErrors = () => {
        const newErrors = getValidationErrors();
        setErrors((prev) => ({
            ...Object.fromEntries(Object.entries(prev).filter(([key]) => NON_VALIDATION_ERROR_KEYS.includes(key))),
            ...newErrors,
        }));
        return newErrors;
    };

    useEffect(() => {
        if (!isLoading) syncFormErrors();
    }, [formData, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const validateForm = () => {
        const newErrors = syncFormErrors();
        const isValid = Object.keys(newErrors).length === 0;
        if (!isValid) {
            const el = document.getElementsByName(Object.keys(newErrors)[0])[0];
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
        return isValid;
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSaving(true);

        const payload = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email:         formData.email,
            contactNumber: `+63${formData.phone}`,
            birthdate:     formData.birthdate,
            gender:        formData.gender,
            profileImage,
            guardian: isMinor ? {
                name:          formData.guardianName,
                relationship:  formData.guardianRelationship,
                contactNumber: `+63${formData.guardianContact}`,
            } : null,
            homeAddress: { country: 'Philippines', ...formData.homeAddress },
        };

        try {
            const res  = await authFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) {
                setShowSuccess(true);
            } else if (res.status === 409) {
                setErrors(prev => ({ ...prev, [data.field]: data.message }));
            } else {
                addToast(data.message || 'Failed to update patient.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Address renderer ──────────────────────────────────────────────────────
    const renderAddress = (title, disabled = false) => {
        const addr   = formData.homeAddress;
        const prefix = 'home';
        const availProvinces = addr.region   ? provinces[addr.region]   || [] : [];
        const availCities    = addr.province ? cities[addr.province]    || [] : [];
        const availBarangays = addr.city     ? barangays[addr.city]     || [] : [];
        const err = (f) => errors[`${prefix}_${f}`];
        const ec  = (f) => err(f) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                {title && <h3 className={styles.sectionTitle}>{title}</h3>}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>REGION <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_region`} className={`${styles.inputField} ${ec('region')}`}
                            value={addr.region} onChange={e => handleAddressChange('region', e.target.value)}
                            disabled={disabled || isSaving}>
                            <option value="" hidden>Select Region</option>
                            {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                        </select>
                        {err('region') && <span className={styles.errorText}>{err('region')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>PROVINCE <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_province`} className={`${styles.inputField} ${ec('province')}`}
                            value={addr.province} onChange={e => handleAddressChange('province', e.target.value)}
                            disabled={disabled || !addr.region || isSaving}>
                            <option value="" hidden>Select Province</option>
                            {availProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                        {err('province') && <span className={styles.errorText}>{err('province')}</span>}
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>CITY / MUNICIPALITY <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_city`} className={`${styles.inputField} ${ec('city')}`}
                            value={addr.city} onChange={e => handleAddressChange('city', e.target.value)}
                            disabled={disabled || !addr.province || isSaving}>
                            <option value="" hidden>Select City</option>
                            {availCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                        {err('city') && <span className={styles.errorText}>{err('city')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>BARANGAY <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_barangay`} className={`${styles.inputField} ${ec('barangay')}`}
                            value={addr.barangay} onChange={e => handleAddressChange('barangay', e.target.value)}
                            disabled={disabled || !addr.city || isSaving}>
                            <option value="" hidden>Select Barangay</option>
                            {availBarangays.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {err('barangay') && <span className={styles.errorText}>{err('barangay')}</span>}
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>STREET <span className={styles.req}>*</span></label>
                        <input name={`${prefix}_street`} className={`${styles.inputField} ${ec('street')}`}
                            value={addr.street} onChange={e => handleAddressChange('street', e.target.value)}
                            disabled={disabled || isSaving} maxLength={100} placeholder="e.g. Mabini St." />
                        {err('street') && <span className={styles.errorText}>{err('street')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>HOUSE NO. <span className={styles.req}>*</span></label>
                        <input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${ec('houseNumber')}`}
                            value={addr.houseNumber} onChange={e => handleAddressChange('houseNumber', e.target.value)}
                            disabled={disabled || isSaving} maxLength={20} placeholder="e.g. Unit 123" />
                        {err('houseNumber') && <span className={styles.errorText}>{err('houseNumber')}</span>}
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className={styles.page}>
            <div className={styles.loadingState}>Loading patient data…</div>
        </div>
    );

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
                <form onSubmit={handleSubmit} noValidate>

                    {/* Photo */}
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={() => fileInputRef.current.click()}>
                            {profileImage
                                ? <img src={profileImage} alt="Profile" className={styles.previewImage} />
                                : <div className={styles.uploadPlaceholder}><span>Upload Photo</span><span className={styles.uploadHint}>Click to change</span></div>
                            }
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                        {errors.profileImage && <span className={styles.errorText}>{errors.profileImage}</span>}
                    </div>

                    {/* Personal Info */}
                    <h3 className={styles.sectionHeader}>Personal Information</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span className={styles.req}>*</span></label>
                            <input name="firstName" className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`}
                                value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isSaving} />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>MIDDLE NAME</label>
                            <input name="middleName" className={styles.inputField}
                                value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span className={styles.req}>*</span></label>
                            <input name="lastName" className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`}
                                value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving} />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BIRTHDATE <span className={styles.req}>*</span></label>
                            <input type="date" name="birthdate"
                                className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`}
                                value={formData.birthdate} onChange={handlePersonalChange} max={maxDate} disabled={isSaving} />
                            {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>GENDER <span className={styles.req}>*</span></label>
                            <select name="gender" className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`}
                                value={formData.gender} onChange={handlePersonalChange} disabled={isSaving}>
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
                            <input type="email" name="email"
                                className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`}
                                value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur}
                                maxLength={100} disabled={isSaving} />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER <span className={styles.req}>*</span></label>
                            <div className={`${styles.phoneGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input name="phone" className={styles.phoneField}
                                    value={formData.phone} onChange={handlePhoneChange('phone')}
                                    onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Guardian */}
                    {isMinor && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.sectionHeader}>Guardian Information</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>GUARDIAN NAME <span className={styles.req}>*</span></label>
                                    <input name="guardianName"
                                        className={`${styles.inputField} ${errors.guardianName ? styles.errorBorder : ''}`}
                                        value={formData.guardianName} onChange={handlePersonalChange}
                                        maxLength={70} disabled={isSaving} placeholder="Full Name" />
                                    {errors.guardianName && <span className={styles.errorText}>{errors.guardianName}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>RELATIONSHIP <span className={styles.req}>*</span></label>
                                    <input name="guardianRelationship"
                                        className={`${styles.inputField} ${errors.guardianRelationship ? styles.errorBorder : ''}`}
                                        value={formData.guardianRelationship} onChange={handlePersonalChange}
                                        maxLength={30} disabled={isSaving} placeholder="e.g. Mother, Father" />
                                    {errors.guardianRelationship && <span className={styles.errorText}>{errors.guardianRelationship}</span>}
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>GUARDIAN PHONE <span className={styles.req}>*</span></label>
                                    <div className={`${styles.phoneGroup} ${errors.guardianContact ? styles.errorBorder : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input name="guardianContact" className={styles.phoneField}
                                            value={formData.guardianContact} onChange={handlePhoneChange('guardianContact')}
                                            onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} />
                                    </div>
                                    {errors.guardianContact && <span className={styles.errorText}>{errors.guardianContact}</span>}
                                </div>
                                <div className={styles.formGroup} />
                            </div>
                        </>
                    )}

                    {/* Address */}
                    <hr className={styles.divider} />
                    {renderAddress('Home Address')}

                    {/* Buttons */}
                    <div className={styles.buttonRow}>
                        <button type="button" className={styles.cancelBtn}
                            onClick={() => navigate(`/secretary/patients/${patientId}`)} disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
                            {isSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
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
