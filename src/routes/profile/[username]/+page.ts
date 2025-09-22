import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
import * as api from '$lib/api';

export const load = async ({ params, fetch }: any) => {
    const username = params.username;
    
    console.log(`+page.ts: Full params object:`, params);
    console.log(`+page.ts: Extracted username:`, username);
    
    if (!username) {
        return {
            error: { status: 404, body: { message: 'Username not provided' } },
            profile: null,
            posts: [],
            profileViews: 0,
            connectionStatus: { status: 'none', mutual: false }
        };
    }

    try {
        // Get token from auth store or localStorage
        let token = '';
        if (browser) {
            const authData = get(auth);
            token = authData?.token || '';
            
            if (!token && localStorage.getItem('token')) {
                token = localStorage.getItem('token') || '';
            }
        }
        
        console.log(`+page.ts: Loading profile for username: ${username}`);
        console.log(`+page.ts: Token available: ${!!token}`);
        console.log(`+page.ts: Token length: ${token?.length || 0}`);



        // Fetch profile data using the proper API function
        let profileData;
        try {
            if (!token) {
                throw new Error('You must be logged in to view user profiles');
            }
            profileData = await api.getUserProfileByUsername(username, token);
        } catch (error: any) {
            console.error('Error fetching profile by username:', error);
            return {
                error: { 
                    status: error.message.includes('logged in') ? 401 : 404, 
                    body: { message: error.message || `Profile not found for username: ${username}` }
                },
                profile: null,
                posts: [],
                profileViews: 0,
                connectionStatus: { status: 'none', mutual: false }
            };
        }

        // Fetch user's posts using userUID endpoint
        let posts: any[] = [];
        try {
            if (profileData.userUID) {
                posts = await api.getUserPostsByUserUID(profileData.userUID, token);
            } else {
                console.warn('No userUID found for user profile, cannot fetch posts');
                posts = [];
            }
        } catch (err) {
            console.error('Error fetching user posts:', err);
            posts = [];
        }

        // Fetch connection status if user is logged in
        let connectionStatus = { status: 'none', mutual: false };
        if (token && (profileData.userUID || profileData.email)) {
            try {
                // Prefer userUID over email for connection status
                const identifier = profileData.userUID || profileData.email;
                console.log(`+page.ts: Fetching connection status for ${profileData.userUID ? 'userUID' : 'email'}: ${identifier}`);
                connectionStatus = await api.getConnectionStatus(identifier, token, true); // bypass cache for fresh data
                console.log(`+page.ts: Connection status response:`, connectionStatus);
            } catch (err) {
                console.error('Error fetching connection status:', err);
                // Fallback to default
                connectionStatus = { status: 'none', mutual: false };
            }
        }

        return {
            profile: profileData,
            posts,
            profileViews: profileData.profileViews || 0,
            connectionStatus,
            error: null
        };

    } catch (error) {
        console.error('Error loading profile page:', error);
        return {
            error: { status: 500, body: { message: 'Failed to load profile' } },
            profile: null,
            posts: [],
            profileViews: 0,
            connectionStatus: { status: 'none', mutual: false }
        };
    }
};
