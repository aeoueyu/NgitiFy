import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/admin/EditSecretary.module.css'; // FIX 1: was AddSecretary.module.css
import { regions, provinces, cities, barangays } from '../../utils/addressData'; 
import successIcon from '../../assets/alert/success.svg'; 
import BackIcon from '../../assets/icons/Back.svg'; 
import { authFetch } from '../../utils/api'; // FIX 2: added authFetch import

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

export default function EditSecretary({ secretaryId, onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const [isSameAddress, setIsSameAddress] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({}); 
    const [isLoading, setIsLoading] = useState(true); 
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', birthdate: '',
        gender: '', email: '', phone: '', 
        currentAddress: { ...initialAddressState }, 
        permanentAddress: { ...initialAddressState },
        permissions: { patients: 'none', appointments: 'none', inventory: 'none' }
    });

    const [initialData, setInitialData] = useState(null);
    const [initialProfileImage, setInitialProfileImage] = useState(null);

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

                    const fetchedCurrent = data?.currentAddress || { ...initialAddressState };
                    const fetchedPermanent = data?.permanentAddress || { ...initialAddressState };

                    const isAddressSame = (
                        fetchedCurrent.region === fetchedPermanent.region &&
                        fetchedCurrent.province === fetchedPermanent.province &&
                        fetchedCurrent.city === fetchedPermanent.city &&
                        fetchedCurrent.barangay === fetchedPermanent.barangay &&
                        fetchedCurrent.street === fetchedPermanent.street &&
                        fetchedCurrent.houseNumber === fetchedPermanent.houseNumber
                    );
                    setIsSameAddress(isAddressSame);

                    const fetchedFormData = {
                        firstName: fName,
                        middleName: mName,
                        lastName: lName,
                        birthdate: formattedDob,
                        gender: data.gender || '',        
                        email: data.email || '',
                        phone: phoneNum,
                        currentAddress: { ...initialAddressState, ...fetchedCurrent },
                        permanentAddress: { ...initialAddressState, ...fetchedPermanent },
                        permissions: {
                            patients: data.permissions?.patients || 'none',
                            appointments: data.permissions?.appointments || 'none',
                            inventory: data.permissions?.inventory || 'none'
                        }
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

    const hasChanges = initialData ? (JSON.stringify(formData) !== JSON.stringify(initialData)) || (profileImage !== initialProfileImage) : false;

    // --- HELPER FUNCTIONS ---
    const validateEmail = (email) => {
        const formatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formatRegex.test(email)) return false;
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        return allowedDomains.includes(email.split('@')[1].toLowerCase());
    };

    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
    const getAge = (d) => { const today=new Date(); const birth=new Date(d); let age=today.getFullYear()-birth.getFullYear(); const m=today.getMonth()-birth.getMonth(); if(m<0||(m===0&&today.getDate()<birth.getDate()))age--; return age; };
    const getMaxDate = () => { const t=new Date(); t.setFullYear(t.getFullYear()-18); return t.toISOString().split('T')[0]; };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        let newError = "";
        if (name === 'email') {
            if (!value) newError = "Required";
            else if (!validateEmail(value)) newError = "Invalid domain (e.g. gmail.com)";
        } else if (name === 'phone') {
            if (!value) newError = "Required";
            else if (value.length !== 10 || value[0] !== '9') newError = "Invalid format (9xxxxxxxxx)";
        }
        setErrors(prev => ({ ...prev, [name]: newError }));
    };

    const handleImageChange = (e) => { const file=e.target.files[0]; if(file){ const r=new FileReader(); r.onloadend=()=>setProfileImage(r.result); r.readAsDataURL(file); }};
    const triggerFileInput = () => fileInputRef.current.click();
    
    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n={...prev}; delete n[name]; return n; });
        if (['firstName', 'middleName', 'lastName'].includes(name)) {
            if (value===''||/^[a-zA-Z\s.-]+$/.test(value)) setFormData({...formData, [name]: toTitleCase(value)});
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (errors.phone) setErrors(prev => { const n={...prev}; delete n.phone; return n; });
        setFormData({ ...formData, phone: value });
    };

    const handleAddressChange = (type, field, value) => {
        const errorKey = `${type==='currentAddress'?'current':'permanent'}_${field}`;
        if(errors[errorKey]) setErrors(prev=>{const n={...prev};delete n[errorKey];return n;});
        setFormData(prev => {
            const updated = { ...prev[type], [field]: value };
            if(field==='region'){updated.province='';updated.city='';updated.barangay='';}
            else if(field==='province'){updated.city='';updated.barangay='';}
            else if(field==='city'){updated.barangay='';}
            if(type==='currentAddress'&&isSameAddress) return {...prev, currentAddress: updated, permanentAddress: updated};
            return {...prev, [type]: updated};
        });
    };

    const handleSameAddressToggle = (e) => {
        const checked = e.target.checked; setIsSameAddress(checked);
        if(checked) {
            setFormData(prev => ({...prev, permanentAddress: {...prev.currentAddress}}));
            setErrors(prev=>{const n={...prev}; Object.keys(n).forEach(k=>{if(k.startsWith('permanent_'))delete n[k];}); return n;});
        } else {
            setFormData(prev => ({...prev, permanentAddress: {...initialAddressState}}));
        }
    };

    const handlePermissionChange = (module, value) => {
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [module]: value }
        }));
    };

    const validateForm = () => {
        let newErrors = {}; let isValid = true;
        // FIX 3: added 'gender' to required fields
        const required = ['firstName', 'lastName', 'birthdate', 'gender', 'email'];
        required.forEach(f => { if(!formData[f]) { newErrors[f] = "Required"; isValid = false; }});
        if(!formData.phone) { newErrors.phone="Required"; isValid=false; }
        else if(formData.phone.length!==10 || formData.phone[0]!=='9') { newErrors.phone="Invalid format"; isValid=false; }
        if(formData.email && !validateEmail(formData.email)) { newErrors.email = "Invalid domain"; isValid=false; }
        if(formData.birthdate && getAge(formData.birthdate)<18) { newErrors.birthdate="Min age 18"; isValid=false; }

        const validateAddr = (addr, prefix) => {
            ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach(f => {
                if(!addr[f]) { newErrors[`${prefix}_${f}`]="Required"; isValid=false; }
            });
        };
        validateAddr(formData.currentAddress, 'current');
        if(!isSameAddress) validateAddr(formData.permanentAddress, 'permanent');

        setErrors(newErrors);
        if (!isValid) {
            const el = document.getElementsByName(Object.keys(newErrors)[0])[0];
            if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
        return isValid;
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
            currentAddress: { country: 'Philippines', ...formData.currentAddress },
            permanentAddress: isSameAddress ? { country: 'Philippines', ...formData.currentAddress } : { country: 'Philippines', ...formData.permanentAddress },
            permissions: formData.permissions
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
                    setErrors(prev => ({ ...prev, [data.field]: data.message }));
                    const el = document.getElementsByName(data.field)[0];
                    if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                } else alert(data.message || "Failed to update secretary");
            }
        } catch (error) { console.error(error); alert("Cannot connect to server."); } 
        finally { setIsSaving(false); }
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    const renderAddressFields = (type, title, isDisabled = false) => {
        const address = formData[type]; const prefix = type === 'currentAddress' ? 'current' : 'permanent';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const getError = (field) => errors[`${prefix}_${field}`]; const getErrorClass = (field) => getError(field) ? styles.errorBorder : '';

        return (
            <div className={styles.addressSection}>
                <h3 className={styles.sectionTitle}>{title}</h3>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>REGION <span style={{color:'red'}}>*</span></label><select name={`${prefix}_region`} className={`${styles.inputField} ${getErrorClass('region')}`} value={address.region} onChange={(e)=>handleAddressChange(type,'region',e.target.value)} disabled={isDisabled || isSaving}><option value="" hidden>Select Region</option>{regions.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select>{getError('region') && <span className={styles.errorText}>{getError('region')}</span>}</div>
                    <div className={styles.formGroup}><label>PROVINCE <span style={{color:'red'}}>*</span></label><select name={`${prefix}_province`} className={`${styles.inputField} ${getErrorClass('province')}`} value={address.province} onChange={(e)=>handleAddressChange(type,'province',e.target.value)} disabled={isDisabled || !address.region || isSaving}><option value="" hidden>Select Province</option>{availableProvinces.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select>{getError('province') && <span className={styles.errorText}>{getError('province')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>CITY / MUNICIPALITY <span style={{color:'red'}}>*</span></label><select name={`${prefix}_city`} className={`${styles.inputField} ${getErrorClass('city')}`} value={address.city} onChange={(e)=>handleAddressChange(type,'city',e.target.value)} disabled={isDisabled || !address.province || isSaving}><option value="" hidden>Select City</option>{availableCities.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select>{getError('city') && <span className={styles.errorText}>{getError('city')}</span>}</div>
                    <div className={styles.formGroup}><label>BARANGAY <span style={{color:'red'}}>*</span></label><select name={`${prefix}_barangay`} className={`${styles.inputField} ${getErrorClass('barangay')}`} value={address.barangay} onChange={(e)=>handleAddressChange(type,'barangay',e.target.value)} disabled={isDisabled || !address.city || isSaving}><option value="" hidden>Select Barangay</option>{availableBarangays.map(b=><option key={b} value={b}>{b}</option>)}</select>{getError('barangay') && <span className={styles.errorText}>{getError('barangay')}</span>}</div>
                </div>
                <div className={styles.row}>
                    <div className={styles.formGroup}><label>STREET <span style={{color:'red'}}>*</span></label><input name={`${prefix}_street`} className={`${styles.inputField} ${getErrorClass('street')}`} value={address.street} onChange={(e)=>handleAddressChange(type,'street',e.target.value)} disabled={isDisabled || isSaving} maxLength={100} placeholder="e.g. Mabini St."/>{getError('street') && <span className={styles.errorText}>{getError('street')}</span>}</div>
                    <div className={styles.formGroup}><label>HOUSE NO. <span style={{color:'red'}}>*</span></label><input name={`${prefix}_houseNumber`} className={`${styles.inputField} ${getErrorClass('houseNumber')}`} value={address.houseNumber} onChange={(e)=>handleAddressChange(type,'houseNumber',e.target.value)} disabled={isDisabled || isSaving} maxLength={20} placeholder="e.g. Unit 123"/>{getError('houseNumber') && <span className={styles.errorText}>{getError('houseNumber')}</span>}</div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined}></div>
            
            <div className={styles.formCard}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b', fontWeight: 'bold' }}>
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
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} disabled={isSaving} />
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
                                <div className={styles.formGroup}><label>BIRTHDATE <span style={{color:'red'}}>*</span></label><input type="date" className={`${styles.inputField} ${errors.birthdate?styles.errorBorder:''}`} name="birthdate" value={formData.birthdate} onChange={handlePersonalChange} max={getMaxDate()} disabled={isSaving} />{errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}</div>
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
                            {renderAddressFields('currentAddress', 'Current Address')}
                            <div className={styles.permanentHeader}><h3 className={styles.sectionTitle}>Permanent Address</h3><div className={styles.checkboxContainer}><input type="checkbox" id="sameAddress" checked={isSameAddress} onChange={handleSameAddressToggle} disabled={isSaving} /><label htmlFor="sameAddress">Same as Current Address</label></div></div>
                            {isSameAddress ? <div className={styles.disabledOverlay}>{renderAddressFields('permanentAddress', '', true)}</div> : renderAddressFields('permanentAddress', '')}

                            {/* SYSTEM PERMISSIONS SECTION */}
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>System Permissions</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', marginTop: '-15px' }}>Assign access levels for different system modules.</p>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>PATIENTS <span style={{color:'red'}}>*</span></label>
                                    <select className={styles.inputField} value={formData.permissions.patients} onChange={(e) => handlePermissionChange('patients', e.target.value)} disabled={isSaving}>
                                        <option value="none">No Access</option>
                                        <option value="read">Read-Only</option>
                                        <option value="edit">Editor</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>APPOINTMENTS <span style={{color:'red'}}>*</span></label>
                                    <select className={styles.inputField} value={formData.permissions.appointments} onChange={(e) => handlePermissionChange('appointments', e.target.value)} disabled={isSaving}>
                                        <option value="none">No Access</option>
                                        <option value="read">Read-Only</option>
                                        <option value="edit">Editor</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>INVENTORY <span style={{color:'red'}}>*</span></label>
                                    <select className={styles.inputField} value={formData.permissions.inventory} onChange={(e) => handlePermissionChange('inventory', e.target.value)} disabled={isSaving}>
                                        <option value="none">No Access</option>
                                        <option value="read">Read-Only</option>
                                        <option value="edit">Editor</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    {/* Empty flex placeholder to maintain layout grid */}
                                </div>
                            </div>

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