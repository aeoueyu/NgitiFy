import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import { useToast } from '../../context/ToastContext';

export default function AddCoAdmin({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: '',
        assignedBranches: [],
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
        if (errors.phone) setErrors(prev => { const n = { ...prev }; delete n.phone; return n; });
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
        if (!formData.lastName.trim())  newErrors.lastName  = 'Required';
        if (!formData.email)            newErrors.email     = 'Required';
        else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email domain (e.g. gmail.com)';
        if (formData.phone && (formData.phone.length !== 10 || formData.phone[0] !== '9'))
            newErrors.phone = 'Invalid format (9xxxxxxxxx)';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);

        const finalData = {
            name:             { first: formData.firstName.trim(), last: formData.lastName.trim() },
            email:            formData.email.trim(),
            contactNumber:    formData.phone ? `+63${formData.phone}` : '',
            gender:           formData.gender,
            assignedBranches: formData.assignedBranches,
        };

        try {
            const res = await authFetch('/add-co-administrator', {
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
                addToast(data.message || 'Failed to add co-administrator.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
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
                        <h2>Add New <span className={styles.highlight}>Co-Administrator</span></h2>
                        <p>Enter the co-administrator's details and configure their access.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    {/* Row 1: First / Last Name */}
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

                    {/* Row 2: Email / Phone */}
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

                    {/* Row 3: Gender */}
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>GENDER</label>
                            <select
                                className={styles.inputField}
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                disabled={isLoading}
                            >
                                <option value="" hidden>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                        <div className={styles.formGroup} />
                    </div>

                    {/* Branch Assignment */}
                    {branchOptions.length > 0 && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p className={styles.sectionSubtitle}>
                                Select the branches this co-administrator will have access to.
                            </p>
                            <div className={styles.branchChipsContainer}>
                                {branchOptions.map(branch => (
                                    <label
                                        key={branch}
                                        className={`${styles.branchChip} ${formData.assignedBranches.includes(branch) ? styles.branchChipActive : ''}`}
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
                            {isLoading ? 'ADDING...' : 'ADD CO-ADMINISTRATOR'}
                        </button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Co-Administrator Added!</h3>
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