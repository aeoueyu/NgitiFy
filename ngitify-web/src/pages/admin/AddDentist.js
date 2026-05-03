import React, { useState, useRef, useEffect } from 'react';
import styles from '../../styles/admin/AddDentist.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

export default function AddDentist({ onClose, onSuccess }) {
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const fileInputRef = useRef(null);
    const [isSameAddress] = useState(true);
    const [branchOptions, setBranchOptions] = useState([]);
    const [profileImage, setProfileImage] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const specializationOptions = [
        "General Dentist", "Orthodontist", "Pediatric Dentist (Pedodontist)",
        "Periodontist", "Endodontist", "Oral & Maxillofacial Surgeon",
        "Prosthodontist", "Cosmetic Dentist",
    ];
    const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', gender: '',
        licenseNumber: '', specialization: '',
        email: '', phone: '',
        currentAddress: { ...initialAddressState },
        permanentAddress: { ...initialAddressState },
        permissions: { patients: 'none', appointments: 'none', inventory: 'none' },
        assignedBranch: '',
    });

    const validateEmail = (email) => {
        const formatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formatRegex.test(email)) return false;
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        return allowedDomains.includes(email.split('@')[1].toLowerCase());
    };

    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, c => c.toUpperCase());
    const getAge = (d) => { const today = new Date(); const birth = new Date(d); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--; return age; };
    const getMaxDate = () => { const t = new Date(); t.setFullYear(t.getFullYear() - 21); return t.toISOString().split('T')[0]; };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = '';
        switch (name) {
            case 'email':         if (!value) newError = 'Required'; else if (!validateEmail(value)) newError = 'Invalid domain (e.g. gmail.com)'; break;
            case 'phone':         if (!value) newError = 'Required'; else if (value.length !== 10 || value[0] !== '9') newError = 'Invalid format (9xxxxxxxxx)'; break;
            case 'licenseNumber': if (!value) newError = 'Required'; else if (value.length !== 7) newError = 'Must be 7 digits'; break;
            default: break;
        }
        setErrors(prev => ({ ...prev, [name]: newError }));
    };

    const handleImageChange = (e) => { const file = e.target.files[0]; if (file) { const r = new FileReader(); r.onloadend = () => setProfileImage(r.result); r.readAsDataURL(file); } };
    const triggerFileInput = () => fileInputRef.current.click();

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        if (['firstName', 'middleName', 'lastName'].includes(name)) {
            if (value === '' || /^[a-zA-Z\s.-]+$/.test(value)) setFormData({ ...formData, [name]: toTitleCase(value) });
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (errors.phone) setErrors(prev => { const n = { ...prev }; delete n.phone; return n; });
        setFormData({ ...formData, phone: value });
    };

    const handleLicenseChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (errors.licenseNumber) setErrors(prev => { const n = { ...prev }; delete n.licenseNumber; return n; });
        setFormData({ ...formData, licenseNumber: val });
    };

    const handleAddressChange = (type, field, value) => {
        const errorKey = `${type === 'currentAddress' ? 'current' : 'permanent'}_${field}`;
        if (errors[errorKey]) setErrors(prev => { const n = { ...prev }; delete n[errorKey]; return n; });
        setFormData(prev => {
            const updated = { ...prev[type], [field]: value };
            if (field === 'region')   { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city')     { updated.barangay = ''; }
            if (type === 'currentAddress' && isSameAddress) return { ...prev, currentAddress: updated, permanentAddress: updated };
            return { ...prev, [type]: updated };
        });
    };

    const validateForm = () => {
        let newErrors = {}; let isValid = true;
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'licenseNumber', 'specialization', 'email', 'assignedBranch'];
        required.forEach(f => { if (!formData[f]) { newErrors[f] = 'Required'; isValid = false; } });
        if (!formData.phone) { newErrors.phone = 'Required'; isValid = false; }
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9') { newErrors.phone = 'Invalid format'; isValid = false; }
        if (formData.email && !validateEmail(formData.email)) { newErrors.email = 'Invalid domain'; isValid = false; }
        if (formData.birthdate && getAge(formData.birthdate) < 21) { newErrors.birthdate = 'Min age 21'; isValid = false; }
        if (formData.licenseNumber && formData.licenseNumber.length !== 7) { newErrors.licenseNumber = 'Must be 7 digits'; isValid = false; }
        const validateAddr = (addr, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach(f => {
                if (!addr[f]) { newErrors[`${prefix}_${f}`] = 'Required'; isValid = false; }
            });
        };
        validateAddr(formData.currentAddress, 'current');
        if (!isSameAddress) validateAddr(formData.permanentAddress, 'permanent');
        setErrors(newErrors);
        if (!isValid) { const el = document.getElementsByName(Object.keys(newErrors)[0])[0]; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);

        const finalData = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email, contactNumber: `+63${formData.phone}`,
            birthdate: formData.birthdate, gender: formData.gender,
            licenseNumber: formData.licenseNumber, specialization: formData.specialization,
            profileImage: profileImage,
            assignedBranch: isBranchManager ? (user.assignedBranch || undefined) : formData.assignedBranch,
            assignedBranches: isBranchManager ? (user.assignedBranch ? [user.assignedBranch] : []) : (formData.assignedBranch ? [formData.assignedBranch] : []),
            currentAddress: { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress ? { country: 'Philippines', ...formData.currentAddress } : { country: 'Philippines', ...formData.permanentAddress },
            permissions: formData.permissions,
            medicalHistory: { allergies: [], conditions: [] },
        };

        try {
            const response = await authFetch('/add-dentist', { method: 'POST', body: JSON.stringify(finalData) });
            const data = await response.json();
            if (response.ok) { setShowSuccessModal(true); }
            else if (response.status === 409) {
                setErrors(prev => ({ ...prev, [data.field]: data.message }));
                const el = document.getElementsByName(data.field)[0];
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
            } else {
                alert(data.message || 'Failed to add dentist');
            }
        } catch (error) { console.error(error); alert('Cannot connect to server.'); }
        finally { setIsLoading(false); }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    const renderAddressFields = (type, title, isDisabled = false) => {
        const address = formData[type]; const prefix = type === 'currentAddress' ? 'current' : 'permanent';
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
                        <h2>Add New <span className={styles.highlight}>Dentist</span></h2>
                        <p>Enter the dentist's personal and professional details below.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className={styles.uploadSection}>
                        <div className={styles.imageWrapper} onClick={triggerFileInput}>
                            {profileImage ? <img src={profileImage} alt="Profile" className={styles.previewImage} /> : <div className={styles.uploadPlaceholder}><span>Upload Photo</span></div>}
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isLoading} />
                    </div>

                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    {/* Row 1: Names */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isLoading} />{errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}</div>
                        <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} /></div>
                        <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isLoading} />{errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}</div>
                    </div>

                    {/* Row 2: Birthdate / Gender */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BIRTHDATE <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isLoading} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                        <div className={styles.formGroup}><label>GENDER <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isLoading}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                    </div>

                    {/* Row 3: License / Specialization */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>LICENSE NO. <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.licenseNumber ? styles.errorBorder : ''}`} name="licenseNumber" value={formData.licenseNumber} onChange={handleLicenseChange} onBlur={handleBlur} maxLength={7} disabled={isLoading} />{errors.licenseNumber && <span className={styles.errorText}>{errors.licenseNumber}</span>}</div>
                        <div className={styles.formGroup}><label>SPECIALIZATION <span style={{ color: 'red' }}>*</span></label><select name="specialization" className={`${styles.inputField} ${errors.specialization ? styles.errorBorder : ''}`} value={formData.specialization} onChange={handlePersonalChange} disabled={isLoading}><option value="" hidden>Select Specialization</option>{specializationOptions.map(o => <option key={o} value={o}>{o}</option>)}</select>{errors.specialization && <span className={styles.errorText}>{errors.specialization}</span>}</div>
                    </div>

                    {/* Row 4: Email / Phone */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} maxLength={100} disabled={isLoading} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading} />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Branch Assignment */}
                    {(isBranchManager || branchOptions.length > 0) && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            {isBranchManager ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <span className={styles.branchLockedBadge}>🏢 {user.assignedBranch}</span>
                                    <span className={styles.branchLockedNote}>Auto-assigned to your branch</span>
                                </div>
                            ) : (
                                <>
                                    <p className={styles.sectionSubtitle}>Select the branch this dentist is assigned to.</p>
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
                                                {branchOptions.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                                            </select>
                                            {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                                        </div>
                                        <div className={styles.formGroup} />
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Address */}
                    <hr className={styles.divider} />
                    {renderAddressFields('currentAddress', 'Home Address')}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>{isLoading ? 'ADDING DENTIST...' : 'ADD DENTIST'}</button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>New dentist has been successfully added. An activation email has been sent.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}




