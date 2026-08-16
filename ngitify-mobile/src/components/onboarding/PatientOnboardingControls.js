import React from 'react';

import {
    ActivityIndicator,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    Ionicons,
} from '@expo/vector-icons';

import {
    patientOnboardingTheme,
} from '../../theme/patientOnboardingTheme';

export function OnboardingPrimaryButton({
    label,
    onPress,
    disabled = false,
    loading = false,
    icon = null,
    accessibilityLabel,
    testID,
}) {
    const isDisabled =
        disabled
        || loading;

    return (
        <TouchableOpacity
            style={[
                styles.primaryButton,

                isDisabled
                && styles
                    .primaryButtonDisabled,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel={
                accessibilityLabel
                || label
            }
            accessibilityState={{
                disabled:
                    isDisabled,

                busy:
                    loading,
            }}
            testID={testID}
        >
            {loading ? (
                <ActivityIndicator
                    color={
                        patientOnboardingTheme
                            .colors
                            .surface
                    }
                />
            ) : (
                <View
                    style={
                        styles
                            .buttonContent
                    }
                >
                    <Text
                        style={
                            styles
                                .primaryButtonText
                        }
                    >
                        {label}
                    </Text>

                    {icon ? (
                        <Ionicons
                            name={icon}
                            size={20}
                            color={
                                patientOnboardingTheme
                                    .colors
                                    .surface
                            }
                        />
                    ) : null}
                </View>
            )}
        </TouchableOpacity>
    );
}

export function OnboardingSecondaryButton({
    label,
    onPress,
    disabled = false,
    accessibilityLabel,
    testID,
}) {
    return (
        <TouchableOpacity
            style={[
                styles.secondaryButton,

                disabled
                && styles
                    .secondaryButtonDisabled,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={
                accessibilityLabel
                || label
            }
            accessibilityState={{
                disabled,
            }}
            testID={testID}
        >
            <Text
                style={[
                    styles
                        .secondaryButtonText,

                    disabled
                    && styles
                        .secondaryButtonTextDisabled,
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export function OnboardingFooterActions({
    primaryLabel = 'Continue',

    onPrimaryPress,

    primaryDisabled = false,

    primaryLoading = false,

    primaryIcon = 'arrow-forward',

    secondaryLabel = '',

    onSecondaryPress,

    secondaryDisabled = false,
}) {
    return (
        <View
            style={
                styles.footerActions
            }
        >
            <OnboardingPrimaryButton
                label={
                    primaryLabel
                }
                onPress={
                    onPrimaryPress
                }
                disabled={
                    primaryDisabled
                }
                loading={
                    primaryLoading
                }
                icon={
                    primaryIcon
                }
            />

            {secondaryLabel ? (
                <OnboardingSecondaryButton
                    label={
                        secondaryLabel
                    }
                    onPress={
                        onSecondaryPress
                    }
                    disabled={
                        secondaryDisabled
                        || primaryLoading
                    }
                />
            ) : null}
        </View>
    );
}

export function OnboardingChoiceCard({
    title,

    description = '',

    selected = false,

    onPress,

    disabled = false,

    icon = null,

    multiSelect = true,

    accessibilityLabel,

    testID,
}) {
    return (
        <TouchableOpacity
            style={[
                styles.choiceCard,

                selected
                && styles
                    .choiceCardSelected,

                disabled
                && styles
                    .choiceCardDisabled,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole={
                multiSelect
                    ? 'checkbox'
                    : 'radio'
            }
            accessibilityLabel={
                accessibilityLabel
                || title
            }
            accessibilityState={{
                checked:
                    selected,

                selected,

                disabled,
            }}
            testID={testID}
        >
            {icon ? (
                <View
                    style={[
                        styles.choiceIcon,

                        selected
                        && styles
                            .choiceIconSelected,
                    ]}
                >
                    <Ionicons
                        name={icon}
                        size={21}
                        color={
                            selected
                                ? patientOnboardingTheme
                                    .colors
                                    .primary
                                : patientOnboardingTheme
                                    .colors
                                    .textMuted
                        }
                    />
                </View>
            ) : null}

            <View
                style={
                    styles
                        .choiceTextArea
                }
            >
                <Text
                    style={[
                        styles.choiceTitle,

                        selected
                        && styles
                            .choiceTitleSelected,
                    ]}
                >
                    {title}
                </Text>

                {description ? (
                    <Text
                        style={
                            styles
                                .choiceDescription
                        }
                    >
                        {description}
                    </Text>
                ) : null}
            </View>

            <View
                style={[
                    styles.selectionIndicator,

                    selected
                    && styles
                        .selectionIndicatorSelected,
                ]}
            >
                {selected ? (
                    <Ionicons
                        name="checkmark"
                        size={17}
                        color={
                            patientOnboardingTheme
                                .colors
                                .surface
                        }
                    />
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

export function OnboardingToggleRow({
    title,

    description = '',

    value,

    onValueChange,

    disabled = false,

    icon = null,

    accessibilityLabel,

    testID,
}) {
    return (
        <View
            style={[
                styles.toggleRow,

                disabled
                && styles
                    .toggleRowDisabled,
            ]}
            testID={testID}
        >
            {icon ? (
                <View
                    style={
                        styles.toggleIcon
                    }
                >
                    <Ionicons
                        name={icon}
                        size={21}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primary
                        }
                    />
                </View>
            ) : null}

            <View
                style={
                    styles.toggleTextArea
                }
            >
                <Text
                    style={
                        styles.toggleTitle
                    }
                >
                    {title}
                </Text>

                {description ? (
                    <Text
                        style={
                            styles
                                .toggleDescription
                        }
                    >
                        {description}
                    </Text>
                ) : null}
            </View>

            <Switch
                value={Boolean(value)}
                onValueChange={
                    onValueChange
                }
                disabled={disabled}
                trackColor={{
                    false:
                        patientOnboardingTheme
                            .colors
                            .borderStrong,

                    true:
                        patientOnboardingTheme
                            .colors
                            .primary,
                }}
                thumbColor={
                    patientOnboardingTheme
                        .colors
                        .surface
                }
                ios_backgroundColor={
                    patientOnboardingTheme
                        .colors
                        .borderStrong
                }
                accessibilityRole="switch"
                accessibilityLabel={
                    accessibilityLabel
                    || title
                }
                accessibilityState={{
                    checked:
                        Boolean(value),

                    disabled,
                }}
            />
        </View>
    );
}

export function OnboardingTextField({
    label,

    value,

    onChangeText,

    placeholder = '',

    helperText = '',

    errorText = '',

    editable = true,

    maxLength,

    multiline = false,

    autoCapitalize = 'words',

    returnKeyType = 'done',

    onSubmitEditing,

    accessibilityLabel,

    testID,
}) {
    return (
        <View
            style={
                styles.fieldGroup
            }
        >
            {label ? (
                <Text
                    style={
                        styles.fieldLabel
                    }
                >
                    {label}
                </Text>
            ) : null}

            <TextInput
                value={value}
                onChangeText={
                    onChangeText
                }
                placeholder={
                    placeholder
                }
                placeholderTextColor={
                    patientOnboardingTheme
                        .colors
                        .textSoft
                }
                editable={editable}
                maxLength={maxLength}
                multiline={multiline}
                autoCapitalize={
                    autoCapitalize
                }
                returnKeyType={
                    multiline
                        ? 'default'
                        : returnKeyType
                }
                onSubmitEditing={
                    onSubmitEditing
                }
                accessibilityLabel={
                    accessibilityLabel
                    || label
                    || placeholder
                }
                accessibilityState={{
                    disabled:
                        !editable,
                }}
                style={[
                    styles.textInput,

                    multiline
                    && styles
                        .textInputMultiline,

                    Boolean(errorText)
                    && styles
                        .textInputError,

                    !editable
                    && styles
                        .textInputDisabled,
                ]}
                testID={testID}
            />

            {errorText ? (
                <View
                    style={
                        styles
                            .fieldMessageRow
                    }
                >
                    <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color={
                            patientOnboardingTheme
                                .colors
                                .primaryDark
                        }
                    />

                    <Text
                        style={
                            styles
                                .fieldError
                        }
                    >
                        {errorText}
                    </Text>
                </View>
            ) : helperText ? (
                <Text
                    style={
                        styles
                            .fieldHelper
                    }
                >
                    {helperText}
                </Text>
            ) : null}
        </View>
    );
}

export function OnboardingInfoCard({
    title = '',

    body,

    icon = 'information-circle-outline',

    compact = false,

    accessibilityLabel,

    testID,
}) {
    return (
        <View
            style={[
                styles.infoCard,

                compact
                && styles
                    .infoCardCompact,
            ]}
            accessible
            accessibilityLabel={
                accessibilityLabel
                || (
                    title
                        ? `${title}. ${body}`
                        : body
                )
            }
            testID={testID}
        >
            <View
                style={
                    styles.infoIcon
                }
            >
                <Ionicons
                    name={icon}
                    size={20}
                    color={
                        patientOnboardingTheme
                            .colors
                            .primary
                    }
                />
            </View>

            <View
                style={
                    styles.infoTextArea
                }
            >
                {title ? (
                    <Text
                        style={
                            styles.infoTitle
                        }
                    >
                        {title}
                    </Text>
                ) : null}

                <Text
                    style={
                        styles.infoBody
                    }
                >
                    {body}
                </Text>
            </View>
        </View>
    );
}

export function OnboardingSectionLabel({
    children,
}) {
    return (
        <Text
            style={
                styles.sectionLabel
            }
        >
            {children}
        </Text>
    );
}

export function OnboardingChoiceGroup({
    children,
}) {
    return (
        <View
            style={
                styles.choiceGroup
            }
        >
            {children}
        </View>
    );
}

const styles =
    StyleSheet.create({
        footerActions: {
            gap:
                patientOnboardingTheme
                    .spacing
                    .xs,
        },

        buttonContent: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent:
                'center',

            gap:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        primaryButton: {
            minHeight:
                patientOnboardingTheme
                    .layout
                    .primaryButtonHeight,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .md,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primary,

            alignItems: 'center',
            justifyContent:
                'center',

            paddingHorizontal:
                patientOnboardingTheme
                    .spacing
                    .lg,

            ...patientOnboardingTheme
                .shadows
                .soft,
        },

        primaryButtonDisabled: {
            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .disabledBackground,

            shadowOpacity: 0,
            elevation: 0,
        },

        primaryButtonText: {
            ...patientOnboardingTheme
                .typography
                .button,

            color:
                patientOnboardingTheme
                    .colors
                    .surface,
        },

        secondaryButton: {
            minHeight:
                patientOnboardingTheme
                    .layout
                    .minimumTouchTarget,

            alignItems: 'center',
            justifyContent:
                'center',

            paddingHorizontal:
                patientOnboardingTheme
                    .spacing
                    .md,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .md,
        },

        secondaryButtonDisabled: {
            opacity: 0.5,
        },

        secondaryButtonText: {
            ...patientOnboardingTheme
                .typography
                .button,

            color:
                patientOnboardingTheme
                    .colors
                    .primary,
        },

        secondaryButtonTextDisabled: {
            color:
                patientOnboardingTheme
                    .colors
                    .disabledText,
        },

        choiceGroup: {
            gap:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        choiceCard: {
            width: '100%',

            minHeight:
                patientOnboardingTheme
                    .layout
                    .optionMinHeight,

            flexDirection: 'row',
            alignItems: 'center',

            padding:
                patientOnboardingTheme
                    .spacing
                    .md,

            gap:
                patientOnboardingTheme
                    .spacing
                    .md,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .md,

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

        choiceCardSelected: {
            borderWidth: 2,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .primary,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .selectedSurface,
        },

        choiceCardDisabled: {
            opacity: 0.5,
        },

        choiceIcon: {
            width: 42,
            height: 42,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            alignItems: 'center',
            justifyContent:
                'center',

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .backgroundMuted,
        },

        choiceIconSelected: {
            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,
        },

        choiceTextArea: {
            flex: 1,
        },

        choiceTitle: {
            ...patientOnboardingTheme
                .typography
                .optionTitle,

            color:
                patientOnboardingTheme
                    .colors
                    .text,
        },

        choiceTitleSelected: {
            color:
                patientOnboardingTheme
                    .colors
                    .primaryDark,
        },

        choiceDescription: {
            ...patientOnboardingTheme
                .typography
                .optionDescription,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .xs,
        },

        selectionIndicator: {
            width: 26,
            height: 26,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            borderWidth: 2,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .borderStrong,

            alignItems: 'center',
            justifyContent:
                'center',

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surface,
        },

        selectionIndicatorSelected: {
            borderColor:
                patientOnboardingTheme
                    .colors
                    .primary,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primary,
        },

        toggleRow: {
            minHeight: 76,

            flexDirection: 'row',
            alignItems: 'center',

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
                    .md,

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

        toggleRowDisabled: {
            opacity: 0.55,
        },

        toggleIcon: {
            width: 42,
            height: 42,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,

            alignItems: 'center',
            justifyContent:
                'center',
        },

        toggleTextArea: {
            flex: 1,
        },

        toggleTitle: {
            ...patientOnboardingTheme
                .typography
                .optionTitle,

            color:
                patientOnboardingTheme
                    .colors
                    .text,
        },

        toggleDescription: {
            ...patientOnboardingTheme
                .typography
                .optionDescription,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .xs,
        },

        fieldGroup: {
            width: '100%',
        },

        fieldLabel: {
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

        textInput: {
            width: '100%',

            minHeight: 56,

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

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            fontSize: 17,
            lineHeight: 23,

            paddingHorizontal:
                patientOnboardingTheme
                    .spacing
                    .md,

            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .md,
        },

        textInputMultiline: {
            minHeight: 112,
            textAlignVertical: 'top',
        },

        textInputError: {
            borderColor:
                patientOnboardingTheme
                    .colors
                    .primaryDark,

            borderWidth: 2,
        },

        textInputDisabled: {
            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .disabledBackground,

            color:
                patientOnboardingTheme
                    .colors
                    .disabledText,
        },

        fieldMessageRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',

            gap:
                patientOnboardingTheme
                    .spacing
                    .xs,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        fieldHelper: {
            ...patientOnboardingTheme
                .typography
                .small,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        fieldError: {
            ...patientOnboardingTheme
                .typography
                .small,

            flex: 1,

            color:
                patientOnboardingTheme
                    .colors
                    .primaryDark,
        },

        infoCard: {
            width: '100%',

            flexDirection: 'row',
            alignItems: 'flex-start',

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
                    .md,

            borderWidth: 1,

            borderColor:
                patientOnboardingTheme
                    .colors
                    .border,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .surfaceAlt,
        },

        infoCardCompact: {
            paddingVertical:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },

        infoIcon: {
            width: 38,
            height: 38,

            borderRadius:
                patientOnboardingTheme
                    .radii
                    .pill,

            backgroundColor:
                patientOnboardingTheme
                    .colors
                    .primarySoft,

            alignItems: 'center',
            justifyContent:
                'center',
        },

        infoTextArea: {
            flex: 1,
        },

        infoTitle: {
            ...patientOnboardingTheme
                .typography
                .bodyStrong,

            color:
                patientOnboardingTheme
                    .colors
                    .text,
        },

        infoBody: {
            ...patientOnboardingTheme
                .typography
                .small,

            color:
                patientOnboardingTheme
                    .colors
                    .textMuted,

            marginTop: 2,
        },

        sectionLabel: {
            ...patientOnboardingTheme
                .typography
                .bodyStrong,

            color:
                patientOnboardingTheme
                    .colors
                    .text,

            marginTop:
                patientOnboardingTheme
                    .spacing
                    .sm,

            marginBottom:
                patientOnboardingTheme
                    .spacing
                    .sm,
        },
    });