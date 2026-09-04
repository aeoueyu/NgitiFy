import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { showAppModal } from '../../components/AppModalProvider';

import regionsData from '../../utils/json/region.json';
import provincesData from '../../utils/json/province.json';
import citiesData from '../../utils/json/city.json';
import barangaysData from '../../utils/json/barangay.json';

const COLORS = {
    primary: '#01538b',
    secondary: '#2dccf6',
    background: '#eef7fb',
    surface: '#ffffff',
    surfaceSoft: '#f6fbfe',
    text: '#17364a',
    textSoft: '#6d8597',
    border: '#d5e9f4',
    accentPink: '#ffe6ef',
    accentLavender: '#ece9ff',
    accentOrange: '#fff0df',
    accentGray: '#eef3f6',
    danger: '#d85b73',
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const calculateAge = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const birthDate = new Date(dateStr);
    if (Number.isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();
    if (
        today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
        age -= 1;
    }
    return age;
};

const resolveAddressName = (list, codeKey, nameKey, value) => {
    if (!value) return '';
    const byName = list.find((item) => item[nameKey]?.toLowerCase() === value.toLowerCase());
    if (byName) return byName[nameKey];
    const byCode = list.find((item) => item[codeKey] === value);
    return byCode ? byCode[nameKey] : value;
};

const formatAddress = (address) => {
    if (!address) return '-';

    const regionName = resolveAddressName(regionsData, 'region_code', 'region_name', address.region);
    const provinceName = resolveAddressName(provincesData, 'province_code', 'province_name', address.province);
    const cityName = resolveAddressName(citiesData, 'city_code', 'city_name', address.city);
    const barangayName = resolveAddressName(barangaysData, 'brgy_code', 'brgy_name', address.barangay);

    const parts = [
        address.houseNumber,
        address.street,
        barangayName,
        cityName,
        provinceName,
        regionName,
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : '-';
};

const getMergedHomeAddress = (profile) => ({
    ...(profile?.permanentAddress || {}),
    ...(profile?.currentAddress || {}),
    ...(profile?.homeAddress || {}),
});

function DetailRow({ label, value, last = false }) {
    return (
        <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || '-'}</Text>
        </View>
    );
}

function DetailSection({ title, children }) {
    return (
        <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>{title}</Text>
            <View style={styles.detailSectionBody}>{children}</View>
        </View>
    );
}

function ActionCard({ icon, iconColor, iconBg, title, subtitle, onPress }) {
    return (
        <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.82}>
            <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                </View>
                <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSoft} />
        </TouchableOpacity>
    );
}

