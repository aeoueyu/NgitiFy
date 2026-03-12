import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    ScrollView, KeyboardAvoidingView, Platform, Switch, Modal, FlatList
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomModal from '../../components/CustomModal';
import Calendar from '../../assets/images/calendar.svg';

import regionsData from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

import BackIcon from '../../assets/icons/Back.svg';

const DUMMY_EMAILS = ['juan@gmail.com', 'jane.doe@gmail.com', 'test@gmail.com'];
const GUARDIAN_RELATIONSHIPS = ["Mother", "Father", "Sibling", "Grandparent", "Aunt/Uncle", "Legal Guardian", "Other"];

export default function AddPatientScreen({ navigation }) {
    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', email: '', phone: '',
        guardianName: '', guardianRel: '', guardianPhone: '',
        allergies: '', conditions: [],
        currReg: '', currProv: '', currCity: '', currBrgy: '', currStreet: '', currHouse: '',
        permReg: '', permProv: '', permCity: '', permBrgy: '', permStreet: '', permHouse: '',
    });

    const [isMinor, setIsMinor] = useState(false);
    const [isSameAddress, setIsSameAddress] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateObj, setDateObj] = useState(new Date());
    const [dropdown, setDropdown] = useState({ visible: false, title: '', items: [], labelKey: '', valueKey: '', onSelect: null });
    
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [guardianPhoneError, setGuardianPhoneError] = useState('');

    const commonConditions = ["High Blood Pressure", "Diabetes", "Asthma", "Heart Disease", "Bleeding Disorders", "Epilepsy", "None"];

    const availableCurrProvinces = provincesData.filter(p => p.region_code === formData.currReg);
    const availableCurrCities = citiesData.filter(c => c.province_code === formData.currProv);
    const availableCurrBarangays = barangaysData.filter(b => b.city_code === formData.currCity);

    const availablePermProvinces = provincesData.filter(p => p.region_code === formData.permReg);
    const availablePermCities = citiesData.filter(c => c.province_code === formData.permProv);
    const availablePermBarangays = barangaysData.filter(b => b.city_code === formData.permCity);

    const toTitleCase = (str) => {
        return str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
    };

    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) return false;
        
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        return allowedDomains.includes(domain);
    };

    const isPatientPhoneValid = isMinor 
        ? (formData.phone === '' || (formData.phone.length === 11 && formData.phone.startsWith('09')))
        : (formData.phone.length === 11 && formData.phone.startsWith('09'));

    const isFormValid = 
        formData.firstName.trim() !== '' && formData.lastName.trim() !== '' &&
        formData.birthdate !== '' && 
        isPatientPhoneValid &&
        validateEmail(formData.email) && !DUMMY_EMAILS.includes(formData.email.toLowerCase()) && 
        formData.currReg !== '' && formData.currProv !== '' && formData.currCity !== '' && formData.currBrgy !== '' &&
        (!isMinor || (formData.guardianName.trim() !== '' && formData.guardianRel.trim() !== '' && formData.guardianPhone.length === 11 && formData.guardianPhone.startsWith('09'))) &&
        (isSameAddress || (formData.permReg !== '' && formData.permProv !== '' && formData.permCity !== '' && formData.permBrgy !== ''));

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleNameChange = (field, value) => {
        const sanitized = value.replace(/[^a-zA-Z\s.-]/g, '');
        handleChange(field, toTitleCase(sanitized));
    };

    const handlePhoneChange = (field, value) => {
        const sanitized = value.replace(/[^0-9]/g, '');
        handleChange(field, sanitized);

        let errorMsg = '';
        if (sanitized.length > 0 && !sanitized.startsWith('09')) {
            errorMsg = 'Must start with 09';
        } else if (sanitized.length > 0 && sanitized.length < 11) {
            errorMsg = 'Must be 11 digits';
        }

        if (field === 'guardianPhone') {
            setGuardianPhoneError(errorMsg);
        } else {
            setPhoneError(errorMsg);
        }
    };

    const handleEmailChange = (value) => {
        const sanitized = value.replace(/\s/g, '');
        handleChange('email', sanitized);

        if (sanitized.length > 0) {
            if (!validateEmail(sanitized)) {
                setEmailError('Invalid email format or domain not supported.');
            } else if (DUMMY_EMAILS.includes(sanitized.toLowerCase())) {
                setEmailError('Email already exists.');
            } else {
                setEmailError('');
            }
        } else {
            setEmailError('');
        }
    };

    const handleAddressChange = (type, field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'currReg') { updated.currProv = ''; updated.currCity = ''; updated.currBrgy = ''; }
            if (field === 'currProv') { updated.currCity = ''; updated.currBrgy = ''; }
            if (field === 'currCity') { updated.currBrgy = ''; }
            
            if (field === 'permReg') { updated.permProv = ''; updated.permCity = ''; updated.permBrgy = ''; }
            if (field === 'permProv') { updated.permCity = ''; updated.permBrgy = ''; }
            if (field === 'permCity') { updated.permBrgy = ''; }

            if (type === 'current' && isSameAddress) {
                updated.permReg = updated.currReg; updated.permProv = updated.currProv;
                updated.permCity = updated.currCity; updated.permBrgy = updated.currBrgy;
            }
            return updated;
        });
    };

    const calculateAgeAndCheckMinor = (selectedDate) => {
        const today = new Date();
        let age = today.getFullYear() - selectedDate.getFullYear();
        if (today.getMonth() < selectedDate.getMonth() || (today.getMonth() === selectedDate.getMonth() && today.getDate() < selectedDate.getDate())) age--;
        
        if (age < 18) setIsMinor(true);
        else { setIsMinor(false); handleChange('guardianName', ''); handleChange('guardianRel', ''); handleChange('guardianPhone', ''); setGuardianPhoneError(''); }
    };

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) {
            setDateObj(selectedDate);
            const formattedDate = selectedDate.toISOString().split('T')[0];
            handleChange('birthdate', formattedDate);
            calculateAgeAndCheckMinor(selectedDate);
        }
    };

    const toggleCondition = (condition) => {
        setFormData(prev => {
            const current = prev.conditions;
            return current.includes(condition) 
                ? { ...prev, conditions: current.filter(c => c !== condition) }
                : { ...prev, conditions: [...current, condition] };
        });
    };

    const handleSameAddressToggle = (value) => {
        setIsSameAddress(value);
        if (value) {
            setFormData(prev => ({ ...prev, permReg: prev.currReg, permProv: prev.currProv, permCity: prev.currCity, permBrgy: prev.currBrgy, permStreet: prev.currStreet, permHouse: prev.currHouse }));
        } else {
            setFormData(prev => ({ ...prev, permReg: '', permProv: '', permCity: '', permBrgy: '', permStreet: '', permHouse: '' }));
        }
    };

    const openDropdown = (title, items, labelKey, valueKey, onSelect) => {
        setDropdown({ visible: true, title, items, labelKey, valueKey, onSelect });
    };

    const openRelDropdown = () => {
        setDropdown({ 
            visible: true, 
            title: 'Relationship', 
            items: GUARDIAN_RELATIONSHIPS.map(r => ({label: r, value: r})), 
            labelKey: 'label', 
            valueKey: 'value', 
            onSelect: (val) => handleChange('guardianRel', val) 
        });
    };

    const renderDropdownInput = (label, selectedValue, items, labelKey, valueKey, onSelect, disabled = false) => {
        const selectedItem = items.find(i => i[valueKey] === selectedValue);
        const displayLabel = selectedItem ? selectedItem[labelKey] : `Select ${label}`;

        return (
            <View style={{flex: 1, marginHorizontal: 5, marginBottom: 15}}>
                <Text style={styles.label}>{label} *</Text>
                <TouchableOpacity 
                    style={[styles.inputBox, disabled && {backgroundColor: '#e0e0e0'}]} 
                    onPress={() => !disabled && openDropdown(label, items, labelKey, valueKey, onSelect)}
                    activeOpacity={0.7}
                >
                    <Text style={{color: selectedValue ? '#333' : '#aaa', fontSize: 14}} numberOfLines={1}>
                        {displayLabel}
                    </Text>
                    <Text style={{color: '#888', fontSize: 12}}>▼</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Patient</Text>
                <View style={{width: 60}} />
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
                
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <Text style={styles.label}>First Name *</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Juan" maxLength={50} value={formData.firstName} onChangeText={(v) => handleNameChange('firstName', v)} />
                    
                    <Text style={styles.label}>Middle Name</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Santos" maxLength={30} value={formData.middleName} onChangeText={(v) => handleNameChange('middleName', v)} />
                    
                    <Text style={styles.label}>Last Name *</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Dela Cruz" maxLength={50} value={formData.lastName} onChangeText={(v) => handleNameChange('lastName', v)} />
                    
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Birthdate *</Text>
                            <TouchableOpacity style={[styles.inputBox, {justifyContent: 'space-between'}]} onPress={() => setShowDatePicker(true)}>
                                <Text style={{ color: formData.birthdate ? '#333' : '#aaa' }}>{formData.birthdate || "YYYY-MM-DD"}</Text>
                                <Calendar width={15} height={15}/>
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Phone Number {isMinor ? '(Optional)' : '*'}</Text>
                            <TextInput style={[styles.inputBox, {marginBottom: 5}]} placeholder="09xxxxxxxxx" keyboardType="phone-pad" maxLength={11} value={formData.phone} onChangeText={(v) => handlePhoneChange('phone', v)} />
                            {phoneError !== '' && <Text style={styles.errorText}>{phoneError}</Text>}
                        </View>
                    </View>

                    <Text style={[styles.label, {marginTop: 10}]}>Email Address *</Text>
                    <TextInput style={[styles.inputBox, {marginBottom: 5}]} placeholder="juan@gmail.com" keyboardType="email-address" autoCapitalize="none" maxLength={60} value={formData.email} onChangeText={handleEmailChange} />
                    {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}
                </View>

                {isMinor && (
                    <View style={[styles.section, styles.guardianSection]}>
                        <Text style={[styles.sectionTitle, {color: '#f57f17'}]}>Guardian Information (Required)</Text>
                        <Text style={styles.label}>Guardian Name *</Text>
                        <TextInput style={styles.inputBox} placeholder="e.g. Maria Dela Cruz" maxLength={50} value={formData.guardianName} onChangeText={(v) => handleNameChange('guardianName', v)} />
                        
                        <View style={styles.row}>
                            <View style={{flex: 1, marginRight: 10}}>
                                <Text style={styles.label}>Relationship *</Text>
                                <TouchableOpacity style={styles.inputBox} onPress={openRelDropdown} activeOpacity={0.7}>
                                    <Text style={{color: formData.guardianRel ? '#333' : '#aaa', fontSize: 14}} numberOfLines={1}>
                                        {formData.guardianRel || "Select Relationship"}
                                    </Text>
                                    <Text style={{color: '#888', fontSize: 12}}>▼</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={styles.label}>Contact No. *</Text>
                                <TextInput style={[styles.inputBox, {marginBottom: 5}]} placeholder="09xxxxxxxxx" keyboardType="phone-pad" maxLength={11} value={formData.guardianPhone} onChangeText={(v) => handlePhoneChange('guardianPhone', v)} />
                                {guardianPhoneError !== '' && <Text style={styles.errorText}>{guardianPhoneError}</Text>}
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medical History</Text>
                    <Text style={styles.label}>Allergies</Text>
                    <TextInput style={styles.inputBox} placeholder="Leave blank if none" maxLength={100} value={formData.allergies} onChangeText={(v) => handleChange('allergies', v)} />
                    <Text style={styles.label}>Medical Conditions</Text>
                    <View style={styles.checkboxGroup}>
                        {commonConditions.map(cond => (
                            <TouchableOpacity key={cond} style={[styles.checkboxBtn, formData.conditions.includes(cond) && styles.checkboxBtnActive]} onPress={() => toggleCondition(cond)}>
                                <Text style={[styles.checkboxText, formData.conditions.includes(cond) && styles.checkboxTextActive]}>{cond}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Current Address</Text>
                    <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                        {renderDropdownInput("Region", formData.currReg, regionsData, "region_name", "region_code", (val) => handleAddressChange('current', 'currReg', val))}
                        {renderDropdownInput("Province", formData.currProv, availableCurrProvinces, "province_name", "province_code", (val) => handleAddressChange('current', 'currProv', val), !formData.currReg)}
                    </View>
                    <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                        {renderDropdownInput("City", formData.currCity, availableCurrCities, "city_name", "city_code", (val) => handleAddressChange('current', 'currCity', val), !formData.currProv)}
                        {renderDropdownInput("Barangay", formData.currBrgy, availableCurrBarangays, "brgy_name", "brgy_code", (val) => handleAddressChange('current', 'currBrgy', val), !formData.currCity)}
                    </View>
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Street</Text><TextInput style={styles.inputBox} maxLength={100} value={formData.currStreet} onChangeText={(v) => { handleChange('currStreet', v); if(isSameAddress) handleChange('permStreet', v); }} /></View>
                        <View style={{flex: 1}}><Text style={styles.label}>House No.</Text><TextInput style={styles.inputBox} maxLength={50} value={formData.currHouse} onChangeText={(v) => { handleChange('currHouse', v); if(isSameAddress) handleChange('permHouse', v); }} /></View>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                        <Text style={styles.sectionTitle}>Permanent Address</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text style={{fontSize: 12, marginRight: 5, color: '#555'}}>Same as Current</Text>
                            <Switch value={isSameAddress} onValueChange={handleSameAddressToggle} trackColor={{ false: "#ddd", true: "#01538b" }} thumbColor={isSameAddress ? "#e6eef3" : "#f4f3f4"} />
                        </View>
                    </View>
                    <View style={{ opacity: isSameAddress ? 0.5 : 1 }} pointerEvents={isSameAddress ? 'none' : 'auto'}>
                        <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                            {renderDropdownInput("Region", formData.permReg, regionsData, "region_name", "region_code", (val) => handleAddressChange('permanent', 'permReg', val), isSameAddress)}
                            {renderDropdownInput("Province", formData.permProv, availablePermProvinces, "province_name", "province_code", (val) => handleAddressChange('permanent', 'permProv', val), isSameAddress || !formData.permReg)}
                        </View>
                        <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                            {renderDropdownInput("City", formData.permCity, availablePermCities, "city_name", "city_code", (val) => handleAddressChange('permanent', 'permCity', val), isSameAddress || !formData.permProv)}
                            {renderDropdownInput("Barangay", formData.permBrgy, availablePermBarangays, "brgy_name", "brgy_code", (val) => handleAddressChange('permanent', 'permBrgy', val), isSameAddress || !formData.permCity)}
                        </View>
                        <View style={styles.row}>
                            <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Street</Text><TextInput style={styles.inputBox} maxLength={100} value={formData.permStreet} onChangeText={(v) => handleChange('permStreet', v)} editable={!isSameAddress}/></View>
                            <View style={{flex: 1}}><Text style={styles.label}>House No.</Text><TextInput style={styles.inputBox} maxLength={50} value={formData.permHouse} onChangeText={(v) => handleChange('permHouse', v)} editable={!isSameAddress}/></View>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={[styles.registerBtn, !isFormValid && styles.registerBtnDisabled]} onPress={() => setModalVisible(true)} disabled={!isFormValid}>
                    <Text style={[styles.registerBtnText, !isFormValid && {color: '#999'}]}>{isFormValid ? "REGISTER PATIENT" : "FILL VALID & REQUIRED FIELDS"}</Text>
                </TouchableOpacity>
                <View style={{height: 30}}></View>
            </ScrollView>

            {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker value={dateObj} mode="date" display="default" maximumDate={new Date()} onChange={handleDateChange} />
            )}

            <Modal visible={showDatePicker && Platform.OS === 'ios'} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select Birthdate</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Text style={{fontSize: 16, color: '#01538b', fontWeight: 'bold'}}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{backgroundColor: 'white', alignItems: 'center', paddingBottom: 20}}>
                            <DateTimePicker value={dateObj} mode="date" display="inline" maximumDate={new Date()} onChange={handleDateChange} themeVariant="light"/>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={dropdown.visible} transparent={true} animationType="slide" onRequestClose={() => setDropdown({...dropdown, visible: false})}>
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select {dropdown.title}</Text>
                            <TouchableOpacity onPress={() => setDropdown({...dropdown, visible: false})}>
                                <Text style={{fontSize: 20, color: '#888', fontWeight: 'bold'}}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={dropdown.items}
                            keyExtractor={(item, index) => `${item[dropdown.valueKey]}-${index}`} 
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.dropdownItem}
                                    onPress={() => { dropdown.onSelect(item[dropdown.valueKey]); setDropdown({...dropdown, visible: false}); }}
                                >
                                    <Text style={styles.dropdownItemText}>{item[dropdown.labelKey]}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{padding: 20, textAlign: 'center', color: '#888'}}>No options available.</Text>}
                        />
                    </View>
                </View>
            </Modal>

            <CustomModal 
                visible={modalVisible} title="Registration Success!" 
                message={`${formData.firstName} ${formData.lastName} has been successfully registered.`} type="success" 
                onClose={() => { setModalVisible(false); navigation.goBack(); }}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    formContainer: { padding: 20 },
    
    section: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    guardianSection: { backgroundColor: '#fff8e1', borderColor: '#ffe082', borderWidth: 1 },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 5, marginLeft: 5 },
    
    inputBox: { 
        backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, borderWidth: 1, 
        borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48
    },

    errorText: { color: '#d9534f', fontSize: 11, marginLeft: 5, marginBottom: 10 },

    checkboxGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    checkboxBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9', marginBottom: 5 },
    checkboxBtnActive: { backgroundColor: '#01538b', borderColor: '#01538b' },
    checkboxText: { fontSize: 12, color: '#555' },
    checkboxTextActive: { color: 'white', fontWeight: 'bold' },

    registerBtn: { backgroundColor: '#01538b', padding: 18, borderRadius: 50, alignItems: 'center', marginTop: 10, elevation: 3 },
    registerBtnDisabled: { backgroundColor: '#e0e0e0', elevation: 0 }, 
    registerBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: 20 },
    bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    dropdownItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    dropdownItemText: { fontSize: 16, color: '#333' }
});