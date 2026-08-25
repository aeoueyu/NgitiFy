import React, {
    useState,
} from 'react';

import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    Ionicons,
} from '@expo/vector-icons';
import { showAppModal } from '../../components/AppModalProvider';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

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
    ONBOARDING_PROGRESS_TOTAL,
} from '../../data/patientOnboardingOptions';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

const PRIVACY_VERSION =
    'v1.0';

const PRIVACY_UPDATED_AT =
    'May 3, 2026';

const APPROVED_PRIVACY_SECTIONS = [
    {
        heading:
            'Why we collect data',

        body:
            'NgitiFy Dental Clinic collects appointment and patient information to manage bookings, coordinate patient care, maintain treatment records, and send important clinic communications.',
    },
    {
        heading:
            'What data may be used',

        body:
            'This may include your contact information, branch and schedule preferences, patient registration details, treatment-related records, and account activity needed for patient services.',
    },
    {
        heading:
            'Your privacy rights',

        body:
            'Your information is processed in line with Republic Act No. 10173 or the Data Privacy Act of 2012. You may raise privacy concerns or request corrections to inaccurate personal data through the clinic.',
    },
];

const HEALTH_INFORMATION_POINTS = [
    {
        icon:
            'person-circle-outline',

        text:
            'Your health information is associated with your authenticated NgitiFy account.',
    },
    {
        icon:
            'lock-closed-outline',

        text:
            'Oral Health Management entries are available through authorized account access.',
    },
    {
        icon:
            'document-text-outline',

        text:
            'Your self-reported Oral Health Management logs are not a dental diagnosis.',
    },
    {
        icon:
            'git-compare-outline',

        text:
            'Dentist and clinic records remain distinct from Patient-entered Daily Oral Health Logs.',
    },
    {
        icon:
            'sparkles-outline',

        text:
            'AI explanations provide education and explanation and do not replace a Dentist’s diagnosis or treatment decisions.',
    },
];

