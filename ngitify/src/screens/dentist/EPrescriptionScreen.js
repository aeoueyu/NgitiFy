// src/screens/dentist/EPrescriptionScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

export default function EPrescriptionScreen({ navigation }) {
    const [medicine, setMedicine] = useState('');
    const [dosage, setDosage] = useState('');
    const [frequency, setFrequency] = useState('');
    const [prescriptionList, setPrescriptionList] = useState([]);

    const handleAddMedicine = () => {
        if (!medicine || !dosage || !frequency) {
            Alert.alert("Error", "Please fill out all medicine details.");
            return;
        }
        setPrescriptionList([...prescriptionList, { id: Date.now().toString(), medicine, dosage, frequency }]);
        setMedicine(''); setDosage(''); setFrequency('');
    };

    const handleSendPrescription = () => {
        if (prescriptionList.length === 0) {
            Alert.alert("Error", "Please add at least one medicine to the prescription.");
            return;
        }
        Alert.alert("Success", "E-Prescription has been sent to the patient's portal.", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>E-Prescription</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                <Text style={styles.sectionTitle}>Add Medication</Text>
                <View style={styles.inputCard}>
                    <Text style={styles.label}>Medicine Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. Amoxicillin" value={medicine} onChangeText={setMedicine} />
                    
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Dosage</Text>
                            <TextInput style={styles.input} placeholder="e.g. 500mg" value={dosage} onChangeText={setDosage} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Frequency</Text>
                            <TextInput style={styles.input} placeholder="e.g. 3x a day" value={frequency} onChangeText={setFrequency} />
                        </View>
                    </View>
                    
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddMedicine}>
                        <Text style={styles.addBtnText}>+ Add to Prescription</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Current Prescription List</Text>
                {prescriptionList.length === 0 ? (
                    <Text style={styles.emptyText}>No medicines added yet.</Text>
                ) : (
                    prescriptionList.map((item) => (
                        <View key={item.id} style={styles.medCard}>
                            <Text style={styles.medName}>{item.medicine}</Text>
                            <Text style={styles.medDetails}>{item.dosage} | {item.frequency}</Text>
                        </View>
                    ))
                )}

                <TouchableOpacity 
                    style={[styles.submitBtn, prescriptionList.length === 0 && styles.submitBtnDisabled]} 
                    onPress={handleSendPrescription}
                >
                    <Text style={styles.submitBtnText}>Generate & Send E-Prescription</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f3f7f9' 
    },
    header: { 
        backgroundColor: 'white', 
        padding: 20, 
        paddingTop: 50, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        elevation: 3, 
        zIndex: 10 
    },
    backBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        width: 60, 
        padding: 5 
    },
    backText: { 
        color: '#01538b', 
        fontWeight: 'bold', 
        fontSize: 16 
    },
    headerTitle: { 
        fontSize: 20, 
        fontWeight: 'bold', 
        color: '#01538b' 
    },
    content: { 
        padding: 20 
    },
    
    sectionTitle: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#555', 
        marginBottom: 10 
    },
    inputCard: { 
        backgroundColor: 'white', 
        padding: 20, 
        borderRadius: 15, 
        elevation: 2, 
        marginBottom: 20 
    },
    label: { 
        fontSize: 12, 
        fontWeight: 'bold', 
        color: '#888', 
        marginBottom: 5 
    },
    input: { 
        backgroundColor: '#f9f9f9', 
        padding: 15, 
        borderRadius: 10, 
        fontSize: 15, 
        marginBottom: 15, 
        borderWidth: 1, 
        borderColor: '#eee' 
    },
    row: { 
        flexDirection: 'row' 
    },
    addBtn: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5 },
    addBtnText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 14 },

    emptyText: { textAlign: 'center', color: '#999', fontStyle: 'italic', marginBottom: 30, marginTop: 10 },
    
    medCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#01538b' },
    medName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    medDetails: { fontSize: 14, color: '#666', marginTop: 5 },

    submitBtn: { backgroundColor: '#01538b', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20, elevation: 3 },
    submitBtnDisabled: { backgroundColor: '#ccc' },
    submitBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});