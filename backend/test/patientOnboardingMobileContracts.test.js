const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const REPO_ROOT =
    path.resolve(
        __dirname,
        '..',
        '..'
    );

const readRepoFile = (
    relativePath
) =>
    fs.readFileSync(
        path.join(
            REPO_ROOT,
            relativePath
        ),
        'utf8'
    );

const APP_FILE =
    readRepoFile(
        'ngitify-mobile/App.js'
    );

const NAVIGATOR_FILE =
    readRepoFile(
        'ngitify-mobile/src/navigation/AppNavigator.js'
    );

const ONBOARDING_CONTEXT_FILE =
    readRepoFile(
        'ngitify-mobile/src/context/PatientOnboardingContext.js'
    );

const ONBOARDING_SHELL_FILE =
    readRepoFile(
        'ngitify-mobile/src/components/onboarding/PatientOnboardingShell.js'
    );

const ONBOARDING_CONTROLS_FILE =
    readRepoFile(
        'ngitify-mobile/src/components/onboarding/PatientOnboardingControls.js'
    );

const WELCOME_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingWelcomeScreen.js'
    );

const PREFERRED_NAME_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingPreferredNameScreen.js'
    );

const HELP_FOCUS_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingHelpFocusScreen.js'
    );

const ONBOARDING_OPTIONS_FILE =
    readRepoFile(
        'ngitify-mobile/src/data/patientOnboardingOptions.js'
    );

const ROUTINE_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingRoutineScreen.js'
    );

const EXPERIENCE_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingExperienceScreen.js'
    );

const NOTIFICATIONS_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingNotificationsScreen.js'
    );

const PRIVACY_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingPrivacyScreen.js'
    );

const READY_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingReadyScreen.js'
    );

const LOAD_ERROR_FILE =
    readRepoFile(
        'ngitify-mobile/src/screens/onboarding/OnboardingLoadErrorScreen.js'
    );

const ALL_ONBOARDING_SCREEN_FILES = [
    WELCOME_FILE,
    PREFERRED_NAME_FILE,
    HELP_FOCUS_FILE,
    ROUTINE_FILE,
    EXPERIENCE_FILE,
    NOTIFICATIONS_FILE,
    PRIVACY_FILE,
    READY_FILE,
    LOAD_ERROR_FILE,
].join('\n');

test(
    'Mobile app mounts PatientOnboardingProvider inside AuthProvider',
    () => {
        const authProviderIndex =
            APP_FILE.indexOf(
                '<AuthProvider>'
            );

        const onboardingProviderIndex =
            APP_FILE.indexOf(
                '<PatientOnboardingProvider>'
            );

        const appNavigatorIndex =
            APP_FILE.indexOf(
                '<AppNavigator'
            );

        assert.ok(
            authProviderIndex >= 0,
            'AuthProvider must exist.'
        );

        assert.ok(
            onboardingProviderIndex
            > authProviderIndex,
            'PatientOnboardingProvider must be inside AuthProvider.'
        );

        assert.ok(
            appNavigatorIndex
            > onboardingProviderIndex,
            'AppNavigator must be inside PatientOnboardingProvider.'
        );
    }
);

test(
    'existing app privacy consent remains ahead of first-time onboarding',
    () => {
        assert.match(
            NAVIGATOR_FILE,
            /needsAppConsent/
        );

        assert.match(
            NAVIGATOR_FILE,
            /AppPrivacyConsentScreen/
        );

        assert.match(
            NAVIGATOR_FILE,
            /needsOnboarding/
        );

        const consentBranch =
            NAVIGATOR_FILE.indexOf(
                ') : needsAppConsent ? ('
            );

        const onboardingBranch =
            NAVIGATOR_FILE.indexOf(
                ') : needsOnboarding ? ('
            );

        assert.ok(
            consentBranch >= 0,
            'Consent navigation branch must exist.'
        );

        assert.ok(
            onboardingBranch
            > consentBranch,
            'App privacy consent must be evaluated before onboarding.'
        );
    }
);

test(
    'all required onboarding screens remain registered',
    () => {
        const requiredScreens = [
            'OnboardingWelcome',
            'OnboardingPreferredName',
            'OnboardingHelpFocus',
            'OnboardingRoutine',
            'OnboardingExperience',
            'OnboardingNotifications',
            'OnboardingPrivacy',
            'OnboardingReady',
        ];

        requiredScreens.forEach(
            (
                screen
            ) => {
                assert.match(
                    NAVIGATOR_FILE,
                    new RegExp(
                        `name="${screen}"`
                    ),
                    `${screen} must remain registered.`
                );
            }
        );
    }
);

