import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList,
    ActivityIndicator, StatusBar, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../../context/AuthContext';
import CustomModal from '../../components/CustomModal';
import BackIcon from '../../assets/icons/Back.svg';
import Calendar from '../../assets/images/calendar.svg';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

// Address JSON data
import regionsData   from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData    from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

// ─── Helpers: resolve codes ↔ names ──────────────────────────────────────────

// Converts a name to its code (used when saving dropdowns).
const codeFromName = (list, nameKey, codeKey, name) => {
    if (!name) return '';
    const found = list.find(i => i[nameKey]?.toLowerCase() === name?.toLowerCase());
    return found ? found[codeKey] : '';
};

// Converts a code to its display name (used when saving to DB).
const nameFromCode = (list, codeKey, nameKey, code) => {
    if (!code) return '';
    const found = list.find(i => i[codeKey] === code);
    return found ? found[nameKey] : '';
};

// Resolves a stored DB value (code OR name) → the correct code for dropdown state.
// Fixes the case where the DB previously stored codes instead of names.
const resolveToCode = (list, nameKey, codeKey, value) => {
    if (!value) return '';
    // If value is already a valid code, return it directly
    if (list.find(i => i[codeKey] === value)) return value;
    // Otherwise try to match by name
    const byName = list.find(i => i[nameKey]?.toLowerCase() === value.toLowerCase());
    return byName ? byName[codeKey] : '';
};

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const csvFromArray = (value) => Array.isArray(value) ? value.join(', ') : (value || '');
const arrayFromCsv = (value) => value.split(',').map(item => item.trim()).filter(Boolean);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL, refreshUserInfo } = useContext(AuthContext);

    // ── Remote data state ──
    const [fetching,     setFetching]     = useState(true);
    const [fetchError,   setFetchError]   = useState(null);
    const [saving,       setSaving]       = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [saveError,    setSaveError]    = useState('');

    // ── Edit mode ──
    const [isEditing, setIsEditing] = useState(false);

    // ── Same-as-current-address checkbox ──
    const [isSameAddress, setIsSameAddress] = useState(false);

    // ── Form state ──
    const [formData, setFormData] = useState({
        firstName:  '',
        middleName: '',
        lastName:   '',
        birthdate:  '',
        gender:     '',
        phone:      '',
        occupation: '',
        civilStatus: '',
        bloodType: '',
        emergencyName: '',
        emergencyRelationship: '',
        emergencyPhone: '',
        allergies: '',
        conditions: '',
        medications: '',
        // Current address codes (for dropdown filtering)
        reg:    '',
        prov:   '',
        city:   '',
        brgy:   '',
        street: '',
        house:  '',
        // Permanent address codes
        permReg:    '',
        permProv:   '',
        permCity:   '',
        permBrgy:   '',
        permStreet: '',
        permHouse:  '',
    });

    // Keep a copy of the last-saved data for cancel
    const [savedData,    setSavedData]    = useState(null);
    const [savedSameAddr, setSavedSameAddr] = useState(false);

    const [profileImage,   setProfileImage]   = useState(null);
    const [dateObj,        setDateObj]        = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dropdown,       setDropdown]       = useState({
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

            const addr     = data.currentAddress || data.permanentAddress || {};
            const permAddr = data.permanentAddress || data.currentAddress || {};

            // Resolve stored values (code OR name) → codes for dropdown filtering
            const regCode      = resolveToCode(regionsData,   'region_name',   'region_code',   addr.region);
            const provCode     = resolveToCode(provincesData, 'province_name', 'province_code', addr.province);
            const cityCode     = resolveToCode(citiesData,    'city_name',     'city_code',     addr.city);
            const brgyCode = (() => {
                const val = addr.barangay;
                if (!val) return '';
                if (barangaysData.find(b => b.brgy_code === val)) return val;  // already a code
                // Scope to resolved city to avoid ambiguous name matches
                const inCity = barangaysData.find(b => b.brgy_name?.toLowerCase() === val.toLowerCase() && b.city_code === cityCode);
                if (inCity) return inCity.brgy_code;
                const anywhere = barangaysData.find(b => b.brgy_name?.toLowerCase() === val.toLowerCase());
                return anywhere ? anywhere.brgy_code : '';
            })();

            const permRegCode  = resolveToCode(regionsData,   'region_name',   'region_code',   permAddr.region);
            const permProvCode = resolveToCode(provincesData, 'province_name', 'province_code', permAddr.province);
            const permCityCode = resolveToCode(citiesData,    'city_name',     'city_code',     permAddr.city);
            const permBrgyCode = (() => {
                const val = permAddr.barangay;
                if (!val) return '';
                if (barangaysData.find(b => b.brgy_code === val)) return val;
                const inCity = barangaysData.find(b => b.brgy_name?.toLowerCase() === val.toLowerCase() && b.city_code === permCityCode);
                if (inCity) return inCity.brgy_code;
                const anywhere = barangaysData.find(b => b.brgy_name?.toLowerCase() === val.toLowerCase());
                return anywhere ? anywhere.brgy_code : '';
            })();

            // Detect if permanent === current (same address)
            const sameAddr =
                addr.region    === permAddr.region    &&
                addr.province  === permAddr.province  &&
                addr.city      === permAddr.city      &&
                addr.barangay  === permAddr.barangay  &&
                addr.street    === permAddr.street    &&
                addr.houseNumber === permAddr.houseNumber &&
                !!addr.region; // only flag same if there's actually data

            const populated = {
                firstName:  data.name?.first  || '',
                middleName: data.name?.middle  || '',
                lastName:   data.name?.last   || '',
                birthdate:  data.birthdate ? new Date(data.birthdate).toISOString().split('T')[0] : '',
                gender:     data.gender        || '',
                phone:      data.contactNumber || '',
                occupation: data.occupation || '',
                civilStatus: data.civilStatus || '',
                bloodType: data.bloodType || data.medicalHistory?.bloodType || '',
                emergencyName: data.emergencyContact?.name || '',
                emergencyRelationship: data.emergencyContact?.relationship || '',
                emergencyPhone: data.emergencyContact?.contactNumber || '',
                allergies: csvFromArray(data.medicalHistory?.allergies),
                conditions: csvFromArray(data.medicalHistory?.conditions),
                medications: csvFromArray(data.medicalHistory?.medications),
                reg:    regCode,
                prov:   provCode,
                city:   cityCode,
                brgy:   brgyCode,
                street: addr.street      || '',
                house:  addr.houseNumber || '',
                permReg:    permRegCode,
                permProv:   permProvCode,
                permCity:   permCityCode,
                permBrgy:   permBrgyCode,
                permStreet: permAddr.street      || '',
                permHouse:  permAddr.houseNumber || '',
            };

            setFormData(populated);
            setSavedData(populated);
            setIsSameAddress(true);
            setSavedSameAddr(true);

            if (data.birthdate) {
                const bd = new Date(data.birthdate);
                if (!isNaN(bd.getTime())) setDateObj(bd);
            }
            setProfileImage(data.profileImage || null);
        } catch (err) {
            setFetchError('Could not load your profile. Pull down to retry.');
        } finally {
            setFetching(false);
        }
    }, [userId, userToken, API_BASE_URL]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ─── Filtered address lists (current) ────────────────────────────────────
    const availableProvinces = provincesData.filter(p => p.region_code   === formData.reg);
    const availableCities    = citiesData.filter(c    => c.province_code === formData.prov);
    const availableBarangays = barangaysData.filter(b => b.city_code     === formData.city);

    // ─── Filtered address lists (permanent) ──────────────────────────────────
    const availablePermProvinces = provincesData.filter(p => p.region_code   === formData.permReg);
    const availablePermCities    = citiesData.filter(c    => c.province_code === formData.permProv);
    const availablePermBarangays = barangaysData.filter(b => b.city_code     === formData.permCity);

    // ─── Field change handlers ────────────────────────────────────────────────
    const handleChange = (field, value) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    const handleAddressChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'reg')  { updated.prov = ''; updated.city = ''; updated.brgy = ''; }
            if (field === 'prov') { updated.city = '';  updated.brgy = ''; }
            if (field === 'city') { updated.brgy = ''; }
            // If same address is checked, mirror to permanent
            if (isSameAddress) {
                const mirrorMap = {
                    reg: 'permReg', prov: 'permProv', city: 'permCity', brgy: 'permBrgy',
                    street: 'permStreet', house: 'permHouse',
                };
                if (mirrorMap[field]) {
                    updated[mirrorMap[field]] = updated[field];
                    // Also reset dependent perm fields
                    if (field === 'reg')  { updated.permProv = ''; updated.permCity = ''; updated.permBrgy = ''; }
                    if (field === 'prov') { updated.permCity = '';  updated.permBrgy = ''; }
                    if (field === 'city') { updated.permBrgy = ''; }
                }
            }
            return updated;
        });
    };

    const handlePermAddressChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'permReg')  { updated.permProv = ''; updated.permCity = ''; updated.permBrgy = ''; }
            if (field === 'permProv') { updated.permCity = '';  updated.permBrgy = ''; }
            if (field === 'permCity') { updated.permBrgy = ''; }
            return updated;
        });
    };

    const handleSameAddressToggle = () => {
        const next = !isSameAddress;
        setIsSameAddress(next);
        if (next) {
            // Copy current address to permanent
            setFormData(prev => ({
                ...prev,
                permReg:    prev.reg,
                permProv:   prev.prov,
                permCity:   prev.city,
                permBrgy:   prev.brgy,
                permStreet: prev.street,
                permHouse:  prev.house,
            }));
        }
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
        const selectedItem = items.find(i => i[valueKey] === selectedCode);
        const displayLabel = selectedItem
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

    // ─── Pick profile image ───────────────────────────────────────────────────
    const pickImage = async () => {
        if (!isEditing) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            // Backend limit is 1.5MB for the base64 string
            if (asset.base64 && asset.base64.length > 1.5 * 1024 * 1024) {
                Alert.alert('Image Too Large', 'Please choose a smaller image (under 1.5MB).');
                return;
            }
            setProfileImage(`data:image/jpeg;base64,${asset.base64}`);
        }
    };

    // ─── Cancel edit ─────────────────────────────────────────────────────────
    const handleCancel = () => {
        if (savedData) setFormData(savedData);
        setIsSameAddress(savedSameAddr);
        setIsEditing(false);
        setSaveError('');
    };

    // ─── Save changes ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaveError('');

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

        const currentAddressPayload = {
            country:     'Philippines',
            region:      regionName,
            province:    provinceName,
            city:        cityName,
            barangay:    barangayName,
            street:      formData.street.trim(),
            houseNumber: formData.house.trim(),
        };

        const permanentAddressPayload = { ...currentAddressPayload };

        const payload = {
            name: {
                first:  formData.firstName.trim(),
                middle: formData.middleName.trim(),
                last:   formData.lastName.trim(),
            },
            contactNumber:    formData.phone.trim(),
            birthdate:        formData.birthdate || undefined,
            gender:           formData.gender    || undefined,
            occupation:       formData.occupation.trim() || undefined,
            civilStatus:      formData.civilStatus || undefined,
            bloodType:        formData.bloodType || undefined,
            emergencyContact: {
                name: formData.emergencyName.trim() || undefined,
                relationship: formData.emergencyRelationship.trim() || undefined,
                contactNumber: formData.emergencyPhone.trim() || undefined,
            },
            medicalHistory: {
                bloodType: formData.bloodType || undefined,
                allergies: arrayFromCsv(formData.allergies),
                conditions: arrayFromCsv(formData.conditions),
                medications: arrayFromCsv(formData.medications),
            },
            currentAddress:   currentAddressPayload,
            permanentAddress: permanentAddressPayload,
            profileImage:     profileImage ?? undefined,
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

            setSavedData({ ...formData });
            setSavedSameAddr(isSameAddress);
            setIsEditing(false);
            setSuccessModal(true);
            refreshUserInfo(); // sync profileImage + name to global context
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
                        <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
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
                    <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
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
                    <TouchableOpacity onPress={pickImage} activeOpacity={isEditing ? 0.75 : 1}>
                        {profileImage ? (
                            <Image
                                source={{ uri: profileImage }}
                                style={[styles.avatarCircle, { backgroundColor: '#ccc' }]}
                            />
                        ) : (
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                        )}
                        {isEditing && (
                            <View style={styles.avatarEditOverlay}>
                                <Text style={styles.avatarEditText}>📷 Change</Text>
                            </View>
                        )}
                    </TouchableOpacity>
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

                {/* ── Current Address ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Emergency Contact</Text>
                    <Text style={styles.label}>Contact Name</Text>
                    <TextInput
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                        value={formData.emergencyName}
                        onChangeText={v => handleChange('emergencyName', v)}
                        editable={isEditing}
                        placeholder="Full name"
                        placeholderTextColor="#bbb"
                    />
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Relationship</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.emergencyRelationship}
                                onChangeText={v => handleChange('emergencyRelationship', v)}
                                editable={isEditing}
                                placeholder="Mother, spouse, sibling"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Contact Number</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.emergencyPhone}
                                onChangeText={v => handleChange('emergencyPhone', v)}
                                editable={isEditing}
                                keyboardType="phone-pad"
                                placeholder="+639XXXXXXXXX"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Occupation</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.occupation}
                                onChangeText={v => handleChange('occupation', v)}
                                editable={isEditing}
                                placeholder="Occupation"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Civil Status</Text>
                            <TextInput
                                style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                                value={formData.civilStatus}
                                onChangeText={v => handleChange('civilStatus', v)}
                                editable={isEditing}
                                placeholder="Single, Married, etc."
                                placeholderTextColor="#bbb"
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medical Information</Text>
                    <Text style={styles.label}>Blood Type</Text>
                    <TextInput
                        style={[styles.inputBox, !isEditing && styles.inputReadOnly]}
                        value={formData.bloodType}
                        onChangeText={v => handleChange('bloodType', v)}
                        editable={isEditing}
                        placeholder="A+, O-, etc."
                        placeholderTextColor="#bbb"
                    />
                    <Text style={styles.label}>Allergies</Text>
                    <TextInput
                        style={[styles.textArea, !isEditing && styles.inputReadOnly]}
                        value={formData.allergies}
                        onChangeText={v => handleChange('allergies', v)}
                        editable={isEditing}
                        placeholder="Comma-separated allergies"
                        placeholderTextColor="#bbb"
                        multiline
                    />
                    <Text style={styles.label}>Medical Conditions</Text>
                    <TextInput
                        style={[styles.textArea, !isEditing && styles.inputReadOnly]}
                        value={formData.conditions}
                        onChangeText={v => handleChange('conditions', v)}
                        editable={isEditing}
                        placeholder="Comma-separated conditions"
                        placeholderTextColor="#bbb"
                        multiline
                    />
                    <Text style={styles.label}>Current Medications</Text>
                    <TextInput
                        style={[styles.textArea, !isEditing && styles.inputReadOnly]}
                        value={formData.medications}
                        onChangeText={v => handleChange('medications', v)}
                        editable={isEditing}
                        placeholder="Comma-separated medications"
                        placeholderTextColor="#bbb"
                        multiline
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Home Address</Text>

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
                                onChangeText={v => handleAddressChange('street', v)}
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
                                onChangeText={v => handleAddressChange('house', v)}
                                editable={isEditing}
                                placeholder="e.g. Blk 4 Lot 5"
                                placeholderTextColor="#bbb"
                            />
                        </View>
                    </View>
                </View>

                {/* ── Permanent Address ── */}
                {false && (
                <View style={styles.section}>
                    <View style={styles.permHeaderRow}>
                        <Text style={styles.sectionTitle}>Permanent Address</Text>
                        {isEditing && (
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={handleSameAddressToggle}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, isSameAddress && styles.checkboxChecked]}>
                                    {isSameAddress && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <Text style={styles.checkboxLabel}>Same as Current</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSameAddress && !isEditing && (
                        <View style={styles.sameAddrBadge}>
                            <Text style={styles.sameAddrBadgeText}>✓ Same as Current Address</Text>
                        </View>
                    )}

                    <View style={[{ opacity: isSameAddress ? 0.45 : 1 }]}>
                        <View style={{ flexDirection: 'row', marginLeft: -5, marginRight: -5 }}>
                            {renderDropdownInput('Region',   formData.permReg,  regionsData,             'region_name',   'region_code',   val => handlePermAddressChange('permReg', val),  isSameAddress)}
                            {renderDropdownInput('Province', formData.permProv, availablePermProvinces,  'province_name', 'province_code', val => handlePermAddressChange('permProv', val), isSameAddress || !formData.permReg)}
                        </View>

                        <View style={{ flexDirection: 'row', marginLeft: -5, marginRight: -5 }}>
                            {renderDropdownInput('City / Municipality', formData.permCity, availablePermCities,    'city_name', 'city_code', val => handlePermAddressChange('permCity', val), isSameAddress || !formData.permProv)}
                            {renderDropdownInput('Barangay',            formData.permBrgy, availablePermBarangays, 'brgy_name', 'brgy_code', val => handlePermAddressChange('permBrgy', val), isSameAddress || !formData.permCity)}
                        </View>

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.label}>Street</Text>
                                <TextInput
                                    style={[styles.inputBox, (!isEditing || isSameAddress) && styles.inputReadOnly]}
                                    value={formData.permStreet}
                                    onChangeText={v => handlePermAddressChange('permStreet', v)}
                                    editable={isEditing && !isSameAddress}
                                    placeholder="Street name"
                                    placeholderTextColor="#bbb"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>House / Blk / Lot</Text>
                                <TextInput
                                    style={[styles.inputBox, (!isEditing || isSameAddress) && styles.inputReadOnly]}
                                    value={formData.permHouse}
                                    onChangeText={v => handlePermAddressChange('permHouse', v)}
                                    editable={isEditing && !isSameAddress}
                                    placeholder="e.g. Blk 4 Lot 5"
                                    placeholderTextColor="#bbb"
                                />
                            </View>
                        </View>
                    </View>
                </View>
                )}

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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: '#f3f7f9' },
    centered:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:  { marginTop: 12, color: '#888', fontSize: 14 },

    header: {
        backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    editBtn:     { width: 60, alignItems: 'flex-end', padding: 5 },
    editBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },

    formContainer: { padding: 20, paddingBottom: 48 },

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
    avatarEditOverlay: {
        position: 'absolute', bottom: 10, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.45)', borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40, paddingVertical: 4, alignItems: 'center',
    },
    avatarEditText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

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

    // Permanent address header row
    permHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 15,
        borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10,
    },

    // Checkbox
    checkboxRow:    { flexDirection: 'row', alignItems: 'center' },
    checkbox: {
        width: 20, height: 20, borderWidth: 2, borderColor: '#01538b',
        borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center',
    },
    checkboxChecked: { backgroundColor: '#01538b' },
    checkmark:       { color: 'white', fontSize: 12, fontWeight: 'bold' },
    checkboxLabel:   { fontSize: 13, color: '#555', fontWeight: '600' },

    // Same address badge (read-only view)
    sameAddrBadge: {
        backgroundColor: '#e3f2fd', borderRadius: 8, padding: 10,
        marginBottom: 12, alignItems: 'center',
    },
    sameAddrBadgeText: { color: '#01538b', fontSize: 13, fontWeight: '600' },

    row:   { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 5, marginLeft: 5 },

    inputBox: {
        backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10,
        borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48,
    },
    textArea: {
        backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10,
        borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 14, color: '#333',
        minHeight: 88, textAlignVertical: 'top',
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
    genderBtnActive:    { borderColor: '#01538b', backgroundColor: '#e3f2fd' },
    genderBtnText:      { fontSize: 13, color: '#888', fontWeight: '600' },
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
