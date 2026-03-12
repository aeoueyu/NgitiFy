import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

import EmailIcon from '../../assets/icons/Email.svg';
import ContactNumberIcon from '../../assets/icons/ContactNumber.svg';
import DentistSpecializationIcon from '../../assets/icons/DentistSpecialization.svg';
import IDIcon from '../../assets/icons/ID.svg';

const DUMMY_DENTISTS = [
    { id: 'd1', firstName: 'Smile', lastName: 'Brillante', email: 'dentist@ngitify.com', phone: '09171234567', specialization: 'General Dentistry', prc: '1234567' },
    { id: 'd2', firstName: 'John', lastName: 'Doe', email: 'johndoe@gmail.com', phone: '09189876543', specialization: 'Orthodontics', prc: '7654321' },
];

const DUMMY_SECRETARIES = [
    { id: 's1', firstName: 'Jen', lastName: 'Santos', email: 'sec@ngitify.com', phone: '09223334455' },
    { id: 's2', firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@yahoo.com', phone: '09998887766' },
];

export default function ManageStaffScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('Dentists'); 
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredData, setFilteredData] = useState(DUMMY_DENTISTS);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        const sourceData = activeTab === 'Dentists' ? DUMMY_DENTISTS : DUMMY_SECRETARIES;
        if (searchQuery) {
            const newData = sourceData.filter(item => {
                const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
                return fullName.includes(searchQuery.toLowerCase());
            });
            setFilteredData(newData);
        } else {
            setFilteredData(sourceData);
        }
    }, [activeTab, searchQuery]);

    const renderStaffCard = ({ item }) => (
        <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <Text style={styles.staffName}>Dr. {item.firstName} {item.lastName}</Text>
                <View style={styles.roleTag}>
                    <Text style={styles.roleText}>{activeTab === 'Dentists' ? 'Dentist' : 'Secretary'}</Text>
                </View>
            </View>
            
            <View style={styles.cardBody}>
                <View style={styles.iconRow}>
                    <EmailIcon width={14} height={14} style={styles.iconStyle} />
                    <Text style={styles.infoText}>{item.email}</Text>
                </View>
                <View style={styles.iconRow}>
                    <ContactNumberIcon width={14} height={14} style={styles.iconStyle} />
                    <Text style={styles.infoText}>{item.phone}</Text>
                </View>
                {activeTab === 'Dentists' && (
                    <>
                        <View style={styles.iconRow}>
                            <DentistSpecializationIcon width={14} height={14} style={styles.iconStyle} />
                            <Text style={styles.infoText}>{item.specialization}</Text>
                        </View>
                        <View style={styles.iconRow}>
                            <IDIcon width={14} height={14} style={styles.iconStyle} />
                            <Text style={styles.infoText}>PRC: {item.prc}</Text>
                        </View>
                    </>
                )}
            </View>

            <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('StaffProfile', { staff: item, role: activeTab })}>
                <Text style={styles.viewBtnText}>View Details</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Staff</Text>
                <View style={{width: 50}} /> 
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'Dentists' && styles.activeTabBtn]} onPress={() => { setActiveTab('Dentists'); setSearchQuery(''); }}>
                        <Text style={[styles.tabText, activeTab === 'Dentists' && styles.activeTabText]}>Dentists</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'Secretaries' && styles.activeTabBtn]} onPress={() => { setActiveTab('Secretaries'); setSearchQuery(''); }}>
                        <Text style={[styles.tabText, activeTab === 'Secretaries' && styles.activeTabText]}>Secretaries</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <View style={styles.searchWrapper}>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder={`Search ${activeTab ? activeTab.toLowerCase() : '...'}`}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
                                <Text style={styles.clearBtnText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <FlatList 
                    data={filteredData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderStaffCard}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No {activeTab.toLowerCase()} found.</Text>}
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
    tabContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTabBtn: { borderBottomColor: '#01538b' },
    tabText: { fontSize: 14, fontWeight: 'bold', color: '#888' },
    activeTabText: { color: '#01538b' },
    searchContainer: { padding: 20, paddingBottom: 10 },
    searchWrapper: { position: 'relative', justifyContent: 'center' }, 
    searchInput: { backgroundColor: 'white', padding: 15, paddingRight: 45, borderRadius: 50, borderWidth: 1, borderColor: '#ddd', fontSize: 14, color: '#333', elevation: 2 },
    clearBtn: { position: 'absolute', right: 15, padding: 5 },
    clearBtnText: { color: '#888', fontSize: 16, fontWeight: 'bold' },
    listContainer: { padding: 20, paddingTop: 10, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontSize: 14 },
    card: { backgroundColor: 'white', borderRadius: 15, padding: 20, marginBottom: 15, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    staffName: { fontSize: 18, fontWeight: 'bold', color: '#01538b', flex: 1 },
    roleTag: { backgroundColor: '#e0f2f1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    roleText: { fontSize: 10, fontWeight: 'bold', color: '#00897b' },
    cardBody: { marginBottom: 15 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    iconStyle: { marginRight: 8, color: '#888' },
    infoText: { fontSize: 13, color: '#555' },
    viewBtn: { backgroundColor: '#f3f7f9', padding: 10, borderRadius: 50, alignItems: 'center' },
    viewBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 12 }
});