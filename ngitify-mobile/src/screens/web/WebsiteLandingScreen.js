import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageBackground, useWindowDimensions, Platform } from 'react-native';

export default function WebsiteLandingScreen({ navigation }) {
  // Kinukuha natin ang lapad ng screen para maging responsive
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; 

  return (
    <View style={styles.mainContainer}>
      {/* BACKGROUND - Gumamit tayo ng ImageBackground para ipalit sa CSS background-image */}
      <ImageBackground 
        source={require('../../assets/welcome/background1.png')} // Mas okay kung PNG/JPG na ito imbes na SVG para sa background
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        
        {/* TOP BAR */}
        <View style={[styles.topBar, { paddingHorizontal: isDesktop ? 80 : 20 }]}>
          {/* Kung SVG ang logo, baka kailanganin mo ang View wrapper technique na ginawa natin kanina */}
          <Image 
            source={require('../../assets/logo-greenpink.png')} 
            style={styles.logo} 
            resizeMode="contain" 
          />
          <TouchableOpacity 
            style={styles.loginButtonNav} 
            onPress={() => navigation.navigate('Login')} // Papunta sa iyong Login Screen
          >
            <Text style={styles.loginButtonNavText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* HERO SECTION */}
        <View style={[styles.heroContainer, { paddingHorizontal: isDesktop ? 80 : 20 }]}>
          <View style={styles.introSection}>
            <Text style={styles.introTitle}>
              Ngiti<Text style={styles.pinkText}>Fy</Text>
            </Text>
            <Text style={styles.introSubtitle}>Modern Dental Management</Text>
            <Text style={styles.introDescription}>
              Experience seamless dental care management with AI and visual outcome simulation.
            </Text>
            
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.ctaButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  logo: {
    width: 150,
    height: 50,
  },
  loginButtonNav: {
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#005466',
  },
  loginButtonNavText: {
    color: '#005466',
    fontWeight: 'bold',
    fontSize: 14,
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center', // Para pumagitna patayo
  },
  introSection: {
    maxWidth: 650,
  },
  introTitle: {
    fontSize: 60,
    fontWeight: '900',
    color: '#005466',
  },
  pinkText: {
    color: '#ea8b89',
  },
  introSubtitle: {
    fontSize: 24,
    color: '#333',
    marginBottom: 15,
    fontWeight: '600',
  },
  introDescription: {
    fontSize: 18,
    color: '#555',
    lineHeight: 28,
    marginBottom: 30,
  },
  ctaButton: {
    backgroundColor: '#005466',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignSelf: 'flex-start', // Para hindi sumakop ng buong width
  },
  ctaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});