function StatPill({ label, value }) {
    return (
        <View style={styles.statPill}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

export default function MyProfileScreen({ navigation }) {
    const { userToken, userId, userInfo, API_BASE_URL } = useContext(AuthContext);

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [detailsVisible, setDetailsVisible] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!userId || !userToken) return;

        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });

            if (!res.ok) {
                throw new Error('Failed to load profile.');
            }

            const data = await res.json();
            setProfile(data);
        } catch (err) {
            setError('Could not load profile. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [API_BASE_URL, userId, userToken]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setLoading(true);
            fetchProfile();
        });

        return unsubscribe;
    }, [fetchProfile, navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile();
    };

    const firstName = profile?.name?.first || userInfo?.firstName || '';
    const middleName = profile?.name?.middle || '';
    const lastName = profile?.name?.last || userInfo?.lastName || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Patient';
    const initials = ([firstName?.[0], lastName?.[0]].filter(Boolean).join('') || 'P').toUpperCase();
    const age = calculateAge(profile?.birthdate);
    const bloodType = profile?.bloodType || profile?.medicalHistory?.bloodType || '-';
    const contactNumber = profile?.contactNumber || '-';
    const email = profile?.email || userInfo?.email || '';

    const activityCount = useMemo(() => {
        const medical = profile?.medicalHistory || {};
        return [
            ...(medical.allergies || []),
            ...(medical.conditions || []),
            ...(medical.medications || []),
        ].filter(Boolean).length;
    }, [profile]);

    const detailSections = useMemo(() => {
        const homeAddress = formatAddress(getMergedHomeAddress(profile));

        return [
            {
                title: 'Personal Information',
                rows: [
                    ['Full Name', fullName],
                    ['Birthdate', formatDate(profile?.birthdate)],
                    ['Age', age !== null ? `${age} years old` : '-'],
                    ['Gender', profile?.gender || '-'],
                    ['Civil Status', profile?.civilStatus || '-'],
                    ['Occupation', profile?.occupation || '-'],
                ],
            },
            {
                title: 'Contact Details',
                rows: [
                    ['Email Address', email || '-'],
                    ['Phone Number', contactNumber],
                    ['Home Address', homeAddress],
                ],
            },
            {
                title: 'Health Snapshot',
                rows: [
                    ['Blood Type', bloodType],
                    ['Height', profile?.height ? `${profile.height} cm` : '-'],
                    ['Weight', profile?.weight ? `${profile.weight} kg` : '-'],
                ],
            },
            {
                title: 'Emergency Contact',
                rows: [
                    ['Contact Name', profile?.emergencyContact?.name || '-'],
                    ['Relationship', profile?.emergencyContact?.relationship || '-'],
                    ['Contact Number', profile?.emergencyContact?.contactNumber || '-'],
                ],
            },
            {
                title: 'Medical History',
                rows: [
                    ['Allergies', profile?.medicalHistory?.allergies?.join(', ') || '-'],
                    ['Conditions', profile?.medicalHistory?.conditions?.join(', ') || '-'],
                    ['Medications', profile?.medicalHistory?.medications?.join(', ') || '-'],
                ],
            },
        ];
    }, [age, bloodType, contactNumber, email, fullName, profile]);

    const handleInviteFriend = async () => {
        try {
            await Share.share({
                message: 'Check out NgitiFy Dentime for your dental appointments and records.',
            });
        } catch (err) {
            showAppModal('Unable to share', 'Please try again in a moment.');
        }
    };

    const actionCards = [
        {
            title: 'Edit profile',
            subtitle: 'Update your photo and personal information',
            icon: 'create-outline',
            iconColor: COLORS.danger,
            iconBg: COLORS.accentPink,
            onPress: () => navigation.navigate('EditProfile'),
        },
        {
            title: 'My details',
            subtitle: 'View your complete patient profile',
            icon: 'person-outline',
            iconColor: COLORS.primary,
            iconBg: COLORS.accentLavender,
            onPress: () => setDetailsVisible(true),
        },
        {
            title: 'My activity',
            subtitle: 'See recent account actions and updates',
            icon: 'stats-chart-outline',
            iconColor: '#6b63ff',
            iconBg: COLORS.accentLavender,
            onPress: () => navigation.navigate('ActivityLogs'),
        },
        {
            title: 'Settings',
            subtitle: 'Notifications, privacy, and password',
            icon: 'settings-outline',
            iconColor: '#ff8b2d',
            iconBg: COLORS.accentOrange,
            onPress: () => navigation.navigate('Settings'),
        },
        {
            title: 'Invite a friend',
            subtitle: 'Share the mobile app with someone',
            icon: 'person-add-outline',
            iconColor: COLORS.text,
            iconBg: COLORS.accentGray,
            onPress: handleInviteFriend,
        },
        {
            title: 'Help',
            subtitle: 'Open patient education and dental guidance',
            icon: 'help-circle-outline',
            iconColor: COLORS.text,
            iconBg: COLORS.accentGray,
            onPress: () => navigation.navigate('AiPatientCareCompanion'),
        },
    ];

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading your profile...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                )}
            >
                <View style={styles.topAccent} />

                {error ? (
                    <View style={styles.errorBanner}>
                        <Ionicons name="warning-outline" size={16} color="#b45309" />
                        <Text style={styles.errorBannerText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.profileHero}>
                    <View style={styles.avatarWrap}>
                        {profile?.profileImage ? (
                            <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.profileBadge}
                        onPress={() => navigation.navigate('MedicalRecords')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.profileBadgeText}>PATIENT</Text>
                    </TouchableOpacity>

                    <Text style={styles.nameText}>{fullName}</Text>
                    <Text style={styles.subText}>{email || 'No email available'}</Text>

                    <View style={styles.statsRow}>
                        <StatPill label="Age" value={age !== null ? `${age}` : '-'} />
                        <StatPill label="Blood Type" value={bloodType} />
                        <StatPill label="Health Notes" value={`${activityCount}`} />
                    </View>
                </View>

                <View style={styles.actionsSection}>
                    {actionCards.slice(0, 4).map((item) => (
                        <ActionCard key={item.title} {...item} />
                    ))}

                    <View style={styles.sectionDivider} />

                    {actionCards.slice(4).map((item) => (
                        <ActionCard key={item.title} {...item} />
                    ))}
                </View>

                <View style={styles.quickInfoCard}>
                    <Text style={styles.quickInfoTitle}>Quick info</Text>
                    <Text style={styles.quickInfoText}>Phone: {contactNumber}</Text>
                    <Text style={styles.quickInfoText}>
                        Address: {formatAddress(getMergedHomeAddress(profile))}
                    </Text>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
            <Modal
                visible={detailsVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDetailsVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>My Details</Text>
                            <TouchableOpacity onPress={() => setDetailsVisible(false)} activeOpacity={0.75}>
                                <Ionicons name="close" size={22} color={COLORS.textSoft} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {detailSections.map((section) => (
                                <DetailSection key={section.title} title={section.title}>
                                    {section.rows.map(([label, value], index) => (
                                        <DetailRow
                                            key={`${section.title}-${label}`}
                                            label={label}
                                            value={value}
                                            last={index === section.rows.length - 1}
                                        />
                                    ))}
                                </DetailSection>
                            ))}

                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => {
                                    setDetailsVisible(false);
                                    navigation.navigate('EditProfile');
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.modalButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.textSoft,
        fontSize: 14,
    },
    content: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 0,
    },
    topAccent: {
        alignSelf: 'center',
        width: 132,
        height: 18,
        borderRadius: 999,
        backgroundColor: '#ffffff',
        marginBottom: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff4db',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
    },
    errorBannerText: {
        flex: 1,
        color: '#8a5a14',
        fontSize: 13,
        lineHeight: 18,
    },
    profileHero: {
        alignItems: 'center',
        marginBottom: 22,
    },
    avatarWrap: {
        width: 118,
        height: 118,
        borderRadius: 59,
        padding: 4,
        backgroundColor: '#ffffff',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 6,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
    },
    avatarFallback: {
        flex: 1,
        borderRadius: 55,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 34,
        fontWeight: '700',
    },
    profileBadge: {
        marginTop: -10,
        backgroundColor: '#1fbbe0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    profileBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    nameText: {
        marginTop: 12,
        color: COLORS.text,
        fontSize: 31,
        fontWeight: '700',
        textAlign: 'center',
    },
    subText: {
        marginTop: 6,
        color: COLORS.textSoft,
        fontSize: 15,
        textAlign: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20,
        marginHorizontal: -5,
    },
    statPill: {
        flex: 1,
        backgroundColor: COLORS.surfaceSoft,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginHorizontal: 5,
    },
    statValue: {
        color: COLORS.primary,
        fontSize: 18,
        fontWeight: '700',
    },
    statLabel: {
        marginTop: 4,
        color: COLORS.textSoft,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    actionsSection: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#0b3a54',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 5,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    actionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    actionTextWrap: {
        flex: 1,
    },
    actionTitle: {
        color: '#1f2d3a',
        fontSize: 16,
        fontWeight: '600',
    },
    actionSubtitle: {
        marginTop: 3,
        color: COLORS.textSoft,
        fontSize: 12,
        lineHeight: 17,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#e7eef3',
        marginVertical: 4,
    },
    quickInfoCard: {
        marginTop: 18,
        backgroundColor: '#dff5fc',
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#b8e9f6',
    },
    quickInfoTitle: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    quickInfoText: {
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 4,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(8, 29, 43, 0.28)',
    },
    modalSheet: {
        maxHeight: '86%',
        backgroundColor: '#f7fbfd',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 26,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    modalTitle: {
        color: COLORS.primary,
        fontSize: 21,
        fontWeight: '700',
    },
    detailSection: {
        marginBottom: 16,
    },
    detailSectionTitle: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    detailSectionBody: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    detailRow: {
        paddingVertical: 14,
    },
    detailRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#e9f1f5',
    },
    detailLabel: {
        color: COLORS.textSoft,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 5,
    },
    detailValue: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    modalButton: {
        marginTop: 6,
        backgroundColor: COLORS.primary,
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
    },
    modalButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
});
