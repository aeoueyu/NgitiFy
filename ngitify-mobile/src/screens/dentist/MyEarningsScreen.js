import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';

import MyEarningsIcon from '../../assets/icons/MyEarnings.svg';
import BackIcon from '../../assets/icons/Back.svg';
import PatientIcon from '../../assets/icons/Patient.svg';
import SurgeryProcedureIcon from '../../assets/icons/SurgeryProcedure.svg';

const EARNINGS_HISTORY = [
    { id: '1', date: 'Feb 25, 2026', patient: 'Jane Doe', procedure: 'Dental Implant', cost: 45000, commissionRate: 0.30, status: 'Credited' },
    { id: '2', date: 'Feb 22, 2026', patient: 'Pedro Penduko', procedure: 'Root Canal', cost: 8000, commissionRate: 0.40, status: 'Pending Payment' },
    { id: '3', date: 'Feb 20, 2026', patient: 'Juan Dela Cruz', procedure: 'Tooth Extraction', cost: 1500, commissionRate: 0.40, status: 'Credited' }
];

export default function MyEarningsScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const renderTransaction = ({ item }) => {
        const commissionAmount = item.cost * item.commissionRate;
        
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <View style={[styles.statusTag, item.status === 'Credited' ? styles.tagCredited : styles.tagPending]}>
                        <Text style={[styles.statusText, item.status === 'Credited' ? {color: '#2e7d32'} : {color: '#c62828'}]}>{item.status}</Text>
                    </View>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.iconRow}>
                        <PatientIcon width={14} height={14} style={{ color: '#01538b', marginRight: 5 }} />
                        <Text style={styles.patientName}>{item.patient}</Text>
                    </View>
                    <View style={styles.iconRow}>
                        <SurgeryProcedureIcon width={14} height={14} style={{ color: '#555', marginRight: 5 }} />
                        <Text style={styles.procedureText}>{item.procedure}</Text>
                    </View>
                </View>
                <View style={styles.cardFooter}>
                    <Text style={styles.costText}>Procedure Cost: ₱{item.cost.toLocaleString()}</Text>
                    <Text style={styles.commissionText}>+ ₱{commissionAmount.toLocaleString()}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Earnings</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.summaryContainer}>
                    <View style={styles.mainCard}>
                        <MyEarningsIcon width={40} height={40} style={{ color: 'white', marginBottom: 10 }} />
                        <Text style={styles.cardLabel}>Total Commissions (This Month)</Text>
                        <Text style={styles.mainAmount}>₱ 14,100.00</Text>
                        <Text style={styles.cardSub}>Keep up the great work, Doctor!</Text>
                    </View>
                </View>

                <View style={styles.listContainer}>
                    <Text style={styles.sectionTitle}>Commission History</Text>
                    <FlatList 
                        data={EARNINGS_HISTORY}
                        keyExtractor={(item) => item.id}
                        renderItem={renderTransaction}
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
    
    summaryContainer: { padding: 20, paddingBottom: 10 },
    mainCard: { backgroundColor: '#01538b', padding: 25, borderRadius: 15, elevation: 4, alignItems: 'center' },
    cardLabel: { color: '#e0f2f1', fontSize: 14, marginBottom: 5 },
    mainAmount: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 5 },
    cardSub: { color: '#01538b', fontSize: 12, fontWeight: 'bold' },

    listContainer: { flex: 1, padding: 20, paddingTop: 10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    
    card: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    dateText: { fontSize: 12, color: '#888', fontWeight: 'bold' },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    tagCredited: { backgroundColor: '#e8f5e9' },
    tagPending: { backgroundColor: '#ffebee' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    
    cardBody: { marginBottom: 10 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    patientName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    procedureText: { fontSize: 13, color: '#555' },
    
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 10 },
    costText: { fontSize: 12, color: '#888' },
    commissionText: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }
});