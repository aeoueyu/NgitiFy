// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import PatientBottomNav from '../components/mobile/PatientBottomNav';

// --- AUTH SCREENS ---
import LoginScreen from '../screens/auth/LoginScreen';
import AppPrivacyConsentScreen from '../screens/auth/AppPrivacyConsentScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// --- PATIENT SCREENS ---
import PatientDashboard from '../screens/patient/PatientDashboard';
import MyProfileScreen from '../screens/patient/MyProfileScreen';
import MedicalRecordsScreen from '../screens/patient/MedicalRecordsScreen';
import ChatbotScreen from '../screens/patient/ChatbotScreen';
import AiPatientCareCompanionScreen from '../screens/patient/AIPatientCareCompanionScreen';
import PatientXRayView from '../screens/patient/PatientXRayView';
import PreOpInstructionsScreen from '../screens/patient/PreOpInstructionsScreen';
import AppointmentBookingScreen from '../screens/patient/AppointmentBookingScreen';
import PatientAppointmentsScreen from '../screens/patient/PatientAppointmentsScreen';
import NotificationsScreen from '../screens/patient/NotificationsScreen';
import ActivityLogsScreen from '../screens/patient/ActivityLogsScreen';

// --- SHARED SCREENS ---
import SurgerySchedulesScreen from '../screens/shared/SurgerySchedulesScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();
const PatientTabs = createBottomTabNavigator();

// --- NAVIGATORS ---

function AuthNavigator() {
    return (
        <AuthStack.Navigator
            initialRouteName="Login"
            screenOptions={{ headerShown: false }}
        >
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </AuthStack.Navigator>
    );
}

function PatientTabsNavigator() {
    return (
        <PatientTabs.Navigator
            initialRouteName="PatientDashboardMain"
            backBehavior="history"
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <PatientBottomNav {...props} />}
        >
            <PatientTabs.Screen name="PatientDashboardMain" component={PatientDashboard} />
            <PatientTabs.Screen name="MyAppointments" component={PatientAppointmentsScreen} />
            <PatientTabs.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
            <PatientTabs.Screen name="MyProfile" component={MyProfileScreen} />
        </PatientTabs.Navigator>
    );
}

function PatientNavigator() {
    return (
        <PatientStack.Navigator screenOptions={{ headerShown: false }}>
            <PatientStack.Screen name="PatientTabs" component={PatientTabsNavigator} />
            <PatientStack.Screen name="Chatbot" component={ChatbotScreen} />
            {/* FR#5 — AI Patient Care Companion (replaces PatientPredictiveView) */}
            <PatientStack.Screen name="AiPatientCareCompanion" component={AiPatientCareCompanionScreen} />
            {/* X-Ray View — accessed from EMR Radiograph tab */}
            <PatientStack.Screen name="PatientXRayView" component={PatientXRayView} />
            <PatientStack.Screen name="PreOpInstructions" component={PreOpInstructionsScreen} />
            <PatientStack.Screen name="AppointmentBooking" component={AppointmentBookingScreen} />
            <PatientStack.Screen name="SurgerySchedules" component={SurgerySchedulesScreen} />
            <PatientStack.Screen name="Settings" component={SettingsScreen} />
            <PatientStack.Screen name="EditProfile" component={EditProfileScreen} />
            <PatientStack.Screen name="Notifications" component={NotificationsScreen} />
            <PatientStack.Screen name="ActivityLogs" component={ActivityLogsScreen} />
        </PatientStack.Navigator>
    );
}

// --- MAIN APP NAVIGATOR ---
export default function AppNavigator() {
    const { userToken, userInfo, isLoading } = useContext(AuthContext);
    const needsAppConsent = Boolean(userToken) && Boolean(userInfo) && !userInfo?.appConsentGiven;

    if (isLoading) {
        return null;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken ? (
                    needsAppConsent ? (
                        <Stack.Screen name="AppPrivacyConsent" component={AppPrivacyConsentScreen} />
                    ) : (
                    <Stack.Screen name="PatientApp" component={PatientNavigator} />
                    )
                ) : (
                    <Stack.Screen name="Auth" component={AuthNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
