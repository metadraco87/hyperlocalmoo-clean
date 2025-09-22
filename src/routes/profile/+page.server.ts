import type { PageServerLoad } from './$types';
import * as api from '$lib/api';
import { redirect } from '@sveltejs/kit';
import type { Post } from '$lib/api';

// This cache is request-scoped, it will prevent re-fetching the same original post multiple times during a single page load.
const originalPostsCache = new Map<string, Post>();

async function fetchOriginalPost(originalPostId: string, token: string): Promise<Post | null> {
	if (originalPostsCache.has(originalPostId)) {
		return originalPostsCache.get(originalPostId)!;
	}

	try {
		// Fetch the original post directly from the API endpoint
		const response = await fetch(`${api.PUBLIC_API_BASE_URL}/api/posts/${originalPostId}`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});
		
		if (response.ok) {
			const originalPost = await response.json();
			originalPostsCache.set(originalPostId, originalPost);
			return originalPost;
		}
	} catch (error) {
		console.error(`Error fetching original post ${originalPostId}:`, error);
	}
	return null;
}

async function enhancePostsWithOriginals(posts: Post[], token: string): Promise<Post[]> {
	if (!posts) return [];
	return Promise.all(
		posts.map(async (post) => {
			if (post.isRepost && post.originalPostId) {
				const originalPost = await fetchOriginalPost(post.originalPostId, token);
				return {
					...post,
					originalPost: originalPost || undefined
				};
			}
			return post;
		})
	);
}

export const load: PageServerLoad = async ({ cookies, locals }) => {
	console.log('🔍 Main profile +page.server.ts: Starting load');
	console.log('🔍 Main profile locals.auth:', (locals as any).auth);
	
	const token = cookies.get('token');
	const authStateString = cookies.get('auth');

	if (!token || !authStateString) {
		throw redirect(307, '/login');
	}

	const authState = JSON.parse(authStateString);
	const email = authState.email;

	if (!email) {
		throw redirect(307, '/login');
	}

	try {
		// Clear the cache at the beginning of each server load
		originalPostsCache.clear();

		console.log('🔍 Main profile: About to call api.getUser with token');
		// Parallel fetch all initial data
		const [profileData, rawUserPosts, locationCount, starredPostsResult, featuredPostsResult] =
			await Promise.all([
				api.getUser(token),
				api.getUserPosts(token), // For logged-in user's own profile, use /api/users/posts without email
				api.getUserLocationsCount(token),
				api.fetchStarredPosts(token),
				api.getFeaturedPosts(token)
			]);
		
		console.log('🔍 Main profile: API calls completed. ProfileData connections:', {
			connectionCount: profileData?.connectionCount,
			connections: profileData?.connections,
			connectionsLength: profileData?.connections?.length
		});
		
		// Extract starred post IDs from the starredPosts result
		const starredPostIds = starredPostsResult?.posts ? 
			starredPostsResult.posts.map(post => post.id) : [];

		// Enhance posts with original post data
		const [userPosts, featuredPosts] = await Promise.all([
			enhancePostsWithOriginals(rawUserPosts, token),
			enhancePostsWithOriginals(featuredPostsResult.featuredPosts, token)
		]);

		return {
			profileData,
			userPosts,
			locationCount: locationCount || 0,
			starredPostIds: starredPostIds || [],
			featuredPosts,
			token: token,
			email: email
		};
	} catch (error) {
		console.error('Error loading profile data in +page.server.ts:', error);
		return {
			error: 'Failed to load profile data. Please try again later.'
		};
	}
};

