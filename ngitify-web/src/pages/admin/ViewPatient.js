import React, { useEffect, useState } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/StaffModals.module.css';
import { regions, provinces, cities } from '../../utils/addressData';
import BackIcon from '../../assets/icons/Back.svg';
import { getAccessRecoveryLabel, hasExpiredTemporaryPassword, shouldShowAccessRecovery } from '../../utils/accountStatus';
import { getHomeAddress } from '../../utils/addressHelpers';
import LifecycleHistoryPanel from '../../components/common/LifecycleHistoryPanel';

const getPatientLifecycleLabel = (patient = {}) => {
    if (patient?.isArchived) return 'Archived';
    return patient?.status === 'active' ? 'Active' : 'Inactive';
};

const formatDateLong = (value) => {
    if (!value) return 'Not provided';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Not provided'
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatAddress = (addr) => {
    if (!addr || !addr.region) return 'Not provided';
    const regionName = regions.find((region) => region.code === addr.region)?.name || addr.region;
    const provinceName = provinces[addr.region]?.find((province) => province.code === addr.province)?.name || addr.province;
    const cityName = cities[addr.province]?.find((city) => city.code === addr.city)?.name || addr.city;
    return [
        addr.houseNumber,
        addr.street,
        addr.barangay,
        cityName,
        provinceName,
        regionName,
    ].filter(Boolean).join(', ') || 'Not provided';
};

const formatYesNo = (value) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Not provided';
};

const renderArray = (value) => Array.isArray(value) && value.length > 0 ? value.join(', ') : 'None reported';

