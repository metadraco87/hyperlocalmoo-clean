import axios from 'axios';
import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { cachedFetch, clearCache } from './cache';
import type { AuthResponse } from '$lib/stores/auth';
import { browser } from '$app/environment';
import type { Post, Comment } from '$lib/types/posts';

export { PUBLIC_API_BASE_URL }; // Export for use in other files
const BASE_URL = 'http://localhost:4000/api';

function getTokenFromLocalStorage(): string | null {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        console.log('api.ts: getTokenFromLocalStorage:', token ? 'Token found' : 'No token in localStorage');
        return token;
    }
    console.warn('api.ts: getTokenFromLocalStorage called in non-browser environment, returning null');
    return null;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('api.ts: handleResponse error:', errorData.message || `HTTP error ${response.status}`);
        
        // Handle CORS errors which might not have JSON response
        if (response.status === 0 || !response.headers.get('Access-Control-Allow-Origin')) {
            console.error('api.ts: Possible CORS error on', response.url);
            throw new Error('Network error: This might be a CORS issue. Check the server CORS configuration.');
        }
        
        // Handle 400 errors
        if (response.status === 400) {
            throw new Error(errorData.message || `Bad request (400): The server rejected the request. Please check your inputs.`);
        }
        
        // Handle 401 errors
        if (response.status === 401) {
            throw new Error(`Authentication error (401): Your session may have expired. Please log in again.`);
        }
        
        // Handle 403 errors
        if (response.status === 403) {
            // Check if this is a token expiration error
            if (errorData.message && errorData.message.includes('expired token')) {
                // Clear the expired token
                if (browser) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userEmail');
                }
                throw new Error('Your session has expired. Please log in again.');
            }
            throw new Error(`Permission denied (403): You don't have permission to perform this action.`);
        }
        
        throw new Error(errorData.message || `Failed to fetch: ${response.status}`);
    }
    return response.json();
}

