import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../../components/common/UserAvatar';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import {
    calculateAge,
    formatAddress,
    formatDateDisplay,
    getFullName,
} from '../../utils/patientPortal';
import { getHomeAddress } from '../../utils/addressHelpers';
import styles from '../../styles/admin/AdminProfile.module.css';

const notSpecified = (value) => value || 'Not specified';

const buildCommaText = (value) => (
    Array.isArray(value) && value.length ? value.join(', ') : 'Not specified'
);

const formatTimestamp = (value) => {
    if (!value) return 'Not specified';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not specified';
    return parsed.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatCreatedDate = (value) => {
    if (!value) return 'Not specified';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not specified';
    return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const ReadOnlyField = ({ label, value, wide = false }) => (
    <div className={styles.formGroup} style={wide ? { flex: '1 1 100%' } : undefined}>
        <label>{label}</label>
        <input className={styles.inputField} value={notSpecified(value)} disabled readOnly />
    </div>
);

export default function PatientProfile() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchProfile = useCallback(async () => {
        const userId = user?.userId || user?.id || user?._id;
        if (!userId) return;

        try {
            setError('');
            setLoading(true);
            const response = await authFetch(`/user/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to load profile.');
            }
            setProfile(await response.json());
        } catch {
            setProfile(null);
            setError('Could not load your profile. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?._id, user?.userId]);

    useEffect(() => {
        fetchProfile();
        const handleFocus = () => fetchProfile();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchProfile]);

    const fullName = profile ? getFullName(profile) : (user?.fullName || 'Patient');
    const age = calculateAge(profile?.birthdate);
    const address = formatAddress(getHomeAddress(profile));
    const assignedBranch = profile?.assignedBranch || profile?.assignedBranches?.[0] || user?.assignedBranch || 'Pending clinic assignment';

    const summary = useMemo(() => ({
        email: profile?.email || user?.email || 'Not specified',
        contactNumber: profile?.contactNumber || 'Not specified',
        homePhone: profile?.homePhone || 'Not specified',
        workPhone: profile?.workPhone || 'Not specified',
        nationality: profile?.nationality || 'Not specified',
        religion: profile?.religion || 'Not specified',
        referredBy: profile?.referredBy || 'Not specified',
        reasonForConsultation: profile?.reasonForConsultation || profile?.dentalHistory?.chiefComplaint || 'Not specified',
        bloodType: profile?.bloodType || profile?.medicalHistory?.bloodType || 'Not specified',
        allergies: buildCommaText(profile?.medicalHistory?.allergies),
        conditions: buildCommaText(profile?.medicalHistory?.conditions),
        medications: buildCommaText(profile?.medicalHistory?.medications),
        emergencyName: profile?.emergencyContact?.name || 'Not specified',
        emergencyRelationship: profile?.emergencyContact?.relationship || 'Not specified',
        emergencyNumber: profile?.emergencyContact?.contactNumber || 'Not specified',
    }), [profile, user?.email]);

    const medicalHistory = profile?.medicalHistory || {};
    const dentalHistory = profile?.dentalHistory || {};
    const guardian = profile?.guardian || {};
    const physician = profile?.physician || {};
    const formatBoolean = (value) => (value === true ? 'Yes' : value === false ? 'No' : 'Not specified');

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#01538b' }}>
                    <h2>Loading Profile Data...</h2>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: '600' }}>
                    <p>{error}</p>
                    <button type="button" className={styles.editBtn} onClick={fetchProfile}>
                        TRY AGAIN
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Profile</h1>
                    <p className={styles.subtitle}>View your patient information, clinic assignment, and account details.</p>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.profileSection}>
                    <div className={styles.imageWrapper}>
                        <UserAvatar
                            user={{ name: fullName, profileImage: profile?.profileImage }}
                            size={100}
                            style={{ border: '3px solid #2dccf6' }}
                        />
                    </div>
                    <div className={styles.profileText}>
                        <h2>{fullName}</h2>
                        <span className={styles.roleTag}>Patient Account</span>
                    </div>
                </div>

                <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="FIRST NAME" value={profile?.name?.first} />
                    <ReadOnlyField label="MIDDLE NAME" value={profile?.name?.middle} />
                    <ReadOnlyField label="LAST NAME" value={profile?.name?.last} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="BIRTHDATE" value={formatDateDisplay(profile?.birthdate, { month: 'long' })} />
                    <ReadOnlyField label="AGE" value={age !== null ? `${age} years old` : 'Not specified'} />
                    <ReadOnlyField label="GENDER" value={profile?.gender} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="CIVIL STATUS" value={profile?.civilStatus} />
                    <ReadOnlyField label="NATIONALITY" value={summary.nationality} />
                    <ReadOnlyField label="RELIGION" value={summary.religion} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="OCCUPATION" value={profile?.occupation} />
                    <ReadOnlyField label="ASSIGNED BRANCH" value={assignedBranch} />
                    <ReadOnlyField label="REFERRED BY" value={summary.referredBy} />
                </div>

                <h3 className={styles.mainSectionTitle}>Contact Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="EMAIL ADDRESS" value={summary.email} />
                    <ReadOnlyField label="MOBILE NUMBER" value={summary.contactNumber} />
                    <ReadOnlyField label="HOME PHONE" value={summary.homePhone} />
                    <ReadOnlyField label="WORK PHONE" value={summary.workPhone} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="HOME ADDRESS" value={address} wide />
                </div>

                <h3 className={styles.mainSectionTitle}>Emergency Contact</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="CONTACT PERSON" value={summary.emergencyName} />
                    <ReadOnlyField label="RELATIONSHIP" value={summary.emergencyRelationship} />
                    <ReadOnlyField label="CONTACT NUMBER" value={summary.emergencyNumber} />
                </div>

                <h3 className={styles.mainSectionTitle}>Guardian Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="GUARDIAN NAME" value={guardian.name} />
                    <ReadOnlyField label="RELATIONSHIP" value={guardian.relationship} />
                    <ReadOnlyField label="CONTACT NUMBER" value={guardian.contactNumber} />
                    <ReadOnlyField label="OCCUPATION" value={guardian.occupation} />
                </div>

                <h3 className={styles.mainSectionTitle}>Dental History</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="REASON FOR CONSULTATION" value={summary.reasonForConsultation} wide />
                    <ReadOnlyField label="LAST DENTAL VISIT" value={formatDateDisplay(dentalHistory.lastExamDate, { month: 'long' })} />
                    <ReadOnlyField label="REACTION AFTER DENTAL TREATMENT" value={formatBoolean(dentalHistory.hadTreatmentReaction)} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="REACTION DETAILS" value={dentalHistory.reactionDetails} wide />
                    <ReadOnlyField label="CONFIDENTIAL INFORMATION TO DISCUSS" value={formatBoolean(dentalHistory.hasConfidentialInfo)} />
                    <ReadOnlyField label="DENTAL NOTES" value={dentalHistory.notes} wide />
                </div>

                <h3 className={styles.mainSectionTitle}>Physician Details</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="PHYSICIAN NAME" value={physician.name} />
                    <ReadOnlyField label="SPECIALTY" value={physician.specialty} />
                    <ReadOnlyField label="OFFICE NUMBER" value={physician.officeNumber} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="OFFICE ADDRESS" value={physician.officeAddress} wide />
                </div>

                <h3 className={styles.mainSectionTitle}>Medical Snapshot</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="BLOOD TYPE" value={summary.bloodType} />
                    <ReadOnlyField label="IN GOOD HEALTH" value={formatBoolean(medicalHistory.inGoodHealth)} />
                    <ReadOnlyField label="UNDER MEDICAL TREATMENT" value={formatBoolean(medicalHistory.underMedicalTreatment)} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="MEDICAL TREATMENT DETAILS" value={medicalHistory.medicalTreatmentDetails} wide />
                    <ReadOnlyField label="SERIOUS ILLNESS OR SURGERY" value={formatBoolean(medicalHistory.hadSeriousIllnessOrSurgery)} />
                    <ReadOnlyField label="SERIOUS ILLNESS / SURGERY DETAILS" value={medicalHistory.seriousIllnessOrSurgeryDetails} wide />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="HOSPITALIZED" value={formatBoolean(medicalHistory.hadHospitalization)} />
                    <ReadOnlyField label="HOSPITALIZATION DETAILS" value={medicalHistory.hospitalizationDetails} wide />
                    <ReadOnlyField label="TAKING MEDICATION" value={formatBoolean(medicalHistory.isTakingMedication)} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="ALLERGIES" value={summary.allergies} />
                    <ReadOnlyField label="HAS ALLERGIES" value={formatBoolean(medicalHistory.hasAllergies)} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="MEDICAL CONDITIONS" value={summary.conditions} />
                    <ReadOnlyField label="MEDICATIONS" value={summary.medications} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="USES TOBACCO" value={formatBoolean(medicalHistory.usesTobacco)} />
                    <ReadOnlyField label="USES ALCOHOL OR DANGEROUS DRUGS" value={formatBoolean(medicalHistory.usesAlcoholOrDrugs)} />
                    <ReadOnlyField label="BLEEDING TIME" value={medicalHistory.bleedingTime} />
                    <ReadOnlyField label="BLOOD PRESSURE" value={medicalHistory.bloodPressure} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="PREGNANT" value={formatBoolean(medicalHistory.isPregnant)} />
                    <ReadOnlyField label="NURSING" value={formatBoolean(medicalHistory.isNursing)} />
                    <ReadOnlyField label="TAKING BIRTH CONTROL" value={formatBoolean(medicalHistory.takingBirthControl)} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="MEDICAL NOTES" value={medicalHistory.notes} wide />
                </div>

                <h3 className={styles.mainSectionTitle}>Account Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="ACCOUNT CREATED" value={formatCreatedDate(profile?.createdAt)} />
                    <ReadOnlyField label="LAST LOGIN" value={formatTimestamp(profile?.lastLogin)} />
                </div>

                <div className={styles.buttonGroup}>
                    <button type="button" className={styles.cancelBtn} onClick={() => navigate('/patient/settings')}>
                        SETTINGS
                    </button>
                    <button type="button" className={styles.cancelBtn} onClick={() => navigate('/patient/activity-logs')}>
                        ACTIVITY LOGS
                    </button>
                    <button type="button" className={styles.editBtn} onClick={() => navigate('/patient/profile/edit')}>
                        EDIT PROFILE
                    </button>
                </div>
            </div>
        </div>
    );
}
