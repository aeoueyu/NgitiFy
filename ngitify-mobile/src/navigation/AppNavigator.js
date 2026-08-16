// src/navigation/AppNavigator.js

import React, {
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    NavigationContainer,
} from '@react-navigation/native';

import {
    createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
    createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
    AuthContext,
} from '../context/AuthContext';

import {
    PatientOnboardingContext,
} from '../context/PatientOnboardingContext';

import {
    mobileTheme,
} from '../theme/mobileTheme';

import PatientBottomNav
    from '../components/mobile/PatientBottomNav';

// --- AUTH SCREENS ---

import LoginScreen
    from '../screens/auth/LoginScreen';

import AppPrivacyConsentScreen
    from '../screens/auth/AppPrivacyConsentScreen';

import ForgotPasswordScreen
    from '../screens/auth/ForgotPasswordScreen';

// --- ONBOARDING SCREENS ---

import OnboardingWelcomeScreen
    from '../screens/onboarding/OnboardingWelcomeScreen';

import OnboardingPreferredNameScreen
    from '../screens/onboarding/OnboardingPreferredNameScreen';

import OnboardingHelpFocusScreen
    from '../screens/onboarding/OnboardingHelpFocusScreen';

import OnboardingRoutineScreen
    from '../screens/onboarding/OnboardingRoutineScreen';

import OnboardingExperienceScreen
    from '../screens/onboarding/OnboardingExperienceScreen';

import OnboardingNotificationsScreen
    from '../screens/onboarding/OnboardingNotificationsScreen';

import OnboardingPrivacyScreen
    from '../screens/onboarding/OnboardingPrivacyScreen';

import OnboardingReadyScreen
    from '../screens/onboarding/OnboardingReadyScreen';

import OnboardingLoadErrorScreen
    from '../screens/onboarding/OnboardingLoadErrorScreen';

// --- PATIENT SCREENS ---

import PatientDashboard
    from '../screens/patient/PatientDashboard';

import MyProfileScreen
    from '../screens/patient/MyProfileScreen';

import MedicalRecordsScreen
    from '../screens/patient/MedicalRecordsScreen';

import AiPatientCareCompanionScreen
    from '../screens/patient/AIPatientCareCompanionScreen';

import OralCareInsightsScreen
    from '../screens/patient/OralCareInsightsScreen';

import PatientXRayView
    from '../screens/patient/PatientXRayView';

import PreOpInstructionsScreen
    from '../screens/patient/PreOpInstructionsScreen';

import AppointmentBookingScreen
    from '../screens/patient/AppointmentBookingScreen';

import PatientAppointmentsScreen
    from '../screens/patient/PatientAppointmentsScreen';

import NotificationsScreen
    from '../screens/patient/NotificationsScreen';

import ActivityLogsScreen
    from '../screens/patient/ActivityLogsScreen';

// --- SHARED SCREENS ---

import SurgerySchedulesScreen
    from '../screens/shared/SurgerySchedulesScreen';

import SettingsScreen
    from '../screens/shared/SettingsScreen';

import EditProfileScreen
    from '../screens/shared/EditProfileScreen';

const Stack =
    createNativeStackNavigator();

const AuthStack =
    createNativeStackNavigator();

const PatientStack =
    createNativeStackNavigator();

const ProfileStack =
    createNativeStackNavigator();

const PatientTabs =
    createBottomTabNavigator();

const OnboardingStack =
    createNativeStackNavigator();

const getResumeRoute = (
    onboardingState
) => {
    const currentStep =
        Number(
            onboardingState
                ?.currentStep
            || 0
        );

    if (
        currentStep >= 7
    ) {
        return 'OnboardingReady';
    }

    if (
        currentStep >= 6
    ) {
        return 'OnboardingPrivacy';
    }

    if (
        currentStep >= 5
    ) {
        return 'OnboardingNotifications';
    }

    if (
        currentStep >= 4
    ) {
        return 'OnboardingExperience';
    }

    if (
        currentStep >= 3
    ) {
        return 'OnboardingRoutine';
    }

    if (
        currentStep >= 2
    ) {
        return 'OnboardingHelpFocus';
    }

    if (
        currentStep >= 1
    ) {
        return 'OnboardingPreferredName';
    }

    return 'OnboardingWelcome';
};

// --- NAVIGATORS ---

