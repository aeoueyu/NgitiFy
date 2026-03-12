import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import EmailIcon from '../../assets/icons/Email.svg';
import ContactNumberIcon from '../../assets/icons/ContactNumber.svg';
import BirthdayIcon from '../../assets/icons/Birthday.svg';
import AddressIcon from '../../assets/icons/Address.svg';

export default function PatientDetailsScreen({ route, navigation }) {
    const { patient } = route.params;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

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
                <Text style={styles.headerTitle}>Patient Information</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.profileCard}>
                    <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
                    {age < 18 && <View style={styles.minorTag}><Text style={styles.minorText}>Minor</Text></View>}

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <BirthdayIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Age & Birthdate:</Text>
                        </View>
                        <Text style={styles.infoValue}>{age} yrs old ({patient.birthdate})</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <EmailIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Email:</Text>
                        </View>
                        <Text style={styles.infoValue}>{patient.email}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <ContactNumberIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Phone Number:</Text>
                        </View>
                        <Text style={styles.infoValue}>{patient.phone}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <AddressIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Address:</Text>
                        </View>
                        <Text style={styles.infoValue}>Brgy. 1, Quezon City</Text>
                    </View>
                </View>

                <View style={styles.alertCard}>
                    <Text style={styles.alertTitle}>Medical Alerts (View Only)</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Conditions:</Text>
                        <Text style={[styles.infoValue, {color: '#d9534f'}]}>{patient.conditions ? patient.conditions.join(', ') : 'None documented'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Allergies:</Text>
                        <Text style={[styles.infoValue, {color: '#d9534f'}]}>{patient.allergies || 'None documented'}</Text>
                    </View>
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
    
    profileCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center', marginBottom: 15 },
    patientName: { fontSize: 22, fontWeight: 'bold', color: '#01538b', marginBottom: 5 },
    minorTag: { backgroundColor: '#ffe082', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 15 },
    minorText: { fontSize: 12, fontWeight: 'bold', color: '#f57f17' },
    divider: { height: 1, backgroundColor: '#eee', width: '100%', marginBottom: 15 },
    
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, alignItems: 'flex-start' },
    labelWrapper: { flexDirection: 'row', alignItems: 'center', flex: 0.9 },
    iconStyle: { marginRight: 8, color: '#888' },
    infoLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
    infoValue: { fontSize: 14, color: '#333', textAlign: 'right', flex: 1.1, marginLeft: 10, fontWeight: '500' },

    alertCard: { backgroundColor: '#fff8f8', padding: 20, borderRadius: 15, elevation: 2, borderWidth: 1, borderColor: '#ffcdd2' },
    alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#d9534f', marginBottom: 15, textAlign: 'center' }
});