import React, { useState, useContext } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, ScrollView
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoGreenPink from '../../assets/images/logo-dentime.svg';
import LoginBg from '../../assets/images/login-bg.svg';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const { login } = useContext(AuthContext);

    const handleLogin = () => {
        setLoginError('');

        if (!email || !password) {
            setLoginError('Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            const validRoles = ['owner', 'dentist', 'sec', 'patient', 'juan', 'admin']; 
            const isRecognized = validRoles.some(role => email.toLowerCase().includes(role));

            if (!isRecognized) {
                setLoginError('Incorrect email or password. Please try again.');
                setIsLoading(false);
                return;
            }

            login(email, password);
            setIsLoading(false);
        }, 1500); 
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
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

                    <TextInput 
                        style={[styles.input, loginError ? styles.inputError : null]} 
                        placeholder="Email Address" 
                        placeholderTextColor="#aaa"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={(text) => { setEmail(text); setLoginError(''); }}
                        editable={!isLoading}
                    />
                    
                    <TextInput 
                        style={[styles.input, loginError ? styles.inputError : null]} 
                        placeholder="Password" 
                        placeholderTextColor="#aaa"
                        secureTextEntry
                        value={password}
                        onChangeText={(text) => { setPassword(text); setLoginError(''); }}
                        editable={!isLoading}
                    />

                    {loginError !== '' && (
                        <Text style={styles.errorText}>{loginError}</Text>
                    )}

                    <TouchableOpacity style={styles.forgotPassword} onPress={() => navigation.navigate('ForgotPassword')}>
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
        backgroundColor: 
        '#f3f7f9' 
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
        marginBottom: 15, 
        borderWidth: 1, 
        borderColor: '#eee', 
        fontSize: 16, 
        color: '#333' 
    },
    inputError: { 
        borderColor: '#d9534f', 
        backgroundColor: '#fff5f5' 
    },
    errorText: { 
        color: '#d9534f', 
        fontSize: 12, 
        marginBottom: 15, 
        marginTop: -5, 
        marginLeft: 5 
    },
    forgotPassword: { 
        alignSelf: 'flex-end', 
        marginBottom: 25 
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