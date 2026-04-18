import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/StaffModals.module.css'; // Utilizing unified UI
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import BackIcon from '../../assets/icons/Back.svg';

export default function ViewPatient({ patientId, onClose, onEdit }) {
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const response = await authFetch(`/user/${patientId}`);
                if (response.ok) {
                    const data = await response.json();
                    setPatient(data);
                } else {
                    alert("Failed to load patient data");
                    onClose();
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Cannot connect to server");
                onClose();
            } finally {
                setIsLoading(false);
            }
        };
        if (patientId) fetchPatient();
    }, [patientId, onClose]);

    const getInitials = (first, last) => {
        return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '?';
    };

    const getAge = (birthDateString) => {
        if (!birthDateString) return null;
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    const formatAddress = (addr) => {
        if (!addr || !addr.region) return "Not provided";
        const rName = regions.find(r => r.code === addr.region)?.name || addr.region;
        const pName = provinces[addr.region]?.find(p => p.code === addr.province)?.name || addr.province;
        const cName = cities[addr.province]?.find(c => c.code === addr.city)?.name || addr.city;
        
        return `${addr.houseNumber ? addr.houseNumber + ' ' : ''}${addr.street ? addr.street + ', ' : ''}${addr.barangay || ''}, ${cName}, ${pName}, ${rName}`;
    };

    // Calculate core data safely
    const birthRaw = patient?.birthdate || patient?.dob || patient?.dateOfBirth;
    const age = getAge(birthRaw);
    const isMinor = age !== null && age < 18;

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b' }}>Loading Profile...</div>
                ) : patient ? (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose}>
                                    <img src={BackIcon} alt="Back" />
                                </button>
                                <div className={styles.header}>
                                    <h2>Patient <span className={styles.highlight}>Profile</span></h2>
                                </div>
                            </div>
                            <button className={styles.editActionBtn} onClick={onEdit}>EDIT PROFILE</button>
                        </div>

                        <div className={styles.profileHeader}>
                            {patient.profileImage ? (
                                <img src={patient.profileImage} alt="Profile" className={styles.profileImageLg} />
                            ) : (
                                <div className={styles.profileInitialsLg}>{getInitials(patient.name?.first, patient.name?.last)}</div>
                            )}
                            <div>
                                <h3 className={styles.profileName}>{patient.name?.first} {patient.name?.last}</h3>
                                <p className={styles.profileRole} style={{backgroundColor: '#dcfce7', color: '#15803d'}}>Registered Patient</p>
                            </div>
                        </div>

                        <h3 className={styles.mainSectionTitle} style={{ fontSize: '15px' }}>Core Information</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Email Address</span>
                                <p className={styles.infoValue}>{patient.email}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Contact Number</span>
                                <p className={styles.infoValue}>{patient.contactNumber || patient.phoneNumber || 'Not provided'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Date of Birth</span>
                                <p className={styles.infoValue}>
                                    {birthRaw ? new Date(birthRaw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided'}
                                </p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Age</span>
                                <p className={styles.infoValue}>{age !== null ? `${age} years old` : 'Unknown'}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Gender</span>
                                <p className={styles.infoValue}>{patient.gender || 'Not provided'}</p>
                            </div>
                        </div>

                        {/* CONDITIONAL GUARDIAN SECTION */}
                        {isMinor && (
                            <>
                                <h3 className={styles.mainSectionTitle} style={{ fontSize: '15px', marginTop: '30px', borderLeftColor: '#f59e0b' }}>
                                    Guardian Information (Minor)
                                </h3>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoBox} style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                                        <span className={styles.infoLabel}>Guardian Name</span>
                                        <p className={styles.infoValue}>{patient.guardian?.name || 'Not provided'}</p>
                                    </div>
                                    <div className={styles.infoBox} style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                                        <span className={styles.infoLabel}>Relationship</span>
                                        <p className={styles.infoValue}>{patient.guardian?.relationship || 'Not provided'}</p>
                                    </div>
                                    <div className={styles.infoBox} style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                                        <span className={styles.infoLabel}>Guardian Contact</span>
                                        <p className={styles.infoValue}>{patient.guardian?.contactNumber || 'Not provided'}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* MEDICAL HISTORY SECTION (Non-Financial Ops) */}
                        <h3 className={styles.mainSectionTitle} style={{ fontSize: '15px', marginTop: '30px', borderLeftColor: '#dc3545' }}>
                            Medical History Summary
                        </h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                                <span className={styles.infoLabel} style={{ color: '#dc3545' }}>Known Allergies</span>
                                <p className={styles.infoValue}>
                                    {patient.medicalHistory?.allergies?.length > 0 
                                        ? patient.medicalHistory.allergies.join(', ') 
                                        : 'None reported'}
                                </p>
                            </div>
                            <div className={styles.infoBox} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                                <span className={styles.infoLabel} style={{ color: '#dc3545' }}>Medical Conditions</span>
                                <p className={styles.infoValue}>
                                    {patient.medicalHistory?.conditions?.length > 0 
                                        ? patient.medicalHistory.conditions.join(', ') 
                                        : 'None reported'}
                                </p>
                            </div>
                        </div>

                        <h3 className={styles.mainSectionTitle} style={{ fontSize: '15px', marginTop: '30px' }}>Address Details</h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Current Address</span>
                                <p className={styles.infoValue}>{formatAddress(patient.currentAddress)}</p>
                            </div>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Permanent Address</span>
                                <p className={styles.infoValue}>{formatAddress(patient.permanentAddress)}</p>
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