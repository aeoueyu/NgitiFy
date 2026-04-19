import { useEffect, useRef, useCallback } from 'react';

const TIMEOUT_DURATION = 30 * 60 * 1000;  // 30 minutes
const WARNING_BEFORE   = 5  * 60 * 1000;  // warn at 25-min mark

export function useSessionTimeout({ onTimeout, onWarn, onResetWarn }) {
    const timeoutRef = useRef(null);
    const warningRef = useRef(null);
    const warnedRef  = useRef(false);

    const resetTimer = useCallback(() => {
        // Clear existing timers
        clearTimeout(timeoutRef.current);
        clearTimeout(warningRef.current);

        // If warning was showing, hide it when user becomes active again
        if (warnedRef.current) {
            warnedRef.current = false;
            onResetWarn?.();
        }

        // Set warning timer (fires at 25-min mark)
        warningRef.current = setTimeout(() => {
            warnedRef.current = true;
            onWarn?.();
        }, TIMEOUT_DURATION - WARNING_BEFORE);

        // Set logout timer (fires at 30-min mark)
        timeoutRef.current = setTimeout(() => {
            onTimeout?.();
        }, TIMEOUT_DURATION);
    }, [onTimeout, onWarn, onResetWarn]);

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

        // Throttle the reset so it doesn't fire hundreds of times per second
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
    }, [resetTimer]);
}