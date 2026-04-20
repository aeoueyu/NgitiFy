// ngitify-web/src/pages/admin/AddOwner.js
import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';

export default function AddOwner({ onClose, onSuccess }) {
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        assignedBranches: [],
        isDentist: false,
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

    const handleBranchToggle = (branchName) => {
        setFormData(prev => {
            const already = prev.assignedBranches.includes(branchName);
            return {
                ...prev,
                assignedBranches: already
                    ? prev.assignedBranches.filter(b => b !== branchName)
                    : [...prev.assignedBranches, branchName],
            };
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Required';
        if (!formData.email) newErrors.email = 'Required';
        else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email domain (e.g. gmail.com)';
        if (formData.phone && (formData.phone.length !== 10 || formData.phone[0] !== '9')) {
            newErrors.phone = 'Invalid format (9xxxxxxxxx)';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);

        const finalData = {
            name: { first: formData.firstName, last: formData.lastName },
            email: formData.email,
            contactNumber: formData.phone ? `+63${formData.phone}` : '',
            assignedBranches: formData.assignedBranches,
            isDentist: formData.isDentist,
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
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={`${styles.inputField} ${errors.firstName ? styles.errorBorder : ''}`}
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                maxLength={50}
                                disabled={isLoading}
                            />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={`${styles.inputField} ${errors.lastName ? styles.errorBorder : ''}`}
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                maxLength={50}
                                disabled={isLoading}
                            />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="email"
                                className={`${styles.inputField} ${errors.email ? styles.errorBorder : ''}`}
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                maxLength={100}
                                disabled={isLoading}
                            />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER</label>
                            <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input
                                    className={styles.phoneField}
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    maxLength={10}
                                    placeholder="9xxxxxxxxx"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Grant Dentist Access Toggle */}
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Dentist Access</h3>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px', marginTop: '-12px' }}>
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
                            <span style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                background: formData.isDentist ? '#01538b' : '#cbd5e1',
                                borderRadius: '24px', transition: '0.3s',
                            }}>
                                <span style={{
                                    position: 'absolute', content: '', height: '18px', width: '18px',
                                    left: formData.isDentist ? '22px' : '3px', bottom: '3px',
                                    background: 'white', borderRadius: '50%', transition: '0.3s',
                                    display: 'block',
                                }} />
                            </span>
                        </label>
                        <div>
                            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: formData.isDentist ? '#1d4ed8' : '#374151' }}>
                                Grant Dentist Access
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                {formData.isDentist ? 'Owner will have full dentist-level clinical features.' : 'Owner will have business-level access only.'}
                            </p>
                        </div>
                    </div>

                    {/* Branch Assignment */}
                    {branchOptions.length > 0 && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px', marginTop: '-12px' }}>
                                Select the branches this owner oversees.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                                {branchOptions.map(branch => (
                                    <label
                                        key={branch}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            cursor: 'pointer', padding: '6px 12px',
                                            border: `1px solid ${formData.assignedBranches.includes(branch) ? '#01538b' : '#e2e8f0'}`,
                                            borderRadius: '6px',
                                            backgroundColor: formData.assignedBranches.includes(branch) ? '#e8f4fd' : '#fff',
                                            fontSize: '14px',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.assignedBranches.includes(branch)}
                                            onChange={() => handleBranchToggle(branch)}
                                            disabled={isLoading}
                                        />
                                        {branch}
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
                            CANCEL
                        </button>
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
                        <p className={styles.modalMessage}>
                            The owner account has been created successfully. An activation email has been sent.
                        </p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}