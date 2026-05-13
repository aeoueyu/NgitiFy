import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaCalendarAlt,
    FaCog,
    FaComments,
    FaEnvelope,
    FaHistory,
    FaPencilAlt,
    FaPhoneAlt,
    FaUserCircle,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import {
    calculateAge,
    formatAddress,
    formatDateDisplay,
    getInitials,
    getFullName,
} from '../../utils/patientPortal';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

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
    const initials = profile ? getInitials(profile) : getInitials(user);
    const age = calculateAge(profile?.birthdate);
    const bloodType = profile?.bloodType || profile?.medicalHistory?.bloodType || 'Not specified';
    const contactNumber = profile?.contactNumber || 'Not specified';
    const email = profile?.email || user?.email || 'Not specified';

    const sections = useMemo(() => ([
        {
            title: 'Personal Information',
            rows: [
                ['Full Name', fullName],
                ['Birthdate', formatDateDisplay(profile?.birthdate, { month: 'long' })],
                ['Age', age !== null ? `${age} years old` : 'Not specified'],
                ['Gender', profile?.gender || 'Not specified'],
                ['Civil Status', profile?.civilStatus || 'Not specified'],
                ['Occupation', profile?.occupation || 'Not specified'],
            ],
        },
        {
            title: 'Contact Details',
            rows: [
                ['Email Address', email],
                ['Phone Number', contactNumber],
                ['Home Address', formatAddress(profile?.currentAddress || profile?.permanentAddress || {})],
            ],
        },
        {
            title: 'Emergency Contact',
            rows: [
                ['Contact Name', profile?.emergencyContact?.name || 'Not specified'],
                ['Relationship', profile?.emergencyContact?.relationship || 'Not specified'],
                ['Contact Number', profile?.emergencyContact?.contactNumber || 'Not specified'],
            ],
        },
        {
            title: 'Medical Snapshot',
            rows: [
                ['Blood Type', bloodType],
                ['Allergies', profile?.medicalHistory?.allergies?.join(', ') || 'Not specified'],
                ['Conditions', profile?.medicalHistory?.conditions?.join(', ') || 'Not specified'],
                ['Medications', profile?.medicalHistory?.medications?.join(', ') || 'Not specified'],
            ],
        },
    ]), [age, bloodType, contactNumber, email, fullName, profile]);

    const quickActions = [
        { title: 'Edit Profile', text: 'Update your personal and medical details.', icon: <FaPencilAlt />, action: () => navigate('/patient/profile/edit') },
        { title: 'Settings', text: 'Notifications, privacy, password, and theme.', icon: <FaCog />, action: () => navigate('/patient/settings') },
        { title: 'Activity Logs', text: 'Review your recent actions in Dentime.', icon: <FaHistory />, action: () => navigate('/patient/activity-logs') },
        { title: 'AI Companion', text: 'Ask for support or approved dental guidance.', icon: <FaComments />, action: () => navigate('/patient/ai-companion') },
    ];

    return (
        <PatientPageFrame
            title="My Profile"
            subtitle="Your patient identity, contact details, and health snapshot from the same account used on mobile."
        >
            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading your profile...</span>
                </div>
            ) : error ? (
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
            ) : (
                <>
                    <div className={styles.heroGrid}>
                        <section className={styles.heroCard}>
                            <span className={styles.heroEyebrow}>Patient Identity</span>
                            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', marginBottom: '18px' }}>
                                <div
                                    style={{
                                        width: '88px',
                                        height: '88px',
                                        borderRadius: '28px',
                                        background: profile?.profileImage ? `url(${profile.profileImage}) center / cover no-repeat` : 'linear-gradient(135deg, #01538b, #2dccf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        fontSize: '28px',
                                        flexShrink: 0,
                                    }}
                                >
                                    {!profile?.profileImage ? initials : null}
                                </div>
                                <div>
                                    <h2 className={styles.heroTitle} style={{ color: '#17364a', fontSize: '28px', marginBottom: '8px' }}>{fullName}</h2>
                                    <p className={styles.heroText} style={{ color: '#5f7a8d' }}>{email}</p>
                                    <div className={styles.detailPills}>
                                        <span className={styles.detailPill}><FaCalendarAlt /> {age !== null ? `${age} yrs old` : 'Age not set'}</span>
                                        <span className={styles.detailPill}><FaPhoneAlt /> {contactNumber}</span>
                                        <span className={styles.detailPill}>{bloodType}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/profile/edit')}>
                                    Edit Profile
                                </button>
                                <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/settings')}>
                                    Open Settings
                                </button>
                            </div>
                        </section>

                        <section className={styles.metricGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 0 }}>
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Assigned Branch</span>
                                <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{profile?.assignedBranch || profile?.assignedBranches?.[0] || user?.assignedBranch || 'Pending'}</h3>
                                <p className={styles.metricSub}>Used for patient slot availability.</p>
                            </article>
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Patient Email</span>
                                <h3 className={styles.metricValue} style={{ fontSize: '18px' }}><FaEnvelope /></h3>
                                <p className={styles.metricSub}>{email}</p>
                            </article>
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Reason for Consultation</span>
                                <h3 className={styles.metricValue} style={{ fontSize: '20px' }}>{profile?.reasonForConsultation || 'Not set'}</h3>
                                <p className={styles.metricSub}>What the clinic currently has on file.</p>
                            </article>
                        </section>
                    </div>

                    <section style={{ marginBottom: '24px' }}>
                        <PatientSectionHeader
                            eyebrow="Quick Actions"
                            title="Profile shortcuts"
                            description="The same profile-related patient actions from mobile, organized for web."
                        />
                        <div className={styles.toolGrid}>
                            {quickActions.map((item) => (
                                <button
                                    key={item.title}
                                    type="button"
                                    className={styles.toolCard}
                                    onClick={item.action}
                                    style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                                >
                                    <span className={styles.toolIcon}>{item.icon}</span>
                                    <h3 className={styles.toolTitle}>{item.title}</h3>
                                    <p className={styles.toolText}>{item.text}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className={styles.cardGrid}>
                        {sections.map((section) => (
                            <article key={section.title} className={styles.infoCard}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '14px' }}>{section.title}</h3>
                                <div className={styles.timeline}>
                                    {section.rows.map(([label, value]) => (
                                        <div key={`${section.title}-${label}`}>
                                            <span className={styles.infoLabel}>{label}</span>
                                            <p className={styles.infoValue}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </section>
                </>
            )}
        </PatientPageFrame>
    );
}

