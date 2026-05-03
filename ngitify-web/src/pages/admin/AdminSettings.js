import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/AdminSettings.module.css';

export default function Settings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('security');

    // --- State: Security ---
    const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passErrors, setPassErrors] = useState({});
    const [apiError, setApiError] = useState('');
    const [isSubmittingPass, setIsSubmittingPass] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Password Checklist State
    const [checklist, setChecklist] = useState({
        length: false,
        upper: false,
        lower: false,
        number: false,
        special: false
    });
    const [allCriteriaMet, setAllCriteriaMet] = useState(false);

    // --- State: Preferences & Notifications ---
    const [theme, setTheme] = useState('system');
    const [prefSuccess, setPrefSuccess] = useState('');

    const [notifications, setNotifications] = useState({
        emailAppointments: true,
        dailySummary: false,
        criticalAlerts: true
    });
    const [notifSuccess, setNotifSuccess] = useState('');

    // Load saved theme preference from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('ngitify-theme') || 'system';
        setTheme(savedTheme);
    }, []);

    // Load notification preferences from backend on mount
    useEffect(() => {
        const fetchNotifPrefs = async () => {
            try {
                const userId = user?.userId || user?.id || user?._id;
                if (!userId) return;
                const res = await authFetch(`/user/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.notificationPreferences) {
                        setNotifications({
                            emailAppointments: data.notificationPreferences.emailAppointments ?? true,
                            dailySummary:      data.notificationPreferences.dailySummary      ?? false,
                            criticalAlerts:    data.notificationPreferences.criticalAlerts    ?? true,
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to load notification preferences:', err);
            }
        };
        fetchNotifPrefs();
    }, [user]);

    // ==========================================
    // SECURITY: PASSWORD VALIDATION & LOGIC
    // ==========================================
    
    // Evaluate checklist whenever newPassword changes
    useEffect(() => {
        const pw = passwordData.newPassword;
        const checks = {
            length: pw.length >= 8,
            upper: /[A-Z]/.test(pw),
            lower: /[a-z]/.test(pw),
            number: /[0-9]/.test(pw),
            special: /[^A-Za-z0-9]/.test(pw)
        };
        setChecklist(checks);
        setAllCriteriaMet(Object.values(checks).every(Boolean));
    }, [passwordData.newPassword]);

    const handlePassChange = (e) => {
        const { name, value } = e.target;
        if (passErrors[name]) {
            setPassErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
        setApiError('');
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    // STEP 1: Verify Current Password
    const handleVerifyCurrentPassword = async () => {
        if (!passwordData.currentPassword) {
            setPassErrors({ currentPassword: "Required to verify" });
            return;
        }

        setIsVerifying(true);
        setApiError('');
        setPassErrors({});

        try {
            const userId = user?.userId || user?.id || user?._id;
            if (!userId) { setApiError("Authentication token missing."); setIsVerifying(false); return; }

            const response = await authFetch('/verify-current-password', {
                method: 'POST',
                body: JSON.stringify({
                    userId: userId,
                    currentPassword: passwordData.currentPassword
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setIsCurrentPasswordVerified(true);
            } else {
                setPassErrors({ currentPassword: data.message || "Incorrect current password." });
            }
        } catch (error) {
            setApiError("Cannot connect to server to verify password.");
        } finally {
            setIsVerifying(false);
        }
    };

    // Derived Validation Rule
    const isSamePassword = passwordData.newPassword && passwordData.newPassword === passwordData.currentPassword;

    // STEP 3: Submit New Password
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        
        if (!isCurrentPasswordVerified) return;
        if (!allCriteriaMet) {
            setApiError("Please ensure all password requirements are met.");
            return;
        }
        if (isSamePassword) {
            setPassErrors({ newPassword: "New password cannot be the same as the current password." });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPassErrors({ confirmPassword: "Passwords do not match." });
            return;
        }
        
        setIsSubmittingPass(true);
        setApiError('');

        try {
            const userId = user?.userId || user?.id || user?._id;

            const response = await authFetch('/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    userId: userId,
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Success: Show Modal instead of immediate logout
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setShowSuccessModal(true);
            } else {
                setApiError(data.message || "Failed to change password.");
            }
        } catch (error) {
            setApiError("Cannot connect to server.");
        } finally {
            setIsSubmittingPass(false);
        }
    };

    // STEP 4: Handle Modal Close (Logout)
    const handleModalClose = () => {
        setShowSuccessModal(false);
        logout();
        navigate('/login', { state: { message: 'Password changed successfully. Please log in again.' } });
    };

    const handleSavePreferences = () => {
        localStorage.setItem('ngitify-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        setPrefSuccess('Display preferences saved successfully.');
        setTimeout(() => setPrefSuccess(''), 3000);
    };
    
    const handleSaveNotifications = async (e) => {
        e.preventDefault();
        try {
            const res = await authFetch('/user/notification-preferences', {
                method: 'PUT',
                body: JSON.stringify(notifications),
            });
            const data = await res.json();
            if (res.ok) {
                setNotifSuccess('Notification preferences saved successfully.');
                setTimeout(() => setNotifSuccess(''), 3000);
            } else {
                setNotifSuccess('');
                setApiError(data.message || 'Failed to save notification preferences.');
                setTimeout(() => setApiError(''), 4000);
            }
        } catch (err) {
            setApiError('Cannot connect to server.');
            setTimeout(() => setApiError(''), 4000);
        }
    };

    // ==========================================
    // RENDER HELPERS
    // ==========================================
    const renderSecuritySection = () => (
        <div>
            <h3 className={styles.mainSectionTitle}>Account Security</h3>
            <p className={styles.sectionDescription}>Ensure your account is secure with a strong password and multi-factor authentication.</p>
            
            {apiError && <div className={styles.apiErrorMessage}>{apiError}</div>}

            {/* Change Password Form */}
            <form onSubmit={handlePasswordSubmit} noValidate>
                
                {/* STEP 1: Current Password Verification */}
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label>CURRENT PASSWORD <span style={{color: 'red'}}>*</span></label>
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

                <div style={{ opacity: isCurrentPasswordVerified ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>NEW PASSWORD <span style={{color: 'red'}}>*</span></label>
                            <input 
                                type="password"
                                className={`${styles.inputField} ${passErrors.newPassword || isSamePassword ? styles.errorBorder : ''}`} 
                                name="newPassword" 
                                value={passwordData.newPassword} 
                                onChange={handlePassChange} 
                                disabled={!isCurrentPasswordVerified || isSubmittingPass}
                                placeholder="Enter new password"
                            />
                            {/* Validation Text Check */}
                            {isSamePassword ? (
                                <span className={styles.errorText}>New password cannot be the same as the current password.</span>
                            ) : passErrors.newPassword ? (
                                <span className={styles.errorText}>{passErrors.newPassword}</span>
                            ) : null}

                            {/* Password Checklist */}
                            <ul className={styles.checklist} style={{ marginTop: '10px' }}>
                                <li className={`${styles.checkItem} ${checklist.length ? styles.valid : ''}`}>At least 8 characters</li>
                                <li className={`${styles.checkItem} ${checklist.upper ? styles.valid : ''}`}>One uppercase letter</li>
                                <li className={`${styles.checkItem} ${checklist.lower ? styles.valid : ''}`}>One lowercase letter</li>
                                <li className={`${styles.checkItem} ${checklist.number ? styles.valid : ''}`}>One number</li>
                                <li className={`${styles.checkItem} ${checklist.special ? styles.valid : ''}`}>One special character</li>
                            </ul>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CONFIRM NEW PASSWORD <span style={{color: 'red'}}>*</span></label>
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

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '30px 0' }} />

            {/* Two-Factor Authentication — Not Yet Implemented */}
            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Two-Factor Authentication (2FA)</span>
                    <span className={styles.toggleDesc}>Two-factor authentication is not yet available. This feature is coming in a future update.</span>
                </div>
            </div>
        </div>
    );

    const renderPreferencesSection = () => (
        <form onSubmit={handleSavePreferences}>
            <h3 className={styles.mainSectionTitle}>Display Preferences</h3>
            <p className={styles.sectionDescription}>Customize how the dashboard looks on your device.</p>
            
            {prefSuccess && <div className={styles.successMessage}>{prefSuccess}</div>}

            <div className={styles.row}>
                <div className={styles.formGroup}>
                    <label>THEME</label>
                    <select 
                        className={styles.inputField} 
                        value={theme} 
                        onChange={(e) => setTheme(e.target.value)}
                    >
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                        <option value="system">System Default</option>
                    </select>
                </div>
            </div>
            
            <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn}>
                    SAVE PREFERENCES
                </button>
            </div>
        </form>
    );

    const renderNotificationsSection = () => (
        <form onSubmit={handleSaveNotifications}>
            <h3 className={styles.mainSectionTitle}>Notification Settings</h3>
            <p className={styles.sectionDescription}>Choose what alerts you want to receive directly to your email.</p>
            
            {notifSuccess && <div className={styles.successMessage}>{notifSuccess}</div>}

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>New Appointments</span>
                    <span className={styles.toggleDesc}>Receive an email when a patient books a new appointment.</span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.emailAppointments} onChange={() => setNotifications({...notifications, emailAppointments: !notifications.emailAppointments})} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Daily Summary Reports</span>
                    <span className={styles.toggleDesc}>Get a summary of the day's schedules and revenue every evening.</span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.dailySummary} onChange={() => setNotifications({...notifications, dailySummary: !notifications.dailySummary})} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.toggleRow}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Critical System Alerts</span>
                    <span className={styles.toggleDesc}>Receive alerts for low inventory and unauthorized login attempts.</span>
                </div>
                <label className={styles.switch}>
                    <input type="checkbox" checked={notifications.criticalAlerts} onChange={() => setNotifications({...notifications, criticalAlerts: !notifications.criticalAlerts})} />
                    <span className={styles.slider}></span>
                </label>
            </div>

            <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn}>
                    SAVE NOTIFICATIONS
                </button>
            </div>
        </form>
    );

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.subtitle}>Manage your account security, preferences, and notifications.</p>
                </div>
            </div>

            <div className={styles.settingsLayout}>
                {/* Left Sidebar Menu */}
                <div className={styles.sidebar}>
                    <ul className={styles.tabList}>
                        <li 
                            className={`${styles.tabItem} ${activeTab === 'security' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            Account Security
                        </li>
                        <li 
                            className={`${styles.tabItem} ${activeTab === 'preferences' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('preferences')}
                        >
                            Preferences
                        </li>
                        <li 
                            className={`${styles.tabItem} ${activeTab === 'notifications' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('notifications')}
                        >
                            Notifications
                        </li>
                    </ul>
                </div>

                {/* Main Content Area */}
                <div className={styles.contentArea}>
                    {activeTab === 'security' && renderSecuritySection()}
                    {activeTab === 'preferences' && renderPreferencesSection()}
                    {activeTab === 'notifications' && renderNotificationsSection()}
                </div>
            </div>

            {/* Success Modal - Forces Logout on Close */}
            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle} style={{ color: '#15803d' }}>Success!</h3>
                        <p className={styles.modalMessage}>
                            Your password has been successfully changed.<br/><br/>
                            For your security, you will now be logged out. Please log back in with your new password.
                        </p>
                        <button className={styles.modalButton} onClick={handleModalClose}>Close & Log Out</button>
                    </div>
                </div>
            )}
        </div>
    );
}
