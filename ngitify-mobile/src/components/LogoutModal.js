import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import WarningIcon from '../assets/images/warning.svg';

export default function LogoutModal({ visible, onCancel, onConfirm }) {
    return (
        <Modal
            transparent={true}
            animationType="fade"
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <WarningIcon width={60} height={60} style={styles.icon} />

                    <Text style={styles.modalTitle}>Confirm Logout</Text>
                    <Text style={styles.modalMessage}>Are you sure you want to log out of your account?</Text>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                            <Text style={styles.confirmButtonText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalCard: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center', 
        elevation: 10
    },
    icon: {
        marginBottom: 15
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#01538b',
        marginBottom: 10,
        textAlign: 'center'
    },
    modalMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 25, 
        lineHeight: 20 
    },
    buttonRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%' 
    },
    cancelButton: { 
        flex: 1, backgroundColor: '#f3f7f9', 
        paddingVertical: 12, 
        borderRadius: 50, 
        alignItems: 'center', 
        marginRight: 10 },
    cancelButtonText: { 
        color: '#555', 
        fontWeight: 'bold', 
        fontSize: 14 
    },
    confirmButton: { 
        flex: 1, 
        backgroundColor: '#c62828', 
        paddingVertical: 12, 
        borderRadius: 50, 
        alignItems: 'center', 
        marginLeft: 10 },
    confirmButtonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 14 
    }
});