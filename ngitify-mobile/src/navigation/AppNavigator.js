// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

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
import NotificationsScreen from '../screens/patient/NotificationsScreen';
import ActivityLogsScreen from '../screens/patient/ActivityLogsScreen';

// --- SHARED SCREENS ---
import SurgerySchedulesScreen from '../screens/shared/SurgerySchedulesScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();

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

function PatientNavigator() {
    return (
        <PatientStack.Navigator screenOptions={{ headerShown: false }}>
            <PatientStack.Screen name="PatientDashboardMain" component={PatientDashboard} />
            <PatientStack.Screen name="MyProfile" component={MyProfileScreen} />
            <PatientStack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
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
    const { userToken, userInfo } = useContext(AuthContext);
    const needsAppConsent = Boolean(userToken) && !userInfo?.appConsentGiven;

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
