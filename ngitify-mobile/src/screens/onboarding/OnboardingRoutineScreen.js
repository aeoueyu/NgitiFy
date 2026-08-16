import React from 'react';

import {
    Alert,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import PatientOnboardingShell
    from '../../components/onboarding/PatientOnboardingShell';

import {
    OnboardingChoiceCard,
    OnboardingChoiceGroup,
    OnboardingFooterActions,
    OnboardingInfoCard,
    OnboardingSectionLabel,
} from '../../components/onboarding/PatientOnboardingControls';

import {
    usePatientOnboarding,
} from '../../context/PatientOnboardingContext';

import {
    BRUSHING_ROUTINE_OPTIONS,
    FLOSSING_ROUTINE_OPTIONS,
    ONBOARDING_PROGRESS_TOTAL,
} from '../../data/patientOnboardingOptions';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

export default function OnboardingRoutineScreen({
    navigation,
}) {
    const {
        draft,
        isSaving,
        error,
        setRoutineValue,
        saveProgress,
    } = usePatientOnboarding();

    const handleContinue =
        async () => {
            try {
                await saveProgress({
                    currentStep: 4,

                    fields: {
                        oralCareRoutine: {
                            brushing:
                                draft
                                    .oralCareRoutine
                                    .brushing,

                            flossing:
                                draft
                                    .oralCareRoutine
                                    .flossing,
                        },
                    },
                });

                navigation.navigate(
                    'OnboardingExperience'
                );
            } catch (
                saveError
            ) {
                Alert.alert(
                    'Could not save yet',
                    saveError?.message
                    || 'Your selections are still here. Please try again.'
                );
            }
        };

    const handleSkip =
        async () => {
            setRoutineValue(
                'brushing',
                ''
            );

            setRoutineValue(
                'flossing',
                ''
            );

            try {
                await saveProgress({
                    currentStep: 4,

                    fields: {
                        oralCareRoutine: {
                            brushing: '',
                            flossing: '',
                        },
                    },
                });

                navigation.navigate(
                    'OnboardingExperience'
                );
            } catch (
                saveError
            ) {
                Alert.alert(
                    'Could not save yet',
                    saveError?.message
                    || 'Please try again.'
                );
            }
        };

    return (
        <PatientOnboardingShell
            title="Tell us about your routine"
            subtitle="This helps personalize Dental Health Education. You can change this later."
            currentStep={3}
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
            accessibilityLabel="Oral care routine onboarding step"
        >
            <View
                style={
                    styles.content
                }
            >
                <View>
                    <OnboardingSectionLabel>
                        Brushing
                    </OnboardingSectionLabel>

                    <OnboardingChoiceGroup>
                        {BRUSHING_ROUTINE_OPTIONS.map(
                            (
                                option
                            ) => {
                                const selected =
                                    draft
                                        .oralCareRoutine
                                        .brushing
                                    === option.id;

                                return (
                                    <OnboardingChoiceCard
                                        key={
                                            option.id
                                        }
                                        title={
                                            option.title
                                        }
                                        icon="brush-outline"
                                        selected={
                                            selected
                                        }
                                        onPress={
                                            () =>
                                                setRoutineValue(
                                                    'brushing',
                                                    option.id
                                                )
                                        }
                                        multiSelect={
                                            false
                                        }
                                        accessibilityLabel={
                                            `Brushing. ${option.title}. ${selected ? 'Selected' : 'Not selected'}.`
                                        }
                                    />
                                );
                            }
                        )}
                    </OnboardingChoiceGroup>
                </View>

                <View>
                    <OnboardingSectionLabel>
                        Flossing
                    </OnboardingSectionLabel>

                    <OnboardingChoiceGroup>
                        {FLOSSING_ROUTINE_OPTIONS.map(
                            (
                                option
                            ) => {
                                const selected =
                                    draft
                                        .oralCareRoutine
                                        .flossing
                                    === option.id;

                                return (
                                    <OnboardingChoiceCard
                                        key={
                                            option.id
                                        }
                                        title={
                                            option.title
                                        }
                                        icon="git-branch-outline"
                                        selected={
                                            selected
                                        }
                                        onPress={
                                            () =>
                                                setRoutineValue(
                                                    'flossing',
                                                    option.id
                                                )
                                        }
                                        multiSelect={
                                            false
                                        }
                                        accessibilityLabel={
                                            `Flossing. ${option.title}. ${selected ? 'Selected' : 'Not selected'}.`
                                        }
                                    />
                                );
                            }
                        )}
                    </OnboardingChoiceGroup>
                </View>

                <OnboardingInfoCard
                    compact
                    icon="information-circle-outline"
                    body="These answers are lightweight personalization only. NgitiFy does not calculate an oral-health score from your onboarding routine, and these answers do not change a Dentist's recommended visit."
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
                    .xl,
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