import React, { useEffect, useState } from 'react';
import styles from './ResendEmailButton.module.css';

const COOLDOWN_MS = 60_000;
const STORAGE_PREFIX = 'dentime-resend-email-cooldown:';
const pendingKeys = new Set();
const listeners = new Map();

const storageKey = (key) => `${STORAGE_PREFIX}${key}`;

const getCooldownEnd = (key) => {
    try {
        const value = Number(window.sessionStorage.getItem(storageKey(key)) || 0);
        if (value > Date.now()) return value;
        window.sessionStorage.removeItem(storageKey(key));
    } catch {
        // The in-memory lock still protects the action when storage is unavailable.
    }
    return 0;
};

const setCooldownEnd = (key, value) => {
    try {
        window.sessionStorage.setItem(storageKey(key), String(value));
    } catch {
        // A blocked storage API should not prevent a successful resend.
    }
};

const notify = (key) => listeners.get(key)?.forEach((listener) => listener());

export default function ResendEmailButton({
    cooldownKey,
    label = 'Resend Activation Email',
    onResend,
    className = '',
    style,
}) {
    const key = String(cooldownKey || label);
    const [, refresh] = useState(0);

    useEffect(() => {
        const listener = () => refresh((value) => value + 1);
        const keyListeners = listeners.get(key) || new Set();
        keyListeners.add(listener);
        listeners.set(key, keyListeners);

        const intervalId = window.setInterval(listener, 1000);
        return () => {
            window.clearInterval(intervalId);
            keyListeners.delete(listener);
            if (keyListeners.size === 0) listeners.delete(key);
        };
    }, [key]);

    const isSending = pendingKeys.has(key);
    const cooldownSeconds = Math.max(0, Math.ceil((getCooldownEnd(key) - Date.now()) / 1000));
    const isDisabled = isSending || cooldownSeconds > 0;

    const handleClick = async () => {
        if (pendingKeys.has(key) || getCooldownEnd(key) > Date.now()) return;

        pendingKeys.add(key);
        notify(key);
        try {
            const result = await onResend?.();
            if (result) {
                setCooldownEnd(key, Date.now() + COOLDOWN_MS);
            }
        } finally {
            pendingKeys.delete(key);
            notify(key);
        }
    };

    return (
        <button
            type="button"
            className={`${styles.button} ${className}`.trim()}
            style={style}
            onClick={handleClick}
            disabled={isDisabled}
            aria-busy={isSending}
        >
            <span>{label}</span>
            {isSending && <span className={styles.spinner} aria-hidden="true" />}
            {cooldownSeconds > 0 && <span className={styles.timer}>({cooldownSeconds}s)</span>}
        </button>
    );
}
