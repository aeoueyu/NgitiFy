// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';
import SecretaryDashboard from '../screens/secretary/SecretaryDashboard';
import AddPatientScreen from '../screens/secretary/AddPatientScreen';
import OwnerDashboard from '../screens/owner/OwnerDashboard';
import AddDentistScreen from '../screens/owner/AddDentistScreen';
import AddSecretaryScreen from '../screens/owner/AddSecretaryScreen';
import ManagePatientsScreen from '../screens/secretary/ManagePatientsScreen';
import ManageStaffScreen from '../screens/owner/ManageStaffScreen';
import DentistDashboard from '../screens/dentist/DentistDashboard';
import MyPatientsScreen from '../screens/dentist/MyPatientsScreen';
import PatientProfileScreen from '../screens/dentist/PatientProfileScreen';
import OdontogramScreen from '../screens/dentist/OdontogramScreen';
import XRayScreen from '../screens/dentist/XRayScreen';
import TreatmentNotesScreen from '../screens/dentist/TreatmentNotesScreen';
import AddSurgeryScreen from '../screens/dentist/AddSurgeryScreen';
import SurgerySchedulesScreen from '../screens/shared/SurgerySchedulesScreen';
import StaffProfileScreen from '../screens/owner/StaffProfileScreen';
import PatientDetailsScreen from '../screens/secretary/PatientDetailsScreen';
import PatientDashboard from '../screens/patient/PatientDashboard';
import MyProfileScreen from '../screens/patient/MyProfileScreen';
import MedicalRecordsScreen from '../screens/patient/MedicalRecordsScreen';
import PatientBillingScreen from '../screens/patient/PatientBillingScreen';
import BillingManagementScreen from '../screens/secretary/BillingManagementScreen';
import FinancialReportsScreen from '../screens/owner/FinancialReportsScreen';
import ChatbotScreen from '../screens/patient/ChatbotScreen';
import MyEarningsScreen from '../screens/dentist/MyEarningsScreen';
import AuditLogsScreen from '../screens/owner/AuditLogsScreen';
import AIPredictiveScreen from '../screens/dentist/AIPredictiveScreen';
import PatientPredictiveView from '../screens/patient/PatientPredictiveView';
import PatientXRayView from '../screens/patient/PatientXRayView';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import PreOpInstructionsScreen from '../screens/patient/PreOpInstructionsScreen';
import EPrescriptionScreen from '../screens/dentist/EPrescriptionScreen';
import InventoryManagementScreen from '../screens/owner/InventoryManagementScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator();
const SecStack = createNativeStackNavigator();
const OwnerStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();

function SecretaryNavigator() {
    return (
        <SecStack.Navigator screenOptions={{ headerShown: false }}>
            <SecStack.Screen name="SecDashboard" component={SecretaryDashboard} />
            <SecStack.Screen name="AddPatient" component={AddPatientScreen} />
            <SecStack.Screen name="ManagePatients" component={ManagePatientsScreen} />
            <SecStack.Screen name="SurgerySchedules" component={SurgerySchedulesScreen} />
            <SecStack.Screen name="PatientDetails" component={PatientDetailsScreen} />
            <SecStack.Screen name="BillingManagement" component={BillingManagementScreen} />
            <SecStack.Screen name="Settings" component={SettingsScreen} />
            <SecStack.Screen name="EditProfile" component={EditProfileScreen} />
        </SecStack.Navigator>
    );
}

