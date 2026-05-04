import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { regions, provinces, cities, barangays } from '../../utils/addressData';

export default function AddOwner({ onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [profileImage, setProfileImage] = useState(null);
    const [isSameAddress] = useState(true);
    const specializationOptions = [
        'General Dentist', 'Orthodontist', 'Pediatric Dentist (Pedodontist)',
        'Periodontist', 'Endodontist', 'Oral & Maxillofacial Surgeon',
        'Prosthodontist', 'Cosmetic Dentist',
    ];
    const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        birthday: '',
        email: '',
        phone: '',
        gender: '',
        assignedBranch: '',
        isDentist: false,
        licenseNumber: '',
        specialization: '',
        currentAddress: { ...initialAddressState },
        permanentAddress: { ...initialAddressState },
    });

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await authFetch('/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranchOptions(data.map(b => b.name));
                }
            } catch (e) { console.error('Failed to load branches:', e); }
        };
        fetchBranches();
    }, []);

    const validateEmail = (email) => {
        const formatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formatRegex.test(email)) return false;
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        return allowedDomains.includes(email.split('@')[1].toLowerCase());
    };

    const getMaxBirthday = () => {
        const today = new Date();
        today.setFullYear(today.getFullYear() - 18);
        return today.toISOString().split('T')[0];
    };

    const scrollToFirstError = (nextErrors) => {
        const firstKey = Object.keys(nextErrors)[0];
        if (!firstKey) return;
        const field = document.getElementsByName(firstKey)[0];
        if (field) {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field.focus();
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        setFormData(prev => ({ ...prev, phone: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const handleAddressChange = (type, field, value) => {
        const errorKey = `${type === 'currentAddress' ? 'current' : 'permanent'}_${field}`;
        if (errors[errorKey]) setErrors(prev => { const n = { ...prev }; delete n[errorKey]; return n; });
        setFormData(prev => {
            const updated = { ...prev[type], [field]: value };
            if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city') { updated.barangay = ''; }
            if (type === 'currentAddress' && isSameAddress) return { ...prev, currentAddress: updated, permanentAddress: updated };
            return { ...prev, [type]: updated };
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Required';
        if (!formData.lastName.trim())  newErrors.lastName  = 'Required';
        if (!formData.birthday)         newErrors.birthday  = 'Required';
        else if (new Date(formData.birthday) > new Date(getMaxBirthday())) newErrors.birthday = 'Owner must be at least 18 years old';
        if (!formData.gender)           newErrors.gender    = 'Required';
        if (!formData.email)            newErrors.email     = 'Required';
        else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email domain (e.g. gmail.com)';
        if (!formData.phone)            newErrors.phone     = 'Required';
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9') newErrors.phone = 'Invalid format (9xxxxxxxxx)';
        if (formData.isDentist) {
            if (!formData.licenseNumber) newErrors.licenseNumber = 'Required';
            else if (formData.licenseNumber.length !== 7) newErrors.licenseNumber = 'Must be 7 digits';
            if (!formData.specialization) newErrors.specialization = 'Required';
            if (!formData.assignedBranch) newErrors.assignedBranch = 'Required';
        }
        const validateAddr = (addr, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach(f => {
                if (!addr[f]) newErrors[`${prefix}_${f}`] = 'Required';
            });
        };
        validateAddr(formData.currentAddress, 'current');
        if (!isSameAddress) validateAddr(formData.permanentAddress, 'permanent');
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            scrollToFirstError(newErrors);
        }
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);

        const finalData = {
            name:             { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email:            formData.email,
            contactNumber:    `+63${formData.phone}`,
            birthdate:        formData.birthday,
            gender:           formData.gender,
            profileImage,
            isDentist:        formData.isDentist,
            licenseNumber:    formData.isDentist ? formData.licenseNumber : '',
            specialization:   formData.isDentist ? formData.specialization : '',
            assignedBranch:   formData.isDentist ? formData.assignedBranch : '',
            assignedBranches: formData.isDentist && formData.assignedBranch ? [formData.assignedBranch] : [],
            currentAddress:   { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress ? { country: 'Philippines', ...formData.currentAddress } : { country: 'Philippines', ...formData.permanentAddress },
        };

        try {
            const res = await authFetch('/add-owner', {
                method: 'POST',
                body: JSON.stringify(finalData),
            });
            const data = await res.json();
            if (res.ok || res.status === 207) {
                setShowSuccessModal(true);
            } else if (res.status === 409) {
                setErrors(prev => ({ ...prev, email: data.message }));
            } else {
                setErrors(prev => ({ ...prev, submit: data.message || 'Failed to add owner.' }));
            }
        } catch {
            setErrors(prev => ({ ...prev, submit: 'Cannot connect to server.' }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

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
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={e => handleAddressChange(type, 'region', e.target.value)} disabled={isDisabled || isLoading}><option value="" hidden>Select Region</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={e => handleAddressChange(type, 'province', e.target.value)} disabled={isDisabled || !address.region || isLoading}><option value="" hidden>Select Province</option>{availableProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={e => handleAddressChange(type, 'city', e.target.value)} disabled={isDisabled || !address.province || isLoading}><option value="" hidden>Select City</option>{availableCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={e => handleAddressChange(type, 'barangay', e.target.value)} disabled={isDisabled || !address.city || isLoading}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b => <option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={e => handleAddressChange(type, 'street', e.target.value)} disabled={isDisabled || isLoading} maxLength={100} placeholder="e.g. Mabini St." />{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={e => handleAddressChange(type, 'houseNumber', e.target.value)} disabled={isDisabled || isLoading} maxLength={20} placeholder="e.g. Unit 123" />{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
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
                        <h2>Add New <span className={styles.highlight}>Owner</span></h2>
                        <p>Enter the owner's details and configure their access level.</p>
                    </div>
                </div>

                {errors.submit && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                        {errors.submit}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={triggerFileInput}>
                            {profileImage ? <img src={profileImage} alt="Profile" className={styles.previewImage} /> : <div className={styles.uploadPlaceholder}><span>Upload Photo</span></div>}
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isLoading} />
                    </div>

                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    {/* Row 1: First / Middle / Last Name */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`}
                                name="firstName" value={formData.firstName}
                                onChange={handleChange} maxLength={50} disabled={isLoading}
                            />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>MIDDLE NAME</label>
                            <input
                                className={`${styles.inputField} ${errors.middleName ? styles.errorBorder : ''}`}
                                name="middleName" value={formData.middleName}
                                onChange={handleChange} maxLength={50} disabled={isLoading}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`}
                                name="lastName" value={formData.lastName}
                                onChange={handleChange} maxLength={50} disabled={isLoading}
                            />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    {/* Row 2: Birthday / Gender */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BIRTHDAY <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="date"
                                className={`${styles.inputField} ${errors.birthday ? styles.errorBorder : ''}`}
                                name="birthday" value={formData.birthday}
                                onChange={handleChange} disabled={isLoading} max={getMaxBirthday()}
                            />
                            {errors.birthday && <span className={styles.errorText}>{errors.birthday}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>GENDER <span style={{ color: 'red' }}>*</span></label>
                            <select
                                className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`}
                                name="gender" value={formData.gender}
                                onChange={handleChange} disabled={isLoading}
                            >
                                <option value="" hidden>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                            {errors.gender && <span className={styles.errorText}>{errors.gender}</span>}
                        </div>
                    </div>

                    {/* Row 3: Email / Phone */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="email"
                                className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`}
                                name="email" value={formData.email}
                                onChange={handleChange} maxLength={100} disabled={isLoading}
                            />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER</label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input
                                    className={styles.phoneField}
                                    name="phone" value={formData.phone}
                                    onChange={handlePhoneChange}
                                    maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading}
                                />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Dentist Access Toggle */}
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Dentist Access</h3>
                    <p className={styles.sectionSubtitle}>
                        Enable this to grant the owner full Dentist-level access (EMR editing, Material Usage, AI Image Enhancer).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: formData.isDentist ? '#eff6ff' : '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${formData.isDentist ? '#bfdbfe' : '#e2e8f0'}` }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                            <input
                                type="checkbox"
                                checked={formData.isDentist}
                                onChange={e => setFormData(prev => ({ ...prev, isDentist: e.target.checked }))}
                                disabled={isLoading}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: formData.isDentist ? '#01538b' : '#cbd5e1', borderRadius: '24px', transition: '0.3s' }}>
                                <span style={{ position: 'absolute', height: '18px', width: '18px', left: formData.isDentist ? '22px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.3s', display: 'block' }} />
                            </span>
                        </label>
                        <div>
                            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: formData.isDentist ? '#1d4ed8' : '#374151' }}>Grant Dentist Access</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                {formData.isDentist ? 'Owner will have full dentist-level clinical features.' : 'Owner will have business-level access only.'}
                            </p>
                        </div>
                    </div>

                    {/* Dentist-only fields */}
                    {formData.isDentist && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Professional Information</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>LICENSE NO. <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        className={`${styles.inputField} ${errors.licenseNumber ? styles.errorBorder : ''}`}
                                        name="licenseNumber" value={formData.licenseNumber}
                                        onChange={handleChange} maxLength={7} disabled={isLoading}
                                    />
                                    {errors.licenseNumber && <span className={styles.errorText}>{errors.licenseNumber}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>SPECIALIZATION <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        className={`${styles.inputField} ${errors.specialization ? styles.errorBorder : ''}`}
                                        name="specialization" value={formData.specialization}
                                        onChange={handleChange} disabled={isLoading}
                                    >
                                        <option value="" hidden>Select Specialization</option>
                                        {specializationOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                    {errors.specialization && <span className={styles.errorText}>{errors.specialization}</span>}
                                </div>
                            </div>

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p className={styles.sectionSubtitle}>Select the branch this owner is assigned to as a dentist.</p>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>BRANCH <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`}
                                        name="assignedBranch" value={formData.assignedBranch}
                                        onChange={handleChange} disabled={isLoading}
                                    >
                                        <option value="" hidden>Select a branch</option>
                                        {branchOptions.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                                    </select>
                                    {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                                </div>
                                <div className={styles.formGroup} />
                            </div>
                        </>
                    )}

                    <hr className={styles.divider} />
                    {renderAddressFields('currentAddress', 'Home Address')}
                    

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? 'ADDING OWNER...' : 'ADD OWNER'}
                        </button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Owner Added!</h3>
                        <p className={styles.modalMessage}>The owner account has been created successfully. An activation email has been sent.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}


