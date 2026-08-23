import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryEditPatient.module.css'; // shared CSS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { regions, provinces, cities } from '../../utils/addressData';
import { FaArrowLeft, FaEdit, FaFileMedical } from 'react-icons/fa';
import UserAvatar from '../../components/common/UserAvatar';
import { getHomeAddress } from '../../utils/addressHelpers';
import { getAccountLifecycleKey, getAccountLifecycleLabel } from '../../utils/accountStatus';

export default function SecretaryViewPatient() {
    const { patientId } = useParams();
    const navigate      = useNavigate();
    const { addToast }  = useToast();

    const [patient, setPatient]   = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!patientId) return;
        const load = async () => {
            try {
                const res = await authFetch(`/patients/${patientId}`);
                if (!res.ok) throw new Error();
                setPatient(await res.json());
            } catch {
                addToast('Failed to load patient profile.', 'error');
                navigate('/secretary/patients');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [patientId, navigate, addToast]);

    const getAge = (raw) => {
        if (!raw) return null;
        const today = new Date(); const birth = new Date(raw);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const formatAddress = (addr) => {
        if (!addr?.region) return 'Not provided';
        const rName = regions.find(r => r.code === addr.region)?.name || addr.region;
        const pName = provinces[addr.region]?.find(p => p.code === addr.province)?.name || addr.province;
        const cName = cities[addr.province]?.find(c => c.code === addr.city)?.name || addr.city;
        return [addr.houseNumber, addr.street, addr.barangay, cName, pName, rName]
            .filter(Boolean).join(', ');
    };

    if (isLoading) return (
        <div className={styles.page}>
            <div className={styles.loadingState}>Loading patient profile...</div>
        </div>
    );

    if (!patient) return null;

    const birthRaw = patient.birthdate || patient.dob || patient.dateOfBirth;
    const age      = getAge(birthRaw);
    const isMinor  = age !== null && age < 18;
    const accountLifecycleKey = getAccountLifecycleKey(patient);
    const accountLifecycleLabel = getAccountLifecycleLabel(patient);

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={() => navigate('/secretary/patients')}>
                    <FaArrowLeft /> Back to Patients
                </button>
                <div className={styles.headerContent}>
                    <h1 className={styles.pageTitle}>Patient Profile</h1>
                    <p className={styles.pageSubtitle}>View-only profile for demographic and contact information.</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtnSecondary}
                        onClick={() => navigate(`/secretary/patients/${patientId}/emr`)}>
                        <FaFileMedical /> View EMR
                    </button>
                    <button className={styles.actionBtn}
                        onClick={() => navigate(`/secretary/patients/${patientId}/edit`)}>
                        <FaEdit /> Edit Profile
                    </button>
                </div>
            </div>

            <div className={styles.viewCard}>
                {/* Profile banner */}
                <div className={styles.profileBanner}>
                    <UserAvatar user={patient} size={72} />
                    <div>
                        <h2 className={styles.profileName}>
                            {patient.name?.first} {patient.name?.middle ? patient.name.middle + ' ' : ''}{patient.name?.last}
                        </h2>
                        <span className={styles.profileBadge}>Registered Patient</span>
                    </div>
                </div>

                {/* Core info */}
                <h3 className={styles.viewSectionTitle}>Core Information</h3>
                <div className={styles.infoGrid}>
                    <InfoBox label="Email Address"   value={patient.email || 'Not provided'} />
                    <InfoBox label="Contact Number"  value={patient.contactNumber || patient.phoneNumber || 'Not provided'} />
                    <InfoBox label="Date of Birth"
                        value={birthRaw
                            ? new Date(birthRaw).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
                            : 'Not provided'} />
                    <InfoBox label="Age"    value={age !== null ? `${age} years old` : 'Unknown'} />
                    <InfoBox label="Gender" value={patient.gender || 'Not provided'} />
                    <InfoBox label="Account Status"
                        value={accountLifecycleLabel}
                        highlight={accountLifecycleKey === 'active' ? 'green' : 'red'} />
                </div>

                {/* Guardian */}
                {isMinor && (
                    <>
                        <h3 className={`${styles.viewSectionTitle} ${styles.warningTitle}`}>
                            Guardian Information (Minor)
                        </h3>
                        <div className={styles.infoGrid}>
                            <InfoBox label="Guardian Name"    value={patient.guardian?.name         || 'Not provided'} warning />
                            <InfoBox label="Relationship"     value={patient.guardian?.relationship  || 'Not provided'} warning />
                            <InfoBox label="Guardian Contact" value={patient.guardian?.contactNumber || 'Not provided'} warning />
                        </div>
                    </>
                )}

                {/* Medical history summary */}
                <h3 className={`${styles.viewSectionTitle} ${styles.dangerTitle}`}>Medical History Summary</h3>
                <div className={styles.infoGrid}>
                    <InfoBox label="Known Allergies"
                        value={patient.medicalHistory?.allergies?.length
                            ? patient.medicalHistory.allergies.join(', ')
                            : 'None reported'} danger />
                    <InfoBox label="Medical Conditions"
                        value={patient.medicalHistory?.conditions?.length
                            ? patient.medicalHistory.conditions.join(', ')
                            : 'None reported'} danger />
                    <InfoBox label="Current Medications"
                        value={patient.medicalHistory?.medications?.length
                            ? patient.medicalHistory.medications.join(', ')
                            : 'None reported'} danger />
                </div>

                {/* Address */}
                <h3 className={styles.viewSectionTitle}>Address Details</h3>
                <div className={styles.infoGrid}>
                    <InfoBox label="Home Address" value={formatAddress(getHomeAddress(patient))} />
                </div>
            </div>
        </div>
    );
}

function InfoBox({ label, value, highlight, warning, danger }) {
    const boxClassName = [
        styles.infoBox,
        warning ? styles.infoBoxWarning : '',
        danger ? styles.infoBoxDanger : '',
    ].filter(Boolean).join(' ');

    const valueClassName = [
        styles.infoValue,
        highlight === 'green' ? styles.infoValueSuccess : '',
        highlight === 'red' ? styles.infoValueDanger : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={boxClassName}>
            <span className={styles.infoLabel}>{label}</span>
            <p className={valueClassName}>{value}</p>
        </div>
    );
}
