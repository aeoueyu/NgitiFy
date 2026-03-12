// src/screens/shared/SettingsScreen.js
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';
import BackIcon from '../../assets/icons/Back.svg';

export default function SettingsScreen({ navigation }) {
    const { logout } = useContext(AuthContext);
    const [isLogoutVisible, setIsLogoutVisible] = useState(false);
    
    // Simulated Preferences State
    const [pushNotif, setPushNotif] = useState(true);
    const [emailNotif, setEmailNotif] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* Account Settings Section */}
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.card}>
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => navigation.navigate('EditProfile')}
                    >
                        <Text style={styles.menuText}>Edit Profile Information</Text>
                        <Text style={styles.arrow}>&gt;</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem}>
                        <Text style={styles.menuText}>Change Password</Text>
                        <Text style={styles.arrow}>&gt;</Text>
                    </TouchableOpacity>
                </View>

                {/* Preferences Section */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.card}>
                    <View style={styles.switchRow}>
                        <Text style={styles.menuText}>Push Notifications</Text>
                        <Switch 
                            value={pushNotif} 
                            onValueChange={setPushNotif} 
                            trackColor={{ false: '#ccc', true: '#01538b' }}
                            thumbColor={pushNotif ? '#e6eef3' : '#f4f3f4'}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.switchRow}>
                        <Text style={styles.menuText}>Email Notifications</Text>
                        <Switch 
                            value={emailNotif} 
                            onValueChange={setEmailNotif} 
                            trackColor={{ false: '#ccc', true: '#01538b' }}
                            thumbColor={emailNotif ? '#01538b' : '#f4f3f4'}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.switchRow}>
                        <Text style={styles.menuText}>Dark Mode (Theme)</Text>
                        <Switch 
                            value={darkMode} 
                            onValueChange={setDarkMode} 
                            trackColor={{ false: '#ccc', true: '#01538b' }}
                            thumbColor={darkMode ? '#01538b' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* About Section */}
                <Text style={styles.sectionTitle}>Support & About</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.menuItem}>
                        <Text style={styles.menuText}>Help Center & FAQ</Text>
                        <Text style={styles.arrow}>&gt;</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem}>
                        <Text style={styles.menuText}>Terms of Service</Text>
                        <Text style={styles.arrow}>&gt;</Text>
                    </TouchableOpacity>
                </View>

                {/* Logout Button inside Settings */}
                <TouchableOpacity style={styles.logoutMainBtn} onPress={() => setIsLogoutVisible(true)}>
                    <Text style={styles.logoutMainText}>Log Out</Text>
                </TouchableOpacity>

                <View style={{height: 40}} />
            </ScrollView>

            <LogoutModal visible={isLogoutVisible} onCancel={() => setIsLogoutVisible(false)} onConfirm={logout} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    content: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10, marginTop: 10, textTransform: 'uppercase' },
    
    card: { backgroundColor: 'white', borderRadius: 15, elevation: 2, marginBottom: 20, paddingVertical: 5 },
    menuItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
    menuText: { fontSize: 16, color: '#333', fontWeight: '500' },
    arrow: { fontSize: 18, color: '#ccc', fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginHorizontal: 20 },
    
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' },

    logoutMainBtn: { backgroundColor: '#ffebee', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#ffcdd2' },
    logoutMainText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' }
});