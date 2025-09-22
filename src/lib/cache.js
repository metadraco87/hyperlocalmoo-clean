// src/lib/cache.js
import { browser } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes cache time-to-live

// Function to get backend URL
export function getBackendUrl() {
    const backendUrl = PUBLIC_API_BASE_URL || 'http://localhost:4000';
    if (!PUBLIC_API_BASE_URL) {
        console.warn('cache.js: PUBLIC_API_BASE_URL not defined in .env. Using fallback:', backendUrl);
    }
    return backendUrl;
}

/**
 * Fetches data with caching and authentication.
 * @param {string} url - The request URL. Can be an absolute URL or a path relative to the backend root (e.g., '/api/posts').
 * @param {RequestInit} [options] - Fetch options.
 * @param {string} [cacheKeySuffix] - Optional suffix for the cache key.
 * @param {boolean} [useCache=true] - Whether to use caching.
 * @returns {Promise<Response>} - The fetch Response object.
 */
export async function cachedFetch(url, options = {}, cacheKeySuffix = '', useCache = true) {
    let fullUrl;

    // Check if the URL is already absolute (starts with http:// or https://)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        fullUrl = url;
    } else {
        // If it's a relative path, prepend the backend URL
        fullUrl = `${getBackendUrl()}${url.startsWith('/') ? url : `/${url}`}`;
    }

    // The cacheKey should ideally include options if they affect the response
    // For simplicity, let's use the fullUrl and a provided suffix for cache key
    const cacheKey = `${fullUrl}_${JSON.stringify(options)}_${cacheKeySuffix}`;
    const now = Date.now();

    if (useCache && cache.has(cacheKey)) {
        const { data, timestamp } = cache.get(cacheKey);
        if (now - timestamp < TTL) {
            console.log(`cache.js: Cache hit for ${fullUrl}`);
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'X-Cached': 'true' }
            });
        } else {
            console.log(`cache.js: Cache expired for ${fullUrl}`);
            cache.delete(cacheKey);
        }
    }

    console.log(`cache.js: Fetching from network: ${fullUrl}`);
    const headers = {
        ...options.headers,
        // Ensure Content-Type is set if body is JSON, but don't force it for all requests (e.g., GET)
        // Only set if not already present AND if a JSON body is likely (POST/PUT)
        ...(options.body && typeof options.body === 'string' && !options.headers?.['Content-Type'] && { 'Content-Type': 'application/json' })
    };

    // Extract authToken from options if it's there, or pass it explicitly as a parameter
    // Assuming authToken is passed explicitly to cachedFetch in api.ts
    if (options.authToken) { // Check for authToken in options
        headers['Authorization'] = `Bearer ${options.authToken}`;
    } else if (options.headers?.Authorization) {
        // Do nothing, it's already in headers
    } else if (typeof window !== 'undefined' && localStorage.getItem('token')) {
        // Fallback to localStorage token if no token explicitly provided
        headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
    }


    const response = await fetch(fullUrl, {
        ...options,
        headers
    });

    if (response.ok && response.headers.get('content-type')?.includes('application/json') && useCache) {
        const data = await response.clone().json();
        cache.set(cacheKey, { data, timestamp: now });
    }

    return response;
}

/**
 * Clears the cache.
 * @param {string} [urlPrefix] - If provided, only clears cache entries starting with this prefix.
 */
export async function clearCache(urlPrefix = '') {
    try {
        if (urlPrefix) {
            // Clear specific cache entries
            const keysToDelete = [];
            for (const [key] of cache) {
                if (key.includes(urlPrefix)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => {
                cache.delete(key);
                console.log(`cache.js: Cleared specific cache key: ${key.substring(0, 100)}...`);
            });
        } else {
            // Clear all cache
            cache.clear();
            console.log('cache.js: All cache cleared.');
        }
        
        // Also clear localStorage keys starting with backend URL
        if (typeof localStorage !== 'undefined') {
            const cacheKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('http://localhost:4000/api/') || 
                key.startsWith(PUBLIC_API_BASE_URL || '')
            );
            for (const key of cacheKeys) {
                try {
                    localStorage.removeItem(key);
                    console.log(`cache.js: Cleared localStorage key: ${key}`);
                } catch (error) {
                    console.warn(`cache.js: Error clearing cache key ${key}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('cache.js: Error clearing cache:', error);
    }
}