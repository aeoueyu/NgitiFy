import React, {
    useMemo,
    useState,
} from 'react';

import {
    Alert,
    StyleSheet,
    View,
} from 'react-native';

import PatientOnboardingShell
    from '../../components/onboarding/PatientOnboardingShell';

import {
    OnboardingFooterActions,
    OnboardingInfoCard,
    OnboardingTextField,
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

export default function OnboardingPreferredNameScreen({
    navigation,
}) {
    const {
        draft,
        registeredFirstName,
        isSaving,
        error,
        setPreferredName,
        saveProgress,
        clearError,
    } = usePatientOnboarding();

    const [
        localError,
        setLocalError,
    ] = useState('');

    const normalizedName =
        useMemo(
            () =>
                String(
                    draft
                        .preferredName
                    || ''
                ).trim(),
            [
                draft.preferredName,
            ]
        );

    const handleChange =
        (
            value
        ) => {
            clearError();
            setLocalError('');

            setPreferredName(
                value
            );
        };

    const persistAndContinue =
        async (
            preferredName
        ) => {
            try {
                await saveProgress({
                    currentStep: 2,

                    fields: {
                        preferredName,
                    },
                });

                navigation.navigate(
                    'OnboardingHelpFocus'
                );
            } catch (
                saveError
            ) {
                Alert.alert(
                    'Could not save yet',
                    saveError?.message
                    || 'Your answer is still here. Please try again.'
                );
            }
        };

    const handleContinue =
        async () => {
            if (
                normalizedName.length
                > 60
            ) {
                setLocalError(
                    'Please use 60 characters or fewer.'
                );

                return;
            }

            await persistAndContinue(
                normalizedName
                || registeredFirstName
                || ''
            );
        };

    const handleSkip =
        async () => {
            setPreferredName(
                registeredFirstName
                || ''
            );

            await persistAndContinue(
                ''
            );
        };

    return (
        <PatientOnboardingShell
            title="What should we call you?"
            subtitle="Your first name is fine, or you can use a nickname."
            currentStep={1}
            totalSteps={
                ONBOARDING_PROGRESS_TOTAL
            }
            showBack
            onBack={
                () =>
                    navigation.goBack()
            }
            keyboardAware
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
            accessibilityLabel="Preferred name onboarding step"
        >
            <View
                style={
                    styles.content
                }
            >
                <OnboardingTextField
                    label="Preferred name"
                    value={
                        draft
                            .preferredName
                    }
                    onChangeText={
                        handleChange
                    }
                    placeholder={
                        registeredFirstName
                        || 'What should we call you?'
                    }
                    helperText="This is only for how NgitiFy addresses you. It does not replace your registered legal name."
                    errorText={
                        localError
                        || error
                    }
                    maxLength={60}
                    returnKeyType="next"
                    onSubmitEditing={
                        handleContinue
                    }
                    accessibilityLabel="Preferred name or nickname"
                />

                <OnboardingInfoCard
                    compact
                    icon="person-outline"
                    body={
                        registeredFirstName
                            ? `If you skip this step, NgitiFy will continue using ${registeredFirstName}.`
                            : 'You can skip this step and continue without adding a preferred name.'
                    }
                />
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
    });