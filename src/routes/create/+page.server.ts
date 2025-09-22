import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { generateUserId } from '$lib/server/auth';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/');
		}

		const data = await request.formData();
		const content = data.get('content');
		const location = data.get('location');

		if (!content || typeof content !== 'string') {
			return fail(400, { error: 'Content is required' });
		}

		if (content.length < 1) {
			return fail(400, { error: 'Content cannot be empty' });
		}

		if (content.length > 1000) {
			return fail(400, { error: 'Content must be less than 1000 characters' });
		}

		try {
			const postId = generateUserId(); // Reuse this function for generating IDs
			await db.insert(table.post).values({
				id: postId,
				userId: locals.user.id,
				content: content.trim(),
				location: location && typeof location === 'string' ? location.trim() || null : null,
				createdAt: new Date()
			});

			throw redirect(302, '/feed');
		} catch (error) {
			console.error('Error creating post:', error);
			return fail(500, { error: 'Failed to create post' });
		}
	}
};
