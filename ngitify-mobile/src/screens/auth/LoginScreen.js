import React, { useState, useRef, useContext } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import LogoGreenPink from '../../assets/images/logo-dentime.svg';
import LoginBg from '../../assets/images/login-bg.svg';

const { width, height } = Dimensions.get('window');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [isLoading, setIsLoading]   = useState(false);
    const [emailError, setEmailError] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const passwordRef = useRef(null);
    const { login } = useContext(AuthContext);

    const handleLogin = async () => {
        // Reset errors
        setEmailError('');
        setLoginError('');

        // Field-level validation
        const emailIsEmpty = !email.trim();
        const passwordIsEmpty = !password;

        if (emailIsEmpty) setEmailError('Email address is required.');
        if (passwordIsEmpty) setLoginError('Password is required.');
        if (emailIsEmpty || passwordIsEmpty) return;

        if (!EMAIL_REGEX.test(email.trim())) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await login(email.trim(), password);
            if (!result.success) {
                setLoginError(result.message || 'Login failed. Please try again.');
            }
        } catch (err) {
            setLoginError('Unable to connect to the server. Please check your internet connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.bgContainer}>
                <LoginBg width={width} height={height} preserveAspectRatio="xMidYMid slice" />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={{ flex: 1 }} />

                <View style={styles.formContainer}>
                    <View style={styles.logoWrapper}>
                        <LogoGreenPink width={350} height={80} />
                    </View>

                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.subText}>Sign in to continue</Text>

                    {/* Email */}
                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor="#aaa"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        textContentType="none"
                        importantForAutofill="no"
                        value={email}
                        onChangeText={(text) => { setEmail(text); setEmailError(''); }}
                        editable={!isLoading}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                    {emailError !== '' && (
                        <Text style={styles.errorText}>{emailError}</Text>
                    )}

                    {/* Password */}
                    <View style={styles.passwordWrapper}>
                        <TextInput
                            ref={passwordRef}
                            style={styles.passwordInput}
                            placeholder="Password"
                            placeholderTextColor="#aaa"
                            secureTextEntry={!showPassword}
                            autoComplete="off"
                            textContentType="none"
                            importantForAutofill="no"
                            value={password}
                            onChangeText={(text) => { setPassword(text); setLoginError(''); }}
                            editable={!isLoading}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                        />
                        <TouchableOpacity
                            style={styles.eyeBtn}
                            onPress={() => setShowPassword(v => !v)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={22}
                                color="#aaa"
                            />
                        </TouchableOpacity>
                    </View>
                    {loginError !== '' && (
                        <Text style={styles.errorText}>{loginError}</Text>
                    )}

                    <TouchableOpacity
                        style={styles.forgotPassword}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text style={styles.loginButtonText}>LOGIN</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f7f9'
    },
    bgContainer: {
        position: 'absolute',
        width: width,
        height: height,
        top: 0,
        left: 0
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-end'
    },
    formContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 30,
        paddingBottom: 50,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5
    },
    logoWrapper: {
        alignItems: 'center',
        marginBottom: 20
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#01538b',
        marginBottom: 5
    },
    subText: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 15,
        marginBottom: 5,
        borderWidth: 1,
        borderColor: '#eee',
        fontSize: 16,
        color: '#333'
    },
    passwordWrapper: {
        position: 'relative',
        marginBottom: 5,
    },
    passwordInput: {
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 15,
        paddingRight: 50,
        borderWidth: 1,
        borderColor: '#eee',
        fontSize: 16,
        color: '#333'
    },
    eyeBtn: {
        position: 'absolute',
        right: 15,
        top: 15,
    },
    errorText: {
        color: '#d9534f',
        fontSize: 12,
        marginBottom: 12,
        marginTop: 4,
        marginLeft: 5
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 25,
        marginTop: 10,
    },
    forgotPasswordText: {
        color: '#01538b',
        fontWeight: 'bold',
        fontSize: 14
    },
    loginButton: {
        backgroundColor: '#01538b',
        borderRadius: 50,
        padding: 18,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#01538b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    loginButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16
    }
});
