import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AdminSettings.module.css';
import PasswordField from '../../components/common/PasswordField';
import {
    PatientPageFrame,
} from '../../components/patient/PatientFrame';

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
        notifOralHealthDaily: true,
        notifSymptomFollowUp: true,
        notifHealthTips: true,
        oralHealthReminderTime: '20:00',
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
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
    const [emailPasswordVerified, setEmailPasswordVerified] = useState(false);
    const [verifyingEmailPassword, setVerifyingEmailPassword] = useState(false);
    const [submittingEmailChange, setSubmittingEmailChange] = useState(false);
    const [emailChangeError, setEmailChangeError] = useState('');
    const [emailChangeSuccess, setEmailChangeSuccess] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await authFetch('/my/settings');
                if (!response.ok) {
                    throw new Error();
                }
                const payload = await response.json();
                setSettings({
                    notifAppointments:
                        payload.notifAppointments
                        ?? true,
                    notifVisitWindow:
                        payload.notifVisitWindow
                        ?? true,
                    notifOralHealthDaily:
                        payload.notifOralHealthDaily
                        ?? true,
                    notifSymptomFollowUp:
                        payload.notifSymptomFollowUp
                        ?? true,
                    notifHealthTips:
                        payload.notifHealthTips
                        ?? true,
                    oralHealthReminderTime:
                        payload.oralHealthReminderTime
                        || '20:00',
                    educationConsent:
                        payload.educationConsent
                        ?? false,
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

        const saveReminderTime = async (value) => {
        const normalized = String(
            value || ''
        ).trim();

        if (
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/
                .test(normalized)
        ) {
            setSettingsMessage(
                'Reminder time must use a valid 24-hour HH:MM time.'
            );
            return;
        }

        const previousValue =
            settings.oralHealthReminderTime;

        setSavingKey(
            'oralHealthReminderTime'
        );

        setSettingsMessage('');

        setSettings((current) => ({
            ...current,
            oralHealthReminderTime:
                normalized,
        }));

        try {
            const response =
                await authFetch(
                    '/my/settings',
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            oralHealthReminderTime:
                                normalized,
                        }),
                    }
                );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload.message
                    || 'Unable to save reminder time.'
                );
            }

            setSettings((current) => ({
                ...current,
                oralHealthReminderTime:
                    payload
                        .oralHealthReminderTime
                    || normalized,
            }));

            setSettingsMessage(
                'Settings saved successfully.'
            );

            window.setTimeout(
                () => setSettingsMessage(''),
                2500
            );
        } catch (error) {
            setSettings((current) => ({
                ...current,
                oralHealthReminderTime:
                    previousValue,
            }));

            setSettingsMessage(
                error.message
                || 'Unable to save reminder time. Please try again.'
            );
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

    const resetEmailChange = () => {
        setEmailForm({ newEmail: '', currentPassword: '' });
        setEmailPasswordVerified(false);
        setVerifyingEmailPassword(false);
        setSubmittingEmailChange(false);
        setEmailChangeError('');
    };

    const openEmailChange = () => {
        resetEmailChange();
        setEmailChangeSuccess('');
        setShowEmailModal(true);
    };

    const verifyEmailPassword = async () => {
        if (!emailForm.currentPassword) {
            setEmailChangeError('Current password is required.');
            return;
        }
        setVerifyingEmailPassword(true);
        setEmailChangeError('');
        try {
            const response = await authFetch('/verify-current-password', {
                method: 'POST',
                skipUnauthorizedRedirect: true,
                body: JSON.stringify({
                    userId: user?.id || user?.userId || user?._id,
                    currentPassword: emailForm.currentPassword,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Current password is incorrect.');
            }
            setEmailPasswordVerified(true);
        } catch (error) {
            setEmailPasswordVerified(false);
            setEmailChangeError(error.message || 'Unable to verify your password.');
        } finally {
            setVerifyingEmailPassword(false);
        }
    };

    const requestEmailChange = async (event) => {
        event.preventDefault();
        const newEmail = emailForm.newEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            setEmailChangeError('Enter a valid new email address.');
            return;
        }
        if (newEmail === String(user?.email || '').trim().toLowerCase()) {
            setEmailChangeError('New email must be different from the current email.');
            return;
        }
        if (!emailPasswordVerified) {
            setEmailChangeError('Verify your current password first.');
            return;
        }
        setSubmittingEmailChange(true);
        setEmailChangeError('');
        try {
            const response = await authFetch('/user/request-email-change', {
                method: 'POST',
                skipUnauthorizedRedirect: true,
                body: JSON.stringify({ newEmail, currentPassword: emailForm.currentPassword }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to request the email change.');
            setEmailChangeSuccess(payload.message || 'Verification link sent to your new email address.');
            setShowEmailModal(false);
            resetEmailChange();
        } catch (error) {
            setEmailChangeError(error.message || 'Unable to request the email change.');
        } finally {
            setSubmittingEmailChange(false);
        }
    };

    const renderSecuritySection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Security</h3>
            <p className={styles.sectionDescription}>Verify your current password before setting a new password for your patient account.</p>

            {passwordError && <div className={styles.apiErrorMessage} role="alert">{passwordError}</div>}
            {passwordSuccess && <div className={styles.successMessage} role="status" aria-live="polite">{passwordSuccess}</div>}

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
                                <div className={styles.verifiedBadge} role="status">Verified</div>
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
            <h3 className={styles.mainSectionTitle}>
                Notification Settings
            </h3>

            <p className={styles.sectionDescription}>
                Choose which patient alerts should be active for your account.
                These preferences are shared with the NgitiFy mobile app.
            </p>

            {settingsMessage && (
                <div
                    className={
                        settingsMessage.includes(
                            'success'
                        )
                            ? styles.successMessage
                            : styles.apiErrorMessage
                    }
                    role={
                        settingsMessage.includes(
                            'success'
                        )
                            ? 'status'
                            : 'alert'
                    }
                    aria-live="polite"
                >
                    {settingsMessage}
                </div>
            )}

            {[
                [
                    'notifAppointments',
                    'Appointment Alerts',
                    'Receive confirmations, declines, reminders, cancellations, and appointment updates.',
                ],
                [
                    'notifVisitWindow',
                    'Recommended Visit Window Reminders',
                    'Receive reminders related to your current NgitiFy Recommended Visit Window.',
                ],
                [
                    'notifOralHealthDaily',
                    'Daily Oral Health Management Reminder',
                    'Receive a reminder when today’s Daily Oral Health Log has not been completed by your selected reminder time.',
                ],
                [
                    'notifSymptomFollowUp',
                    'Symptom Follow-Up Reminders',
                    'Receive non-diagnostic follow-up reminders generated only from approved Oral Health Management safety rules.',
                ],
                [
                    'notifHealthTips',
                    'Dental Health Education / Dental Health Tips',
                    'Receive approved Dental Health Education and oral-health tip notifications.',
                ],
            ].map(
                ([
                    key,
                    label,
                    description,
                ]) => (
                    <div
                        key={key}
                        className={
                            styles.toggleRow
                        }
                    >
                        <div
                            className={
                                styles.toggleLabel
                            }
                        >
                            <span
                                className={
                                    styles.toggleTitle
                                }
                            >
                                {label}
                            </span>

                            <span
                                className={
                                    styles.toggleDesc
                                }
                            >
                                {description}
                            </span>
                        </div>

                        <label
                            className={
                                styles.switch
                            }
                        >
                            <input
                                type="checkbox"
                                checked={
                                    settings[key]
                                }
                                onChange={(
                                    event
                                ) =>
                                    saveSetting(
                                        key,
                                        event
                                            .target
                                            .checked
                                    )
                                }
                                disabled={
                                    savingKey
                                    === key
                                }
                                aria-label={
                                    label
                                }
                            />

                            <span
                                className={
                                    styles.slider
                                }
                            />
                        </label>
                    </div>
                )
            )}

            <div className={styles.toggleRow}>
                <div
                    className={
                        styles.toggleLabel
                    }
                >
                    <span
                        className={
                            styles.toggleTitle
                        }
                    >
                        Daily Oral Health Management Reminder Time
                    </span>

                    <span
                        className={
                            styles.toggleDesc
                        }
                    >
                        Choose when NgitiFy should check whether today&apos;s Daily Oral Health Log is still missing. No missing-log reminder is generated if today&apos;s log is already completed.
                    </span>
                </div>

                <div
                    style={{
                        minWidth: '150px',
                        marginLeft: '24px',
                    }}
                >
                    <input
                        type="time"
                        className={
                            styles.inputField
                        }
                        value={
                            settings
                                .oralHealthReminderTime
                        }
                        onChange={(event) =>
                            saveReminderTime(
                                event.target.value
                            )
                        }
                        disabled={
                            !settings
                                .notifOralHealthDaily
                            || savingKey
                                === 'oralHealthReminderTime'
                        }
                        aria-label="Daily Oral Health Management reminder time"
                    />

                    {!settings
                        .notifOralHealthDaily ? (
                        <span
                            className={
                                styles.toggleDesc
                            }
                            style={{
                                display:
                                    'block',
                                marginTop:
                                    '6px',
                            }}
                        >
                            Enable the daily reminder to use this time.
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );

    const renderPrivacySection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Privacy and Data Preferences</h3>
            <p className={styles.sectionDescription}>Manage consent settings related to patient education and personalized guidance.</p>
            {settingsMessage && (
                <div className={settingsMessage.includes('success') ? styles.successMessage : styles.apiErrorMessage} role={settingsMessage.includes('success') ? 'status' : 'alert'} aria-live="polite">
                    {settingsMessage}
                </div>
            )}

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Personalized Dental Health Education</span>
                    <span className={styles.toggleDesc}>Allow Dentime to use your treatment history to personalize educational guidance.</span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={settings.educationConsent}
                        onChange={(event) => saveSetting('educationConsent', event.target.checked)}
                        disabled={savingKey === 'educationConsent'}
                        aria-label="Personalized Dental Health Education"
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
                <button type="button" className={styles.verifyBtn} onClick={openEmailChange}>
                    CHANGE EMAIL
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
        <PatientPageFrame
            title="Settings"
            subtitle="Manage your patient account security, notifications, privacy, and account actions."
        >
            {loading ? (
                <div className={styles.contentArea}>
                    <h3 className={styles.mainSectionTitle}>
                        Loading Settings
                    </h3>

                    <p className={styles.sectionDescription}>
                        Loading your patient settings...
                    </p>
                </div>
            ) : (
                <div className={styles.settingsLayout}>
                    <nav
                        className={styles.sidebar}
                        aria-label="Patient settings"
                    >
                        <ul
                            className={styles.tabList}
                            role="tablist"
                            aria-label="Patient settings sections"
                        >
                            {[
                                [
                                    'security',
                                    'Account Security',
                                ],
                                [
                                    'notifications',
                                    'Notifications',
                                ],
                                [
                                    'privacy',
                                    'Privacy and Data',
                                ],
                                [
                                    'account',
                                    'Account Actions',
                                ],
                            ].map(([key, label]) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        role="tab"
                                        id={`patient-settings-tab-${key}`}
                                        aria-selected={
                                            activeTab === key
                                        }
                                        aria-controls={
                                            `patient-settings-${key}`
                                        }
                                        className={`${styles.tabItem} ${
                                            activeTab === key
                                                ? styles.activeTab
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setActiveTab(key)
                                        }
                                    >
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <section
                        className={styles.contentArea}
                        id={`patient-settings-${activeTab}`}
                        role="tabpanel"
                        aria-labelledby={
                            `patient-settings-tab-${activeTab}`
                        }
                        tabIndex={0}
                    >
                        {activeTab === 'security'
                            && renderSecuritySection()}

                        {activeTab === 'notifications'
                            && renderNotificationsSection()}

                        {activeTab === 'privacy'
                            && renderPrivacySection()}

                        {activeTab === 'account'
                            && renderAccountSection()}
                    </section>
                </div>
            )}
            {showEmailModal ? (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="patient-change-email-title">
                    <div className={styles.modalCard}>
                        <h3 id="patient-change-email-title" className={styles.modalTitle}>Change Email Address</h3>
                        <p className={styles.modalMessage}>
                            Enter your new email and verify your current password. You will be logged out after the verification link is sent.
                        </p>
                        <form onSubmit={requestEmailChange} style={{ width: '100%', textAlign: 'left' }} noValidate>
                            <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                                <label>NEW EMAIL ADDRESS</label>
                                <input
                                    type="email"
                                    className={styles.inputField}
                                    value={emailForm.newEmail}
                                    onChange={(event) => {
                                        setEmailForm((current) => ({ ...current, newEmail: event.target.value }));
                                        setEmailChangeError('');
                                    }}
                                    autoComplete="email"
                                    disabled={submittingEmailChange}
                                />
                            </div>
                            <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                                <label>CURRENT PASSWORD</label>
                                <div className={styles.inputRow}>
                                    <PasswordField
                                        className={styles.inputField}
                                        value={emailForm.currentPassword}
                                        onChange={(event) => {
                                            setEmailForm((current) => ({ ...current, currentPassword: event.target.value }));
                                            setEmailPasswordVerified(false);
                                            setEmailChangeError('');
                                        }}
                                        disabled={submittingEmailChange || verifyingEmailPassword}
                                    />
                                    {!emailPasswordVerified ? (
                                        <button type="button" className={styles.verifyBtn} onClick={verifyEmailPassword} disabled={!emailForm.currentPassword || verifyingEmailPassword || submittingEmailChange}>
                                            {verifyingEmailPassword ? 'VERIFYING...' : 'VERIFY'}
                                        </button>
                                    ) : <div className={styles.verifiedBadge}>Verified</div>}
                                </div>
                            </div>
                            {emailChangeError ? <div className={styles.apiErrorMessage} role="alert">{emailChangeError}</div> : null}
                            <div className={styles.buttonGroup} style={{ marginTop: '20px' }}>
                                <button type="button" className={styles.verifyBtn} onClick={() => { setShowEmailModal(false); resetEmailChange(); }} disabled={submittingEmailChange}>CANCEL</button>
                                <button type="submit" className={styles.submitBtn} disabled={!emailPasswordVerified || !emailForm.newEmail.trim() || submittingEmailChange}>
                                    {submittingEmailChange ? 'REQUESTING...' : 'SEND VERIFICATION LINK'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
            {emailChangeSuccess ? (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="patient-email-sent-title">
                    <div className={styles.modalCard}>
                        <h3 id="patient-email-sent-title" className={styles.modalTitle}>Verification Link Sent</h3>
                        <p className={styles.modalMessage}>{emailChangeSuccess}</p>
                        <button type="button" className={styles.modalButton} onClick={() => {
                            setEmailChangeSuccess('');
                            logout('email_change_requested');
                            navigate('/login', { state: { message: 'Verify your new email before signing in again.' } });
                        }}>OK, LOG ME OUT</button>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
