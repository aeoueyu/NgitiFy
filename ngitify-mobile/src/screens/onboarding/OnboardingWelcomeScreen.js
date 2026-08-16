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

export default function OnboardingWelcomeScreen({
    navigation,
}) {
    const handleGetStarted =
        () => {
            navigation.navigate(
                'OnboardingPreferredName'
            );
        };

    return (
        <PatientOnboardingShell
            showProgress={false}
            footer={
                <OnboardingFooterActions
                    primaryLabel="Get Started"
                    primaryIcon="arrow-forward"
                    onPrimaryPress={
                        handleGetStarted
                    }
                />
            }
            accessibilityLabel="Welcome to NgitiFy onboarding"
        >
            <View
                style={
                    styles.hero
                }
            >
                <View
                    style={
                        styles.decorativeArea
                    }
                    importantForAccessibility="no"
                    accessibilityElementsHidden
                >
                    <View
                        style={[
                            styles.decorativeBubble,
                            styles.decorativeBubbleLarge,
                        ]}
                    />

                    <View
                        style={[
                            styles.decorativeBubble,
                            styles.decorativeBubbleSmall,
                        ]}
                    />

                    <Ionicons
                        name="sparkles-outline"
                        size={24}
                        color={
                            patientOnboardingTheme
                                .colors
                                .accentDark
                        }
                        style={
                            styles.sparkle
                        }
                    />
                </View>

                <View
                    style={
                        styles.iconContainer
                    }
                >
                    <Ionicons
                        name="happy-outline"
                        size={48}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primary
                        }
                    />
                </View>

                <Text
                    style={
                        styles.brand
                    }
                >
                    NgitiFy
                </Text>

                <Text
                    style={
                        styles.title
                    }
                    accessibilityRole="header"
                >
                    Welcome to NgitiFy
                </Text>

                <Text
                    style={
                        styles.subtitle
                    }
                >
                    Your personal space for appointments, Oral Health Management, Dental Health Education, and everyday dental care support.
                </Text>

                <OnboardingInfoCard
                    compact
                    icon="information-circle-outline"
                    body="NgitiFy helps you track and understand your oral-health information. It does not replace professional dental diagnosis or treatment."
                    accessibilityLabel="NgitiFy information disclaimer. NgitiFy helps you track and understand your oral-health information. It does not replace professional dental diagnosis or treatment."
                />
            </View>
        </PatientOnboardingShell>
    );
}

const styles =
    StyleSheet.create({
        hero: {
            flexGrow: 1,
            justifyContent:
                'center',

            paddingTop:
                patientOnboardingTheme
                    .spacing
                    .lg,

            paddingBottom:
                patientOnboardingTheme
                    .spacing
                    .xl,
        },

        decorativeArea: {
            position:
                'absolute',

            top: 0,
            right: 0,

            width: 140,
            height: 140,
        },

        decorativeBubble: {
            position:
                'absolute',

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .accentSoft,
        },

        decorativeBubbleLarge: {
            width: 82,
            height: 82,
            right: 4,
            top: 4,
        },

        decorativeBubbleSmall: {
            width: 36,
            height: 36,
            right: 86,
            top: 78,
        },

        sparkle: {
            position:
                'absolute',

            right: 30,
            top: 31,
        },

        iconContainer: {
            width: 92,
            height: 92,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                30,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .borderStrong,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .lg,
        },

        brand: {
            ...patientOnboardingTheme
                .typography
                .eyebrow,

            color:
                patientOnboardingTheme
                    .colors
                    .primary,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        title: {
            ...patientOnboardingTheme
                .typography
                .title,

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            maxWidth: 520,
        },

        subtitle: {
            ...patientOnboardingTheme
                .typography
                .subtitle,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .md,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .xl,

            maxWidth: 560,
        },
    });