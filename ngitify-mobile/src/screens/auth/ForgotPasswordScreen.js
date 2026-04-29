import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomModal from '../../components/CustomModal';
import { API_BASE_URL } from '../../context/AuthContext';

// ─── Password rules (mirrors SettingsScreen exactly) ──────────────────────────
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
    { key: 'special', label: 'One special character (!@#$…)' },
];

export default function ForgotPasswordScreen({ navigation }) {
    const [step, setStep] = useState(1);

    // Step 1
    const [email, setEmail]           = useState('');
    const [emailError, setEmailError] = useState('');

    // Step 2
    const [otp, setOtp]               = useState('');
    const [otpError, setOtpError]     = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownRef = useRef(null);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    // Step 3
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError]     = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [checklist, setChecklist]             = useState(getChecklist(''));
    const [allCriteriaMet, setAllCriteriaMet]   = useState(false);

    // Update checklist live as user types
    useEffect(() => {
        const checks = getChecklist(newPassword);
        setChecklist(checks);
        setAllCriteriaMet(Object.values(checks).every(Boolean));
    }, [newPassword]);

    // Shared
    const [isLoading, setIsLoading]       = useState(false);
    const [successModal, setSuccessModal] = useState(false);

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const validateEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

    const startCooldown = () => {
        setResendCooldown(60);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    // ─── Step 1: Send OTP ─────────────────────────────────────────────────────
    const handleSendCode = async () => {
        if (!validateEmail(email.trim())) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        setEmailError('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() }),
            });

            if (res.status === 403) {
                const data = await res.json();
                setEmailError(data.message || 'This account can only reset its password on the web portal.');
                return;
            }

            if (res.ok) {
                startCooldown();
                setStep(2);
            } else {
                setEmailError('Something went wrong. Please try again.');
            }
        } catch {
            setEmailError('Unable to connect to the server. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Step 2: Resend OTP ───────────────────────────────────────────────────
    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setOtp('');
        setOtpError('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() }),
            });

            if (res.status === 403) {
                const data = await res.json();
                setOtpError(data.message || 'This account can only reset its password on the web portal.');
                return;
            }

            startCooldown();
        } catch {
            Alert.alert('Error', 'Could not resend code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Step 2: Verify OTP ───────────────────────────────────────────────────
    const handleVerifyOtp = async () => {
        if (otp.trim().length !== 6) {
            setOtpError('Please enter the complete 6-digit code.');
            return;
        }
        setOtpError('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim(), otp: otp.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setStep(3);
            } else {
                setOtpError(data.message || 'Invalid or expired code. Please try again.');
            }
        } catch {
            setOtpError('Unable to connect to the server. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Step 3: Reset Password ───────────────────────────────────────────────
    const handleResetPassword = async () => {
        setPasswordError('');

        if (!allCriteriaMet) {
            setPasswordError('Your password does not meet all requirements below.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim(), newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessModal(true);
            } else {
                setPasswordError(data.message || 'Reset failed. Please request a new code.');
            }
        } catch {
            setPasswordError('Unable to connect to the server. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Step renders ──────────────────────────────────────────────────────────

    const renderStep1 = () => (
        <>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subTitle}>
                Enter your account email address and we'll send you a 6-digit verification code.
            </Text>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="e.g. juan@gmail.com"
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => { setEmail(text.replace(/\s/g, '')); setEmailError(''); }}
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
            />
            {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}

            <TouchableOpacity
                style={[styles.primaryBtn, (!email.trim() || isLoading) && styles.primaryBtnDisabled]}
                onPress={handleSendCode}
                disabled={!email.trim() || isLoading}
            >
                {isLoading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={styles.primaryBtnText}>SEND VERIFICATION CODE</Text>
                }
            </TouchableOpacity>
        </>
    );

    const renderStep2 = () => (
        <>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subTitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.emailHighlight}>{email}</Text>.
                {' '}Enter it below. The code expires in 1 hour.
            </Text>

            <Text style={styles.fieldLabel}>Verification Code</Text>
            <TextInput
                style={[styles.otpInput, otpError ? styles.inputError : null]}
                placeholder="000000"
                placeholderTextColor="#bbb"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(text) => { setOtp(text); setOtpError(''); }}
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
            />
            {otpError !== '' && <Text style={styles.errorText}>{otpError}</Text>}

            <TouchableOpacity
                style={[styles.primaryBtn, (otp.length !== 6 || isLoading) && styles.primaryBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6 || isLoading}
            >
                {isLoading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={styles.primaryBtnText}>VERIFY CODE</Text>
                }
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.resendRow}
                onPress={handleResend}
                disabled={resendCooldown > 0 || isLoading}
            >
                <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextMuted]}>
                    {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : "Didn't receive the code? Resend"
                    }
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.changeEmailRow}
                onPress={() => { setStep(1); setOtp(''); setOtpError(''); }}
            >
                <Text style={styles.changeEmailText}>← Change email address</Text>
            </TouchableOpacity>
        </>
    );

    const renderStep3 = () => {
        const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
        const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
        const isSubmitDisabled = !allCriteriaMet || passwordsMismatch || !confirmPassword || isLoading;

        return (
            <>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subTitle}>
                    Choose a strong password that meets all the requirements below.
                </Text>

                {/* New Password */}
                <Text style={styles.fieldLabel}>New Password</Text>
                <View style={styles.passwordWrapper}>
                    <TextInput
                        style={[
                            styles.passwordInput,
                            newPassword.length > 0 && !allCriteriaMet ? styles.inputError : null,
                            newPassword.length > 0 && allCriteriaMet ? styles.inputValid : null,
                        ]}
                        placeholder="Enter new password"
                        placeholderTextColor="#aaa"
                        secureTextEntry={!showNew}
                        value={newPassword}
                        onChangeText={(text) => { setNewPassword(text); setPasswordError(''); }}
                        editable={!isLoading}
                        returnKeyType="next"
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)}>
                        <Ionicons
                            name={showNew ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                {/* Live checklist — shown as soon as user starts typing */}
                {newPassword.length > 0 && (
                    <View style={styles.checklistBox}>
                        <Text style={styles.checklistTitle}>Password must contain:</Text>
                        {RULES.map(rule => (
                            <View key={rule.key} style={styles.checkItem}>
                                <Ionicons
                                    name={checklist[rule.key] ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={16}
                                    color={checklist[rule.key] ? '#2e7d32' : '#bbb'}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={checklist[rule.key] ? styles.checkTextValid : styles.checkTextInvalid}>
                                    {rule.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Confirm Password */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Confirm Password</Text>
                <View style={styles.passwordWrapper}>
                    <TextInput
                        style={[
                            styles.passwordInput,
                            passwordsMismatch ? styles.inputError : null,
                            passwordsMatch    ? styles.inputValid  : null,
                        ]}
                        placeholder="Re-enter new password"
                        placeholderTextColor="#aaa"
                        secureTextEntry={!showConfirm}
                        value={confirmPassword}
                        onChangeText={(text) => { setConfirmPassword(text); setPasswordError(''); }}
                        editable={!isLoading}
                        returnKeyType="done"
                        onSubmitEditing={handleResetPassword}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                        <Ionicons
                            name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                {/* Inline mismatch hint */}
                {passwordsMismatch && (
                    <View style={styles.inlineError}>
                        <Ionicons name="warning-outline" size={13} color="#d9534f" style={{ marginRight: 4 }} />
                        <Text style={styles.inlineErrorText}>Passwords do not match.</Text>
                    </View>
                )}

                {/* General error (e.g. server error) */}
                {passwordError !== '' && (
                    <Text style={styles.errorText}>{passwordError}</Text>
                )}

                <TouchableOpacity
                    style={[styles.primaryBtn, isSubmitDisabled && styles.primaryBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={isSubmitDisabled}
                >
                    {isLoading
                        ? <ActivityIndicator color="white" size="small" />
                        : <Text style={styles.primaryBtnText}>RESET PASSWORD</Text>
                    }
                </TouchableOpacity>
            </>
        );
    };

    // ─── Step Progress Indicator ───────────────────────────────────────────────
    const renderProgress = () => (
        <View style={styles.progressRow}>
            {[1, 2, 3].map(n => (
                <View key={n} style={styles.progressItem}>
                    <View style={[styles.progressDot, step >= n && styles.progressDotActive]}>
                        {step > n ? (
                            <Ionicons name="checkmark" size={16} color="white" />
                        ) : (
                            <Text style={[styles.progressNum, step >= n && styles.progressNumActive]}>
                                {n}
                            </Text>
                        )}
                    </View>
                    {n < 3 && <View style={[styles.progressLine, step > n && styles.progressLineActive]} />}
                </View>
            ))}
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}
                    style={styles.backBtn}
                >
                    <Ionicons name="arrow-back-outline" size={20} color="#01538b" />
                    <Text style={styles.backText}>
                        {step > 1 ? 'Back' : 'Back to Login'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {renderProgress()}

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </ScrollView>

            <CustomModal
                visible={successModal}
                title="Password Reset!"
                message="Your password has been reset successfully. You can now log in with your new password."
                type="success"
                onClose={() => {
                    setSuccessModal(false);
                    navigation.navigate('Login');
                }}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: {
        padding: 20,
        paddingTop: 60,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        gap: 6,
    },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },

    content: { flexGrow: 1, padding: 30, paddingBottom: 60 },

    // Progress
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 35, alignSelf: 'center' },
    progressItem: { flexDirection: 'row', alignItems: 'center' },
    progressDot: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center'
    },
    progressDotActive: { backgroundColor: '#01538b' },
    progressNum: { fontSize: 13, fontWeight: 'bold', color: '#aaa' },
    progressNumActive: { color: 'white' },
    progressLine: { width: 40, height: 2, backgroundColor: '#eee', marginHorizontal: 4 },
    progressLineActive: { backgroundColor: '#01538b' },

    // Text
    title: { fontSize: 28, fontWeight: 'bold', color: '#005466', marginBottom: 10 },
    subTitle: { fontSize: 14, color: '#666', marginBottom: 25, lineHeight: 22 },
    emailHighlight: { fontWeight: 'bold', color: '#01538b' },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },

    // Inputs
    input: {
        backgroundColor: '#f9f9f9', borderRadius: 10, padding: 15,
        borderWidth: 1, borderColor: '#ddd', fontSize: 16, color: '#333', marginBottom: 10
    },
    inputError: { borderColor: '#d9534f', backgroundColor: '#fff5f5' },
    inputValid:  { borderColor: '#2e7d32', backgroundColor: '#f1f8f1' },
    otpInput: {
        backgroundColor: '#f9f9f9', borderRadius: 12, padding: 18,
        borderWidth: 1.5, borderColor: '#ddd', fontSize: 28, color: '#01538b',
        letterSpacing: 10, textAlign: 'center', marginBottom: 10, fontWeight: 'bold'
    },
    passwordWrapper: { position: 'relative', marginBottom: 10 },
    passwordInput: {
        backgroundColor: '#f9f9f9', borderRadius: 10, padding: 15,
        paddingRight: 50, borderWidth: 1, borderColor: '#ddd', fontSize: 16, color: '#333'
    },
    eyeBtn: { position: 'absolute', right: 15, top: 15 },

    errorText: { color: '#d9534f', fontSize: 12, marginBottom: 15, marginLeft: 5 },

    inlineError: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 2 },
    inlineErrorText: { color: '#d9534f', fontSize: 12 },

    // Checklist (mirrors SettingsScreen)
    checklistBox: {
        backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12,
        marginBottom: 14, borderWidth: 1, borderColor: '#e9ecef',
    },
    checklistTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
    checkItem:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    checkTextValid: { fontSize: 13, color: '#2e7d32', fontWeight: '500' },
    checkTextInvalid: { fontSize: 13, color: '#aaa' },

    // Buttons
    primaryBtn: {
        backgroundColor: '#01538b', borderRadius: 50, padding: 18,
        alignItems: 'center', marginTop: 10, elevation: 3,
        shadowColor: '#01538b', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 5
    },
    primaryBtnDisabled: { backgroundColor: '#e0e0e0', elevation: 0 },
    primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    resendRow: { alignItems: 'center', marginTop: 18 },
    resendText: { color: '#01538b', fontWeight: '600', fontSize: 14 },
    resendTextMuted: { color: '#aaa' },

    changeEmailRow: { alignItems: 'center', marginTop: 12 },
    changeEmailText: { color: '#888', fontSize: 13 },
});