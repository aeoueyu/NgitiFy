import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';

import BackIcon from '../../assets/icons/Back.svg';
import TimeIcon from '../../assets/icons/Time.svg';
import PatientIcon from '../../assets/icons/Patient.svg';
import SurgeryProcedureIcon from '../../assets/icons/SurgeryProcedure.svg';
import DentistIcon from '../../assets/icons/Dentist.svg';

const DUMMY_SCHEDULES = {
    '2026-02-20': [
        { id: '1', patient: 'Juan Dela Cruz', procedure: 'Tooth Extraction', time: '10:00 AM', dentist: 'Dr. Smile Brillante', status: 'Confirmed' }
    ],
    '2026-02-22': [
        { id: '2', patient: 'Pedro Penduko', procedure: 'Root Canal Therapy', time: '02:30 PM', dentist: 'Dr. Smile Brillante', status: 'Pending' }
    ],
    '2026-02-25': [
        { id: '3', patient: 'Jane Doe', procedure: 'Dental Implant', time: '09:00 AM', dentist: 'Dr. John Doe', status: 'Confirmed' },
        { id: '4', patient: 'Alex Reyes', procedure: 'Gingivectomy', time: '01:00 PM', dentist: 'Dr. Smile Brillante', status: 'Confirmed' }
    ]
};

export default function SurgerySchedulesScreen({ navigation }) {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    let markedDates = {};
    Object.keys(DUMMY_SCHEDULES).forEach(date => {
        markedDates[date] = { marked: true, dotColor: '#01538b' };
    });
    
    markedDates[selectedDate] = { 
        ...markedDates[selectedDate], 
        selected: true, 
        selectedColor: '#01538b' 
    };

    const currentSchedules = DUMMY_SCHEDULES[selectedDate] || [];

    const renderScheduleCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.timeRow}>
                    <TimeIcon width={14} height={14} style={styles.timeIcon} />
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <View style={[styles.statusTag, item.status === 'Confirmed' ? styles.tagConfirmed : styles.tagPending]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            
            <View style={styles.cardBody}>
                <View style={styles.iconRow}>
                    <PatientIcon width={16} height={16} style={styles.iconStyle} />
                    <Text style={styles.patientName}>{item.patient}</Text>
                </View>
                <View style={styles.iconRow}>
                    <SurgeryProcedureIcon width={14} height={14} style={styles.iconStyle} />
                    <Text style={styles.procedureText}>{item.procedure}</Text>
                </View>
                <View style={[styles.iconRow, { marginBottom: 0 }]}>
                    <DentistIcon width={14} height={14} style={styles.iconStyle} />
                    <Text style={styles.dentistText}>{item.dentist}</Text>
                </View>
            </View>
            
            <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>View Details</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Surgery Schedules</Text>
                <View style={{width: 60}} />
            </View>

            <Calendar
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={markedDates}
                theme={{
                    selectedDayBackgroundColor: '#01538b',
                    todayTextColor: '#01538b',
                    arrowColor: '#01538b',
                    monthTextColor: '#01538b',
                    textMonthFontWeight: 'bold',
                }}
                style={styles.calendar}
            />

            <View style={styles.listContainer}>
                <Text style={styles.listTitle}>
                    Schedules for {selectedDate}
                </Text>
                <FlatList 
                    data={currentSchedules}
                    keyExtractor={item => item.id}
                    renderItem={renderScheduleCard}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No surgeries scheduled for this date.</Text>
                    }
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    calendar: { marginBottom: 10, elevation: 2 },
    
    listContainer: { flex: 1, padding: 20, paddingTop: 10 },
    listTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    emptyText: { textAlign: 'center', color: '#888', marginTop: 20, fontStyle: 'italic' },

    card: { backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    
    timeRow: { flexDirection: 'row', alignItems: 'center' },
    timeIcon: { color: '#01538b', marginRight: 5 },
    timeText: { fontSize: 14, fontWeight: 'bold', color: '#01538b' },
    
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    tagConfirmed: { backgroundColor: '#e8f5e9' },
    tagPending: { backgroundColor: '#fff3e0' },
    statusText: { fontSize: 10, fontWeight: 'bold', color: '#555' },
    
    cardBody: { marginBottom: 10 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    iconStyle: { color: '#888', marginRight: 8 },
    
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    procedureText: { fontSize: 14, color: '#555' },
    dentistText: { fontSize: 13, color: '#888' },

    actionBtn: { backgroundColor: '#f3f7f9', padding: 10, borderRadius: 50, alignItems: 'center', marginTop: 5 },
    actionBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 12 }
});