import React from 'react';

import {
    Alert,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import PatientOnboardingShell
    from '../../components/onboarding/PatientOnboardingShell';
import { showAppModal } from '../../components/AppModalProvider';

import {
    OnboardingFooterActions,
    OnboardingInfoCard,
    OnboardingToggleRow,
} from '../../components/onboarding/PatientOnboardingControls';

import {
    usePatientOnboarding,
} from '../../context/PatientOnboardingContext';

import {
    ONBOARDING_PROGRESS_TOTAL,
} from '../../data/patientOnboardingOptions';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

const EXPERIENCE_OPTIONS = [
    {
        key: 'oralHealthManagement',
        icon: 'calendar-outline',
        title: 'Oral Health Management',
        description:
            'Track daily symptoms and care habits.',
    },
    {
        key: 'dentalHealthEducation',
        icon: 'book-outline',
        title: 'Dental Health Education',
        description:
            'See helpful educational content related to your logs and interests.',
    },
    {
        key: 'visitRecommendations',
        icon: 'time-outline',
        title: 'Visit Recommendations',
        description:
            'Stay aware of Dentist Suggested Next Visits and current system recommendations.',
    },
    {
        key: 'appointmentUpdates',
        icon: 'calendar-number-outline',
        title: 'Appointment Updates',
        description:
            'Receive useful updates about your dental appointments.',
    },
];

export default function OnboardingExperienceScreen({
    navigation,
}) {
    const {
        draft,
        isSaving,
        error,
        updateDraft,
        saveProgress,
    } = usePatientOnboarding();

    const preferences =
        draft
            .experiencePreferences;

    const handleToggle =
        (
            key,
            value
        ) => {
            updateDraft(
                (
                    current
                ) => ({
                    ...current,

                    experiencePreferences: {
                        ...current
                            .experiencePreferences,

                        [key]:
                            value,
                    },
                })
            );
        };

    const handleContinue =
        async () => {
            try {
                await saveProgress({
                    currentStep: 5,

                    fields: {
                        experiencePreferences:
                            draft
                                .experiencePreferences,
                    },
                });

                navigation.navigate(
                    'OnboardingNotifications'
                );
            } catch (
                saveError
            ) {
                showAppModal(
                    'Could not save yet',
                    saveError?.message
                    || 'Your preferences are still here. Please try again.'
                );
            }
        };

    const handleSkip =
        async () => {
            const defaults = {
                oralHealthManagement:
                    true,

                dentalHealthEducation:
                    true,

                visitRecommendations:
                    true,

                appointmentUpdates:
                    true,
            };

            updateDraft(
                (
                    current
                ) => ({
                    ...current,

                    experiencePreferences:
                        defaults,
                })
            );

            try {
                await saveProgress({
                    currentStep: 5,

                    fields: {
                        experiencePreferences:
                            defaults,
                    },
                });

                navigation.navigate(
                    'OnboardingNotifications'
                );
            } catch (
                saveError
            ) {
                showAppModal(
                    'Could not save yet',
                    saveError?.message
                    || 'Please try again.'
                );
            }
        };

    return (
        <PatientOnboardingShell
            title="Choose your experience"
            subtitle="You can change these preferences anytime. Core Patient records and features remain available."
            currentStep={4}
            totalSteps={
                ONBOARDING_PROGRESS_TOTAL
            }
            showBack
            onBack={
                () =>
                    navigation.goBack()
            }
            footer={
                <OnboardingFooterActions
                    primaryLabel="Continue"
                    onPrimaryPress={
                        handleContinue
                    }
                    primaryLoading={
                        isSaving
                    }
                    secondaryLabel="Skip for now"
                    onSecondaryPress={
                        handleSkip
                    }
                />
            }
            accessibilityLabel="NgitiFy experience preferences onboarding step"
        >
            <View
                style={
                    styles.content
                }
            >
                <View
                    style={
                        styles.preferenceCard
                    }
                >
                    {EXPERIENCE_OPTIONS.map(
                        (
                            option,
                            index
                        ) => (
                            <View
                                key={
                                    option.key
                                }
                            >
                                <OnboardingToggleRow
                                    title={
                                        option.title
                                    }
                                    description={
                                        option.description
                                    }
                                    icon={
                                        option.icon
                                    }
                                    value={
                                        preferences[
                                            option.key
                                        ]
                                    }
                                    onValueChange={
                                        (
                                            value
                                        ) =>
                                            handleToggle(
                                                option.key,
                                                value
                                            )
                                    }
                                    accessibilityLabel={
                                        `${option.title} experience preference`
                                    }
                                />

                                {index
                                < EXPERIENCE_OPTIONS.length
                                    - 1 ? (
                                    <View
                                        style={
                                            styles.spacer
                                        }
                                    />
                                ) : null}
                            </View>
                        )
                    )}
                </View>

                <OnboardingInfoCard
                    compact
                    icon="shield-checkmark-outline"
                    body="These choices personalize what NgitiFy emphasizes. Turning one off here does not remove access to appointments, clinic records, Oral Health Management, Dental Health Education, or other core Patient features."
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
            gap:
                patientOnboardingTheme
                    .spacing
                    .lg,
        },

        preferenceCard: {
            width: '100%',
        },

        spacer: {
            height:
                patientOnboardingTheme
                    .spacing
                    .sm,
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