function isValidUrl(url: string): boolean {
    if (!url) return true;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function isValidMediaUrl(mediaUrl: string): boolean {
    if (!mediaUrl) return true;
    const s3Pattern = /^https:\/\/hyperlocalmoo-uploads\.s3\..+\.amazonaws\.com\/uploads\/.+$/;
    return s3Pattern.test(mediaUrl) && mediaUrl.trim() !== '';
}

function validatePostData(postData: any): boolean {
    const normalizedCategory = postData.category ? postData.category.toUpperCase() : '';
    const requiredFields = ['location', 'locationName', 'fenceName'];
    for (const field of requiredFields) {
        if (field === 'location') {
            if (!postData.location || typeof postData.location !== 'object' ||
                !postData.location.name ||
                typeof postData.location.lat !== 'number' || isNaN(postData.location.lat) ||
                typeof postData.location.lng !== 'number' || isNaN(postData.location.lng)) {
                throw new Error('Invalid location object: must include name, lat, and lng as numbers.');
            }
        } else if (postData[field] === undefined || postData[field] === null || postData[field] === '') {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    if (!postData.headline?.trim() && !postData.content?.trim() && !postData.imageUrl?.trim() && !postData.mediaUrl?.trim() && !postData.link?.trim()) {
        throw new Error('At least one of Headline, Content, Image URL, Media URL, or External Link is required.');
    }
    // Validate title length only if headline is provided and not empty
    if (postData.headline && postData.headline.trim() && postData.headline.trim().length > 100) {
        throw new Error('Title must be 100 characters or less.');
    }
    const ALLOWED_CATEGORIES = ['ALERTS', 'NEWS', 'EVENTS', 'JOBS', 'TASKS', 'BUSINESSES', 'POINTS OF INTEREST', 'COMMUNITY', 'GENERAL INFORMATION'];
    if (!normalizedCategory || !ALLOWED_CATEGORIES.includes(normalizedCategory)) {
        throw new Error(`Invalid category: must be one of ${ALLOWED_CATEGORIES.join(', ')}`);
    }
    if (postData.imageUrl && !isValidUrl(postData.imageUrl)) {
        throw new Error('Invalid imageUrl: must be a valid URL.');
    }
    if (postData.mediaUrl && !isValidMediaUrl(postData.mediaUrl)) {
        throw new Error('Invalid mediaUrl: must be a valid S3 URL starting with https://hyperlocalmoo-uploads.s3.');
    }
    if (postData.link && !isValidUrl(postData.link)) {
        throw new Error('Invalid link: must be a valid URL.');
    }
    return true;
}

interface AuthResponse {
    message: string;
    token: string;
    user: {
        email: string;
        username: string;
        bio?: string;
        profileImageUrl?: string;
        showEmail?: boolean;
        showLocation?: boolean;
        youtubeUrl?: string;
        xUrl?: string;
        messengerUrl?: string;
        instagramUrl?: string;
        tikTokUrl?: string;
        preferredLocation?: {
            name: string;
            lat: number;
            lng: number;
            zoom?: number;
            bounds?: { north: number; east: number; south: number; west: number };
            locationType?: string;
        } | null;
        lastUsernameChange?: number;
        profileViews?: number;
    };
    usernameError?: string;
    success?: boolean;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const result = await handleResponse<AuthResponse>(response);
    console.log('api.ts: register response:', JSON.stringify(result, null, 2));
    return result;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const result = await handleResponse<AuthResponse>(response);
    console.log('api.ts: login response:', JSON.stringify(result, null, 2));
    return result;
}

export async function getUser(token: string): Promise<AuthResponse['user']> {
    if (!token) {
        throw new Error('No token provided for fetching current user profile');
    }
    const url = `${PUBLIC_API_BASE_URL}/api/auth/me`;
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_currentUserProfile');
    const data = await handleResponse<{ user: AuthResponse['user'] }>(response);
    console.log('api.ts: getUser response:', JSON.stringify(data, null, 2));
    return data.user;
}

export async function getUserProfileByUsername(username: string, token: string, bypassCache: boolean = false): Promise<AuthResponse['user']> {
    if (!token) {
        throw new Error('No token provided for fetching other user profile');
    }
    const url = `${PUBLIC_API_BASE_URL}/api/profile/${encodeURIComponent(username)}${bypassCache ? `?_cb=${Date.now()}` : ''}`;
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const cacheKey = bypassCache ? '' : token + '_otherUserProfile_' + username;
    
    console.log(`api.ts: getUserProfileByUsername requesting URL: ${url}`);
    console.log(`api.ts: getUserProfileByUsername using token: ${tokenToUse ? 'Yes (' + tokenToUse.substring(0, 10) + '...)' : 'No'}`);
    
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey, !bypassCache); // Don't use cache if bypassing
    
    console.log(`api.ts: getUserProfileByUsername response status: ${response.status}`);
    
    const data = await handleResponse<{ user: AuthResponse['user'] }>(response);
    console.log(`api.ts: getUserProfileByUsername response for ${username}:`, JSON.stringify(data, null, 2));
    
    // Extract user from response and ensure email is available for future API calls
    const user = data.user;
    if (user && user.email) {
        // Store the email-username mapping for future use
        console.log(`api.ts: Stored email-username mapping: ${user.email} -> ${user.username}`);
    }
    
    return user;
}

export async function getUserProfileByUserUID(userUID: string, token: string, bypassCache: boolean = false): Promise<AuthResponse['user']> {
    if (!token) {
        throw new Error('No token provided for fetching user profile by userUID');
    }
    const url = `${PUBLIC_API_BASE_URL}/api/profile-uid/${encodeURIComponent(userUID)}${bypassCache ? `?_cb=${Date.now()}` : ''}`;
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const cacheKey = bypassCache ? '' : token + '_userProfileByUID_' + userUID;
    
    console.log(`api.ts: getUserProfileByUserUID requesting URL: ${url}`);
    
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey, !bypassCache);
    
    const data = await handleResponse<{ user: AuthResponse['user'] }>(response);
    console.log(`api.ts: getUserProfileByUserUID response for ${userUID}:`, JSON.stringify(data, null, 2));
    
    const user = data.user;
    return user;
}

export async function getUserProfileByEmail(email: string, token: string, bypassCache: boolean = false): Promise<AuthResponse['user']> {
    if (!token) {
        throw new Error('No token provided for fetching user profile by email');
    }
    const url = `${PUBLIC_API_BASE_URL}/api/users/email/${encodeURIComponent(email)}${bypassCache ? `?_cb=${Date.now()}` : ''}`;
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const cacheKey = bypassCache ? '' : token + '_userProfileByEmail_' + email;
    
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey, !bypassCache);
    
    const data = await handleResponse<AuthResponse['user']>(response);
    console.log(`api.ts: getUserProfileByEmail response for ${email}:`, JSON.stringify(data, null, 2));
    return data;
}

export async function updateProfile(updates: any, token: string): Promise<AuthResponse> {
    if (!token) {
        throw new Error('No token provided for updating profile');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(updates)
    });
    const result = await handleResponse<AuthResponse>(response);
    console.log('api.ts: updateProfile response:', JSON.stringify(result, null, 2));
    clearCache(token + '_currentUserProfile');
    return result;
}

// Post and Comment types imported at the top of the file

export async function starComment(postId: string, commentId: string, token: string): Promise<{ message: string }>{
    if (!token) throw new Error('No token found for starring comment');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/comments/${postId}/${commentId}/star`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ message: string }>(response);
}

export async function unstarComment(postId: string, commentId: string, token: string): Promise<{ message: string }>{
    if (!token) throw new Error('No token found for unstarring comment');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/comments/${postId}/${commentId}/star`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ message: string }>(response);
}

