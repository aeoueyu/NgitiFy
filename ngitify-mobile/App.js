import React from 'react';

import {
    SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
    AuthProvider,
} from './src/context/AuthContext';

import {
    PatientOnboardingProvider,
} from './src/context/PatientOnboardingContext';

import AppNavigator
    from './src/navigation/AppNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <PatientOnboardingProvider>
                    <AppNavigator />
                </PatientOnboardingProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}