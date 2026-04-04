import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/owner/MyProfile.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import successIcon from '../../assets/alert/success.svg';

export default function MyProfile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [fetchError, setFetchError] = useState(null); 

    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', phone: '', profileImage: ''
    });
    const [initialData, setInitialData] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                setFetchError(null);
                
                const token = localStorage.getItem('token');
                
                if (!token) {
                    setFetchError("No authentication token found.");
                    setIsLoading(false);
                    return;
                }

                // Safe JWT Decode: Replace Base64URL characters before atob()
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(base64));
                const userId = payload.userId || payload.id || payload._id;
                
                if (!userId) {
                    setFetchError("User ID not found in token. Please try logging out and logging back in.");
                    setIsLoading(false); 
                    return;
                }

                const response = await fetch(`http://localhost:5000/api/user/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const fetchedData = {
                        firstName: data.name?.first || data.firstName || '',
                        lastName: data.name?.last || data.lastName || '',
                        email: data.email || '',
                        phone: data.contactNumber ? data.contactNumber.replace('+63', '') : '',
                        profileImage: data.profileImage || ''
                    };
                    setFormData(fetchedData);
                    setInitialData(fetchedData);
                } else {
                    setFetchError("Failed to load profile data.");
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
                // Dynamically display the exact error message
                setFetchError("Error: " + error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const getInitials = (first, last) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '?';

    const hasChanges = initialData ? JSON.stringify(formData) !== JSON.stringify(initialData) : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (errors[name]) setErrors(prev => { const n = {...prev}; delete n[name]; return n; });
        
        if (name === 'phone') {
            const val = value.replace(/[^0-9]/g, '');
            if (val.length > 10) return;
            setFormData({ ...formData, phone: val });
        } else {
            setFormData({ ...formData, [name]: value });
        }
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
        let newErrors = {}; let isValid = true;
        if (!formData.firstName.trim()) { newErrors.firstName = "Required"; isValid = false; }
        if (!formData.lastName.trim()) { newErrors.lastName = "Required"; isValid = false; }
        if (!formData.phone) { newErrors.phone = "Required"; isValid = false; }
        else if (formData.phone.length !== 10 || formData.phone[0] !== '9') { newErrors.phone = "Invalid format (e.g. 9xxxxxxxxx)"; isValid = false; }
        
        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSaving(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert("Authentication token missing. Cannot save changes.");
                setIsSaving(false);
                return;
            }

            // Safe JWT Decode: Replace Base64URL characters before atob()
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64));
            const userId = payload.userId || payload.id || payload._id;

            if (!userId) {
                alert("User ID missing from token. Cannot save changes.");
                setIsSaving(false);
                return;
            }

            const response = await fetch(`http://localhost:5000/api/user/update-profile/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    name: { first: formData.firstName.trim(), last: formData.lastName.trim() },
                    contactNumber: `+63${formData.phone}`,
                    profileImage: formData.profileImage
                }),
            });

            if (response.ok) {
                setInitialData(formData);
                setIsEditing(false);
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                alert(data.message || "Failed to update profile");
            }
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData(initialData);
        setErrors({});
        setIsEditing(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <button className={styles.backIconButton} onClick={() => navigate('/owner/dashboard')}>
                    <img src={BackIcon} alt="Back" />
                </button>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Profile</h1>
                    <p className={styles.subtitle}>Manage your personal information and account details.</p>
                </div>
            </div>

            <div className={styles.card}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#01538b' }}>Loading profile...</div>
                ) : fetchError ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545', fontWeight: '600' }}>
                        {fetchError}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        
                        <div className={styles.profileSection}>
                            <div className={styles.imageWrapper}>
                                {formData.profileImage ? (
                                    <img src={formData.profileImage} alt="Profile" className={styles.profileImage} />
                                ) : (
                                    <div className={styles.profileInitials}>
                                        {getInitials(formData.firstName, formData.lastName)}
                                    </div>
                                )}
                                
                                {isEditing && (
                                    <div className={styles.imageOverlay} onClick={() => fileInputRef.current.click()}>
                                        CHANGE
                                    </div>
                                )}
                                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                            </div>
                            <div className={styles.profileText}>
                                <h2>{formData.firstName} {formData.lastName}</h2>
                                <span className={styles.roleTag}>Clinic Owner</span>
                            </div>
                        </div>

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
                                <label>EMAIL ADDRESS (Read-Only)</label>
                                <input className={styles.inputField} value={formData.email} disabled={true} title="Email cannot be changed here" />
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
                )}
            </div>

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
        </div>
    );
}