export async function fetchCommentStarStatus(postId: string, commentId: string, token: string): Promise<{ isStarred: boolean; starCount: number }>{
    if (!token) throw new Error('No token found for fetching comment star status');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/comments/${postId}/${commentId}/star`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ isStarred: boolean; starCount: number }>(response);
}

export async function createPost(postData: Omit<Post, 'id' | 'userId' | 'username' | 'createdAt'> & {
    title?: string;
    details?: string;
    location: {
        name: string;
        lat: number;
        lng: number;
        zoom?: number | null;
        bounds?: { north: number; east: number; south: number; west: number } | null;
        locationType?: string;
    };
}, token: string): Promise<{ message: string; post: Post }> {
    if (!token) {
        throw new Error('No token found for creating post');
    }
    try {
        validatePostData(postData);
        const backendPostData = {
            ...postData,
            title: postData.headline?.trim() || undefined,
            details: postData.content,
            mediaUrl: postData.mediaUrl,
            location: postData.location,
            hasExactLocation: postData.hasExactLocation
        };
        const tokenToUse = browser ? getTokenFromLocalStorage() : token;
        const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenToUse}`
            },
            body: JSON.stringify(backendPostData)
        });
        const result = await handleResponse<{ message: string; post: Post }>(response);
        console.log('api.ts: createPost response:', JSON.stringify(result, null, 2));
        
        // Clear all posts cache entries to ensure the posts page refreshes
        clearCache('_posts_');
        clearCache(token + '_userPosts');
        return result;
    } catch (error) {
        console.error('api.ts: createPost error:', error.message);
        throw error;
    }
}

/**
 * Flexible fetchPosts – supports both box search and geohash/radius modes.
 * Only includes parameters that are defined and relevant.
 */
export async function fetchPosts(
    params: {
        lat?: number;
        lng?: number;
        locationType: string;
        precision?: number;
        search?: string;
        fenceName?: string;
        minLat?: number;
        maxLat?: number;
        minLng?: number;
        maxLng?: number;
    },
    token: string
): Promise<Post[]> {
    if (!token) {
        throw new Error('No token found for fetching posts');
    }
    // Build base URL
    const url = new URL(`${PUBLIC_API_BASE_URL}/api/posts`);
    // Only add defined params
    Object.entries(params).forEach(([key, val]) => {
        if (
            val !== undefined &&
            val !== null &&
            val !== '' &&
            // Avoid sending NaN as a param (can happen if user passes a computed number)
            !(typeof val === "number" && isNaN(val))
        ) {
            url.searchParams.append(key, String(val));
        }
    });

    // Logging
    console.log(`api.ts: Fetching posts with URL: ${url.toString()}`);

    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    // Cache key can include all present params
    const cacheKey = token + '_posts_' + url.searchParams.toString();

    const response = await cachedFetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey);

    const posts = await handleResponse<Post[]>(response);
    console.log(`api.ts: Posts fetched:`, JSON.stringify(posts, null, 2));
    return posts;
}


export async function fetchPostsCount(params: { minLat: number; maxLat: number; minLng: number; maxLng: number }, token: string): Promise<number> {
    if (!token) throw new Error('No token found for fetching posts count');
    const url = new URL(`${PUBLIC_API_BASE_URL}/api/posts/count`);
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && !isNaN(Number(val))) {
            url.searchParams.append(key, String(val));
        }
    });
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const data = await response.json();
    if (typeof data.count === "number") return data.count;
    throw new Error('Failed to fetch posts count');
}

export async function fetchPostById(postId: string, token: string): Promise<Post> {
    if (!token) {
        throw new Error('No token found for fetching post by ID');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const url = `${PUBLIC_API_BASE_URL}/api/posts/${postId}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const post = await handleResponse<Post>(response);
    return post;
}

// --- Featured Posts Helpers ---

export async function createPayPalOrder(
  postId: string,
  type: 'location' | 'search',
  duration: string,
  token: string
): Promise<{ id: string }> {
  if (!token) throw new Error('No token found for creating PayPal order');
  const tokenToUse = browser ? getTokenFromLocalStorage() : token;
  const response = await fetch(`${PUBLIC_API_BASE_URL}/api/paypal/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenToUse}`,
      'Accept': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ postId, type, duration })
  });
  return handleResponse<{ id: string }>(response);
}

export async function capturePayPalOrder(
  orderID: string,
  token: string
): Promise<{ id: string; status: string }> {
  if (!token) throw new Error('No token found for capturing PayPal order');
  const tokenToUse = browser ? getTokenFromLocalStorage() : token;
  const response = await fetch(`${PUBLIC_API_BASE_URL}/api/paypal/capture-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenToUse}`,
      'Accept': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ orderID })
  });
  return handleResponse<{ id: string; status: string }>(response);
}

export async function featurePost(
    postId: string,
    type: 'location' | 'search',
    duration: string,
    paymentId: string,
    token: string
    ): Promise<{ message: string; featuredUntil: number }> {
    if (!token) throw new Error('No token found for featuring post');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/featured`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenToUse}`,
        'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ postId, type, duration, paymentId }) // must match backend keys
    });
    return handleResponse<{ message: string; featuredUntil: number }>(response);
}
export async function fetchMyFeaturedPosts(token: string): Promise<{ featuredPosts: any[] }> {
    if (!token) throw new Error('No token found for fetching featured posts');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/featured/mine`, {
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    return handleResponse<{ featuredPosts: any[] }>(response);
}

