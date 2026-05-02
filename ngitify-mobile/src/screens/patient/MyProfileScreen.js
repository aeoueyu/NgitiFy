import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, RefreshControl, StatusBar, Image,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';

// Address JSON data (needed to resolve codes → names for display)
import regionsData   from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData    from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const calculateAge = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const bDate = new Date(dateStr);
    if (isNaN(bDate.getTime())) return null;
    let age = today.getFullYear() - bDate.getFullYear();
    if (
        today.getMonth() < bDate.getMonth() ||
        (today.getMonth() === bDate.getMonth() && today.getDate() < bDate.getDate())
    ) age--;
    return age;
};

// Resolves a stored value (which may be a code OR a name) to its display name.
const resolveAddressName = (list, codeKey, nameKey, value) => {
    if (!value) return '';
    // Check if already a readable name
    const byName = list.find(i => i[nameKey]?.toLowerCase() === value.toLowerCase());
    if (byName) return byName[nameKey];
    // Fallback: treat as code and resolve to name
    const byCode = list.find(i => i[codeKey] === value);
    return byCode ? byCode[nameKey] : value; // last resort: show raw value
};

const formatAddress = (address) => {
    if (!address) return '—';
    const regionName   = resolveAddressName(regionsData,   'region_code',   'region_name',   address.region);
    const provinceName = resolveAddressName(provincesData, 'province_code', 'province_name', address.province);
    const cityName     = resolveAddressName(citiesData,    'city_code',     'city_name',     address.city);
    const barangayName = resolveAddressName(barangaysData, 'brgy_code',     'brgy_name',     address.barangay);
    const parts = [
        address.houseNumber,
        address.street,
        barangayName,
        cityName,
        provinceName,
        regionName,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
};

function InfoRow({ label, value }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    );
}

function SectionCard({ title, children }) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            {children}
        </View>
    );
}

