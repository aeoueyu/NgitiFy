import { mobileTheme } from './mobileTheme';

export const patientOnboardingTheme = {
    colors: {
        background:
            mobileTheme.colors.background,

        backgroundMuted:
            mobileTheme.colors.backgroundMuted,

        surface:
            mobileTheme.colors.surface,

        surfaceAlt:
            mobileTheme.colors.surfaceAlt,

        border:
            mobileTheme.colors.border,

        borderStrong:
            mobileTheme.colors.borderStrong,

        text:
            mobileTheme.colors.text,

        textMuted:
            mobileTheme.colors.textMuted,

        textSoft:
            mobileTheme.colors.textSoft,

        primary:
            mobileTheme.colors.primary,

        primaryDark:
            mobileTheme.colors.primaryDark,

        primarySoft:
            mobileTheme.colors.primarySoft,

        accent:
            mobileTheme.colors.accent,

        accentDark:
            mobileTheme.colors.secondaryDark,

        accentSoft:
            mobileTheme.colors.secondarySoft,

        success:
            mobileTheme.colors.success,

        successSoft:
            mobileTheme.colors.successSoft,

        overlay:
            mobileTheme.colors.overlay,

        disabledBackground:
            mobileTheme.colors.backgroundMuted,

        disabledText:
            mobileTheme.colors.textSoft,

        selectedSurface:
            mobileTheme.colors.primarySoft,
    },

    spacing: {
        xs: 6,
        sm: 10,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
        xxxl: 40,
    },

    radii: {
        sm:
            mobileTheme.radii.sm,

        md:
            mobileTheme.radii.md,

        lg:
            mobileTheme.radii.lg,

        xl: 28,

        pill:
            mobileTheme.radii.pill,
    },

    typography: {
        eyebrow: {
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '800',
            letterSpacing: 0.8,
        },

        title: {
            fontSize: 32,
            lineHeight: 39,
            fontWeight: '800',
        },

        subtitle: {
            fontSize: 17,
            lineHeight: 25,
            fontWeight: '400',
        },

        body: {
            fontSize: 16,
            lineHeight: 24,
            fontWeight: '400',
        },

        bodyStrong: {
            fontSize: 16,
            lineHeight: 23,
            fontWeight: '700',
        },

        small: {
            fontSize: 13,
            lineHeight: 19,
            fontWeight: '400',
        },

        button: {
            fontSize: 16,
            lineHeight: 21,
            fontWeight: '800',
        },

        optionTitle: {
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '700',
        },

        optionDescription: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '400',
        },
    },

    layout: {
        horizontalPadding: 24,

        compactHorizontalPadding: 18,

        contentMaxWidth: 640,

        minimumTouchTarget: 48,

        primaryButtonHeight: 56,

        progressHeight: 5,

        optionMinHeight: 64,
    },

    shadows: {
        card:
            mobileTheme.shadows.card,

        soft:
            mobileTheme.shadows.soft,
    },
};

export default patientOnboardingTheme;