export async function fetchFeaturedPostsOfUser(username: string, token: string): Promise<{ featuredPosts: any[] }> {
    if (!token) throw new Error('No token found for fetching featured posts of user');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/featured/user/${encodeURIComponent(username)}`, {
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    return handleResponse<{ featuredPosts: any[] }>(response);
}

export async function setFeaturedVisibility(
    showFeaturedTo: 'always' | 'connected' | 'buddies' | 'never',
    token: string
    ): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for setting featured post visibility');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ showFeaturedTo })
    });
    return handleResponse<{ message: string }>(response);
}

export async function removeFeatureFromPost(postId: string, featureType: 'location' | 'search', token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for removing feature');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/featured`, {
        method: 'DELETE',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ postId, featureType })
    });
    return handleResponse<{ message: string }>(response);
}

export async function getFeaturedPosts(token: string): Promise<{ featuredPosts: any[] }> {
    if (!token) throw new Error("No token provided");
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/featured/mine`, {
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    
    try {
        const data = await handleResponse<any>(response);
        // Ensure we always return the expected structure
        if (!data || typeof data !== 'object') {
            console.warn('getFeaturedPosts: Unexpected response format', data);
            return { featuredPosts: [] };
        }
        
        // Normalize the response to always have a featuredPosts array
        if (!data.featuredPosts || !Array.isArray(data.featuredPosts)) {
            console.warn('getFeaturedPosts: Response missing featuredPosts array', data);
            return { featuredPosts: [] };
        }
        
        return { featuredPosts: data.featuredPosts };
    } catch (error) {
        console.error('Error in getFeaturedPosts:', error);
        // Return empty array on error
        return { featuredPosts: [] };
    }
}

export async function incrementPostView(postId: string, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for incrementing post view');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts/${postId}/view`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    const result = await handleResponse<{ message: string }>(response);
    return result;
}

export async function incrementPostClick(postId: string, token: string): Promise<{ message: string }> {
    if (!token) {
        throw new Error('No token found for incrementing post click');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts/${postId}/click`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<{ message: string }>(response);
    console.log('api.ts: incrementPostClick response:', JSON.stringify(result, null, 2));
    return result;
}

export async function createComment(
    commentData: { postId: string; content: string; parentCommentId?: string },
    token: string
): Promise<{ message: string; comment: Comment }> {
    if (!token) {
        throw new Error('No token found for creating a comment');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(commentData)
    });
    const result = await handleResponse<{ message: string; comment: Comment }>(response);
    console.log('api.ts: createComment response:', JSON.stringify(result, null, 2));
    clearCache(`comments_for_post_${commentData.postId}`);
    if (commentData.parentCommentId) {
        clearCache(`replies_for_comment_${commentData.parentCommentId}`);
    }
    return result;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
    const url = `${PUBLIC_API_BASE_URL}/api/comments/${postId}`;
    const tokenToUse = browser ? getTokenFromLocalStorage() : null;
    const cacheKey = `comments_for_post_${postId}`;
    const response = await cachedFetch(url, {
        headers: tokenToUse ? { 'Authorization': `Bearer ${tokenToUse}` } : {}
    }, cacheKey);
    const data = await handleResponse<any>(response);
    let comments: Comment[] = [];
    if (Array.isArray(data)) {
        comments = data;
    } else if ('comments' in data && Array.isArray(data.comments)) {
        comments = data.comments;
    }
    console.log(`api.ts: fetchComments for post ${postId}:`, JSON.stringify(comments, null, 2));
    return comments;
}

export async function fetchReplies(postId: string, parentCommentId: string): Promise<Comment[]> {
    const url = `${PUBLIC_API_BASE_URL}/api/comments/${postId}/${parentCommentId}/replies`;  // Fixed URL parameter order
    const tokenToUse = browser ? getTokenFromLocalStorage() : null;
    const cacheKey = `replies_for_comment_${parentCommentId}`;
    const response = await cachedFetch(url, {
        headers: tokenToUse ? { 'Authorization': `Bearer ${tokenToUse}` } : {}
    }, cacheKey);
    const data = await handleResponse<{ replies: Comment[] }>(response);
    console.log(`api.ts: fetchReplies for comment ${parentCommentId}:`, JSON.stringify(data.replies, null, 2));
    return data.replies;
}

export async function deleteComment(postId: string, commentId: string, token: string): Promise<{ message: string }> {
    if (!token) {
        throw new Error('No token found for deleting a comment');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/comments/${postId}/${commentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${tokenToUse}`
        }
    });
    const result = await handleResponse<{ message: string }>(response);
    console.log('api.ts: deleteComment response:', JSON.stringify(result, null, 2));
    clearCache(`comments_for_post_${postId}`);
    return result;
}

