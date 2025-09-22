import { redirect } from '@sveltejs/kit';
import { google, generateState } from '$lib/server/oauth';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const state = generateState();
	const url = google.createAuthorizationURL(state, '', ['openid', 'profile', 'email']);

	event.cookies.set('oauth_state', state, {
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	return redirect(302, url.toString());
}
