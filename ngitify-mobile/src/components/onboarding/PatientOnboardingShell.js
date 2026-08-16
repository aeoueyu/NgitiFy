import React, {
    useEffect,
    useMemo,
    useRef,
} from 'react';

import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    Ionicons,
} from '@expo/vector-icons';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

const clampProgress = (
    value
) => {
    const numericValue =
        Number(value);

    if (
        !Number.isFinite(
            numericValue
        )
    ) {
        return 0;
    }

    return Math.min(
        1,
        Math.max(
            0,
            numericValue
        )
    );
};

export default function PatientOnboardingShell({
    children,

    title,

    subtitle = '',

    eyebrow = '',

    currentStep = 0,

    totalSteps = 0,

    showProgress = true,

    showBack = false,

    onBack,

    backLabel = 'Go back',

    footer = null,

    scrollEnabled = true,

    keyboardAware = false,

    contentContainerStyle,

    headerAccessory = null,

    testID,

    accessibilityLabel,
}) {
    const {
        width,
        height,
    } = useWindowDimensions();

    const animatedProgress =
        useRef(
            new Animated.Value(0)
        ).current;

    const progress =
        useMemo(
            () => {
                if (
                    !showProgress
                    || totalSteps <= 0
                    || currentStep <= 0
                ) {
                    return 0;
                }

                return clampProgress(
                    currentStep
                    / totalSteps
                );
            },
            [
                currentStep,
                showProgress,
                totalSteps,
            ]
        );

    useEffect(
        () => {
            Animated.timing(
                animatedProgress,
                {
                    toValue:
                        progress,

                    duration:
                        240,

                    useNativeDriver:
                        false,
                }
            ).start();
        },
        [
            animatedProgress,
            progress,
        ]
    );

    const isCompact =
        width < 375
        || height < 700;

    const progressWidth =
        animatedProgress.interpolate({
            inputRange: [
                0,
                1,
            ],

            outputRange: [
                '0%',
                '100%',
            ],
        });

    const content = (
        <View
            style={[
                styles.page,
                isCompact
                && styles.pageCompact,
            ]}
        >
            <View
                style={styles.topArea}
            >
                <View
                    style={styles.topRow}
                >
                    <View
                        style={
                            styles.topRowSide
                        }
                    >
                        {showBack ? (
                            <TouchableOpacity
                                onPress={
                                    onBack
                                }
                                disabled={
                                    !onBack
                                }
                                activeOpacity={
                                    0.72
                                }
                                accessibilityRole="button"
                                accessibilityLabel={
                                    backLabel
                                }
                                accessibilityState={{
                                    disabled:
                                        !onBack,
                                }}
                                style={[
                                    styles.backButton,

                                    !onBack
                                    && styles.controlDisabled,
                                ]}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={24}
                                    color={
                                        patientOnboardingTheme
                                            .colors
                                            .primaryDark
                                    }
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {showProgress
                    && totalSteps > 0
                    && currentStep > 0 ? (
                        <Text
                            style={
                                styles.stepText
                            }
                            accessibilityLabel={
                                `Step ${currentStep} of ${totalSteps}`
                            }
                        >
                            {currentStep}
                            {' / '}
                            {totalSteps}
                        </Text>
                    ) : (
                        <View />
                    )}

                    <View
                        style={[
                            styles.topRowSide,
                            styles.topRowSideRight,
                        ]}
                    >
                        {headerAccessory}
                    </View>
                </View>

                {showProgress
                && totalSteps > 0
                && currentStep > 0 ? (
                    <View
                        style={
                            styles.progressTrack
                        }
                        accessibilityRole="progressbar"
                        accessibilityValue={{
                            min: 0,
                            max: totalSteps,
                            now: currentStep,
                        }}
                    >
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width:
                                        progressWidth,
                                },
                            ]}
                        />
                    </View>
                ) : null}

                {eyebrow ? (
                    <Text
                        style={styles.eyebrow}
                    >
                        {eyebrow}
                    </Text>
                ) : null}

                {title ? (
                    <Text
                        style={[
                            styles.title,
                            isCompact
                            && styles.titleCompact,
                        ]}
                        accessibilityRole="header"
                    >
                        {title}
                    </Text>
                ) : null}

                {subtitle ? (
                    <Text
                        style={
                            styles.subtitle
                        }
                    >
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            <View
                style={styles.body}
            >
                {children}
            </View>
        </View>
    );

    return (
        <SafeAreaView
            style={styles.safeArea}
            edges={[
                'top',
                'bottom',
                'left',
                'right',
            ]}
            testID={testID}
            accessibilityLabel={
                accessibilityLabel
            }
        >
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={
                    keyboardAware
                    ? (
                        Platform.OS === 'ios'
                            ? 'padding'
                            : 'height'
                    )
                    : undefined
                }
                enabled={
                    keyboardAware
                }
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,

                        isCompact
                        && styles
                            .scrollContentCompact,

                        contentContainerStyle,
                    ]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={
                        Platform.OS === 'ios'
                            ? 'interactive'
                            : 'on-drag'
                    }
                    showsVerticalScrollIndicator={
                        false
                    }
                    scrollEnabled={
                        scrollEnabled
                    }
                >
                    {content}
                </ScrollView>

                {footer ? (
                    <View
                        style={[
                            styles.footer,

                            isCompact
                            && styles
                                .footerCompact,
                        ]}
                    >
                        <View
                            style={
                                styles
                                    .footerInner
                            }
                        >
                            {footer}
                        </View>
                    </View>
                ) : null}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles =
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .background,
        },

        keyboardView: {
            flex: 1,
        },

        scrollView: {
            flex: 1,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal:
                patientOnboardingTheme
                    .layout
                    .horizontalPadding,

            paddingBottom:
                patientOnboardingTheme
                    .spacing
                    .xl,
        },

        scrollContentCompact: {
            paddingHorizontal:
                patientOnboardingTheme
                    .layout
                    .compactHorizontalPadding,
        },

        page: {
            width: '100%',
            maxWidth:
                patientOnboardingTheme
                    .layout
                    .contentMaxWidth,

            alignSelf: 'center',
            flexGrow: 1,
            paddingTop:
                patientOnboardingTheme
                    .spacing
                    .md,
        },

        pageCompact: {
            paddingTop:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        topArea: {
            width: '100%',
        },

        topRow: {
            minHeight:
                patientOnboardingTheme
                    .layout
                    .minimumTouchTarget,

            flexDirection: 'row',
            alignItems: 'center',
            justifyContent:
                'space-between',
        },

        topRowSide: {
            width: 48,
            minHeight: 48,
            justifyContent: 'center',
        },

        topRowSideRight: {
            alignItems: 'flex-end',
        },

        backButton: {
            width: 48,
            height: 48,
            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            alignItems: 'center',
            justifyContent: 'center',
        },

        controlDisabled: {
            opacity: 0.45,
        },

        stepText: {
            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
        },

        progressTrack: {
            width: '100%',
            height:
                patientOnboardingTheme
                    .layout
                    .progressHeight,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,

            overflow: 'hidden',

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .xs,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .xl,
        },

        progressFill: {
            height: '100%',
            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primary,
        },

        eyebrow: {
            ...patientOnboardingTheme
                .typography
                .eyebrow,

            color:
                patientOnboardingTheme
                    .colors
                    .primary,

            textTransform: 'uppercase',

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

            maxWidth: 560,
        },

        titleCompact: {
            fontSize: 28,
            lineHeight: 35,
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
                    .sm,

            maxWidth: 560,
        },

        body: {
            flexGrow: 1,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .xl,
        },

        footer: {
            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .background,

            paddingHorizontal:
                patientOnboardingTheme
                    .layout
                    .horizontalPadding,

            paddingTop:
                patientOnboardingTheme
                    .spacing
                    .sm,

            paddingBottom:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        footerCompact: {
            paddingHorizontal:
                patientOnboardingTheme
                    .layout
                    .compactHorizontalPadding,
        },

        footerInner: {
            width: '100%',
            maxWidth:
                patientOnboardingTheme
                    .layout
                    .contentMaxWidth,

            alignSelf: 'center',
        },
    });