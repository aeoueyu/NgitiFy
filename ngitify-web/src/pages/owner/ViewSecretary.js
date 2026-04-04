import React, { useState, useEffect } from 'react';
import { regions, provinces, cities } from '../../utils/addressData';
import styles from '../../styles/owner/StaffModals.module.css';
import BackIcon from '../../assets/icons/Back.svg'; 

export default function ViewSecretary({ secretaryId, onClose, onEdit }) {
    const [secretary, setSecretary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSecretary = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/user/${secretaryId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
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

    const getInitials = (first, last) => {
        return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '?';
    };

    // ✅ REPLACE WITH
    const formatAddress = (addr) => {
        if (!addr || !addr.region) return "Not provided";
        const rName = regions.find(r => r.code === addr.region)?.name || addr.region;
        const pName = provinces[addr.region]?.find(p => p.code === addr.province)?.name || addr.province;
        const cName = cities[addr.province]?.find(c => c.code === addr.city)?.name || addr.city;
        return `${addr.houseNumber ? addr.houseNumber + ' ' : ''}${addr.street ? addr.street + ', ' : ''}${addr.barangay || ''}, ${cName}, ${pName}, ${rName}`;
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b' }}>Loading Profile...</div>
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
                            {secretary.profileImage ? (
                                <img src={secretary.profileImage} alt="Profile" className={styles.profileImageLg} />
                            ) : (
                                <div className={styles.profileInitialsLg}>{getInitials(secretary.name?.first, secretary.name?.last)}</div>
                            )}
                            <div>
                                <h3 className={styles.profileName}>{secretary.name?.first} {secretary.name?.last}</h3>
                                <p className={`${styles.profileRole} ${styles.secRole}`}>Front Desk Personnel</p>
                            </div>
                        </div>

                        <div className={styles.infoGrid}>
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
                                <p className={styles.infoValue}>{secretary.birthdate ? new Date(secretary.birthdate).toLocaleDateString() : 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{secretary.gender || 'Not provided'}</p>
                            </div>
                        </div>

                        <h3 className={styles.mainSectionTitle} style={{ fontSize: '15px', marginTop: '30px' }}>Address Details</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Current Address</span>
                                <p className={styles.infoValue}>{formatAddress(secretary.currentAddress)}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Permanent Address</span>
                                <p className={styles.infoValue}>{formatAddress(secretary.permanentAddress)}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Profile not found.</div>
                )}
            </div>
        </div>
    );
}