import { useEffect, useRef } from 'react';
import { authFetch, publicFetch } from '../utils/api';
import {
    INVALID_EMAIL_ADDRESS_MESSAGE,
    isValidEmailFormat,
} from '../utils/patientIntake';

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
    fieldName = 'email',
    validateDuplicates = true,
    usePublicEndpoint = false,
}) {
    const latestRequestRef = useRef(0);
    const lastResultRef = useRef({ email: '', error: '' });

    useEffect(() => {
        if (!enabled) return undefined;

        const trimmedEmail = String(email || '').trim().toLowerCase();
        if (!trimmedEmail) {
            latestRequestRef.current += 1;
            lastResultRef.current = { email: '', error: '' };
            setErrors((prev) => (isManagedEmailError(prev[fieldName]) ? { ...prev, [fieldName]: '' } : prev));
            return undefined;
        }

        if (!isValidEmailFormat(trimmedEmail)) {
            latestRequestRef.current += 1;
            lastResultRef.current = { email: trimmedEmail, error: INVALID_EMAIL_ADDRESS_MESSAGE };
            setErrors((prev) => ({ ...prev, [fieldName]: INVALID_EMAIL_ADDRESS_MESSAGE }));
            return undefined;
        }

        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;

        if (lastResultRef.current.error && lastResultRef.current.email !== trimmedEmail) {
            setErrors((prev) => ({ ...prev, [fieldName]: lastResultRef.current.error }));
        }

        const timeoutId = window.setTimeout(async () => {
            try {
                const fetcher = usePublicEndpoint ? publicFetch : authFetch;
                const domainResponse = await fetcher('/validate-email-domain', {
                    method: 'POST',
                    body: JSON.stringify({ email: trimmedEmail }),
                });
                const domainData = await domainResponse.json().catch(() => ({}));

                if (latestRequestRef.current !== requestId) return;
                if (!domainResponse.ok) {
                    const nextError = domainData.message || 'Invalid email domain';
                    lastResultRef.current = { email: trimmedEmail, error: nextError };
                    setErrors((prev) => ({ ...prev, [fieldName]: nextError }));
                    return;
                }

                if (!validateDuplicates) {
                    lastResultRef.current = { email: trimmedEmail, error: '' };
                    setErrors((prev) => (isManagedEmailError(prev[fieldName]) ? { ...prev, [fieldName]: '' } : prev));
                    return;
                }

                const duplicateResponse = await authFetch('/check-email', {
                    method: 'POST',
                    body: JSON.stringify({ email: trimmedEmail, excludeId }),
                });
                const duplicateData = await duplicateResponse.json().catch(() => ({}));

                if (latestRequestRef.current !== requestId) return;
                if (duplicateResponse.status === 409) {
                    const nextError = duplicateData.message || 'Email already exists.';
                    lastResultRef.current = { email: trimmedEmail, error: nextError };
                    setErrors((prev) => ({ ...prev, [fieldName]: nextError }));
                    return;
                }

                lastResultRef.current = { email: trimmedEmail, error: '' };
                setErrors((prev) => (isManagedEmailError(prev[fieldName]) ? { ...prev, [fieldName]: '' } : prev));
            } catch {
                if (latestRequestRef.current !== requestId) return;
            }
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [email, enabled, excludeId, fieldName, setErrors, usePublicEndpoint, validateDuplicates]);
}
