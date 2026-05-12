import React, { useEffect, useRef, useState, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Animated, Image, Dimensions, ActivityIndicator
} from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';
import { logActivity } from '../../utils/logActivity';
import { AuthContext } from '../../context/AuthContext';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

const { width } = Dimensions.get('window');

export default function PatientXRayView({ navigation, route }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    // Radiograph object passed from MedicalRecordsScreen (Radiographs tab)
    const radiograph = route?.params?.radiograph || null;
    const displayRadiographUrl = radiograph?.enhancedUrl || radiograph?.url || '';

    const dateStr = radiograph?.date
        ? new Date(radiograph.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    // Destructure userToken and API_BASE_URL from AuthContext if not already there:
    const { userToken, API_BASE_URL } = useContext(AuthContext);

    useEffect(() => {
        const label = route?.params?.radiograph?.label || 'Radiograph';
        logActivity('RADIOGRAPH_VIEWED', `Viewed X-Ray: ${label}`, userToken, API_BASE_URL);
    }, []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>X-Ray Viewer</Text>
                <View style={{ width: 60 }} />
            </View>

            <Animated.ScrollView
                contentContainerStyle={styles.content}
                style={{ opacity: fadeAnim }}
                showsVerticalScrollIndicator={false}
            >
                {/* X-Ray Label & Date */}
                <Text style={styles.xrayLabel}>{radiograph?.label || 'Radiograph'}</Text>
                {dateStr ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                        <Ionicons name="calendar-outline" size={13} color="#888" style={{ marginRight: 4 }} />
                        <Text style={[styles.xrayDate, { marginBottom: 0 }]}>Taken on: {dateStr}</Text>
                    </View>
                ) : null}
                {radiograph?.radiographNumber ? (
                    <Text style={[styles.xrayDate, { marginBottom: 18 }]}>Radiograph No.: {radiograph.radiographNumber}</Text>
                ) : null}

                {/* Image Viewer Card */}
                <View style={styles.viewerCard}>
                    {displayRadiographUrl ? (
                        <View style={styles.imageWrapper}>
                            {imageLoading && !imageError && (
                                <View style={styles.imageLoader}>
                                    <ActivityIndicator size="large" color="#01538b" />
                                    <Text style={styles.imageLoaderText}>Loading image…</Text>
                                </View>
                            )}
                            {!imageError ? (
                                <Image
                                    source={{ uri: displayRadiographUrl }}
                                    style={[styles.xrayImage, imageLoading && { opacity: 0 }]}
                                    resizeMode="contain"
                                    onLoad={() => setImageLoading(false)}
                                    onError={() => { setImageLoading(false); setImageError(true); }}
                                />
                            ) : (
                                <View style={styles.imageError}>
                                    <Ionicons name="warning-outline" size={36} color="#ef5350" style={{ marginBottom: 10 }} />
                                    <Text style={styles.imageErrorText}>Unable to load image.</Text>
                                    <Text style={styles.imageErrorSub}>Please contact the clinic for a copy.</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        // No URL yet — placeholder
                        <View style={styles.placeholderContainer}>
                            <MaterialCommunityIcons name="bone" size={50} color="#aaa" style={{ marginBottom: 14 }} />
                            <Text style={styles.placeholderTitle}>Image Not Yet Available</Text>
                            <Text style={styles.placeholderSub}>
                                Your dentist has not yet uploaded the digital image for this radiograph. 
                                Please ask the clinic for a copy during your next visit.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Radiograph findings and notes */}
                {radiograph?.findings ? (
                    <View style={styles.notesCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="medkit-outline" size={14} color="#01538b" style={{ marginRight: 6 }} />
                            <Text style={[styles.notesTitle, { marginBottom: 0 }]}>Findings / Impression</Text>
                        </View>
                        <Text style={styles.notesText}>{radiograph.findings}</Text>
                    </View>
                ) : null}

                {radiograph?.notes ? (
                    <View style={styles.notesCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="document-text-outline" size={14} color="#01538b" style={{ marginRight: 6 }} />
                        <Text style={[styles.notesTitle, { marginBottom: 0 }]}>Radiograph Notes</Text>
                    </View>
                        <Text style={styles.notesText}>{radiograph.notes}</Text>
                    </View>
                ) : null}

                {/* Disclaimer */}
                <View style={styles.disclaimer}>
                    <Text style={styles.disclaimerText}>
                        This radiograph is part of your Electronic Medical Record (EMR) and is for your personal reference only. 
                        Please consult your dentist for a professional interpretation.
                    </Text>
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    header: {
        backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, zIndex: 10
    },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },

    content: { padding: 20, paddingBottom: 48 },

    xrayLabel: { fontSize: 20, fontWeight: 'bold', color: '#01538b', marginBottom: 4 },
    xrayDate: { fontSize: 13, color: '#888', marginBottom: 18 },

    viewerCard: {
        backgroundColor: '#1a1a2e', borderRadius: 18, overflow: 'hidden',
        marginBottom: 18, elevation: 4, minHeight: 240
    },
    imageWrapper: { width: '100%', minHeight: width * 0.55, justifyContent: 'center' },
    xrayImage: { width: '100%', height: width * 0.55 },
    imageLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    imageLoaderText: { color: '#aaa', marginTop: 10, fontSize: 13 },

    imageError: { padding: 40, alignItems: 'center' },
    imageErrorText: { color: '#ef5350', fontWeight: 'bold', fontSize: 15, marginBottom: 5 },
    imageErrorSub: { color: '#888', fontSize: 13, textAlign: 'center' },

    placeholderContainer: { padding: 40, alignItems: 'center' },
    placeholderTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'center' },
    placeholderSub: { color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 19 },

    notesCard: {
        backgroundColor: 'white', padding: 18, borderRadius: 15,
        marginBottom: 15, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#01538b'
    },
    notesTitle: { fontWeight: 'bold', color: '#01538b', fontSize: 14, marginBottom: 8 },
    notesText: { fontSize: 14, color: '#555', lineHeight: 21 },

    disclaimer: { backgroundColor: '#e3f2fd', padding: 14, borderRadius: 12 },
    disclaimerText: { fontSize: 12, color: '#1565c0', lineHeight: 18, textAlign: 'center' },
});
