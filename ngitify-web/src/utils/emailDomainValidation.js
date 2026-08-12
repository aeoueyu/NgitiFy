import { authFetch, publicFetch } from './api';
import {
    INVALID_EMAIL_ADDRESS_MESSAGE,
    INVALID_EMAIL_DOMAIN_MESSAGE,
    isValidEmailFormat,
} from './patientIntake';

export const getEmailDomainValidationError = async (email = '', { usePublicEndpoint = false } = {}) => {
    const trimmedEmail = String(email || '').trim();
    if (!trimmedEmail) return '';
    if (!isValidEmailFormat(trimmedEmail)) return INVALID_EMAIL_ADDRESS_MESSAGE;

    try {
        const fetcher = usePublicEndpoint ? publicFetch : authFetch;
        const response = await fetcher('/validate-email-domain', {
            method: 'POST',
            body: JSON.stringify({ email: trimmedEmail }),
        });
        if (response.ok) return '';

        const data = await response.json().catch(() => ({}));
        return data.message || INVALID_EMAIL_DOMAIN_MESSAGE;
    } catch {
        return 'Cannot validate email domain right now.';
    }
};
