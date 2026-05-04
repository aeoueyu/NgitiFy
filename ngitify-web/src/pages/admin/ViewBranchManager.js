import React, { useEffect, useState } from 'react';
import styles from '../../styles/admin/StaffModals.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';
import { formatDateShort } from '../../utils/dateUtils';
import { formatAddressDisplay } from '../../utils/addressHelpers';

export default function ViewBranchManager({ managerId, onClose, onEdit }) {
    const [manager, setManager] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchManager = async () => {
            try {
                const response = await authFetch(`/user/${managerId}`);
                if (response.ok) {
                    setManager(await response.json());
                } else {
                    alert('Failed to load branch manager data');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (managerId) fetchManager();
    }, [managerId]);

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
                ) : manager ? (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose}><img src={BackIcon} alt="Back" /></button>
                                <div className={styles.header}>
                                    <h2>Branch Manager <span className={styles.highlight}>Profile</span></h2>
                                </div>
                            </div>
                            <button className={styles.editActionBtn} onClick={onEdit}>EDIT PROFILE</button>
                        </div>

                        <div className={styles.profileHeader}>
                            <UserAvatar
                                user={{
                                    name: `${manager.name?.first || ''} ${manager.name?.last || ''}`.trim() || 'Branch Manager',
                                    profileImage: manager.profileImage,
                                }}
                                size={70}
                            />
                            <div>
                                <h3 className={styles.profileName}>{manager.name?.first} {manager.name?.last}</h3>
                                <p className={styles.profileRole}>Branch Manager</p>
                            </div>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Assigned Branch</span>
                                <p className={styles.infoValue}>{manager.assignedBranch || manager.assignedBranches?.[0] || 'Not assigned'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Email Address</span>
                                <p className={styles.infoValue}>{manager.email}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Contact Number</span>
                                <p className={styles.infoValue}>{manager.contactNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Birthdate</span>
                                <p className={styles.infoValue}>{manager.birthdate ? formatDateShort(new Date(manager.birthdate)) : 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{manager.gender || 'Not provided'}</p>
                            </div>
                        </div>

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Home Address</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>Home Address</span>
                                <p className={styles.infoValue}>{formatAddressDisplay(manager.currentAddress?.region ? manager.currentAddress : manager.permanentAddress)}</p>
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
