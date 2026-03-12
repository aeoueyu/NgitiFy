import React, { useState } from 'react'; // <-- Idinagdag ang useState para sa hover effects
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ImageBackground, Image } from 'react-native';

export default function WebsiteLandingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // --- STATES PARA SA HOVER EFFECTS ---
  // Magkaiba ang state para sa bawat navigation item para hiwalay ang hover
  const [hoveredNavItem, setHoveredNavItem] = useState(null); 
  const [isVisitBtnHovered, setIsVisitBtnHovered] = useState(false);

  // Helper function para makuha ang dynamic style ng navigation item
  const getNavItemStyle = (itemName) => [
    styles.navItem,
    hoveredNavItem === itemName && styles.navItemHovered // I-apply ang hovered style kung siya ang hovered
  ];

  // Helper function para makuha ang dynamic style ng VISIT NOW button
  const getVisitBtnStyle = () => [
    styles.visitBtn,
    isVisitBtnHovered && styles.visitBtnHovered // I-apply ang hovered style kung hovered
  ];

  return (
    <View style={styles.mainContainer}>
      
      {/* --- BACKGROUND IMAGE --- */}
      <ImageBackground 
        source={require('../../assets/images/login-bg.png')} // Siguraduhing tama ang path ng PNG background mo
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        
        {/* --- TOP NAVIGATION BAR --- */}
        <View style={[styles.topBar, { paddingHorizontal: isDesktop ? 80 : 20 }]}>
          
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
               source={require('../../assets/images/logo-dentime.png')} // Siguraduhing tama ang path ng PNG logo mo
               style={styles.logoImage}
               resizeMode="contain"
            />
          </View>

          {/* Navigation Links (Lilitaw lang kapag nakalaptop/desktop) */}
          {isDesktop && (
            <View style={styles.navLinks}>
              {['Home', 'About', 'Services', 'Client', 'Locations', 'Contact Us'].map((item) => (
                <View // Gagamit tayo ng View para ma-detect ang mouse events para sa hover
                  key={item} 
                  onMouseEnter={() => setHoveredNavItem(item)} // Kapag tinapat ang mouse
                  onMouseLeave={() => setHoveredNavItem(null)} // Kapag inalis ang mouse
                >
                    <TouchableOpacity><Text style={getNavItemStyle(item)}>{item}</Text></TouchableOpacity>
                </View>
              ))}
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
            
            <Text style={[styles.introSubtitle, { fontSize: isDesktop ? 64 : 45, lineHeight: isDesktop ? 75 : 55 }]}>
              AFFORDABLE <Text style={styles.pinkText}>SMILES?</Text> ALWAYS.
            </Text>
            
            <Text style={styles.introDescription}>
              A healthy, confident smile should never come with a heavy price tag. 
              At Dentime Dental Clinic, we believe in providing professional, 
              quality, and affordable care for every patient.
            </Text>
            
            {/* VISIT NOW BUTTON NA MAY HOVER */}
            <View // Gagamit tayo ng View para ma-detect ang mouse events para sa hover
              onMouseEnter={() => setIsVisitBtnHovered(true)} 
              onMouseLeave={() => setIsVisitBtnHovered(false)}
            >
                <TouchableOpacity 
                  style={getVisitBtnStyle()}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.visitBtnText}>VISIT NOW</Text>
                </TouchableOpacity>
            </View>

          </View>
        </View>

      </ImageBackground>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    zIndex: 10,
  },
  logoContainer: {
    justifyContent: 'center',
  },
  logoImage: {
    width: 160,
    height: 45,
  },
  pinkText: {
    color: '#ea8b89',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 35, 
  },
  navItem: {
    fontSize: 15,
    fontWeight: '600',
    color: '#005466',
  },
  navItemHovered: { // <-- Style kapag hovered ang nav item
    color: '#ea8b89', // Papalitan natin ng pink
  },
  authButtons: {
    justifyContent: 'center',
  },
  loginBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 35,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#005466',
  },
  loginBtnText: {
    color: '#005466',
    fontWeight: '700',
    fontSize: 14,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center', 
  },
  introSection: {
    maxWidth: 650,
    padding: 30,
    borderRadius: 20,
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
    marginBottom: 35,
    fontWeight: '500',
  },
  visitBtn: {
    backgroundColor: '#005466',
    paddingVertical: 16,
    paddingHorizontal: 45,
    borderRadius: 50,
    alignSelf: 'flex-start',
    shadowColor: '#005466',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    borderColor: 'transparent', // Default walang border
    borderWidth: 1, // Maglalagay tayo ng border width para sa hover outline
  },
  visitBtnHovered: { // <-- Style kapag hovered ang VISIT NOW button
    borderColor: '#005466', // Ilalabas natin ang outline
    borderWidth: 1,
  },
  visitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  }
});