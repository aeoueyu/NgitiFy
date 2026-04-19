import React, { useState, useEffect } from 'react';
import styles from './SessionWarningModal.module.css';

const WARNING_SECONDS = 5 * 60; // 5 minutes countdown

export default function SessionWarningModal({ isOpen, onStayLoggedIn }) {
    const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

    // Reset and start countdown whenever the modal opens
    useEffect(() => {
        if (!isOpen) {
            setSecondsLeft(WARNING_SECONDS);
            return;
        }

        setSecondsLeft(WARNING_SECONDS);
        const interval = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Urgency color shifts red as time runs out
    const isUrgent = secondsLeft <= 60;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrapper}>
                    <span className={styles.clockIcon}>⏱</span>
                </div>

                <h2 className={styles.title}>Session Expiring Soon</h2>
                <p className={styles.message}>
                    You've been inactive for a while. You will be automatically logged out in:
                </p>

                <div className={`${styles.countdown} ${isUrgent ? styles.urgent : ''}`}>
                    {timeDisplay}
                </div>

                <p className={styles.hint}>Click anywhere or press the button below to stay logged in.</p>

                <button className={styles.stayBtn} onClick={onStayLoggedIn}>
                    Stay Logged In
                </button>
            </div>
        </div>
    );
}