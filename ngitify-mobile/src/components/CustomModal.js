import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CustomModal({
    visible,
    title,
    message,
    type,
    onClose,
    buttons,
    cancelable = true,
}) {
    const icon = type === 'success'
        ? { name: 'checkmark-circle-outline', color: '#2e7d32' }
        : type === 'warning'
            ? { name: 'warning-outline', color: '#f57f17' }
            : { name: 'alert-circle-outline', color: '#c62828' };

    return (
        <Modal
            transparent={true}
            animationType="fade"
            visible={visible}
            onRequestClose={() => {
                if (cancelable) onClose?.();
            }}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <Ionicons name={icon.name} size={60} color={icon.color} style={styles.icon} />

                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.modalMessage}>{message}</Text>

                    <View style={styles.buttonGroup}>
                        {(buttons?.length ? buttons : [{ text: 'OK', onPress: onClose }]).map((button, index) => (
                            <TouchableOpacity
                                key={`${button.text || 'OK'}-${index}`}
                                style={[
                                    styles.closeButton,
                                    button.style === 'destructive' && styles.destructiveButton,
                                ]}
                                onPress={button.onPress || onClose}
                            >
                                <Text style={[
                                    styles.closeButtonText,
                                    button.style === 'destructive' && styles.destructiveButtonText,
                                ]}>
                                    {button.text || 'OK'}
                                </Text>
                            </TouchableOpacity>
                        ))}
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
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    icon: {
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#01538b',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 20,
    },
    closeButton: {
        backgroundColor: '#f3f7f9',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 50,
        width: '100%',
        alignItems: 'center',
    },
    buttonGroup: {
        width: '100%',
        gap: 10,
    },
    closeButtonText: {
        color: '#555',
        fontWeight: 'bold',
        fontSize: 14,
    },
    destructiveButton: {
        backgroundColor: '#ffebee',
    },
    destructiveButtonText: {
        color: '#c62828',
    },
});
