/**
 * API client for connecting to apexmoo.com API
 * This utility provides methods for making API requests to the backend
 */

// You can adjust the base URL as needed
const API_BASE_URL = 'https://api.apexmoo.com';

// Optional: Get token from local storage or other auth mechanism
const getAuthToken = () => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('authToken');
    }
    return null;
};

/**
 * Creates headers for API requests
 * @param {boolean} includeAuth - Whether to include authorization header
 * @returns {Headers} Headers object for fetch
 */
const createHeaders = (includeAuth = true) => {
    const headers = new Headers({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    });

    // Add authorization header if token exists and auth is requested
    if (includeAuth) {
        const token = getAuthToken();
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }
    }

    return headers;
};

/**
 * Handle API response
 * @param {Response} response - Fetch response object
 * @returns {Promise<any>} Parsed response data
 */
const handleResponse = async (response) => {
    // Get the response content
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
        const error = {
            status: response.status,
            statusText: response.statusText,
            data,
        };
        console.error('API Error:', error);
        throw error;
    }

    return data;
};

/**
 * API client with methods for different request types
 */
const apiClient = {
    /**
     * Make GET request to API
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async get(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true, params = {} } = options;
        
        // Add query parameters if provided
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, value);
            }
        });
        
        const queryString = queryParams.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        try {
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: createHeaders(auth),
                credentials: 'include',
            });
            
            return handleResponse(response);
        } catch (error) {
            console.error('GET request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make POST request to API
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} data - Data to send in request body
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async post(endpoint, data = {}, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: createHeaders(auth),
                body: JSON.stringify(data),
                credentials: 'include',
            });
            
            return handleResponse(response);
        } catch (error) {
            console.error('POST request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make PUT request to API
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} data - Data to send in request body
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async put(endpoint, data = {}, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: createHeaders(auth),
                body: JSON.stringify(data),
                credentials: 'include',
            });
            
            return handleResponse(response);
        } catch (error) {
            console.error('PUT request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make DELETE request to API
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async delete(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: createHeaders(auth),
                credentials: 'include',
            });
            
            return handleResponse(response);
        } catch (error) {
            console.error('DELETE request failed:', error);
            throw error;
        }
    },
};

export default apiClient;
