import React from 'react';

import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    Ionicons,
} from '@expo/vector-icons';

import PatientOnboardingShell
    from '../../components/onboarding/PatientOnboardingShell';

import {
    OnboardingFooterActions,
    OnboardingInfoCard,
} from '../../components/onboarding/PatientOnboardingControls';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

export default function OnboardingLoadErrorScreen({
    message,
    onRetry,
    onContinue,
    isRetrying = false,
}) {
    return (
        <PatientOnboardingShell
            showProgress={false}
            footer={
                <OnboardingFooterActions
                    primaryLabel="Try Again"
                    primaryIcon="refresh"
                    onPrimaryPress={
                        onRetry
                    }
                    primaryLoading={
                        isRetrying
                    }
                    secondaryLabel="Continue to Dashboard"
                    onSecondaryPress={
                        onContinue
                    }
                    secondaryDisabled={
                        isRetrying
                    }
                />
            }
            accessibilityLabel="Onboarding connection error"
        >
            <View
                style={
                    styles.content
                }
            >
                <View
                    style={
                        styles.icon
                    }
                    accessible={false}
                    importantForAccessibility="no"
                >
                    <Ionicons
                        name="cloud-offline-outline"
                        size={42}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primary
                        }
                    />
                </View>

                <Text
                    style={
                        styles.title
                    }
                    accessibilityRole="header"
                >
                    We couldn't load your onboarding information
                </Text>

                <Text
                    style={
                        styles.body
                    }
                >
                    Your NgitiFy account and core Patient features are still available.
                </Text>

                <OnboardingInfoCard
                    icon="information-circle-outline"
                    title="Your information is safe"
                    body={
                        message
                        || 'The onboarding service could not be reached. You can retry now or continue to your Dashboard for this session.'
                    }
                />

                <Text
                    style={
                        styles.note
                    }
                >
                    If your onboarding is still incomplete, NgitiFy may offer it again the next time your account successfully connects.
                </Text>
            </View>
        </PatientOnboardingShell>
    );
}

const styles =
    StyleSheet.create({
        content: {
            flexGrow: 1,

            justifyContent:
                'center',

            gap:
                patientOnboardingTheme
                    .spacing
                    .lg,

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .xl,
        },

        icon: {
            width: 80,
            height: 80,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .xl,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,
        },

        title: {
            ...patientOnboardingTheme
                .typography
                .title,

            color:
                patientOnboardingTheme
                    .colors
                    .text,
        },

        body: {
            ...patientOnboardingTheme
                .typography
                .subtitle,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,
        },

        note: {
            ...patientOnboardingTheme
                .typography
                .small,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,
        },
    });