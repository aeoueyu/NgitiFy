import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Image } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import CalendarIcon from '../../assets/icons/Calendar.svg';
import FinancialReportsIcon from '../../assets/icons/FinancialReports.svg';

export default function PatientPredictiveView({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Treatment Plan</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>Braces - AI Predicted Outcome</Text>
                
                <View style={styles.comparisonRow}>
                    <View style={styles.imageCard}>
                        <Text style={styles.label}>Before</Text>
                        <Image 
                            source={require('../../assets/ai-outcome/CurrentTeeth.jpg')} 
                            style={styles.imageStyle} 
                            resizeMode="cover"
                        />
                    </View>
                    <View style={styles.imageCard}>
                        <Text style={styles.label}>Predicted After</Text>
                        <Image 
                            source={require('../../assets/ai-outcome/BracesOutcome.png')} 
                            style={[styles.imageStyle, { borderColor: '#01538b', borderWidth: 2 }]} 
                            resizeMode="cover"
                        />
                    </View>
                </View>

                <View style={styles.detailsCard}>
                    <View style={styles.infoRow}>
                        <CalendarIcon width={16} height={16} style={{color: '#01538b', marginRight: 10}} />
                        <View>
                            <Text style={styles.infoLabel}>Estimated Completion Date</Text>
                            <Text style={styles.infoValue}>January 2027</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <FinancialReportsIcon width={16} height={16} style={{color: '#01538b', marginRight: 10}} />
                        <View>
                            <Text style={styles.infoLabel}>Estimated Quotation</Text>
                            <Text style={styles.infoValue}>₱ 65,000.00</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.agreementCard}>
                    <Text style={styles.agreementTitle}>Signed Agreement</Text>
                    <Text style={styles.agreementText}>
                        I understand that the target date is dependent on my consistency with monthly adjustments. 
                        Failure to comply may result in a delayed outcome.
                    </Text>
                    <View style={styles.signedTag}>
                        <Text style={styles.signedText}>✓ Digitally Signed</Text>
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
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    content: { padding: 20 },
    
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b', marginBottom: 15 },
    
    comparisonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    imageCard: { width: '48%' },
    label: { fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 5 },
    imageStyle: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#ddd' }, 
    
    detailsCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 20, elevation: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    infoLabel: { fontSize: 12, color: '#888' },
    infoValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    
    agreementCard: { backgroundColor: '#e8f5e9', padding: 20, borderRadius: 15, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: '#4caf50', elevation: 2 },
    agreementTitle: { fontWeight: 'bold', color: '#2e7d32', marginBottom: 10 },
    agreementText: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 15 },
    signedTag: { backgroundColor: '#4caf50', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5, alignSelf: 'flex-start' },
    signedText: { color: 'white', fontWeight: 'bold', fontSize: 12 }
});