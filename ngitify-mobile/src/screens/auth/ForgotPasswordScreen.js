import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';
import CustomModal from '../../components/CustomModal';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const validateEmail = (emailText) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(emailText)) return false;
        
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        const domain = emailText.split('@')[1]?.toLowerCase();
        return allowedDomains.includes(domain);
    };

    const handleEmailChange = (text) => {
        const sanitized = text.replace(/\s/g, '');
        setEmail(sanitized);
        
        if (sanitized.length > 0 && !validateEmail(sanitized)) {
            setEmailError('Please enter a valid email address (e.g. gmail, yahoo).');
        } else {
            setEmailError('');
        }
    };

    const handleSendLink = () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setModalVisible(true);
        }, 1500);
    };

    const isFormValid = email.trim() !== '' && emailError === '';

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#005466', marginRight: 5 }} />
                    <Text style={styles.backText}>Back to Login</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subTitle}>Enter the email address associated with your account and we'll send you a link to reset your password.</Text>

                <TextInput 
                    style={[styles.input, emailError ? styles.inputError : null]} 
                    placeholder="e.g. juan@gmail.com" 
                    placeholderTextColor="#aaa"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={handleEmailChange}
                    editable={!isLoading}
                />
                {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}

                <TouchableOpacity 
                    style={[styles.submitBtn, (!isFormValid || isLoading) && styles.submitBtnDisabled]} 
                    onPress={handleSendLink}
                    disabled={!isFormValid || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={[styles.submitBtnText, !isFormValid && {color: '#999'}]}>SEND RESET LINK</Text>
                    )}
                </TouchableOpacity>
            </View>

            <CustomModal 
                visible={modalVisible} 
                title="Email Sent!" 
                message={`A password reset link has been sent to ${email}. Please check your inbox.`} 
                type="success" 
                onClose={() => { setModalVisible(false); navigation.goBack(); }} 
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: 'white' 
    },
    header: { 
        padding: 20, 
        paddingTop: 60, 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    backBtn: { 
        padding: 5 
    },
    backText: { 
        color: '#005466', 
        fontWeight: 'bold', 
        fontSize: 16 
    },
    content: { 
        flex: 1, 
        padding: 30, 
        justifyContent: 'center', 
        paddingBottom: 100 },
    title: { 
        fontSize: 32, 
        fontWeight: 'bold', 
        color: '#005466', 
        marginBottom: 10 },
    subTitle: { 
        fontSize: 14, 
        color: '#666', 
        marginBottom: 30, 
        lineHeight: 22 
    },
    input: { 
        backgroundColor: '#f9f9f9', 
        borderRadius: 10, 
        padding: 15, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        fontSize: 16, 
        color: '#333', 
        marginBottom: 10 
    },
    inputError: { 
        borderColor: '#d9534f', 
        backgroundColor: '#fff5f5' 
    },
    errorText: { 
        color: '#d9534f', 
        fontSize: 12, 
        marginBottom: 20, 
        marginLeft: 5 
    },
    submitBtn: { 
        backgroundColor: '#01538b', 
        borderRadius: 50, 
        padding: 18, 
        alignItems: 'center', 
        marginTop: 10, 
        elevation: 3 
    },
    submitBtnDisabled: { 
        backgroundColor: '#e0e0e0', 
        elevation: 0 
    },
    submitBtnText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 16 
    }
});