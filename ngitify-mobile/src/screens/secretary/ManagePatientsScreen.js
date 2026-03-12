import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';

import BackIcon from '../../assets/icons/Back.svg';
import ContactNumberIcon from '../../assets/icons/ContactNumber.svg';
import BirthdayIcon from '../../assets/icons/Birthday.svg';

const DUMMY_PATIENTS = [
    { id: '1', firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@gmail.com', phone: '09123456789', birthdate: '1995-05-15', conditions: ['Asthma'], allergies: 'Peanuts' },
    { id: '2', firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@gmail.com', phone: '09554446666', birthdate: '2010-02-14', conditions: ['None'], allergies: 'None' }
];

export default function ManagePatientsScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredPatients, setFilteredPatients] = useState(DUMMY_PATIENTS);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const handleSearch = (text) => {
        setSearchQuery(text);
        if (text) {
            const newData = DUMMY_PATIENTS.filter(item => {
                return `${item.firstName} ${item.lastName}`.toLowerCase().includes(text.toLowerCase());
            });
            setFilteredPatients(newData);
        } else {
            setFilteredPatients(DUMMY_PATIENTS);
        }
    };

    const calculateAge = (birthdate) => {
        const today = new Date();
        const bDate = new Date(birthdate);
        let age = today.getFullYear() - bDate.getFullYear();
        if (today.getMonth() < bDate.getMonth() || (today.getMonth() === bDate.getMonth() && today.getDate() < bDate.getDate())) age--;
        return age;
    };

    const renderPatientCard = ({ item }) => {
        const age = calculateAge(item.birthdate);
        return (
            <TouchableOpacity style={styles.card} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                    <Text style={styles.patientName}>{item.firstName} {item.lastName}</Text>
                    {age < 18 && <View style={styles.minorTag}><Text style={styles.minorText}>Minor</Text></View>}
                </View>
                
                <View style={styles.cardBody}>
                    <View style={styles.iconRow}>
                        <ContactNumberIcon width={14} height={14} style={styles.iconStyle} />
                        <Text style={styles.infoText}>{item.phone}</Text>
                    </View>
                    <View style={styles.iconRow}>
                        <BirthdayIcon width={14} height={14} style={styles.iconStyle} />
                        <Text style={styles.infoText}>{age} years old</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('PatientDetails', { patient: item })}>
                    <Text style={styles.viewBtnText}>View Details</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Records</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.searchContainer}>
                    <View style={styles.searchWrapper}>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity style={styles.clearBtn} onPress={() => handleSearch('')}>
                                <Text style={styles.clearBtnText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <FlatList 
                    data={filteredPatients}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPatientCard}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No patients found.</Text>}
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    searchContainer: { padding: 20, paddingBottom: 10 },
    searchWrapper: { position: 'relative', justifyContent: 'center' }, 
    searchInput: { backgroundColor: 'white', padding: 15, paddingRight: 45, borderRadius: 50, borderWidth: 1, borderColor: '#ddd', fontSize: 14, color: '#333', elevation: 2 },
    clearBtn: { position: 'absolute', right: 15, padding: 5 },
    clearBtnText: { color: '#888', fontSize: 16, fontWeight: 'bold' },

    listContainer: { padding: 20, paddingTop: 10, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontSize: 14 },
    
    card: { backgroundColor: 'white', borderRadius: 15, padding: 20, marginBottom: 15, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    patientName: { fontSize: 18, fontWeight: 'bold', color: '#01538b', flex: 1 },
    minorTag: { backgroundColor: '#ffe082', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    minorText: { fontSize: 10, fontWeight: 'bold', color: '#f57f17' },
    
    cardBody: { marginBottom: 15 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    iconStyle: { marginRight: 8, color: '#888' },
    infoText: { fontSize: 13, color: '#555' },
    
    viewBtn: { backgroundColor: '#f3f7f9', padding: 10, borderRadius: 50, alignItems: 'center' },
    viewBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 12 }
});