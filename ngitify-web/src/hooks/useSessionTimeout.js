import { useEffect, useRef, useCallback } from 'react';

const WARNING_BEFORE_MS = 5 * 60 * 1000; // Always warn 5 minutes before timeout
const DEFAULT_TIMEOUT_MINUTES = 30;

export function useSessionTimeout({ onTimeout, onWarn, onResetWarn, timeoutMinutes, enabled = true }) {
    const timeoutRef = useRef(null);
    const warningRef = useRef(null);
    const warnedRef  = useRef(false);

    // Convert minutes to ms, falling back to default if not provided or invalid
    const timeoutMs = (
        typeof timeoutMinutes === 'number' && timeoutMinutes > 0
            ? timeoutMinutes
            : DEFAULT_TIMEOUT_MINUTES
    ) * 60 * 1000;

    const resetTimer = useCallback(() => {
        clearTimeout(timeoutRef.current);
        clearTimeout(warningRef.current);

        // If warning was showing, hide it when user becomes active again
        if (warnedRef.current) {
            warnedRef.current = false;
            onResetWarn?.();
        }

        // Warning fires 5 minutes before logout (or at halfway point if timeout < 10 min)
        const warningDelay = Math.max(timeoutMs - WARNING_BEFORE_MS, timeoutMs / 2);

        warningRef.current = setTimeout(() => {
            warnedRef.current = true;
            onWarn?.();
        }, warningDelay);

        timeoutRef.current = setTimeout(() => {
            onTimeout?.();
        }, timeoutMs);

    }, [onTimeout, onWarn, onResetWarn, timeoutMs]);

    useEffect(() => {
        if (!enabled) {
            clearTimeout(timeoutRef.current);
            clearTimeout(warningRef.current);
            if (warnedRef.current) {
                warnedRef.current = false;
                onResetWarn?.();
            }
            return undefined;
        }

        const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

        // Throttle so it doesn't fire hundreds of times per second
        let throttleTimer = null;
        const handleActivity = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                resetTimer();
            }, 500);
        };

        events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        resetTimer(); // Start the timer on mount

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            clearTimeout(timeoutRef.current);
            clearTimeout(warningRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [enabled, onResetWarn, resetTimer]);
}
