import React, { useEffect, useState } from 'react';
import styles from '../../styles/admin/StaffModals.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';
import { formatDateShort } from '../../utils/dateUtils';
import { formatAddressDisplay } from '../../utils/addressHelpers';

export default function ViewOwner({ ownerId, onClose, onEdit }) {
    const [owner, setOwner] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOwner = async () => {
            try {
                const response = await authFetch(`/user/${ownerId}`);
                if (response.ok) {
                    setOwner(await response.json());
                } else {
                    alert('Failed to load owner data');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (ownerId) fetchOwner();
    }, [ownerId]);

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
                ) : owner ? (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose}><img src={BackIcon} alt="Back" /></button>
                                <div className={styles.header}>
                                    <h2>Owner <span className={styles.highlight}>Profile</span></h2>
                                </div>
                            </div>
                            <button className={styles.editActionBtn} onClick={onEdit}>EDIT PROFILE</button>
                        </div>

                        <div className={styles.profileHeader}>
                            <UserAvatar
                                user={{
                                    name: `${owner.name?.first || ''} ${owner.name?.last || ''}`.trim() || 'Owner',
                                    profileImage: owner.profileImage,
                                }}
                                size={70}
                            />
                            <div>
                                <h3 className={styles.profileName}>{owner.name?.first} {owner.name?.last}</h3>
                                <p className={styles.profileRole}>{owner.isDentist ? 'Owner with Dentist Access' : 'Clinic Owner'}</p>
                            </div>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Assigned Branch</span>
                                <p className={styles.infoValue}>{owner.assignedBranch || owner.assignedBranches?.[0] || 'Not assigned'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Email Address</span>
                                <p className={styles.infoValue}>{owner.email}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Contact Number</span>
                                <p className={styles.infoValue}>{owner.contactNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Birthdate</span>
                                <p className={styles.infoValue}>{owner.birthdate ? formatDateShort(new Date(owner.birthdate)) : 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{owner.gender || 'Not provided'}</p>
                            </div>
                            {owner.isDentist && (
                                <>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>License Number</span>
                                        <p className={styles.infoValue}>{owner.licenseNumber || 'Not provided'}</p>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>Specialization</span>
                                        <p className={styles.infoValue}>{owner.specialization || 'Not provided'}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Home Address</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>Home Address</span>
                                <p className={styles.infoValue}>{formatAddressDisplay(owner.currentAddress?.region ? owner.currentAddress : owner.permanentAddress)}</p>
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
