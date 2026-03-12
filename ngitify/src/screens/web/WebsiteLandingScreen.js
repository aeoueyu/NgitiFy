import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import DentimeLogo from '../../assets/images/logo-dentime.png'
import backgroundImage from '../../assets/images/login-bg.png'

export default function WebsiteLandingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.mainContainer}>
      
      {/* --- TOP NAVIGATION BAR --- */}
      <View style={[styles.topBar, { paddingHorizontal: isDesktop ? 80 : 20 }]}>
        
        {/* Placeholder para sa Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>
            Ngiti<Text style={styles.pinkText}>Fy</Text>
          </Text>
        </View>

        {/* Navigation Links (Lilitaw lang kapag nakalaptop/desktop) */}
        {isDesktop && (
          <View style={styles.navLinks}>
            <TouchableOpacity><Text style={styles.navItem}>Home</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.navItem}>About</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.navItem}>Services</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.navItem}>Client</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.navItem}>Locations</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.navItem}>Contact Us</Text></TouchableOpacity>
          </View>
        )}

        {/* Login Button */}
        <View style={styles.authButtons}>
          <TouchableOpacity 
            style={styles.loginBtn} 
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginBtnText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* --- MAIN HERO SECTION --- */}
      <View style={[styles.contentWrapper, { paddingHorizontal: isDesktop ? 80 : 20 }]}>
        <View style={styles.introSection}>
          
          <Text style={[styles.introSubtitle, { fontSize: isDesktop ? 60 : 40, lineHeight: isDesktop ? 70 : 50 }]}>
            AFFORDABLE <Text style={styles.pinkText}>SMILES?</Text> ALWAYS.
          </Text>
          
          <Text style={styles.introDescription}>
            A healthy, confident smile should never come with a heavy price tag. 
            At Lardizabal Dental Clinic, we believe in providing professional, 
            quality, and affordable care for every patient.
          </Text>
          
          <TouchableOpacity style={styles.visitBtn}>
            <Text style={styles.visitBtnText}>VISIT NOW</Text>
          </TouchableOpacity>

        </View>
      </View>

    </View>
  );
}

// --- STYLES (Ang pamalit sa Website.module.css) ---
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Plain white background muna
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Subtle line sa baba ng nav para makita
    zIndex: 10,
  },
  logoContainer: {
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#005466',
  },
  pinkText: {
    color: '#ea8b89',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 35, // Spacing ng mga links
  },
  navItem: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  authButtons: {
    justifyContent: 'center',
  },
  loginBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#005466',
  },
  loginBtnText: {
    color: '#005466',
    fontWeight: '700',
    fontSize: 13,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center', // Para pumagitna ang content patayo (vertically)
  },
  introSection: {
    maxWidth: 650, // Nilimitahan ang lapad para hindi humaba hanggang dulo
  },
  introSubtitle: {
    fontWeight: '900',
    color: '#005466',
  },
  introDescription: {
    fontSize: 18,
    color: '#333333',
    lineHeight: 28,
    marginTop: 20,
    marginBottom: 30,
  },
  visitBtn: {
    backgroundColor: '#005466',
    paddingVertical: 16,
    paddingHorizontal: 45,
    borderRadius: 50,
    alignSelf: 'flex-start', // Para hindi maging full-width ang button
  },
  visitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  }
});