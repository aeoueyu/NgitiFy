const resolveBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

    if (typeof window !== 'undefined') {
        const { hostname, protocol } = window.location;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        }

        if (hostname === 'ngitify.com' || hostname === 'www.ngitify.com') {
            return `${protocol}//${hostname}`;
        }

        if (hostname.endsWith('netlify.app')) {
            return 'https://ngitify.com';
        }
    }

    return 'http://localhost:5000';
};

export const BASE_URL = resolveBaseUrl();

const API_BASE = `${BASE_URL}/api`;
export const buildApiUrl = (endpoint) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE}${formattedEndpoint}`;
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
        const response = await fetch(buildApiUrl(formattedEndpoint), config);

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
        return await fetch(buildApiUrl(formattedEndpoint), config);
    } catch (error) {
        console.error(`Public API Fetch Error [${formattedEndpoint}]:`, error);
        throw error;
    }
};

export default authFetch;
