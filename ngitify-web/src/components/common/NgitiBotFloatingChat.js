import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaCommentMedical, FaRobot } from 'react-icons/fa';
import styles from '../../styles/patient/PatientPortal.module.css';

const CLOSE_ANIMATION_MS = 180;
const LAUNCHER_SIZE_PX = 64;
const LAUNCHER_RIGHT_PX = 24;
const AVOID_GAP_PX = 12;

export default function NgitiBotFloatingChat({ children, openEventName = '', openRequestKey = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [launcherBottomOffset, setLauncherBottomOffset] = useState(null);
    const launcherRef = useRef(null);
    const launcherBottomOffsetRef = useRef(null);

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

    useEffect(() => {
        const updateLauncherOffset = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const launcherLeft = viewportWidth - LAUNCHER_RIGHT_PX - LAUNCHER_SIZE_PX;
            let nextBottomOffset = null;

            document.querySelectorAll('[data-ngitibot-avoid]').forEach((element) => {
                const computedStyle = window.getComputedStyle(element);
                if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;

                const rect = element.getBoundingClientRect();
                const isVisible = rect.width > 0
                    && rect.height > 0
                    && rect.bottom > 0
                    && rect.top < viewportHeight;
                const crossesLauncherColumn = rect.right > launcherLeft - AVOID_GAP_PX
                    && rect.left < viewportWidth - LAUNCHER_RIGHT_PX + AVOID_GAP_PX;

                if (!isVisible || !crossesLauncherColumn) return;

                const requiredBottomOffset = Math.ceil(viewportHeight - rect.top + AVOID_GAP_PX);
                nextBottomOffset = Math.max(nextBottomOffset || 0, requiredBottomOffset);
            });

            if (launcherBottomOffsetRef.current !== nextBottomOffset) {
                launcherBottomOffsetRef.current = nextBottomOffset;
                setLauncherBottomOffset(nextBottomOffset);
            }
        };

        updateLauncherOffset();
        window.addEventListener('resize', updateLauncherOffset);
        window.addEventListener('scroll', updateLauncherOffset, true);

        const mutationObserver = typeof MutationObserver !== 'undefined'
            ? new MutationObserver(updateLauncherOffset)
            : null;
        mutationObserver?.observe(document.body, { childList: true, subtree: true });

        return () => {
            window.removeEventListener('resize', updateLauncherOffset);
            window.removeEventListener('scroll', updateLauncherOffset, true);
            mutationObserver?.disconnect();
        };
    }, []);

    const launcherStyle = launcherBottomOffset
        ? { '--ngitibot-launcher-bottom': `${launcherBottomOffset}px` }
        : undefined;

    return (
        <>
            {!isOpen && !isClosing ? (
                <button
                    ref={launcherRef}
                    type="button"
                    className={styles.patientAiLauncher}
                    style={launcherStyle}
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
