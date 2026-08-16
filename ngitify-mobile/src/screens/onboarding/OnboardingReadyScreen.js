import React, {
    useState,
} from 'react';

import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
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
    usePatientOnboarding,
} from '../../context/PatientOnboardingContext';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

export default function OnboardingReadyScreen({
    navigation,
}) {
    const {
        displayName,
        isCompleting,
        error,
        completeOnboarding,
    } = usePatientOnboarding();

    const [
        destination,
        setDestination,
    ] = useState(null);

    const finishOnboarding =
        async (
            nextDestination
        ) => {
            if (
                isCompleting
            ) {
                return;
            }

            setDestination(
                nextDestination
            );

            try {
                /*
                 * Successful completion updates the shared
                 * backend onboarding state. AppNavigator then
                 * automatically replaces the onboarding flow
                 * with the Patient application.
                 *
                 * The destination tells PatientTabs which
                 * initial Patient screen to display.
                 */
                await completeOnboarding(
                    nextDestination
                );
            } catch (
                completionError
            ) {
                setDestination(
                    null
                );

                Alert.alert(
                    'Onboarding not completed',
                    completionError?.message
                    || 'Your answers are still saved. Please try again.'
                );
            }
        };

    const patientName =
        String(
            displayName
            || ''
        ).trim();

    return (
        <PatientOnboardingShell
            showProgress={false}
            footer={
                <OnboardingFooterActions
                    primaryLabel="Go to Dashboard"
                    primaryIcon="home-outline"
                    onPrimaryPress={
                        () =>
                            finishOnboarding(
                                'dashboard'
                            )
                    }
                    primaryLoading={
                        isCompleting
                        && destination
                            === 'dashboard'
                    }
                    primaryDisabled={
                        isCompleting
                    }
                />
            }
            accessibilityLabel="NgitiFy onboarding completion screen"
        >
            <View
                style={
                    styles.content
                }
            >
                <View
                    style={
                        styles.completeIcon
                    }
                    accessible={false}
                    importantForAccessibility="no"
                >
                    <View
                        style={
                            styles.completeInner
                        }
                    >
                        <Ionicons
                            name="checkmark"
                            size={44}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .surface
                            }
                        />
                    </View>
                </View>

                <Text
                    style={
                        styles.title
                    }
                    accessibilityRole="header"
                >
                    {patientName
                        ? `You're all set, ${patientName}!`
                        : `You're all set!`}
                </Text>

                <Text
                    style={
                        styles.subtitle
                    }
                >
                    NgitiFy is ready to help you manage your appointments, Oral Health Management, Dental Health Education, and everyday dental-care information.
                </Text>

                <View
                    style={
                        styles.summaryCard
                    }
                >
                    <View
                        style={
                            styles.summaryRow
                        }
                    >
                        <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />

                        <Text
                            style={
                                styles.summaryText
                            }
                        >
                            Keep appointments and recommended visits easier to follow.
                        </Text>
                    </View>

                    <View
                        style={
                            styles.summaryRow
                        }
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={20}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />

                        <Text
                            style={
                                styles.summaryText
                            }
                        >
                            Use Oral Health Management for date-specific daily check-ins.
                        </Text>
                    </View>

                    <View
                        style={
                            styles.summaryRow
                        }
                    >
                        <Ionicons
                            name="book-outline"
                            size={20}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />

                        <Text
                            style={
                                styles.summaryText
                            }
                        >
                            Explore approved Dental Health Education.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.logButton,

                        isCompleting
                        && styles
                            .logButtonDisabled,
                    ]}
                    onPress={
                        () =>
                            finishOnboarding(
                                'oral-health'
                            )
                    }
                    disabled={
                        isCompleting
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Log Today's Oral Health"
                    accessibilityState={{
                        disabled:
                            isCompleting,

                        busy:
                            isCompleting
                            && destination
                                === 'oral-health',
                    }}
                >
                    <View
                        style={
                            styles.logButtonIcon
                        }
                    >
                        {isCompleting
                        && destination
                            === 'oral-health' ? (
                            <Ionicons
                                name="hourglass-outline"
                                size={20}
                                color={
                                    patientOnboardingTheme
                                        .colors
                                        .primary
                                }
                            />
                        ) : (
                            <Ionicons
                                name="add"
                                size={22}
                                color={
                                    patientOnboardingTheme
                                        .colors
                                        .primary
                                }
                            />
                        )}
                    </View>

                    <View
                        style={
                            styles.logButtonTextArea
                        }
                    >
                        <Text
                            style={
                                styles.logButtonTitle
                            }
                        >
                            Log Today's Oral Health
                        </Text>

                        <Text
                            style={
                                styles.logButtonDescription
                            }
                        >
                            Open the existing Oral Health Management Today experience.
                        </Text>
                    </View>

                    <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primary
                        }
                    />
                </TouchableOpacity>

                <OnboardingInfoCard
                    compact
                    icon="shield-checkmark-outline"
                    body="Your onboarding choices personalize NgitiFy. They do not create a diagnosis, replace professional dental care, or become Daily Oral Health Logs."
                />

                {error ? (
                    <Text
                        style={
                            styles.errorText
                        }
                        accessibilityRole="alert"
                    >
                        {error}
                    </Text>
                ) : null}
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

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .xl,

            gap:
                patientOnboardingTheme
                    .spacing
                    .lg,
        },

        completeIcon: {
            width: 96,
            height: 96,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                32,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .successSoft,
        },

        completeInner: {
            width: 66,
            height: 66,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primary,
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

        subtitle: {
            ...patientOnboardingTheme
                .typography
                .subtitle,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            maxWidth: 560,
        },

        summaryCard: {
            gap:
                patientOnboardingTheme
                    .spacing
                    .md,

            padding:
                patientOnboardingTheme
                    .spacing
                    .lg,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .lg,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .border,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,

            ...patientOnboardingTheme
                .shadows
                .soft,
        },

        summaryRow: {
            flexDirection:
                'row',

            alignItems:
                'flex-start',

            gap:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        summaryText: {
            ...patientOnboardingTheme
                .typography
                .body,

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            flex: 1,
        },

        logButton: {
            minHeight: 78,

            flexDirection:
                'row',

            alignItems:
                'center',

            gap:
                patientOnboardingTheme
                    .spacing
                    .md,

            padding:
                patientOnboardingTheme
                    .spacing
                    .md,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .lg,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .primary,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,
        },

        logButtonDisabled: {
            opacity: 0.6,
        },

        logButtonIcon: {
            width: 42,
            height: 42,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,
        },

        logButtonTextArea: {
            flex: 1,
        },

        logButtonTitle: {
            ...patientOnboardingTheme
                .typography
                .optionTitle,

            color:
                patientOnboardingTheme
                    .colors
                    .primaryDark,
        },

        logButtonDescription: {
            ...patientOnboardingTheme
                .typography
                .optionDescription,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop: 2,
        },

        errorText: {
            ...patientOnboardingTheme
                .typography
                .small,

            color:
                patientOnboardingTheme
                    .colors
                    .primaryDark,
        },
    });