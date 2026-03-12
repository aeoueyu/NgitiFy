import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Alert, Image } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';
import CalendarIcon from '../../assets/icons/Calendar.svg';
import FinancialReportsIcon from '../../assets/icons/FinancialReports.svg';

export default function AIPredictiveScreen({ route, navigation }) {
    const { patient } = route.params;
    const [step, setStep] = useState(1);
    const [selectedProcedure, setSelectedProcedure] = useState(null);
    const [isAgreed, setIsAgreed] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, [step]);

    const handleTransferToPatient = () => {
        Alert.alert("Transfer Successful", "The predictive outcome, quotation, and agreement have been sent to the patient's record.");
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Predictive Outcome</Text>
                <View style={{width: 60}} />
            </View>

            <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} contentContainerStyle={styles.content}>
                <Text style={styles.patientName}>Patient: {patient.firstName} {patient.lastName}</Text>

                {step === 1 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>1. Upload Current Photo</Text>
                        <TouchableOpacity style={styles.uploadBox} onPress={() => setStep(2)}>
                            <Text style={styles.uploadText}>Tap to Upload Photo</Text>
                            <Text style={styles.subText}>(e.g. Crooked Teeth / Pre-treatment)</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>2. Select Desired Procedure</Text>
                        {['Braces', 'Veneers', 'Invisalign', 'Teeth Whitening'].map(proc => (
                            <TouchableOpacity 
                                key={proc} 
                                style={[styles.optionCard, selectedProcedure === proc && styles.activeOption]}
                                onPress={() => setSelectedProcedure(proc)}
                            >
                                <Text style={[styles.optionText, selectedProcedure === proc && {color: 'white'}]}>{proc}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity 
                            style={[styles.nextBtn, !selectedProcedure && {opacity: 0.5}]} 
                            disabled={!selectedProcedure}
                            onPress={() => setStep(3)}
                        >
                            <Text style={styles.nextBtnText}>Generate Prediction</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 3 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>AI Predicted Outcome</Text>
                        
                        <View style={styles.comparisonRow}>
                            <View style={styles.imageCard}>
                                <Text style={styles.label}>Before</Text>
                                <Image 
                                    source={require('../../assets/ai-outcome/CurrentTeeth.jpg')} 
                                    style={styles.imageStyle} 
                                    resizeMode="cover"
                                />
                            </View>
                            <View style={styles.imageCard}>
                                <Text style={styles.label}>Predicted After</Text>
                                <Image 
                                    source={require('../../assets/ai-outcome/BracesOutcome.png')} 
                                    style={[styles.imageStyle, { borderColor: '#01538b', borderWidth: 2 }]} 
                                    resizeMode="cover"
                                />
                            </View>
                        </View>

                        <View style={styles.detailsCard}>
                            <View style={styles.infoRow}>
                                <CalendarIcon width={16} height={16} style={{color: '#01538b', marginRight: 10}} />
                                <View>
                                    <Text style={styles.infoLabel}>Estimated Completion Date</Text>
                                    <Text style={styles.infoValue}>January 2027</Text>
                                </View>
                            </View>
                            <View style={styles.infoRow}>
                                <FinancialReportsIcon width={16} height={16} style={{color: '#01538b', marginRight: 10}} />
                                <View>
                                    <Text style={styles.infoLabel}>Estimated Quotation</Text>
                                    <Text style={styles.infoValue}>₱ 65,000.00</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.agreementCard}>
                            <Text style={styles.agreementTitle}>Treatment Agreement</Text>
                            <Text style={styles.agreementText}>
                                I understand that the target date is dependent on my consistency with monthly adjustments. 
                                Failure to comply may result in a delayed outcome.
                            </Text>
                            <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsAgreed(!isAgreed)}>
                                <View style={[styles.checkbox, isAgreed && styles.checkboxActive]} />
                                <Text style={styles.checkboxLabel}>Patient has read and agreed</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[styles.transferBtn, !isAgreed && {backgroundColor: '#ccc'}]} 
                            disabled={!isAgreed}
                            onPress={handleTransferToPatient}
                        >
                            <Text style={styles.transferBtnText}>Transfer to Patient Record</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.ScrollView>
        </View>
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
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 5 
    },
    backText: { 
        color: '#01538b', 
        fontWeight: 'bold' 
    },
    headerTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#01538b' 
    },
    content: { 
        padding: 20 
    },
    patientName: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#555', 
        marginBottom: 20 
    },
    stepContainer: { 
        width: '100%' 
    },
    stepTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#01538b', 
        marginBottom: 15 
    },
    uploadBox: { 
        height: 200, 
        backgroundColor: 'white', 
        borderStyle: 'dashed', 
        borderWidth: 2, 
        borderColor: '#aaa', 
        borderRadius: 15, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    uploadText: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#01538b' 
    },
    subText: { 
        fontSize: 12, 
        color: '#888', 
        marginTop: 5 
    },
    optionCard: { 
        backgroundColor: 'white', 
        padding: 15, 
        borderRadius: 12, 
        marginBottom: 10, 
        elevation: 1 
    },
    activeOption: { 
        backgroundColor: '#01538b' 
    },
    optionText: { 
        fontWeight: 'bold', 
        color: '#333' 
    },
    nextBtn: { 
        backgroundColor: '#01538b', 
        padding: 15, 
        borderRadius: 50, 
        alignItems: 'center', 
        marginTop: 20 
    },
    nextBtnText: { 
        color: 'white', 
        fontWeight: 'bold' 
    },
    comparisonRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginBottom: 20 
    },
    imageCard: { 
        width: '48%' 
    },
    imageStyle: { 
        width: '100%', 
        height: 150, 
        borderRadius: 10, 
        backgroundColor: '#ddd' 
    }, 
    label: { 
        fontSize: 12, 
        fontWeight: 'bold', 
        color: '#888', 
        marginBottom: 5 
    },
    detailsCard: { 
        backgroundColor: 'white', 
        padding: 20, 
        borderRadius: 15, 
        marginBottom: 20, 
        elevation: 2 
    },
    infoRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 15 
    },
    infoLabel: { 
        fontSize: 12, 
        color: '#888' 
    },
    infoValue: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#333' 
    },
    agreementCard: { 
        backgroundColor: '#fff3e0', 
        padding: 20, 
        borderRadius: 15, 
        marginBottom: 20, 
        borderLeftWidth: 5, 
        borderLeftColor: '#ff9800' 
    },
    agreementTitle: { 
        fontWeight: 'bold', 
        color: '#e65100', 
        marginBottom: 10 
    },
    agreementText: { 
        fontSize: 13, 
        color: '#555', 
        lineHeight: 18 
    },
    checkboxRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginTop: 15 
    },
    checkbox: { 
        width: 20, 
        height: 20, 
        borderWidth: 2, 
        borderColor: '#01538b', 
        borderRadius: 5, 
        marginRight: 10 
    },
    checkboxActive: { 
        backgroundColor: '#01538b' 
    },
    checkboxLabel: { 
        fontSize: 14, 
        fontWeight: 'bold', 
        color: '#01538b' 
    },
    transferBtn: { 
        backgroundColor: '#01538b', 
        padding: 18, 
        borderRadius: 50, 
        alignItems: 'center' 
    },
    transferBtnText: { 
        color: 'white', 
        fontWeight: 'bold' 
    }
});