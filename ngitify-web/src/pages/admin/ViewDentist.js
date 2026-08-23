import React, { useState, useEffect } from 'react';
import styles from '../../styles/admin/StaffModals.module.css';
import BackIcon from '../../assets/icons/Back.svg'; 

// TASK 2.1 & 2.2: Import Global Utilities
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';
import { formatDateShort } from '../../utils/dateUtils';
import { formatAddressDisplay, getHomeAddress } from '../../utils/addressHelpers';
import { getAccessRecoveryLabel, shouldShowAccessRecovery } from '../../utils/accountStatus';
import LifecycleHistoryPanel from '../../components/common/LifecycleHistoryPanel';
import ResendEmailButton from '../../components/common/ResendEmailButton';

export default function ViewDentist({ dentistId, onClose, onEdit, onRecoverAccess }) {
    const [dentist, setDentist] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDentist = async () => {
            try {
                // TASK 2.1: Replace raw fetch and inline token with authFetch
                const response = await authFetch(`/user/${dentistId}`);
                if (response.ok) {
                    const data = await response.json();
                    setDentist(data);
                } else alert("Failed to load dentist data");
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (dentistId) fetchDentist();
    }, [dentistId]);

    const handleRecoverAccessClick = async () => {
        if (!dentist || !onRecoverAccess) return;
        const updatedAccount = await onRecoverAccess(dentist);
        if (updatedAccount) {
            setDentist((prev) => (prev ? { ...prev, ...updatedAccount } : prev));
        }
        return updatedAccount;
    };

    // TASK 2.2: Removed getInitials as UserAvatar handles this automatically

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
                ) : dentist ? (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose}><img src={BackIcon} alt="Back" /></button>
                                <div className={styles.header}>
                                    <h2>Dentist <span className={styles.highlight}>Profile</span></h2>
                                </div>
                            </div>
                            {!dentist?.isArchived && <button className={styles.editActionBtn} onClick={onEdit}>EDIT PROFILE</button>}
                        </div>

                        <div className={styles.profileHeader}>
                            {/* TASK 2.2: Adopt UserAvatar for clean, consistent UI */}
                            <UserAvatar 
                                user={{ 
                                    name: `${dentist.name?.first || ''} ${dentist.name?.last || ''}`.trim() || 'Dentist', 
                                    profileImage: dentist.profileImage 
                                }} 
                                size={70} 
                            />
                            <div>
                                <h3 className={styles.profileName}>Dr. {dentist.name?.first} {dentist.name?.last}</h3>
                                <p className={styles.profileRole}>{dentist.specialization || 'General Dentist'}</p>
                            </div>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Assigned Branch</span>
                                <p className={styles.infoValue}>{dentist.assignedBranch || dentist.assignedBranches?.[0] || 'Not assigned'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Account Status</span>
                                <p className={styles.infoValue}>{dentist.isArchived ? 'Archived' : dentist.status === 'active' ? 'Active' : dentist.isVerified ? 'Inactive' : 'Needs Activation'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Email Address</span>
                                <p className={styles.infoValue}>{dentist.email}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Contact Number</span>
                                <p className={styles.infoValue}>{dentist.contactNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>License Number</span>
                                <p className={styles.infoValue}>{dentist.licenseNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Birthdate</span>
                                {/* TASK 2.2: Adopt dateUtils */}
                                <p className={styles.infoValue}>{dentist.birthdate ? formatDateShort(new Date(dentist.birthdate)) : 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{dentist.gender || 'Not provided'}</p>
                            </div>
                        </div>

                        {shouldShowAccessRecovery(dentist) && onRecoverAccess && (
                            <div style={{ marginTop: '-8px', marginBottom: '22px' }}>
                                <ResendEmailButton
                                    cooldownKey={`dentist:${dentistId}`}
                                    onResend={handleRecoverAccessClick}
                                    label={getAccessRecoveryLabel(dentist)}
                                    style={{
                                        border: '1px solid #bfdbfe',
                                        background: '#eff6ff',
                                        color: '#01538b',
                                        borderRadius: '999px',
                                        padding: '10px 16px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                        )}

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Home Address</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>Home Address</span>
                                <p className={styles.infoValue}>{formatAddressDisplay(getHomeAddress(dentist))}</p>
                            </div>
                        </div>

                        <LifecycleHistoryPanel account={dentist} entityLabel="dentist account" />
                    </>
                ) : (
                    <div className={styles.errorState}>Profile not found.</div>
                )}
            </div>
        </div>
    );
}
