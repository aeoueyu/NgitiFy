import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

export default function OdontogramScreen({ route, navigation }) {
    const { patient } = route.params;

    const upperTeeth = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
    const lowerTeeth = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];
    const [selectedTooth, setSelectedTooth] = useState(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const renderTooth = (num) => (
        <TouchableOpacity 
            key={num} 
            style={[styles.toothBox, selectedTooth === num && styles.toothBoxActive]}
            onPress={() => setSelectedTooth(num)}
        >
            <Text style={[styles.toothText, selectedTooth === num && styles.toothTextActive]}>{num}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Odontogram</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.patientBanner}>
                    <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
                    <Text style={styles.patientSub}>Select a tooth to add findings.</Text>
                </View>

                <View style={styles.odontogramCard}>
                    <Text style={styles.jawLabel}>UPPER JAW (Maxillary)</Text>
                    <View style={styles.teethRow}>{upperTeeth.map(renderTooth)}</View>
                    <View style={styles.divider} />
                    <View style={styles.teethRow}>{lowerTeeth.map(renderTooth)}</View>
                    <Text style={[styles.jawLabel, {marginTop: 10}]}>LOWER JAW (Mandibular)</Text>
                </View>

                {selectedTooth && (
                    <View style={styles.actionCard}>
                        <Text style={styles.selectedToothTitle}>Tooth #{selectedTooth} Options</Text>
                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.statusBtn}><Text style={styles.statusText}>Decayed</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.statusBtn}><Text style={styles.statusText}>Filled</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.statusBtn}><Text style={styles.statusText}>Missing</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.statusBtn}><Text style={styles.statusText}>Extracted</Text></TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.saveBtn} onPress={() => { alert(`Saved findings for Tooth ${selectedTooth}`); setSelectedTooth(null); }}>
                            <Text style={styles.saveBtnText}>Save Finding</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
    patientBanner: { marginBottom: 20, alignItems: 'center' },
    patientName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    patientSub: { fontSize: 13, color: '#888', marginTop: 3 },
    odontogramCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, elevation: 2, alignItems: 'center' },
    jawLabel: { fontSize: 12, fontWeight: 'bold', color: '#aaa', marginBottom: 10 },
    teethRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
    toothBox: { width: 35, height: 45, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    toothBoxActive: { backgroundColor: '#01538b', borderColor: '#01538b' },
    toothText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
    toothTextActive: { color: 'white' },
    divider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 15 },
    actionCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginTop: 20, elevation: 2 },
    selectedToothTitle: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 15, textAlign: 'center' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    statusBtn: { width: '48%', backgroundColor: '#f3f7f9', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
    statusText: { color: '#555', fontWeight: '600', fontSize: 12 },
    saveBtn: { backgroundColor: '#01538b', padding: 15, borderRadius: 50, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});