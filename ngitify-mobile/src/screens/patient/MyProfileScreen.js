import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

export default function MyProfileScreen({ navigation }) {
    const patientData = {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        birthdate: '1995-05-15',
        phone: '09123456789',
        email: 'juan@gmail.com',
        address: 'Blk 1 Lot 2, Mabini St., Brgy. 1, Quezon City, NCR'
    };

    const calculateAge = (birthdate) => {
        const today = new Date();
        const bDate = new Date(birthdate);
        let age = today.getFullYear() - bDate.getFullYear();
        if (today.getMonth() < bDate.getMonth() || (today.getMonth() === bDate.getMonth() && today.getDate() < bDate.getDate())) age--;
        return age;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{width: 60}} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{patientData.firstName.charAt(0)}{patientData.lastName.charAt(0)}</Text>
                    </View>
                    <Text style={styles.patientName}>{patientData.firstName} {patientData.lastName}</Text>
                    <Text style={styles.patientEmail}>{patientData.email}</Text>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Age & Birthdate:</Text>
                        <Text style={styles.infoValue}>{calculateAge(patientData.birthdate)} yrs old ({patientData.birthdate})</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone Number:</Text>
                        <Text style={styles.infoValue}>{patientData.phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Home Address:</Text>
                        <Text style={styles.infoValue}>{patientData.address}</Text>
                    </View>
                </View>

                <View style={styles.noticeCard}>
                    <Text style={styles.noticeText}>💡 To update your personal information or address, please contact the clinic secretary during your next visit.</Text>
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
    
    profileCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center', marginBottom: 20 },
    avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#01538b', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    avatarText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
    patientName: { fontSize: 22, fontWeight: 'bold', color: '#01538b', marginBottom: 5 },
    patientEmail: { fontSize: 14, color: '#888', marginBottom: 15 },
    
    divider: { height: 1, backgroundColor: '#eee', width: '100%', marginBottom: 15 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
    infoLabel: { fontSize: 14, color: '#888', fontWeight: '600', flex: 0.8 },
    infoValue: { fontSize: 14, color: '#333', textAlign: 'right', flex: 1.2, marginLeft: 10, fontWeight: '500' },

    noticeCard: { backgroundColor: '#e0f2f1', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#b2dfdb' },
    noticeText: { color: '#00897b', fontSize: 12, lineHeight: 18, textAlign: 'center' }
});