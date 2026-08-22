import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaCommentMedical, FaRobot } from 'react-icons/fa';
import styles from '../../styles/patient/PatientPortal.module.css';

const CLOSE_ANIMATION_MS = 180;

export default function NgitiBotFloatingChat({ children, openEventName = '', openRequestKey = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const launcherRef = useRef(null);

    const openChat = useCallback(() => {
        setHasOpened(true);
        setIsClosing(false);
        setIsOpen(true);
    }, []);

    const closeChat = useCallback(() => {
        setIsClosing(true);
        setIsOpen(false);
    }, []);

    useEffect(() => {
        if (!openEventName) return undefined;
        window.addEventListener(openEventName, openChat);
        return () => window.removeEventListener(openEventName, openChat);
    }, [openChat, openEventName]);

    useEffect(() => {
        if (openRequestKey) openChat();
    }, [openChat, openRequestKey]);

    useEffect(() => {
        if (!isClosing) return undefined;
        const timerId = window.setTimeout(() => {
            setIsClosing(false);
            window.setTimeout(() => launcherRef.current?.focus(), 0);
        }, CLOSE_ANIMATION_MS);
        return () => window.clearTimeout(timerId);
    }, [isClosing]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') closeChat();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeChat, isOpen]);

    return (
        <>
            {!isOpen && !isClosing ? (
                <button
                    ref={launcherRef}
                    type="button"
                    className={styles.patientAiLauncher}
                    onClick={openChat}
                    aria-label="Open NgitiBot"
                    aria-haspopup="dialog"
                    title="Ask NgitiBot"
                >
                    <FaCommentMedical className={styles.patientAiLauncherBubble} aria-hidden="true" />
                    <FaRobot className={styles.patientAiLauncherRobot} aria-hidden="true" />
                    <span className={styles.patientAiLauncherTooltip} role="tooltip">Ask NgitiBot</span>
                </button>
            ) : null}

            {hasOpened ? (
                <div
                    className={`${styles.patientAiFloatingHost}${isOpen ? ` ${styles.patientAiFloatingHostOpen}` : ` ${styles.patientAiFloatingHostClosed}`}`}
                    aria-hidden={!isOpen}
                >
                    {children({ isOpen, onClose: closeChat })}
                </div>
            ) : null}
        </>
    );
}
