import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Alert,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Modal,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Image,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';
import BackIcon from '../../assets/icons/Back.svg';
import { Ionicons } from '@expo/vector-icons';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

// ─── Password rule checker (mirrors the website exactly) ─────────────────────
const getChecklist = (pw) => ({
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
});

const RULES = [
    { key: 'length',  label: 'At least 8 characters' },
    { key: 'upper',   label: 'One uppercase letter (A-Z)' },
    { key: 'lower',   label: 'One lowercase letter (a-z)' },
    { key: 'number',  label: 'One number (0-9)' },
    { key: 'special', label: 'One special character like ! @ # $ % ^ & *' },
];

export default function SettingsScreen({ navigation }) {
    const { logout, userToken, userId, userInfo, API_BASE_URL } = useContext(AuthContext);

    // ── Session ──
    const [isLogoutVisible, setIsLogoutVisible] = useState(false);

    // ── Settings state ──
    const [
        notifAppointments,
        setNotifAppointments,
    ] = useState(true);

    const [
        notifVisitWindow,
        setNotifVisitWindow,
    ] = useState(true);

    const [
        notifOralHealthDaily,
        setNotifOralHealthDaily,
    ] = useState(true);

    const [
        notifSymptomFollowUp,
        setNotifSymptomFollowUp,
    ] = useState(true);

    const [
        notifHealthTips,
        setNotifHealthTips,
    ] = useState(true);

    const [
        oralHealthReminderTime,
        setOralHealthReminderTime,
    ] = useState('20:00');

    const [
        educationConsent,
        setEducationConsent,
    ] = useState(false);

    // ── Loading states ──
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingKey,       setSavingKey]       = useState(null);

    // ── Change Password modal state ──
    const [pwModalVisible,  setPwModalVisible]  = useState(false);

    // Step 1: verify current password
    const [currentPassword,         setCurrentPassword]         = useState('');
    const [showCurrent,             setShowCurrent]             = useState(false);
    const [isVerifying,             setIsVerifying]             = useState(false);
    const [isCurrentVerified,       setIsCurrentVerified]       = useState(false);
    const [currentPwError,          setCurrentPwError]          = useState('');

    // Step 2: new password
    const [newPassword,     setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew,         setShowNew]         = useState(false);
    const [showConfirm,     setShowConfirm]     = useState(false);
    const [checklist,       setChecklist]       = useState(getChecklist(''));
    const [allCriteriaMet,  setAllCriteriaMet]  = useState(false);
    const [pwLoading,       setPwLoading]       = useState(false);
    const [pwError,         setPwError]         = useState('');
    const [pwSuccess,       setPwSuccess]       = useState('');

    // Change Email modal state
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
    const [showEmailPassword, setShowEmailPassword] = useState(false);
    const [emailPasswordVerified, setEmailPasswordVerified] = useState(false);
    const [verifyingEmailPassword, setVerifyingEmailPassword] = useState(false);
    const [submittingEmailChange, setSubmittingEmailChange] = useState(false);
    const [emailChangeError, setEmailChangeError] = useState('');

    const authHeader = { Authorization: `Bearer ${userToken}` };

    // ── Fetch settings on mount ──────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        try {
            const res  = await fetch(`${API_BASE_URL}/api/my/settings`, { headers: authHeader });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setNotifAppointments(
                data.notifAppointments
                ?? true
            );

            setNotifVisitWindow(
                data.notifVisitWindow
                ?? true
            );

            setNotifOralHealthDaily(
                data.notifOralHealthDaily
                ?? true
            );

            setNotifSymptomFollowUp(
                data.notifSymptomFollowUp
                ?? true
            );

            setNotifHealthTips(
                data.notifHealthTips
                ?? true
            );

            setOralHealthReminderTime(
                data.oralHealthReminderTime
                || '20:00'
            );

            setEducationConsent(
                data.educationConsent
                ?? false
            );
        } catch {
            // Non-critical — use defaults
        } finally {
            setLoadingSettings(false);
        }
    }, [userToken, API_BASE_URL]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // ── Live password checklist ──────────────────────────────────────────────
    useEffect(() => {
        const checks = getChecklist(newPassword);
        setChecklist(checks);
        setAllCriteriaMet(Object.values(checks).every(Boolean));
    }, [newPassword]);

    // ── Toggle handlers ──────────────────────────────────────────────────────
        const saveToggle = async (
        key,
        value
    ) => {
        setSavingKey(key);

        try {
            const response =
                await fetch(
                    `${API_BASE_URL}/api/my/settings`,
                    {
                        method: 'PATCH',
                        headers: {
                            ...authHeader,
                            'Content-Type':
                                'application/json',
                        },
                        body:
                            JSON.stringify({
                                [key]:
                                    value,
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
                    || 'Unable to save this setting.'
                );
            }

            return true;
        } catch (error) {
            Alert.alert(
                'Setting Not Saved',
                error.message
                || 'Unable to save this setting. Please try again.'
            );

            await fetchSettings();

            return false;
        } finally {
            setSavingKey(null);
        }
    };

    const handleToggle = (
        key,
        value,
        setter
    ) => {
        setter(value);
        saveToggle(key, value);
    };

    const saveReminderTime = async () => {
        const normalized =
            String(
                oralHealthReminderTime
                || ''
            ).trim();

        if (
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/
                .test(normalized)
        ) {
            Alert.alert(
                'Invalid Reminder Time',
                'Use a valid 24-hour time in HH:MM format, for example 20:00.'
            );

            await fetchSettings();
            return;
        }

        setSavingKey(
            'oralHealthReminderTime'
        );

        try {
            const response =
                await fetch(
                    `${API_BASE_URL}/api/my/settings`,
                    {
                        method: 'PATCH',
                        headers: {
                            ...authHeader,
                            'Content-Type':
                                'application/json',
                        },
                        body:
                            JSON.stringify({
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

            setOralHealthReminderTime(
                payload
                    .oralHealthReminderTime
                || normalized
            );
        } catch (error) {
            Alert.alert(
                'Reminder Time Not Saved',
                error.message
                || 'Unable to save the reminder time. Please try again.'
            );

            await fetchSettings();
        } finally {
            setSavingKey(null);
        }
    };

    // ── Change Password flow ─────────────────────────────────────────────────
    const openPwModal = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPwError('');
        setPwError('');
        setPwSuccess('');
        setIsCurrentVerified(false);
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setPwModalVisible(true);
    };

    const closePwModal = () => {
        if (pwLoading || isVerifying) return;
        setPwModalVisible(false);
    };

    // Step 1: Verify current password against the backend
    const handleVerifyCurrentPassword = async () => {
        if (!currentPassword.trim()) {
            setCurrentPwError('Current password is required.');
            return;
        }
        setIsVerifying(true);
        setCurrentPwError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-password`, {
                method:  'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: currentPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsCurrentVerified(true);
                return;
            }
            setCurrentPwError(data.message || 'Incorrect current password.');
        } catch {
            setCurrentPwError('Unable to connect. Please check your internet connection.');
        } finally {
            setIsVerifying(false);
        }
    };

    // Step 2: Submit new password
    const handleChangePassword = async () => {
        setPwError('');
        setPwSuccess('');

        if (!allCriteriaMet) {
            setPwError('Your new password does not meet all requirements below.');
            return;
        }
        if (newPassword === currentPassword) {
            setPwError('New password must be different from your current password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError('Passwords do not match.');
            return;
        }

        setPwLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/change-password`, {
                method:  'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ userId, currentPassword, newPassword }),
            });
            const data = await res.json();

            if (res.ok) {
                setPwSuccess('Password changed. You will be logged out for security.');
                setTimeout(() => {
                    setPwModalVisible(false);
                    logout();
                }, 1800);
            } else {
                setPwError(data.message || 'Failed to update password.');
            }
        } catch {
            setPwError('Unable to connect. Please check your internet connection.');
        } finally {
            setPwLoading(false);
        }
    };

    const openEmailModal = () => {
        setNewEmail('');
        setEmailCurrentPassword('');
        setShowEmailPassword(false);
        setEmailPasswordVerified(false);
        setVerifyingEmailPassword(false);
        setSubmittingEmailChange(false);
        setEmailChangeError('');
        setEmailModalVisible(true);
    };

    const closeEmailModal = () => {
        if (verifyingEmailPassword || submittingEmailChange) return;
        setEmailModalVisible(false);
    };

    const verifyEmailPassword = async () => {
        if (!emailCurrentPassword) {
            setEmailChangeError('Current password is required.');
            return;
        }
        setVerifyingEmailPassword(true);
        setEmailChangeError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-current-password`, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, currentPassword: emailCurrentPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || 'Current password is incorrect.');
            setEmailPasswordVerified(true);
        } catch (error) {
            setEmailPasswordVerified(false);
            setEmailChangeError(error.message || 'Unable to verify your password.');
        } finally {
            setVerifyingEmailPassword(false);
        }
    };

    const requestEmailChange = async () => {
        const normalizedEmail = newEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setEmailChangeError('Enter a valid new email address.');
            return;
        }
        if (normalizedEmail === String(userInfo?.email || '').trim().toLowerCase()) {
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
            const res = await fetch(`${API_BASE_URL}/api/user/request-email-change`, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail: normalizedEmail, currentPassword: emailCurrentPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to request the email change.');
            setEmailModalVisible(false);
            Alert.alert(
                'Verification Link Sent',
                data.message || 'Check your new inbox and verify the address before signing in again.',
                [{ text: 'OK', onPress: logout }],
                { cancelable: false },
            );
        } catch (error) {
            setEmailChangeError(error.message || 'Unable to request the email change.');
        } finally {
            setSubmittingEmailChange(false);
        }
    };

    // ── Helpers ──────────────────────────────────────────────────────────────
    const displayName  = userInfo?.fullName || userInfo?.firstName || 'Patient';
    const displayEmail = userInfo?.email || '';

    const isSamePassword = newPassword.length > 0 && newPassword === currentPassword;

    const renderToggleRow = (label, sublabel, value, onValueChange, saving) => (
        <View style={styles.switchRow}>
            <View style={styles.switchLabelGroup}>
                <Text style={styles.menuText}>{label}</Text>
                {sublabel ? <Text style={styles.menuSub}>{sublabel}</Text> : null}
            </View>
            {saving
                ? <ActivityIndicator size="small" color="#01538b" style={{ marginRight: 4 }} />
                : (
                    <Switch
                        value={value}
                        onValueChange={onValueChange}
                        trackColor={{ false: '#ccc', true: '#01538b' }}
                        thumbColor={value ? '#fff' : '#f4f3f4'}
                    />
                )
            }
        </View>
    );

    // ── Main render ──────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ── Profile Summary ── */}
                <View style={styles.profileCard}>
                    {userInfo?.profileImage ? (
                        <Image source={{ uri: userInfo.profileImage }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {(userInfo?.firstName?.[0] || '?').toUpperCase()}
                                {(userInfo?.lastName?.[0]  || '').toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{displayName}</Text>
                        <Text style={styles.profileEmail}>{displayEmail}</Text>
                    </View>
                </View>

                {/* ── Account ── */}
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('MyProfileHome')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="person-outline" size={18} color="#555" style={styles.menuIcon} />
                            <Text style={styles.menuText}>View My Profile</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('EditProfile')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="create-outline" size={18} color="#555" style={styles.menuIcon} />
                            <Text style={styles.menuText}>Edit Profile Information</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={openPwModal}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.menuIcon} />
                            <Text style={styles.menuText}>Change Password</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={openEmailModal}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="mail-outline" size={18} color="#555" style={styles.menuIcon} />
                            <Text style={styles.menuText}>Change Email</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('ActivityLogs')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="document-text-outline" size={18} color="#555" style={styles.menuIcon} />
                            <Text style={styles.menuText}>Activity Logs</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Notifications ── */}
                <Text style={styles.sectionTitle}>
                    Notifications
                </Text>

                {loadingSettings ? (
                    <View style={styles.card}>
                        <ActivityIndicator
                            color="#01538b"
                            style={{
                                padding: 20,
                            }}
                        />
                    </View>
                ) : (
                    <View style={styles.card}>
                        {renderToggleRow(
                            'Appointment Alerts',
                            'Confirmations, declines, reminders, cancellations, and updates',
                            notifAppointments,
                            (value) =>
                                handleToggle(
                                    'notifAppointments',
                                    value,
                                    setNotifAppointments
                                ),
                            savingKey
                                === 'notifAppointments'
                        )}

                        <View
                            style={
                                styles.divider
                            }
                        />

                        {renderToggleRow(
                            'Recommended Visit Window Reminders',
                            'Notifications related to your current Recommended Visit Window',
                            notifVisitWindow,
                            (value) =>
                                handleToggle(
                                    'notifVisitWindow',
                                    value,
                                    setNotifVisitWindow
                                ),
                            savingKey
                                === 'notifVisitWindow'
                        )}

                        <View
                            style={
                                styles.divider
                            }
                        />

                        {renderToggleRow(
                            'Daily Oral Health Management Reminder',
                            'Remind me when today’s Daily Oral Health Log is still missing',
                            notifOralHealthDaily,
                            (value) =>
                                handleToggle(
                                    'notifOralHealthDaily',
                                    value,
                                    setNotifOralHealthDaily
                                ),
                            savingKey
                                === 'notifOralHealthDaily'
                        )}

                        {notifOralHealthDaily ? (
                            <>
                                <View
                                    style={
                                        styles.divider
                                    }
                                />

                                <View
                                    style={
                                        styles.reminderTimeRow
                                    }
                                >
                                    <View
                                        style={
                                            styles
                                                .switchLabelGroup
                                        }
                                    >
                                        <Text
                                            style={
                                                styles
                                                    .menuText
                                            }
                                        >
                                            Daily Reminder Time
                                        </Text>

                                        <Text
                                            style={
                                                styles
                                                    .menuSub
                                            }
                                        >
                                            24-hour HH:MM format. If today&apos;s log already exists, NgitiFy will not generate the missing-log reminder.
                                        </Text>
                                    </View>

                                    {savingKey
                                        === 'oralHealthReminderTime' ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#01538b"
                                            style={{
                                                marginLeft:
                                                    10,
                                            }}
                                        />
                                    ) : (
                                        <TextInput
                                            style={
                                                styles
                                                    .reminderTimeInput
                                            }
                                            value={
                                                oralHealthReminderTime
                                            }
                                            onChangeText={
                                                setOralHealthReminderTime
                                            }
                                            onEndEditing={
                                                saveReminderTime
                                            }
                                            placeholder="20:00"
                                            placeholderTextColor="#aaa"
                                            maxLength={5}
                                            keyboardType={
                                                Platform.OS
                                                === 'ios'
                                                    ? 'numbers-and-punctuation'
                                                    : 'numeric'
                                            }
                                            autoCorrect={
                                                false
                                            }
                                            accessibilityLabel="Daily Oral Health Management reminder time"
                                        />
                                    )}
                                </View>
                            </>
                        ) : null}

                        <View
                            style={
                                styles.divider
                            }
                        />

                        {renderToggleRow(
                            'Symptom Follow-Up Reminders',
                            'Non-diagnostic follow-up reminders based only on approved Oral Health Management rules',
                            notifSymptomFollowUp,
                            (value) =>
                                handleToggle(
                                    'notifSymptomFollowUp',
                                    value,
                                    setNotifSymptomFollowUp
                                ),
                            savingKey
                                === 'notifSymptomFollowUp'
                        )}

                        <View
                            style={
                                styles.divider
                            }
                        />

                        {renderToggleRow(
                            'Dental Health Education / Dental Health Tips',
                            'Approved Dental Health Education and oral-health tip notifications',
                            notifHealthTips,
                            (value) =>
                                handleToggle(
                                    'notifHealthTips',
                                    value,
                                    setNotifHealthTips
                                ),
                            savingKey
                                === 'notifHealthTips'
                        )}
                    </View>
                )}

                {/* ── Privacy & Data ── */}
                <Text style={styles.sectionTitle}>Privacy & Data</Text>
                {loadingSettings ? (
                    <View style={styles.card}>
                        <ActivityIndicator color="#01538b" style={{ padding: 20 }} />
                    </View>
                ) : (
                    <View style={styles.card}>
                        {renderToggleRow(
                            'Personalized Dental Health Education',
                            'Allow NgitiFy to use your treatment history to personalize tips',
                            educationConsent,
                            (v) => handleToggle('educationConsent', v, setEducationConsent),
                            savingKey === 'educationConsent',
                        )}
                        {!educationConsent && (
                            <View style={styles.consentNote}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="lock-closed-outline" size={13} color="#888" style={{ marginRight: 6 }} />
                                    <Text style={styles.consentNoteText}>Off — you'll receive general dental tips only.</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Application ── */}
                <Text style={styles.sectionTitle}>Application</Text>
                <View style={styles.card}>
                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="information-circle-outline" size={18} color="#555" style={styles.menuIcon} />
                            <View>
                                <Text style={styles.menuText}>About NgitiFy</Text>
                                <Text style={styles.menuSub}>Dentime Dental Clinic · v1.0.0</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Logout ── */}
                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => setIsLogoutVisible(true)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>


            {/* ── Logout Modal ── */}
            <LogoutModal
                visible={isLogoutVisible}
                onCancel={() => setIsLogoutVisible(false)}
                onConfirm={logout}
            />

            {/* ── Change Password Modal ── */}
            <Modal
                visible={pwModalVisible}
                transparent
                animationType="slide"
                onRequestClose={closePwModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalSheet}>

                        {/* Modal header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <TouchableOpacity
                                onPress={closePwModal}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>

                            {/* ── STEP 1: Verify current password ── */}
                            {!isCurrentVerified ? (
                                <>
                                    <View style={styles.stepBadge}>
                                        <Text style={styles.stepBadgeText}>Step 1 of 2 — Verify Identity</Text>
                                    </View>

                                    <Text style={styles.inputLabel}>Current Password</Text>
                                    <View style={[
                                        styles.pwInputRow,
                                        currentPwError ? styles.pwInputError : null,
                                    ]}>
                                        <TextInput
                                            style={styles.pwInput}
                                            value={currentPassword}
                                            onChangeText={(v) => { setCurrentPassword(v); setCurrentPwError(''); }}
                                            secureTextEntry={!showCurrent}
                                            placeholder="Enter your current password"
                                            placeholderTextColor="#bbb"
                                            editable={!isVerifying}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                                            <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" /> 
                                        </TouchableOpacity>
                                    </View>

                                    {currentPwError ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="warning-outline" size={13} color="#c62828" style={{ marginRight: 4 }} />
                                            <Text style={styles.fieldError}>{currentPwError}</Text>
                                        </View>
                                    ) : null}

                                    <TouchableOpacity
                                        style={[styles.pwSubmitBtn, isVerifying && styles.pwSubmitDisabled]}
                                        onPress={handleVerifyCurrentPassword}
                                        disabled={isVerifying}
                                        activeOpacity={0.8}
                                    >
                                        {isVerifying
                                            ? <ActivityIndicator color="white" />
                                            : <Text style={styles.pwSubmitText}>Verify & Continue →</Text>
                                        }
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    {/* ── STEP 2: Set new password ── */}
                                    <View style={[styles.stepBadge, styles.stepBadgeSuccess]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="checkmark-circle-outline" size={14} color="#2e7d32" style={{ marginRight: 6 }} />
                                            <Text style={[styles.stepBadgeText, { color: '#2e7d32' }]}>Step 2 of 2 — Set New Password</Text>
                                        </View>
                                    </View>

                                    {/* New Password */}
                                    <Text style={styles.inputLabel}>New Password</Text>
                                    <View style={[
                                        styles.pwInputRow,
                                        (isSamePassword || !allCriteriaMet && newPassword.length > 0) ? styles.pwInputError : null,
                                    ]}>
                                        <TextInput
                                            style={styles.pwInput}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showNew}
                                            placeholder="Create a strong password"
                                            placeholderTextColor="#bbb"
                                            editable={!pwLoading}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                                            <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                                        </TouchableOpacity>
                                    </View>

                                    {isSamePassword && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="warning-outline" size={13} color="#c62828" style={{ marginRight: 4 }} />
                                            <Text style={styles.fieldError}>New password cannot be the same as your current password.</Text>
                                        </View>
                                    )}

                                    {/* Live checklist */}
                                    {newPassword.length > 0 && (
                                        <View style={styles.checklistBox}>
                                            <Text style={styles.checklistTitle}>Password must contain:</Text>
                                            {RULES.map(rule => (
                                                <View key={rule.key} style={styles.checkItem}>
                                                    <Text style={checklist[rule.key] ? styles.checkDotValid : styles.checkDotInvalid}>
                                                        {checklist[rule.key] ? '✓' : '●'}
                                                    </Text>
                                                    <Text style={checklist[rule.key] ? styles.checkTextValid : styles.checkTextInvalid}>
                                                        {rule.label}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Confirm New Password */}
                                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                                    <View style={[
                                        styles.pwInputRow,
                                        (confirmPassword.length > 0 && newPassword !== confirmPassword) ? styles.pwInputError : null,
                                    ]}>
                                        <TextInput
                                            style={styles.pwInput}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry={!showConfirm}
                                            placeholder="Re-enter new password"
                                            placeholderTextColor="#bbb"
                                            editable={!pwLoading}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                                            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                                        </TouchableOpacity>
                                    </View>

                                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="warning-outline" size={13} color="#c62828" style={{ marginRight: 4 }} />
                                            <Text style={styles.fieldError}>Passwords do not match.</Text>
                                        </View>                                    
                                    )}

                                    {/* Error / Success */}
                                    {pwError ? (
                                        <View style={styles.pwMessage}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="warning-outline" size={13} color="#c62828" style={{ marginRight: 4 }} />
                                                <Text style={styles.pwError}>{pwError}</Text>
                                            </View>
                                        </View>
                                    ) : null}
                                    {pwSuccess ? (
                                        <View style={[styles.pwMessage, styles.pwSuccessBox]}>
                                            <Text style={styles.pwSuccessText}>{pwSuccess}</Text>
                                        </View>
                                    ) : null}

                                    {/* Submit */}
                                    <TouchableOpacity
                                        style={[
                                            styles.pwSubmitBtn,
                                            (!allCriteriaMet || isSamePassword || newPassword !== confirmPassword || pwLoading)
                                                && styles.pwSubmitDisabled,
                                        ]}
                                        onPress={handleChangePassword}
                                        disabled={!allCriteriaMet || isSamePassword || newPassword !== confirmPassword || pwLoading}
                                        activeOpacity={0.8}
                                    >
                                        {pwLoading
                                            ? <ActivityIndicator color="white" />
                                            : <Text style={styles.pwSubmitText}>Update Password</Text>
                                        }
                                    </TouchableOpacity>
                                </>
                            )}

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                visible={emailModalVisible}
                transparent
                animationType="slide"
                onRequestClose={closeEmailModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Email Address</Text>
                            <TouchableOpacity onPress={closeEmailModal} disabled={verifyingEmailPassword || submittingEmailChange}>
                                <Text style={styles.modalClose}>×</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.emailChangeNotice}>
                                Verify your current password, then we will send an activation link to your new email. You will be logged out after the request succeeds.
                            </Text>
                            <Text style={styles.inputLabel}>New Email Address</Text>
                            <TextInput
                                style={styles.emailInput}
                                value={newEmail}
                                onChangeText={(value) => {
                                    setNewEmail(value.replace(/\s/g, ''));
                                    setEmailChangeError('');
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!submittingEmailChange}
                                placeholder="Enter your new email"
                                placeholderTextColor="#aaa"
                            />
                            <Text style={styles.inputLabel}>Current Password</Text>
                            <View style={styles.pwInputRow}>
                                <TextInput
                                    style={styles.pwInput}
                                    value={emailCurrentPassword}
                                    onChangeText={(value) => {
                                        setEmailCurrentPassword(value);
                                        setEmailPasswordVerified(false);
                                        setEmailChangeError('');
                                    }}
                                    secureTextEntry={!showEmailPassword}
                                    editable={!verifyingEmailPassword && !submittingEmailChange}
                                    placeholder="Enter current password"
                                    placeholderTextColor="#aaa"
                                />
                                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowEmailPassword((current) => !current)}>
                                    <Ionicons name={showEmailPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#777" />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={[styles.emailVerifyButton, (!emailCurrentPassword || emailPasswordVerified) && styles.disabledButton]}
                                onPress={verifyEmailPassword}
                                disabled={!emailCurrentPassword || emailPasswordVerified || verifyingEmailPassword || submittingEmailChange}
                            >
                                {verifyingEmailPassword ? <ActivityIndicator size="small" color="#01538b" /> : (
                                    <Text style={styles.emailVerifyButtonText}>{emailPasswordVerified ? 'Password Verified' : 'Verify Password'}</Text>
                                )}
                            </TouchableOpacity>
                            {emailChangeError ? <Text style={styles.modalErrorText}>{emailChangeError}</Text> : null}
                            {emailPasswordVerified ? <Text style={styles.modalSuccessText}>Password verified.</Text> : null}
                            <TouchableOpacity
                                style={[styles.emailSubmitButton, (!emailPasswordVerified || !newEmail.trim() || submittingEmailChange) && styles.disabledButton]}
                                onPress={requestEmailChange}
                                disabled={!emailPasswordVerified || !newEmail.trim() || submittingEmailChange}
                            >
                                {submittingEmailChange ? <ActivityIndicator color="#fff" /> : <Text style={styles.emailSubmitButtonText}>Send Verification Link</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    header: {
        backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    profileCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 16, padding: 18, marginBottom: 20, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 3,
    },
    avatar: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: '#01538b',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    avatarImage: {
        width: 52, height: 52, borderRadius: 26, marginRight: 14,
        backgroundColor: '#d9e6ef',
    },
    avatarText:   { color: 'white', fontSize: 18, fontWeight: 'bold' },
    profileInfo:  { flex: 1 },
    profileName:  { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 3 },
    profileEmail: { fontSize: 13, color: '#888' },

    content: { padding: 16, paddingBottom: 132 },

    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: '#888',
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 8, marginTop: 4,
    },

    card: {
        backgroundColor: 'white', borderRadius: 15, elevation: 2, marginBottom: 20,
        paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3,
    },

    menuItem:      {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center',
    },
    menuItemLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
    menuText:      { fontSize: 15, color: '#333', fontWeight: '500' },
    menuSub:       { fontSize: 12, color: '#aaa', marginTop: 1 },
    arrow:         { fontSize: 22, color: '#ccc' },
    divider:       { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 18 },

    switchRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center',
    },
    switchLabelGroup: {
        flex: 1,
        paddingRight: 10,
    },

    reminderTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 13,
        paddingHorizontal: 18,
    },

    reminderTimeInput: {
        width: 78,
        minHeight: 42,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#d5e9f4',
        borderRadius: 10,
        backgroundColor: '#f7fbfd',
        color: '#17364a',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },

    consentNote: {
        backgroundColor: '#f9f9f9', marginHorizontal: 18,
        marginBottom: 12, padding: 10, borderRadius: 8,
    },
    consentNoteText: { fontSize: 12, color: '#999' },

    logoutBtn: {
        backgroundColor: '#ffebee', padding: 16, borderRadius: 15,
        alignItems: 'center', marginTop: 4,
        borderWidth: 1, borderColor: '#ffcdd2',
    },
    logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet:   {
        backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 36, maxHeight: '90%',
    },
    modalHeader:  {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
    },
    modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    modalClose:   { fontSize: 18, color: '#aaa', fontWeight: '600' },

    // Step badge
    stepBadge: {
        backgroundColor: '#e3f2fd', borderRadius: 8, padding: 10,
        marginBottom: 16, alignItems: 'center',
    },
    stepBadgeSuccess: { backgroundColor: '#e8f5e9' },
    stepBadgeText:    { fontSize: 13, fontWeight: '700', color: '#01538b' },

    inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },

    pwInputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f7f9',
        borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0',
        marginBottom: 8, paddingHorizontal: 14,
    },
    pwInputError: { borderColor: '#d32f2f' },
    pwInput:      { flex: 1, fontSize: 14, color: '#333', paddingVertical: 13 },
    eyeBtn:       { padding: 4 },

    fieldError: { color: '#d32f2f', fontSize: 12, marginBottom: 10, marginLeft: 2 },

    // Checklist
    checklistBox:  {
        backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12,
        marginBottom: 14, borderWidth: 1, borderColor: '#e9ecef',
    },
    checklistTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
    checkItem:      { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    checkDotValid:  { fontSize: 14, color: '#2e7d32', marginRight: 8, fontWeight: 'bold' },
    checkDotInvalid:{ fontSize: 10, color: '#bbb', marginRight: 8 },
    checkTextValid: { fontSize: 13, color: '#2e7d32', fontWeight: '500' },
    checkTextInvalid:{ fontSize: 13, color: '#aaa' },

    // Messages
    pwMessage:     { marginBottom: 12 },
    pwError:       { color: '#d32f2f', fontSize: 13 },
    pwSuccessBox:  { backgroundColor: '#e8f5e9', padding: 10, borderRadius: 8 },
    pwSuccessText: { color: '#2e7d32', fontSize: 13, fontWeight: '600' },

    pwSubmitBtn: {
        backgroundColor: '#01538b', paddingVertical: 15,
        borderRadius: 12, alignItems: 'center', marginTop: 8,
    },
    pwSubmitDisabled: { backgroundColor: '#b0bec5' },
    pwSubmitText:     { color: 'white', fontWeight: 'bold', fontSize: 16 },
    emailChangeNotice: {
        color: '#7c5a14', backgroundColor: '#fff8e1', borderRadius: 10,
        padding: 12, fontSize: 13, lineHeight: 19, marginBottom: 18,
    },
    emailInput: {
        backgroundColor: '#f3f7f9', borderRadius: 12, borderWidth: 1.5,
        borderColor: '#e0e0e0', paddingHorizontal: 14, paddingVertical: 13,
        color: '#333', fontSize: 14, marginBottom: 16,
    },
    emailVerifyButton: {
        borderWidth: 1.5, borderColor: '#01538b', borderRadius: 12,
        paddingVertical: 12, alignItems: 'center', marginBottom: 12,
        backgroundColor: '#f0f7fb',
    },
    emailVerifyButtonText: { color: '#01538b', fontWeight: '700', fontSize: 14 },
    emailSubmitButton: {
        backgroundColor: '#01538b', borderRadius: 12, paddingVertical: 15,
        alignItems: 'center', marginTop: 10,
    },
    emailSubmitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    modalErrorText: { color: '#c62828', fontSize: 12, lineHeight: 18, marginBottom: 10 },
    modalSuccessText: { color: '#2e7d32', fontSize: 12, fontWeight: '600', marginBottom: 8 },
    disabledButton: { opacity: 0.5 },
});
