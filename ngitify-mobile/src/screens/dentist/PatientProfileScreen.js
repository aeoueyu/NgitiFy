import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

import OdontogramIcon from '../../assets/icons/Odontogram.svg';
import XRaysIcon from '../../assets/icons/XRays.svg';
import NotesIcon from '../../assets/icons/Notes.svg';
import AddSurgeryIcon from '../../assets/icons/AddSurgery.svg';
import AIPredictive from '../../assets/icons/AIPredict.svg';
import EPrescriptionIcon from '../../assets/icons/EPrescription.svg';

export default function PatientProfileScreen({ route, navigation }) {
    const { patient } = route.params;

    const calculateAge = (birthdate) => {
        const today = new Date();
        const bDate = new Date(birthdate);
        let age = today.getFullYear() - bDate.getFullYear();
        if (today.getMonth() < bDate.getMonth() || (today.getMonth() === bDate.getMonth() && today.getDate() < bDate.getDate())) age--;
        return age;
    };
    const age = calculateAge(patient.birthdate);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Record</Text>
                <View style={{width: 60}} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{patient.firstName.charAt(0)}{patient.lastName.charAt(0)}</Text>
                    </View>
                    <View style={styles.profileTextContainer}>
                        <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
                        <Text style={styles.patientSub}>{age} years old • {patient.phone}</Text>
                    </View>
                </View>

                <Text style={styles.toolsTitle}>Clinical Tools</Text>
                <View style={styles.toolsGrid}>
                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('Odontogram', { patient })}>
                        <OdontogramIcon width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>Odontogram</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('XRay', { patient })}>
                        <XRaysIcon width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>X-Rays</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('TreatmentNotes', { patient })}>
                        <NotesIcon width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>Notes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('AddSurgery', { patient })}>
                        <AddSurgeryIcon width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>Add Surgery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('AIPredictive', { patient })}>
                        <AIPredictive width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>AI Predict</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolCard} onPress={() => navigation.navigate('EPrescription', { patient })}>
                        <EPrescriptionIcon width={35} height={35} style={styles.toolIcon} />
                        <Text style={styles.toolText}>Issue E-Prescription</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.alertCard}>
                    <Text style={styles.alertTitle}>⚠️ Medical Alerts</Text>
                    <Text style={styles.alertText}><Text style={styles.boldText}>Conditions: </Text> {patient.conditions ? patient.conditions.join(', ') : 'None'}</Text>
                    <Text style={styles.alertText}><Text style={styles.boldText}>Allergies: </Text> {patient.allergies || 'None'}</Text>
                </View>

            </ScrollView>
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
    profileHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 25 },
    avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#01538b', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    avatarText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
    profileTextContainer: { flex: 1 },
    patientName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    patientSub: { fontSize: 14, color: '#888', marginTop: 5 },
    toolsTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 15 },
    toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    toolCard: { width: '48%', backgroundColor: 'white', padding: 20, borderRadius: 15, alignItems: 'center', elevation: 2, marginBottom: 15 },
    toolIcon: { marginBottom: 10 },
    toolText: { fontSize: 14, fontWeight: 'bold', color: '#444' },
    alertCard: { backgroundColor: '#fff8f8', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#ffcdd2', marginTop: 10 },
    alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#d9534f', marginBottom: 10 },
    alertText: { fontSize: 14, color: '#333', marginBottom: 5 },
    boldText: { fontWeight: 'bold' }
});