export async function getUserPosts(token: string, userUID?: string): Promise<Post[]> {
    if (!token) {
        throw new Error('No token found for fetching user posts');
    }
    // Use /api/user/posts for own posts (no userUID) or /api/users/{userUID}/posts for others
    const url = userUID ? 
        `${PUBLIC_API_BASE_URL}/api/users/${encodeURIComponent(userUID)}/posts` : 
        `${PUBLIC_API_BASE_URL}/api/user/posts`;
    console.log(`api.ts: Fetching user posts with URL: ${url}`);
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_userPosts' + (userUID ? '_' + userUID : ''));
    const posts = await handleResponse<Post[]>(response);
    console.log(`api.ts: User posts fetched:`, JSON.stringify(posts, null, 2));
    return posts;
}

export async function getUserPostsByUserUID(userUID: string, token: string): Promise<Post[]> {
    if (!token) {
        throw new Error('No token found for fetching user posts by userUID');
    }
    const url = `${PUBLIC_API_BASE_URL}/api/users/${encodeURIComponent(userUID)}/posts`;
    console.log(`api.ts: Fetching posts for userUID ${userUID} with URL: ${url}`);
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_userPostsByUserUID_' + userUID);
    
    const data = await handleResponse<{ posts: Post[], count: number, user: { userUID: string, email: string } }>(response);
    console.log(`api.ts: Posts for userUID ${userUID} fetched:`, JSON.stringify(data, null, 2));
    return data.posts;
}

export async function uploadFile(file: File, token: string) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await axios.post('/api/upload', formData, {
            baseURL: browser ? '' : 'http://localhost:5173',
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('api.ts: File upload response:', response.data);
        return response.data;
    } catch (error) {
        console.error('api.ts: File upload error:', error.message);
        throw error;
    }
}

export async function deletePost(postId: string, token: string): Promise<{ message: string }> {
    if (!token) {
        throw new Error('No token found for deleting post');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<{ message: string }>(response);
    console.log('api.ts: deletePost response:', JSON.stringify(result, null, 2));
    clearCache(token + '_userPosts');
    return result;
}

// Hide a post for the current user
export async function hidePost(postId: string, token: string): Promise<{ message: string }>{
    if (!token) throw new Error('No token found for hide post');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts/${postId}/hide`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ message: string }>(response);
}

export async function isPostHidden(postId: string, token: string): Promise<{ hidden: boolean }>{
    if (!token) throw new Error('No token found for hidden check');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/posts/${postId}/hidden`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ hidden: boolean }>(response);
}

export async function setUserLocation(locationData: { name: string; lat: number; lng: number; zoom: number; bounds: { north: number; east: number; south: number; west: number } }, token: string): Promise<{ success: boolean; message: string; preferredLocation: any }> {
    if (!token) {
        throw new Error('No token found for setting user location');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/user/location`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(locationData)
    });
    const result = await handleResponse<{ success: boolean; message: string; preferredLocation: any }>(response);
    console.log('api.ts: setUserLocation response:', JSON.stringify(result, null, 2));
    return result;
}

export async function getUserLocationsCount(token: string): Promise<{ count: number }> {
    if (!token) {
        throw new Error('No token found for fetching location count');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/user/locations/count`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_userLocationsCount');
    const result = await handleResponse<{ count: number }>(response);
    console.log('api.ts: getUserLocationsCount response:', JSON.stringify(result, null, 2));
    return result;
}

export async function incrementProfileView(userUID: string, token: string): Promise<{ message: string; views: number }> {
    if (!token) {
        throw new Error('No token found for incrementing profile view');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/users/views/${encodeURIComponent(userUID)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        }
    });
    const result = await handleResponse<{ message: string; views: number }>(response);
    console.log('api.ts: incrementProfileView response:', JSON.stringify(result, null, 2));
    return result;
}

export async function checkUsernameAvailable(username: string, token: string): Promise<{ available: boolean; message: string }> {
    if (!token) throw new Error('No token found for checking username availability');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/username/check?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to check username');
    }
    return response.json();
}

export async function getProfileViews(userUID: string, token: string): Promise<{ views: number }> {
    if (!token) {
        throw new Error('No token found for fetching profile views');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/users/views?userUID=${encodeURIComponent(userUID)}`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_profileViews_' + userUID);
    const result = await handleResponse<{ views: number }>(response);
    console.log('api.ts: getProfileViews response:', JSON.stringify(result, null, 2));
    return result;
}

/**
 * Star (favorite) a post for the authenticated user.
 */
export async function starPost(postId: string, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for starring post');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/starred`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ postId })
    });
    return handleResponse<{ message: string }>(response);
}

/**
 * Unstar (remove favorite) a post for the authenticated user.
 */
export async function unstarPost(postId: string, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for unstarring post');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/starred`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ postId })
    });
    return handleResponse<{ message: string }>(response);
}

