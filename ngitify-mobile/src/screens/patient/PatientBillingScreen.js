import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import CalendarIcon from '../../assets/icons/Calendar.svg';

const DUMMY_BILLS = [
    { id: '1', date: 'Feb 25, 2026', procedure: 'Dental Implant', amount: '₱ 45,000', status: 'Unpaid' },
    { id: '2', date: 'Oct 12, 2025', procedure: 'Tooth Extraction', amount: '₱ 1,500', status: 'Paid' },
    { id: '3', date: 'May 04, 2025', procedure: 'Oral Prophylaxis', amount: '₱ 1,000', status: 'Paid' }
];

export default function PatientBillingScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const renderBillCard = ({ item }) => (
        <View style={styles.billCard}>
            <View style={styles.billHeader}>
                <View style={styles.iconRow}>
                    <CalendarIcon width={14} height={14} style={{ color: '#555', marginRight: 5 }} />
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <View style={[styles.statusTag, item.status === 'Paid' ? styles.tagPaid : styles.tagUnpaid]}>
                    <Text style={[styles.statusText, item.status === 'Paid' ? {color: '#2e7d32'} : {color: '#c62828'}]}>{item.status}</Text>
                </View>
            </View>
            <View style={styles.billBody}>
                <Text style={styles.procedureText}>{item.procedure}</Text>
                <Text style={styles.amountText}>{item.amount}</Text>
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
                <Text style={styles.headerTitle}>Billing History</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.balanceContainer}>
                    <View style={styles.balanceCard}>
                        <Text style={styles.balanceLabel}>Total Outstanding Balance</Text>
                        <Text style={styles.balanceAmount}>₱ 45,000.00</Text>
                        <Text style={styles.balanceSub}>Please pay at the clinic counter after your session.</Text>
                    </View>
                </View>

                <View style={styles.listContainer}>
                    <Text style={styles.sectionTitle}>Transaction History</Text>
                    <FlatList 
                        data={DUMMY_BILLS}
                        keyExtractor={(item) => item.id}
                        renderItem={renderBillCard}
                        showsVerticalScrollIndicator={false}
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
    
    balanceContainer: { padding: 20, paddingBottom: 10 },
    balanceCard: { backgroundColor: '#01538b', padding: 25, borderRadius: 15, alignItems: 'center', elevation: 4 },
    balanceLabel: { color: '#e0f2f1', fontSize: 14, marginBottom: 5 },
    balanceAmount: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
    balanceSub: { color: '#01538b', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },

    listContainer: { flex: 1, padding: 20, paddingTop: 10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    
    billCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
    billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    iconRow: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    tagPaid: { backgroundColor: '#e8f5e9' },
    tagUnpaid: { backgroundColor: '#ffebee' },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    
    billBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    procedureText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    amountText: { fontSize: 16, fontWeight: 'bold', color: '#01538b' }
});