function AuthNavigator() {
    return (
        <AuthStack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerShown:
                    false,
            }}
        >
            <AuthStack.Screen
                name="Login"
                component={
                    LoginScreen
                }
            />

            <AuthStack.Screen
                name="ForgotPassword"
                component={
                    ForgotPasswordScreen
                }
            />
        </AuthStack.Navigator>
    );
}

function PatientTabsNavigator() {
    const {
        postOnboardingDestination,
    } = useContext(
        PatientOnboardingContext
    );

    const initialRouteName =
        postOnboardingDestination
        === 'oral-health'
            ? 'OralCareInsights'
            : 'PatientDashboardMain';

    return (
        <PatientTabs.Navigator
            initialRouteName={
                initialRouteName
            }
            backBehavior="history"
            screenOptions={{
                headerShown:
                    false,
            }}
            tabBar={
                (
                    props
                ) => (
                    <PatientBottomNav
                        {...props}
                    />
                )
            }
        >
            <PatientTabs.Screen
                name="PatientDashboardMain"
                component={
                    PatientDashboard
                }
            />

            <PatientTabs.Screen
                name="OralCareInsights"
                component={
                    OralCareInsightsScreen
                }
                initialParams={{
                    initialTab:
                        'today',
                }}
            />

            <PatientTabs.Screen
                name="MyAppointments"
                component={
                    PatientAppointmentsScreen
                }
            />

            <PatientTabs.Screen
                name="MedicalRecords"
                component={
                    MedicalRecordsScreen
                }
            />

            <PatientTabs.Screen
                name="MyProfile"
                component={
                    PatientProfileNavigator
                }
            />
        </PatientTabs.Navigator>
    );
}

function PatientProfileNavigator() {
    return (
        <ProfileStack.Navigator
            screenOptions={{
                headerShown:
                    false,
            }}
        >
            <ProfileStack.Screen
                name="MyProfileHome"
                component={
                    MyProfileScreen
                }
            />

            <ProfileStack.Screen
                name="Settings"
                component={
                    SettingsScreen
                }
            />

            <ProfileStack.Screen
                name="EditProfile"
                component={
                    EditProfileScreen
                }
            />

            <ProfileStack.Screen
                name="ActivityLogs"
                component={
                    ActivityLogsScreen
                }
            />
        </ProfileStack.Navigator>
    );
}

function PatientNavigator() {
    return (
        <PatientStack.Navigator
            screenOptions={{
                headerShown:
                    false,
            }}
        >
            <PatientStack.Screen
                name="PatientTabs"
                component={
                    PatientTabsNavigator
                }
            />

            <PatientStack.Screen
                name="AiPatientCareCompanion"
                component={
                    AiPatientCareCompanionScreen
                }
            />

            <PatientStack.Screen
                name="PatientXRayView"
                component={
                    PatientXRayView
                }
            />

            <PatientStack.Screen
                name="PreOpInstructions"
                component={
                    PreOpInstructionsScreen
                }
            />

            <PatientStack.Screen
                name="AppointmentBooking"
                component={
                    AppointmentBookingScreen
                }
            />

            <PatientStack.Screen
                name="SurgerySchedules"
                component={
                    SurgerySchedulesScreen
                }
            />

            <PatientStack.Screen
                name="Notifications"
                component={
                    NotificationsScreen
                }
            />
        </PatientStack.Navigator>
    );
}

