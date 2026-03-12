import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, FlatList, Animated } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomModal from '../../components/CustomModal';
import BackIcon from '../../assets/icons/Back.svg';

export default function AddSurgeryScreen({ route, navigation }) {
    const { patient } = route.params;

    const [formData, setFormData] = useState({ procedure: '', date: '', time: '', cost: '', remarks: '' });
    const [modalVisible, setModalVisible] = useState(false);
    
    const [showPicker, setShowPicker] = useState({ visible: false, mode: 'date' });
    const [dateTimeObj, setDateTimeObj] = useState(new Date());
    const [dropdown, setDropdown] = useState({ visible: false, title: '', items: [], onSelect: null });
    const procedures = ["Tooth Extraction", "Root Canal Therapy", "Dental Implant", "Impacted Wisdom Tooth Removal", "Gingivectomy"];

    const isFormValid = formData.procedure !== '' && formData.date !== '' && formData.time !== '' && formData.cost.trim() !== '';

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handlePickerChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowPicker({ visible: false, mode: 'date' });
        if (selectedDate) {
            setDateTimeObj(selectedDate);
            if (showPicker.mode === 'date') {
                handleChange('date', selectedDate.toISOString().split('T')[0]);
            } else {
                let hours = selectedDate.getHours();
                let minutes = selectedDate.getMinutes();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; 
                minutes = minutes < 10 ? '0' + minutes : minutes;
                handleChange('time', `${hours}:${minutes} ${ampm}`);
            }
        }
    };

    const openDropdown = () => setDropdown({ visible: true, title: 'Procedure', items: procedures, onSelect: (val) => handleChange('procedure', val) });

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Schedule Surgery</Text>
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
                    <Text style={styles.sectionTitle}>Surgery Details</Text>
                    
                    <Text style={styles.label}>Type of Procedure *</Text>
                    <TouchableOpacity style={styles.inputBox} onPress={openDropdown} activeOpacity={0.7}>
                        <Text style={{color: formData.procedure ? '#333' : '#aaa'}}>{formData.procedure || 'Select Procedure'}</Text>
                        <Text style={{color: '#888', fontSize: 12}}>▼</Text>
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Date *</Text>
                            <TouchableOpacity style={styles.inputBox} onPress={() => setShowPicker({ visible: true, mode: 'date' })}>
                                <Text style={{ color: formData.date ? '#333' : '#aaa' }}>{formData.date || "YYYY-MM-DD"}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Time *</Text>
                            <TouchableOpacity style={styles.inputBox} onPress={() => setShowPicker({ visible: true, mode: 'time' })}>
                                <Text style={{ color: formData.time ? '#333' : '#aaa' }}>{formData.time || "HH:MM AM/PM"}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.label}>Estimated Cost (₱) *</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. 5000" keyboardType="numeric" value={formData.cost} onChangeText={(v) => handleChange('cost', v.replace(/[^0-9]/g, ''))} />

                    <Text style={styles.label}>Remarks / Preparation Notes</Text>
                    <TextInput style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="e.g. Advise patient to eat before surgery." value={formData.remarks} onChangeText={(v) => handleChange('remarks', v)} />
                </View>

                <TouchableOpacity style={[styles.submitBtn, !isFormValid && styles.submitBtnDisabled]} onPress={() => setModalVisible(true)} disabled={!isFormValid}>
                    <Text style={[styles.submitBtnText, !isFormValid && {color: '#999'}]}>{isFormValid ? "SCHEDULE SURGERY" : "FILL ALL REQUIRED FIELDS"}</Text>
                </TouchableOpacity>
            </Animated.ScrollView>

            {showPicker.visible && Platform.OS === 'android' && (
                <DateTimePicker value={dateTimeObj} mode={showPicker.mode} display="default" minimumDate={new Date()} onChange={handlePickerChange} />
            )}

            <Modal visible={showPicker.visible && Platform.OS === 'ios'} transparent={true} animationType="slide" onRequestClose={() => setShowPicker({ visible: false, mode: 'date' })}>
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select {showPicker.mode === 'date' ? 'Date' : 'Time'}</Text>
                            <TouchableOpacity onPress={() => setShowPicker({ visible: false, mode: 'date' })}><Text style={{fontSize: 16, color: '#01538b', fontWeight: 'bold'}}>Done</Text></TouchableOpacity>
                        </View>
                        <View style={{backgroundColor: 'white', alignItems: 'center', paddingBottom: 20}}>
                            <DateTimePicker value={dateTimeObj} mode={showPicker.mode} display={showPicker.mode === 'date' ? 'inline' : 'spinner'} minimumDate={showPicker.mode === 'date' ? new Date() : undefined} onChange={handlePickerChange} themeVariant="light"/>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={dropdown.visible} transparent={true} animationType="slide" onRequestClose={() => setDropdown({...dropdown, visible: false})}>
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select {dropdown.title}</Text>
                            <TouchableOpacity onPress={() => setDropdown({...dropdown, visible: false})}><Text style={{fontSize: 20, color: '#888', fontWeight: 'bold'}}>✕</Text></TouchableOpacity>
                        </View>
                        <FlatList data={dropdown.items} keyExtractor={(item, index) => index.toString()} 
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.dropdownItem} onPress={() => { dropdown.onSelect(item); setDropdown({...dropdown, visible: false}); }}>
                                    <Text style={styles.dropdownItemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <CustomModal visible={modalVisible} title="Surgery Scheduled!" message={`${formData.procedure} for ${patient.firstName} has been set on ${formData.date} at ${formData.time}.`} type="success" onClose={() => { setModalVisible(false); navigation.goBack(); }} />
        </KeyboardAvoidingView>
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
        padding: 5, 
        width: 60 
    },
    backText: { 
        color: '#01538b', 
        fontWeight: 'bold', 
        fontSize: 16 
    },
    headerTitle: { 
        fontSize: 20, 
        fontWeight: 
        'bold', 
        color: '#01538b' 
    },
    content: { 
        padding: 20 
    },
    patientBanner: { 
        marginBottom: 20, 
        alignItems: 'center' 
    },
    patientName: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#333' 
    },
    section: { 
        backgroundColor: 'white', 
        padding: 20, 
        borderRadius: 15, 
        marginBottom: 15, 
        elevation: 2 
    },
    sectionTitle: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#01538b', 
        marginBottom: 15, 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee', 
        paddingBottom: 10 
    },
    row: { 
        flexDirection: 'row', 
        justifyContent: 'space-between' 
    },
    label: { 
        fontSize: 12, 
        fontWeight: '700', 
        color: '#555', 
        marginBottom: 5, 
        marginLeft: 5 
    },
    inputBox: { 
        backgroundColor: '#f9f9f9', 
        padding: 12, 
        borderRadius: 10, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        marginBottom: 15, 
        fontSize: 14, 
        color: '#333', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
    },
    submitBtn: { 
        backgroundColor: '#01538b', 
        padding: 18, 
        borderRadius: 50, 
        alignItems: 'center', 
        marginTop: 10, 
        elevation: 3 
    },
    submitBtnDisabled: { 
        backgroundColor: '#e0e0e0', 
        elevation: 0 
    }, 
    submitBtnText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 14 
    },
    bottomSheetOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'flex-end' 
    },
    bottomSheetContainer: { 
        backgroundColor: 'white', 
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20, 
        maxHeight: '60%', 
        paddingBottom: 20 
    },
    bottomSheetHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 20, 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee' 
    },
    bottomSheetTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#01538b' 
    },
    dropdownItem: { 
        padding: 18, 
        borderBottomWidth: 1, 
        borderBottomColor: '#f0f0f0' 
    },
    dropdownItemText: { 
        fontSize: 16, 
        color: '#333' 
    }
});