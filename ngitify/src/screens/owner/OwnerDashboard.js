import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import LogoutModal from '../../components/LogoutModal';

import MyPatientsIcon from '../../assets/icons/MyPatients.svg';
import MyScheduleIcon from '../../assets/icons/MySchedule.svg';
import ViewStaffRecordsIcon from '../../assets/icons/ViewStaffRecords.svg';
import AddIcon from '../../assets/icons/Add.svg';
import FinancialReportsIcon from '../../assets/icons/FinancialReports.svg';
import EarningsCommissionIcon from '../../assets/icons/EarningsCommission.svg';
import InventoryTrackerIcon from '../../assets/icons/InventoryTracker.svg';
import SystemAuditLogsIcon from '../../assets/icons/SystemAuditLogs.svg'

export default function OwnerDashboard({ navigation }) {
    const { logout, userInfo } = useContext(AuthContext);
    const [isLogoutVisible, setIsLogoutVisible] = useState(false);
    
    const fadeAnim = useRef(new Animated.Value(0)).current; 
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const displayName = userInfo ? userInfo.replace('Dr. ', '') : '';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, Dr. {displayName}</Text>
                    <Text style={styles.role}>Owner & Head Dentist</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={[styles.logoutBtn, { marginRight: 10 }]}>
                        <Text style={styles.logoutText}>Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLogoutVisible(true)} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    
                    <Text style={styles.sectionTitle}>Clinical Duties</Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('MyPatients')}>
                            <MyPatientsIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>My Patients</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SurgerySchedules')}>
                            <MyScheduleIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>My Schedule</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 15 }]} 
                        onPress={() => navigation.navigate('MyEarnings')}
                    >
                        <View style={{marginRight: 15}}><EarningsCommissionIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>My Earnings</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Track your personal commissions as a dentist.</Text>
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Staff Management</Text>
                    <TouchableOpacity style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 15 }]} onPress={() => navigation.navigate('ManageStaff')}>
                        <View style={{marginRight: 15}}><ViewStaffRecordsIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>View Staff Records</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Manage list of dentists and secretaries.</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddDentist')}>
                            <AddIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>Add Dentist</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddSecretary')}>
                            <AddIcon width={35} height={35} style={styles.iconMargin} />
                            <Text style={styles.cardTitle}>Add Secretary</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Clinic Overview</Text>
                    <TouchableOpacity style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center' }]} onPress={() => navigation.navigate('FinancialReports')}>
                        <View style={{marginRight: 15}}><FinancialReportsIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>Financial Reports</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>View clinic earnings and pending receivables.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop:15 }]} onPress={() => navigation.navigate('InventoryManagement')}>
                        <View style={{marginRight: 15}}><InventoryTrackerIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>Inventory Tracker</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Monitor inventory and stocks.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionCard, { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop:15 }]} onPress={() => navigation.navigate('AuditLogs')}>
                        <View style={{marginRight: 15}}><SystemAuditLogsIcon width={35} height={35} /></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.cardTitle, { textAlign: 'left' }]}>System Audit Logs</Text>
                            <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Monitor staff activities and system changes.</Text>
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
    container: {
        flex: 1,
        backgroundColor: '#f3f7f9'
    },
    header: {
        backgroundColor: '#01538b',
        padding: 25, 
        paddingTop: 60, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottomLeftRadius: 20, 
        borderBottomRightRadius: 20, 
        elevation: 5, 
        zIndex: 10 
    },
    greeting: {
        color: 'white', 
        fontSize: 24, 
        fontWeight: 'bold' 
    },
    role: { 
        color: '#b3cbdc', 
        fontSize: 14, 
        fontWeight: '600' 
    },
    logoutBtn: { 
        backgroundColor: '#3475a2', 
        paddingVertical: 8, 
        paddingHorizontal: 15, 
        borderRadius: 20 
    },
    logoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    content: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15, marginTop: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    actionCard: { width: '48%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    iconMargin: { marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', textAlign: 'center' }
});