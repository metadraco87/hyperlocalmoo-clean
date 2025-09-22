// src/lib/stores/posts.js
import { writable, get } from 'svelte/store';
import { cachedFetch } from '$lib/cache';
import { auth } from '$lib/stores/auth';
import { browser } from '$app/environment';

export const posts = writable([]);
export const loadingPosts = writable(false);
export const postsError = writable('');

/**
 * Fetches posts from the backend API.
 * @param {string} url - The API endpoint URL (can be relative to base path).
 * @param {object} [options] - Options object.
 * @param {boolean} [options.protected=false] - If true, adds Authorization header.
 */
export async function getPosts(url, options = {}) {
    loadingPosts.set(true);
    postsError.set('');

    try {
        const { protected: isProtected = false } = options;
        let headers = { 'Content-Type': 'application/json' };

        if (isProtected) {
            const currentAuth = get(auth);
            if (!currentAuth.authToken) {
                postsError.set('Authentication required to fetch posts.');
                loadingPosts.set(false);
                return;
            }
            headers['Authorization'] = `Bearer ${currentAuth.authToken}`;
        }

        const response = await cachedFetch(url, { headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        posts.set(data.posts || []);
        postsError.set('');

    } catch (error) {
        console.error("Error fetching posts:", error);
        postsError.set(`Failed to load posts: ${error.message || 'Network error'}`);
        posts.set([]);
    } finally {
        loadingPosts.set(false);
    }
}