/**
 * Get all postIds starred by the authenticated user.
 */
export async function fetchStarredPosts(token: string): Promise<{ posts: any[] }> {
    if (!token) throw new Error('No token found for fetching starred posts');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/starred`, {
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    
    try {
        const data = await handleResponse<any>(response);
        // Ensure we always return the expected structure
        if (!data || typeof data !== 'object') {
            console.warn('fetchStarredPosts: Unexpected response format', data);
            return { posts: [] };
        }
        
        // Normalize the response to always have a posts array
        if (!data.posts || !Array.isArray(data.posts)) {
            console.warn('fetchStarredPosts: Response missing posts array', data);
            return { posts: [] };
        }
        
        return { posts: data.posts };
    } catch (error) {
        console.error('Error in fetchStarredPosts:', error);
        // Return empty array on error
        return { posts: [] };
    }
}

/**
 * Check if a specific post is starred by the authenticated user.
 */
export async function isPostStarred(postId: string, token: string): Promise<{ isStarred: boolean }> {
    if (!token) throw new Error('No token found for checking starred post');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/starred/${postId}`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ isStarred: boolean }>(response);
}

/**
 * Get the total number of stars for a specific post.
 */
export async function getPostStarCount(postId: string, token: string): Promise<{ starCount: number }> {
    if (!token) throw new Error('No token found for getting post star count');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/starred/${postId}/count`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    return handleResponse<{ starCount: number }>(response);
}

/*
export async function updatePostRating(postId: string, rating: number, token: string) {
    // Clamp and coerce rating to an integer 1-5
    let safeRating = Number.isFinite(rating) ? Math.round(rating) : 1;
    safeRating = Math.max(1, Math.min(5, safeRating));
    console.log("api.ts: updatePostRating payload:", { stars: safeRating });
    const res = await fetch(`${BASE_URL}/posts/${postId}/stars`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stars: safeRating })
    });

    if (!res.ok) {
        throw new Error(`API call failed with status: ${res.status}`);
    }

    return res.json();
}

export async function updatePostMood(postId: string, mood: number, token: string) {
    // Clamp and coerce mood to an integer 0-12 (safe for your moods array)
    let safeMood = Number.isFinite(mood) ? Math.round(mood) : 6;
    safeMood = Math.max(0, Math.min(12, safeMood));
    console.log("api.ts: updatePostMood payload:", { mood: safeMood });
    const res = await fetch(`${BASE_URL}/posts/${postId}/mood`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mood: safeMood })
    });

    if (!res.ok) {
        throw new Error(`API call failed with status: ${res.status}`);
    }

    return res.json();
}
*/

export async function getConnectionStatus(emailOrUserUID: string, token: string, bypassCache: boolean = false): Promise<{ status: 'none' | 'connected' | 'buddies' | 'connect_back' | 'self'; mutual: boolean; canMessage: boolean; isBuddy: boolean }> {
    if (!token) {
        throw new Error('No token found for fetching connection status');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    // Determine if this is an email or userUID (prefer userUID)
    const isEmail = emailOrUserUID.includes('@');
    const paramName = isEmail ? 'email' : 'userUID';
    
    // Add cache-busting parameter if needed
    const url = `${PUBLIC_API_BASE_URL}/api/connections/status?${paramName}=${encodeURIComponent(emailOrUserUID)}${bypassCache ? `&_cb=${Date.now()}` : ''}`;
    const cacheKey = bypassCache ? '' : token + '_connectionStatus_' + emailOrUserUID;
    
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey, !bypassCache); // Don't use cache if bypassing
    
    const result = await handleResponse<{ status: 'none' | 'connected' | 'buddies' | 'connect_back' | 'self'; mutual: boolean }>(response);
    console.log('api.ts: getConnectionStatus response:', JSON.stringify(result, null, 2));
    return result;
}

export async function createConnection(emailOrUserUID: string, token: string): Promise<{ message: string }> {
    if (!token) {
        throw new Error('No token found for creating connection');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    // Determine if this is an email or userUID (prefer userUID)
    const isEmail = emailOrUserUID.includes('@');
    const payload = isEmail ? { email: emailOrUserUID } : { userUID: emailOrUserUID };
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/connections`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(payload)
    });
    const result = await handleResponse<{ message: string }>(response);
    console.log('api.ts: createConnection response:', JSON.stringify(result, null, 2));
    return result;
}

// Buddy Request API Functions
export async function sendBuddyRequest(userUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token provided for sending buddy request');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/connections/buddy-request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ userUID })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: sendBuddyRequest response:', JSON.stringify(result, null, 2));
    return result;
}

export async function acceptBuddyRequest(requesterUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token provided for accepting buddy request');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/connections/buddy-request/accept`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ requesterUID })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: acceptBuddyRequest response:', JSON.stringify(result, null, 2));
    return result;
}

export async function rejectBuddyRequest(requesterUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token provided for rejecting buddy request');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/connections/buddy-request/reject`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ requesterUID })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: rejectBuddyRequest response:', JSON.stringify(result, null, 2));
    return result;
}

