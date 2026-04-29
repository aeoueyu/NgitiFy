import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert
} from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';
import CustomModal from '../../components/CustomModal';
import { API_BASE_URL } from '../../context/AuthContext';

// ─── Steps ───────────────────────────────────────────────────────────────────
// 1 = Enter email  →  2 = Enter OTP  →  3 = Set new password
// ─────────────────────────────────────────────────────────────────────────────

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

    // Step 3
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError]     = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);

    // Shared
    const [isLoading, setIsLoading]       = useState(false);
    const [successModal, setSuccessModal] = useState(false);

    // ─── Helpers ─────────────────────────────────────────────────────────────
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

    // ─── Step 1: Send OTP ────────────────────────────────────────────────────
    const handleSendCode = async () => {
        if (!validateEmail(email.trim())) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        setEmailError('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() }),
            });
            // Backend always returns 200 (never reveals if email exists)
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

    // ─── Step 2: Resend OTP ──────────────────────────────────────────────────
    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setOtp('');
        setOtpError('');
        setIsLoading(true);
        try {
            await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() }),
            });
            startCooldown();
        } catch {
            Alert.alert('Error', 'Could not resend code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Step 2: Verify OTP ──────────────────────────────────────────────────
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

    // ─── Step 3: Reset Password ──────────────────────────────────────────────
    const handleResetPassword = async () => {
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }
        setPasswordError('');
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

    // ─── Renders ─────────────────────────────────────────────────────────────

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

    const renderStep3 = () => (
        <>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subTitle}>
                Choose a strong password for your account. It must be at least 8 characters.
            </Text>

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.passwordWrapper}>
                <TextInput
                    style={[styles.passwordInput, passwordError ? styles.inputError : null]}
                    placeholder="Enter new password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showNew}
                    value={newPassword}
                    onChangeText={(text) => { setNewPassword(text); setPasswordError(''); }}
                    editable={!isLoading}
                    returnKeyType="next"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)}>
                    <Text style={styles.eyeText}>{showNew ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Confirm Password</Text>
            <View style={styles.passwordWrapper}>
                <TextInput
                    style={[styles.passwordInput, passwordError ? styles.inputError : null]}
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
                    <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
            </View>

            {passwordError !== '' && <Text style={styles.errorText}>{passwordError}</Text>}

            <TouchableOpacity
                style={[
                    styles.primaryBtn,
                    (!newPassword || !confirmPassword || isLoading) && styles.primaryBtnDisabled
                ]}
                onPress={handleResetPassword}
                disabled={!newPassword || !confirmPassword || isLoading}
            >
                {isLoading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={styles.primaryBtnText}>RESET PASSWORD</Text>
                }
            </TouchableOpacity>
        </>
    );

    // ─── Step Progress Indicator ──────────────────────────────────────────────
    const renderProgress = () => (
        <View style={styles.progressRow}>
            {[1, 2, 3].map(n => (
                <View key={n} style={styles.progressItem}>
                    <View style={[styles.progressDot, step >= n && styles.progressDotActive]}>
                        <Text style={[styles.progressNum, step >= n && styles.progressNumActive]}>
                            {step > n ? '✓' : n}
                        </Text>
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
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} style={{ color: '#005466', marginRight: 5 }} />
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
    header: { padding: 20, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
    backBtn: { padding: 5 },
    backText: { color: '#005466', fontWeight: 'bold', fontSize: 16 },

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
    eyeText: { fontSize: 18 },

    errorText: { color: '#d9534f', fontSize: 12, marginBottom: 15, marginLeft: 5 },

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