// src/screens/shared/EditProfileScreen.js
import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomModal from '../../components/CustomModal';

// Icons
import BackIcon from '../../assets/icons/Back.svg';
import Calendar from '../../assets/images/calendar.svg';

// Address JSONs
import regionsData from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

export default function EditProfileScreen({ navigation }) {
    const [isEditing, setIsEditing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Default/Dummy Info ng Naka-login na User
    const [formData, setFormData] = useState({
        firstName: 'Juan', 
        middleName: 'Reyes', 
        lastName: 'Dela Cruz',
        birthdate: '1990-05-15', 
        email: 'juandelacruz@email.com', 
        phone: '09123456789',
        reg: '13', // NCR
        prov: '1374', // Metro Manila (Example)
        city: '137404', // Quezon City (Example)
        brgy: '137404001', // Example Brgy
        street: '123 Sampaguita St.', 
        house: 'Block 4 Lot 5'
    });

    const [dateObj, setDateObj] = useState(new Date('1990-05-15'));
    const [dropdown, setDropdown] = useState({ visible: false, title: '', items: [], labelKey: '', valueKey: '', onSelect: null });

    // Address Filters
    const availableProvinces = provincesData.filter(p => p.region_code === formData.reg);
    const availableCities = citiesData.filter(c => c.province_code === formData.prov);
    const availableBarangays = barangaysData.filter(b => b.city_code === formData.city);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) {
            setDateObj(selectedDate);
            const formattedDate = selectedDate.toISOString().split('T')[0];
            handleChange('birthdate', formattedDate);
        }
    };

    const handleAddressChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'reg') { updated.prov = ''; updated.city = ''; updated.brgy = ''; }
            if (field === 'prov') { updated.city = ''; updated.brgy = ''; }
            if (field === 'city') { updated.brgy = ''; }
            return updated;
        });
    };

    const openDropdown = (title, items, labelKey, valueKey, onSelect) => {
        setDropdown({ visible: true, title, items, labelKey, valueKey, onSelect });
    };

    const renderDropdownInput = (label, selectedValue, items, labelKey, valueKey, onSelect, disabled = false) => {
        const selectedItem = items.find(i => i[valueKey] === selectedValue);
        const displayLabel = selectedItem ? selectedItem[labelKey] : (isEditing ? `Select ${label}` : 'N/A');

        return (
            <View style={{flex: 1, marginHorizontal: 5, marginBottom: 15}}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity 
                    style={[styles.inputBox, !isEditing && styles.inputReadOnly, disabled && isEditing && {backgroundColor: '#e0e0e0'}]} 
                    onPress={() => isEditing && !disabled && openDropdown(label, items, labelKey, valueKey, onSelect)}
                    activeOpacity={isEditing ? 0.7 : 1}
                >
                    <Text style={{color: selectedValue || !isEditing ? '#333' : '#aaa', fontSize: 14, fontWeight: !isEditing ? 'bold' : 'normal'}} numberOfLines={1}>
                        {displayLabel}
                    </Text>
                    {isEditing && <Text style={{color: '#888', fontSize: 12}}>▼</Text>}
                </TouchableOpacity>
            </View>
        );
    };

    const handleSave = () => {
        setIsEditing(false);
        setModalVisible(true);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
                    <Text style={[styles.editBtnText, isEditing && { color: '#d32f2f' }]}>
                        {isEditing ? 'Cancel' : 'Edit'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
                
                {/* Avatar Section */}
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{formData.firstName.charAt(0)}{formData.lastName.charAt(0)}</Text>
                    </View>
                    {isEditing && (
                        <TouchableOpacity>
                            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Personal Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    
                    <Text style={styles.label}>First Name</Text>
                    <TextInput 
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]} 
                        value={formData.firstName} 
                        onChangeText={(v) => handleChange('firstName', v)} 
                        editable={isEditing}
                    />
                    
                    <Text style={styles.label}>Middle Name</Text>
                    <TextInput 
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]} 
                        value={formData.middleName} 
                        onChangeText={(v) => handleChange('middleName', v)} 
                        editable={isEditing}
                    />
                    
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput 
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]} 
                        value={formData.lastName} 
                        onChangeText={(v) => handleChange('lastName', v)} 
                        editable={isEditing}
                    />
                    
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Birthdate</Text>
                            <TouchableOpacity 
                                style={[styles.inputBox, {justifyContent: 'space-between'}, !isEditing && styles.inputReadOnly]} 
                                onPress={() => isEditing && setShowDatePicker(true)}
                                activeOpacity={isEditing ? 0.7 : 1}
                            >
                                <Text style={[{ color: '#333' }, !isEditing && {fontWeight: 'bold'}]}>{formData.birthdate}</Text>
                                {isEditing && <Calendar width={15} height={15}/>}
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput 
                                style={[styles.inputBox, {marginBottom: 5}, !isEditing && styles.inputReadOnly]} 
                                keyboardType="phone-pad" 
                                maxLength={11} 
                                value={formData.phone} 
                                onChangeText={(v) => handleChange('phone', v)} 
                                editable={isEditing}
                            />
                        </View>
                    </View>

                    <Text style={[styles.label, {marginTop: 10}]}>Email Address</Text>
                    <TextInput 
                        style={[styles.inputBox, {marginBottom: 5}, !isEditing && styles.inputReadOnly]} 
                        keyboardType="email-address" 
                        autoCapitalize="none" 
                        value={formData.email} 
                        onChangeText={(v) => handleChange('email', v)} 
                        editable={isEditing}
                    />
                </View>

                {/* Full Address */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Full Address</Text>
                    
                    <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                        {renderDropdownInput("Region", formData.reg, regionsData, "region_name", "region_code", (val) => handleAddressChange('reg', val))}
                        {renderDropdownInput("Province", formData.prov, availableProvinces, "province_name", "province_code", (val) => handleAddressChange('prov', val), !formData.reg)}
                    </View>
                    
                    <View style={{flexDirection: 'row', marginLeft: -5, marginRight: -5}}>
                        {renderDropdownInput("City", formData.city, availableCities, "city_name", "city_code", (val) => handleAddressChange('city', val), !formData.prov)}
                        {renderDropdownInput("Barangay", formData.brgy, availableBarangays, "brgy_name", "brgy_code", (val) => handleAddressChange('brgy', val), !formData.city)}
                    </View>
                    
                    <View style={styles.row}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Street</Text>
                            <TextInput 
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]} 
                                value={formData.street} 
                                onChangeText={(v) => handleChange('street', v)} 
                                editable={isEditing}
                            />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>House No.</Text>
                            <TextInput 
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]} 
                                value={formData.house} 
                                onChangeText={(v) => handleChange('house', v)} 
                                editable={isEditing}
                            />
                        </View>
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.registerBtn} onPress={handleSave}>
                        <Text style={styles.registerBtnText}>SAVE CHANGES</Text>
                    </TouchableOpacity>
                )}
                
                <View style={{height: 30}}></View>
            </ScrollView>

            {/* Date Picker Modal (Copied from AddPatient) */}
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

            {/* Dropdown Bottom Sheet Modal (Copied from AddPatient) */}
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

            {/* Success Modal */}
            <CustomModal 
                visible={modalVisible} 
                title="Profile Updated" 
                message="Your profile information has been successfully updated." 
                type="success" 
                onClose={() => setModalVisible(false)}
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
    
    editBtn: { width: 60, alignItems: 'flex-end', padding: 5 },
    editBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },

    formContainer: { padding: 20 },
    
    avatarContainer: { alignItems: 'center', marginBottom: 20 },
    avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#01538b', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    avatarText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
    changePhotoText: { color: '#01538b', fontWeight: 'bold', fontSize: 14 },

    section: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#01538b', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 5, marginLeft: 5 },
    
    // Ginamit natin yung eksaktong inputBox ng AddPatient
    inputBox: { 
        backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, borderWidth: 1, 
        borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48
    },
    // Stylings kapag View-Only Mode
    inputReadOnly: { 
        backgroundColor: 'transparent', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', 
        borderRadius: 0, paddingHorizontal: 5, color: '#222', fontWeight: 'bold'
    },

    registerBtn: { backgroundColor: '#01538b', padding: 18, borderRadius: 50, alignItems: 'center', marginTop: 10, elevation: 3 },
    registerBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: 20 },
    bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    dropdownItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    dropdownItemText: { fontSize: 16, color: '#333' }
});