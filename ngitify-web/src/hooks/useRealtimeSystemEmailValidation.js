import { useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';

const isPlainFormatValid = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const isManagedEmailError = (message = '') => {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('email already exists')
        || normalized.includes('real email domain')
        || normalized.includes('invalid email domain')
        || normalized.includes('valid email address');
};

export default function useRealtimeSystemEmailValidation({
    email,
    excludeId,
    enabled = true,
    setErrors,
}) {
    const latestRequestRef = useRef(0);

    useEffect(() => {
        if (!enabled) return undefined;

        const trimmedEmail = String(email || '').trim().toLowerCase();
        if (!trimmedEmail) {
            setErrors((prev) => (isManagedEmailError(prev.email) ? { ...prev, email: '' } : prev));
            return undefined;
        }

        if (!isPlainFormatValid(trimmedEmail)) {
            return undefined;
        }

        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;

        const timeoutId = window.setTimeout(async () => {
            try {
                const domainResponse = await authFetch('/validate-email-domain', {
                    method: 'POST',
                    body: JSON.stringify({ email: trimmedEmail }),
                });
                const domainData = await domainResponse.json().catch(() => ({}));

                if (latestRequestRef.current !== requestId) return;
                if (!domainResponse.ok) {
                    setErrors((prev) => ({ ...prev, email: domainData.message || 'Invalid email domain' }));
                    return;
                }

                const duplicateResponse = await authFetch('/check-email', {
                    method: 'POST',
                    body: JSON.stringify({ email: trimmedEmail, excludeId }),
                });
                const duplicateData = await duplicateResponse.json().catch(() => ({}));

                if (latestRequestRef.current !== requestId) return;
                if (duplicateResponse.status === 409) {
                    setErrors((prev) => ({ ...prev, email: duplicateData.message || 'Email already exists.' }));
                    return;
                }

                setErrors((prev) => (isManagedEmailError(prev.email) ? { ...prev, email: '' } : prev));
            } catch {
                if (latestRequestRef.current !== requestId) return;
            }
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [email, enabled, excludeId, setErrors]);
}
