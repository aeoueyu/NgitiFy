import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

const { width } = Dimensions.get('window');
const imageHeight = width * 0.5;

export default function XRayScreen({ route, navigation }) {
    const { patient } = route.params;
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const runAIAnalysis = () => {
        setIsAnalyzing(true);
        setTimeout(() => {
            setIsAnalyzing(false);
            setShowResults(true);
        }, 2000);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>X-Ray Records</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.patientBanner}>
                    <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
                </View>

                <View style={styles.viewerCard}>
                    <View style={[styles.imageContainer, { height: imageHeight }]}>
                        <Image 
                            source={require('../../assets/ai-xray/PanoramicXRay.png')} 
                            style={styles.xrayImage} 
                            resizeMode="contain"
                        />
                        
                        {showResults && (
                            <View style={styles.overlayContainer}>
                                <View style={[styles.detectionBox, { top: '10%', left: '55%', width: '20%', height: '25%', borderColor: 'orange' }]} />
                                <View style={[styles.detectionBox, { bottom: '23%', right: '17%', width: '15%', height: '20%', borderColor: 'red' }]} />
                                <View style={[styles.detectionBox, { bottom: '26%', left: '17%', width: '15%', height: '20%', borderColor: 'red' }]} />
                            </View>
                        )}
                    </View>
                    <Text style={styles.placeholderText}>{showResults ? "AI Detection Active" : "Panoramic X-Ray"}</Text>
                </View>

                {!showResults ? (
                    <TouchableOpacity 
                        style={[styles.analyzeBtn, isAnalyzing && {opacity: 0.7}]} 
                        onPress={runAIAnalysis}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <ActivityIndicator color="white" /> : <Text style={styles.analyzeBtnText}>Run AI Anomaly Detector</Text>}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.resultsBox}>
                        <Text style={styles.resultsTitle}>AI Findings:</Text>
                        <Text style={styles.finding}>🔴 Impacted Wisdom Tooth (Lower Left)</Text>
                        <Text style={styles.finding}>🔴 Impacted Wisdom Tooth (Lower Right)</Text>
                        <Text style={styles.finding}>🟠 Periapical Cyst (Upper Right)</Text>
                    </View>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 },
    backText: { color: '#01538b', fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    content: { padding: 20 },
    patientBanner: { marginBottom: 20, alignItems: 'center' },
    patientName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    
    viewerCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, elevation: 2, marginBottom: 20 },
    imageContainer: { width: '100%', borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
    xrayImage: { width: '100%', height: '100%' },
    overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    detectionBox: { position: 'absolute', borderWidth: 3, borderRadius: 5, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
    placeholderText: { color: '#888', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    
    analyzeBtn: { backgroundColor: '#01538b', padding: 15, borderRadius: 50, alignItems: 'center', elevation: 2 },
    analyzeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    resultsBox: { backgroundColor: '#fff3e0', padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#ffb74d' },
    resultsTitle: { fontSize: 16, fontWeight: 'bold', color: '#e65100', marginBottom: 10 },
    finding: { fontSize: 14, color: '#333', marginBottom: 5 }
});