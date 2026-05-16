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

const buildCommaText = (value) => (Array.isArray(value) && value.length ? value.join(', ') : 'Not specified');

const formatTimestamp = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatCreatedDate = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const ReadOnlyField = ({ label, value, wide = false }) => (
    <div className={styles.formGroup} style={wide ? { flex: '1 1 100%' } : undefined}>
        <label>{label}</label>
        <input className={styles.inputField} value={value || 'Not specified'} disabled readOnly />
    </div>
);

const ReadOnlyTextArea = ({ label, value }) => (
    <div className={styles.formGroup} style={{ flex: '1 1 100%' }}>
        <label>{label}</label>
        <textarea
            className={`${styles.inputField} ${styles.textareaField}`}
            value={value || 'Not specified'}
            disabled
            readOnly
        />
    </div>
);

export default function PatientProfile() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchProfile = useCallback(async () => {
        if (!user?.id) return;
        try {
            setError('');
            setLoading(true);
            const response = await authFetch(`/user/${user.id}`);
            if (!response.ok) {
                throw new Error('Failed to load profile.');
            }
            const payload = await response.json();
            setProfile(payload);
        } catch {
            setProfile(null);
            setError('Could not load your profile. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

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
    const roleTagStyle = {
        backgroundColor: '#e0f2fe',
        color: '#0284c7',
        border: '1px solid #bae6fd',
    };

    const summary = useMemo(() => ({
        email: profile?.email || user?.email || 'Not specified',
        contactNumber: profile?.contactNumber || 'Not specified',
        bloodType: profile?.bloodType || profile?.medicalHistory?.bloodType || 'Not specified',
        allergies: buildCommaText(profile?.medicalHistory?.allergies),
        conditions: buildCommaText(profile?.medicalHistory?.conditions),
        medications: buildCommaText(profile?.medicalHistory?.medications),
        emergencyName: profile?.emergencyContact?.name || 'Not specified',
        emergencyRelationship: profile?.emergencyContact?.relationship || 'Not specified',
        emergencyNumber: profile?.emergencyContact?.contactNumber || 'Not specified',
    }), [profile, user?.email]);

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
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Profile</h1>
                    <p className={styles.subtitle}>Review your patient identity, contact details, clinic assignment, and health information.</p>
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
                        <span className={styles.roleTag} style={roleTagStyle}>
                            Patient Account
                        </span>
                    </div>
                </div>

                <h3 className={styles.mainSectionTitle}>Personal Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="First Name" value={profile?.name?.first} />
                    <ReadOnlyField label="Middle Name" value={profile?.name?.middle} />
                    <ReadOnlyField label="Last Name" value={profile?.name?.last} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="Birthdate" value={formatDateDisplay(profile?.birthdate, { month: 'long' })} />
                    <ReadOnlyField label="Age" value={age !== null ? `${age} years old` : 'Not specified'} />
                    <ReadOnlyField label="Gender" value={profile?.gender} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyField label="Civil Status" value={profile?.civilStatus} />
                    <ReadOnlyField label="Occupation" value={profile?.occupation} />
                </div>

                <h3 className={styles.mainSectionTitle}>Contact Details</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="Email Address" value={summary.email} />
                    <ReadOnlyField label="Contact Number" value={summary.contactNumber} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyTextArea label="Home Address" value={address} />
                </div>

                <h3 className={styles.mainSectionTitle}>Emergency Contact</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="Contact Name" value={summary.emergencyName} />
                    <ReadOnlyField label="Relationship" value={summary.emergencyRelationship} />
                    <ReadOnlyField label="Contact Number" value={summary.emergencyNumber} />
                </div>

                <h3 className={styles.mainSectionTitle}>Medical Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="Blood Type" value={summary.bloodType} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyTextArea label="Allergies" value={summary.allergies} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyTextArea label="Conditions" value={summary.conditions} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyTextArea label="Medications" value={summary.medications} />
                </div>

                <h3 className={styles.mainSectionTitle}>Clinic Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="Assigned Branch" value={assignedBranch} />
                </div>
                <div className={styles.row}>
                    <ReadOnlyTextArea label="Reason For Consultation" value={profile?.reasonForConsultation || 'Not specified'} />
                </div>

                <h3 className={styles.mainSectionTitle}>Account Information</h3>
                <div className={styles.row}>
                    <ReadOnlyField label="Account Created" value={formatCreatedDate(profile?.createdAt)} />
                    <ReadOnlyField label="Last Login" value={formatTimestamp(profile?.lastLogin)} />
                </div>

                <div className={styles.buttonGroup}>
                    <button type="button" className={styles.cancelBtn} onClick={() => navigate('/patient/settings')}>
                        SETTINGS
                    </button>
                    <button type="button" className={styles.editBtn} onClick={() => navigate('/patient/activity-logs')}>
                        ACTIVITY LOGS
                    </button>
                    <button type="button" className={styles.submitBtn} onClick={() => navigate('/patient/profile/edit')}>
                        EDIT PROFILE
                    </button>
                </div>
            </div>
        </div>
    );
}
