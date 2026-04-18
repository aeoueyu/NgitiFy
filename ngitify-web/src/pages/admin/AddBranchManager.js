import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css'; // reuse AddDentist styles

const AddBranchManager = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

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
        setFormData(prev => ({ ...prev, [name]: value }));
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        const finalData = {
            name: { first: formData.firstName, last: formData.lastName },
            email: formData.email,
            contactNumber: formData.phone,
            assignedBranches: formData.assignedBranches
        };

        try {
            const res = await authFetch('/add-branch-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData)
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage('Branch Manager added successfully! Activation email sent.');
                setFormData({ firstName: '', lastName: '', email: '', phone: '', assignedBranches: [] });
            } else {
                setErrorMessage(data.message || 'Failed to add branch manager.');
            }
        } catch (e) {
            setErrorMessage('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.formCard}>
                <div className={styles.formHeader}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
                    <h2 className={styles.formTitle}>Add Branch Manager</h2>
                </div>

                {successMessage && <div className={styles.successAlert}>{successMessage}</div>}
                {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>First Name *</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={styles.input}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Last Name *</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className={styles.input}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Email Address *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={styles.input}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className={styles.input}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {branchOptions.length > 0 && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px', marginTop: '-15px' }}>
                                Select the branches this manager will oversee.
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
                                            fontSize: '14px'
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
                        <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? 'Adding...' : 'Add Branch Manager'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddBranchManager;