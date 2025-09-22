import { redirect } from '@sveltejs/kit';
import { invalidateSession, deleteSessionTokenCookie } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	if (event.locals.session) {
		await invalidateSession(event.locals.session.id);
		deleteSessionTokenCookie(event);
	}
	return redirect(302, '/');
}
