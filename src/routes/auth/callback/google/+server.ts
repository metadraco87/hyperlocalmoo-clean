import { error, redirect } from '@sveltejs/kit';
import { google } from '$lib/server/oauth';
import {
	createUserFromGoogle,
	getUserByGoogleId,
	generateSessionToken,
	createSession,
	setSessionTokenCookie
} from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const storedState = event.cookies.get('oauth_state');

	if (!code || !state || !storedState || state !== storedState) {
		throw error(400, 'Invalid OAuth state');
	}

	try {
		const tokens = await google.validateAuthorizationCode(code, '');
		const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`
			}
		});

		if (!response.ok) {
			throw error(500, 'Failed to fetch user info from Google');
		}

		const googleUser = await response.json();

		// Check if user already exists
		let user = await getUserByGoogleId(googleUser.id);

		if (!user) {
			// Create new user
			const newUser = await createUserFromGoogle({
				id: googleUser.id,
				email: googleUser.email,
				name: googleUser.name,
				picture: googleUser.picture
			});
			user = { ...newUser, passwordHash: null };
		}

		// Create session
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, user.id);
		setSessionTokenCookie(event, sessionToken, session.expiresAt);

		// Clear OAuth state cookie
		event.cookies.delete('oauth_state', { path: '/' });

		return redirect(302, '/');
	} catch (err) {
		console.error('OAuth callback error:', err);
		throw error(500, 'Authentication failed');
	}
}
