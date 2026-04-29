// src/screens/shared/SettingsScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Switch, Modal, TextInput, ActivityIndicator,
    KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';
import BackIcon from '../../assets/icons/Back.svg';

const DARK_MODE_KEY = 'ngitify_darkMode';

export default function SettingsScreen({ navigation }) {
    const { logout, userToken, userId, userInfo, API_BASE_URL } = useContext(AuthContext);

    // ── Session ──
    const [isLogoutVisible, setIsLogoutVisible] = useState(false);

    // ── Settings state ──
    const [notifAppointments, setNotifAppointments] = useState(true);
    const [notifVisitWindow,  setNotifVisitWindow]  = useState(true);
    const [notifHealthTips,   setNotifHealthTips]   = useState(true);
    const [educationConsent,  setEducationConsent]  = useState(false);
    const [darkMode,          setDarkMode]          = useState(false);

    // ── Loading states ──
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingKey,       setSavingKey]       = useState(null); // which toggle is saving

    // ── Change Password modal ──
    const [pwModalVisible,   setPwModalVisible]   = useState(false);
    const [currentPassword,  setCurrentPassword]  = useState('');
    const [newPassword,      setNewPassword]      = useState('');
    const [confirmPassword,  setConfirmPassword]  = useState('');
    const [showCurrent,      setShowCurrent]      = useState(false);
    const [showNew,          setShowNew]          = useState(false);
    const [showConfirm,      setShowConfirm]      = useState(false);
    const [pwLoading,        setPwLoading]        = useState(false);
    const [pwError,          setPwError]          = useState('');
    const [pwSuccess,        setPwSuccess]        = useState('');

    const authHeader = { Authorization: `Bearer ${userToken}` };

    // ── Fetch settings on mount ──────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        try {
            const res  = await fetch(`${API_BASE_URL}/api/my/settings`, { headers: authHeader });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setNotifAppointments(data.notifAppointments ?? true);
            setNotifVisitWindow(data.notifVisitWindow   ?? true);
            setNotifHealthTips(data.notifHealthTips     ?? true);
            setEducationConsent(data.educationConsent   ?? false);
        } catch {
            // Non-critical — use defaults
        } finally {
            setLoadingSettings(false);
        }
    }, [userToken, API_BASE_URL]);

    // Load dark mode preference from local storage
    const loadDarkMode = async () => {
        try {
            const val = await AsyncStorage.getItem(DARK_MODE_KEY);
            if (val !== null) setDarkMode(val === 'true');
        } catch {}
    };

    useEffect(() => {
        fetchSettings();
        loadDarkMode();
    }, [fetchSettings]);

    // ── Save a single toggle to the backend ─────────────────────────────────
    const saveToggle = async (key, value) => {
        setSavingKey(key);
        try {
            await fetch(`${API_BASE_URL}/api/my/settings`, {
                method:  'PATCH',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ [key]: value }),
            });
        } catch {
            // Silently fail — local state already updated optimistically
        } finally {
            setSavingKey(null);
        }
    };

    const handleToggle = (key, value, setter) => {
        setter(value);          // optimistic update
        saveToggle(key, value);
    };

    const handleDarkModeToggle = async (value) => {
        setDarkMode(value);
        try {
            await AsyncStorage.setItem(DARK_MODE_KEY, String(value));
        } catch {}
    };

    // ── Change Password ──────────────────────────────────────────────────────
    const openPwModal = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwError('');
        setPwSuccess('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setPwModalVisible(true);
    };

    const handleChangePassword = async () => {
        setPwError('');
        setPwSuccess('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPwError('All fields are required.');
            return;
        }
        if (newPassword.length < 8) {
            setPwError('New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match.');
            return;
        }
        if (newPassword === currentPassword) {
            setPwError('New password must be different from your current password.');
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
                setPwSuccess('Password updated successfully.');
                setTimeout(() => {
                    setPwModalVisible(false);
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

    // ── Helpers ──────────────────────────────────────────────────────────────
    const displayName = userInfo?.fullName || userInfo?.firstName || 'Patient';
    const displayEmail = userInfo?.email || '';

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
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >

                {/* ── Profile Summary ── */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(userInfo?.firstName?.[0] || '?').toUpperCase()}
                            {(userInfo?.lastName?.[0]  || '').toUpperCase()}
                        </Text>
                    </View>
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
                        onPress={() => navigation.navigate('EditProfile')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Text style={styles.menuIcon}>👤</Text>
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
                            <Text style={styles.menuIcon}>🔒</Text>
                            <Text style={styles.menuText}>Change Password</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Notifications ── */}
                <Text style={styles.sectionTitle}>Notifications</Text>
                {loadingSettings ? (
                    <View style={styles.card}>
                        <ActivityIndicator color="#01538b" style={{ padding: 20 }} />
                    </View>
                ) : (
                    <View style={styles.card}>
                        {renderToggleRow(
                            'Appointment Alerts',
                            'Confirmations, declines & reminders',
                            notifAppointments,
                            (v) => handleToggle('notifAppointments', v, setNotifAppointments),
                            savingKey === 'notifAppointments',
                        )}
                        <View style={styles.divider} />
                        {renderToggleRow(
                            'Visit Window Reminders',
                            'Get notified when your check-up is due',
                            notifVisitWindow,
                            (v) => handleToggle('notifVisitWindow', v, setNotifVisitWindow),
                            savingKey === 'notifVisitWindow',
                        )}
                        <View style={styles.divider} />
                        {renderToggleRow(
                            'Weekly Dental Health Tips',
                            'Educational tips sent weekly',
                            notifHealthTips,
                            (v) => handleToggle('notifHealthTips', v, setNotifHealthTips),
                            savingKey === 'notifHealthTips',
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
                            'Personalized Dental Education',
                            'Allow NgitiFy to use your treatment history to personalize tips',
                            educationConsent,
                            (v) => handleToggle('educationConsent', v, setEducationConsent),
                            savingKey === 'educationConsent',
                        )}
                        {!educationConsent && (
                            <View style={styles.consentNote}>
                                <Text style={styles.consentNoteText}>
                                    🔒 Off — you'll receive general dental tips only.
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Application ── */}
                <Text style={styles.sectionTitle}>Application</Text>
                <View style={styles.card}>
                    {renderToggleRow(
                        'Dark Mode',
                        'Stored on this device only',
                        darkMode,
                        handleDarkModeToggle,
                        false,
                    )}
                    <View style={styles.divider} />
                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <Text style={styles.menuIcon}>ℹ️</Text>
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
                onRequestClose={() => !pwLoading && setPwModalVisible(false)}
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
                                onPress={() => !pwLoading && setPwModalVisible(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Current Password */}
                        <Text style={styles.inputLabel}>Current Password</Text>
                        <View style={styles.pwInputRow}>
                            <TextInput
                                style={styles.pwInput}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry={!showCurrent}
                                placeholder="Enter current password"
                                placeholderTextColor="#bbb"
                                editable={!pwLoading}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                onPress={() => setShowCurrent(v => !v)}
                                style={styles.eyeBtn}
                            >
                                <Text style={styles.eyeIcon}>{showCurrent ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* New Password */}
                        <Text style={styles.inputLabel}>New Password</Text>
                        <View style={styles.pwInputRow}>
                            <TextInput
                                style={styles.pwInput}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNew}
                                placeholder="Min. 8 characters"
                                placeholderTextColor="#bbb"
                                editable={!pwLoading}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                onPress={() => setShowNew(v => !v)}
                                style={styles.eyeBtn}
                            >
                                <Text style={styles.eyeIcon}>{showNew ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Confirm New Password */}
                        <Text style={styles.inputLabel}>Confirm New Password</Text>
                        <View style={styles.pwInputRow}>
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
                            <TouchableOpacity
                                onPress={() => setShowConfirm(v => !v)}
                                style={styles.eyeBtn}
                            >
                                <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Error / Success messages */}
                        {pwError ? (
                            <View style={styles.pwMessage}>
                                <Text style={styles.pwError}>⚠️ {pwError}</Text>
                            </View>
                        ) : null}
                        {pwSuccess ? (
                            <View style={[styles.pwMessage, styles.pwSuccessBox]}>
                                <Text style={styles.pwSuccessText}>✅ {pwSuccess}</Text>
                            </View>
                        ) : null}

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.pwSubmitBtn, pwLoading && styles.pwSubmitDisabled]}
                            onPress={handleChangePassword}
                            disabled={pwLoading}
                            activeOpacity={0.8}
                        >
                            {pwLoading
                                ? <ActivityIndicator color="white" />
                                : <Text style={styles.pwSubmitText}>Update Password</Text>
                            }
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    // Header
    header: {
        backgroundColor: 'white', padding: 20, paddingTop: 50,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    // Profile card
    profileCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'white', borderRadius: 16,
        padding: 18, marginBottom: 20, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 3,
    },
    avatar: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: '#01538b', justifyContent: 'center',
        alignItems: 'center', marginRight: 14,
    },
    avatarText:   { color: 'white', fontSize: 18, fontWeight: 'bold' },
    profileInfo:  { flex: 1 },
    profileName:  { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 3 },
    profileEmail: { fontSize: 13, color: '#888' },

    // Scroll content
    content: { padding: 16 },

    // Section labels
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: '#888',
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 8, marginTop: 4,
    },

    // Cards
    card: {
        backgroundColor: 'white', borderRadius: 15,
        elevation: 2, marginBottom: 20, paddingVertical: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3,
    },

    // Menu rows
    menuItem: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center',
    },
    menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    menuIcon:     { fontSize: 18, marginRight: 12 },
    menuText:     { fontSize: 15, color: '#333', fontWeight: '500' },
    menuSub:      { fontSize: 12, color: '#aaa', marginTop: 1 },
    arrow:        { fontSize: 22, color: '#ccc' },
    divider:      { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 18 },

    // Toggle rows
    switchRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center',
    },
    switchLabelGroup: { flex: 1, paddingRight: 10 },

    // Consent note
    consentNote: {
        backgroundColor: '#f9f9f9', marginHorizontal: 18,
        marginBottom: 12, padding: 10, borderRadius: 8,
    },
    consentNoteText: { fontSize: 12, color: '#999' },

    // Logout
    logoutBtn: {
        backgroundColor: '#ffebee', padding: 16, borderRadius: 15,
        alignItems: 'center', marginTop: 4,
        borderWidth: 1, borderColor: '#ffcdd2',
    },
    logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },

    // Change Password Modal
    modalOverlay: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalSheet: {
        backgroundColor: 'white', borderTopLeftRadius: 24,
        borderTopRightRadius: 24, padding: 24, paddingBottom: 36,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    modalClose:  { fontSize: 18, color: '#aaa', fontWeight: '600' },

    inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },

    pwInputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f3f7f9', borderRadius: 12,
        borderWidth: 1.5, borderColor: '#e0e0e0',
        marginBottom: 14, paddingHorizontal: 14,
    },
    pwInput:  { flex: 1, fontSize: 14, color: '#333', paddingVertical: 13 },
    eyeBtn:   { padding: 4 },
    eyeIcon:  { fontSize: 18 },

    pwMessage:     { marginBottom: 12 },
    pwError:       { color: '#d32f2f', fontSize: 13 },
    pwSuccessBox:  { backgroundColor: '#e8f5e9', padding: 10, borderRadius: 8 },
    pwSuccessText: { color: '#2e7d32', fontSize: 13, fontWeight: '600' },

    pwSubmitBtn: {
        backgroundColor: '#01538b', paddingVertical: 15,
        borderRadius: 12, alignItems: 'center', marginTop: 4,
    },
    pwSubmitDisabled: { backgroundColor: '#b0bec5' },
    pwSubmitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});