export default function MyProfileScreen({ navigation }) {
    const { userToken, userId, userInfo, API_BASE_URL } = useContext(AuthContext);

    const [profile,    setProfile]    = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error,      setError]      = useState(null);

    const fetchProfile = useCallback(async () => {
        if (!userId || !userToken) return;
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            if (!res.ok) throw new Error('Failed to load profile.');
            const data = await res.json();
            setProfile(data);
        } catch (err) {
            setError('Could not load profile. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, userToken, API_BASE_URL]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // Refresh when navigating back from EditProfile so changes show immediately
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setLoading(true);
            fetchProfile();
        });
        return unsubscribe;
    }, [navigation, fetchProfile]);

    const onRefresh = () => { setRefreshing(true); fetchProfile(); };

    // ─── Derived display values ───────────────────────────────────────────────
    const firstName  = profile?.name?.first  || userInfo?.firstName || '';
    const middleName = profile?.name?.middle  || '';
    const lastName   = profile?.name?.last   || userInfo?.lastName  || '';
    const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Patient';
    const initials   = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

    const age      = calculateAge(profile?.birthdate);
    const ageLabel = age !== null
        ? `${age} yrs old (${formatDate(profile.birthdate)})`
        : '—';

    // Check if permanent address is same as current
    const currAddr = profile?.currentAddress;
    const permAddr = profile?.permanentAddress;
    const isSameAddress =
        currAddr && permAddr &&
        currAddr.region      === permAddr.region      &&
        currAddr.province    === permAddr.province    &&
        currAddr.city        === permAddr.city        &&
        currAddr.barangay    === permAddr.barangay    &&
        currAddr.street      === permAddr.street      &&
        currAddr.houseNumber === permAddr.houseNumber &&
        !!currAddr.region;

    // ─── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="white" />
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                    >
                        <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Profile</Text>
                    <View style={{ width: 60 }} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#01538b" />
                    <Text style={styles.loadingText}>Loading your profile…</Text>
                </View>
            </View>
        );
    }

    // ─── Main render ──────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
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
                <Text style={styles.headerTitle}>My Profile</Text>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('EditProfile')}
                >
                    <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#01538b']}
                        tintColor="#01538b"
                    />
                }
            >
                {/* Error banner */}
                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                    </View>
                )}

                {/* Avatar + name card */}
                <View style={styles.profileCard}>
                    {profile?.profileImage ? (
                        <Image
                            source={{ uri: profile.profileImage }}
                            style={styles.avatarCircle}
                        />
                    ) : (
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    )}
                    <Text style={styles.patientName}>{fullName}</Text>
                    <Text style={styles.patientEmail}>{profile?.email || userInfo?.email || ''}</Text>
                    {profile?.gender && (
                        <View style={styles.genderBadge}>
                            <Text style={styles.genderBadgeText}>{profile.gender}</Text>
                        </View>
                    )}
                </View>

                {/* Personal Information */}
                <SectionCard title="👤  Personal Information">
                    <InfoRow label="Full Name"       value={fullName} />
                    <View style={styles.divider} />
                    <InfoRow label="Age & Birthdate" value={ageLabel} />
                    <View style={styles.divider} />
                    <InfoRow label="Gender"          value={profile?.gender} />
                    <View style={styles.divider} />
                    <InfoRow label="Occupation"      value={profile?.occupation} />
                    <View style={styles.divider} />
                    <InfoRow label="Civil Status"    value={profile?.civilStatus} />
                </SectionCard>

                {/* Contact Details */}
                <SectionCard title="📞  Contact Details">
                    <InfoRow label="Email Address"     value={profile?.email || userInfo?.email} />
                    <View style={styles.divider} />
                    <InfoRow label="Phone Number"      value={profile?.contactNumber} />
                    <View style={styles.divider} />
                    <InfoRow label="Current Address"   value={formatAddress(profile?.currentAddress)} />
                    <View style={styles.divider} />
                    {isSameAddress ? (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Permanent Address</Text>
                            <View style={styles.sameAddrBadge}>
                                <Text style={styles.sameAddrBadgeText}>✓ Same as Current Address</Text>
                            </View>
                        </View>
                    ) : (
                        <InfoRow label="Permanent Address" value={formatAddress(profile?.permanentAddress)} />
                    )}
                </SectionCard>

                {/* Physical Information */}
                {(profile?.height || profile?.weight || profile?.bloodType || profile?.medicalHistory?.bloodType) && (
                    <SectionCard title="💪  Physical Information">
                        <InfoRow label="Height"     value={profile?.height ? `${profile.height} cm` : null} />
                        {(profile?.height && profile?.weight) && <View style={styles.divider} />}
                        <InfoRow label="Weight"     value={profile?.weight ? `${profile.weight} kg` : null} />
                        {((profile?.height || profile?.weight) && (profile?.bloodType || profile?.medicalHistory?.bloodType)) && <View style={styles.divider} />}
                        <InfoRow label="Blood Type" value={profile?.bloodType || profile?.medicalHistory?.bloodType} />
                    </SectionCard>
                )}

                {(profile?.emergencyContact?.name || profile?.emergencyContact?.contactNumber) && (
                    <SectionCard title="Emergency Contact">
                        <InfoRow label="Contact Name" value={profile?.emergencyContact?.name} />
                        <View style={styles.divider} />
                        <InfoRow label="Relationship" value={profile?.emergencyContact?.relationship} />
                        <View style={styles.divider} />
                        <InfoRow label="Contact Number" value={profile?.emergencyContact?.contactNumber} />
                    </SectionCard>
                )}

                {/* Medical History */}
                {(profile?.medicalHistory?.allergies?.length > 0 ||
                  profile?.medicalHistory?.conditions?.length > 0 ||
                  profile?.medicalHistory?.medications?.length > 0) && (
                    <SectionCard title="🏥  Medical History">
                        {profile.medicalHistory.allergies?.length > 0 && (
                            <>
                                <InfoRow
                                    label="Allergies"
                                    value={profile.medicalHistory.allergies.join(', ')}
                                />
                                <View style={styles.divider} />
                            </>
                        )}
                        {profile.medicalHistory.conditions?.length > 0 && (
                            <>
                                <InfoRow
                                    label="Conditions"
                                    value={profile.medicalHistory.conditions.join(', ')}
                                />
                                <View style={styles.divider} />
                            </>
                        )}
                        {profile.medicalHistory.medications?.length > 0 && (
                            <>
                                <InfoRow
                                    label="Medications"
                                    value={profile.medicalHistory.medications.join(', ')}
                                />
                                <View style={styles.divider} />
                            </>
                        )}
                    </SectionCard>
                )}

                {/* Notice */}
                <View style={styles.noticeCard}>
                    <Text style={styles.noticeText}>
                        💡 To update personal information that cannot be edited here, please contact the clinic secretary during your next visit.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: '#f3f7f9' },
    centered:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:  { marginTop: 12, color: '#888', fontSize: 14 },

    // Header
    header: {
        backgroundColor: 'white', padding: 20, paddingTop: 50,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', elevation: 3, zIndex: 10,
    },
    backBtn:     { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText:    { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    editBtn:     { padding: 5, width: 60, alignItems: 'flex-end' },
    editBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 15 },

    content: { padding: 16 },

    // Error
    errorBanner: {
        backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffe0b2',
        borderRadius: 10, padding: 12, marginBottom: 12,
    },
    errorBannerText: { color: '#e65100', fontSize: 13 },

    // Profile avatar card
    profileCard: {
        backgroundColor: 'white', borderRadius: 16, padding: 24,
        alignItems: 'center', marginBottom: 16, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 3,
    },
    avatarCircle: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: '#01538b', alignItems: 'center',
        justifyContent: 'center', marginBottom: 14,
    },
    avatarText:   { color: 'white', fontSize: 30, fontWeight: 'bold' },
    patientName:  { fontSize: 22, fontWeight: 'bold', color: '#01538b', marginBottom: 4 },
    patientEmail: { fontSize: 14, color: '#888', marginBottom: 10 },
    genderBadge:  {
        backgroundColor: '#e3f2fd', paddingHorizontal: 14, paddingVertical: 4,
        borderRadius: 20, marginTop: 4,
    },
    genderBadgeText: { color: '#01538b', fontSize: 12, fontWeight: '600' },

    // Section card
    card: {
        backgroundColor: 'white', borderRadius: 15, paddingVertical: 6,
        paddingHorizontal: 18, marginBottom: 14, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3,
    },
    cardTitle: {
        fontSize: 12, fontWeight: '700', color: '#888',
        textTransform: 'uppercase', letterSpacing: 0.8,
        paddingTop: 14, paddingBottom: 10,
    },

    // Info rows
    infoRow:    { paddingVertical: 12 },
    infoLabel:  { fontSize: 12, color: '#aaa', fontWeight: '600', marginBottom: 3 },
    infoValue:  { fontSize: 14, color: '#333', fontWeight: '500', lineHeight: 20 },
    divider:    { height: 1, backgroundColor: '#f0f0f0' },

    // Same address badge
    sameAddrBadge: {
        backgroundColor: '#e3f2fd', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 4,
        alignSelf: 'flex-start', marginTop: 2,
    },
    sameAddrBadgeText: { color: '#01538b', fontSize: 12, fontWeight: '600' },

    // Notice
    noticeCard: {
        backgroundColor: '#e0f2f1', padding: 14, borderRadius: 12,
        borderWidth: 1, borderColor: '#b2dfdb', marginBottom: 4,
    },
    noticeText: { color: '#00897b', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
