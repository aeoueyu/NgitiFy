import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/admin/AddDentist.module.css';
import { regions, provinces, cities, barangays } from '../../utils/addressData'; 
import successIcon from '../../assets/alert/success.svg'; 
import BackIcon from '../../assets/icons/Back.svg'; 
import { authFetch } from '../../utils/api'; // FIX 2: added authFetch import
import { normalizeAddressForForm } from '../../utils/addressHelpers';
import useRealtimeStaffEmailValidation from '../../hooks/useRealtimeStaffEmailValidation';
import { PROFILE_IMAGE_SIZE_ERROR, readProfileImageAsDataUrl, isProfileImageTooLarge } from '../../utils/profileImageUpload';
import {
    addRequiredAddressErrors,
    DUPLICATE_EMAIL_MESSAGE,
    getMaxDateForMinimumAge,
    getStaffFieldError,
    hasDuplicateEmailError,
    INVALID_EMAIL_MESSAGE,
    INVALID_PHONE_MESSAGE,
    isAllowedPersonNameInput,
    isValidStaffEmail,
    isValidStaffPhone,
    meetsMinimumAge,
    MIN_AGE_18_MESSAGE,
    REQUIRED_MESSAGE,
    sanitizeStaffPhone,
    scrollToFirstInvalidField,
    toTitleCaseName,
} from '../../utils/staffAccountFormUtils';

const NON_VALIDATION_ERROR_KEYS = ['profileImage'];

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