export async function deleteConnection(emailOrUserUID: string, token: string): Promise<{ message: string }> {
    if (!token) {
        throw new Error('No token found for deleting connection');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    // Determine if this is an email or userUID (prefer userUID)
    const isEmail = emailOrUserUID.includes('@');
    const payload = isEmail ? { email: emailOrUserUID } : { userUID: emailOrUserUID };
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/connections`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(payload)
    });
    const result = await handleResponse<{ message: string }>(response);
    console.log('api.ts: deleteConnection response:', JSON.stringify(result, null, 2));
    return result;
}

export async function sendMessage(receiverEmail: string, messageContent: string, conversationId: string | null = null, postId: string | null = null, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for sending message');
    }
    if (!receiverEmail || !messageContent) {
        throw new Error('Receiver email and message content are required.');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const payload: any = { receiverEmail, messageContent };
    if (conversationId) payload.conversationId = conversationId;
    if (postId) payload.postId = postId;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(payload)
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: sendMessage response:', JSON.stringify(result, null, 2));
    return result;
}

export async function fetchMessages(conversationId: string | null = null, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for fetching messages');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    let url = `${PUBLIC_API_BASE_URL}/api/messages`;
    let cacheKey = token + '_allConversations';
    if (conversationId) {
        url += `?conversationId=${encodeURIComponent(conversationId)}`;
        cacheKey = token + '_conversation_' + conversationId;
    }
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey);
    const result = await handleResponse<any>(response);
    console.log('api.ts: fetchMessages response:', JSON.stringify(result, null, 2));
    return result;
}

export async function fetchNotifications(readStatus: boolean | undefined = undefined, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for fetching notifications');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    let url = `${PUBLIC_API_BASE_URL}/api/notifications`;
    let cacheKey = token + '_notifications_all';
    if (readStatus !== undefined) {
        url += `?readStatus=${readStatus}`;
        cacheKey = token + '_notifications_readStatus_' + readStatus;
    }
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey);
    const result = await handleResponse<any>(response);
    console.log('api.ts: fetchNotifications response:', JSON.stringify(result, null, 2));
    return result;
}

export async function markNotificationAsRead(notificationId: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for marking notification as read');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: markNotificationAsRead response:', JSON.stringify(result, null, 2));
    return result;
}

export async function deleteNotification(notificationId: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for deleting notification');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: deleteNotification response:', JSON.stringify(result, null, 2));
    return result;
}

export async function markAllNotificationsAsRead(token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for marking all notifications as read');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: markAllNotificationsAsRead response:', JSON.stringify(result, null, 2));
    return result;
}

// New Column-based Notification API Functions

export async function fetchNotificationsByColumn(column: string, token: string, options: { limit?: number, includeGrouped?: boolean } = {}): Promise<any> {
    if (!token) {
        throw new Error('No token found for fetching column notifications');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const { limit = 30, includeGrouped = true } = options;
    
    const params = new URLSearchParams({
        limit: limit.toString(),
        includeGrouped: includeGrouped.toString()
    });
    
    const url = `${PUBLIC_API_BASE_URL}/api/notifications/column/${column}?${params}`;
    const cacheKey = `${token}_column_${column}_${limit}_${includeGrouped}`;
    
    const response = await cachedFetch(url, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey);
    const result = await handleResponse<any>(response);
    console.log(`api.ts: fetchNotificationsByColumn(${column}) response:`, JSON.stringify(result, null, 2));
    return result;
}

export async function fetchNotificationColumnCounts(token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for fetching column counts');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const cacheKey = `${token}_column_counts`;
    
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/notifications/column-counts`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, cacheKey);
    const result = await handleResponse<any>(response);
    console.log('api.ts: fetchNotificationColumnCounts response:', JSON.stringify(result, null, 2));
    return result;
}

export async function markColumnAsOpened(column: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for marking column as opened');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/notifications/column/${column}/opened`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<any>(response);
    console.log(`api.ts: markColumnAsOpened(${column}) response:`, JSON.stringify(result, null, 2));
    return result;
}

export async function refreshNotificationColumn(column: string, token: string): Promise<any> {
    // Clear cache for this column and fetch fresh data
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const cachePattern = `${token}_column_${column}`;
    
    // Clear related cache entries
    if (browser && window.localStorage) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes(cachePattern)) {
                localStorage.removeItem(key);
            }
        });
    }
    
    // Fetch fresh data
    return await fetchNotificationsByColumn(column, token);
}

// Favorites API Functions
export async function addUserToFavorites(userEmail: string, userUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for adding user to favorites');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/users`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userEmail, userUID })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: addUserToFavorites response:', JSON.stringify(result, null, 2));
    return result;
}

export async function removeUserFromFavorites(userEmail: string, userUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for removing user from favorites');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/users`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userEmail, userUID })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: removeUserFromFavorites response:', JSON.stringify(result, null, 2));
    return result;
}

