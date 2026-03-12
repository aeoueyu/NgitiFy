import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

const { width } = Dimensions.get('window');
const imageHeight = width * 0.5; 

export default function PatientXRayView({ navigation }) {
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
                <Text style={styles.headerTitle}>My X-Ray Records</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content}
                style={{ opacity: fadeAnim }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>Panoramic X-Ray (AI Analyzed)</Text>
                <Text style={styles.dateText}>Taken on: Feb 20, 2026</Text>

                <View style={styles.viewerCard}>
                    <View style={[styles.imageContainer, { height: imageHeight }]}>
                        <Image 
                            source={require('../../assets/ai-xray/PanoramicXRay.png')} 
                            style={styles.xrayImage} 
                            resizeMode="contain"
                        />
                        
                        <View style={styles.overlayContainer}>
                            <View style={[styles.detectionBox, {
                                top: '10%',
                                left: '55%',
                                width: '20%', 
                                height: '25%', 
                                borderColor: 'orange'
                            }]} />
                            
                            <View style={[styles.detectionBox, {
                                bottom: '23%',
                                right: '17%',
                                width: '15%', 
                                height: '20%', 
                                borderColor: 'red'
                            }]} />
                            <View style={[styles.detectionBox, {
                                bottom: '26%',
                                left: '17%',
                                width: '15%', 
                                height: '20%', 
                                borderColor: 'red'
                            }]} />
                        </View>
                    </View>
                    <Text style={styles.placeholderText}>AI Detection Active</Text>
                </View>

                <View style={styles.resultsBox}>
                    <Text style={styles.resultsTitle}>AI Diagnostics & Findings:</Text>
                    <Text style={styles.finding}>🔴 Impacted Wisdom Tooth (Lower Left)</Text>
                    <Text style={styles.finding}>🔴 Impacted Wisdom Tooth (Lower Right)</Text>
                    <Text style={styles.finding}>🟠 Periapical Cyst (Upper Right)</Text>
                    
                    <View style={styles.doctorNoteBox}>
                        <Text style={styles.doctorNoteTitle}>Note from Dr. Smile Brillante:</Text>
                        <Text style={styles.doctorNote}>"We will monitor the cyst for now. However, the wisdom tooth requires extraction before we can proceed with your braces."</Text>
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    dateText: { fontSize: 12, color: '#888', marginBottom: 20 },
    
    viewerCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, elevation: 2, marginBottom: 20 },
    imageContainer: { width: '100%', borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
    xrayImage: { width: '100%', height: '100%' },
    overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    detectionBox: { position: 'absolute', borderWidth: 3, borderRadius: 5, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
    placeholderText: { color: '#888', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    
    resultsBox: { backgroundColor: '#fff3e0', padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#ffb74d' },
    resultsTitle: { fontSize: 16, fontWeight: 'bold', color: '#e65100', marginBottom: 10 },
    finding: { fontSize: 14, color: '#333', marginBottom: 5 },
    
    doctorNoteBox: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#ffcc80' },
    doctorNoteTitle: { fontSize: 12, fontWeight: 'bold', color: '#e65100', marginBottom: 5 },
    doctorNote: { fontSize: 13, color: '#555', fontStyle: 'italic', lineHeight: 20 }
});