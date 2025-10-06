/**
 * API client for connecting to apexmoo.com API
 * This utility provides typed methods for making API requests to the backend
 */

// You can adjust the base URL as needed
const API_BASE_URL = 'https://api.apexmoo.com';

// Response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface ErrorResponse {
    status: number;
    statusText: string;
    data: any;
}

// Optional: Get token from local storage or other auth mechanism
const getAuthToken = (): string | null => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('authToken');
    }
    return null;
};

/**
 * Creates headers for API requests
 * @param includeAuth - Whether to include authorization header
 * @returns Headers object for fetch
 */
const createHeaders = (includeAuth = true): Headers => {
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
 * @param response - Fetch response object
 * @returns Parsed response data
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
    // Get the response content
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
        const error: ErrorResponse = {
            status: response.status,
            statusText: response.statusText,
            data,
        };
        console.error('API Error:', error);
        throw error;
    }

    return data as T;
};

// Request options interface
interface RequestOptions {
    auth?: boolean;
    params?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * API client with methods for different request types
 */
const apiClient = {
    /**
     * Make GET request to API
     * @param endpoint - API endpoint (without base URL)
     * @param options - Additional options
     * @returns Response data
     */
    async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true, params = {} } = options;
        
        // Add query parameters if provided
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
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
            
            return handleResponse<T>(response);
        } catch (error) {
            console.error('GET request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make POST request to API
     * @param endpoint - API endpoint (without base URL)
     * @param data - Data to send in request body
     * @param options - Additional options
     * @returns Response data
     */
    async post<T, D = any>(endpoint: string, data: D = {} as D, options: RequestOptions = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: createHeaders(auth),
                body: JSON.stringify(data),
                credentials: 'include',
            });
            
            return handleResponse<T>(response);
        } catch (error) {
            console.error('POST request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make PUT request to API
     * @param endpoint - API endpoint (without base URL)
     * @param data - Data to send in request body
     * @param options - Additional options
     * @returns Response data
     */
    async put<T, D = any>(endpoint: string, data: D = {} as D, options: RequestOptions = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: createHeaders(auth),
                body: JSON.stringify(data),
                credentials: 'include',
            });
            
            return handleResponse<T>(response);
        } catch (error) {
            console.error('PUT request failed:', error);
            throw error;
        }
    },
    
    /**
     * Make DELETE request to API
     * @param endpoint - API endpoint (without base URL)
     * @param options - Additional options
     * @returns Response data
     */
    async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const { auth = true } = options;
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: createHeaders(auth),
                credentials: 'include',
            });
            
            return handleResponse<T>(response);
        } catch (error) {
            console.error('DELETE request failed:', error);
            throw error;
        }
    },
};

export default apiClient;
