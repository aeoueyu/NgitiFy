import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import PatientIcon from '../../assets/icons/Patient.svg';
import SurgeryProcedureIcon from '../../assets/icons/SurgeryProcedure.svg';

const DUMMY_INVOICES = [
    { id: '1', patient: 'Juan Dela Cruz', procedure: 'Dental Implant', amount: '₱ 45,000', status: 'Unpaid', date: 'Feb 25, 2026' },
    { id: '2', patient: 'Pedro Penduko', procedure: 'Root Canal', amount: '₱ 8,000', status: 'Unpaid', date: 'Feb 22, 2026' },
    { id: '3', patient: 'Jane Doe', procedure: 'Tooth Extraction', amount: '₱ 1,500', status: 'Paid', date: 'Feb 20, 2026' }
];

export default function BillingManagementScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('Unpaid');

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const filteredInvoices = DUMMY_INVOICES.filter(inv => inv.status === activeTab);

    const handleReceivePayment = (patientName) => {
        Alert.alert(
            "Receive Payment",
            `Confirm receipt of payment from ${patientName}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Confirm", onPress: () => alert("Payment recorded successfully!") }
            ]
        );
    };

    const renderInvoiceCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconRow}>
                    <PatientIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.patientName}>{item.patient}</Text>
                </View>
                <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.cardBody}>
                <View>
                    <View style={styles.iconRow}>
                        <SurgeryProcedureIcon width={14} height={14} style={{ color: '#555', marginRight: 5 }} />
                        <Text style={styles.procedureText}>{item.procedure}</Text>
                    </View>
                    <Text style={styles.amountText}>{item.amount}</Text>
                </View>
                {item.status === 'Unpaid' && (
                    <TouchableOpacity style={styles.payBtn} onPress={() => handleReceivePayment(item.patient)}>
                        <Text style={styles.payBtnText}>Receive Payment</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Billing</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'Unpaid' && styles.activeTabBtn]} onPress={() => setActiveTab('Unpaid')}>
                        <Text style={[styles.tabText, activeTab === 'Unpaid' && styles.activeTabText]}>Pending / Unpaid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'Paid' && styles.activeTabBtn]} onPress={() => setActiveTab('Paid')}>
                        <Text style={[styles.tabText, activeTab === 'Paid' && styles.activeTabText]}>Completed / Paid</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.listContainer}>
                    <FlatList 
                        data={filteredInvoices}
                        keyExtractor={(item) => item.id}
                        renderItem={renderInvoiceCard}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>No {activeTab.toLowerCase()} invoices found.</Text>}
                    />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    tabContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTabBtn: { borderBottomColor: '#01538b' },
    tabText: { fontSize: 14, fontWeight: 'bold', color: '#888' },
    activeTabText: { color: '#01538b' },

    listContainer: { flex: 1, padding: 20 },
    emptyText: { textAlign: 'center', color: '#888', marginTop: 20, fontStyle: 'italic' },
    
    card: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    iconRow: { flexDirection: 'row', alignItems: 'center' },
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#01538b' },
    dateText: { fontSize: 12, color: '#888' },
    
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    procedureText: { fontSize: 14, color: '#555', marginBottom: 3 },
    amountText: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    
    payBtn: { backgroundColor: '#01538b', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 50 },
    payBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 }
});