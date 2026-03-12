import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated, ScrollView } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import CalendarIcon from '../../assets/icons/Calendar.svg';
import NotesIcon from '../../assets/icons/DentalNotes.svg';

const DUMMY_RECORDS = [
    { id: '1', date: 'Feb 25, 2026', procedure: 'Dental Implant Evaluation', dentist: 'Dr. Smile Brillante', notes: 'Patient is a good candidate for implants. Schedule for panoramic X-ray next visit.' },
    { id: '2', date: 'Oct 12, 2025', procedure: 'Tooth Extraction (Tooth #48)', dentist: 'Dr. John Doe', notes: 'Impacted wisdom tooth removed successfully. Prescribed antibiotics for 7 days.' },
    { id: '3', date: 'May 04, 2025', procedure: 'Oral Prophylaxis (Cleaning)', dentist: 'Dr. Smile Brillante', notes: 'Mild plaque build-up. Advised patient to floss daily.' }
];

export default function MedicalRecordsScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const renderRecordCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconRow}>
                    <CalendarIcon width={14} height={14} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <Text style={styles.dentistText}>{item.dentist}</Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.iconRow}>
                    <NotesIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.procedureText}>{item.procedure}</Text>
                </View>
                <Text style={styles.notesText}>{item.notes}</Text>
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
                <Text style={styles.headerTitle}>Medical Records</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.aiSection}>
                        <Text style={styles.sectionTitle}>AI Treatment Predictions</Text>
                        <TouchableOpacity style={styles.aiCard} onPress={() => navigation.navigate('PatientPredictiveView')}>
                            <View style={styles.aiCardHeader}>
                                <Text style={styles.aiCardTitle}>Braces Treatment Plan</Text>
                                <Text style={styles.aiStatus}>In Progress</Text>
                            </View>
                            <Text style={styles.aiCardDesc}>Target Completion: Jan 2027</Text>
                            <Text style={styles.viewLink}>View Detailed Outcome ➔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.aiCard, { marginTop: 15, backgroundColor: '#1a1a1a' }]} onPress={() => navigation.navigate('PatientXRayView')}>
                            <View style={styles.aiCardHeader}>
                                <Text style={styles.aiCardTitle}>AI X-Ray Analysis</Text>
                                <Text style={[styles.aiStatus, {color: '#ffb74d'}]}>Reviewed</Text>
                            </View>
                            <Text style={styles.aiCardDesc}>Panoramic X-Ray (Feb 20, 2026)</Text>
                            <Text style={[styles.viewLink, {color: '#01538b'}]}>View X-Ray & Findings ➔</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.sectionTitle, {marginTop: 20}]}>Treatment History</Text>
                    <FlatList 
                        data={DUMMY_RECORDS}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRecordCard}
                        scrollEnabled={false}
                    />

                </ScrollView>
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
    
    listContainer: { padding: 20, paddingTop: 10, paddingBottom: 40 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    
    card: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    iconRow: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 14, fontWeight: 'bold', color: '#01538b' },
    dentistText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
    
    cardBody: { marginTop: 5 },
    procedureText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
    notesText: { fontSize: 14, color: '#666', lineHeight: 20 },

    aiSection: { marginBottom: 10 },
    aiCard: { backgroundColor: '#01538b', padding: 20, borderRadius: 15, elevation: 3 },
    aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    aiCardTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    aiStatus: { color: '#a5d6a7', fontWeight: 'bold', fontSize: 12 },
    aiCardDesc: { color: '#e0f2f1', fontSize: 12, marginBottom: 10 },
    viewLink: { color: '#01538b', fontWeight: 'bold', fontSize: 14 }
});