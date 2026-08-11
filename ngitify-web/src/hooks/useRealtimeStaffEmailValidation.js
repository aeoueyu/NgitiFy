import { useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import {
    DUPLICATE_EMAIL_MESSAGE,
    hasDuplicateEmailError,
    isValidStaffEmail,
} from '../utils/staffAccountFormUtils';

export default function useRealtimeStaffEmailValidation({
    email,
    excludeId,
    setErrors,
    enabled = true,
}) {
    const latestRequestRef = useRef(0);

    useEffect(() => {
        if (!enabled) {
            latestRequestRef.current += 1;
            setErrors((prev) => (
                hasDuplicateEmailError(prev.email)
                    ? { ...prev, email: '' }
                    : prev
            ));
            return undefined;
        }

        const trimmedEmail = String(email || '').trim().toLowerCase();

        if (!trimmedEmail || !isValidStaffEmail(trimmedEmail)) {
            setErrors((prev) => (
                hasDuplicateEmailError(prev.email)
                    ? { ...prev, email: '' }
                    : prev
            ));
            return undefined;
        }

        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;

        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await authFetch('/check-email', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: trimmedEmail,
                        excludeId,
                    }),
                });

                if (latestRequestRef.current !== requestId) return;

                if (response.status === 409) {
                    const data = await response.json();
                    if (latestRequestRef.current !== requestId) return;
                    setErrors((prev) => ({ ...prev, email: data.message || DUPLICATE_EMAIL_MESSAGE }));
                    return;
                }

                setErrors((prev) => (
                    hasDuplicateEmailError(prev.email)
                        ? { ...prev, email: '' }
                        : prev
                ));
            } catch {
                if (latestRequestRef.current !== requestId) return;
            }
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [email, enabled, excludeId, setErrors]);
}
