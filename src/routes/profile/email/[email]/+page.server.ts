// src/routes/profile/email/[email]/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import * as api from '$lib/api.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
    console.log('profile/email/[email]/+page.server.ts: locals.auth:', (locals as any).auth);
    const { email } = params;
    
    if (!email) {
        throw error(400, 'Email parameter is required');
    }

    try {
        // Try to get profile by email first
        const profile = await api.getUserProfileByEmail(decodeURIComponent(email), (locals as any).auth?.token);
        
        if (profile && profile.username) {
            // Redirect to the username-based profile page
            throw redirect(302, `/profile/${profile.username}`);
        } else {
            throw error(404, `User with email ${email} not found or has no username`);
        }
    } catch (err) {
        console.error('Error in email redirect:', err);
        throw error(500, 'Could not find user profile');
    }
}
