import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

import EmailIcon from '../../assets/icons/Email.svg';
import ContactNumberIcon from '../../assets/icons/ContactNumber.svg';
import DentistSpecializationIcon from '../../assets/icons/DentistSpecialization.svg';
import IDIcon from '../../assets/icons/ID.svg';

export default function StaffProfileScreen({ route, navigation }) {
    const { staff, role } = route.params;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Staff Profile</Text>
                <View style={{width: 60}} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <Text style={styles.staffName}>
                        {role === 'Dentists' ? `Dr. ${staff.firstName} ${staff.lastName}` : `${staff.firstName} ${staff.lastName}`}
                    </Text>
                    <View style={styles.roleTag}>
                        <Text style={styles.roleText}>{role === 'Dentists' ? 'Dentist' : 'Secretary'}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <EmailIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Email:</Text>
                        </View>
                        <Text style={styles.infoValue}>{staff.email}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <View style={styles.labelWrapper}>
                            <ContactNumberIcon width={16} height={16} style={styles.iconStyle} />
                            <Text style={styles.infoLabel}>Phone Number:</Text>
                        </View>
                        <Text style={styles.infoValue}>{staff.phone}</Text>
                    </View>

                    {role === 'Dentists' && (
                        <>
                            <View style={styles.infoRow}>
                                <View style={styles.labelWrapper}>
                                    <DentistSpecializationIcon width={16} height={16} style={styles.iconStyle} />
                                    <Text style={styles.infoLabel}>Specialization:</Text>
                                </View>
                                <Text style={styles.infoValue}>{staff.specialization}</Text>
                            </View>
                            
                            <View style={styles.infoRow}>
                                <View style={styles.labelWrapper}>
                                    <IDIcon width={16} height={16} style={styles.iconStyle} />
                                    <Text style={styles.infoLabel}>PRC License:</Text>
                                </View>
                                <Text style={styles.infoValue}>{staff.prc}</Text>
                            </View>
                        </>
                    )}
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
    profileCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, alignItems: 'center' },
    staffName: { fontSize: 22, fontWeight: 'bold', color: '#01538b', marginBottom: 5 },
    roleTag: { backgroundColor: '#e0f2f1', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 15 },
    roleText: { fontSize: 12, fontWeight: 'bold', color: '#00897b' },
    divider: { height: 1, backgroundColor: '#eee', width: '100%', marginBottom: 15 },
    
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, alignItems: 'flex-start' },
    labelWrapper: { flexDirection: 'row', alignItems: 'center', flex: 0.8 },
    iconStyle: { marginRight: 8, color: '#888' },
    infoLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
    infoValue: { fontSize: 14, color: '#333', textAlign: 'right', flex: 1.2, marginLeft: 10, fontWeight: '500' }
});