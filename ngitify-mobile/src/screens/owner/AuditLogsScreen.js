import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import TimeIcon from '../../assets/icons/Time.svg';

const DUMMY_LOGS = [
    { id: '1', timestamp: 'Today, 10:45 AM', user: 'Secretary Jen', action: 'Added a new patient: Maria Clara' },
    { id: '2', timestamp: 'Today, 09:30 AM', user: 'Dr. Smile Brillante', action: 'Updated Odontogram for patient: Juan Dela Cruz' },
    { id: '3', timestamp: 'Yesterday, 04:15 PM', user: 'Secretary Ana', action: 'Marked invoice #1024 as Paid' },
    { id: '4', timestamp: 'Yesterday, 11:00 AM', user: 'System Admin', action: 'Registered new dentist: Dr. John Doe' }
];

export default function AuditLogsScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const renderLog = ({ item }) => (
        <View style={styles.logCard}>
            <View style={styles.logHeader}>
                <View style={styles.timeRow}>
                    <TimeIcon width={12} height={12} style={{ color: '#888', marginRight: 5 }} />
                    <Text style={styles.timeText}>{item.timestamp}</Text>
                </View>
                <Text style={styles.userText}>{item.user}</Text>
            </View>
            <Text style={styles.actionText}>{item.action}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>System Audit Logs</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.listContainer}>
                    <Text style={styles.sectionTitle}>Recent Activities</Text>
                    <FlatList 
                        data={DUMMY_LOGS}
                        keyExtractor={(item) => item.id}
                        renderItem={renderLog}
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
    
    listContainer: { flex: 1, padding: 20, paddingTop: 10 },
    sectionTitle: { fontSize: 14, color: '#888', marginBottom: 15, textTransform: 'uppercase', fontWeight: 'bold' },
    
    logCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#01538b', elevation: 1 },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    timeRow: { flexDirection: 'row', alignItems: 'center' },
    timeText: { fontSize: 12, color: '#888' },
    userText: { fontSize: 12, fontWeight: 'bold', color: '#01538b' },
    actionText: { fontSize: 14, color: '#333' }
});