import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AdminSettings.module.css';
import PasswordField from '../../components/common/PasswordField';

const getPasswordChecklist = (value) => ({
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
});

const PASSWORD_RULES = [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'upper', label: 'One uppercase letter' },
    { key: 'lower', label: 'One lowercase letter' },
    { key: 'number', label: 'One number' },
    { key: 'special', label: 'One special character like `! @ # $ % ^ & *`' },
];

export default function PatientSettings() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [activeTab, setActiveTab] = useState('security');
    const [settings, setSettings] = useState({
        notifAppointments: true,
        notifVisitWindow: true,
        notifHealthTips: true,
        educationConsent: false,
    });
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifyingPassword, setVerifyingPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [settingsMessage, setSettingsMessage] = useState('');

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
                setSettingsMessage('Patient settings could not be loaded. Default values are shown.');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const checklist = useMemo(() => getPasswordChecklist(newPassword), [newPassword]);
    const allCriteriaMet = useMemo(() => Object.values(checklist).every(Boolean), [checklist]);
    const isSamePassword = newPassword && newPassword === currentPassword;

    useEffect(() => {
        if (confirmPassword && newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }
        setPasswordError((current) => (current === 'Passwords do not match.' ? '' : current));
    }, [confirmPassword, newPassword]);

    const saveSetting = async (key, value) => {
        setSavingKey(key);
        setSettingsMessage('');
        setSettings((current) => ({ ...current, [key]: value }));
        try {
            const response = await authFetch('/my/settings', {
                method: 'PATCH',
                body: JSON.stringify({ [key]: value }),
            });
            if (!response.ok) throw new Error();
            setSettingsMessage('Settings saved successfully.');
            window.setTimeout(() => setSettingsMessage(''), 2500);
        } catch {
            setSettings((current) => ({ ...current, [key]: !value }));
            setSettingsMessage('Unable to save this setting. Please try again.');
        } finally {
            setSavingKey('');
        }
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
                throw new Error(payload.message || 'Incorrect current password.');
            }
            setPasswordVerified(true);
        } catch (error) {
            setPasswordError(error.message || 'Unable to verify your password.');
        } finally {
            setVerifyingPassword(false);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (!passwordVerified) return;
        if (!allCriteriaMet) {
            setPasswordError('Please complete all password requirements.');
            return;
        }
        if (isSamePassword) {
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
                    userId: user?.id || user?.userId || user?._id,
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
                logout();
                navigate('/login', { state: { message: 'Password changed successfully. Please log in again.' } });
            }, 1500);
        } catch (error) {
            setPasswordError(error.message || 'Failed to update password.');
        } finally {
            setChangingPassword(false);
        }
    };

    const renderSecuritySection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Security</h3>
            <p className={styles.sectionDescription}>Verify your current password before setting a new password for your patient account.</p>

            {passwordError && <div className={styles.apiErrorMessage}>{passwordError}</div>}
            {passwordSuccess && <div className={styles.successMessage}>{passwordSuccess}</div>}

            <form onSubmit={changePassword} noValidate>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>CURRENT PASSWORD <span style={{ color: 'red' }}>*</span></label>
                        <div className={styles.inputRow}>
                            <PasswordField
                                className={styles.inputField}
                                value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                                disabled={passwordVerified || verifyingPassword || changingPassword}
                                placeholder="Enter current password"
                            />
                            {!passwordVerified ? (
                                <button
                                    type="button"
                                    className={styles.verifyBtn}
                                    onClick={verifyCurrentPassword}
                                    disabled={verifyingPassword || !currentPassword}
                                >
                                    {verifyingPassword ? 'VERIFYING...' : 'VERIFY'}
                                </button>
                            ) : (
                                <div className={styles.verifiedBadge}>Verified</div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ opacity: passwordVerified ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>NEW PASSWORD <span style={{ color: 'red' }}>*</span></label>
                            <PasswordField
                                className={`${styles.inputField} ${isSamePassword ? styles.errorBorder : ''}`}
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                disabled={!passwordVerified || changingPassword}
                                placeholder="Enter new password"
                            />
                            {isSamePassword && <span className={styles.errorText}>New password cannot be the same as the current password.</span>}
                            <ul className={styles.checklist} style={{ marginTop: '10px' }}>
                                {PASSWORD_RULES.map((rule) => (
                                    <li key={rule.key} className={`${styles.checkItem} ${checklist[rule.key] ? styles.valid : ''}`}>
                                        {rule.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CONFIRM NEW PASSWORD <span style={{ color: 'red' }}>*</span></label>
                            <PasswordField
                                className={styles.inputField}
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                disabled={!passwordVerified || changingPassword}
                                placeholder="Re-enter new password"
                            />
                        </div>
                    </div>

                    <div className={styles.buttonGroup} style={{ borderTop: 'none', marginTop: 0 }}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={!passwordVerified || !allCriteriaMet || newPassword !== confirmPassword || isSamePassword || changingPassword}
                        >
                            {changingPassword ? 'UPDATING...' : 'UPDATE PASSWORD'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );

    const renderNotificationsSection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Notification Settings</h3>
            <p className={styles.sectionDescription}>Choose which patient alerts should be active for your account.</p>
            {settingsMessage && (
                <div className={settingsMessage.includes('success') ? styles.successMessage : styles.apiErrorMessage}>
                    {settingsMessage}
                </div>
            )}

            {[
                ['notifAppointments', 'Appointment Alerts', 'Receive confirmations, declines, reminders, and appointment updates.'],
                ['notifVisitWindow', 'Visit Window Reminders', 'Receive reminders when your next preventive visit is due.'],
                ['notifHealthTips', 'Weekly Dental Health Tips', 'Receive educational reminders about oral health and preventive care.'],
            ].map(([key, label, description]) => (
                <div key={key} className={styles.toggleRow}>
                    <div className={styles.toggleLabel}>
                        <span className={styles.toggleTitle}>{label}</span>
                        <span className={styles.toggleDesc}>{description}</span>
                    </div>
                    <label className={styles.switch}>
                        <input
                            type="checkbox"
                            checked={settings[key]}
                            onChange={(event) => saveSetting(key, event.target.checked)}
                            disabled={savingKey === key}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>
            ))}
        </div>
    );

    const renderPrivacySection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Privacy and Data Preferences</h3>
            <p className={styles.sectionDescription}>Manage consent settings related to patient education and personalized guidance.</p>
            {settingsMessage && (
                <div className={settingsMessage.includes('success') ? styles.successMessage : styles.apiErrorMessage}>
                    {settingsMessage}
                </div>
            )}

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Personalized Dental Education</span>
                    <span className={styles.toggleDesc}>Allow Dentime to use your treatment history to personalize educational guidance.</span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={settings.educationConsent}
                        onChange={(event) => saveSetting('educationConsent', event.target.checked)}
                        disabled={savingKey === 'educationConsent'}
                    />
                    <span className={styles.slider}></span>
                </label>
            </div>
        </div>
    );

    const renderAccountSection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Actions</h3>
            <p className={styles.sectionDescription}>Open related patient account pages or end the current session.</p>

            <div className={styles.row}>
                <button type="button" className={styles.verifyBtn} onClick={() => navigate('/patient/profile')}>
                    VIEW MY PROFILE
                </button>
                <button type="button" className={styles.verifyBtn} onClick={() => navigate('/patient/profile/edit')}>
                    EDIT PROFILE
                </button>
                <button type="button" className={styles.verifyBtn} onClick={() => navigate('/patient/activity-logs')}>
                    ACTIVITY LOGS
                </button>
            </div>

            <div className={styles.buttonGroup}>
                <button type="button" className={styles.submitBtn} onClick={() => logout()}>
                    LOG OUT
                </button>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.subtitle}>Manage your patient account security, notifications, privacy, and account actions.</p>
                </div>
            </div>

            {loading ? (
                <div className={styles.contentArea}>
                    <h3 className={styles.mainSectionTitle}>Loading Settings</h3>
                    <p className={styles.sectionDescription}>Loading your patient settings...</p>
                </div>
            ) : (
                <div className={styles.settingsLayout}>
                    <div className={styles.sidebar}>
                        <ul className={styles.tabList}>
                            <li
                                className={`${styles.tabItem} ${activeTab === 'security' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('security')}
                            >
                                Account Security
                            </li>
                            <li
                                className={`${styles.tabItem} ${activeTab === 'notifications' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('notifications')}
                            >
                                Notifications
                            </li>
                            <li
                                className={`${styles.tabItem} ${activeTab === 'privacy' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('privacy')}
                            >
                                Privacy and Data
                            </li>
                            <li
                                className={`${styles.tabItem} ${activeTab === 'account' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('account')}
                            >
                                Account Actions
                            </li>
                        </ul>
                    </div>

                    <div className={styles.contentArea}>
                        {activeTab === 'security' && renderSecuritySection()}
                        {activeTab === 'notifications' && renderNotificationsSection()}
                        {activeTab === 'privacy' && renderPrivacySection()}
                        {activeTab === 'account' && renderAccountSection()}
                    </div>
                </div>
            )}
        </div>
    );
}
