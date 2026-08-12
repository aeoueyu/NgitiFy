import { useEffect, useRef } from 'react';
import { authFetch, publicFetch } from '../utils/api';
import { isValidEmailFormat } from '../utils/patientIntake';

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

    useEffect(() => {
        if (!enabled) return undefined;

        const trimmedEmail = String(email || '').trim().toLowerCase();
        if (!trimmedEmail) {
            setErrors((prev) => (isManagedEmailError(prev[fieldName]) ? { ...prev, [fieldName]: '' } : prev));
            return undefined;
        }

        if (!isValidEmailFormat(trimmedEmail)) {
            return undefined;
        }

        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;

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
                    setErrors((prev) => ({ ...prev, [fieldName]: domainData.message || 'Invalid email domain' }));
                    return;
                }

                if (!validateDuplicates) {
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
                    setErrors((prev) => ({ ...prev, [fieldName]: duplicateData.message || 'Email already exists.' }));
                    return;
                }

                setErrors((prev) => (isManagedEmailError(prev[fieldName]) ? { ...prev, [fieldName]: '' } : prev));
            } catch {
                if (latestRequestRef.current !== requestId) return;
            }
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [email, enabled, excludeId, fieldName, setErrors, usePublicEndpoint, validateDuplicates]);
}
