import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import PatientIcon from '../../assets/icons/Patient.svg';
import SurgeryProcedureIcon from '../../assets/icons/SurgeryProcedure.svg';

const RECENT_TRANSACTIONS = [
    { id: '1', date: 'Feb 25, 2026', patient: 'Jane Doe', procedure: 'Dental Implant', amount: '+ ₱ 45,000', type: 'income' },
    { id: '2', date: 'Feb 20, 2026', patient: 'Juan Dela Cruz', procedure: 'Tooth Extraction', amount: '+ ₱ 1,500', type: 'income' },
    { id: '3', date: 'Feb 18, 2026', patient: 'Pedro Penduko', procedure: 'Root Canal', amount: '₱ 8,000 (Pending)', type: 'pending' }
];

export default function FinancialReportsScreen({ navigation }) {
    
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const renderTransaction = ({ item }) => (
        <View style={styles.transCard}>
            <View style={styles.transHeader}>
                <Text style={styles.transDate}>{item.date}</Text>
                <Text style={[styles.transAmount, item.type === 'income' ? {color: '#2e7d32'} : {color: '#01538b'}]}>
                    {item.amount}
                </Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.iconRow}>
                    <PatientIcon width={14} height={14} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.transPatient}>{item.patient}</Text>
                </View>
                <View style={styles.iconRow}>
                    <SurgeryProcedureIcon width={14} height={14} style={{ color: '#555', marginRight: 5 }} />
                    <Text style={styles.transProcedure}>{item.procedure}</Text>
                </View>
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
                <Text style={styles.headerTitle}>Financial Reports</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content} 
                showsVerticalScrollIndicator={false}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            >
                
                <View style={styles.summaryContainer}>
                    <View style={styles.mainCard}>
                        <Text style={styles.cardLabel}>Total Revenue (This Month)</Text>
                        <Text style={styles.mainAmount}>₱ 124,500.00</Text>
                        <Text style={styles.cardSub}>▲ 15% increase from last month</Text>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.subCard, { borderLeftColor: '#01538b' }]}>
                            <Text style={styles.subLabel}>Pending Receivables</Text>
                            <Text style={styles.subAmount}>₱ 53,000</Text>
                        </View>
                        <View style={[styles.subCard, { borderLeftColor: '#01538b' }]}>
                            <Text style={styles.subLabel}>Completed Procedures</Text>
                            <Text style={styles.subAmount}>84</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.listContainer}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <FlatList 
                        data={RECENT_TRANSACTIONS}
                        keyExtractor={(item) => item.id}
                        renderItem={renderTransaction}
                        scrollEnabled={false} 
                    />
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    content: { padding: 20 },
    
    summaryContainer: { marginBottom: 20 },
    mainCard: { backgroundColor: '#01538b', padding: 25, borderRadius: 15, elevation: 3, alignItems: 'center', marginBottom: 15 },
    cardLabel: { color: '#e0f2f1', fontSize: 14, marginBottom: 5 },
    mainAmount: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 5 },
    cardSub: { color: '#a5d6a7', fontSize: 12, fontWeight: 'bold' },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    subCard: { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 15, elevation: 2, borderLeftWidth: 5 },
    subLabel: { fontSize: 12, color: '#888', marginBottom: 5 },
    subAmount: { fontSize: 18, fontWeight: 'bold', color: '#333' },

    listContainer: { marginTop: 10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    
    transCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1, borderWidth: 1, borderColor: '#eee' },
    transHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
    transDate: { fontSize: 12, color: '#888', fontWeight: 'bold' },
    transAmount: { fontSize: 14, fontWeight: 'bold' },
    
    cardBody: { marginTop: 5 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    transPatient: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    transProcedure: { fontSize: 13, color: '#555' }
});