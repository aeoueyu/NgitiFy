import React from 'react';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    isDestructive = false // If true, button is Red. If false, button is Primary Blue.
}) {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>{title}</h3>
                <p className={styles.modalMessage}>{message}</p>
                <div className={styles.modalButtonGroup}>
                    <button 
                        className={styles.cancelBtn} 
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={isDestructive ? styles.destructiveBtn : styles.primaryBtn} 
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}