function PatientOnboardingNavigator({
    onboardingState,
}) {
    const initialRouteName =
        useMemo(
            () =>
                getResumeRoute(
                    onboardingState
                ),
            [
                onboardingState,
            ]
        );

    return (
        <OnboardingStack.Navigator
            initialRouteName={
                initialRouteName
            }
            screenOptions={{
                headerShown:
                    false,

                gestureEnabled:
                    true,

                animation:
                    'slide_from_right',
            }}
        >
            <OnboardingStack.Screen
                name="OnboardingWelcome"
                component={
                    OnboardingWelcomeScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingPreferredName"
                component={
                    OnboardingPreferredNameScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingHelpFocus"
                component={
                    OnboardingHelpFocusScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingRoutine"
                component={
                    OnboardingRoutineScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingExperience"
                component={
                    OnboardingExperienceScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingNotifications"
                component={
                    OnboardingNotificationsScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingPrivacy"
                component={
                    OnboardingPrivacyScreen
                }
            />

            <OnboardingStack.Screen
                name="OnboardingReady"
                component={
                    OnboardingReadyScreen
                }
                options={{
                    gestureEnabled:
                        false,
                }}
            />
        </OnboardingStack.Navigator>
    );
}

function FullScreenLoading({
    message =
        'Loading your NgitiFy account…',
}) {
    return (
        <View
            style={
                styles.loadingScreen
            }
            accessibilityRole="progressbar"
            accessibilityLabel={
                message
            }
        >
            <ActivityIndicator
                size="large"
                color={
                    mobileTheme
                        .colors
                        .primary
                }
            />

            <Text
                style={
                    styles.loadingText
                }
            >
                {message}
            </Text>
        </View>
    );
}

// --- MAIN APP NAVIGATOR ---

export default function AppNavigator() {
    const {
        userToken,
        userInfo,
        isLoading:
            authIsLoading,
    } = useContext(
        AuthContext
    );

    const {
        onboardingState,
        hasLoadedOnboarding,
        isLoading:
            onboardingIsLoading,
        error:
            onboardingError,
        loadOnboarding,
    } = useContext(
        PatientOnboardingContext
    );

    const [
        sessionBypass,
        setSessionBypass,
    ] = useState(false);

    useEffect(
        () => {
            /*
             * A temporary "Continue to Dashboard" bypass is
             * valid only for the current authenticated session.
             */
            setSessionBypass(
                false
            );
        },
        [
            userToken,
        ]
    );

    const needsAppConsent =
        Boolean(userToken)
        && Boolean(userInfo)
        && !userInfo
            ?.appConsentGiven;

    const canEvaluateOnboarding =
        Boolean(userToken)
        && Boolean(userInfo)
        && userInfo
            ?.appConsentGiven;

    const onboardingLoadFailed =
        canEvaluateOnboarding
        && hasLoadedOnboarding
        && !onboardingState
        && Boolean(
            onboardingError
        );

    const needsOnboarding =
        canEvaluateOnboarding
        && hasLoadedOnboarding
        && Boolean(
            onboardingState
        )
        && onboardingState
            ?.required
        === true
        && onboardingState
            ?.completed
        !== true
        && !sessionBypass;

    if (
        authIsLoading
    ) {
        return (
            <FullScreenLoading />
        );
    }

    if (
        canEvaluateOnboarding
        && (
            onboardingIsLoading
            || !hasLoadedOnboarding
        )
    ) {
        return (
            <FullScreenLoading
                message="Preparing your Patient experience…"
            />
        );
    }

    if (
        onboardingLoadFailed
        && !sessionBypass
    ) {
        return (
            <OnboardingLoadErrorScreen
                message={
                    onboardingError
                }
                isRetrying={
                    onboardingIsLoading
                }
                onRetry={
                    () => {
                        loadOnboarding()
                            .catch(
                                () => {
                                    /*
                                     * Error remains visible
                                     * through context.
                                     */
                                }
                            );
                    }
                }
                onContinue={
                    () =>
                        setSessionBypass(
                            true
                        )
                }
            />
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown:
                        false,
                }}
            >
                {!userToken ? (
                    <Stack.Screen
                        name="Auth"
                        component={
                            AuthNavigator
                        }
                    />
                ) : needsAppConsent ? (
                    <Stack.Screen
                        name="AppPrivacyConsent"
                        component={
                            AppPrivacyConsentScreen
                        }
                    />
                ) : needsOnboarding ? (
                    <Stack.Screen
                        name="PatientOnboarding"
                    >
                        {
                            () => (
                                <PatientOnboardingNavigator
                                    onboardingState={
                                        onboardingState
                                    }
                                />
                            )
                        }
                    </Stack.Screen>
                ) : (
                    <Stack.Screen
                        name="PatientApp"
                        component={
                            PatientNavigator
                        }
                    />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles =
    StyleSheet.create({
        loadingScreen: {
            flex: 1,

            alignItems:
                'center',

            justifyContent:
                'center',

            gap: 16,

            padding: 24,

            backgroundColor:
                mobileTheme
                    .colors
                    .background,
        },

        loadingText: {
            color:
                mobileTheme
                    .colors
                    .textMuted,

            fontSize: 15,

            lineHeight: 22,

            textAlign:
                'center',
        },
    });