import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';

export default function EditBranchManager({ managerId, onClose, onSuccess }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        assignedBranches: []
    });

    const [initialData, setInitialData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userRes, branchRes] = await Promise.all([
                    authFetch(`/user/${managerId}`),
                    authFetch('/branches')
                ]);

                if (userRes.ok) {
                    const data = await userRes.json();
                    let phone = data.contactNumber || data.phone || '';
                    if (phone.startsWith('+63')) phone = phone.substring(3);

                    const fetched = {
                        firstName: data.name?.first || '',
                        lastName: data.name?.last || '',
                        email: data.email || '',
                        phone,
                        assignedBranches: data.assignedBranches || []
                    };
                    setFormData(fetched);
                    setInitialData(fetched);
                } else {
                    alert('Failed to load branch manager data.');
                    onClose();
                }

                if (branchRes.ok) {
                    const bData = await branchRes.json();
                    setBranchOptions(bData.map(b => b.name));
                }
            } catch (e) {
                console.error(e);
                alert('Cannot connect to server.');
                onClose();
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [managerId, onClose]);

    const hasChanges = initialData
        ? JSON.stringify(formData) !== JSON.stringify(initialData)
        : false;

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
        if (!formData.firstName || !formData.lastName || !formData.email) {
            setErrorMessage('First name, last name, and email are required.');
            return;
        }
        setIsSaving(true);
        setErrorMessage('');

        const finalData = {
            name: { first: formData.firstName, last: formData.lastName },
            email: formData.email,
            contactNumber: formData.phone ? `+63${formData.phone}` : '',
            assignedBranches: formData.assignedBranches
        };

        try {
            const res = await authFetch(`/user/${managerId}`, {
                method: 'PUT',
                body: JSON.stringify(finalData)
            });
            const data = await res.json();
            if (res.ok) {
                setShowSuccessModal(true);
            } else {
                setErrorMessage(data.message || 'Failed to update branch manager.');
            }
        } catch (e) {
            console.error(e);
            setErrorMessage('Cannot connect to server.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess();
        onClose();
    };

    return (
        <div className={styles.mainOverlay} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={!isSaving && !showSuccessModal ? onClose : undefined}></div>

            <div className={styles.formCard} style={{ position: 'relative', zIndex: 1, maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: '600px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b', fontWeight: 'bold' }}>
                        Loading Branch Manager Data...
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#01538b', margin: 0 }}>
                                Edit Branch Manager
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
                                Update the branch manager's information below.
                            </p>
                        </div>

                        {errorMessage && (
                            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
                                {errorMessage}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>First Name *</label>
                                    <input
                                        type="text" name="firstName" value={formData.firstName}
                                        onChange={handleChange} className={styles.input}
                                        required disabled={isSaving}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Last Name *</label>
                                    <input
                                        type="text" name="lastName" value={formData.lastName}
                                        onChange={handleChange} className={styles.input}
                                        required disabled={isSaving}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email Address *</label>
                                    <input
                                        type="email" name="email" value={formData.email}
                                        onChange={handleChange} className={styles.input}
                                        required disabled={isSaving}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Phone Number</label>
                                    <input
                                        type="tel" name="phone" value={formData.phone}
                                        onChange={handleChange} className={styles.input}
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            {branchOptions.length > 0 && (
                                <>
                                    <hr className={styles.divider} />
                                    <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
                                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px', marginTop: '-10px' }}>
                                        Select the branches this manager will oversee.
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
                                                    disabled={isSaving}
                                                />
                                                {branch}
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
                                    {isSaving ? 'Saving...' : 'Update Branch Manager'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>

            {showSuccessModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '360px', width: '90%' }}>
                        <img src={successIcon} alt="Success" style={{ width: '60px', marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#01538b', marginBottom: '8px' }}>Success!</h3>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>Branch manager profile updated successfully.</p>
                        <button className={styles.submitBtn} onClick={handleSuccessClose}>Done</button>
                    </div>
                </div>
            )}
        </div>
    );
}