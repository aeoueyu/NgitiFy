import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AdminSettings.module.css';

export default function SecretarySettings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('security');

    // ── Security state ────────────────────────────────────────────────────────
    const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
    const [isVerifying, setIsVerifying]   = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword:     '',
        confirmPassword: '',
    });
    const [passErrors, setPassErrors]       = useState({});
    const [apiError, setApiError]           = useState('');
    const [isSubmittingPass, setIsSubmittingPass] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [checklist, setChecklist] = useState({
        length: false, upper: false, lower: false, number: false, special: false,
    });
    const [allCriteriaMet, setAllCriteriaMet] = useState(false);

    // ── Notification Preferences state ────────────────────────────────────────
    // Secretary-specific toggles per Phase 9 spec:
    //   appointmentAlerts — new bookings, cancellations, reminders
    //   chatAlerts        — AI escalation → live chat
    //   queueAlerts       — queue state events
    //   patientAlerts     — new patient registration / activation
    const [notifications, setNotifications] = useState({
        appointmentAlerts: true,
        chatAlerts:        true,
        queueAlerts:       true,
        patientAlerts:     true,
    });
    const [notifSuccess, setNotifSuccess] = useState('');
    const [notifError,   setNotifError]   = useState('');

    // ── Account overview state ────────────────────────────────────────────────
    const [profile, setProfile] = useState(null);

    // ── Load saved theme on mount ─────────────────────────────────────────────
    // ── Load profile + notification preferences from backend ──────────────────
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const userId = user?.userId || user?.id || user?._id;
                if (!userId) return;
                const res = await authFetch(`/user/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                    if (data.notificationPreferences) {
                        const p = data.notificationPreferences;
                        setNotifications({
                            appointmentAlerts: p.appointmentAlerts ?? true,
                            chatAlerts:        p.chatAlerts        ?? true,
                            queueAlerts:       p.queueAlerts       ?? true,
                            patientAlerts:     p.patientAlerts     ?? true,
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to load secretary profile:', err);
            }
        };
        fetchProfile();
    }, [user]);

    // ── Password strength checklist ───────────────────────────────────────────
    useEffect(() => {
        const pw = passwordData.newPassword;
        const checks = {
            length:  pw.length >= 8,
            upper:   /[A-Z]/.test(pw),
            lower:   /[a-z]/.test(pw),
            number:  /[0-9]/.test(pw),
            special: /[^A-Za-z0-9]/.test(pw),
        };
        setChecklist(checks);
        setAllCriteriaMet(Object.values(checks).every(Boolean));
    }, [passwordData.newPassword]);

    // ── Password change handlers ──────────────────────────────────────────────
    const handlePassChange = (e) => {
        const { name, value } = e.target;
        if (passErrors[name]) {
            setPassErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        }
        setApiError('');
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleVerifyCurrentPassword = async () => {
        if (!passwordData.currentPassword) {
            setPassErrors({ currentPassword: 'Required to verify' });
            return;
        }
        setIsVerifying(true);
        setApiError('');
        setPassErrors({});
        try {
            const userId = user?.userId || user?.id || user?._id;
            const res = await authFetch('/verify-current-password', {
                method: 'POST',
                body: JSON.stringify({ userId, currentPassword: passwordData.currentPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsCurrentPasswordVerified(true);
            } else {
                setPassErrors({ currentPassword: data.message || 'Incorrect current password.' });
            }
        } catch {
            setApiError('Cannot connect to server to verify password.');
        } finally {
            setIsVerifying(false);
        }
    };

    const isSamePassword =
        passwordData.newPassword &&
        passwordData.newPassword === passwordData.currentPassword;

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!isCurrentPasswordVerified || !allCriteriaMet) return;
        if (isSamePassword) {
            setPassErrors({ newPassword: 'New password cannot be the same as the current password.' });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPassErrors({ confirmPassword: 'Passwords do not match.' });
            return;
        }
        setIsSubmittingPass(true);
        setApiError('');
        try {
            const userId = user?.userId || user?.id || user?._id;
            const res = await authFetch('/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    userId,
                    currentPassword: passwordData.currentPassword,
                    newPassword:     passwordData.newPassword,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setShowSuccessModal(true);
            } else {
                setApiError(data.message || 'Failed to change password.');
            }
        } catch {
            setApiError('Cannot connect to server.');
        } finally {
            setIsSubmittingPass(false);
        }
    };

    const handleModalClose = () => {
        setShowSuccessModal(false);
        logout();
        navigate('/login', { state: { message: 'Password changed successfully. Please log in again.' } });
    };

    // ── Notification preferences handlers ─────────────────────────────────────
    const toggleNotif = (key) =>
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSaveNotifications = async (e) => {
        e.preventDefault();
        setNotifError('');
        try {
            const res = await authFetch('/user/notification-preferences', {
                method: 'PUT',
                body: JSON.stringify(notifications),
            });
            if (res.ok) {
                setNotifSuccess('Notification preferences saved.');
                setTimeout(() => setNotifSuccess(''), 3000);
            } else {
                const data = await res.json();
                setNotifError(data.message || 'Failed to save preferences.');
                setTimeout(() => setNotifError(''), 4000);
            }
        } catch {
            setNotifError('Cannot connect to server.');
            setTimeout(() => setNotifError(''), 4000);
        }
    };

    // ── Render: Security tab ──────────────────────────────────────────────────
    const renderSecurity = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Security</h3>

            {apiError && (
                <div className={styles.apiErrorMessage}>{apiError}</div>
            )}

            <form onSubmit={handlePasswordSubmit} noValidate>

                {/* Step 1 — Verify current password */}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>
                            CURRENT PASSWORD <span style={{ color: 'red' }}>*</span>
                        </label>
                        <div className={styles.inputRow}>
                            <input
                                type="password"
                                className={`${styles.inputField} ${passErrors.currentPassword ? styles.errorBorder : ''}`}
                                name="currentPassword"
                                value={passwordData.currentPassword}
                                onChange={handlePassChange}
                                disabled={isCurrentPasswordVerified || isVerifying || isSubmittingPass}
                                placeholder="Enter current password"
                            />
                            {!isCurrentPasswordVerified ? (
                                <button
                                    type="button"
                                    className={styles.verifyBtn}
                                    onClick={handleVerifyCurrentPassword}
                                    disabled={isVerifying || !passwordData.currentPassword}
                                >
                                    {isVerifying ? 'VERIFYING...' : 'VERIFY'}
                                </button>
                            ) : (
                                <div className={styles.verifiedBadge}>✓ Verified</div>
                            )}
                        </div>
                        {passErrors.currentPassword && (
                            <span className={styles.errorText}>{passErrors.currentPassword}</span>
                        )}
                    </div>
                </div>

                {/* Steps 2–3 — New password */}
                <div style={{ opacity: isCurrentPasswordVerified ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>
                                NEW PASSWORD <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                                type="password"
                                className={`${styles.inputField} ${passErrors.newPassword || isSamePassword ? styles.errorBorder : ''}`}
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePassChange}
                                disabled={!isCurrentPasswordVerified || isSubmittingPass}
                                placeholder="Enter new password"
                            />
                            {isSamePassword ? (
                                <span className={styles.errorText}>
                                    New password cannot be the same as the current password.
                                </span>
                            ) : passErrors.newPassword ? (
                                <span className={styles.errorText}>{passErrors.newPassword}</span>
                            ) : null}

                            <ul className={styles.checklist} style={{ marginTop: '10px' }}>
                                <li className={`${styles.checkItem} ${checklist.length  ? styles.valid : ''}`}>
                                    At least 8 characters
                                </li>
                                <li className={`${styles.checkItem} ${checklist.upper   ? styles.valid : ''}`}>
                                    One uppercase letter
                                </li>
                                <li className={`${styles.checkItem} ${checklist.lower   ? styles.valid : ''}`}>
                                    One lowercase letter
                                </li>
                                <li className={`${styles.checkItem} ${checklist.number  ? styles.valid : ''}`}>
                                    One number
                                </li>
                                <li className={`${styles.checkItem} ${checklist.special ? styles.valid : ''}`}>
                                    One special character like `! @ # $ % ^ & *`
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>
                                CONFIRM NEW PASSWORD <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                                type="password"
                                className={`${styles.inputField} ${passErrors.confirmPassword ? styles.errorBorder : ''}`}
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePassChange}
                                disabled={!isCurrentPasswordVerified || isSubmittingPass}
                                placeholder="Re-enter new password"
                            />
                            {passErrors.confirmPassword && (
                                <span className={styles.errorText}>{passErrors.confirmPassword}</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.buttonGroup} style={{ borderTop: 'none', marginTop: 0 }}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={
                                !isCurrentPasswordVerified ||
                                !allCriteriaMet ||
                                passwordData.newPassword !== passwordData.confirmPassword ||
                                isSamePassword ||
                                isSubmittingPass
                            }
                        >
                            {isSubmittingPass ? 'UPDATING...' : 'UPDATE PASSWORD'}
                        </button>
                    </div>
                </div>
            </form>

        </div>
    );

    // ── Render: Notifications tab ─────────────────────────────────────────────
    const renderNotifications = () => (
        <form onSubmit={handleSaveNotifications}>
            <h3 className={styles.mainSectionTitle}>Notification Preferences</h3>
            <p className={styles.sectionDescription}>
                Choose which in-app alerts appear in your notification feed.
            </p>

            {notifSuccess && <div className={styles.successMessage}>{notifSuccess}</div>}
            {notifError   && <div className={styles.apiErrorMessage}>{notifError}</div>}

            {/* Appointment Alerts */}
            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Appointment Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when patients book, cancel, or when appointments are coming up
                        (same-day and 1-day reminders).
                    </span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={notifications.appointmentAlerts}
                        onChange={() => toggleNotif('appointmentAlerts')}
                    />
                    <span className={styles.slider} />
                </label>
            </div>

            {/* Chat / Escalation Alerts */}
            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Chat Escalation Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when a patient is transferred from the AI chatbot to a live
                        chat session that requires my response.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={notifications.chatAlerts}
                        onChange={() => toggleNotif('chatAlerts')}
                    />
                    <span className={styles.slider} />
                </label>
            </div>

            {/* Queue Alerts */}
            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Queue Event Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me about queue state changes, such as when the next patient in
                        line has not checked in within the configured time window.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={notifications.queueAlerts}
                        onChange={() => toggleNotif('queueAlerts')}
                    />
                    <span className={styles.slider} />
                </label>
            </div>

            {/* Patient Registration Alerts */}
            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Patient Registration Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when a newly registered patient completes account activation
                        and is fully onboarded in the branch.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={notifications.patientAlerts}
                        onChange={() => toggleNotif('patientAlerts')}
                    />
                    <span className={styles.slider} />
                </label>
            </div>

            <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn}>
                    SAVE NOTIFICATIONS
                </button>
            </div>
        </form>
    );

    // ── Render: Account Overview tab ──────────────────────────────────────────
    const renderOverview = () => {
        const secName = profile?.name?.first
            ? `${profile.name.first} ${profile.name.last || ''}`.trim()
            : user?.name?.first
                ? `${user.name.first} ${user.name.last || ''}`.trim()
                : 'Secretary';

        const createdAt = profile?.createdAt
            ? new Date(profile.createdAt).toLocaleDateString('en-PH', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            : '—';

        const lastLogin = profile?.lastLogin
            ? new Date(profile.lastLogin).toLocaleString('en-PH', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : '—';

        const branch = profile?.branch?.name || profile?.branchName || '—';

        return (
            <div>
                <h3 className={styles.mainSectionTitle}>Account Overview</h3>
                <p className={styles.sectionDescription}>
                    Read-only summary of your account details.
                </p>

                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>FULL NAME</label>
                        <input
                            type="text"
                            className={styles.inputField}
                            value={secName}
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>EMAIL ADDRESS</label>
                        <input
                            type="email"
                            className={styles.inputField}
                            value={profile?.email || user?.email || '—'}
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>ROLE</label>
                        <input
                            type="text"
                            className={styles.inputField}
                            value="Secretary"
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>ASSIGNED BRANCH</label>
                        <input
                            type="text"
                            className={styles.inputField}
                            value={branch}
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>ACCOUNT CREATED</label>
                        <input
                            type="text"
                            className={styles.inputField}
                            value={createdAt}
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>LAST LOGIN</label>
                        <input
                            type="text"
                            className={styles.inputField}
                            value={lastLogin}
                            readOnly
                            style={{ cursor: 'default', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '24px 0' }} />
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                    To update your name or contact number, please contact your Branch Manager or System Administrator.
                    Email address is read-only and serves as your account identifier.
                </p>
            </div>
        );
    };

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Account Settings</h1>
                    <p className={styles.subtitle}>
                        Manage your security credentials and notification settings.
                    </p>
                </div>
            </div>

            <div className={styles.settingsLayout}>
                {/* Tab sidebar */}
                <div className={styles.sidebar}>
                    <ul className={styles.tabList}>
                        {[
                            { key: 'security',      label: 'Account Security'         },
                            { key: 'notifications', label: 'Notification Preferences' },
                            { key: 'overview',      label: 'Account Overview'         },
                        ].map(t => (
                            <li
                                key={t.key}
                                className={`${styles.tabItem} ${activeTab === t.key ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(t.key)}
                            >
                                {t.label}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Content area */}
                <div className={styles.contentArea}>
                    {activeTab === 'security'      && renderSecurity()}
                    {activeTab === 'notifications' && renderNotifications()}
                    {activeTab === 'overview'      && renderOverview()}
                </div>
            </div>

            {/* Password change success modal */}
            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle} style={{ color: '#15803d' }}>
                            Password Updated
                        </h3>
                        <p className={styles.modalMessage}>
                            Your password has been changed successfully.
                            <br /><br />
                            For your security, you will now be logged out. Please log back in
                            with your new password.
                        </p>
                        <button className={styles.modalButton} onClick={handleModalClose}>
                            Close &amp; Log Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
