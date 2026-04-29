import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList,
    ActivityIndicator, StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../../context/AuthContext';
import CustomModal from '../../components/CustomModal';
import BackIcon from '../../assets/icons/Back.svg';
import Calendar from '../../assets/images/calendar.svg';

// Address JSON data
import regionsData   from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData    from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

// ─── Helpers: resolve codes ↔ names ──────────────────────────────────────────
// The DB stores display names (e.g. "National Capital Region").
// The dropdowns filter by codes (e.g. "13").
// These helpers translate between the two.

const codeFromName = (list, nameKey, codeKey, name) => {
    if (!name) return '';
    const found = list.find(i => i[nameKey]?.toLowerCase() === name?.toLowerCase());
    return found ? found[codeKey] : '';
};

const nameFromCode = (list, codeKey, nameKey, code) => {
    if (!code) return '';
    const found = list.find(i => i[codeKey] === code);
    return found ? found[nameKey] : '';
};

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);

    // ── Remote data state ──
    const [fetching,    setFetching]    = useState(true);
    const [fetchError,  setFetchError]  = useState(null);
    const [saving,      setSaving]      = useState(false);
    const [successModal,setSuccessModal]= useState(false);
    const [saveError,   setSaveError]   = useState('');

    // ── Edit mode ──
    const [isEditing, setIsEditing] = useState(false);

    // ── Form state (codes for dropdown filtering) ──
    const [formData, setFormData] = useState({
        firstName:  '',
        middleName: '',
        lastName:   '',
        birthdate:  '',
        gender:     '',
        phone:      '',
        // Address codes (for filtering JSON data)
        reg:    '',
        prov:   '',
        city:   '',
        brgy:   '',
        street: '',
        house:  '',
    });

    // Keep a copy of the last-saved data for cancel
    const [savedData, setSavedData] = useState(null);

    const [dateObj,      setDateObj]      = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dropdown,     setDropdown]     = useState({
        visible: false, title: '', items: [], labelKey: '', valueKey: '', onSelect: null,
    });

    const authHeader = { Authorization: `Bearer ${userToken}` };

    // ─── Fetch profile on mount ───────────────────────────────────────────────
    const loadProfile = useCallback(async () => {
        if (!userId || !userToken) return;
        setFetchError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
                headers: authHeader,
            });
            if (!res.ok) throw new Error('Failed to load profile.');
            const data = await res.json();

            const addr = data.currentAddress || {};

            // Resolve stored names → codes for dropdown filtering
            const regCode  = codeFromName(regionsData,   'region_name',   'region_code',   addr.region);
            const provCode = codeFromName(provincesData, 'province_name', 'province_code', addr.province);
            const cityCode = codeFromName(citiesData,    'city_name',     'city_code',     addr.city);
            const brgyCode = codeFromName(barangaysData, 'brgy_name',     'brgy_code',     addr.barangay);

            const populated = {
                firstName:  data.name?.first  || '',
                middleName: data.name?.middle  || '',
                lastName:   data.name?.last   || '',
                birthdate:  data.birthdate ? new Date(data.birthdate).toISOString().split('T')[0] : '',
                gender:     data.gender        || '',
                phone:      data.contactNumber || '',
                reg:    regCode,
                prov:   provCode,
                city:   cityCode,
                brgy:   brgyCode,
                street: addr.street      || '',
                house:  addr.houseNumber || '',
            };

            setFormData(populated);
            setSavedData(populated);

            if (data.birthdate) {
                const bd = new Date(data.birthdate);
                if (!isNaN(bd.getTime())) setDateObj(bd);
            }
        } catch (err) {
            setFetchError('Could not load your profile. Pull down to retry.');
        } finally {
            setFetching(false);
        }
    }, [userId, userToken, API_BASE_URL]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ─── Filtered address lists ───────────────────────────────────────────────
    const availableProvinces = provincesData.filter(p => p.region_code   === formData.reg);
    const availableCities    = citiesData.filter(c    => c.province_code === formData.prov);
    const availableBarangays = barangaysData.filter(b => b.city_code     === formData.city);

    // ─── Field change handlers ────────────────────────────────────────────────
    const handleChange = (field, value) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    const handleAddressChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'reg')  { updated.prov = ''; updated.city = ''; updated.brgy = ''; }
            if (field === 'prov') { updated.city = '';  updated.brgy = ''; }
            if (field === 'city') { updated.brgy = ''; }
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

    // ─── Dropdown helper ──────────────────────────────────────────────────────
    const openDropdown = (title, items, labelKey, valueKey, onSelect) => {
        setDropdown({ visible: true, title, items, labelKey, valueKey, onSelect });
    };

    const renderDropdownInput = (label, selectedCode, items, labelKey, valueKey, onSelect, disabled = false) => {
        const selectedItem  = items.find(i => i[valueKey] === selectedCode);
        const displayLabel  = selectedItem
            ? selectedItem[labelKey]
            : (isEditing ? `Select ${label}` : '—');

        return (
            <View style={{ flex: 1, marginHorizontal: 5, marginBottom: 15 }}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity
                    style={[
                        styles.inputBox,
                        !isEditing && styles.inputReadOnly,
                        disabled && isEditing && { backgroundColor: '#e0e0e0' },
                    ]}
                    onPress={() => isEditing && !disabled && openDropdown(label, items, labelKey, valueKey, onSelect)}
                    activeOpacity={isEditing ? 0.7 : 1}
                >
                    <Text
                        style={{ color: selectedCode || !isEditing ? '#333' : '#aaa', fontSize: 14, fontWeight: !isEditing ? 'bold' : 'normal' }}
                        numberOfLines={1}
                    >
                        {displayLabel}
                    </Text>
                    {isEditing && <Text style={{ color: '#888', fontSize: 12 }}>▼</Text>}
                </TouchableOpacity>
            </View>
        );
    };

    // ─── Cancel edit ─────────────────────────────────────────────────────────
    const handleCancel = () => {
        if (savedData) setFormData(savedData);
        setIsEditing(false);
        setSaveError('');
    };

    // ─── Save changes ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaveError('');

        // Basic validation
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            setSaveError('First name and last name are required.');
            return;
        }
        if (formData.phone && !/^[0-9+\s\-]{7,15}$/.test(formData.phone)) {
            setSaveError('Please enter a valid phone number.');
            return;
        }

        // Resolve codes → names for storage
        const regionName   = nameFromCode(regionsData,   'region_code',   'region_name',   formData.reg);
        const provinceName = nameFromCode(provincesData, 'province_code', 'province_name', formData.prov);
        const cityName     = nameFromCode(citiesData,    'city_code',     'city_name',     formData.city);
        const barangayName = nameFromCode(barangaysData, 'brgy_code',     'brgy_name',     formData.brgy);

        const payload = {
            name: {
                first:  formData.firstName.trim(),
                middle: formData.middleName.trim(),
                last:   formData.lastName.trim(),
            },
            contactNumber: formData.phone.trim(),
            birthdate:     formData.birthdate || undefined,
            gender:        formData.gender    || undefined,
            currentAddress: {
                country:     'Philippines',
                region:      regionName,
                province:    provinceName,
                city:        cityName,
                barangay:    barangayName,
                street:      formData.street.trim(),
                houseNumber: formData.house.trim(),
            },
        };

        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/update-profile/${userId}`, {
                method:  'PUT',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                setSaveError(data.message || 'Failed to save changes.');
                return;
            }

            // Update saved snapshot so Cancel won't revert to old data
            setSavedData({ ...formData });
            setIsEditing(false);
            setSuccessModal(true);
        } catch {
            setSaveError('Unable to connect. Please check your internet connection.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Gender selector ──────────────────────────────────────────────────────
    const GENDERS = ['Male', 'Female', 'Other'];

    const renderGenderSelector = () => {
        if (!isEditing) {
            return (
                <View>
                    <Text style={styles.label}>Gender</Text>
                    <View style={[styles.inputBox, styles.inputReadOnly]}>
                        <Text style={{ color: '#333', fontSize: 14, fontWeight: 'bold' }}>
                            {formData.gender || '—'}
                        </Text>
                    </View>
                </View>
            );
        }
        return (
            <View>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                    {GENDERS.map(g => (
                        <TouchableOpacity
                            key={g}
                            style={[styles.genderBtn, formData.gender === g && styles.genderBtnActive]}
                            onPress={() => handleChange('gender', g)}
                        >
                            <Text style={[styles.genderBtnText, formData.gender === g && styles.genderBtnTextActive]}>
                                {g}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // ─── Loading / error states ───────────────────────────────────────────────
    if (fetching) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="white" />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                        <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 60 }} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.loadingText}>Loading your profile…</Text>
                </View>
            </View>
        );
    }

    const initials = `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase() || '?';

    // ─── Main render ──────────────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={isEditing ? handleCancel : () => { setSaveError(''); setIsEditing(true); }}
                >
                    <Text style={[styles.editBtnText, isEditing && { color: '#d32f2f' }]}>
                        {isEditing ? 'Cancel' : 'Edit'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.formContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Fetch error banner */}
                {fetchError && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>⚠️ {fetchError}</Text>
                        <TouchableOpacity onPress={loadProfile} style={styles.retryBtn}>
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                </View>

                {/* ── Personal Information ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                        value={formData.firstName}
                        onChangeText={v => handleChange('firstName', v)}
                        editable={isEditing}
                        placeholder="First name"
                        placeholderTextColor="#bbb"
                    />

                    <Text style={styles.label}>Middle Name</Text>
                    <TextInput
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                        value={formData.middleName}
                        onChangeText={v => handleChange('middleName', v)}
                        editable={isEditing}
                        placeholder="Middle name (optional)"
                        placeholderTextColor="#bbb"
                    />

                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                        value={formData.lastName}
                        onChangeText={v => handleChange('lastName', v)}
                        editable={isEditing}
                        placeholder="Last name"
                        placeholderTextColor="#bbb"
                    />

                    {renderGenderSelector()}

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Birthdate</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, { justifyContent: 'space-between' }, !isEditing && styles.inputReadOnly]}
                                onPress={() => isEditing && setShowDatePicker(true)}
                                activeOpacity={isEditing ? 0.7 : 1}
                            >
                                <Text style={[{ color: '#333', fontSize: 14 }, !isEditing && { fontWeight: 'bold' }]}>
                                    {formData.birthdate
                                        ? (isEditing ? formData.birthdate : formatDisplayDate(formData.birthdate))
                                        : (isEditing ? 'Select date' : '—')}
                                </Text>
                                {isEditing && <Calendar width={15} height={15} />}
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={[styles.inputBox, { marginBottom: 5 }, !isEditing && styles.inputReadOnly]}
                                keyboardType="phone-pad"
                                maxLength={15}
                                value={formData.phone}
                                onChangeText={v => handleChange('phone', v)}
                                editable={isEditing}
                                placeholder="09XXXXXXXXX"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                    </View>
                </View>

                {/* ── Full Address ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Full Address</Text>

                    <View style={{ flexDirection: 'row', marginLeft: -5, marginRight: -5 }}>
                        {renderDropdownInput('Region',   formData.reg,  regionsData,        'region_name',   'region_code',   val => handleAddressChange('reg', val))}
                        {renderDropdownInput('Province', formData.prov, availableProvinces, 'province_name', 'province_code', val => handleAddressChange('prov', val), !formData.reg)}
                    </View>

                    <View style={{ flexDirection: 'row', marginLeft: -5, marginRight: -5 }}>
                        {renderDropdownInput('City / Municipality', formData.city, availableCities,    'city_name', 'city_code', val => handleAddressChange('city', val), !formData.prov)}
                        {renderDropdownInput('Barangay',            formData.brgy, availableBarangays, 'brgy_name', 'brgy_code', val => handleAddressChange('brgy', val), !formData.city)}
                    </View>

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Street</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.street}
                                onChangeText={v => handleChange('street', v)}
                                editable={isEditing}
                                placeholder="Street name"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>House / Blk / Lot</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.house}
                                onChangeText={v => handleChange('house', v)}
                                editable={isEditing}
                                placeholder="e.g. Blk 4 Lot 5"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                    </View>
                </View>

                {/* Save error */}
                {saveError ? (
                    <View style={styles.saveErrorBox}>
                        <Text style={styles.saveErrorText}>⚠️ {saveError}</Text>
                    </View>
                ) : null}

                {/* Save button */}
                {isEditing && (
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.8}
                    >
                        {saving
                            ? <ActivityIndicator color="white" />
                            : <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
                        }
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Date Picker (Android) ── */}
            {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={handleDateChange}
                />
            )}

            {/* ── Date Picker (iOS bottom sheet) ── */}
            <Modal
                visible={showDatePicker && Platform.OS === 'ios'}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select Birthdate</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Text style={{ fontSize: 16, color: '#01538b', fontWeight: 'bold' }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ backgroundColor: 'white', alignItems: 'center', paddingBottom: 20 }}>
                            <DateTimePicker
                                value={dateObj}
                                mode="date"
                                display="inline"
                                maximumDate={new Date()}
                                onChange={handleDateChange}
                                themeVariant="light"
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Dropdown bottom sheet ── */}
            <Modal
                visible={dropdown.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setDropdown(d => ({ ...d, visible: false }))}
            >
                <View style={styles.bottomSheetOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Select {dropdown.title}</Text>
                            <TouchableOpacity onPress={() => setDropdown(d => ({ ...d, visible: false }))}>
                                <Text style={{ fontSize: 20, color: '#888', fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={dropdown.items}
                            keyExtractor={(item, idx) => `${item[dropdown.valueKey]}-${idx}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        dropdown.onSelect(item[dropdown.valueKey]);
                                        setDropdown(d => ({ ...d, visible: false }));
                                    }}
                                >
                                    <Text style={styles.dropdownItemText}>{item[dropdown.labelKey]}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                                    No options available.
                                </Text>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* ── Success modal ── */}
            <CustomModal
                visible={successModal}
                title="Profile Updated"
                message="Your profile information has been successfully saved."
                type="success"
                onClose={() => setSuccessModal(false)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: '#f3f7f9' },
    centered:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:  { marginTop: 12, color: '#888', fontSize: 14 },

    header: {
        backgroundColor: 'white', padding: 20, paddingTop: 50,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    editBtn:     { width: 60, alignItems: 'flex-end', padding: 5 },
    editBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },

    formContainer: { padding: 20 },

    // Error / retry
    errorBanner: {
        backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffe0b2',
        borderRadius: 10, padding: 12, marginBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    errorBannerText: { color: '#e65100', fontSize: 13, flex: 1 },
    retryBtn:        { marginLeft: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#e65100', borderRadius: 8 },
    retryBtnText:    { color: 'white', fontWeight: 'bold', fontSize: 12 },

    // Avatar
    avatarContainer: { alignItems: 'center', marginBottom: 20 },
    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#01538b', justifyContent: 'center',
        alignItems: 'center', marginBottom: 10,
    },
    avatarText: { color: 'white', fontSize: 28, fontWeight: 'bold' },

    // Section
    section: {
        backgroundColor: 'white', padding: 20, borderRadius: 15,
        marginBottom: 15, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3,
    },
    sectionTitle: {
        fontSize: 16, fontWeight: 'bold', color: '#01538b',
        marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10,
    },

    row:   { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 5, marginLeft: 5 },

    inputBox: {
        backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10,
        borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48,
    },
    inputReadOnly: {
        backgroundColor: 'transparent', borderWidth: 0,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
        borderRadius: 0, paddingHorizontal: 5, color: '#222', fontWeight: 'bold',
    },

    // Gender selector
    genderRow: { flexDirection: 'row', marginBottom: 15, gap: 8 },
    genderBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center',
        backgroundColor: '#f9f9f9',
    },
    genderBtnActive:   { borderColor: '#01538b', backgroundColor: '#e3f2fd' },
    genderBtnText:     { fontSize: 13, color: '#888', fontWeight: '600' },
    genderBtnTextActive:{ color: '#01538b', fontWeight: 'bold' },

    // Save
    saveErrorBox: {
        backgroundColor: '#ffebee', borderRadius: 10, padding: 12, marginBottom: 12,
    },
    saveErrorText: { color: '#d32f2f', fontSize: 13 },

    saveBtn: {
        backgroundColor: '#01538b', padding: 18, borderRadius: 50,
        alignItems: 'center', marginTop: 10, elevation: 3,
    },
    saveBtnDisabled: { backgroundColor: '#b0bec5' },
    saveBtnText:     { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Bottom sheet
    bottomSheetOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetContainer: {
        backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '60%', paddingBottom: 20,
    },
    bottomSheetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#01538b' },
    dropdownItem:     { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    dropdownItemText: { fontSize: 16, color: '#333' },
});