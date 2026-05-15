import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { useToast } from '../../context/ToastContext';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import {
    addRequiredAddressErrors,
    getMaxDateForMinimumAge,
    getStaffFieldError,
    isAllowedPersonNameInput,
    isValidStaffEmail,
    isValidStaffPhone,
    meetsMinimumAge,
    sanitizeStaffPhone,
    scrollToFirstInvalidField,
    toTitleCaseName,
} from '../../utils/staffAccountFormUtils';

export default function AddBranchManager({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [profileImage, setProfileImage] = useState(null);

    const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: '',
        birthday: '',
        assignedBranch: '',
        homeAddress: { ...initialAddressState },
    });

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await authFetch('/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranchOptions(data.map(b => b.name));
                }
            } catch (e) {
                console.error('Failed to load branches:', e);
            }
        };
        fetchBranches();
    }, []);

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
        const newError = getStaffFieldError(name, value);
        setErrors(prev => ({ ...prev, [name]: newError }));
    };

    const handlePhoneChange = (e) => {
        if (errors.phone) setErrors(prev => { const n = { ...prev }; delete n.phone; return n; });
        setFormData(prev => ({ ...prev, phone: sanitizeStaffPhone(e.target.value) }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const handleAddressChange = (field, value) => {
        const errorKey = `home_${field}`;
        if (errors[errorKey]) setErrors(prev => { const n = { ...prev }; delete n[errorKey]; return n; });
        setFormData(prev => {
            const updated = { ...prev.homeAddress, [field]: value };
            if (field === 'region') { updated.province = ''; updated.city = ''; updated.barangay = ''; }
            else if (field === 'province') { updated.city = ''; updated.barangay = ''; }
            else if (field === 'city') { updated.barangay = ''; }
            return { ...prev, homeAddress: updated };
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Required';
        if (!formData.lastName.trim())  newErrors.lastName  = 'Required';
        if (!formData.email)            newErrors.email     = 'Required';
        else if (!isValidStaffEmail(formData.email)) newErrors.email = 'Invalid domain';
        if (!formData.phone)            newErrors.phone     = 'Required';
        else if (!isValidStaffPhone(formData.phone)) newErrors.phone = 'Invalid format';
        if (!formData.gender)           newErrors.gender    = 'Required';
        if (!formData.birthday)         newErrors.birthday  = 'Required';
        else if (!meetsMinimumAge(formData.birthday, 18)) newErrors.birthday = 'Min age 18';
        if (!formData.assignedBranch)   newErrors.assignedBranch = 'Required';

        addRequiredAddressErrors(newErrors, formData.homeAddress, 'home');

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) scrollToFirstInvalidField(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);

        const finalData = {
            name:           { first: formData.firstName.trim(), middle: formData.middleName.trim(), last: formData.lastName.trim() },
            email:          formData.email.trim(),
            contactNumber:  `+63${formData.phone}`,
            gender:         formData.gender,
            birthdate:      formData.birthday,
            profileImage,
            assignedBranch: formData.assignedBranch,
            homeAddress: { country: 'Philippines', ...formData.homeAddress },
        };

        try {
            const res = await authFetch('/add-branch-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData),
            });
            const data = await res.json();
            if (res.ok) {
                setShowSuccessModal(true);
            } else if (res.status === 409) {
                setErrors(prev => ({ ...prev, email: data.message || 'This email is already in use.' }));
            } else {
                addToast(data.message || 'Failed to add branch manager.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    const renderAddressFields = (title, isDisabled = false) => {
        const address = formData.homeAddress;
        const prefix = 'home';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const getError = (field) => errors[`${prefix}_${field}`];
        const getErrorClass = (field) => getError(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={e => handleAddressChange('region', e.target.value)} disabled={isDisabled || isLoading}><option value="" hidden>Select Region</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={e => handleAddressChange('province', e.target.value)} disabled={isDisabled || !address.region || isLoading}><option value="" hidden>Select Province</option>{availableProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={e => handleAddressChange('city', e.target.value)} disabled={isDisabled || !address.province || isLoading}><option value="" hidden>Select City</option>{availableCities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{ color: 'red' }}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={e => handleAddressChange('barangay', e.target.value)} disabled={isDisabled || !address.city || isLoading}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b => <option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={e => handleAddressChange('street', e.target.value)} disabled={isDisabled || isLoading} maxLength={100} placeholder="e.g. Mabini St." />{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{ color: 'red' }}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={e => handleAddressChange('houseNumber', e.target.value)} disabled={isDisabled || isLoading} maxLength={20} placeholder="e.g. Unit 123" />{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
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
                        <h2>Add New <span className={styles.highlight}>Branch Manager</span></h2>
                        <p>Enter the branch manager's details and assign their branch.</p>
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
                                className={styles.inputField}
                                name="middleName" value={formData.middleName}
                                onChange={handleChange} maxLength={30} disabled={isLoading}
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
                                onChange={handleChange} max={getMaxDateForMinimumAge(18)} disabled={isLoading}
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
                                onChange={handleChange} onBlur={handleBlur} maxLength={100} disabled={isLoading}
                            />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER <span style={{ color: 'red' }}>*</span></label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input
                                    className={styles.phoneField}
                                    name="phone" value={formData.phone}
                                    onChange={handlePhoneChange} onBlur={handleBlur}
                                    maxLength={10} placeholder="9xxxxxxxxx" disabled={isLoading}
                                />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Branch Assignment — shown BEFORE address */}
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                    <p className={styles.sectionSubtitle}>Select the branch this manager will oversee.</p>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BRANCH <span style={{ color: 'red' }}>*</span></label>
                            <select
                                className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`}
                                name="assignedBranch" value={formData.assignedBranch}
                                onChange={handleChange} disabled={isLoading}
                            >
                                <option value="" hidden>Select a branch</option>
                                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                        </div>
                        <div className={styles.formGroup} />
                    </div>

                    {/* Current Address */}
                    <hr className={styles.divider} />
                    {renderAddressFields('Home Address')}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
                            CANCEL
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? 'ADDING...' : 'ADD BRANCH MANAGER'}
                        </button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Branch Manager Added!</h3>
                        <p className={styles.modalMessage}>
                            The account has been created successfully. An activation email has been sent.
                        </p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}



