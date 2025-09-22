import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// Get posts with user information
	const posts = await db
		.select({
			id: table.post.id,
			content: table.post.content,
			location: table.post.location,
			createdAt: table.post.createdAt,
			user: {
				id: table.user.id,
				name: table.user.name,
				username: table.user.username,
				picture: table.user.picture
			}
		})
		.from(table.post)
		.innerJoin(table.user, eq(table.post.userId, table.user.id))
		.orderBy(desc(table.post.createdAt));

	return {
		posts,
		user: locals.user
	};
};
