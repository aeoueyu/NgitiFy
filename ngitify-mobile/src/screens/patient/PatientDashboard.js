// src/screens/patient/PatientDashboard.js
import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';

import ProfileIcon from '../../assets/icons/MyProfile.svg';
import MedicalRecordsIcon from '../../assets/icons/MedicalRecords.svg';
import FinancialReportsIcon from '../../assets/icons/FinancialReports.svg';
import TimeIcon from '../../assets/icons/Time.svg';
import DentistIcon from '../../assets/icons/Dentist.svg';
import ChatBotIcon from '../../assets/icons/ChatBot.svg';

export default function PatientDashboard({ navigation }) {
    const { logout, userInfo } = useContext(AuthContext);
    const [isLogoutVisible, setIsLogoutVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current; 
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const displayName = userInfo ? userInfo.split('@')[0] : 'Patient';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {displayName}</Text>
                    <Text style={styles.role}>Patient</Text>
                </View>
                <TouchableOpacity onPress={() => setIsLogoutVisible(true)} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    
                    {/* BINAGO: Mula Upcoming Appointment naging Upcoming Surgery */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Upcoming Surgery Tracker</Text>
                        <Text style={styles.infoBadge}>Action Required</Text>
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.apptCard} 
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('PreOpInstructions')}
                    >
                        <View style={styles.apptHeader}>
                            <View style={styles.dateBox}>
                                <Text style={styles.dateMonth}>MAR</Text>
                                <Text style={styles.dateDay}>15</Text>
                            </View>
                            <View style={styles.apptDetails}>
                                <Text style={styles.procedureText}>Impacted Tooth Extraction</Text>
                                <View style={styles.iconRow}>
                                    <TimeIcon width={12} height={12} style={{ color: '#888', marginRight: 5 }} />
                                    <Text style={styles.timeText}>10:00 AM - 11:30 AM</Text>
                                </View>
                                <View style={styles.iconRow}>
                                    <DentistIcon width={12} height={12} style={{ color: '#888', marginRight: 5 }} />
                                    <Text style={styles.dentistText}>Dr. Smile Brillante</Text>
                                </View>
                                <Text style={styles.viewPreOpText}>Tap to view Pre-Op Instructions &rarr;</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>My Records</Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('MyProfile')}>
                            <ProfileIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>My Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('MedicalRecords')}>
                            <MedicalRecordsIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>Medical Records</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center' }]} onPress={() => navigation.navigate('PatientBilling')}>
                        <View style={{marginRight: 15}}><FinancialReportsIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>Billing & Payments</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>View your invoices and procedure costs.</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{height: 80}} />
                </ScrollView>
            </Animated.View>

            <LogoutModal visible={isLogoutVisible} onCancel={() => setIsLogoutVisible(false)} onConfirm={logout} />

            <TouchableOpacity style={styles.fabChat} onPress={() => navigation.navigate('Chatbot')} activeOpacity={0.8}>
                <ChatBotIcon width={30} height={30} style={{ color: 'white' }} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: '#01538b', padding: 25, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 5, zIndex: 10 },
    greeting: { color: 'white', fontSize: 24, fontWeight: 'bold', textTransform: 'capitalize' },
    role: { color: '#b3ccd1', fontSize: 14, fontWeight: '600' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
    logoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    content: { padding: 20 },
    
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555' },
    infoBadge: { backgroundColor: '#ffebee', color: '#d32f2f', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    
    apptCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    apptHeader: { flexDirection: 'row', alignItems: 'center' },
    dateBox: { backgroundColor: '#f3f7f9', padding: 10, borderRadius: 10, alignItems: 'center', width: 60, marginRight: 15 },
    dateMonth: { fontSize: 12, fontWeight: 'bold', color: '#01538b' },
    dateDay: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    apptDetails: { flex: 1 },
    procedureText: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 5 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    timeText: { fontSize: 12, color: '#555', fontWeight: 'bold' },
    dentistText: { fontSize: 12, color: '#888' },
    viewPreOpText: { fontSize: 11, color: '#01538b', fontWeight: 'bold', marginTop: 8 },

    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    actionCard: { width: '48%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center' },
    iconMargin: { marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', textAlign: 'center' },
    
    fabChat: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#01538b', width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5 }
});