export default function EditSecretary({ secretaryId, onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const [profileImage, setProfileImage] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({}); 
    const [isLoading, setIsLoading] = useState(true); 
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', birthdate: '',
        gender: '', email: '', phone: '', 
        homeAddress: { ...initialAddressState },
        permissions: { patients: 'none', appointments: 'none', inventory: 'none' },
        assignedBranch: ''
    });

    const [initialData, setInitialData] = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);
    const [branchOptions, setBranchOptions] = useState([]);

    // --- FETCH EXISTING DATA ---
    useEffect(() => {
        const fetchSecretaryData = async () => {
            try {
                // FIX 2: replaced raw fetch + localhost with authFetch
                const response = await authFetch(`/user/${secretaryId}`);

                if (response.ok) {
                    const data = await response.json();
                    
                    const fName = data.name?.first || data.firstName || '';
                    const mName = data.name?.middle || data.middleName || '';
                    const lName = data.name?.last || data.lastName || '';
                    
                    let phoneNum = data.contactNumber || data.phoneNumber || '';
                    if (phoneNum.startsWith('+63')) phoneNum = phoneNum.substring(3);

                    let formattedDob = '';
                    if (data.birthdate || data.dob) {
                        formattedDob = new Date(data.birthdate || data.dob).toISOString().split('T')[0];
                    }

                    const fetchedHomeAddress = normalizeAddressForForm(
                        data?.homeAddress || data?.currentAddress || data?.permanentAddress || initialAddressState
                    );

                    const fetchedFormData = {
                        firstName: fName,
                        middleName: mName,
                        lastName: lName,
                        birthdate: formattedDob,
                        gender: data.gender || '',        
                        email: data.email || '',
                        phone: phoneNum,
                        homeAddress: { ...initialAddressState, ...fetchedHomeAddress },
                        permissions: {
                            patients: data.permissions?.patients || 'none',
                            appointments: data.permissions?.appointments || 'none',
                            inventory: data.permissions?.inventory || 'none'
                        },
                        assignedBranch: data.assignedBranch || data.assignedBranches?.[0] || ''
                    };

                    setFormData(fetchedFormData);
                    setInitialData(fetchedFormData);

                    if (data.profileImage) {
                        setProfileImage(data.profileImage);
                        setInitialProfileImage(data.profileImage);
                    }
                } else {
                    alert("Failed to load secretary data.");
                    onClose();
                }
            } catch (error) {
                console.error("Error fetching secretary:", error);
                alert("Cannot connect to server.");
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (secretaryId) fetchSecretaryData();
    }, [secretaryId, onClose]);

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

    useRealtimeStaffEmailValidation({
        email: formData.email,
        excludeId: secretaryId,
        setErrors,
        enabled: !isLoading && !isSaving,
    });

    const hasChanges = initialData ? (JSON.stringify(formData) !== JSON.stringify(initialData)) || (profileImage !== initialProfileImage) : false;

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const newError = getStaffFieldError(name, value);
        setErrors(prev => ({ ...prev, [name]: newError }));
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
    const triggerFileInput = () => fileInputRef.current.click();
    
    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n={...prev}; delete n[name]; return n; });
        if (['firstName', 'middleName', 'lastName'].includes(name)) {
            if (isAllowedPersonNameInput(value)) setFormData({...formData, [name]: toTitleCaseName(value)});
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const handlePhoneChange = (e) => {
        if (errors.phone) setErrors(prev => { const n={...prev}; delete n.phone; return n; });
        setFormData({ ...formData, phone: sanitizeStaffPhone(e.target.value) });
    };

    const handleAddressChange = (field, value) => {
        const errorKey = `home_${field}`;
        if(errors[errorKey]) setErrors(prev=>{const n={...prev};delete n[errorKey];return n;});
        setFormData(prev => {
            const updated = { ...prev.homeAddress, [field]: value };
            if(field==='region'){updated.province='';updated.city='';updated.barangay='';}
            else if(field==='province'){updated.city='';updated.barangay='';}
            else if(field==='city'){updated.barangay='';}
            return {...prev, homeAddress: updated};
        });
    };

    const getValidationErrors = () => {
        const newErrors = {};
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email', 'assignedBranch'];

        required.forEach((field) => {
            if (!formData[field]) newErrors[field] = REQUIRED_MESSAGE;
        });

        if (!formData.phone) newErrors.phone = REQUIRED_MESSAGE;
        else if (!isValidStaffPhone(formData.phone)) newErrors.phone = INVALID_PHONE_MESSAGE;

        if (formData.email && !isValidStaffEmail(formData.email)) newErrors.email = INVALID_EMAIL_MESSAGE;
        else if (hasDuplicateEmailError(errors.email)) newErrors.email = errors.email;
        if (formData.birthdate && !meetsMinimumAge(formData.birthdate, 18)) newErrors.birthdate = MIN_AGE_18_MESSAGE;

        addRequiredAddressErrors(newErrors, formData.homeAddress, 'home');
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
        if (Object.keys(newErrors).length > 0) scrollToFirstInvalidField(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSaving(true);

        const finalData = {
            name: { first: formData.firstName, middle: formData.middleName, last: formData.lastName },
            email: formData.email, contactNumber: `+63${formData.phone}`, birthdate: formData.birthdate,
            gender: formData.gender, 
            profileImage: profileImage,
            homeAddress: { country: 'Philippines', ...formData.homeAddress },
            permissions: formData.permissions,
            assignedBranch: formData.assignedBranch,
            assignedBranches: formData.assignedBranch ? [formData.assignedBranch] : []
        };

        try {
            // FIX 2: replaced raw fetch + localhost with authFetch
            const response = await authFetch(`/user/${secretaryId}`, {
                method: 'PUT',
                body: JSON.stringify(finalData),
            });

            const data = await response.json();
            if (response.ok) { setShowSuccessModal(true); } 
            else {
                if (response.status === 409) {
                    setErrors(prev => ({ ...prev, [data.field]: data.message || DUPLICATE_EMAIL_MESSAGE }));
                    const el = document.getElementsByName(data.field)[0];
                    if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                } else alert(data.message || "Failed to update secretary");
            }
        } catch (error) { console.error(error); alert("Cannot connect to server."); } 
        finally { setIsSaving(false); }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    const renderAddressFields = (title, isDisabled = false) => {
        const address = formData.homeAddress; const prefix = 'home';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const getError = (field) => errors[`${prefix}_${field}`]; const getErrorClass = (field) => getError(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{color:'red'}}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={(e)=>handleAddressChange('region',e.target.value)} disabled={isDisabled || isSaving}><option value="" hidden>Select Region</option>{regions.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{color:'red'}}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={(e)=>handleAddressChange('province',e.target.value)} disabled={isDisabled || !address.region || isSaving}><option value="" hidden>Select Province</option>{availableProvinces.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{color:'red'}}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={(e)=>handleAddressChange('city',e.target.value)} disabled={isDisabled || !address.province || isSaving}><option value="" hidden>Select City</option>{availableCities.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{color:'red'}}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={(e)=>handleAddressChange('barangay',e.target.value)} disabled={isDisabled || !address.city || isSaving}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b=><option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{color:'red'}}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={(e)=>handleAddressChange('street',e.target.value)} disabled={isDisabled || isSaving} maxLength={100} placeholder="e.g. Mabini St."/>{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{color:'red'}}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={(e)=>handleAddressChange('houseNumber',e.target.value)} disabled={isDisabled || isSaving} maxLength={20} placeholder="e.g. Unit 123"/>{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined}></div>
            
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>
                        Loading Secretary Data...
                    </div>
                ) : (
                    <>
                        <div className={styles.headerWrapper}>
                            <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                                <img src={BackIcon} alt="Back" />
                            </button>
                            <div className={styles.header}>
                                <h2>Edit <span className={styles.highlight}>Secretary</span> Profile</h2>
                                <p>Update the front desk staff's personal details below.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} noValidate>
                            <div className={styles.uploadSection}>
                                <div className={styles.imageWrapper} onClick={triggerFileInput}>
                                    {profileImage ? <img src={profileImage} alt="Profile" className={styles.previewImage} /> : <div className={styles.uploadPlaceholder}><span>Upload Photo</span></div>}
                                </div>
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className={styles.hiddenFileInput} disabled={isSaving} />
                                {errors.profileImage && <span className={styles.errorText}>{errors.profileImage}</span>}
                            </div>

                            <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                            {/* Row 1: Name */}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>FIRST NAME <span style={{color:'red'}}>*</span></label><input className={`${styles.inputField} ${errors.firstName?styles.errorBorder:''}`} name="firstName" value={formData.firstName} onChange={handlePersonalChange} maxLength={50} disabled={isSaving}/>{errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}</div>
                                <div className={styles.formGroup}><label>MIDDLE NAME</label><input className={styles.inputField} name="middleName" value={formData.middleName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving}/></div>
                                <div className={styles.formGroup}><label>LAST NAME <span style={{color:'red'}}>*</span></label><input className={`${styles.inputField} ${errors.lastName?styles.errorBorder:''}`} name="lastName" value={formData.lastName} onChange={handlePersonalChange} maxLength={20} disabled={isSaving}/>{errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}</div>
                            </div>
                            {/* Row 2: Demographics */}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>BIRTHDATE <span style={{color:'red'}}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate?styles.errorBorder:''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDateForMinimumAge(18)} disabled={isSaving} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
                                <div className={styles.formGroup}><label>GENDER <span style={{color:'red'}}>*</span></label><select className={`${styles.inputField} ${errors.gender?styles.errorBorder:''}`} name="gender" value={formData.gender} onChange={handlePersonalChange} disabled={isSaving}><option value="" hidden>Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{errors.gender && <span className={styles.errorText}>{errors.gender}</span>}</div>
                            </div>
                            {/* Row 3: Contact */}
                            <div className={styles.row}>
                                <div className={styles.formGroup}><label>EMAIL ADDRESS <span style={{color:'red'}}>*</span></label><input type="email" className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`} name="email" value={formData.email} onChange={handlePersonalChange} onBlur={handleBlur} maxLength={100} disabled={isSaving}/>{errors.email && <span className={styles.errorText}>{errors.email}</span>}</div>
                                <div className={styles.formGroup}><label>PHONE NUMBER <span style={{color:'red'}}>*</span></label>
                                    <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input className={styles.phoneField} name="phone" value={formData.phone} onChange={handlePhoneChange} onBlur={handleBlur} maxLength={10} placeholder="9xxxxxxxxx" disabled={isSaving}/>
                                    </div>
                                    {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                                </div>
                            </div>

                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p className={styles.sectionSubtitle}>
                                Select the branch this secretary is assigned to.
                            </p>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>BRANCH <span style={{color:'red'}}>*</span></label>
                                    <select
                                        className={`${styles.inputField} ${errors.assignedBranch ? styles.errorBorder : ''}`}
                                        name="assignedBranch"
                                        value={formData.assignedBranch}
                                        onChange={handlePersonalChange}
                                        disabled={isSaving}
                                    >
                                        <option value="" hidden>Select a branch</option>
                                        {branchOptions.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                                    </select>
                                    {errors.assignedBranch && <span className={styles.errorText}>{errors.assignedBranch}</span>}
                                </div>
                                <div className={styles.formGroup} />
                            </div>

                            <hr className={styles.divider} />
                            {renderAddressFields('Home Address')}
                            

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>CANCEL</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>{isSaving ? 'SAVING CHANGES...' : 'UPDATE SECRETARY'}</button>
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
                        <p className={styles.modalMessage}>The secretary's profile has been successfully updated.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}


