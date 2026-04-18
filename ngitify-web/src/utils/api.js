export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const API_BASE = `${BASE_URL}/api`;

/**
 * A wrapper around the native fetch API that automatically includes
 * the Authorization header with the JWT token from localStorage.
 * * @param {string} endpoint - The API endpoint (e.g., '/users?role=patient')
 * @param {object} options - Standard fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} - The fetch Response object
 */
export const authFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    
    // Set up default headers, attaching the token if it exists
    const defaultHeaders = {
        'Content-Type': 'application/json',
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
        const response = await fetch(`${API_BASE}${formattedEndpoint}`, config);

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

export default authFetch;