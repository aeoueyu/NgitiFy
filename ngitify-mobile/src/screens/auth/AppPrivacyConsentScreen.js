import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';

const PRIVACY_VERSION = 'v1.0';
const PRIVACY_UPDATED_AT = 'May 3, 2026';
const PRIVACY_SECTIONS = [
    {
        heading: 'Why we collect data',
        body: 'NgitiFy Dental Clinic collects appointment and patient information to manage bookings, coordinate patient care, maintain treatment records, and send important clinic communications.',
    },
    {
        heading: 'What data may be used',
        body: 'This may include your contact information, branch and schedule preferences, patient registration details, treatment-related records, and account activity needed for patient services.',
    },
    {
        heading: 'Your privacy rights',
        body: 'Your information is processed in line with Republic Act No. 10173 or the Data Privacy Act of 2012. You may raise privacy concerns or request corrections to inaccurate personal data through the clinic.',
    },
];

export default function AppPrivacyConsentScreen() {
    const { userToken, API_BASE_URL, refreshUserInfo } = useContext(AuthContext);
    const [isSaving, setIsSaving] = useState(false);

    const handleAgree = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/app-consent`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify({ agreed: true }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Unable to save your privacy consent right now.');
            }
            await refreshUserInfo();
        } catch (error) {
            Alert.alert('Consent not saved', error.message || 'Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.eyebrow}>Privacy Policy</Text>
                <Text style={styles.title}>Before you continue, please review our Privacy Policy.</Text>
                <Text style={styles.meta}>Version {PRIVACY_VERSION} • Last updated {PRIVACY_UPDATED_AT}</Text>

                {PRIVACY_SECTIONS.map((section) => (
                    <View key={section.heading} style={styles.card}>
                        <Text style={styles.cardTitle}>{section.heading}</Text>
                        <Text style={styles.cardBody}>{section.body}</Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
                    onPress={handleAgree}
                    disabled={isSaving}
                    activeOpacity={0.85}
                >
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>I Agree and Continue</Text>}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#f4f9fc',
    },
    content: {
        padding: 24,
        gap: 16,
    },
    eyebrow: {
        color: '#01538b',
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 24,
    },
    title: {
        fontSize: 28,
        lineHeight: 36,
        fontWeight: '800',
        color: '#0b3958',
    },
    meta: {
        color: '#5d7485',
        marginBottom: 8,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#dce8ef',
    },
    cardTitle: {
        color: '#0b3958',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 8,
    },
    cardBody: {
        color: '#36566d',
        lineHeight: 22,
    },
    primaryButton: {
        marginTop: 12,
        backgroundColor: '#01538b',
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
});
