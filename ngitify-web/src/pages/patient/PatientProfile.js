import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClipboardList, FaUserCircle } from 'react-icons/fa';
import UserAvatar from '../../components/common/UserAvatar';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import {
    calculateAge,
    formatAddress,
    formatDateDisplay,
    getFullName,
} from '../../utils/patientPortal';
import { getHomeAddress } from '../../utils/addressHelpers';
import styles from '../../styles/patient/PatientPortal.module.css';

const buildCommaText = (value) => (Array.isArray(value) && value.length ? value.join(', ') : 'Not specified');

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

const InfoField = ({ label, value }) => (
    <div className={styles.infoCard}>
        <span className={styles.infoLabel}>{label}</span>
        <p className={styles.infoValue}>{value || 'Not specified'}</p>
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
            const payload = await response.json();
            setProfile(payload);
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
            <PatientPageFrame
                title="My Profile"
                subtitle="Loading your patient identity and account details..."
            >
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading profile data...</span>
                </div>
            </PatientPageFrame>
        );
    }

    if (error) {
        return (
            <PatientPageFrame
                title="My Profile"
                subtitle="Review your patient identity, clinic assignment, and medical summary."
            >
                <PatientEmptyState
                    icon={<FaUserCircle />}
                    title="Could not load your profile"
                    message={error}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchProfile}>
                            Try Again
                        </button>
                    )}
                />
            </PatientPageFrame>
        );
    }

    return (
        <PatientPageFrame
            title="My Profile"
            subtitle="Your patient-only profile page now uses the same shared portal styling as the rest of the web dashboard."
            actions={(
                <>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/settings')}>
                        Settings
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/activity-logs')}>
                        Activity Logs
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/profile/edit')}>
                        Edit Profile
                    </button>
                </>
            )}
        >
            <div className={styles.heroGrid}>
                <section className={styles.heroCard}>
                    <span className={styles.heroEyebrow}>Patient Identity</span>
                    <div className={styles.profileIdentity}>
                        <div className={styles.profileAvatar}>
                            <UserAvatar
                                user={{ name: fullName, profileImage: profile?.profileImage }}
                                size={96}
                                style={{ border: '3px solid #2dccf6' }}
                            />
                        </div>
                        <div>
                            <h2 className={styles.heroTitle} style={{ color: '#17364a', marginBottom: '8px' }}>{fullName}</h2>
                            <p className={styles.heroText} style={{ color: '#5f7a8d' }}>
                                Review the personal, medical, and clinic details that power your patient-side web and mobile experience.
                            </p>
                            <div className={styles.detailPills}>
                                <span className={styles.detailPill}>Patient Account</span>
                                <span className={styles.detailPill}>{assignedBranch}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.metricGrid} style={{ gridTemplateColumns: '1fr', marginBottom: 0 }}>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Age</span>
                        <h3 className={styles.metricValue}>{age !== null ? age : '—'}</h3>
                        <p className={styles.metricSub}>Years old based on your recorded birthdate.</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Account Created</span>
                        <h3 className={styles.metricValue} style={{ fontSize: '21px' }}>{formatCreatedDate(profile?.createdAt)}</h3>
                        <p className={styles.metricSub}>When your patient account first became active.</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Last Login</span>
                        <h3 className={styles.metricValue} style={{ fontSize: '18px', lineHeight: 1.4 }}>{formatTimestamp(profile?.lastLogin)}</h3>
                        <p className={styles.metricSub}>Most recent patient-side access recorded on your account.</p>
                    </article>
                </section>
            </div>

            <div className={styles.cardGrid}>
                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Basics" title="Personal Information" />
                    <div className={styles.infoGrid}>
                        <InfoField label="First Name" value={profile?.name?.first} />
                        <InfoField label="Middle Name" value={profile?.name?.middle} />
                        <InfoField label="Last Name" value={profile?.name?.last} />
                        <InfoField label="Birthdate" value={formatDateDisplay(profile?.birthdate, { month: 'long' })} />
                        <InfoField label="Gender" value={profile?.gender} />
                        <InfoField label="Civil Status" value={profile?.civilStatus} />
                        <InfoField label="Occupation" value={profile?.occupation} />
                        <InfoField label="Assigned Branch" value={assignedBranch} />
                    </div>
                </section>

                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Contact" title="Contact and Emergency Details" />
                    <div className={styles.infoGrid}>
                        <InfoField label="Email Address" value={summary.email} />
                        <InfoField label="Contact Number" value={summary.contactNumber} />
                        <InfoField label="Emergency Contact" value={summary.emergencyName} />
                        <InfoField label="Relationship" value={summary.emergencyRelationship} />
                        <InfoField label="Emergency Number" value={summary.emergencyNumber} />
                        <InfoField label="Home Address" value={address} />
                    </div>
                </section>

                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Medical" title="Medical Snapshot" />
                    <div className={styles.infoGrid}>
                        <InfoField label="Blood Type" value={summary.bloodType} />
                        <InfoField label="Allergies" value={summary.allergies} />
                        <InfoField label="Conditions" value={summary.conditions} />
                        <InfoField label="Medications" value={summary.medications} />
                    </div>
                </section>

                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Care Context" title="Visit and Account Context" />
                    <div className={styles.toolGrid} style={{ gridTemplateColumns: '1fr', marginTop: '8px' }}>
                        <button
                            type="button"
                            className={styles.toolCard}
                            onClick={() => navigate('/patient/records')}
                            style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                        >
                            <span className={styles.toolIcon}><FaClipboardList /></span>
                            <h3 className={styles.toolTitle}>Open Medical Records</h3>
                            <p className={styles.toolText}>See your odontogram, x-rays, and treatment-linked history from the patient portal.</p>
                        </button>
                        <button
                            type="button"
                            className={styles.toolCard}
                            onClick={() => navigate('/patient/appointments')}
                            style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                        >
                            <span className={styles.toolIcon}><FaCalendarAlt /></span>
                            <h3 className={styles.toolTitle}>Review Visits</h3>
                            <p className={styles.toolText}>Check upcoming appointments, completed visits, and booking history in one place.</p>
                        </button>
                    </div>
                </section>
            </div>
        </PatientPageFrame>
    );
}
