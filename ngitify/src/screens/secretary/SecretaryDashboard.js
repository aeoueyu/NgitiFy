import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';

import AddIcon from '../../assets/icons/Add.svg';
import MyPatientsIcon from '../../assets/icons/MyPatients.svg';
import MyScheduleIcon from '../../assets/icons/MySchedule.svg';
import FinancialReportsIcon from '../../assets/icons/FinancialReports.svg';

export default function SecretaryDashboard({ navigation }) {
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

    const displayName = userInfo ? userInfo.split('@')[0] : 'Secretary';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {displayName}</Text>
                    <Text style={styles.role}>Clinic Secretary</Text>
                </View>
                <TouchableOpacity onPress={() => setIsLogoutVisible(true)} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    
                    <Text style={styles.sectionTitle}>Patient Management</Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddPatient')}>
                            <AddIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>Add Patient</Text>
                            <Text style={styles.cardDesc}>Register a new clinic patient.</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ManagePatients')}>
                            <MyPatientsIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>Patient Records</Text>
                            <Text style={styles.cardDesc}>View & update profiles.</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Clinic Operations</Text>
                    <TouchableOpacity 
                        style={[styles.actionCardFull, { marginBottom: 15 }]} 
                        onPress={() => navigation.navigate('SurgerySchedules')}
                    >
                        <View style={{marginRight: 15}}><MyScheduleIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>Surgery Schedules</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Manage and view upcoming dental surgeries.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionCardFull} 
                        onPress={() => navigation.navigate('BillingManagement')}
                    >
                        <View style={{marginRight: 15}}><FinancialReportsIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>Billing & Payments</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Manage patient invoices and receive payments.</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{height: 20}} />
                </ScrollView>
            </Animated.View>

            <LogoutModal visible={isLogoutVisible} onCancel={() => setIsLogoutVisible(false)} onConfirm={logout} />
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
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15, marginTop: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    actionCard: { width: '48%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center' },
    actionCardFull: { width: '100%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, flexDirection: 'row', alignItems: 'center' },
    iconMargin: { marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', textAlign: 'center' },
    cardDesc: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 5 }
});