test(
    'Patient onboarding state is loaded from backend instead of local completion storage',
    () => {
        assert.match(
            ONBOARDING_CONTEXT_FILE,
            /\/api\/my\/onboarding/
        );

        assert.match(
            ONBOARDING_CONTEXT_FILE,
            /hasLoadedOnboarding/
        );

        assert.match(
            NAVIGATOR_FILE,
            /hasLoadedOnboarding/
        );

        assert.doesNotMatch(
            ONBOARDING_CONTEXT_FILE,
            /AsyncStorage\.setItem/
        );

        assert.doesNotMatch(
            ALL_ONBOARDING_SCREEN_FILES,
            /patientOnboardingCompleted/
        );

        assert.doesNotMatch(
            ALL_ONBOARDING_SCREEN_FILES,
            /onboardingCompleted/
        );
    }
);

test(
    'onboarding completion uses the backend completion endpoint',
    () => {
        assert.match(
            ONBOARDING_CONTEXT_FILE,
            /\/api\/my\/onboarding\/complete/
        );

        assert.match(
            ONBOARDING_CONTEXT_FILE,
            /completeOnboarding/
        );

        assert.match(
            READY_FILE,
            /completeOnboarding/
        );
    }
);

test(
    'Ready screen reuses existing Oral Health Management instead of creating another logger',
    () => {
        assert.match(
            READY_FILE,
            /Log Today's Oral Health/
        );

        assert.match(
            READY_FILE,
            /oral-health/
        );

        assert.match(
            NAVIGATOR_FILE,
            /postOnboardingDestination/
        );

        assert.match(
            NAVIGATOR_FILE,
            /OralCareInsights/
        );

        assert.doesNotMatch(
            READY_FILE,
            /\/api\/my\/oral-health\/logs/
        );

        assert.doesNotMatch(
            ALL_ONBOARDING_SCREEN_FILES,
            /\/api\/my\/oral-health\/logs/
        );
    }
);

test(
    'onboarding personalization never writes Daily Oral Health Log fields',
    () => {
        const forbiddenPatterns = [
            /symptomDetails/,
            /logDate\s*:/,
            /riskFactors\s*:/,
            /dailyCare\s*:/,
            /\/api\/my\/oral-health\/logs/,
        ];

        forbiddenPatterns.forEach(
            (
                pattern
            ) => {
                assert.doesNotMatch(
                    ALL_ONBOARDING_SCREEN_FILES,
                    pattern
                );

                assert.doesNotMatch(
                    ONBOARDING_CONTEXT_FILE,
                    pattern
                );
            }
        );
    }
);

test(
    'tooth sensitivity onboarding remains an education interest rather than a diagnosis',
    () => {
        assert.match(
            ONBOARDING_OPTIONS_FILE,
            /id:\s*'tooth-sensitivity'/
        );

        assert.match(
            ONBOARDING_OPTIONS_FILE,
            /Understand tooth sensitivity/
        );

        assert.match(
            HELP_FOCUS_FILE,
            /HELP_FOCUS_OPTIONS/
        );

        assert.match(
            HELP_FOCUS_FILE,
            /educationInterests/
        );

        assert.match(
            HELP_FOCUS_FILE,
            /prioritize general Dental Health Education/
        );

        assert.match(
            HELP_FOCUS_FILE,
            /does not create an Oral Health Management symptom/
        );

        assert.doesNotMatch(
            ONBOARDING_OPTIONS_FILE,
            /diagnosed\s*:/i
        );

        assert.doesNotMatch(
            HELP_FOCUS_FILE,
            /diagnosed\s*:/i
        );
    }
);

test(
    'routine onboarding does not create an oral-health score or alter visit recommendations',
    () => {
        assert.match(
            ROUTINE_FILE,
            /does not calculate an oral-health score/
        );

        assert.match(
            ROUTINE_FILE,
            /do not change a Dentist's recommended visit/
        );

        assert.doesNotMatch(
            ROUTINE_FILE,
            /score\s*=\s*/
        );

        assert.doesNotMatch(
            ROUTINE_FILE,
            /visitPrediction\s*=/
        );
    }
);

test(
    'notification onboarding uses all five real Patient settings',
    () => {
        const settings = [
            'notifAppointments',
            'notifVisitWindow',
            'notifOralHealthDaily',
            'notifSymptomFollowUp',
            'notifHealthTips',
        ];

        settings.forEach(
            (
                setting
            ) => {
                assert.match(
                    NOTIFICATIONS_FILE,
                    new RegExp(
                        setting
                    )
                );

                assert.match(
                    ONBOARDING_CONTEXT_FILE,
                    new RegExp(
                        setting
                    )
                );
            }
        );

        assert.match(
            ONBOARDING_CONTEXT_FILE,
            /\/api\/my\/settings/
        );
    }
);

