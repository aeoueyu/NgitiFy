// ngitify-web/src/pages/admin/EditOwner.js
import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AddDentist.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';

export default function EditOwner({ ownerId, onClose, onSuccess }) {
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
        assignedBranches: [],
        isDentist: false,
    });

    const [initialData, setInitialData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userRes, branchRes] = await Promise.all([
                    authFetch(`/user/${ownerId}`),
                    authFetch('/branches'),
                ]);

                if (userRes.ok) {
                    const data = await userRes.json();
                    let phone = data.contactNumber || '';
                    if (phone.startsWith('+63')) phone = phone.substring(3);

                    const fetched = {
                        firstName: data.name?.first || '',
                        lastName: data.name?.last || '',
                        email: data.email || '',
                        phone,
                        assignedBranches: data.assignedBranches || [],
                        isDentist: data.isDentist || false,
                    };
                    setFormData(fetched);
                    setInitialData(fetched);
                } else {
                    alert('Failed to load owner data.');
                    onClose();
                }

                if (branchRes.ok) {
                    const bData = await branchRes.json();
                    setBranchOptions(bData.map(b => b.name));
                }
            } catch {
                alert('Cannot connect to server.');
                onClose();
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [ownerId, onClose]);

    const hasChanges = initialData
        ? JSON.stringify(formData) !== JSON.stringify(initialData)
        : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
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
            assignedBranches: formData.assignedBranches,
            isDentist: formData.isDentist,
        };

        try {
            const res = await authFetch(`/user/${ownerId}`, {
                method: 'PUT',
                body: JSON.stringify(finalData),
            });
            const data = await res.json();
            if (res.ok) {
                setShowSuccessModal(true);
            } else {
                setErrorMessage(data.message || 'Failed to update owner.');
            }
        } catch {
            setErrorMessage('Cannot connect to server.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.mainOverlay}>
                <div className={styles.overlayBackground} onClick={onClose} />
                <div className={styles.formCard} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <p style={{ color: '#64748b' }}>Loading owner data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                        <img src={BackIcon} alt="Back" />
                    </button>
                    <div className={styles.header}>
                        <h2>Edit <span className={styles.highlight}>Owner</span></h2>
                        <p>Update the owner's information and access settings.</p>
                    </div>
                </div>

                {errorMessage && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <h3 className={styles.mainSectionTitle}>Personal Information</h3>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>FIRST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={styles.inputField}
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                maxLength={50}
                                disabled={isSaving}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>LAST NAME <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className={styles.inputField}
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                maxLength={50}
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>EMAIL ADDRESS <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="email"
                                className={styles.inputField}
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                maxLength={100}
                                disabled={isSaving}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>PHONE NUMBER</label>
                            <div className={styles.phoneInputGroup}>
                                <span className={styles.phonePrefix}>+63</span>
                                <input
                                    className={styles.phoneField}
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    maxLength={10}
                                    placeholder="9xxxxxxxxx"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dentist Access Toggle */}
                    <hr className={styles.divider} />
                    <h3 className={styles.mainSectionTitle}>Dentist Access</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: formData.isDentist ? '#eff6ff' : '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${formData.isDentist ? '#bfdbfe' : '#e2e8f0'}` }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                            <input
                                type="checkbox"
                                checked={formData.isDentist}
                                onChange={e => setFormData(prev => ({ ...prev, isDentist: e.target.checked }))}
                                disabled={isSaving}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                background: formData.isDentist ? '#01538b' : '#cbd5e1',
                                borderRadius: '24px', transition: '0.3s',
                            }}>
                                <span style={{
                                    position: 'absolute', height: '18px', width: '18px',
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
                                {formData.isDentist ? 'Owner has full dentist-level clinical features.' : 'Owner has business-level access only.'}
                            </p>
                        </div>
                    </div>

                    {/* Branch Assignment */}
                    {branchOptions.length > 0 && (
                        <>
                            <hr className={styles.divider} />
                            <h3 className={styles.mainSectionTitle}>Branch Assignment</h3>
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
                            CANCEL
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
                            {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                        </button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Changes Saved!</h3>
                        <p className={styles.modalMessage}>The owner's account has been updated successfully.</p>
                        <button className={styles.modalButton} onClick={() => { setShowSuccessModal(false); onSuccess(); onClose(); }}>
                            DONE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}