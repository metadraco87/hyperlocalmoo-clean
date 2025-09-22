import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { preferredLocation } from './preferredLocationStore.js';

const AUTH_TOKEN_KEY = 'token';
const USER_EMAIL_KEY = 'userEmail';
const USER_UID_KEY = 'userUID';

// Helper: Converts ISO string or number to millis
function toMillis(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

const initialState = {
    isLoggedIn: false,
    userUID: null,
    email: null,
    token: null,
    profileImageUrl: '',
    username: '',
    bio: '',
    lastUsernameChange: 0,
    showEmail: true,
    showLocation: true,
    youtubeUrl: '',
    xUrl: '',
    messengerUrl: '',
    instagramUrl: '',
    connections: [],
    isAdmin: false,
    isAuthLoaded: false
};

function createAuthStore() {
    const { subscribe, set, update } = writable({ ...initialState });

    const loadInitialAuth = async () => {
        if (!browser) {
            console.log('auth.js: Not in browser environment, skipping localStorage load.');
            update(state => ({ ...state, isAuthLoaded: true }));
            return;
        }

        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        const storedEmail = localStorage.getItem(USER_EMAIL_KEY);
        const storedUserUID = localStorage.getItem(USER_UID_KEY);

        console.log('auth.js: [loadInitialAuth] Checking localStorage:', {
            storedToken,
            storedEmail,
            storedUserUID,
            currentUrl: window.location.href
        });

        if (storedToken && storedEmail) {
            console.log('auth.js: Found token and userEmail in localStorage. Attempting to fetch profile...');
            try {
                const data = await fetchUserProfile(storedToken);
                update(state => ({ ...state, isAuthLoaded: true }));
                console.log('auth.js: Profile successfully loaded and auth store initialized.');
                return;
            } catch (error) {
                console.error('auth.js: Failed to load profile from localStorage:', error.message, 'Token:', storedToken, error);
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(USER_EMAIL_KEY);
                localStorage.removeItem(USER_UID_KEY);
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                set({ ...initialState, isAuthLoaded: true });
                return;
            }
        } else {
            console.log('auth.js: No token or userEmail found in localStorage. Checking for OAuth callback.');
            await handleOAuthCallback();
            update(state => ({ ...state, isAuthLoaded: true }));
        }
    };

    loadInitialAuth();

    async function login(email, password) {
        try {
            const response = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json();
            console.log('auth.js: Login response:', JSON.stringify(data, null, 2));

            const newState = {
                isLoggedIn: true,
                email: data.user.email,
                token: data.token,
                profileImageUrl: data.user.profileImageUrl || '',
                username: data.user.username || '',
                bio: data.user.bio || '',
                lastUsernameChange: toMillis(data.user.lastUsernameChange),
                showEmail: data.user.showEmail !== undefined ? data.user.showEmail : true,
                showLocation: data.user.showLocation !== undefined ? data.user.showLocation : true,
                youtubeUrl: data.user.youtubeUrl || '',
                xUrl: data.user.xUrl || '',
                messengerUrl: data.user.messengerUrl || '',
                instagramUrl: data.user.instagramUrl || '',
                connections: [],
                isAdmin: data.user.isAdmin || false,
                isAuthLoaded: true
            };

            set(newState);

            if (browser) {
                localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                localStorage.setItem(USER_EMAIL_KEY, data.user.email);
                localStorage.setItem(USER_UID_KEY, data.user.userUID);
                document.cookie = `token=${data.token}; path=/; max-age=3600; SameSite=Strict`;
                // Also set the auth cookie with email for server-side validation
                const authStateCookie = JSON.stringify({ email: data.user.email, userUID: data.user.userUID });
                document.cookie = `auth=${encodeURIComponent(authStateCookie)}; path=/; max-age=3600; SameSite=Strict`;
                console.log('auth.js: Stored token, userEmail, and userUID in localStorage and cookie after login:', { email: data.user.email, userUID: data.user.userUID, token: data.token ? 'Present' : 'Not found' });
                // Check if user already has a location in localStorage - prioritize local changes
                const existingLocation = localStorage.getItem('preferredLocation');
                console.log('🔍 AUTH STORE DEBUG:');
                console.log('🔍 Backend preferredLocation:', data.user.preferredLocation);
                console.log('🔍 localStorage preferredLocation:', existingLocation);
                
                if (existingLocation) {
                    console.log('✅ auth.js: Using existing localStorage location (user preference preserved)');
                } else if (data.user.preferredLocation) {
                    await preferredLocation.setAndPersist(data.user.preferredLocation);
                    console.log('✅ auth.js: Set preferredLocation from login response:', data.user.preferredLocation);
                }
            }

            return newState;
        } catch (error) {
            console.error('auth.js: Login error:', error.message);
            update(state => ({ ...state, isAuthLoaded: true }));
            throw error;
        }
    }

    async function fetchUserProfile(token) {
        try {
            console.log("auth.js: [fetchUserProfile] Calling /api/auth/me with token:", token);
            const response = await fetch('http://localhost:4000/api/auth/me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log("auth.js: [fetchUserProfile] /api/auth/me response status:", response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("auth.js: /api/auth/me error response body:", errorData);
                throw new Error(errorData.message || `Failed to fetch user profile: ${response.status}`);
            }

            const data = await response.json();
            console.log('auth.js: Fetch user profile response:', JSON.stringify(data, null, 2));

            // Convert all ISO timestamps to millis
            const user = data.user || {};
            const newState = {
                isLoggedIn: true,
                userUID: user.userUID,
                email: user.email,
                token,
                profileImageUrl: user.profileImageUrl || '',
                username: user.username || '',
                bio: user.bio || '',
                lastUsernameChange: toMillis(user.lastUsernameChange),
                showEmail: user.showEmail !== undefined ? user.showEmail : true,
                showLocation: user.showLocation !== undefined ? user.showLocation : true,
                youtubeUrl: user.youtubeUrl || '',
                xUrl: user.xUrl || '',
                messengerUrl: user.messengerUrl || '',
                instagramUrl: user.instagramUrl || '',
                connections: user.connections || [],
                isAdmin: user.isAdmin || false,
                isAuthLoaded: true
            };

            set(newState);

            if (browser) {
                localStorage.setItem(AUTH_TOKEN_KEY, token);
                localStorage.setItem(USER_EMAIL_KEY, user.email);
                localStorage.setItem(USER_UID_KEY, user.userUID);
                document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;
                // Also set the auth cookie with email for server-side validation
                const authStateCookie = JSON.stringify({ email: user.email, userUID: user.userUID });
                document.cookie = `auth=${encodeURIComponent(authStateCookie)}; path=/; max-age=3600; SameSite=Strict`;
                const localStorageLocation = localStorage.getItem('preferredLocation');
                const localStorageTimestamp = localStorage.getItem('preferredLocationTimestamp');
                
                if (localStorageLocation && localStorageLocation !== 'null' && localStorageTimestamp) {
                    const localTimestamp = parseInt(localStorageTimestamp);
                    const serverTimestamp = user.preferredLocationTimestamp || 0;
                    
                    if (localTimestamp > serverTimestamp) {
                        console.log('auth.js: localStorage location is newer than server, keeping localStorage version');
                        console.log('auth.js: Local timestamp:', localTimestamp, 'Server timestamp:', serverTimestamp);
                    } else if (user.preferredLocation) {
                        await preferredLocation.setAndPersist(user.preferredLocation);
                        console.log('auth.js: Server location is newer, updating from profile response:', user.preferredLocation);
                    }
                } else if (user.preferredLocation) {
                    await preferredLocation.setAndPersist(user.preferredLocation);
                    console.log('auth.js: No localStorage location, set from profile response:', user.preferredLocation);
                } else {
                    console.log('auth.js: No preferredLocation in profile response.');
                }
            }

            return newState;
        } catch (error) {
            console.error('auth.js: Fetch user profile error (likely /api/auth/me):', error.message, 'Token:', token, error);
            if (browser) {
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(USER_EMAIL_KEY);
                localStorage.removeItem(USER_UID_KEY);
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                set({ ...initialState, isAuthLoaded: true });
            }
            throw error;
        }
    }

    async function updateProfile(updates, token) {
        try {
            const response = await fetch('http://localhost:4000/api/users/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update profile: ${response.status}`);
            }

            const data = await response.json();
            console.log('auth.js: Update profile response:', JSON.stringify(data, null, 2));

            update(state => ({
                ...state,
                profileImageUrl: data.user.profileImageUrl || state.profileImageUrl,
                username: data.user.username || state.username,
                bio: data.user.bio || state.bio,
                lastUsernameChange: toMillis(data.user.lastUsernameChange),
                showEmail: data.user.showEmail !== undefined ? data.user.showEmail : state.showEmail,
                showLocation: data.user.showLocation !== undefined ? data.user.showLocation : state.showLocation,
                youtubeUrl: data.user.youtubeUrl || state.youtubeUrl,
                xUrl: data.user.xUrl || state.xUrl,
                messengerUrl: data.user.messengerUrl || state.messengerUrl,
                instagramUrl: data.user.instagramUrl || state.instagramUrl,
                isAdmin: data.user.isAdmin || false
            }));

            return data;
        } catch (error) {
            console.error('auth.js: Update profile error:', error.message, 'Token:', token, error);
            throw error;
        }
    }

    async function fetchConnections(token) {
        try {
            const response = await fetch('http://localhost:4000/api/connections/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                update(state => ({ ...state, connections: data }));
            } else {
                console.warn('auth.js: Failed to fetch connections:', response.status, 'Token:', token ? 'Present' : 'Not found');
            }
        } catch (error) {
            console.error('auth.js: Fetch connections error:', error.message, 'Token:', token, error);
        }
    }

    async function handleOAuthCallback() {
        if (!browser) return;
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const email = urlParams.get('email');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('auth.js: OAuth error:', error);
            window.history.replaceState({}, document.title, window.location.pathname);
            throw new Error('OAuth authentication failed');
        }
        
        if (token && email) {
            console.log('auth.js: Handling OAuth callback with token and email in URL.');
            try {
                const newState = await fetchUserProfile(token);
                localStorage.setItem(AUTH_TOKEN_KEY, token);
                localStorage.setItem(USER_EMAIL_KEY, decodeURIComponent(email));
                localStorage.setItem(USER_UID_KEY, newState.userUID);
                document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict`;
                // Also set the auth cookie with email for server-side validation
                const authStateCookie = JSON.stringify({ email: decodeURIComponent(email), userUID: newState.userUID });
                document.cookie = `auth=${encodeURIComponent(authStateCookie)}; path=/; max-age=3600; SameSite=Strict`;
                window.history.replaceState({}, document.title, window.location.pathname);
                return newState;
            } catch (error) {
                console.error('auth.js: OAuth callback processing error:', error.message, 'Token:', token, error);
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(USER_EMAIL_KEY);
                localStorage.removeItem(USER_UID_KEY);
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                set({ ...initialState, isAuthLoaded: true });
                throw error;
            }
        }
        return null;
    }

    function logout() {
        if (browser) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(USER_EMAIL_KEY);
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            console.log('auth.js: Cleared token, userEmail, and userUID from localStorage and cookie.');
        }
        set({ ...initialState, isAuthLoaded: true });
        preferredLocation.clearAndReset();
    }

    return {
        subscribe,
        login,
        logout,
        updateProfile,
        fetchUserProfile,
        fetchConnections,
        handleOAuthCallback,
        initialize: loadInitialAuth
    };
}

export const auth = createAuthStore();