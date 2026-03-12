import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

// --- GOOGLE FONTS IMPORTS ---
import { 
  useFonts, 
  LexendDeca_400Regular, 
  LexendDeca_500Medium,
  LexendDeca_600SemiBold, 
  LexendDeca_700Bold, 
  LexendDeca_900Black 
} from '@expo-google-fonts/lexend-deca';

export default function App() {
  // Dito nilo-load yung mga fonts para magamit sa StyleSheet natin
  let [fontsLoaded] = useFonts({
    'LexendDeca-Regular': LexendDeca_400Regular,
    'LexendDeca-Medium': LexendDeca_500Medium,
    'LexendDeca-SemiBold': LexendDeca_600SemiBold,
    'LexendDeca-Bold': LexendDeca_700Bold,
    'LexendDeca-Black': LexendDeca_900Black,
  });

  // Huwag munang i-load ang screen kapag hindi pa tapos mag-download ang font
  if (!fontsLoaded) {
    return null; 
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}