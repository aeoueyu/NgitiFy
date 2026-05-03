import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/AdminProfile.module.css';
import { useAuth } from '../../hooks/useAuth';
import successIcon from '../../assets/alert/success.svg';

// Global Utilities
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../../components/common/UserAvatar';

export default function MyProfile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { addToast } = useToast(); // CRITICAL RULE: Toast implementation

    // View States
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [fetchError, setFetchError] = useState(null); 

    // Email Change Modal States
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailFormData, setEmailFormData] = useState({ newEmail: '', currentPassword: '' });
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
    const [emailError, setEmailError] = useState('');

    // Main Form State - Unified for All Roles
    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', email: '', phone: '', profileImage: '',
        birthdate: '', gender: '',
        
        // Dentist Specific Fields
        prcLicenseNumber: '', specialization: '', yearsOfPractice: '', bio: '',

        region: '', regionName: '',
        province: '', provinceName: '',
        city: '', cityName: '',
        barangay: '', street: '', houseNumber: ''
    });
    
    const [initialData, setInitialData] = useState(null);

    // Exact derived properties
    const availableProvinces = formData.region ? provinces[formData.region] || [] : [];
    const availableCities = formData.province ? cities[formData.province] || [] : [];
    const availableBarangays = formData.city ? barangays[formData.city] || [] : [];

    // Helper: Calculate max date for 18+ validation
    const getMaxDate = () => {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        return maxDate.toISOString().split('T')[0];
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                setFetchError(null);
                
                const userId = user?.userId || user?.id || user?._id;
                
                if (!userId) {
                    setFetchError("User ID not found. Please log out and log back in.");
                    setIsLoading(false); return;
                }

                // CRITICAL RULE: authFetch implementation
                const response = await authFetch(`/user/${userId}`);

                if (response.ok) {
                    const data = await response.json();
                    
                    let formattedDate = '';
                    if (data?.birthdate) {
                        formattedDate = new Date(data.birthdate).toISOString().split('T')[0];
                    }

                    // Reverse Lookup to get the Address Codes from DB names
                    const dbRegion = data?.currentAddress?.region || '';
                    const dbProv = data?.currentAddress?.province || '';
                    const dbCity = data?.currentAddress?.city || '';
                    const dbBrgy = data?.currentAddress?.barangay || '';
                    
                    let rCode = '', pCode = '', cCode = '';

                    if (dbRegion && regions && regions.length > 0) {
                        const rMatch = regions.find(r => r.name === dbRegion);
                        rCode = rMatch ? rMatch.code : '';
                    }
                    if (dbProv && rCode && provinces[rCode]) {
                        const pMatch = provinces[rCode].find(p => p.name === dbProv);
                        pCode = pMatch ? pMatch.code : '';
                    }
                    if (dbCity && pCode && cities[pCode]) {
                        const cMatch = cities[pCode].find(c => c.name === dbCity);
                        cCode = cMatch ? cMatch.code : '';
                    }

                    const fetchedData = {
                        firstName: data?.name?.first || data?.firstName || '',
                        middleName: data?.name?.middle || '',
                        lastName: data?.name?.last || data?.lastName || '',
                        email: data?.email || '',
                        phone: data?.contactNumber ? String(data.contactNumber).replace('+63', '') : '',
                        profileImage: data?.profileImage || '',
                        birthdate: formattedDate,
                        gender: data?.gender || '',
                        
                        // Dentist Fields
                        prcLicenseNumber: data?.prcLicenseNumber || '',
                        specialization: data?.specialization || '',
                        yearsOfPractice: data?.yearsOfPractice || '',
                        bio: data?.bio || '',

                        region: rCode, regionName: dbRegion,
                        province: pCode, provinceName: dbProv,
                        city: cCode, cityName: dbCity,
                        barangay: dbBrgy, 
                        street: data?.currentAddress?.street || '',
                        houseNumber: data?.currentAddress?.houseNumber || '',

                        // §6.4: Read-only account metadata
                        createdAt: data?.createdAt || null,
                        lastLogin: data?.lastLogin  || null,
                    };
                    
                    setFormData(fetchedData);
                    setInitialData(fetchedData);
                } else {
                    setFetchError("Failed to load profile data.");
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
                setFetchError("Error: " + error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const hasChanges = initialData ? JSON.stringify(formData) !== JSON.stringify(initialData) : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = {...prev}; delete n[name]; return n; });
        
        if (name === 'phone') {
            const val = value ? String(value).replace(/[^0-9]/g, '') : '';
            if (val.length > 10) return;
            setFormData({ ...formData, phone: val });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    // --- CASCADING ADDRESS HANDLERS ---
    const handleRegionChange = (e) => {
        const code = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setFormData(prev => ({
            ...prev, region: code, regionName: name,
            province: '', provinceName: '', city: '', cityName: '', barangay: ''
        }));
        if (errors.region) setErrors(prev => { const n = {...prev}; delete n.region; return n; });
    };

    const handleProvinceChange = (e) => {
        const code = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setFormData(prev => ({
            ...prev, province: code, provinceName: name,
            city: '', cityName: '', barangay: ''
        }));
        if (errors.province) setErrors(prev => { const n = {...prev}; delete n.province; return n; });
    };

    const handleCityChange = (e) => {
        const code = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setFormData(prev => ({
            ...prev, city: code, cityName: name, barangay: ''
        }));
        if (errors.city) setErrors(prev => { const n = {...prev}; delete n.city; return n; });
    };

    const handleBarangayChange = (e) => {
        const name = e.target.value;
        setFormData(prev => ({ ...prev, barangay: name }));
        if (errors.barangay) setErrors(prev => { const n = {...prev}; delete n.barangay; return n; });
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profileImage: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const validateForm = () => {
        let newErrors = {}; 
        let isValid = true;

        if (!formData.firstName.trim()) { newErrors.firstName = "Required"; isValid = false; }
        if (!formData.lastName.trim()) { newErrors.lastName = "Required"; isValid = false; }
        if (!formData.birthdate) { newErrors.birthdate = "Required"; isValid = false; }
        if (!formData.gender) { newErrors.gender = "Required"; isValid = false; }
        
        if (!formData.phone) { 
            newErrors.phone = "Required"; isValid = false; 
        } else if (formData.phone.length !== 10 || formData.phone[0] !== '9') { 
            newErrors.phone = "Invalid format (e.g. 9xxxxxxxxx)"; isValid = false; 
        }

        // Dynamic Validation for Dentist Role
        if (user?.role === 'dentist') {
            if (!formData.prcLicenseNumber.trim()) { newErrors.prcLicenseNumber = "Required"; isValid = false; }
            if (!formData.specialization) { newErrors.specialization = "Required"; isValid = false; }
            if (!formData.yearsOfPractice) { newErrors.yearsOfPractice = "Required"; isValid = false; }
        }

        if (!formData.region) { newErrors.region = "Required"; isValid = false; }
        if (!formData.province) { newErrors.province = "Required"; isValid = false; }
        if (!formData.city) { newErrors.city = "Required"; isValid = false; }
        if (!formData.barangay) { newErrors.barangay = "Required"; isValid = false; }
        if (!formData.houseNumber.trim()) { newErrors.houseNumber = "Required"; isValid = false; }
        if (!formData.street.trim()) { newErrors.street = "Required"; isValid = false; }
        
        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            addToast("Please fill out all required fields correctly.", "error");
            return;
        }
        setIsSaving(true);

        try {
            const userId = user?.userId || user?.id || user?._id;

            // CRITICAL RULE: authFetch used for PUT request
            const response = await authFetch(`/user/update-profile/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: { 
                        first: formData.firstName.trim(), 
                        middle: formData.middleName.trim(), 
                        last: formData.lastName.trim() 
                    },
                    contactNumber: `+63${formData.phone}`,
                    profileImage: formData.profileImage,
                    birthdate: formData.birthdate,
                    gender: formData.gender,
                    
                    // Conditionally send dentist fields if role matches
                    ...(user?.role === 'dentist' && {
                        prcLicenseNumber: formData.prcLicenseNumber.trim(),
                        specialization: formData.specialization,
                        yearsOfPractice: Number(formData.yearsOfPractice),
                        bio: formData.bio.trim()
                    }),

                    currentAddress: {
                        region: formData.regionName,
                        province: formData.provinceName,
                        city: formData.cityName,
                        barangay: formData.barangay,
                        street: formData.street.trim(),
                        houseNumber: formData.houseNumber.trim()
                    }
                }),
            });

            if (response.ok) {
                setInitialData(formData);
                setIsEditing(false);
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                addToast(data.message || "Failed to update profile", "error");
            }
        } catch (error) {
            console.error(error);
            addToast("Error: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData(initialData);
        setErrors({});
        setIsEditing(false);
    };

    const handleRequestEmailChange = async (e) => {
        e.preventDefault();
        setEmailError('');
        if (!emailFormData.newEmail || !emailFormData.currentPassword) {
            setEmailError('All fields are required.'); return;
        }
        setIsSubmittingEmail(true);

        try {
            const response = await authFetch(`/user/request-email-change`, {
                method: 'POST',
                body: JSON.stringify({
                    newEmail: emailFormData.newEmail,
                    currentPassword: emailFormData.currentPassword
                }),
            });

            const data = await response.json();

            if (response.ok) {
                logout();
                navigate('/login', { state: { message: 'We sent a verification link to your new email. Please verify it to continue.' } });
            } else {
                setEmailError(data.message || 'Failed to request email change.');
            }
        } catch (error) {
            setEmailError('Cannot connect to server.');
        } finally {
            setIsSubmittingEmail(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#01538b' }}>
                    <h2>Loading Profile Data...</h2>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: '600' }}>
                    {fetchError}
                </div>
            </div>
        );
    }

    // Role display mappings
    const roleMap = {
        'administrator':    'Clinic Administrator',
        'branch-manager':   'Branch Manager',
        'dentist':          'Dentist',
        'secretary':        'Front Desk Personnel',
        'owner':            'Clinic Owner',              // ✅ Owner role label
    };
    
    const roleTagStyle = user?.role === 'administrator'
        ? { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }
            : user?.role === 'owner'
                ? { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }  // ✅ Amber tag for owner
                : {};

    const roleTitle = roleMap[user?.role] || 'Staff Account';
    const fullName  = `${formData.firstName} ${formData.lastName}`.trim();

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Profile</h1>
                    <p className={styles.subtitle}>Manage your personal information and account details.</p>
                </div>
            </div>

            <div className={styles.card}>
                <form onSubmit={handleSubmit} noValidate>
                    
                    <div className={styles.profileSection}>
                        <div className={styles.imageWrapper}>
                            {/* CRITICAL RULE: UserAvatar integration */}
                            <UserAvatar 
                                user={{ name: fullName, profileImage: formData.profileImage }} 
                                size={100} 
                                style={{ border: '3px solid #2dccf6' }} 
                            />
                            
                            {isEditing && (
                                <div className={styles.imageOverlay} onClick={() => fileInputRef.current.click()}>
                                    CHANGE
                                </div>
                            )}
                            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                        </div>
                        <div className={styles.profileText}>
                            <h2>
                                {user?.role === 'dentist' ? 'Dr. ' : ''}{formData.firstName || 'User'} {formData.middleName ? `${formData.middleName.charAt(0)}.` : ''} {formData.lastName || ''}
                            </h2>
                            {/* §6.4: Role-aware color badge */}
                            <span className={styles.roleTag} style={roleTagStyle}>
                                {roleTitle}
                            </span>
                        </div>
                    </div>

                    {/* --- PERSONAL INFORMATION --- */}
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                    
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <input 
                                className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`} 
                                name="firstName" value={formData.firstName} onChange={handleChange} 
                                disabled={!isEditing || isSaving}
                            />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>MIDDLE NAME</label>
                            <input 
                                className={styles.inputField} 
                                name="middleName" value={formData.middleName} onChange={handleChange} 
                                disabled={!isEditing || isSaving}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <input 
                                className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`} 
                                name="lastName" value={formData.lastName} onChange={handleChange} 
                                disabled={!isEditing || isSaving}
                            />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>EMAIL ADDRESS</label>
                            <div className={styles.emailRow}>
                                <input className={styles.inputField} value={formData.email} disabled={true} />
                                <button 
                                    type="button" 
                                    className={styles.changeEmailBtn} 
                                    onClick={() => setShowEmailModal(true)}
                                >
                                    Change Email
                                </button>
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>CONTACT NUMBER <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <span style={{ position: 'absolute', left: '20px', color: !isEditing ? '#94a3b8' : '#333', fontSize: '14px', fontWeight: '500' }}>+63</span>
                                <input 
                                    className={`${styles.inputField} ${errors.phone ? styles.errorBorder : ''}`} 
                                    style={{ paddingLeft: '55px' }}
                                    name="phone" value={formData.phone} onChange={handleChange} 
                                    maxLength={10} placeholder="9xxxxxxxxx" disabled={!isEditing || isSaving}
                                />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* --- DEMOGRAPHICS --- */}
                    <h3 className={styles.mainSectionTitle}>Demographics</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BIRTHDATE <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <input 
                                type="date"
                                max={getMaxDate()}
                                className={`${styles.inputField} ${errors.birthdate ? styles.errorBorder : ''}`} 
                                name="birthdate" 
                                value={formData.birthdate} 
                                onChange={handleChange} 
                                disabled={!isEditing || isSaving}
                            />
                            {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>GENDER <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <select 
                                className={`${styles.inputField} ${errors.gender ? styles.errorBorder : ''}`} 
                                name="gender" 
                                value={formData.gender} 
                                onChange={handleChange} 
                                disabled={!isEditing || isSaving}
                            >
                                <option value="" disabled>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                            {errors.gender && <span className={styles.errorText}>{errors.gender}</span>}
                        </div>
                    </div>

                    {/* --- DENTIST SPECIFIC: PROFESSIONAL DETAILS --- */}
                    {user?.role === 'dentist' && (
                        <>
                            <h3 className={styles.mainSectionTitle}>Professional Details</h3>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>PRC LICENSE NUMBER <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                                    <input 
                                        className={`${styles.inputField} ${errors.prcLicenseNumber ? styles.errorBorder : ''}`} 
                                        name="prcLicenseNumber" value={formData.prcLicenseNumber} onChange={handleChange} disabled={!isEditing || isSaving} 
                                        placeholder="e.g. 0123456"
                                    />
                                    {errors.prcLicenseNumber && <span className={styles.errorText}>{errors.prcLicenseNumber}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>YEARS OF PRACTICE <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                                    <input 
                                        type="number" className={`${styles.inputField} ${errors.yearsOfPractice ? styles.errorBorder : ''}`} 
                                        name="yearsOfPractice" value={formData.yearsOfPractice} onChange={handleChange} disabled={!isEditing || isSaving} 
                                        min="0"
                                    />
                                    {errors.yearsOfPractice && <span className={styles.errorText}>{errors.yearsOfPractice}</span>}
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>SPECIALIZATION <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                                    <select 
                                        className={`${styles.inputField} ${errors.specialization ? styles.errorBorder : ''}`} 
                                        name="specialization" value={formData.specialization} onChange={handleChange} disabled={!isEditing || isSaving}
                                    >
                                        <option value="">Select Specialization</option>
                                        <option value="General Dentistry">General Dentistry</option>
                                        <option value="Orthodontics">Orthodontics</option>
                                        <option value="Periodontics">Periodontics</option>
                                        <option value="Endodontics">Endodontics</option>
                                        <option value="Prosthodontics">Prosthodontics</option>
                                        <option value="Oral and Maxillofacial Surgery">Oral and Maxillofacial Surgery</option>
                                        <option value="Pediatric Dentistry">Pediatric Dentistry</option>
                                    </select>
                                    {errors.specialization && <span className={styles.errorText}>{errors.specialization}</span>}
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>PROFESSIONAL BIO</label>
                                    <textarea 
                                        className={`${styles.inputField} ${styles.textareaField}`} 
                                        name="bio" value={formData.bio} onChange={handleChange} disabled={!isEditing || isSaving} 
                                        placeholder="Brief summary of your expertise and background..."
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- Home Address --- */}
                    <h3 className={styles.mainSectionTitle}>Home Address</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>REGION <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <select className={`${styles.inputField} ${errors.region ? styles.errorBorder : ''}`} value={formData.region} onChange={handleRegionChange} disabled={!isEditing || isSaving}>
                                <option value="" disabled>Select Region</option>
                                {regions.map(r => (
                                    <option key={r.code} value={r.code}>{r.name}</option>
                                ))}
                            </select>
                            {errors.region && <span className={styles.errorText}>{errors.region}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PROVINCE <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <select className={`${styles.inputField} ${errors.province ? styles.errorBorder : ''}`} value={formData.province} onChange={handleProvinceChange} disabled={!isEditing || !formData.region || isSaving}>
                                <option value="" disabled>Select Province</option>
                                {availableProvinces.map(p => (
                                    <option key={p.code} value={p.code}>{p.name}</option>
                                ))}
                            </select>
                            {errors.province && <span className={styles.errorText}>{errors.province}</span>}
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CITY / MUNICIPALITY <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <select className={`${styles.inputField} ${errors.city ? styles.errorBorder : ''}`} value={formData.city} onChange={handleCityChange} disabled={!isEditing || !formData.province || isSaving}>
                                <option value="" disabled>Select City</option>
                                {availableCities.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                            {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>BARANGAY <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <select className={`${styles.inputField} ${errors.barangay ? styles.errorBorder : ''}`} value={formData.barangay} onChange={handleBarangayChange} disabled={!isEditing || !formData.city || isSaving}>
                                <option value="" disabled>Select Barangay</option>
                                {availableBarangays.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                            {errors.barangay && <span className={styles.errorText}>{errors.barangay}</span>}
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup} style={{ flex: 1 }}>
                            <label>HOUSE NO. <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <input 
                                className={`${styles.inputField} ${errors.houseNumber ? styles.errorBorder : ''}`} 
                                name="houseNumber" 
                                value={formData.houseNumber} 
                                onChange={handleChange} 
                                placeholder="e.g. Blk 1 Lot 2"
                                disabled={!isEditing || isSaving}
                            />
                            {errors.houseNumber && <span className={styles.errorText}>{errors.houseNumber}</span>}
                        </div>
                        <div className={styles.formGroup} style={{ flex: 2 }}>
                            <label>STREET <span style={{color: isEditing ? 'red' : 'transparent'}}>*</span></label>
                            <input 
                                className={`${styles.inputField} ${errors.street ? styles.errorBorder : ''}`} 
                                name="street" 
                                value={formData.street} 
                                onChange={handleChange} 
                                placeholder="e.g. Main St."
                                disabled={!isEditing || isSaving}
                            />
                            {errors.street && <span className={styles.errorText}>{errors.street}</span>}
                        </div>
                    </div>

                    {/* §6.4: Read-only account metadata — Account Created & Last Login */}
                    <h3 className={styles.mainSectionTitle}>Account Information</h3>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>ACCOUNT CREATED</label>
                            <input
                                className={styles.inputField}
                                value={
                                    formData.createdAt
                                        ? new Date(formData.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                          })
                                        : '—'
                                }
                                disabled
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST LOGIN</label>
                            <input
                                className={styles.inputField}
                                value={
                                    formData.lastLogin
                                        ? new Date(formData.lastLogin).toLocaleString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                          })
                                        : '—'
                                }
                                disabled
                            />
                        </div>
                    </div>

                    <div className={styles.buttonGroup}>
                        {!isEditing ? (
                            <button type="button" className={styles.editBtn} onClick={() => setIsEditing(true)}>
                                EDIT PROFILE
                            </button>
                        ) : (
                            <>
                                <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={isSaving}>
                                    CANCEL
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
                                    {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Profile Update Success Modal */}
            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>Your profile has been successfully updated.</p>
                        <button className={styles.modalButton} onClick={() => setShowSuccessModal(false)}>DONE</button>
                    </div>
                </div>
            )}

            {/* Request Email Change Modal */}
            {showEmailModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard} style={{ padding: '30px 40px' }}>
                        <h3 className={styles.modalTitle}>Change Email Address</h3>
                        <p className={styles.modalMessage} style={{ marginBottom: '20px' }}>
                            Enter your new email address and your current password to verify this request.
                        </p>
                        
                        <form onSubmit={handleRequestEmailChange} style={{ width: '100%', textAlign: 'left' }}>
                            <div className={styles.formGroup} style={{ marginBottom: '15px' }}>
                                <label>NEW EMAIL ADDRESS</label>
                                <input 
                                    type="email"
                                    className={styles.inputField} 
                                    value={emailFormData.newEmail} 
                                    onChange={(e) => setEmailFormData({...emailFormData, newEmail: e.target.value})}
                                    required
                                    disabled={isSubmittingEmail}
                                />
                            </div>
                            <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
                                <label>CURRENT PASSWORD</label>
                                <input 
                                    type="password"
                                    className={styles.inputField} 
                                    value={emailFormData.currentPassword} 
                                    onChange={(e) => setEmailFormData({...emailFormData, currentPassword: e.target.value})}
                                    required
                                    disabled={isSubmittingEmail}
                                />
                            </div>

                            {emailError && <div className={styles.errorText} style={{ textAlign: 'center', marginBottom: '15px' }}>{emailError}</div>}

                            <button type="submit" className={styles.submitBtn} style={{ width: '100%', marginBottom: '10px' }} disabled={isSubmittingEmail}>
                                {isSubmittingEmail ? 'REQUESTING...' : 'SEND VERIFICATION LINK'}
                            </button>
                            <button type="button" className={styles.cancelBtn} style={{ width: '100%' }} onClick={() => { setShowEmailModal(false); setEmailError(''); setEmailFormData({newEmail: '', currentPassword: ''}); }} disabled={isSubmittingEmail}>
                                CANCEL
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

