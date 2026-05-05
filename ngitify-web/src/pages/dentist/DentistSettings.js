import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AdminSettings.module.css';

export default function DentistSettings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('security');

    // ── Security state ────────────────────────────────────────────────────────
    const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passErrors, setPassErrors] = useState({});
    const [apiError, setApiError] = useState('');
    const [isSubmittingPass, setIsSubmittingPass] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [checklist, setChecklist] = useState({
        length: false, upper: false, lower: false, number: false, special: false,
    });
    const [allCriteriaMet, setAllCriteriaMet] = useState(false);

    // ── Preferences state ─────────────────────────────────────────────────────
    const [theme, setTheme] = useState('system');
    const [prefSuccess, setPrefSuccess] = useState('');

    // ── Notification Preferences state ────────────────────────────────────────
    const [notifications, setNotifications] = useState({
        scheduleAlerts: true,
        materialAlerts: true,
        patientAlerts:  true,
    });
    const [notifSuccess, setNotifSuccess] = useState('');
    const [notifError,   setNotifError]   = useState('');
    const [profile, setProfile] = useState(null);
    const passwordChangeDeadline = profile?.temporaryPasswordExpires ? new Date(profile.temporaryPasswordExpires) : null;
    const needsPasswordChange = profile && profile.isPasswordChanged === false && passwordChangeDeadline && !Number.isNaN(passwordChangeDeadline.getTime());

    // ── Load saved theme ──────────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('ngitify-theme') || 'system';
        setTheme(saved);
    }, []);

    // ── Load notification preferences from backend ────────────────────────────
    useEffect(() => {
        const fetchPrefs = async () => {
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
                            scheduleAlerts: p.scheduleAlerts ?? true,
                            materialAlerts: p.materialAlerts ?? true,
                            patientAlerts:  p.patientAlerts  ?? true,
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to load notification preferences:', err);
            }
        };
        fetchPrefs();
    }, [user]);

    // ── Password checklist ────────────────────────────────────────────────────
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

    const handlePassChange = (e) => {
        const { name, value } = e.target;
        if (passErrors[name]) setPassErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        setApiError('');
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleVerifyCurrentPassword = async () => {
        if (!passwordData.currentPassword) { setPassErrors({ currentPassword: 'Required to verify' }); return; }
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

    const isSamePassword = passwordData.newPassword && passwordData.newPassword === passwordData.currentPassword;

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!isCurrentPasswordVerified || !allCriteriaMet) return;
        if (isSamePassword) { setPassErrors({ newPassword: 'New password cannot be the same as the current password.' }); return; }
        if (passwordData.newPassword !== passwordData.confirmPassword) { setPassErrors({ confirmPassword: 'Passwords do not match.' }); return; }
        setIsSubmittingPass(true);
        setApiError('');
        try {
            const userId = user?.userId || user?.id || user?._id;
            const res = await authFetch('/change-password', {
                method: 'POST',
                body: JSON.stringify({ userId, currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }),
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

    const handleSavePreferences = (e) => {
        e.preventDefault();
        localStorage.setItem('ngitify-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        setPrefSuccess('Display preferences saved.');
        setTimeout(() => setPrefSuccess(''), 3000);
    };

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

    const toggle = (key) => setNotifications(prev => ({ ...prev, [key]: !prev[key] }));

    // ── Render sections ───────────────────────────────────────────────────────
    const renderSecurity = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Security</h3>

            {needsPasswordChange && (
                <div className={styles.securityNotice}>
                    <p className={styles.securityNoticeTitle}>Password change required</p>
                    <p className={styles.securityNoticeText}>
                        You are still using your temporary password. Please change it as soon as possible.
                        Your account will be marked inactive if you do not change it before {passwordChangeDeadline.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
                    </p>
                </div>
            )}

            {apiError && <div className={styles.apiErrorMessage}>{apiError}</div>}

            <form onSubmit={handlePasswordSubmit} noValidate>
                {/* Step 1 — Verify current password */}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>CURRENT PASSWORD <span style={{ color: 'red' }}>*</span></label>
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
                        {passErrors.currentPassword && <span className={styles.errorText}>{passErrors.currentPassword}</span>}
                    </div>
                </div>

                {/* Steps 2–3 — New password */}
                <div style={{ opacity: isCurrentPasswordVerified ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>NEW PASSWORD <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="password"
                                className={`${styles.inputField} ${passErrors.newPassword || isSamePassword ? styles.errorBorder : ''}`}
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePassChange}
                                disabled={!isCurrentPasswordVerified || isSubmittingPass}
                                placeholder="Enter new password"
                            />
                            {isSamePassword
                                ? <span className={styles.errorText}>New password cannot be the same as the current password.</span>
                                : passErrors.newPassword && <span className={styles.errorText}>{passErrors.newPassword}</span>
                            }
                            <ul className={styles.checklist} style={{ marginTop: '10px' }}>
                                <li className={`${styles.checkItem} ${checklist.length  ? styles.valid : ''}`}>At least 8 characters</li>
                                <li className={`${styles.checkItem} ${checklist.upper   ? styles.valid : ''}`}>One uppercase letter</li>
                                <li className={`${styles.checkItem} ${checklist.lower   ? styles.valid : ''}`}>One lowercase letter</li>
                                <li className={`${styles.checkItem} ${checklist.number  ? styles.valid : ''}`}>One number</li>
                                <li className={`${styles.checkItem} ${checklist.special ? styles.valid : ''}`}>One special character</li>
                            </ul>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CONFIRM NEW PASSWORD <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="password"
                                className={`${styles.inputField} ${passErrors.confirmPassword ? styles.errorBorder : ''}`}
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePassChange}
                                disabled={!isCurrentPasswordVerified || isSubmittingPass}
                                placeholder="Re-enter new password"
                            />
                            {passErrors.confirmPassword && <span className={styles.errorText}>{passErrors.confirmPassword}</span>}
                        </div>
                    </div>
                    <div className={styles.buttonGroup} style={{ borderTop: 'none', marginTop: 0 }}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={!isCurrentPasswordVerified || !allCriteriaMet || passwordData.newPassword !== passwordData.confirmPassword || isSamePassword || isSubmittingPass}
                        >
                            {isSubmittingPass ? 'UPDATING...' : 'UPDATE PASSWORD'}
                        </button>
                    </div>
                </div>
            </form>

        </div>
    );

    const renderPreferences = () => (
        <form onSubmit={handleSavePreferences}>
            <h3 className={styles.mainSectionTitle}>Display Preferences</h3>
            <p className={styles.sectionDescription}>Customize how the portal looks on your device.</p>
            {prefSuccess && <div className={styles.successMessage}>{prefSuccess}</div>}
            <div className={styles.row}>
                <div className={styles.formGroup}>
                    <label>THEME</label>
                    <select className={styles.inputField} value={theme} onChange={e => setTheme(e.target.value)}>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                        <option value="system">System Default</option>
                    </select>
                </div>
            </div>
            <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn}>SAVE PREFERENCES</button>
            </div>
        </form>
    );

    const renderNotifications = () => (
        <form onSubmit={handleSaveNotifications}>
            <h3 className={styles.mainSectionTitle}>Notification Preferences</h3>
            <p className={styles.sectionDescription}>
                Choose which alerts appear in your notification feed.
            </p>

            {notifSuccess && <div className={styles.successMessage}>{notifSuccess}</div>}
            {notifError   && <div className={styles.apiErrorMessage}>{notifError}</div>}

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Schedule Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when appointments are booked, rescheduled, or cancelled — and same-day reminders.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.scheduleAlerts} onChange={() => toggle('scheduleAlerts')} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Material Low-Stock Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when a frequently used inventory item falls below the reorder threshold.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.materialAlerts} onChange={() => toggle('materialAlerts')} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Patient Update Alerts</span>
                    <span className={styles.toggleDesc}>
                        Notify me when a patient is assigned to me, arrives at the clinic, or updates their profile.
                    </span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.patientAlerts} onChange={() => toggle('patientAlerts')} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn}>SAVE NOTIFICATIONS</button>
            </div>
        </form>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Account Settings</h1>
                    <p className={styles.subtitle}>Manage your security credentials and notification preferences.</p>
                </div>
            </div>

            <div className={styles.settingsLayout}>
                {/* Tab sidebar */}
                <div className={styles.sidebar}>
                    <ul className={styles.tabList}>
                        {[
                            { key: 'security',      label: 'Account Security'         },
                            { key: 'preferences',   label: 'Preferences'              },
                            { key: 'notifications', label: 'Notification Preferences' },
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
                    {activeTab === 'preferences'   && renderPreferences()}
                    {activeTab === 'notifications' && renderNotifications()}
                </div>
            </div>

            {/* Password change success modal */}
            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle} style={{ color: '#15803d' }}>Password Updated</h3>
                        <p className={styles.modalMessage}>
                            Your password has been changed successfully.<br /><br />
                            For your security, you will now be logged out. Please log back in with your new password.
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
