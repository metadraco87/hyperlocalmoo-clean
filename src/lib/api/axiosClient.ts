/**
 * Axios-based API client for connecting to apexmoo.com API
 * This utility uses axios instead of fetch for API requests
 */
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Create a base axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: 'https://apexmoo.com',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    // Enable credentials for cross-origin requests (cookies, etc.)
    withCredentials: true,
    // Reasonable timeout (5 seconds)
    timeout: 5000
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
    (config) => {
        // Get token from localStorage or other storage
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
        
        // If token exists, add it to the headers
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle API errors
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('API Error:', error.response.status, error.response.data);
            
            // Handle 401 Unauthorized errors (optional)
            if (error.response.status === 401) {
                // Redirect to login or clear authentication
                console.log('Authentication error - user not authenticated');
                // You might want to redirect to login page or dispatch an auth error action
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Network Error:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Request Error:', error.message);
        }
        
        return Promise.reject(error);
    }
);

// API wrapper functions with more specific typing
export const api = {
    /**
     * Make GET request to API
     * @param url - API endpoint (without base URL)
     * @param params - URL parameters
     * @param config - Additional axios config
     * @returns Promise with response data
     */
    async get<T>(url: string, params = {}, config: AxiosRequestConfig = {}): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.get(url, { ...config, params });
        return response.data;
    },
    
    /**
     * Make POST request to API
     * @param url - API endpoint (without base URL)
     * @param data - Request body data
     * @param config - Additional axios config
     * @returns Promise with response data
     */
    async post<T, D = any>(url: string, data?: D, config: AxiosRequestConfig = {}): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.post(url, data, config);
        return response.data;
    },
    
    /**
     * Make PUT request to API
     * @param url - API endpoint (without base URL)
     * @param data - Request body data
     * @param config - Additional axios config
     * @returns Promise with response data
     */
    async put<T, D = any>(url: string, data?: D, config: AxiosRequestConfig = {}): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.put(url, data, config);
        return response.data;
    },
    
    /**
     * Make DELETE request to API
     * @param url - API endpoint (without base URL)
     * @param config - Additional axios config
     * @returns Promise with response data
     */
    async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.delete(url, config);
        return response.data;
    },
    
    /**
     * Upload file to API
     * @param url - API endpoint (without base URL)
     * @param file - File to upload
     * @param fieldName - Form field name for the file
     * @param additionalData - Additional form data
     * @returns Promise with response data
     */
    async uploadFile<T>(
        url: string, 
        file: File,
        fieldName = 'file',
        additionalData: Record<string, any> = {}
    ): Promise<T> {
        // Create form data
        const formData = new FormData();
        formData.append(fieldName, file);
        
        // Add any additional form fields
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
        
        // Set proper headers for multipart/form-data
        const config: AxiosRequestConfig = {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        };
        
        const response: AxiosResponse<T> = await apiClient.post(url, formData, config);
        return response.data;
    }
};

export default api;