export default function ViewPatient({ patientId, onClose, onEdit, onOpenRecord, onRecoverAccess }) {
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const response = await authFetch(`/user/${patientId}`);
                if (response.ok) {
                    setPatient(await response.json());
                } else {
                    alert('Failed to load patient data');
                    onClose();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Cannot connect to server');
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (patientId) fetchPatient();
    }, [patientId, onClose]);

    const getInitials = (first, last) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '?';

    const getAge = (birthDateString) => {
        if (!birthDateString) return null;
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDelta = today.getMonth() - birthDate.getMonth();
        if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    const birthRaw = patient?.birthdate || patient?.dob || patient?.dateOfBirth;
    const age = getAge(birthRaw);
    const isMinor = age !== null && age < 18;
    const bloodType = patient?.bloodType || patient?.medicalHistory?.bloodType || 'Not provided';
    const accountLifecycleLabel = getPatientLifecycleLabel(patient);
    const assignedBranch = patient?.assignedBranch || patient?.assignedBranches?.[0] || 'Not assigned';

    const infoBox = (label, value, extraClass = '') => (
        <div className={`${styles.infoBox} ${extraClass}`.trim()}>
            <span className={styles.infoLabel}>{label}</span>
            <p className={styles.infoValue}>{value || 'Not provided'}</p>
        </div>
    );

    const handleRecoverAccessClick = async () => {
        if (!patient || !onRecoverAccess) return;
        const updatedAccount = await onRecoverAccess(patient);
        if (updatedAccount) {
            setPatient((prev) => (prev ? { ...prev, ...updatedAccount } : prev));
        }
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            <div className={styles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
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
                        </div>

                        <div className={styles.profileHeader}>
                            {patient.profileImage ? (
                                <img src={patient.profileImage} alt="Profile" className={styles.profileImageLg} />
                            ) : (
                                <div className={styles.profileInitialsLg}>{getInitials(patient.name?.first, patient.name?.last)}</div>
                            )}
                            <div>
                                <h3 className={styles.profileName}>{patient.name?.first} {patient.name?.last}</h3>
                                <p className={`${styles.profileRole} ${styles.statusRole}`}>Registered Patient</p>
                            </div>
                        </div>

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Account Overview</h3>
                        <div className={styles.infoGrid}>
                            {infoBox('Assigned Branch', assignedBranch)}
                            {infoBox('Account Status', accountLifecycleLabel)}
                            {infoBox('Verification', patient?.isArchived ? 'Archived Record' : patient?.isVerified ? 'Verified Email' : 'Pending Activation')}
                            {infoBox('Patient ID', patient?._id || patientId)}
                        </div>
                        <LifecycleHistoryPanel account={patient} entityLabel="patient account" />
                        {shouldShowAccessRecovery(patient) && onRecoverAccess && (
                            <div style={{ marginTop: '-8px', marginBottom: '22px' }}>
                                <button
                                    type="button"
                                    onClick={handleRecoverAccessClick}
                                    style={{
                                        border: '1px solid #bfdbfe',
                                        background: '#eff6ff',
                                        color: '#01538b',
                                        borderRadius: '999px',
                                        padding: '10px 16px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {!patient?.isVerified && !hasExpiredTemporaryPassword(patient) ? 'Resend Activation Link' : getAccessRecoveryLabel(patient)}
                                </button>
                            </div>
                        )}

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Core Information</h3>
                        <div className={styles.infoGrid}>
                            {infoBox('Email Address', patient.email)}
                            {infoBox('Contact Number', patient.contactNumber || patient.phoneNumber || 'Not provided')}
                            {infoBox('Date of Birth', formatDateLong(birthRaw))}
                            {infoBox('Age', age !== null ? `${age} years old` : 'Unknown')}
                            {infoBox('Gender', patient.gender || 'Not provided')}
                            {infoBox('Occupation', patient.occupation)}
                            {infoBox('Civil Status', patient.civilStatus)}
                            {infoBox('Blood Type', bloodType)}
                            {infoBox('Work Phone', patient.workPhone)}
                            {infoBox('Referred By', patient.referredBy)}
                        </div>

                        {(patient.emergencyContact?.name || patient.emergencyContact?.contactNumber) && (
                            <>
                                <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Emergency Contact</h3>
                                <div className={styles.infoGrid}>
                                    {infoBox('Contact Name', patient.emergencyContact?.name)}
                                    {infoBox('Relationship', patient.emergencyContact?.relationship)}
                                    {infoBox('Contact Number', patient.emergencyContact?.contactNumber)}
                                </div>
                            </>
                        )}

                        {isMinor && (
                            <>
                                <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Guardian Information (Minor)</h3>
                                <div className={styles.infoGrid}>
                                    {infoBox('Guardian Name', patient.guardian?.name, `${styles.infoBoxWarning}`)}
                                    {infoBox('Relationship', patient.guardian?.relationship, `${styles.infoBoxWarning}`)}
                                    {infoBox('Guardian Contact', patient.guardian?.contactNumber, `${styles.infoBoxWarning}`)}
                                    {infoBox('Guardian Occupation', patient.guardian?.occupation, `${styles.infoBoxWarning}`)}
                                </div>
                            </>
                        )}

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Medical History Summary</h3>
                        <div className={styles.infoGrid}>
                            {infoBox('Known Allergies', renderArray(patient.medicalHistory?.allergies), `${styles.infoBoxDanger}`)}
                            {infoBox('Medical Conditions', renderArray(patient.medicalHistory?.conditions), `${styles.infoBoxDanger}`)}
                            {infoBox('Current Medications', renderArray(patient.medicalHistory?.medications))}
                            {infoBox('Last Physical / Dental Exam', formatDateLong(patient.dentalHistory?.lastExamDate))}
                            {infoBox('Blood Pressure', patient.medicalHistory?.bloodPressure)}
                            {infoBox('Bleeding Time', patient.medicalHistory?.bleedingTime)}
                            {infoBox('In Good Health?', formatYesNo(patient.medicalHistory?.inGoodHealth))}
                            {infoBox('Uses Tobacco?', formatYesNo(patient.medicalHistory?.usesTobacco))}
                            {infoBox('Uses Alcohol / Drugs?', formatYesNo(patient.medicalHistory?.usesAlcoholOrDrugs))}
                            {infoBox('Pregnant?', formatYesNo(patient.medicalHistory?.isPregnant))}
                            {infoBox('Nursing?', formatYesNo(patient.medicalHistory?.isNursing))}
                            {infoBox('Taking Birth Control Pills?', formatYesNo(patient.medicalHistory?.takingBirthControl))}
                        </div>

                        <div className={styles.infoGrid}>
                            {infoBox('Clinical Notes', patient.medicalHistory?.notes || 'No clinical notes on record.')}
                        </div>

                        <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Address Details</h3>
                        <div className={styles.infoGrid}>
                            {infoBox('Home Address', formatAddress(getHomeAddress(patient)))}
                        </div>

                        {(patient.consentAcknowledgement?.acknowledged || patient.consentAcknowledgement?.signerName) && (
                            <>
                                <h3 className={`${styles.mainSectionTitle} ${styles.sectionHeading}`}>Digital Consent</h3>
                                <div className={styles.infoGrid}>
                                    {infoBox('Consent Recorded', formatYesNo(patient.consentAcknowledgement?.acknowledged))}
                                    {infoBox('Signer Name', patient.consentAcknowledgement?.signerName)}
                                    {infoBox('Signer Role', patient.consentAcknowledgement?.signerRole)}
                                    {infoBox('Date Signed', formatDateLong(patient.consentAcknowledgement?.signedAt))}
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#334155',
                                    borderRadius: '999px',
                                    padding: '12px 18px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Close
                            </button>
                            {onOpenRecord && !patient?.isArchived && (
                                <button
                                    type="button"
                                    onClick={onOpenRecord}
                                    style={{
                                        border: '1px solid #bfdbfe',
                                        background: '#eff6ff',
                                        color: '#01538b',
                                        borderRadius: '999px',
                                        padding: '12px 18px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Open Full EMR
                                </button>
                            )}
                            {onEdit && !patient?.isArchived && (
                                <button
                                    type="button"
                                    onClick={onEdit}
                                    style={{
                                        border: 'none',
                                        background: '#01538b',
                                        color: '#ffffff',
                                        borderRadius: '999px',
                                        padding: '12px 18px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Edit Patient
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.errorState}>Profile not found.</div>
                )}
            </div>
        </div>
    );
}
