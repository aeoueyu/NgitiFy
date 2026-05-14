import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryAddPatient.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { formatPatientDuplicateLine, getPatientDuplicateSections } from '../../utils/patientDuplicateWarnings';

export default function SecretaryAddPatient() {
    const navigate  = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);

    const [profileImage, setProfileImage]   = useState(null);
    const [isSameAddress, setIsSameAddress] = useState(false);
    const [isLoading, setIsLoading]         = useState(false);
    const [showSuccess, setShowSuccess]     = useState(false);
    const [errors, setErrors]               = useState({});
    const [duplicateSummary, setDuplicateSummary] = useState(null);
    const [softDuplicateConfirmed, setSoftDuplicateConfirmed] = useState(false);

    const initialAddress = {
        country: 'Philippines', region: '', province: '',
        city: '', barangay: '', houseNumber: '', street: '',
    };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', gender: '', email: '', phone: '',
        guardianName: '', guardianRelationship: '', guardianContact: '',
        currentAddress:   { ...initialAddress },
        permanentAddress: { ...initialAddress },
    });

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

    // ── Input handlers ────────────────────────────────────────────────────────
    const clearError = (key) =>
        setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        clearError(name);
        const nameFields = ['firstName', 'middleName', 'lastName', 'guardianName'];
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
            if (!value) setErrors(prev => ({ ...prev, email: 'Required' }));
            else if (!validateEmail(value)) setErrors(prev => ({ ...prev, email: 'Enter a valid email address.' }));
        }
        if (name === 'phone' || name === 'guardianContact') {
            if (!value) setErrors(prev => ({ ...prev, [name]: 'Required' }));
            else if (value.length !== 10 || value[0] !== '9')
                setErrors(prev => ({ ...prev, [name]: 'Invalid format (9xxxxxxxxx)' }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
    };

    const handleAddressChange = (type, field, value) => {
        const prefix = type === 'currentAddress' ? 'current' : 'permanent';
        clearError(`${prefix}_${field}`);
        setFormData(prev => {
            const updated = { ...prev[type], [field]: value };
            if (field === 'region')   { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            if (field === 'city')     { updated.barangay = ''; }
            if (type === 'currentAddress' && isSameAddress)
                return { ...prev, currentAddress: updated, permanentAddress: updated };
            return { ...prev, [type]: updated };
        });
    };

    const handleSameAddressToggle = (e) => {
        const checked = e.target.checked;
        setIsSameAddress(checked);
        if (checked) {
            setFormData(prev => ({ ...prev, permanentAddress: { ...prev.currentAddress } }));
            setErrors(prev => {
                const n = { ...prev };
                Object.keys(n).forEach(k => { if (k.startsWith('permanent_')) delete n[k]; });
                return n;
            });
        } else {
            setFormData(prev => ({ ...prev, permanentAddress: { ...initialAddress } }));
        }
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const validateForm = () => {
        const newErrors = {};
        let isValid = true;

        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        if (isMinor) {
            required.push('guardianName', 'guardianRelationship');
            if (!formData.guardianContact) { newErrors.guardianContact = 'Required'; isValid = false; }
            else if (formData.guardianContact.length !== 10 || formData.guardianContact[0] !== '9')
                { newErrors.guardianContact = 'Invalid format'; isValid = false; }
        }

        required.forEach(f => { if (!formData[f]) { newErrors[f] = 'Required'; isValid = false; } });

        if (!formData.phone) { newErrors.phone = 'Required'; isValid = false; }
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9')
            { newErrors.phone = 'Invalid format'; isValid = false; }

        if (formData.email && !validateEmail(formData.email))
            { newErrors.email = 'Invalid email address.'; isValid = false; }

        const validateAddr = (addr, prefix) => {
            ['region','province','city','barangay','street','houseNumber'].forEach(f => {
                if (!addr[f]) { newErrors[`${prefix}_${f}`] = 'Required'; isValid = false; }
            });
        };
        validateAddr(formData.currentAddress, 'current');
        if (!isSameAddress) validateAddr(formData.permanentAddress, 'permanent');

        setErrors(newErrors);

        if (!isValid) {
            const firstKey = Object.keys(newErrors)[0];
            const el = document.getElementsByName(firstKey)[0];
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
        return isValid;
    };

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

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const payload = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email:         formData.email,
            contactNumber: `+63${formData.phone}`,
            birthdate:     formData.birthdate,
            gender:        formData.gender,
            profileImage,
            assignedBranch: user?.assignedBranch || undefined,
            assignedBranches: user?.assignedBranch ? [user.assignedBranch] : [],
            guardian: isMinor ? {
                name:          formData.guardianName,
                relationship:  formData.guardianRelationship,
                contactNumber: `+63${formData.guardianContact}`,
            } : null,
            currentAddress:   { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress
                ? { country: 'Philippines', ...formData.currentAddress }
                : { country: 'Philippines', ...formData.permanentAddress },
        };
        setIsLoading(true);

        try {
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
                            ? 'This mobile number is already used by multiple patient records. Review the duplicate warning before creating a new patient record.'
                            : 'This mobile number already appears on an existing patient record. Review the duplicate warning before creating a new patient record.',
                    }));
                    setIsLoading(false);
                    return;
                }
            }

            const res  = await authFetch('/add-patient', { method: 'POST', body: JSON.stringify(payload) });
            const data = await res.json();

            if (res.ok) {
                setShowSuccess(true);
            } else if (res.status === 409) {
                if (data.duplicateSummary) setDuplicateSummary(data.duplicateSummary);
                const nextField = data.field || 'duplicateCheck';
                setErrors(prev => ({ ...prev, [nextField]: data.message }));
                const el = document.getElementsByName(nextField)[0];
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
            } else {
                addToast(data.message || 'Failed to register patient.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Address section renderer ──────────────────────────────────────────────
    const renderAddress = (type, title, disabled = false) => {
        const addr   = formData[type];
        const prefix = type === 'currentAddress' ? 'current' : 'permanent';
        const availProvinces  = addr.region   ? provinces[addr.region]    || [] : [];
        const availCities     = addr.province ? cities[addr.province]     || [] : [];
        const availBarangays  = addr.city     ? barangays[addr.city]      || [] : [];
        const err = (f) => errors[`${prefix}_${f}`];
        const ec  = (f) => err(f) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                {title && <h3 className={styles.sectionTitle}>{title}</h3>}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>REGION <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_region`} className={`${styles.inputField} ${ec('region')}`}
                            value={addr.region} onChange={e => handleAddressChange(type, 'region', e.target.value)}
                            disabled={disabled || isLoading}>
                            <option value="" hidden>Select Region</option>
                            {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                        </select>
                        {err('region') && <span className={styles.errorText}>{err('region')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>PROVINCE <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_province`} className={`${styles.inputField} ${ec('province')}`}
                            value={addr.province} onChange={e => handleAddressChange(type, 'province', e.target.value)}
                            disabled={disabled || !addr.region || isLoading}>
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
                            value={addr.city} onChange={e => handleAddressChange(type, 'city', e.target.value)}
                            disabled={disabled || !addr.province || isLoading}>
                            <option value="" hidden>Select City</option>
                            {availCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                        {err('city') && <span className={styles.errorText}>{err('city')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>BARANGAY <span className={styles.req}>*</span></label>
                        <select name={`${prefix}_barangay`} className={`${styles.inputField} ${ec('barangay')}`}
                            value={addr.barangay} onChange={e => handleAddressChange(type, 'barangay', e.target.value)}
                            disabled={disabled || !addr.city || isLoading}>
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
                            value={addr.street} onChange={e => handleAddressChange(type, 'street', e.target.value)}
                            disabled={disabled || isLoading} maxLength={100} placeholder="e.g. Mabini St." />
                        {err('street') && <span className={styles.errorText}>{err('street')}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>HOUSE NO. <span className={styles.req}>*</span></label>
                        <input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${ec('houseNumber')}`}
                            value={addr.houseNumber} onChange={e => handleAddressChange(type, 'houseNumber', e.target.value)}
                            disabled={disabled || isLoading} maxLength={20} placeholder="e.g. Unit 123" />
                        {err('houseNumber') && <span className={styles.errorText}>{err('houseNumber')}</span>}
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const duplicateSections = getPatientDuplicateSections(duplicateSummary);

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={() => navigate('/secretary/patients')} disabled={isLoading}>
                    <FaArrowLeft /> Back to Patients
                </button>
                <div>
                    <h1 className={styles.pageTitle}>Register New Patient</h1>
                    <p className={styles.pageSubtitle}>Fill in the patient's personal information below.</p>
                </div>
            </div>

            <div className={styles.formCard}>
                <form onSubmit={handleSubmit} noValidate>
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

                    {/* Profile Photo */}
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={() => fileInputRef.current.click()}>
                            {profileImage
                                ? <img src={profileImage} alt="Profile" className={styles.previewImage} />
                                : <div className={styles.uploadPlaceholder}><span>Upload Photo</span><span className={styles.uploadHint}>Click to browse</span></div>
                            }
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                    </div>

                    {/* ── Personal Information ── */}
                    <h3 className={styles.sectionHeader}>Personal Information</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span className={styles.req}>*</span></label>
                            <input name="firstName" className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`}
                                value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isLoading} />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>MIDDLE NAME</label>
                            <input name="middleName" className={styles.inputField}
                                value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span className={styles.req}>*</span></label>
                            <input name="lastName" className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`}
                                value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BIRTHDATE <span className={styles.req}>*</span></label>
                            <input type="date" name="birthdate"
                                className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`}
                                value={formData.birthdate} onChange={handlePersonalChange} max={maxDate} disabled={isLoading} />
                            {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>GENDER <span className={styles.req}>*</span></label>
                            <select name="gender" className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`}
                                value={formData.gender} onChange={handlePersonalChange} disabled={isLoading}>
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
                                maxLength={100} disabled={isLoading} placeholder="e.g. juan@gmail.com" />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER <span className={styles.req}>*</span></label>
                            <div className={`${styles.phoneGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input name="phone" className={styles.phoneField}
                                    value={formData.phone} onChange={handlePhoneChange('phone')}
                                    onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* ── Guardian (minors only) ── */}
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
                                        maxLength={70} disabled={isLoading} placeholder="Full Name" />
                                    {errors.guardianName && <span className={styles.errorText}>{errors.guardianName}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>RELATIONSHIP <span className={styles.req}>*</span></label>
                                    <input name="guardianRelationship"
                                        className={`${styles.inputField} ${errors.guardianRelationship ? styles.errorBorder : ''}`}
                                        value={formData.guardianRelationship} onChange={handlePersonalChange}
                                        maxLength={30} disabled={isLoading} placeholder="e.g. Mother, Father" />
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
                                            onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                                    </div>
                                    {errors.guardianContact && <span className={styles.errorText}>{errors.guardianContact}</span>}
                                </div>
                                <div className={styles.formGroup} />
                            </div>
                        </>
                    )}

                    {/* ── Address ── */}
                    <hr className={styles.divider} />
                    {renderAddress('currentAddress', 'Current Address')}

                    <div className={styles.permanentHeader}>
                        <h3 className={styles.sectionTitle}>Permanent Address</h3>
                        <label className={styles.checkboxLabel}>
                            <input type="checkbox" checked={isSameAddress} onChange={handleSameAddressToggle} disabled={isLoading} />
                            Same as Current Address
                        </label>
                    </div>
                    <div className={isSameAddress ? styles.disabledOverlay : undefined}>
                        {renderAddress('permanentAddress', '', isSameAddress)}
                    </div>

                    {/* ── Buttons ── */}
                    <div className={styles.buttonRow}>
                        <button type="button" className={styles.cancelBtn}
                            onClick={() => navigate('/secretary/patients')} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? 'Registering…' : 'Register Patient'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Success overlay */}
            {showSuccess && (
                <div className={styles.successOverlay}>
                    <div className={styles.successCard}>
                        <FaCheckCircle className={styles.successIcon} />
                        <h3 className={styles.successTitle}>Patient Registered!</h3>
                        <p className={styles.successMsg}>
                            The patient has been successfully added to your branch.
                            An activation email has been sent to their provided address.
                        </p>
                        <button className={styles.successBtn} onClick={() => navigate('/secretary/patients')}>
                            Back to Patients
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
