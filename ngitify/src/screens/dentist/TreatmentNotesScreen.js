import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import CalendarIcon from '../../assets/icons/Calendar.svg';
import BackIcon from '../../assets/icons/Back.svg';

const DUMMY_NOTES = [
    { id: '1', date: '2023-10-12', note: 'Patient complained of mild sensitivity on lower left molars. Recommended sensodyne toothpaste.' },
    { id: '2', date: '2023-05-04', note: 'Routine prophylaxis done. Gums are healthy.' }
];

export default function TreatmentNotesScreen({ route, navigation }) {
    const { patient } = route.params;
    const [newNote, setNewNote] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const handleSaveNote = () => {
        if (!newNote.trim()) {
            alert('Please type a note before saving.');
            return;
        }
        alert('Note saved successfully!');
        setNewNote('');
    };

    const renderPastNote = ({ item }) => (
        <View style={styles.noteCard}>
            <View style={styles.dateRow}>
                <CalendarIcon width={14} height={14} style={styles.iconStyle} />
                <Text style={styles.noteDate}>{item.date}</Text>
            </View>
            <Text style={styles.noteText}>{item.note}</Text>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Treatment Notes</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView 
                contentContainerStyle={styles.content} 
                showsVerticalScrollIndicator={false}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            >
                <View style={styles.patientBanner}>
                    <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add New Note</Text>
                    <TextInput 
                        style={styles.textArea} 
                        placeholder="Type your clinical findings or treatment notes here..." 
                        multiline={true} 
                        numberOfLines={4}
                        value={newNote}
                        onChangeText={setNewNote}
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNote}>
                        <Text style={styles.saveBtnText}>Save Note</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, {marginTop: 10}]}>Past Notes</Text>
                <FlatList 
                    data={DUMMY_NOTES}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPastNote}
                    scrollEnabled={false} 
                    ListEmptyComponent={<Text style={{color: '#888', textAlign: 'center', marginTop: 20}}>No past notes available.</Text>}
                />
            </Animated.ScrollView>
        </KeyboardAvoidingView>
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

    section: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 20, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 15 },
    textArea: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', fontSize: 14, color: '#333', minHeight: 100, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: '#01538b', padding: 15, borderRadius: 50, alignItems: 'center', marginTop: 15 },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    noteCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    iconStyle: { color: '#01538b', marginRight: 5 },
    noteDate: { fontSize: 12, fontWeight: 'bold', color: '#01538b' },
    noteText: { fontSize: 14, color: '#444', lineHeight: 20 }
});