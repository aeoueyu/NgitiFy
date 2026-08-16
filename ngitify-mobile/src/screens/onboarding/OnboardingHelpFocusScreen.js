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
} from '../../components/onboarding/PatientOnboardingControls';

import {
    usePatientOnboarding,
} from '../../context/PatientOnboardingContext';

import {
    HELP_FOCUS_OPTIONS,
    ONBOARDING_PROGRESS_TOTAL,
} from '../../data/patientOnboardingOptions';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

export default function OnboardingHelpFocusScreen({
    navigation,
}) {
    const {
        draft,
        isSaving,
        error,
        toggleEducationInterest,
        saveProgress,
    } = usePatientOnboarding();

    const handleContinue =
        async () => {
            try {
                await saveProgress({
                    currentStep: 3,

                    fields: {
                        educationInterests:
                            draft
                                .educationInterests,
                    },
                });

                navigation.navigate(
                    'OnboardingRoutine'
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
            try {
                await saveProgress({
                    currentStep: 3,

                    fields: {
                        educationInterests:
                            [],
                    },
                });

                navigation.navigate(
                    'OnboardingRoutine'
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
            title="What would you like help with?"
            subtitle="Select all that apply. These choices personalize your experience and do not indicate a diagnosis."
            currentStep={2}
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
            accessibilityLabel="NgitiFy help preferences onboarding step"
        >
            <View
                style={
                    styles.content
                }
            >
                <OnboardingChoiceGroup>
                    {HELP_FOCUS_OPTIONS.map(
                        (
                            option
                        ) => {
                            const selected =
                                draft
                                    .educationInterests
                                    .includes(
                                        option.id
                                    );

                            return (
                                <OnboardingChoiceCard
                                    key={
                                        option.id
                                    }
                                    title={
                                        option.title
                                    }
                                    description={
                                        option.description
                                    }
                                    icon={
                                        option.icon
                                    }
                                    selected={
                                        selected
                                    }
                                    onPress={
                                        () =>
                                            toggleEducationInterest(
                                                option.id
                                            )
                                    }
                                    multiSelect
                                    accessibilityLabel={
                                        `${option.title}. ${selected ? 'Selected' : 'Not selected'}.`
                                    }
                                />
                            );
                        }
                    )}
                </OnboardingChoiceGroup>

                <OnboardingInfoCard
                    compact
                    icon="shield-checkmark-outline"
                    body="Choosing a topic only helps NgitiFy prioritize general Dental Health Education. It does not create an Oral Health Management symptom, diagnosis, or Daily Oral Health Log."
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