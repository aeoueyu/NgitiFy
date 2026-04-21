import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import { useToast } from '../../context/ToastContext';

const AddCoAdmin = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        assignedBranches: []
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
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) return;
        if (errors.phone) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        setFormData(prev => ({ ...prev, phone: value }));
    };

    const handleBranchToggle = (branchName) => {
        setFormData(prev => {
            const already = prev.assignedBranches.includes(branchName);
            return {
                ...prev,
                assignedBranches: already
                    ? prev.assignedBranches.filter(b => b !== branchName)
                    : [...prev.assignedBranches, branchName]
            };
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Required';
        if (!formData.lastName.trim())  newErrors.lastName  = 'Required';
        if (!formData.email.trim())     newErrors.email     = 'Required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
            newErrors.email = 'Invalid email address';
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
            name: { first: formData.firstName.trim(), last: formData.lastName.trim() },
            email: formData.email.trim(),
            contactNumber: formData.phone ? `+63${formData.phone}` : '',
            assignedBranches: formData.assignedBranches
        };

        try {
            const res = await authFetch('/add-co-administrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData)
            });
            const data = await res.json();

            if (res.ok) {
                addToast(
                    `Co-Administrator ${formData.firstName} ${formData.lastName} added. Activation email sent.`,
                    'success'
                );
                navigate('/admin/manage-users/co-admins');
            } else if (res.status === 409) {
                setErrors({ email: data.message || 'This email is already in use.' });
            } else {
                addToast(data.message || 'Failed to add co-administrator.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.formCard}>
                <div className={styles.formHeader}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)} disabled={isLoading}>
                        ← Back
                    </button>
                    <h2 className={styles.formTitle}>Add Co-Administrator</h2>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>First Name <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="text" name="firstName" value={formData.firstName}
                                onChange={handleChange}
                                className={`${styles.input} ${errors.firstName ? styles.errorBorder : ''}`}
                                disabled={isLoading}
                            />
                            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Last Name <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="text" name="lastName" value={formData.lastName}
                                onChange={handleChange}
                                className={`${styles.input} ${errors.lastName ? styles.errorBorder : ''}`}
                                disabled={isLoading}
                            />
                            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Email Address <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="email" name="email" value={formData.email}
                                onChange={handleChange}
                                className={`${styles.input} ${errors.email ? styles.errorBorder : ''}`}
                                disabled={isLoading}
                            />
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Phone Number</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <span style={{ position: 'absolute', left: '14px', color: '#64748b', fontSize: '14px', fontWeight: '500', pointerEvents: 'none' }}>
                                    +63
                                </span>
                                <input
                                    type="tel" name="phone" value={formData.phone}
                                    onChange={handlePhoneChange}
                                    className={`${styles.input} ${errors.phone ? styles.errorBorder : ''}`}
                                    style={{ paddingLeft: '48px' }}
                                    placeholder="9xxxxxxxxx" maxLength={10}
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                        </div>
                    </div>

                    {branchOptions.length > 0 && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px', marginTop: '-15px' }}>
                                Select the branches this co-administrator will have access to.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                                {branchOptions.map(branch => (
                                    <label key={branch} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        cursor: 'pointer', padding: '6px 12px',
                                        border: `1px solid ${formData.assignedBranches.includes(branch) ? '#01538b' : '#e2e8f0'}`,
                                        borderRadius: '6px',
                                        backgroundColor: formData.assignedBranches.includes(branch) ? '#e8f4fd' : '#fff',
                                        fontSize: '14px'
                                    }}>
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
                        <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? 'Adding...' : 'Add Co-Administrator'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddCoAdmin;