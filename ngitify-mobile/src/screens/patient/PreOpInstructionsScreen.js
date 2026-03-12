// src/screens/patient/PreOpInstructionsScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import TimeIcon from '../../assets/icons/Time.svg';
import DentistIcon from '../../assets/icons/Dentist.svg';
import SurgeryProcedureIcon from '../../assets/icons/SurgeryProcedure.svg';

export default function PreOpInstructionsScreen({ navigation }) {
    const [isChecked, setIsChecked] = useState(false);
    const [isSigned, setIsSigned] = useState(false);

    const handleSignAgreement = () => {
        setIsSigned(true);
        Alert.alert("Digital Consent Signed", "Thank you. Your consent has been recorded. We will see you on your surgery date.");
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pre-Op Details</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* Surgery Information Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Scheduled Surgery</Text>
                    <View style={styles.divider} />
                    
                    <View style={styles.detailRow}>
                        <SurgeryProcedureIcon width={16} height={16} style={styles.icon} />
                        <Text style={styles.detailText}>Impacted Wisdom Tooth Extraction</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <TimeIcon width={16} height={16} style={styles.icon} />
                        <Text style={styles.detailText}>March 15, 2026 | 10:00 AM</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <DentistIcon width={16} height={16} style={styles.icon} />
                        <Text style={styles.detailText}>Dr. Smile Brillante</Text>
                    </View>
                </View>

                {/* Pre-Op Guidelines */}
                <Text style={styles.sectionTitle}>Important Pre-Op Guidelines</Text>
                <View style={styles.guidelineCard}>
                    <Text style={styles.guidelinePoint}>• Please observe fasting (NPO) 8 hours prior to the surgery. No food or water.</Text>
                    <Text style={styles.guidelinePoint}>• Wear comfortable, loose-fitting clothing. Avoid wearing heavy makeup or jewelry.</Text>
                    <Text style={styles.guidelinePoint}>• Please arrange for a responsible adult to drive you home after the procedure.</Text>
                    <Text style={styles.guidelinePoint}>• Inform the dentist immediately if you develop a cold, fever, or flu before the surgery.</Text>
                </View>

                {/* Digital Consent Section */}
                <Text style={styles.sectionTitle}>Digital Consent Form</Text>
                <View style={styles.consentCard}>
                    <Text style={styles.consentText}>
                        I acknowledge that I have read and understood the Pre-Operative Guidelines provided above. I consent to the scheduled surgical procedure and understand the risks involved as discussed by my dentist.
                    </Text>
                    
                    <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => !isSigned && setIsChecked(!isChecked)}
                        activeOpacity={isSigned ? 1 : 0.7}
                    >
                        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                            {isChecked && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>I agree to the terms and guidelines.</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Button */}
                <TouchableOpacity 
                    style={[styles.signBtn, (!isChecked || isSigned) && styles.signBtnDisabled]} 
                    disabled={!isChecked || isSigned}
                    onPress={handleSignAgreement}
                >
                    <Text style={styles.signBtnText}>
                        {isSigned ? "Consent Signed & Submitted" : "Acknowledge & Sign Consent"}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    content: { padding: 20 },
    
    card: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 20, borderTopWidth: 5, borderTopColor: '#01538b' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
    divider: { height: 1, backgroundColor: '#eee', marginBottom: 15 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    icon: { color: '#01538b', marginRight: 10 },
    detailText: { fontSize: 14, color: '#555', fontWeight: '500' },

    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 10 },
    
    guidelineCard: { backgroundColor: '#fff3e0', padding: 20, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#ffe0b2' },
    guidelinePoint: { fontSize: 13, color: '#555', marginBottom: 10, lineHeight: 20 },

    consentCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 20 },
    consentText: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 15, fontStyle: 'italic' },
    
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 10 },
    checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#01538b', borderRadius: 4, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#01538b' },
    checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    checkboxLabel: { fontSize: 14, color: '#333', fontWeight: 'bold' },

    signBtn: { backgroundColor: '#01538b', padding: 16, borderRadius: 10, alignItems: 'center', elevation: 2 },
    signBtnDisabled: { backgroundColor: '#ccc' },
    signBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});