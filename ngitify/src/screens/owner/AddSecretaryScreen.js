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

const DUMMY_EMAILS = ['juan@gmail.com', 'jane.doe@gmail.com', 'test@gmail.com', 'johndoe@gmail.com', 'ana.reyes@yahoo.com', 'patient@gmail.com'];

export default function AddSecretaryScreen({ navigation }) {
    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '',
        birthdate: '', email: '', phone: '',
        currReg: '', currProv: '', currCity: '', currBrgy: '', currStreet: '', currHouse: '',
        permReg: '', permProv: '', permCity: '', permBrgy: '', permStreet: '', permHouse: '',
    });

    const [isSameAddress, setIsSameAddress] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    const maxDate18 = new Date();
    maxDate18.setFullYear(maxDate18.getFullYear() - 18);
    const [dateObj, setDateObj] = useState(maxDate18);

    const [dropdown, setDropdown] = useState({ visible: false, title: '', items: [], labelKey: '', valueKey: '', onSelect: null });
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const availableCurrProvinces = provincesData.filter(p => p.region_code === formData.currReg);
    const availableCurrCities = citiesData.filter(c => c.province_code === formData.currProv);
    const availableCurrBarangays = barangaysData.filter(b => b.city_code === formData.currCity);
    const availablePermProvinces = provincesData.filter(p => p.region_code === formData.permReg);
    const availablePermCities = citiesData.filter(c => c.province_code === formData.permProv);
    const availablePermBarangays = barangaysData.filter(b => b.city_code === formData.permCity);

    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());

    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) return false;
        const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
        return allowedDomains.includes(email.split('@')[1]?.toLowerCase());
    };

    const isFormValid = 
        formData.firstName.trim() !== '' && formData.lastName.trim() !== '' &&
        formData.birthdate !== '' && formData.phone.length === 11 && formData.phone.startsWith('09') &&
        validateEmail(formData.email) && !DUMMY_EMAILS.includes(formData.email.toLowerCase()) &&
        formData.currReg !== '' && formData.currProv !== '' && formData.currCity !== '' && formData.currBrgy !== '' &&
        (isSameAddress || (formData.permReg !== '' && formData.permProv !== '' && formData.permCity !== '' && formData.permBrgy !== ''));

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleNameChange = (field, value) => handleChange(field, toTitleCase(value.replace(/[^a-zA-Z\s.-]/g, '')));

    const handlePhoneChange = (value) => {
        const sanitized = value.replace(/[^0-9]/g, '');
        handleChange('phone', sanitized);
        if (sanitized.length > 0 && !sanitized.startsWith('09')) setPhoneError('Must start with 09');
        else if (sanitized.length > 0 && sanitized.length < 11) setPhoneError('Must be 11 digits');
        else setPhoneError('');
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

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) {
            setDateObj(selectedDate);
            handleChange('birthdate', selectedDate.toISOString().split('T')[0]);
        }
    };

    const handleSameAddressToggle = (value) => {
        setIsSameAddress(value);
        if (value) setFormData(prev => ({ ...prev, permReg: prev.currReg, permProv: prev.currProv, permCity: prev.currCity, permBrgy: prev.currBrgy, permStreet: prev.currStreet, permHouse: prev.currHouse }));
        else setFormData(prev => ({ ...prev, permReg: '', permProv: '', permCity: '', permBrgy: '', permStreet: '', permHouse: '' }));
    };

    const openDropdown = (title, items, labelKey, valueKey, onSelect) => setDropdown({ visible: true, title, items, labelKey, valueKey, onSelect });

    const renderDropdownInput = (label, selectedValue, items, labelKey, valueKey, onSelect, disabled = false) => {
        const selectedItem = items.find(i => i[valueKey] === selectedValue);
        return (
            <View style={{flex: 1, marginHorizontal: 5, marginBottom: 15}}>
                <Text style={styles.label}>{label} *</Text>
                <TouchableOpacity style={[styles.inputBox, disabled && {backgroundColor: '#e0e0e0'}]} onPress={() => !disabled && openDropdown(label, items, labelKey, valueKey, onSelect)} activeOpacity={0.7}>
                    <Text style={{color: selectedValue ? '#333' : '#aaa', fontSize: 14}} numberOfLines={1}>{selectedItem ? selectedItem[labelKey] : `Select ${label}`}</Text>
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
                <Text style={styles.headerTitle}>Add New Secretary</Text>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal & Contact Details</Text>
                    <Text style={styles.label}>First Name *</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Ana" maxLength={50} value={formData.firstName} onChangeText={(v) => handleNameChange('firstName', v)} />
                    <Text style={styles.label}>Middle Name</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Marie" maxLength={30} value={formData.middleName} onChangeText={(v) => handleNameChange('middleName', v)} />
                    <Text style={styles.label}>Last Name *</Text>
                    <TextInput style={styles.inputBox} placeholder="e.g. Reyes" maxLength={50} value={formData.lastName} onChangeText={(v) => handleNameChange('lastName', v)} />
                    
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Birthdate (18+) *</Text>
                            <TouchableOpacity style={[styles.inputBox, {justifyContent: 'space-between'}]} onPress={() => setShowDatePicker(true)}>
                                <Text style={{ color: formData.birthdate ? '#333' : '#aaa' }}>{formData.birthdate || "YYYY-MM-DD"}</Text>
                                <Calendar width={15} height={15}/>
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Phone Number *</Text>
                            <TextInput style={[styles.inputBox, {marginBottom: 5}]} placeholder="09xxxxxxxxx" keyboardType="phone-pad" maxLength={11} value={formData.phone} onChangeText={handlePhoneChange} />
                            {phoneError !== '' && <Text style={styles.errorText}>{phoneError}</Text>}
                        </View>
                    </View>

                    <Text style={[styles.label, {marginTop: 10}]}>Email Address (Used for Login) *</Text>
                    <TextInput style={[styles.inputBox, {marginBottom: 5}]} placeholder="ana@gmail.com" keyboardType="email-address" autoCapitalize="none" maxLength={60} value={formData.email} onChangeText={handleEmailChange} />
                    {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}
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
                    <Text style={[styles.registerBtnText, !isFormValid && {color: '#999'}]}>{isFormValid ? "REGISTER SECRETARY" : "FILL VALID & REQUIRED FIELDS"}</Text>
                </TouchableOpacity>
                <View style={{height: 30}}></View>
            </ScrollView>

            {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker value={dateObj} mode="date" display="default" maximumDate={maxDate18} onChange={handleDateChange} />
            )}

            <Modal visible={showDatePicker && Platform.OS === 'ios'} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select Birthdate</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={{fontSize: 16, color: '#01538b', fontWeight: 'bold'}}>Done</Text></TouchableOpacity>
                        </View>
                        <View style={{backgroundColor: 'white', alignItems: 'center', paddingBottom: 20}}>
                            <DateTimePicker value={dateObj} mode="date" display="inline" maximumDate={maxDate18} onChange={handleDateChange} themeVariant="light"/>
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
                        <FlatList data={dropdown.items} keyExtractor={(item, index) => `${item[dropdown.valueKey]}-${index}`} 
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.dropdownItem} onPress={() => { dropdown.onSelect(item[dropdown.valueKey]); setDropdown({...dropdown, visible: false}); }}>
                                    <Text style={styles.dropdownItemText}>{item[dropdown.labelKey]}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{padding: 20, textAlign: 'center', color: '#888'}}>No options available.</Text>}
                        />
                    </View>
                </View>
            </Modal>

            <CustomModal visible={modalVisible} title="Success!" message={`Secretary ${formData.firstName} ${formData.lastName} has been registered.`} type="success" onClose={() => { setModalVisible(false); navigation.goBack(); }} />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', elevation: 3, zIndex: 10 },
    backBtn: { marginRight: 15 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    formContainer: { padding: 20 },
    section: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 5, marginLeft: 5 },
    inputBox: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
    errorText: { color: '#d9534f', fontSize: 11, marginLeft: 5, marginBottom: 10 },
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