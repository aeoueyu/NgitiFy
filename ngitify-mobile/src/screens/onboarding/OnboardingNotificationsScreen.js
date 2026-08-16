import React, {
    useEffect,
    useState,
} from 'react';

import {
    Alert,
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

const DEFAULT_NOTIFICATION_PREFERENCES = {
    notifAppointments: true,
    notifVisitWindow: true,
    notifOralHealthDaily: true,
    notifSymptomFollowUp: true,
    notifHealthTips: true,
};

const NOTIFICATION_ROWS = [
    {
        key:
            'notifAppointments',

        icon:
            'calendar-outline',

        title:
            'Appointment Alerts',

        description:
            'Updates about your scheduled dental visits.',
    },
    {
        key:
            'notifOralHealthDaily',

        icon:
            'checkmark-circle-outline',

        title:
            'Oral Health Management Reminder',

        description:
            'A gentle reminder to complete your daily check-in.',
    },
    {
        key:
            'notifVisitWindow',

        icon:
            'time-outline',

        title:
            'Recommended Visit Window Reminders',

        description:
            'Reminders related to your Dentist Suggested Next Visit or current recommendation.',
    },
    {
        key:
            'notifSymptomFollowUp',

        icon:
            'refresh-outline',

        title:
            'Symptom Follow-Up Reminders',

        description:
            'Check in again when an approved follow-up rule applies.',
    },
    {
        key:
            'notifHealthTips',

        icon:
            'book-outline',

        title:
            'Dental Health Education',

        description:
            'Receive useful dental-health tips and education.',
    },
];

export default function OnboardingNotificationsScreen({
    navigation,
}) {
    const {
        notificationPreferences,
        isSaving,
        error,
        saveNotificationPreferences,
        saveProgress,
    } = usePatientOnboarding();

    const [
        preferences,
        setPreferences,
    ] = useState(
        DEFAULT_NOTIFICATION_PREFERENCES
    );

    useEffect(
        () => {
            if (
                !notificationPreferences
            ) {
                return;
            }

            setPreferences({
                notifAppointments:
                    notificationPreferences
                        .notifAppointments
                    ?? true,

                notifVisitWindow:
                    notificationPreferences
                        .notifVisitWindow
                    ?? true,

                notifOralHealthDaily:
                    notificationPreferences
                        .notifOralHealthDaily
                    ?? true,

                notifSymptomFollowUp:
                    notificationPreferences
                        .notifSymptomFollowUp
                    ?? true,

                notifHealthTips:
                    notificationPreferences
                        .notifHealthTips
                    ?? true,
            });
        },
        [
            notificationPreferences,
        ]
    );

    const handleToggle =
        (
            key,
            value
        ) => {
            setPreferences(
                (
                    current
                ) => ({
                    ...current,

                    [key]:
                        value,
                })
            );
        };

    const handleSave =
        async () => {
            try {
                await saveNotificationPreferences(
                    preferences
                );

                await saveProgress({
                    currentStep: 6,
                });

                navigation.navigate(
                    'OnboardingPrivacy'
                );
            } catch (
                saveError
            ) {
                Alert.alert(
                    'Preferences not saved',
                    saveError?.message
                    || 'Your choices are still here. Please try again.'
                );
            }
        };

    const handleSkip =
        async () => {
            /*
             * Skipping intentionally leaves the Patient's
             * existing backend notification settings unchanged.
             */
            try {
                await saveProgress({
                    currentStep: 6,
                });

                navigation.navigate(
                    'OnboardingPrivacy'
                );
            } catch (
                saveError
            ) {
                Alert.alert(
                    'Could not continue yet',
                    saveError?.message
                    || 'Please try again.'
                );
            }
        };

    return (
        <PatientOnboardingShell
            title="Stay on track"
            subtitle="Choose the reminders that are useful to you. You can change these anytime in Settings."
            currentStep={5}
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
                    primaryLabel="Save Preferences"
                    primaryIcon="checkmark"
                    onPrimaryPress={
                        handleSave
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
            accessibilityLabel="Notification preferences onboarding step"
        >
            <View
                style={
                    styles.content
                }
            >
                <View
                    style={
                        styles.notificationIcon
                    }
                    accessible={false}
                    importantForAccessibility="no"
                >
                    <Ionicons
                        name="notifications-outline"
                        size={34}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primary
                        }
                    />
                </View>

                <View
                    style={
                        styles.rows
                    }
                >
                    {NOTIFICATION_ROWS.map(
                        (
                            item
                        ) => (
                            <OnboardingToggleRow
                                key={
                                    item.key
                                }
                                icon={
                                    item.icon
                                }
                                title={
                                    item.title
                                }
                                description={
                                    item.description
                                }
                                value={
                                    preferences[
                                        item.key
                                    ]
                                }
                                onValueChange={
                                    (
                                        value
                                    ) =>
                                        handleToggle(
                                            item.key,
                                            value
                                        )
                                }
                                accessibilityLabel={
                                    item.title
                                }
                            />
                        )
                    )}
                </View>

                <OnboardingInfoCard
                    compact
                    icon="settings-outline"
                    body="These controls save your NgitiFy notification preferences. Device-level push notification permission is separate and is not requested here because the current Mobile application does not yet use a native push-notification permission package."
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

        notificationIcon: {
            width: 64,
            height: 64,

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

        rows: {
            gap:
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