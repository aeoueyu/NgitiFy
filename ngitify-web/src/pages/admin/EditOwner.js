import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { normalizeAddressForForm } from '../../utils/addressHelpers';
import {
    addRequiredAddressErrors,
    getMaxDateForMinimumAge,
    getStaffFieldError,
    isAllowedPersonNameInput,
    isValidStaffEmail,
    isValidStaffLicenseNumber,
    isValidStaffPhone,
    meetsMinimumAge,
    sanitizeLicenseNumber,
    sanitizeStaffPhone,
    scrollToFirstInvalidField,
    toTitleCaseName,
} from '../../utils/staffAccountFormUtils';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

export default function EditOwner({ ownerId, onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [profileImage, setProfileImage] = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);
    const [isSameAddress, setIsSameAddress] = useState(true);
    const specializationOptions = [
        'General Dentist', 'Orthodontist', 'Pediatric Dentist (Pedodontist)',
        'Periodontist', 'Endodontist', 'Oral & Maxillofacial Surgeon',
        'Prosthodontist', 'Cosmetic Dentist',
    ];
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

    const [initialData, setInitialData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userRes, branchRes] = await Promise.all([
                    authFetch(`/user/${ownerId}`),
                    authFetch('/branches'),
                ]);

                if (!userRes.ok) {
                    alert('Failed to load owner data.');
                    onClose();
                    return;
                }

                const data = await userRes.json();
                let phone = data.contactNumber || '';
                if (phone.startsWith('+63')) phone = phone.substring(3);

                const fetchedCurrent = normalizeAddressForForm(data?.currentAddress || initialAddressState);
                const fetchedPermanent = normalizeAddressForForm(data?.permanentAddress || initialAddressState);
                const hasAnyAddress = !!(fetchedCurrent.region || fetchedCurrent.city || fetchedCurrent.street);
                const addressSame = hasAnyAddress && (
                    fetchedCurrent.region === fetchedPermanent.region &&
                    fetchedCurrent.province === fetchedPermanent.province &&
                    fetchedCurrent.city === fetchedPermanent.city &&
                    fetchedCurrent.barangay === fetchedPermanent.barangay &&
                    fetchedCurrent.street === fetchedPermanent.street &&
                    fetchedCurrent.houseNumber === fetchedPermanent.houseNumber
                );
                setIsSameAddress(addressSame);

                const fetched = {
                    firstName: data.name?.first || '',
                    middleName: data.name?.middle || '',
                    lastName: data.name?.last || '',
                    birthday: data.birthdate ? new Date(data.birthdate).toISOString().split('T')[0] : '',
                    email: data.email || '',
                    phone,
                    gender: data.gender || '',
                    assignedBranch: data.assignedBranch || data.assignedBranches?.[0] || '',
                    isDentist: data.isDentist || false,
                    licenseNumber: data.licenseNumber || '',
                    specialization: data.specialization || '',
                    currentAddress: { ...initialAddressState, ...fetchedCurrent },
                    permanentAddress: { ...initialAddressState, ...fetchedPermanent },
                };

                setFormData(fetched);
                setInitialData(fetched);
                setProfileImage(data.profileImage || null);
                setInitialProfileImage(data.profileImage || null);

                if (branchRes.ok) {
                    const bData = await branchRes.json();
                    setBranchOptions(bData.map(b => b.name));
                }
            } catch {
                alert('Cannot connect to server.');
                onClose();
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [ownerId, onClose]);

    const hasChanges = initialData
        ? JSON.stringify(formData) !== JSON.stringify(initialData) || profileImage !== initialProfileImage
        : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        if (['firstName', 'middleName', 'lastName'].includes(name)) {
            if (isAllowedPersonNameInput(value)) {
                setFormData(prev => ({ ...prev, [name]: toTitleCaseName(value) }));
            }
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const newError = getStaffFieldError(name, value, { licenseRequired: formData.isDentist });
        setErrors(prev => ({ ...prev, [name]: newError }));
    };

    const handlePhoneChange = (e) => {
        if (errors.phone) setErrors(prev => { const n = { ...prev }; delete n.phone; return n; });
        setFormData(prev => ({ ...prev, phone: sanitizeStaffPhone(e.target.value) }));
    };

    const handleLicenseChange = (e) => {
        if (errors.licenseNumber) setErrors(prev => { const n = { ...prev }; delete n.licenseNumber; return n; });
        setFormData(prev => ({ ...prev, licenseNumber: sanitizeLicenseNumber(e.target.value) }));
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
        if (!formData.lastName.trim()) newErrors.lastName = 'Required';
        if (!formData.birthday) newErrors.birthday = 'Required';
        else if (!meetsMinimumAge(formData.birthday, 18)) newErrors.birthday = 'Min age 18';
        if (!formData.gender) newErrors.gender = 'Required';
        if (!formData.email) newErrors.email = 'Required';
        else if (!isValidStaffEmail(formData.email)) newErrors.email = 'Invalid domain';
        if (!formData.phone) newErrors.phone = 'Required';
        else if (!isValidStaffPhone(formData.phone)) newErrors.phone = 'Invalid format';
        if (formData.isDentist) {
            if (!formData.licenseNumber) newErrors.licenseNumber = 'Required';
            else if (!isValidStaffLicenseNumber(formData.licenseNumber)) newErrors.licenseNumber = 'Must be 7 digits';
            if (!formData.specialization) newErrors.specialization = 'Required';
            if (!formData.assignedBranch) newErrors.assignedBranch = 'Required';
        }

        addRequiredAddressErrors(newErrors, formData.currentAddress, 'current');
        if (!isSameAddress) addRequiredAddressErrors(newErrors, formData.permanentAddress, 'permanent');

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) scrollToFirstInvalidField(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSaving(true);

        const finalData = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email,
            contactNumber: `+63${formData.phone}`,
            birthdate: formData.birthday,
            gender: formData.gender,
            profileImage,
            isDentist: formData.isDentist,
            licenseNumber: formData.isDentist ? formData.licenseNumber : '',
            specialization: formData.isDentist ? formData.specialization : '',
            assignedBranch: formData.isDentist ? formData.assignedBranch : '',
            assignedBranches: formData.isDentist && formData.assignedBranch ? [formData.assignedBranch] : [],
            currentAddress: { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress ? { country: 'Philippines', ...formData.currentAddress } : { country: 'Philippines', ...formData.permanentAddress },
        };

        try {
            const res = await authFetch(`/user/${ownerId}`, {
                method: 'PUT',
                body: JSON.stringify(finalData),
            });
            const data = await res.json();
            if (res.ok) {
                setShowSuccessModal(true);
            } else {
                setErrors(prev => ({ ...prev, submit: data.message || 'Failed to update owner.' }));
            }
        } catch {
            setErrors(prev => ({ ...prev, submit: 'Cannot connect to server.' }));
        } finally {
            setIsSaving(false);
        }
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
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={e => handleAddressChange(type, 'region', e.target.value)} disabled={isDisabled || isSaving}><option value="" hidden>Select Region</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={e => handleAddressChange(type, 'province', e.target.value)} disabled={isDisabled || !address.region || isSaving}><option value="" hidden>Select Province</option>{availableProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={e => handleAddressChange(type, 'city', e.target.value)} disabled={isDisabled || !address.province || isSaving}><option value="" hidden>Select City</option>{availableCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={e => handleAddressChange(type, 'barangay', e.target.value)} disabled={isDisabled || !address.city || isSaving}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b => <option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={e => handleAddressChange(type, 'street', e.target.value)} disabled={isDisabled || isSaving} maxLength={100} placeholder="e.g. Mabini St." />{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={e => handleAddressChange(type, 'houseNumber', e.target.value)} disabled={isDisabled || isSaving} maxLength={20} placeholder="e.g. Unit 123" />{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess();
        onClose();
    };

    if (isLoading) {
        return (
            <div className={styles.mainOverlay}>
                <div className={styles.overlayBackground} onClick={onClose} />
                <div className={styles.formCard} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <p style={{ color: '#64748b' }}>Loading owner data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                        <img src={BackIcon} alt="Back" />
                    </button>
                    <div className={styles.header}>
                        <h2>Edit <span className={styles.highlight}>Owner</span></h2>
                        <p>Update the owner's information and access settings.</p>
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
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isSaving} />
                    </div>

                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>FIRST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} name="firstName" value={formData.firstName} onChange={handleChange} maxLength={50} disabled={isSaving} />{errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}</div>
                        <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handleChange} maxLength={50} disabled={isSaving} /></div>
                        <div className={styles.formGroup}><label>LAST NAME <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} name="lastName" value={formData.lastName} onChange={handleChange} maxLength={50} disabled={isSaving} />{errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}</div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>BIRTHDAY <span style={{ color: 'red' }}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthday ? styles.errorBorder : ''}`} name="birthday" value={formData.birthday} onChange={handleChange} max={getMaxDateForMinimumAge(18)} disabled={isSaving} />{errors.birthday && <span className={styles.errorText}>{errors.birthday}</span>}</div>
                        <div className={styles.formGroup}><label>GENDER <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} name="gender" value={formData.gender} onChange={handleChange} disabled={isSaving}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} maxLength={100} disabled={isSaving} />{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                        <div className={styles.formGroup}><label>PHONE NUMBER <span style={{ color: 'red' }}>*</span></label><div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}><span className={styles.phonePrefix}>+63</span><input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving} /></div>{errors.phone && <span className={styles.errorText}>{errors.phone}</span>}</div>
                    </div>

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
                                onChange={(e) => {
                                    const isDentist = e.target.checked;
                                    setFormData(prev => ({
                                        ...prev,
                                        isDentist,
                                        licenseNumber: isDentist ? prev.licenseNumber : '',
                                        specialization: isDentist ? prev.specialization : '',
                                        assignedBranch: isDentist ? prev.assignedBranch : '',
                                    }));
                                    if (!isDentist) {
                                        setErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.licenseNumber;
                                            delete next.specialization;
                                            delete next.assignedBranch;
                                            return next;
                                        });
                                    }
                                }}
                                disabled={isSaving}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: formData.isDentist ? '#01538b' : '#cbd5e1', borderRadius: '24px', transition: '0.3s' }}>
                                <span style={{ position: 'absolute', height: '18px', width: '18px', left: formData.isDentist ? '22px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.3s', display: 'block' }} />
                            </span>
                        </label>
                        <div>
                            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: formData.isDentist ? '#1d4ed8' : '#374151' }}>Grant Dentist Access</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{formData.isDentist ? 'Owner will have full dentist-level clinical features.' : 'Owner will have business-level access only.'}</p>
                        </div>
                    </div>

                    {formData.isDentist && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Professional Information</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>LICENSE NO. <span style={{ color: 'red' }}>*</span></label><input className={`${styles.inputField} ${errors.licenseNumber ? styles.errorBorder : ''}`} name="licenseNumber" value={formData.licenseNumber} onChange={handleLicenseChange} onBlur={handleBlur} maxLength={7} disabled={isSaving} />{errors.licenseNumber && <span className={styles.errorText}>{errors.licenseNumber}</span>}</div>
                                <div className={styles.formGroup}><label>SPECIALIZATION <span style={{ color: 'red' }}>*</span></label><select className={`${styles.inputField} ${errors.specialization ? styles.errorBorder : ''}`} name="specialization" value={formData.specialization} onChange={handleChange} disabled={isSaving}><option value="" hidden>Select Specialization</option>{specializationOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>{errors.specialization && <span className={styles.errorText}>{errors.specialization}</span>}</div>
                            </div>

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p className={styles.sectionSubtitle}>Select the branch this owner is assigned to as a dentist.</p>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>BRANCH <span style={{ color: 'red' }}>*</span></label>
                                    <select className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`} name="assignedBranch" value={formData.assignedBranch} onChange={handleChange} disabled={isSaving}>
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
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>{isSaving ? 'SAVING...' : 'SAVE CHANGES'}</button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Changes Saved!</h3>
                        <p className={styles.modalMessage}>The owner's account has been updated successfully.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}

