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
import AppModalProvider
    from './src/components/AppModalProvider';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <AppModalProvider>
                    <PatientOnboardingProvider>
                        <AppNavigator />
                    </PatientOnboardingProvider>
                </AppModalProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