function OwnerNavigator() {
    return (
        <OwnerStack.Navigator screenOptions={{ headerShown: false }}>
            <OwnerStack.Screen name="OwnerDashboardMain" component={OwnerDashboard} />
            <OwnerStack.Screen name="AddDentist" component={AddDentistScreen} />
            <OwnerStack.Screen name="AddSecretary" component={AddSecretaryScreen} />
            <OwnerStack.Screen name="ManageStaff" component={ManageStaffScreen} />
            <OwnerStack.Screen name="StaffProfile" component={StaffProfileScreen} />
            <OwnerStack.Screen name="FinancialReports" component={FinancialReportsScreen} />
            <OwnerStack.Screen name="MyPatients" component={MyPatientsScreen} />
            <OwnerStack.Screen name="PatientProfile" component={PatientProfileScreen} />
            <OwnerStack.Screen name="Odontogram" component={OdontogramScreen} />
            <OwnerStack.Screen name="XRay" component={XRayScreen} />
            <OwnerStack.Screen name="TreatmentNotes" component={TreatmentNotesScreen} />
            <OwnerStack.Screen name="AddSurgery" component={AddSurgeryScreen} />
            <OwnerStack.Screen name="SurgerySchedules" component={SurgerySchedulesScreen} />
            <OwnerStack.Screen name="MyEarnings" component={MyEarningsScreen} />
            <OwnerStack.Screen name="AuditLogs" component={AuditLogsScreen} />
            <OwnerStack.Screen name="AIPredictive" component={AIPredictiveScreen} />
            {/* BAGONG SCREEN PARA KAY OWNER */}
            <OwnerStack.Screen name="InventoryManagement" component={InventoryManagementScreen} />
            <OwnerStack.Screen name="Settings" component={SettingsScreen} />
            <OwnerStack.Screen name="EditProfile" component={EditProfileScreen} />
        </OwnerStack.Navigator>
    );
}

function DentistNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DentistDashboardMain" component={DentistDashboard} />
            <Stack.Screen name="MyPatients" component={MyPatientsScreen} />
            <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
            <Stack.Screen name="Odontogram" component={OdontogramScreen} />
            <Stack.Screen name="XRay" component={XRayScreen} />
            <Stack.Screen name="TreatmentNotes" component={TreatmentNotesScreen} />
            <Stack.Screen name="AddSurgery" component={AddSurgeryScreen} />
            <Stack.Screen name="SurgerySchedules" component={SurgerySchedulesScreen} />
            <Stack.Screen name="MyEarnings" component={MyEarningsScreen} />
            <Stack.Screen name="AIPredictive" component={AIPredictiveScreen} />
            {/* BAGONG SCREEN PARA KAY DENTIST */}
            <Stack.Screen name="EPrescription" component={EPrescriptionScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        </Stack.Navigator>
    );
}

function PatientNavigator() {
    return (
        <PatientStack.Navigator screenOptions={{ headerShown: false }}>
            <PatientStack.Screen name="PatientDashboardMain" component={PatientDashboard} />
            <PatientStack.Screen name="MyProfile" component={MyProfileScreen} />
            <PatientStack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
            <PatientStack.Screen name="PatientBilling" component={PatientBillingScreen} />
            <PatientStack.Screen name="Chatbot" component={ChatbotScreen} />
            <PatientStack.Screen name="PatientPredictiveView" component={PatientPredictiveView} />
            <PatientStack.Screen name="PatientXRayView" component={PatientXRayView} />
            <PatientStack.Screen name="PreOpInstructions" component={PreOpInstructionsScreen} />
            <PatientStack.Screen name="Settings" component={SettingsScreen} />
            <PatientStack.Screen name="EditProfile" component={EditProfileScreen} />
        </PatientStack.Navigator>
    );
}

export default function AppNavigator() {
    const { userToken, userRole } = useContext(AuthContext);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken === null ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    </>
                ) : userRole === 'owner' ? (
                    <Stack.Screen name="OwnerMain" component={OwnerNavigator} />
                ) : userRole === 'dentist' ? (
                    <Stack.Screen name="DentistMain" component={DentistNavigator} />
                ) : userRole === 'secretary' ? (
                    <Stack.Screen name="SecretaryMain" component={SecretaryNavigator} />
                ) : (
                    <Stack.Screen name="PatientMain" component={PatientNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}