export default function OnboardingPrivacyScreen({
    navigation,
}) {
    const {
        isSaving,
        error,
        saveProgress,
    } = usePatientOnboarding();

    const [
        privacyVisible,
        setPrivacyVisible,
    ] = useState(false);

    const handleContinue =
        async () => {
            try {
                await saveProgress({
                    currentStep: 7,
                });

                navigation.navigate(
                    'OnboardingReady'
                );
            } catch (
                saveError
            ) {
                showAppModal(
                    'Could not continue yet',
                    saveError?.message
                    || 'Please try again.'
                );
            }
        };

    return (
        <>
            <PatientOnboardingShell
                title="Your information matters"
                subtitle="Here is how NgitiFy handles the health information used by your Patient experience."
                currentStep={6}
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
                    />
                }
                accessibilityLabel="Privacy and health information onboarding step"
            >
                <View
                    style={
                        styles.content
                    }
                >
                    <View
                        style={
                            styles.shield
                        }
                        accessible={false}
                        importantForAccessibility="no"
                    >
                        <Ionicons
                            name="shield-checkmark-outline"
                            size={38}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />
                    </View>

                    <View
                        style={
                            styles.pointsCard
                        }
                    >
                        {HEALTH_INFORMATION_POINTS.map(
                            (
                                item,
                                index
                            ) => (
                                <View
                                    key={
                                        item.text
                                    }
                                >
                                    <View
                                        style={
                                            styles.pointRow
                                        }
                                    >
                                        <View
                                            style={
                                                styles.pointIcon
                                            }
                                        >
                                            <Ionicons
                                                name={
                                                    item.icon
                                                }
                                                size={20}
                                                color={
                                                    patientOnboardingTheme
                                                        .colors
                                                        .primary
                                                }
                                            />
                                        </View>

                                        <Text
                                            style={
                                                styles.pointText
                                            }
                                        >
                                            {item.text}
                                        </Text>
                                    </View>

                                    {index
                                    < HEALTH_INFORMATION_POINTS.length
                                        - 1 ? (
                                        <View
                                            style={
                                                styles.divider
                                            }
                                        />
                                    ) : null}
                                </View>
                            )
                        )}
                    </View>

                    <TouchableOpacity
                        style={
                            styles.privacyLink
                        }
                        onPress={
                            () =>
                                setPrivacyVisible(
                                    true
                                )
                        }
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel="Read Privacy Information"
                    >
                        <Ionicons
                            name="document-text-outline"
                            size={20}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />

                        <Text
                            style={
                                styles
                                    .privacyLinkText
                            }
                        >
                            Read Privacy Information
                        </Text>

                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .primary
                            }
                        />
                    </TouchableOpacity>

                    <OnboardingInfoCard
                        compact
                        icon="information-circle-outline"
                        body="This onboarding page is informational. Your required NgitiFy app privacy consent remains the existing account-level consent and is not replaced by onboarding."
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

            <Modal
                visible={
                    privacyVisible
                }
                animationType="slide"
                transparent={false}
                onRequestClose={
                    () =>
                        setPrivacyVisible(
                            false
                        )
                }
            >
                <SafeAreaView
                    style={
                        styles.modalSafeArea
                    }
                    edges={[
                        'top',
                        'bottom',
                    ]}
                >
                    <View
                        style={
                            styles.modalHeader
                        }
                    >
                        <View>
                            <Text
                                style={
                                    styles.modalEyebrow
                                }
                            >
                                Privacy Policy
                            </Text>

                            <Text
                                style={
                                    styles.modalTitle
                                }
                                accessibilityRole="header"
                            >
                                Privacy Information
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={
                                styles.closeButton
                            }
                            onPress={
                                () =>
                                    setPrivacyVisible(
                                        false
                                    )
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Close Privacy Information"
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={
                                    patientOnboardingTheme
                                        .colors
                                        .text
                                }
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={
                            styles.modalContent
                        }
                        showsVerticalScrollIndicator={
                            false
                        }
                    >
                        <Text
                            style={
                                styles.modalMeta
                            }
                        >
                            Version {PRIVACY_VERSION}
                            {' • '}
                            Last updated {PRIVACY_UPDATED_AT}
                        </Text>

                        {APPROVED_PRIVACY_SECTIONS.map(
                            (
                                section
                            ) => (
                                <View
                                    key={
                                        section.heading
                                    }
                                    style={
                                        styles
                                            .privacySection
                                    }
                                >
                                    <Text
                                        style={
                                            styles
                                                .privacySectionTitle
                                        }
                                    >
                                        {section.heading}
                                    </Text>

                                    <Text
                                        style={
                                            styles
                                                .privacySectionBody
                                        }
                                    >
                                        {section.body}
                                    </Text>
                                </View>
                            )
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </>
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

        shield: {
            width: 70,
            height: 70,

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

        pointsCard: {
            padding:
                patientOnboardingTheme
                    .spacing
                    .md,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .lg,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .border,

            ...patientOnboardingTheme
                .shadows
                .soft,
        },

        pointRow: {
            flexDirection:
                'row',

            alignItems:
                'flex-start',

            gap:
                patientOnboardingTheme
                    .spacing
                    .md,

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        pointIcon: {
            width: 38,
            height: 38,

            flexShrink: 0,

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
                    .primarySoft,
        },

        pointText: {
            ...patientOnboardingTheme
                .typography
                .body,

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            flex: 1,
        },

        divider: {
            height: 1,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .border,

            marginVertical:
                patientOnboardingTheme
                    .spacing
                    .xs,
        },

        privacyLink: {
            minHeight:
                patientOnboardingTheme
                    .layout
                    .minimumTouchTarget,

            flexDirection:
                'row',

            alignItems:
                'center',

            gap:
                patientOnboardingTheme
                    .spacing
                    .sm,

            paddingHorizontal:
                patientOnboardingTheme
                    .spacing
                    .md,

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .sm,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .md,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .borderStrong,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,
        },

        privacyLinkText: {
            ...patientOnboardingTheme
                .typography
                .bodyStrong,

            color:
                patientOnboardingTheme
                    .colors
                    .primary,

            flex: 1,
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

        modalSafeArea: {
            flex: 1,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .background,
        },

        modalHeader: {
            flexDirection:
                'row',

            justifyContent:
                'space-between',

            alignItems:
                'center',

            paddingHorizontal:
                patientOnboardingTheme
                    .layout
                    .horizontalPadding,

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .md,

            borderBottomWidth: 1,

            borderBottomColor:
                patientOnboardingTheme
                    .colors
                    .border,
        },

        modalEyebrow: {
            ...patientOnboardingTheme
                .typography
                .eyebrow,

            color:
                patientOnboardingTheme
                    .colors
                    .primary,
        },

        modalTitle: {
            fontSize: 22,
            lineHeight: 29,
            fontWeight: '800',

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            marginTop: 2,
        },

        closeButton: {
            width: 48,
            height: 48,

            alignItems:
                'center',

            justifyContent:
                'center',

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,
        },

        modalContent: {
            padding:
                patientOnboardingTheme
                    .layout
                    .horizontalPadding,

            gap:
                patientOnboardingTheme
                    .spacing
                    .md,

            paddingBottom:
                patientOnboardingTheme
                    .spacing
                    .xxxl,
        },

        modalMeta: {
            ...patientOnboardingTheme
                .typography
                .small,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,
        },

        privacySection: {
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
        },

        privacySectionTitle: {
            ...patientOnboardingTheme
                .typography
                .bodyStrong,

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        privacySectionBody: {
            ...patientOnboardingTheme
                .typography
                .body,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,
        },
    });