test(
    'notification onboarding does not pretend native push permission exists',
    () => {
        assert.doesNotMatch(
            NOTIFICATIONS_FILE,
            /expo-notifications/
        );

        assert.doesNotMatch(
            NOTIFICATIONS_FILE,
            /requestPermissionsAsync/
        );

        assert.doesNotMatch(
            ONBOARDING_CONTEXT_FILE,
            /requestPermissionsAsync/
        );
    }
);

test(
    'required project terminology remains intact throughout onboarding',
    () => {
        assert.match(
            ALL_ONBOARDING_SCREEN_FILES,
            /Oral Health Management/
        );

        assert.match(
            ALL_ONBOARDING_SCREEN_FILES,
            /Dental Health Education/
        );

        assert.doesNotMatch(
            ALL_ONBOARDING_SCREEN_FILES,
            /Oral Health Tracker/
        );

        assert.doesNotMatch(
            ALL_ONBOARDING_SCREEN_FILES,
            /Dental Education/
        );
    }
);

test(
    'onboarding shell remains safe-area, keyboard, scroll, and small-device aware',
    () => {
        assert.match(
            ONBOARDING_SHELL_FILE,
            /SafeAreaView/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /KeyboardAvoidingView/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /ScrollView/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /useWindowDimensions/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /isCompact/
        );
    }
);

test(
    'onboarding controls expose accessible state beyond color alone',
    () => {
        assert.match(
            ONBOARDING_CONTROLS_FILE,
            /accessibilityRole/
        );

        assert.match(
            ONBOARDING_CONTROLS_FILE,
            /accessibilityState/
        );

        assert.match(
            ONBOARDING_CONTROLS_FILE,
            /checkmark/
        );

        assert.match(
            ONBOARDING_CONTROLS_FILE,
            /borderWidth/
        );

        assert.match(
            ONBOARDING_CONTROLS_FILE,
            /selectionIndicator/
        );
    }
);

test(
    'onboarding progress remains accessible',
    () => {
        assert.match(
            ONBOARDING_SHELL_FILE,
            /accessibilityRole="progressbar"/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /accessibilityValue/
        );

        assert.match(
            ONBOARDING_SHELL_FILE,
            /Step \$\{currentStep\} of \$\{totalSteps\}/
        );
    }
);

test(
    'core Patient Mobile destinations remain registered after onboarding integration',
    () => {
        const requiredRoutes = [
            'PatientDashboardMain',
            'OralCareInsights',
            'MyAppointments',
            'MedicalRecords',
            'MyProfile',
            'AiPatientCareCompanion',
            'Notifications',
        ];

        requiredRoutes.forEach(
            (
                route
            ) => {
                assert.match(
                    NAVIGATOR_FILE,
                    new RegExp(
                        route
                    ),
                    `${route} must remain available.`
                );
            }
        );
    }
);

test(
    'onboarding load failure provides retry and temporary core-access fallback',
    () => {
        assert.match(
            LOAD_ERROR_FILE,
            /Try Again/
        );

        assert.match(
            LOAD_ERROR_FILE,
            /Continue to Dashboard/
        );

        assert.match(
            NAVIGATOR_FILE,
            /sessionBypass/
        );

        assert.doesNotMatch(
            LOAD_ERROR_FILE,
            /completeOnboarding/
        );

        assert.doesNotMatch(
            LOAD_ERROR_FILE,
            /\/api\/my\/onboarding\/complete/
        );
    }
);

test(
    'onboarding load failure bypass is session-only and resets with authentication session',
    () => {
        assert.match(
            NAVIGATOR_FILE,
            /setSessionBypass/
        );

        assert.match(
            NAVIGATOR_FILE,
            /\[\s*userToken,\s*\]/
        );

        assert.doesNotMatch(
            NAVIGATOR_FILE,
            /AsyncStorage/
        );
    }
);

test(
    'preferred-name onboarding does not update legal Patient identity',
    () => {
        assert.match(
            PREFERRED_NAME_FILE,
            /preferredName/
        );

        assert.doesNotMatch(
            PREFERRED_NAME_FILE,
            /name\.first/
        );

        assert.doesNotMatch(
            PREFERRED_NAME_FILE,
            /name\.last/
        );

        assert.doesNotMatch(
            PREFERRED_NAME_FILE,
            /\/api\/user\//
        );
    }
);

test(
    'privacy onboarding does not replace mandatory app consent',
    () => {
        assert.match(
            PRIVACY_FILE,
            /required NgitiFy app privacy consent remains the existing account-level consent/
        );

        assert.doesNotMatch(
            PRIVACY_FILE,
            /\/api\/user\/app-consent/
        );

        assert.match(
            NAVIGATOR_FILE,
            /AppPrivacyConsentScreen/
        );
    }
);