export async function checkUserFavoriteStatus(userEmail: string, userUID: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for checking favorite status');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const params = new URLSearchParams();
    if (userEmail) params.append('userEmail', userEmail);
    if (userUID) params.append('userUID', userUID);
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/users/check?${params}`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: checkUserFavoriteStatus response:', JSON.stringify(result, null, 2));
    return result;
}

// Welcome Notification API Function
export async function createWelcomeNotification(username: string, token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for creating welcome notification');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/notifications/welcome`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
    });
    const result = await handleResponse<any>(response);
    console.log('api.ts: createWelcomeNotification response:', JSON.stringify(result, null, 2));
    return result;
}

export async function fetchNotificationCounts(token: string): Promise<any> {
    if (!token) {
        throw new Error('No token found for fetching notification counts');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/notifications/count`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_notification_counts');
    const result = await handleResponse<any>(response);
    console.log('api.ts: fetchNotificationCounts response:', JSON.stringify(result, null, 2));
    return result;
}

export async function fetchWikipediaPreview(title: string): Promise<any> {
    const res = await fetch(`/api/wiki-preview?title=${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error('Failed to fetch Wikipedia preview');
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return {
        title: page.title,
        extract: page.extract,
        thumbnail: page?.thumbnail?.source,
        pageid: page.pageid,
    };
}

export async function fetchUrlPreview(url: string, token: string): Promise<{ title: string; description: string; image: string; url: string } | null> {
    if (!token) {
        throw new Error('No token found for fetching URL preview');
    }
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/preview-url?url=${encodeURIComponent(url)}`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    const result = await handleResponse<{ title: string; description: string; image: string; url: string }>(response);
    console.log('api.ts: fetchUrlPreview response:', JSON.stringify(result, null, 2));
    return result;
}

/**
 * Report a post for inappropriate content or other issues
 * @param postId The ID of the post to report
 * @param reason The reason for the report (spam, inappropriate, scam, other)
 * @param details Additional details about the report
 * @param token Auth token
 */
export async function reportPost(postId: string, reason: string, details: string, token: string): Promise<{ reportId: string }> {
    if (!token) {
        throw new Error('No token found for reporting post');
    }
    
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
            postId,
            reason,
            details
        })
    });
    
    const result = await handleResponse<{ message: string; reportId: string }>(response);
    console.log('api.ts: reportPost response:', JSON.stringify(result, null, 2));
    return { reportId: result.reportId };
}

/**
 * Submit a help/feedback message
 * @param message The help or feedback message
 * @param screenshotUrl Optional screenshot URL
 * @param token Auth token
 */
export async function submitHelpMessage(message: string, screenshotUrl: string | null, token: string): Promise<{ messageId: string }> {
    if (!token) {
        throw new Error('No token found for submitting help message');
    }
    
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/help-messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
            message,
            screenshotUrl
        })
    });
    
    const result = await handleResponse<{ message: string; messageId: string }>(response);
    console.log('api.ts: submitHelpMessage response:', JSON.stringify(result, null, 2));
    return { messageId: result.messageId };
}

// Type definitions moved to src/lib/types/posts.ts

/**
 * Favorites API - Profile favorites
 */
export async function addFavoriteProfile(profileData: { email: string; username: string; profileImageUrl: string }, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for adding favorite profile');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(profileData)
    });
    return handleResponse<{ message: string }>(response);
}

export async function removeFavoriteProfile(profileEmail: string, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for removing favorite profile');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/profiles/${encodeURIComponent(profileEmail)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${tokenToUse}`
        }
    });
    return handleResponse<{ message: string }>(response);
}

export async function getFavoritedProfiles(token: string): Promise<{ favoritedProfiles: any[] }> {
    if (!token) throw new Error('No token found for fetching favorited profiles');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/favorites/profiles`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_favoritedProfiles');
    return handleResponse<{ favoritedProfiles: any[] }>(response);
}

/**
 * Favorites API - Search favorites
 */
export async function addFavoriteSearch(searchData: { searchTerm: string; locationName: string; latitude: number; longitude: number }, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for adding favorite search');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/searches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(searchData)
    });
    return handleResponse<{ message: string }>(response);
}

export async function removeFavoriteSearch(searchTerm: string, locationName: string, token: string): Promise<{ message: string }> {
    if (!token) throw new Error('No token found for removing favorite search');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/favorites/searches`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ searchTerm, locationName })
    });
    return handleResponse<{ message: string }>(response);
}

export async function getFavoriteSearchTerms(token: string): Promise<{ favoriteSearches: any[] }> {
    if (!token) throw new Error('No token found for fetching favorite searches');
    const tokenToUse = browser ? getTokenFromLocalStorage() : token;
    const response = await cachedFetch(`${PUBLIC_API_BASE_URL}/api/favorites/searches`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
    }, token + '_favoriteSearches');
    return handleResponse<{ favoriteSearches: any[] }>(response);
}