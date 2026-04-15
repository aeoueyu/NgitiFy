// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

// --- AUTH SCREENS ---
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// --- PATIENT SCREENS ---
import PatientDashboard from '../screens/patient/PatientDashboard';
import MyProfileScreen from '../screens/patient/MyProfileScreen';
import MedicalRecordsScreen from '../screens/patient/MedicalRecordsScreen';
import ChatbotScreen from '../screens/patient/ChatbotScreen';
import PatientPredictiveView from '../screens/patient/PatientPredictiveView';
import PatientXRayView from '../screens/patient/PatientXRayView';
import PreOpInstructionsScreen from '../screens/patient/PreOpInstructionsScreen';
import AppointmentBookingScreen from '../screens/patient/AppointmentBookingScreen'; // FR#4

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
            <PatientStack.Screen name="PatientPredictiveView" component={PatientPredictiveView} />
            <PatientStack.Screen name="PatientXRayView" component={PatientXRayView} />
            <PatientStack.Screen name="PreOpInstructions" component={PreOpInstructionsScreen} />
            <PatientStack.Screen name="AppointmentBooking" component={AppointmentBookingScreen} />
            <PatientStack.Screen name="SurgerySchedules" component={SurgerySchedulesScreen} />
            <PatientStack.Screen name="Settings" component={SettingsScreen} />
            <PatientStack.Screen name="EditProfile" component={EditProfileScreen} />
        </PatientStack.Navigator>
    );
}

// --- MAIN APP NAVIGATOR ---
export default function AppNavigator() {
    const { userToken } = useContext(AuthContext);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken === null ? (
                    <Stack.Screen name="AuthMain" component={AuthNavigator} />
                ) : (
                    <Stack.Screen name="PatientMain" component={PatientNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}