import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaHistory,
    FaInfoCircle,
    FaLock,
    FaPencilAlt,
    FaSignOutAlt,
    FaUserCircle,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const getPasswordChecklist = (value) => ({
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
});

const PASSWORD_RULES = [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'upper', label: 'One uppercase letter (A-Z)' },
    { key: 'lower', label: 'One lowercase letter (a-z)' },
    { key: 'number', label: 'One number (0-9)' },
    { key: 'special', label: 'One special character like ! @ # $ % ^ & *' },
];

export default function PatientSettings() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [settings, setSettings] = useState({
        notifAppointments: true,
        notifVisitWindow: true,
        notifHealthTips: true,
        educationConsent: false,
    });
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifyingPassword, setVerifyingPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await authFetch('/my/settings');
                if (!response.ok) {
                    throw new Error();
                }
                const payload = await response.json();
                setSettings({
                    notifAppointments: payload.notifAppointments ?? true,
                    notifVisitWindow: payload.notifVisitWindow ?? true,
                    notifHealthTips: payload.notifHealthTips ?? true,
                    educationConsent: payload.educationConsent ?? false,
                });
            } catch {
                // Keep defaults on failure.
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const checklist = useMemo(() => getPasswordChecklist(newPassword), [newPassword]);
    const allCriteriaMet = useMemo(() => Object.values(checklist).every(Boolean), [checklist]);

    const saveSetting = async (key, value) => {
        setSavingKey(key);
        setSettings((current) => ({ ...current, [key]: value }));
        try {
            await authFetch('/my/settings', {
                method: 'PATCH',
                body: JSON.stringify({ [key]: value }),
            });
        } finally {
            setSavingKey('');
        }
    };

    const openPasswordModal = () => {
        setPasswordModalOpen(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordVerified(false);
        setPasswordError('');
        setPasswordSuccess('');
    };

    const verifyCurrentPassword = async () => {
        if (!currentPassword.trim()) {
            setPasswordError('Current password is required.');
            return;
        }
        setVerifyingPassword(true);
        setPasswordError('');
        try {
            const response = await authFetch('/verify-password', {
                method: 'POST',
                body: JSON.stringify({ password: currentPassword }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Incorrect password.');
            }
            setPasswordVerified(true);
        } catch (error) {
            setPasswordError(error.message || 'Unable to verify your password.');
        } finally {
            setVerifyingPassword(false);
        }
    };

    const changePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');

        if (!allCriteriaMet) {
            setPasswordError('Your new password does not meet all requirements.');
            return;
        }
        if (newPassword === currentPassword) {
            setPasswordError('New password must be different from your current password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }

        setChangingPassword(true);
        try {
            const response = await authFetch('/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    userId: user?.id,
                    currentPassword,
                    newPassword,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Failed to update password.');
            }

            setPasswordSuccess('Password changed successfully. You will be logged out for security.');
            window.setTimeout(() => {
                setPasswordModalOpen(false);
                logout();
            }, 1500);
        } catch (error) {
            setPasswordError(error.message || 'Failed to update password.');
        } finally {
            setChangingPassword(false);
        }
    };

    const accountLinks = [
        { title: 'View My Profile', text: 'See your patient identity and details.', icon: <FaUserCircle />, action: () => navigate('/patient/profile') },
        { title: 'Edit Profile', text: 'Update personal, medical, and address information.', icon: <FaPencilAlt />, action: () => navigate('/patient/profile/edit') },
        { title: 'Activity Logs', text: 'Review your recent patient account actions.', icon: <FaHistory />, action: () => navigate('/patient/activity-logs') },
    ];

    return (
        <PatientPageFrame
            title="Settings"
            subtitle="Manage notifications, privacy, password, and patient account preferences."
        >
            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading your settings...</span>
                </div>
            ) : (
                <>
                    <section style={{ marginBottom: '24px' }}>
                        <PatientSectionHeader eyebrow="Account" title="Patient account shortcuts" />
                        <div className={styles.toolGrid}>
                            {accountLinks.map((item) => (
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
                            <button
                                type="button"
                                className={styles.toolCard}
                                onClick={openPasswordModal}
                                style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                            >
                                <span className={styles.toolIcon}><FaLock /></span>
                                <h3 className={styles.toolTitle}>Change Password</h3>
                                <p className={styles.toolText}>Verify your current password, then set a new secure one.</p>
                            </button>
                        </div>
                    </section>

                    <section className={styles.cardGrid} style={{ marginBottom: '24px' }}>
                        <article className={styles.summaryCard}>
                            <PatientSectionHeader eyebrow="Notifications" title="Patient alerts" />
                            <div className={styles.timeline}>
                                {[
                                    ['notifAppointments', 'Appointment Alerts', 'Confirmations, declines, and reminders'],
                                    ['notifVisitWindow', 'Visit Window Reminders', 'Notify me when my next preventive visit is due'],
                                    ['notifHealthTips', 'Weekly Dental Health Tips', 'Send educational oral health reminders'],
                                ].map(([key, label, description]) => (
                                    <label key={key} className={styles.switchRow}>
                                        <div>
                                            <strong style={{ display: 'block', marginBottom: '4px', color: '#17364a' }}>{label}</strong>
                                            <p className={styles.toolText}>{description}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings[key]}
                                            onChange={(event) => saveSetting(key, event.target.checked)}
                                            disabled={savingKey === key}
                                        />
                                    </label>
                                ))}
                            </div>
                        </article>

                        <article className={styles.summaryCard}>
                            <PatientSectionHeader eyebrow="Privacy & Data" title="Consent controls" />
                            <div className={styles.timeline}>
                                <label className={styles.switchRow}>
                                    <div>
                                        <strong style={{ display: 'block', marginBottom: '4px', color: '#17364a' }}>Personalized Dental Education</strong>
                                        <p className={styles.toolText}>Allow Dentime to use your treatment history to personalize educational guidance.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.educationConsent}
                                        onChange={(event) => saveSetting('educationConsent', event.target.checked)}
                                        disabled={savingKey === 'educationConsent'}
                                    />
                                </label>
                            </div>
                        </article>
                    </section>

                    <section className={styles.alertCard}>
                        <span className={styles.toolIcon}><FaSignOutAlt /></span>
                        <div style={{ flex: 1 }}>
                            <h3 className={styles.alertTitle}>Ready to end your session?</h3>
                            <p className={styles.alertText}>You can also log out from the sidebar, but this patient page keeps the action available like the mobile settings screen.</p>
                        </div>
                        <button type="button" className={styles.buttonSecondary} onClick={() => logout()}>
                            Log Out
                        </button>
                    </section>

                    <section className={styles.summaryCard} style={{ marginTop: '24px' }}>
                        <PatientSectionHeader eyebrow="About" title="NgitiFy patient web portal" />
                        <div className={styles.timeline}>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <div>
                                    <h3 className={styles.timelineTitle}>Version</h3>
                                    <p className={styles.timelineText}>Dentime patient portal web experience • v1.0.0</p>
                                </div>
                            </div>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <div>
                                    <h3 className={styles.timelineTitle}>What this matches</h3>
                                    <p className={styles.timelineText}>This page keeps the same account, notifications, privacy, password, and logout tools that were already available on the patient mobile settings screen.</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.detailPills}>
                            <span className={styles.detailPill}><FaInfoCircle /> Patient web portal</span>
                        </div>
                    </section>
                </>
            )}

            {passwordModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>Change Password</h3>
                                <p className={styles.modalSubtitle}>Verify your current password before setting a new one.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setPasswordModalOpen(false)}>×</button>
                        </div>

                        {!passwordVerified ? (
                            <div className={styles.field}>
                                <span className={styles.label}>Current Password</span>
                                <input
                                    className={styles.input}
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    placeholder="Enter your current password"
                                />
                                {passwordError ? <p className={styles.helpText} style={{ color: '#b91c1c' }}>{passwordError}</p> : null}
                                <button type="button" className={styles.buttonPrimary} onClick={verifyCurrentPassword} disabled={verifyingPassword}>
                                    {verifyingPassword ? 'Verifying...' : 'Verify & Continue'}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.timeline}>
                                <label className={styles.field}>
                                    <span className={styles.label}>New Password</span>
                                    <input
                                        className={styles.input}
                                        type="password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        placeholder="Create a strong password"
                                    />
                                </label>

                                <div className={styles.noticeBox}>
                                    {PASSWORD_RULES.map((rule) => (
                                        <div key={rule.key} style={{ marginBottom: '6px', color: checklist[rule.key] ? '#15803d' : '#64748b' }}>
                                            {checklist[rule.key] ? '✓' : '•'} {rule.label}
                                        </div>
                                    ))}
                                </div>

                                <label className={styles.field}>
                                    <span className={styles.label}>Confirm New Password</span>
                                    <input
                                        className={styles.input}
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        placeholder="Re-enter your new password"
                                    />
                                </label>

                                {passwordError ? <p className={styles.helpText} style={{ color: '#b91c1c' }}>{passwordError}</p> : null}
                                {passwordSuccess ? <p className={styles.helpText} style={{ color: '#15803d' }}>{passwordSuccess}</p> : null}

                                <button type="button" className={styles.buttonPrimary} onClick={changePassword} disabled={changingPassword || !allCriteriaMet}>
                                    {changingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
