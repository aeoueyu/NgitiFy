const LOCAL_API_URL = 'http://localhost:5000';
const REMOTE_API_URL = 'https://ngitify.onrender.com';

const normalizeBaseUrl = (value) => (value ? value.replace(/\/+$/, '') : '');

const resolveBaseUrl = () => {
    const envUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL);
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
        const { hostname, origin } = window.location;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return LOCAL_API_URL;
        }

        if (
            hostname === 'ngitify.com' ||
            hostname === 'www.ngitify.com' ||
            hostname.endsWith('.onrender.com')
        ) {
            return normalizeBaseUrl(origin);
        }

        return REMOTE_API_URL;
    }

    return REMOTE_API_URL;
};

const buildApiUrlWithBase = (baseUrl, endpoint) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${normalizeBaseUrl(baseUrl)}/api${formattedEndpoint}`;
};

export const BASE_URL = resolveBaseUrl();
const FALLBACK_BASE_URL = BASE_URL === REMOTE_API_URL ? '' : REMOTE_API_URL;

export const buildApiUrl = (endpoint) => buildApiUrlWithBase(BASE_URL, endpoint);

const shouldRetryWithFallback = (response) => (
    Boolean(FALLBACK_BASE_URL) && [404, 502, 503, 504].includes(response.status)
);

const fetchWithFallback = async (endpoint, config) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = buildApiUrlWithBase(BASE_URL, formattedEndpoint);

    try {
        const primaryResponse = await fetch(primaryUrl, config);
        if (!shouldRetryWithFallback(primaryResponse)) {
            return primaryResponse;
        }
    } catch (primaryError) {
        if (!FALLBACK_BASE_URL) {
            throw primaryError;
        }
    }

    return fetch(buildApiUrlWithBase(FALLBACK_BASE_URL, formattedEndpoint), config);
};

/**
 * A wrapper around the native fetch API that automatically includes
 * the Authorization header with the JWT token from localStorage.
 * * @param {string} endpoint - The API endpoint (e.g., '/users?role=patient')
 * @param {object} options - Standard fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} - The fetch Response object
 */
export const authFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const hasBody = options.body !== undefined && !(options.body instanceof FormData);

    const defaultHeaders = {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    // Merge default headers with any custom headers passed in
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    // Ensure endpoint starts with a slash
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    try {
        const response = await fetchWithFallback(formattedEndpoint, config);

        if (response.status === 401) {
            console.warn("Session expired. Redirecting to login.");
            localStorage.removeItem('token');
            localStorage.removeItem('ngitify_user');
            window.location.href = '/login';
        }

        return response;
        
    } catch (error) {
        console.error(`API Fetch Error [${formattedEndpoint}]:`, error);
        throw error;
    }
};

export const publicFetch = async (endpoint, options = {}) => {
    const hasBody = options.body !== undefined && !(options.body instanceof FormData);
    const defaultHeaders = {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    try {
        return await fetchWithFallback(formattedEndpoint, config);
    } catch (error) {
        console.error(`Public API Fetch Error [${formattedEndpoint}]:`, error);
        throw error;
    }
};

export default authFetch;
