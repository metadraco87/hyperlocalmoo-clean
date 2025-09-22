// src/routes/profile/[username]/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import * as api from '$lib/api.js'; // Ensure api is imported correctly
import { clearCache } from '$lib/cache.js'; // Import clearCache

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
    console.log('profile/[username]/+page.server.ts: locals.auth:', (locals as any).auth);
    const { username } = params;
    // Ensure username is clean (remove leading '@' if present)
    const targetUsernameClean = username.replace(/^@/, '');
    
    // 🔧 REDIRECT LOGIC: If viewing own username, redirect to /profile
    const authState = (locals as any).auth;
    console.log(`+page.server.ts: Auth state check:`, { 
        hasAuth: !!authState, 
        username: authState?.username, 
        target: targetUsernameClean 
    });
    
    if (authState?.username) {
        console.log(`+page.server.ts: Checking redirect - Current: ${authState.username}, Target: ${targetUsernameClean}`);
        if (authState.username.toLowerCase() === targetUsernameClean.toLowerCase()) {
            console.log(`+page.server.ts: Redirecting to /profile (own profile detected)`);
            throw redirect(302, '/profile');
        }
    }

    // Clear cache for this user's profile to ensure we get fresh data
    if ((locals as any).auth?.token) {
        await clearCache(`api/users/${targetUsernameClean}`);
    }

    let profile: any = null;
    let posts: any[] = [];
    let profileViews = 0;
    let connectionStatus = { status: 'none', mutual: false };
    let errorMessage = null;

    try {
        // 1. Fetch the user's profile by username
        try {
            const fetchedProfile = await api.getUserProfileByUsername(targetUsernameClean, (locals as any).auth?.token, true); // bypass cache
            console.log('profile/[username]/+page.server.ts: Fetched profile for', targetUsernameClean, ':', JSON.stringify(fetchedProfile, null, 2));

            if (!fetchedProfile || !fetchedProfile.email) {
                console.warn('profile/[username]/+page.server.ts: No profile or email found for username:', targetUsernameClean);
                throw new Error(`User ${targetUsernameClean} not found`);
            }
            
            // Ensure connections array exists
            if (!(fetchedProfile as any).connections) {
                (fetchedProfile as any).connections = [];
            }
            
            profile = fetchedProfile; // Assign the fetched profile
        } catch (profileError) {
            console.error(`profile/[username]/+page.server.ts: Error fetching profile for ${targetUsernameClean}:`, profileError);
            return {
                profile: null,
                posts: [],
                profileViews: 0,
                connectionStatus: { status: 'none', mutual: false },
                error: { 
                    status: 404, 
                    body: { message: `User ${targetUsernameClean} not found. They may have changed their username.` }
                }
            };
        }

        // 2. Fetch posts for this user using their userUID
        try {
            if (profile.userUID) {
                console.log(`profile/[username]/+page.server.ts: About to fetch posts for userUID: ${profile.userUID}, token exists: ${!!(locals as any).auth?.token}`);
                const fetchedPosts = await api.getUserPostsByUserUID(profile.userUID, (locals as any).auth?.token);
                posts = fetchedPosts || [];
                console.log(`profile/[username]/+page.server.ts: Fetched ${posts.length} posts for userUID ${profile.userUID}.`);
                console.log(`profile/[username]/+page.server.ts: Posts data:`, JSON.stringify(posts.slice(0, 2), null, 2));
            } else {
                console.warn(`profile/[username]/+page.server.ts: No userUID found for ${username}, cannot fetch posts.`);
            }
        } catch (postError: any) { // Add explicit type any for caught error
            console.error(`profile/[username]/+page.server.ts: Error fetching posts for ${username}:`, postError.message);
            console.error(`profile/[username]/+page.server.ts: Full error:`, postError);
            // Don't re-throw, just log and continue without posts
        }

        // Only proceed if we have a valid profile with email
        if (profile && profile.email) {
            // 3. Fetch profile views for this user
            try {
                const fetchedViews = await api.getProfileViews(profile.username, (locals as any).auth?.token);
                profileViews = fetchedViews.views;
                console.log(`profile/[username]/+page.server.ts: Fetched profile views for ${profile.username}: ${profileViews}.`);
            } catch (viewsError: any) { // Add explicit type any for caught error
                console.error(`profile/[username]/+page.server.ts: Error fetching profile views for ${profile.username}:`, viewsError.message);
                // Don't re-throw, just log and continue with 0 views
            }

            // 4. Fetch connection status if logged in and not viewing own profile
            if ((locals as any).auth?.isLoggedIn && (locals as any).auth?.email && profile.email !== (locals as any).auth.email) {
                try {
                    const statusResponse = await api.getConnectionStatus(profile.email, (locals as any).auth.token, true); // Force bypass cache
                    connectionStatus = statusResponse;
                    console.log(`profile/[username]/+page.server.ts: Fetched connection status for ${profile.email}:`, connectionStatus);
                } catch (connError: any) { // Add explicit type any for caught error
                    console.error(`profile/[username]/+page.server.ts: Error fetching connection status for ${profile.email}:`, connError.message);
                    // Don't re-throw, just log and keep default status
                }
            } else if ((locals as any).auth?.isLoggedIn && profile.email === (locals as any).auth.email) {
                connectionStatus.status = 'self'; // Explicitly set status to 'self' if it's the user's own profile
                console.log(`profile/[username]/+page.server.ts: Viewing own profile (${profile.email}).`);
            }
        } else {
            errorMessage = 'User profile email is missing, cannot fetch posts or views.';
            console.warn(errorMessage);
        }

        // Log important information for debugging
        console.log(`profile/[username]/+page.server.ts: Profile data details:
            username: ${profile.username},
            email: ${profile.email},
            connectionCount: ${profile.connectionCount || 0},
            buddyCount: ${profile.buddyCount || 0},
            connections array length: ${profile.connections ? profile.connections.length : 'no connections array'}`
        );

        return {
            profile: {
                email: profile.email,
                username: profile.username,
                userUID: profile.userUID,
                bio: profile.bio || '',
                profileImageUrl: profile.profileImageUrl || '',
                showEmail: profile.showEmail ?? true,
                showLocation: profile.showLocation ?? true,
                youtubeUrl: profile.youtubeUrl || '',
                xUrl: profile.xUrl || '',
                messengerUrl: profile.messengerUrl || '',
                instagramUrl: profile.instagramUrl || '',
                tikTokUrl: profile.tikTokUrl || '',
                preferredLocation: profile.preferredLocation || null,
                lastUsernameChange: profile.lastUsernameChange || 0, // Ensure this is passed
                profileViews: profileViews, // Pass the fetched profile views
                connections: profile.connections || [],
                connectionCount: profile.connectionCount || 0,
                buddyCount: profile.buddyCount || 0,
                showConnectionsTo: profile.showConnectionsTo || 'everyone', // Default to everyone if not set
                showFeaturedTo: profile.showFeaturedTo || 'everyone',
                showStarredTo: profile.showStarredTo || 'everyone',
                mood: profile.mood || 6
            },
            posts: posts, // Pass the fetched posts
            profileViews: profileViews, // Also pass profileViews separately if needed by the component's data prop
            connectionStatus: connectionStatus, // Pass the fetched connection status
            error: errorMessage ? { body: { message: errorMessage } } : null,
        };
    } catch (err: any) { // Add explicit type any for caught error
        console.error('profile/[username]/+page.server.ts: Error loading profile data:', err.message);
        throw error(500, `Failed to load profile for ${targetUsernameClean}. Please try again later.`);
    }
}