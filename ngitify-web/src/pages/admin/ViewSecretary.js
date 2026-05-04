import React, { useState, useEffect } from 'react';
import styles from '../../styles/admin/StaffModals.module.css';
import BackIcon from '../../assets/icons/Back.svg'; 

// TASK 2.1 & 2.2: Import Global Utilities
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';
import { formatDateShort } from '../../utils/dateUtils';
import { formatAddressDisplay } from '../../utils/addressHelpers';

export default function ViewSecretary({ secretaryId, onClose, onEdit }) {
    const [secretary, setSecretary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSecretary = async () => {
            try {
                // TASK 2.1: Replace raw fetch and inline token with authFetch
                const response = await authFetch(`/user/${secretaryId}`);
                if (response.ok) {
                    const data = await response.json();
                    setSecretary(data);
                } else alert("Failed to load secretary data");
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (secretaryId) fetchSecretary();
    }, [secretaryId]);

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
                ) : secretary ? (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose}><img src={BackIcon} alt="Back" /></button>
                                <div className={styles.header}>
                                    <h2>Secretary <span className={styles.highlight}>Profile</span></h2>
                                </div>
                            </div>
                            <button className={styles.editActionBtn} onClick={onEdit}>EDIT PROFILE</button>
                        </div>

                        <div className={styles.profileHeader}>
                            {/* TASK 2.2: Adopt UserAvatar for clean, consistent UI */}
                            <UserAvatar 
                                user={{ 
                                    name: `${secretary.name?.first || ''} ${secretary.name?.last || ''}`.trim() || 'Secretary', 
                                    profileImage: secretary.profileImage 
                                }} 
                                size={70} 
                            />
                            <div>
                                <h3 className={styles.profileName}>{secretary.name?.first} {secretary.name?.last}</h3>
                                <p className={`${styles.profileRole} ${styles.secRole}`}>Front Desk Personnel</p>
                            </div>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Assigned Branch</span>
                                <p className={styles.infoValue}>{secretary.assignedBranch || secretary.assignedBranches?.[0] || 'Not assigned'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Email Address</span>
                                <p className={styles.infoValue}>{secretary.email}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Contact Number</span>
                                <p className={styles.infoValue}>{secretary.contactNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Birthdate</span>
                                {/* TASK 2.2: Adopt dateUtils */}
                                <p className={styles.infoValue}>{secretary.birthdate ? formatDateShort(new Date(secretary.birthdate)) : 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{secretary.gender || 'Not provided'}</p>
                            </div>
                        </div>

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Home Address</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>Home Address</span>
                                <p className={styles.infoValue}>{formatAddressDisplay(secretary.currentAddress?.region ? secretary.currentAddress : secretary.permanentAddress)}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.errorState}>Profile not found.</div>
                )}
            </div>
        </div>
    );
}
