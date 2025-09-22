<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import * as api from '$lib/api';
	import { clearCache } from '$lib/cache';
	import { auth } from '$lib/stores/auth';
	import CommentsSection from '$lib/components/CommentsSection.svelte';
	import CreatePostOverlay from '$lib/components/CreatePostOverlay.svelte';
	import EditProfileModal from '$lib/components/EditProfileModal.svelte';
	import PostItem from '$lib/components/PostItem.svelte';
	import PostList from '$lib/components/PostList.svelte';
	import updateConnectionUserInfo from '$lib/utils/connectionUpdater';
	import type { PageData } from './$types';

	export let data: PageData;

	interface Profile {
		email: string;
		userUID?: string;
		username: string;
		displayName?: string;
		bio: string;
		profileImageUrl: string;
		backgroundImageUrl: string;
		backgroundImageUrl2: string;
		showEmail: boolean;
		showLocation: boolean;
		showProfileViews: boolean;
		showTotalLocations: boolean;
		showLastLoggedIn: boolean;
		youtubeUrl: string;
		xUrl: string;
		messengerUrl: string;
		instagramUrl: string;
		tikTokUrl: string;
		lastUsernameChange: number;
		profileViews: number;
		lastLoggedIn: number;
		showStarredTo?: string;
		showFeaturedTo?: string;
		preferredLocation?: { name: string; lat?: number; lng?: number };
		connections?: any[];
		connectionCount?: number;
		buddyCount?: number;
		showConnectionsTo?: string;
		showBuddiesTo?: string;
		allowTaggingFrom?: string;
		isAdmin?: boolean;
		isActive?: boolean;
		registrationDate?: number;
		emailVerified?: boolean;
		website?: string;
		phoneNumber?: string;
		location?: string;
		showLocationTo?: string;
		isFeatured?: boolean;
	}

	interface Post {
		id: string;
		headline?: string;
		content?: string;
		ownerUsername: string;
		ownerEmail: string;
		fenceName: string;
		createdAt: number;
		profileImageUrl?: string;
		imageUrl?: string;
		lat?: number;
		lng?: number;
		userId?: string;
		username?: string;
		link?: string;
		category?: string;
		locationName?: string;
		location?: {
			name: string;
			lat: number;
			lng: number;
			zoom?: number | null;
			bounds?: { north: number; east: number; south: number; west: number } | null;
			locationType?: string;
		};
		tags?: string[];
		featuredInLocationUntil?: number;
		featuredInSearchUntil?: number;
		hasExactLocation?: boolean;
		views?: number;
		clicks?: number;
		// Repost fields
		originalPostId?: string | null;
		isRepost?: boolean;
		originalAuthor?: string;
		originalUsername?: string;
		originalPost?: Post;
		// API compatibility fields
		author?: {
			profileImageUrl?: string;
		};
	}

	let profileData: Profile = {
		email: '',
		username: '',
		displayName: '',
		bio: '',
		profileImageUrl: '',
		backgroundImageUrl: '',
		backgroundImageUrl2: '',
		showEmail: true,
		showLocation: true,
		showProfileViews: true,
		showTotalLocations: true,
		showLastLoggedIn: true,
		youtubeUrl: '',
		xUrl: '',
		messengerUrl: '',
		instagramUrl: '',
		tikTokUrl: '',
		lastUsernameChange: 0,
		profileViews: 0,
		lastLoggedIn: 0,
		showStarredTo: 'everyone',
		showFeaturedTo: 'everyone',
		preferredLocation: undefined,
		connections: [],
		connectionCount: 0,
		buddyCount: 0,
		showConnectionsTo: 'everyone',
		showBuddiesTo: 'buddies',
		isAdmin: false,
		isActive: true,
		registrationDate: 0,
		emailVerified: false,
		website: '',
		phoneNumber: '',
		location: '',
		showLocationTo: 'everyone',
		isFeatured: false
	};

	// Initialize state from data loaded by the server
	let backgroundImageUrl = '';
	let backgroundImageUrl2 = '';
	
	if (data && data.profileData) {
		const serverProfile = data.profileData;
		// Create a new profile object with proper type handling
		const updatedProfile: Profile = {
			...profileData,
			...serverProfile,
			// Ensure preferredLocation is properly typed
			preferredLocation: serverProfile.preferredLocation || undefined
		};
		
		profileData = updatedProfile;
		
		// Set background images
		backgroundImageUrl = profileData.backgroundImageUrl || '';
		backgroundImageUrl2 = profileData.backgroundImageUrl2 || '';
	}

	// Fix for API type to local Post type mismatch
	let userPosts: Post[] = [];
	let repostsPosts: Post[] = [];
	if (data?.userPosts) {
		const allPosts = data.userPosts.map(post => convertApiPostToLocalPost(post));
		// Separate regular posts from reposts
		userPosts = allPosts.filter(post => !post.isRepost);
		repostsPosts = allPosts.filter(post => post.isRepost);
	}
	let isLoading = false; // Already loaded from server
	let userPostsLoading = false; // Already loaded from server
	let errorMessage: string | null = data?.error || null;
	let successMessage: string | null = null;
	let locationCount = data?.locationCount || 0;
	let starredPostIds = new Set<string>(data?.starredPostIds || []);
	let showEditProfileModal = false;
	let authSubscription: () => void;
	let showConfirmModal = false;
	let confirmMessage = '';
	let confirmResolve: ((value: boolean) => void) | null = null;

	let showStarredPosts = false;
	let starredPosts: Post[] = [];
	let loadingStarred = false;

	let showFeaturedPosts = false;
	let loadingFeatured = false;
	let featuredPosts: Post[] = data?.featuredPosts || [];

	let showRepostsPosts = false;
	let loadingReposts = false;


	let featuredPostsLoaded = !!(data?.featuredPosts && data.featuredPosts.length > 0); // Already loaded from server if data exists

	let showFeaturedManager = false;

	// Connection and buddy display states
	let showConnectionsList = false;
	let showBuddiesList = false;
	
	// Modal states
	let showConnectionsModal = false;
	let showBuddiesModal = false;
	let showCreatePostOverlay = false;

	// Track fetch attempts to prevent infinite loops
	let starredFetchAttempts = 0;
	const MAX_FETCH_ATTEMPTS = 2;

	// Enhanced posts with original post data for reposts
	let enhancedPosts: Post[] = [];
	let originalPostsCache = new Map<string, Post>();

	// Function to fetch original post data for reposts
	async function fetchOriginalPost(originalPostId: string): Promise<Post | null> {
		if (originalPostsCache.has(originalPostId)) {
			return originalPostsCache.get(originalPostId)!;
		}

		try {
			const response = await fetch(`/api/posts/${originalPostId}`, {
				headers: {
					'Authorization': `Bearer ${$auth.token || ''}`
				}
			});

			if (response.ok) {
				const originalPost = await response.json();
				originalPostsCache.set(originalPostId, originalPost);
				return originalPost;
			}
		} catch (error) {
			console.error('Error fetching original post:', error);
		}
		return null;
	}

	// Function to enhance posts with original post data (for backwards compatibility)
	async function enhancePostsWithOriginals(posts: Post[]): Promise<Post[]> {
		console.log('profile/+page.svelte: Enhancing posts with originals, count:', posts.length);
		const enhanced = await Promise.all(
			posts.map(async (post) => {
				if (post.isRepost && post.originalPostId && !post.originalPost) {
					// Only fetch if originalPost is not already embedded
					console.log('profile/+page.svelte: Found repost without embedded originalPost:', post.id, 'original ID:', post.originalPostId);
					try {
						const originalPost = await fetchOriginalPost(post.originalPostId);
						if (originalPost) {
							console.log('profile/+page.svelte: Successfully fetched original post:', originalPost.id);
							return {
								...post,
								originalPost: convertApiPostToLocalPost(originalPost)
							};
						} else {
							console.warn('profile/+page.svelte: Could not fetch original post for repost:', post.id);
						}
					} catch (error) {
						console.error('profile/+page.svelte: Error fetching original post for repost:', post.id, error);
					}
				} else if (post.isRepost && post.originalPost) {
					console.log('profile/+page.svelte: Repost already has embedded originalPost:', post.id);
				}
				return post;
			})
		);
		return enhanced;
	}

	async function fetchStarredPostsForUser() {
		if (!$auth.token) {
			errorMessage = 'Authentication required. Please log in.';
			auth.logout();
			goto('/login', { replaceState: true });
			return;
		}
		
		// Prevent multiple requests and limit retries
		if (loadingStarred || starredFetchAttempts >= MAX_FETCH_ATTEMPTS) return;
		
		starredFetchAttempts++;
		loadingStarred = true;
		
		// Don't clear existing data immediately to avoid flash
		const startTime = Date.now();
		console.log('🌟 Starting starred posts fetch...');
		
		try {
			const res = await api.fetchStarredPosts($auth.token);
			console.log(`🌟 Starred posts API took ${Date.now() - startTime}ms`);
			
			// Backend now returns { posts: Post[] } instead of { starred: { postId: string }[] }
			if (res.posts && res.posts.length > 0) {
				const rawStarredPosts = res.posts;
				const enhanceStart = Date.now();
				starredPosts = await enhancePostsWithOriginals(rawStarredPosts);
				console.log(`🌟 Enhancement took ${Date.now() - enhanceStart}ms`);
				starredPostIds = new Set(rawStarredPosts.map((post: Post) => post.id));
			} else {
				starredPosts = [];
				starredPostIds = new Set<string>();
			}
			// Clear error message if successful
			errorMessage = '';
			console.log(`🌟 Total starred posts fetch took ${Date.now() - startTime}ms`);
		} catch (e: any) {
			console.error('Error fetching starred posts:', e);
			// Set the error message but don't redirect to login for CORS errors
			if (e.message && e.message.includes('CORS')) {
				errorMessage = 'Network error loading starred posts. Please try again later.';
			} else if (e.message && e.message.includes('Authentication failed')) {
				errorMessage = 'Session expired. Please log in again.';
				auth.logout();
				goto('/login', { replaceState: true });
			} else {
				errorMessage = 'Failed to load starred posts. Please try again.';
			}
			starredPosts = [];
			// Turn off the flag to prevent retries
			showStarredPosts = false;
		} finally {
			loadingStarred = false;
		}
	}



	// CreatePostOverlay state
	let postDraft = {
		content: '',
		headline: '',
		imageUrl: '',
		mediaUrl: '',
		category: 'COMMUNITY',
		link: ''
	};

	const GRADIENTS = [
		['#d7263d', '#ffb88c'],
		['#fbbf24', '#fef9c3'],
		['#2563eb', '#60a5fa'],
		['#9333ea', '#e0e7ff'],
		['#059669', '#bbf7d0'],
		['#f87171', '#fbbf24'],
		['#4b5563', '#d1fae5']
	];
	$: avatarSeed = profileData.username ? profileData.username.charCodeAt(0) % GRADIENTS.length : 0;
	function initials(name: string) {
		return name ? name.slice(0, 2).toUpperCase() : 'NA';
	}
	function textColor(gradientIdx: number) {
		return [1, 5, 6].includes(gradientIdx) ? 'black' : 'white';
	}
	function textShadow(gradientIdx: number) {
		return [1, 5, 6].includes(gradientIdx) ? '' : '0 2px 4px #000, 0 1px 3px #222';
	}
	$: defaultAvatarSvg = profileData.username
		? `data:image/svg+xml;utf8,<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${GRADIENTS[avatarSeed][0]}"/><stop offset="1" stop-color="${GRADIENTS[avatarSeed][1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" rx="150"/><text x="50%" y="58%" text-anchor="middle" font-family="Inter,sans-serif" font-weight="bold" font-size="140" fill="${textColor(avatarSeed)}" style="paint-order:stroke;stroke-linecap:butt;stroke-linejoin:miter;${textShadow(avatarSeed) ? `text-shadow:${textShadow(avatarSeed)};` : ''}" dy=".35em">${initials(profileData.username)}</text></svg>`
		: '/images/default-profile.jpg';

	// Convert API post type to local Post type for type safety
	function convertApiPostToLocalPost(apiPost: any): Post {
		return {
			id: apiPost.id,
			headline: apiPost.headline || apiPost.title || '',
			content: apiPost.content || apiPost.details || '',
			ownerUsername: apiPost.username || apiPost.ownerUsername || '',
			ownerEmail: apiPost.userEmail || apiPost.ownerEmail || '',
			fenceName: apiPost.fenceName || apiPost.locationName || 'Unknown Location',
			createdAt: apiPost.createdAt || Date.now(),
			profileImageUrl: apiPost.profileImageUrl || apiPost.author?.profileImageUrl || '',
			imageUrl: apiPost.imageUrl || '',
			lat: apiPost.lat || (apiPost.location?.lat),
			lng: apiPost.lng || (apiPost.location?.lng),
			userId: apiPost.userId || '',
			username: apiPost.username || apiPost.ownerUsername || '',
			link: apiPost.link || '',
			category: apiPost.category || 'COMMUNITY',
			locationName: apiPost.locationName || apiPost.fenceName || '',
			location: apiPost.location,
			tags: apiPost.tags || [],
			featuredInLocationUntil: apiPost.featuredInLocationUntil,
			featuredInSearchUntil: apiPost.featuredInSearchUntil,
			hasExactLocation: apiPost.hasExactLocation,
			views: apiPost.views,
			clicks: apiPost.clicks,
			originalPostId: apiPost.originalPostId,
			isRepost: apiPost.isRepost,
			originalAuthor: apiPost.originalAuthor,
			originalUsername: apiPost.originalUsername,
			originalPost: apiPost.originalPost ? convertApiPostToLocalPost(apiPost.originalPost) : undefined
		};
	}

	async function fetchUserProfileAndPosts() {
		if (!$auth.token) {
			errorMessage = 'Authentication required. Please log in.';
			goto('/login', { replaceState: true });
			return;
		}

		isLoading = true;
		errorMessage = null;
		successMessage = null;
		userPosts = [];
		locationCount = 0;
		if (profileData && typeof profileData.profileViews !== 'undefined') {
			profileData.profileViews = 0;
		}
		
		try {
			const fetchedProfile = await api.getUser($auth.token);
			
			console.log('🔍 fetchUserProfileAndPosts - API Response:', {
				connectionCount: (fetchedProfile as any).connectionCount,
				connections: (fetchedProfile as any).connections,
				connectionsLength: (fetchedProfile as any).connections?.length,
				sample: (fetchedProfile as any).connections?.[0]
			});
			
			// SURGICAL FIX: Simple assignment like other profile page - no complex merging
			profileData = fetchedProfile as Profile;
			
			console.log('🔍 fetchUserProfileAndPosts - After simple assignment:', {
				connectionCount: profileData.connectionCount,
				connections: profileData.connections,
				connectionsLength: profileData.connections?.length
			});
			
			// Only set essential defaults that might be missing
			if (!profileData.backgroundImageUrl) profileData.backgroundImageUrl = '';
			if (!profileData.backgroundImageUrl2) profileData.backgroundImageUrl2 = '';
			if (!profileData.showStarredTo) profileData.showStarredTo = 'everyone';
			if (!profileData.showFeaturedTo) profileData.showFeaturedTo = 'everyone';
			
			// Initialize background images from profile data
			backgroundImageUrl = profileData.backgroundImageUrl || '';
			backgroundImageUrl2 = profileData.backgroundImageUrl2 || '';
			
			console.log('Profile loaded - backgroundImageUrl:', backgroundImageUrl, 'backgroundImageUrl2:', backgroundImageUrl2);
			if (profileData.userUID) {
				try {
					const viewsData = await api.getProfileViews(profileData.userUID, $auth.token);
					profileData.profileViews = viewsData?.views || 0;
				} catch (viewsError) {
					console.error('Error fetching profile views:', viewsError);
				}
			}
			
			try {
				const locationData = await api.getUserLocationsCount($auth.token);
				locationCount = locationData?.count || 0;
			} catch (locationError) {
				console.error('Error fetching location count:', locationError);
			}
			
			userPostsLoading = true;
			try {
				// For logged-in user's own profile, use /api/user/posts (no userUID needed)
				const rawPosts = await api.getUserPosts($auth.token);
				if (Array.isArray(rawPosts)) {
					// Convert API Post type to local Post type
					const allPosts = await enhancePostsWithOriginals(rawPosts.map(post => convertApiPostToLocalPost(post)));
					// Separate regular posts from reposts - only show user's own posts for now
					userPosts = allPosts.filter(post => !post.isRepost);
					repostsPosts = allPosts.filter(post => post.isRepost);
				}
			} catch (postsError) {
				console.error('Error fetching user posts:', postsError);
				userPosts = [];
			}
		} catch (error: any) {
			console.error('Error fetching profile data:', error);
			errorMessage = error.message || 'Failed to load profile. Please try again.';
			if (error.message?.includes('Authentication failed') || error.message?.includes('No token')) {
				auth.logout();
				goto('/login', { replaceState: true });
			}
		} finally {
			isLoading = false;
			userPostsLoading = false;
		}
	}

	async function handleDeletePost(postId: string) {
		if (!$auth.token) {
			errorMessage = 'Authentication required. Please log in.';
			return;
		}
		const confirmDelete = await askConfirmation('Are you sure you want to delete this post? This cannot be undone.');
		if (!confirmDelete) return;
		try {
			await api.deletePost(postId, $auth.token);
			successMessage = 'Post deleted successfully!';
			userPosts = userPosts.filter((post) => post.id !== postId);
			clearCache($auth.token + '_userPosts');
			const loc = profileData.preferredLocation || {};
			if (loc && 'lat' in loc && 'lng' in loc) {
				clearCache($auth.token + '_posts_lat=' + loc.lat + '&lng=' + loc.lng + '&precision=2');
			}
		} catch (error: any) {
			errorMessage = error.message || 'Failed to delete post.';
			if (error.message?.includes('Authentication failed')) {
				auth.logout();
				goto('/login', { replaceState: true });
			}
		}
	}

	async function handleUndoRepost(repostId: string) {
		if (!$auth.token) {
			errorMessage = 'Authentication required. Please log in.';
			return;
		}
		const confirmUndo = await askConfirmation('Are you sure you want to undo this repost?');
		if (!confirmUndo) return;
		try {
			await api.deletePost(repostId, $auth.token);
			successMessage = 'Repost undone successfully!';
			// Remove from repostsPosts and userPosts if needed
			repostsPosts = repostsPosts.filter((post: Post) => post.id !== repostId);
			userPosts = userPosts.filter((post: Post) => post.id !== repostId);
			clearCache($auth.token + '_userPosts');
			const loc = profileData.preferredLocation || {};
			if (loc && 'lat' in loc && 'lng' in loc) {
				clearCache($auth.token + '_posts_lat=' + loc.lat + '&lng=' + loc.lng + '&precision=2');
			}
		} catch (error: any) {
			errorMessage = error.message || 'Failed to undo repost.';
			if (error.message?.includes('Authentication failed')) {
				auth.logout();
				goto('/login', { replaceState: true });
			}
		}
	}

	async function handleStarToggle(event: any) {
		const { postId, isCurrentlyStarred } = event.detail;
		console.log('Profile - handleStarToggle:', postId, isCurrentlyStarred);
		
		if (!$auth.token) {
			console.error('No authentication token available');
			return;
		}

		try {
			if (isCurrentlyStarred) {
				console.log('Unstarring post:', postId);
				await api.unstarPost(postId, $auth.token);
				starredPostIds.delete(postId);
			} else {
				console.log('Starring post:', postId);
				await api.starPost(postId, $auth.token);
				starredPostIds.add(postId);
			}
			starredPostIds = new Set(starredPostIds); // Force Svelte reactivity
			console.log('Updated starred posts:', Array.from(starredPostIds));
			
			// If we're currently viewing starred posts, refresh the list
			if (showStarredPosts) {
				await fetchStarredPostsForUser();
			}
		} catch (e) {
			console.error('Error toggling star:', e);
		}
	}

	function handleCreateNewPost() {
		// Open create post overlay
		showCreatePostOverlay = true;
	}
	function handleCloseCreatePost() {
		showCreatePostOverlay = false;
	}
	function handleShowOriginalPost(event: CustomEvent<Post>) {
		console.log('profile/+page.svelte: handleShowOriginalPost called - using PostItem internal modal');
		// PostItem now handles the modal internally, no action needed here
	}
	function handleSeeOnMap(post: Post) {
		goto(`/posts?lat=${post.lat}&lng=${post.lng}&zoom=15`);
	}

	function openEditProfileModal() {
		showEditProfileModal = true;
	}
	function handleProfileUpdated(event: any) {
		// Refresh profile data after successful update
		fetchUserProfileAndPosts();
	}







	function openConnectionsModal() {
		console.log('🔗 Opening connections modal. Profile data:', {
			connectionCount: profileData.connectionCount,
			connectionsArray: profileData.connections,
			connectionsLength: profileData.connections?.length
		});
		showConnectionsModal = true;
	}

	function closeConnectionsModal() {
		showConnectionsModal = false;
	}

	function openBuddiesModal() {
		console.log('👥 Opening buddies modal. Profile data:', {
			buddyCount: profileData.buddyCount,
			connectionsArray: profileData.connections,
			buddies: profileData.connections || []
		});
		showBuddiesModal = true;
	}

	function closeBuddiesModal() {
		showBuddiesModal = false;
	}

	async function upgradeToBuddy(targetUserUID: string) {
		try {
			console.log('Upgrading connection to buddy status:', targetUserUID);
			
			// TODO: Add API call to upgrade connection to buddy
			// const response = await api.upgradeToBuddy(targetUserUID, $auth.token);
			// if (response.success) {
			//   await fetchUserProfileAndPosts();
			//   alert('Connection upgraded to buddy!');
			// }
			
			alert('Buddy upgrade feature coming soon!');
			
		} catch (error) {
			console.error('Error upgrading to buddy:', error);
			alert('Failed to upgrade connection');
		}
	}

	// Function to manually refresh connection counts
	async function refreshConnectionCounts() {
		if (!$auth?.token) return;
		
		try {
			console.log('Manually refreshing connection counts...');
			
			// Clear cache to force fresh data
			clearCache();
			
			// Fetch updated profile data
			await fetchUserProfileAndPosts();
			
			console.log('Connection counts refreshed:', {
				connections: profileData.connectionCount,
				buddies: profileData.buddyCount
			});
		} catch (error) {
			console.error('Error refreshing connection counts:', error);
		}
	}

	// Auto-refresh connection counts periodically
	let connectionRefreshInterval: NodeJS.Timeout | null = null;
	
	function startConnectionRefresh() {
		if (connectionRefreshInterval) clearInterval(connectionRefreshInterval);
		
		// Refresh every 30 seconds
		connectionRefreshInterval = setInterval(() => {
			if ($auth?.token && browser) {
				console.log('🔄 Auto-refreshing connection counts...');
				refreshConnectionCounts();
			}
		}, 30000);
	}
	
	function stopConnectionRefresh() {
		if (connectionRefreshInterval) {
			clearInterval(connectionRefreshInterval);
			connectionRefreshInterval = null;
		}
	}

	onMount(() => {
		if (!browser) return;
		
		authSubscription = auth.subscribe(async (value) => {
			if (value && value.token) {
				await fetchUserProfileAndPosts();

				// If you want "showStarredPosts" to default to true when showStarredTo is "everyone",
				// set it here:
				if (typeof profileData.showStarredTo === 'undefined' || profileData.showStarredTo === null) {
					profileData.showStarredTo = 'everyone';
				}

				if (showStarredPosts) {
					await fetchStarredPostsForUser();
				}
				
				// Start auto-refresh for connection counts
				startConnectionRefresh();
				
				// Update connection user information
				if (profileData.connections && profileData.connections.length > 0) {
					try {
						const updatedConnections = await updateConnectionUserInfo(profileData.connections, value.token);
						profileData.connections = updatedConnections;
					} catch (error) {
						console.error('Error updating connection information:', error);
					}
				}

				// Don't increment profile views when viewing your own profile
				// This is handled in [username]/+page.server.ts for other users' profiles
			} else if (!value || !value.token) {
				localStorage.removeItem('auth');
				localStorage.removeItem('token');
				clearCache();
				goto('/login', { replaceState: true });
			}
		});
	});

	onDestroy(() => {
		if (authSubscription) authSubscription();
		stopConnectionRefresh();
	});

	$: groupedPosts = (() => {
		const grouped = new Map<string, Post[]>();
		userPosts.forEach((post) => {
			const fence = post.fenceName || 'Unknown Location';
			if (!grouped.has(fence)) grouped.set(fence, []);
			grouped.get(fence)!.push(post);
		});
		return grouped;
	})();
	
	// Use grouped posts directly without virtual grouping
	$: displayGroups = Array.from(groupedPosts.entries());

	function askConfirmation(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			confirmMessage = message;
			showConfirmModal = true;
			confirmResolve = resolve;
		});
	}
	function handleModalConfirm() {
		if (confirmResolve) {
			confirmResolve(true);
			showConfirmModal = false;
			confirmResolve = null;
		}
	}
	function handleModalCancel() {
		if (confirmResolve) {
			confirmResolve(false);
			showConfirmModal = false;
			confirmResolve = null;
		}
	}
	function formatTimestamp(timestamp: number): string {
		if (!timestamp) return 'Never';
		const date = new Date(timestamp);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}
	function formatTimeUntilChange(timestamp: number): string {
		const now = Date.now();
		const nextAllowed = timestamp + 7 * 24 * 60 * 60 * 1000;
		if (now > nextAllowed) {
			return 'You can change your username at any time.';
		}
		const diff = nextAllowed - now;
		const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
		return `You can change your username again in ${days} day(s).`;
	}



	// Only trigger the fetch when showStarredPosts changes to true (user clicks button)
	// and we haven't reached max attempts
	$: if (showStarredPosts && !loadingStarred && starredFetchAttempts < MAX_FETCH_ATTEMPTS) {
		fetchStarredPostsForUser();
	}
	
	// Fetch featured posts when tab is selected
	$: if (showFeaturedPosts && !featuredPostsLoaded && !loadingFeatured) {
		loadingFeatured = true;
		if ($auth && $auth.token) {
			api.getFeaturedPosts($auth.token)
				.then(async res => { 
					console.log('🏆 getFeaturedPosts API response:', res);
					const rawFeaturedPosts = (res.featuredPosts || []).map(post => ({
					...post,
					profileImageUrl: post.profileImageUrl || post.author?.profileImageUrl || ''
				}));
				featuredPosts = await enhancePostsWithOriginals(rawFeaturedPosts as any);
				console.log('🏆 Featured posts for profile loaded:', featuredPosts, 'User email:', $auth.email);
				featuredPostsLoaded = true; // Mark as loaded so we don't try again
			})
			.catch(error => {
				console.error('Error fetching featured posts:', error);
				featuredPosts = [];
				featuredPostsLoaded = true; // Mark as loaded even on error to prevent infinite retries
			})
			.finally(() => { loadingFeatured = false; });
		}
	}
</script>

<div class="profile-card">
    <!-- Container 1: Profile Image and Username with edit button top-right -->
    <div class="container-1-profile">
        <!-- Background container with default background -->
        <div class="background-container">
            {#if backgroundImageUrl}
                <img src={backgroundImageUrl} alt="Profile background" class="background-image" />
            {:else}
                <img src="/images/default-profile-bg1.jpg" alt="Default profile background" class="background-image" />
            {/if}
        </div>

        <!-- Edit button in upper right corner -->
        <button class="edit-btn" on:click={openEditProfileModal} aria-label="Edit profile">
            <span class="edit-dots">&#8230;</span>
        </button>

        <!-- LEFT SIDE: Profile image and Username -->
        <div class="profile-left-section">
            <!-- Profile image -->
            <div class="profile-avatar-container">
                <img
                    src={profileData.profileImageUrl || defaultAvatarSvg}
                    alt={`Profile picture of ${profileData.username}`}
                    class="profile-avatar"
                    on:error={(e) => {
                        if (e.currentTarget instanceof HTMLImageElement) {
                            e.currentTarget.src = '/images/default-profile.jpg';
                        }
                    }}
                />
            </div>
            <div class="username-bubble">
                <h1 class="username">@{profileData.username || 'N/A'}</h1>
                {#if profileData.isAdmin}
                    <div class="admin-badge">
                        <span class="admin-icon">👑</span>
                        <span class="admin-text">ADMIN</span>
                    </div>
                {/if}
            </div>
            <!-- Social Links (moved here) -->
			{#if profileData.youtubeUrl || profileData.xUrl || profileData.messengerUrl || profileData.instagramUrl || profileData.tikTokUrl}
				<div class="social-links-profile-container">
					<div class="social-links-profile-bubble">
						{#if profileData.youtubeUrl}
							<a href="https://youtube.com/@{profileData.youtubeUrl}" target="_blank" rel="noopener noreferrer" title="YouTube" class="social-link-item">
								<svg class="social-link-icon" width="24" height="24" viewBox="0 0 24 24" fill="#ff0000">
									<path d="M23.498 6.186a2.994 2.994 0 0 0-2.107-2.117C19.222 3.5 12 3.5 12 3.5s-7.222 0-9.391.569A2.994 2.994 0 0 0 .502 6.186C0 8.356 0 12 0 12s0 3.644.502 5.814a2.994 2.994 0 0 0 2.107 2.117C4.778 20.5 12 20.5 12 20.5s7.222 0 9.391-.569a2.994 2.994 0 0 0 2.107-2.117C24 15.644 24 12 24 12s0-3.644-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
							</a>
						{/if}
						{#if profileData.xUrl}
							<a href="https://x.com/{profileData.xUrl}" target="_blank" rel="noopener noreferrer" title="X" class="social-link-item">
								<svg class="social-link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
								</svg>
							</a>
						{/if}
						{#if profileData.messengerUrl}
							<a href="https://m.me/{profileData.messengerUrl}" target="_blank" rel="noopener noreferrer" title="Messenger" class="social-link-item">
								<svg class="social-link-icon" width="24" height="24" viewBox="0 0 24 24" fill="#0084ff">
									<path d="M12 2C6.477 2 2 6.145 2 11.333c0 2.914 1.426 5.519 3.667 7.226V22l3.382-1.854c.902.246 1.858.387 2.951.387 5.523 0 10-4.145 10-9.333S17.523 2 12 2zm1.194 12.561L10.9 12.36 6.667 14.561l4.667-4.95 2.333 2.2L17.9 9.439l-4.706 5.122z"/>
								</svg>
							</a>
						{/if}
						{#if profileData.instagramUrl}
							<a href="https://instagram.com/{profileData.instagramUrl}" target="_blank" rel="noopener noreferrer" title="Instagram" class="social-link-item">
								<svg class="social-link-icon" width="24" height="24" viewBox="0 0 24 24" fill="url(#instagram-gradient)">
									<defs>
										<linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
											<stop offset="0%" stop-color="#f09433"/>
											<stop offset="25%" stop-color="#e6683c"/>
											<stop offset="50%" stop-color="#dc2743"/>
											<stop offset="75%" stop-color="#cc2366"/>
											<stop offset="100%" stop-color="#bc1888"/>
										</linearGradient>
									</defs>
									<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
								</svg>
							</a>
						{/if}
						{#if profileData.tikTokUrl}
							<a href="https://tiktok.com/@{profileData.tikTokUrl}" target="_blank" rel="noopener noreferrer" title="TikTok" class="social-link-item">
								<svg class="social-link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M19.321 5.562a5.124 5.124 0 0 1-.443-.258 6.228 6.228 0 0 1-1.137-.966c-.849-.849-1.14-1.947-1.14-2.595V1.5h-3.016v14.072c0 1.392-1.132 2.523-2.523 2.523s-2.523-1.131-2.523-2.523c0-1.392 1.132-2.523 2.523-2.523.304 0 .596.055.868.154V9.659a5.543 5.543 0 0 0-.868-.069c-3.067 0-5.558 2.491-5.558 5.558s2.491 5.558 5.558 5.558 5.558-2.491 5.558-5.558V8.468a8.19 8.19 0 0 0 4.487 1.316V6.748c-.629 0-1.232-.129-1.784-.362-.579-.244-1.1-.595-1.541-1.028-.441-.433-.767-.952-.944-1.513-.177-.561-.177-1.147 0-1.708.177-.561.503-1.08.944-1.513.441-.433.962-.784 1.541-1.028.552-.233 1.155-.362 1.784-.362z"/>
								</svg>
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>
                <!-- MIDDLE: Bio and Profile Details -->
                <div class="profile-right-section">
                    <!-- Bio section right beside avatar -->
                    <div class="bio-container">
                        <div class="bio-bubble">
                            <div class="bio-text">{profileData.bio || 'No bio available.'}</div>
                        </div>
                    </div>

                    <!-- Profile Details Section -->
                    <div class="profile-details-container">
                        <div class="profile-details-bubble">
                            {#if profileData.showEmail !== false}
                                <div class="profile-detail-item"><strong>Email:</strong> {profileData.email}</div>
                            {/if}
                            {#if profileData.showLocation !== false && profileData.preferredLocation?.name}
                                <div class="profile-detail-item"><strong>Location:</strong> {profileData.preferredLocation.name}</div>
                            {/if}
                            {#if profileData.showTotalLocations !== false}
                                <div class="profile-detail-item"><strong>Total Locations:</strong> {locationCount}</div>
                            {/if}
                            {#if profileData.showProfileViews !== false}
                                <div class="profile-detail-item"><strong>Profile Views:</strong> {profileData.profileViews}</div>
                            {/if}
                            							<div class="profile-detail-item">
								<strong>Connections:</strong> 
								{#if (profileData.showConnectionsTo === 'everyone' || profileData.showConnectionsTo === undefined)}
									<button class="connection-button" on:click={openConnectionsModal}>
										{profileData.connectionCount || 0}
									</button>
								{:else}
									{profileData.connectionCount || 0}
								{/if}
							</div>
                            <div class="profile-detail-item">
                                <strong>Buddies:</strong> 
                                {#if (profileData.showBuddiesTo === 'everyone' || profileData.showBuddiesTo === 'buddies' || profileData.showBuddiesTo === undefined)}
                                    <button class="connection-button" on:click={openBuddiesModal}>
                                        {profileData.buddyCount || 0}
                                    </button>
                                {:else}
                                    {profileData.buddyCount || 0}
                                {/if}
                            </div>
                            {#if profileData.showLastLoggedIn !== false}
                                <div class="profile-detail-item"><strong>Last Logged In:</strong> {formatTimestamp(profileData.lastLoggedIn)}</div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
			<!-- Container 3: Posts Section with Tabs and Create Post Button -->
			<div class="container-3-posts" style={`background-image: url(${profileData.backgroundImageUrl2 || '/images/default-profile-bg2.jpg'}); background-size: cover; background-position: center; background-repeat: no-repeat;`}>
				<div class="posts-header-row">
					<button class="create-post-btn" on:click={handleCreateNewPost}>
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="4" y="4" width="14" height="16" rx="2" />
							<line x1="8" y1="8" x2="14" y2="8" />
							<line x1="8" y1="12" x2="14" y2="12" />
							<line x1="8" y1="16" x2="12" y2="16" />
							<line x1="15.5" y1="19.5" x2="21" y2="19.5"/>
							<line x1="18.25" y1="17" x2="18.25" y2="22"/>
						</svg>
						</button>
					<div class="tabs">
						<button class="tab-btn" class:active={showFeaturedPosts} on:click={() => { 
							showStarredPosts = false; 
							showRepostsPosts = false;
							// Reset the loaded flag if switching back to featured tab
							if (!showFeaturedPosts) {
								featuredPostsLoaded = false;
								featuredPosts = [];  // Clear existing posts
							}
							showFeaturedPosts = true;
						}}>
							<svg width="32" height="32" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon" style="margin-right: 0.5rem;">
								<circle cx="12" cy="12" r="5" fill="#f59e0b"/>
								<line x1="12" y1="2" x2="12" y2="5"/>
								<line x1="12" y1="19" x2="12" y2="22"/>
								<line x1="2" y1="12" x2="5" y2="12"/>
								<line x1="19" y1="12" x2="22" y2="12"/>
								<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
								<line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
								<line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
								<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
							</svg>
							Featured
						</button>
						<button class="tab-btn" class:active={!showStarredPosts && !showFeaturedPosts && !showRepostsPosts} on:click={() => { showStarredPosts = false; showFeaturedPosts = false; showRepostsPosts = false; }}>
							<i class="fas fa-newspaper"></i>
							Posts
						</button>
						<button class="tab-btn" class:active={showRepostsPosts} on:click={() => { showStarredPosts = false; showFeaturedPosts = false; showRepostsPosts = true; }}>
							<i class="fas fa-retweet"></i>
							Reposts
						</button>
						<button class="tab-btn" class:active={showStarredPosts} on:click={() => { showStarredPosts = true; showFeaturedPosts = false; showRepostsPosts = false; }}>
							<img src="/images/icons/star-featured.svg" alt="Starred" class="btn-icon" />
							Starred
						</button>
					</div>
					<div class="header-spacer"></div>
				</div>
				<div class="posts-section">
					{#if showFeaturedPosts}
						<div class="featured-posts-section">
							{#if loadingFeatured}
								<div class="loading-indicator">Loading featured posts...</div>
							{:else if !featuredPosts || featuredPosts.length === 0}
								<p class="no-data">No featured posts yet.</p>
							{:else}
								<div class="posts-grid">
									{#each featuredPosts as post (post.id)}
										<div class="post-item-container">
											<PostItem {post} isFeatured={true} isStarred={starredPostIds.has(post.id)} on:toggleStar={handleStarToggle} on:showOriginalPost={handleShowOriginalPost} />
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if showStarredPosts}
						<div class="starred-posts-section">
							{#if !starredPostIds.size}
								<p class="no-data">No starred posts yet.</p>
							{:else}
								<div class="posts-grid">
									{#each userPosts.filter(post => starredPostIds.has(post.id)) as post (post.id)}
										<div class="post-item-container">
											<PostItem {post} isStarred={true} on:toggleStar={handleStarToggle} on:showOriginalPost={handleShowOriginalPost} />
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if !showStarredPosts && !showFeaturedPosts && !showRepostsPosts}
						<div class="regular-posts-section">
							{#if userPostsLoading}
								<p class="loading">Loading your posts...</p>
							{:else if userPosts.length === 0}
								<p class="no-data">No posts found.</p>
							{:else}
								{#each displayGroups as [fenceName, postsInFence]}
									<div class="location-group">
										<h3 class="fence-header">{fenceName}</h3>
										<div class="fence-divider"></div>
										{#if postsInFence.length === 0}
											<p class="no-data">No posts in this location.</p>
										{/if}
										<div class="posts-grid">
											{#each postsInFence as post (post.id)}
												<div class="post-item-container">
													<PostItem {post} isStarred={starredPostIds.has(post.id)} on:toggleStar={handleStarToggle} on:showOriginalPost={handleShowOriginalPost} />
												</div>
											{/each}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}

					{#if showRepostsPosts}
						<div class="reposts-posts-section">
							{#if loadingReposts}
								<p class="loading">Loading reposts...</p>
							{:else if repostsPosts.length === 0}
								<p class="no-data">No reposts yet.</p>
							{:else}
								<PostList
									posts={repostsPosts}
									wikipediaPreviews={{}}
									highlightedPostId={null}
									preferredLocationName=""
									loading={false}
									on:toggleStar={handleStarToggle}
									on:showOriginalPost={handleShowOriginalPost}
								/>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
<!-- Edit Profile Modal Component -->
<EditProfileModal
	bind:show={showEditProfileModal}
	{profileData}
	on:close={() => showEditProfileModal = false}
	on:profile-updated={handleProfileUpdated}
/>

	{#if showConfirmModal}
		<div class="edit-profile-modal-backdrop" role="dialog" aria-labelledby="confirm-modal-title">
			<div class="edit-profile-modal small">
				<p id="confirm-modal-title" class="modal-text">{confirmMessage}</p>
				<div class="form-actions">
					<button class="action-btn danger" on:click={handleModalConfirm}>Confirm</button>
					<button class="action-btn secondary" on:click={handleModalCancel}>Cancel</button>
				</div>
			</div>
		</div>
	{/if}



	<!-- Connections Modal -->
	{#if showConnectionsModal}
		<div class="edit-profile-modal-backdrop" role="dialog" aria-labelledby="connections-modal-title">
			<div class="edit-profile-modal">
				<h2 id="connections-modal-title" class="modal-title">Your Connections ({profileData.connectionCount || 0})</h2>
				<div class="connections-modal-content">
					{#if profileData.connections && profileData.connections.length > 0}
						<div class="connections-grid">
							{#each profileData.connections as connection}
								<div class="connection-item">
									<img 
										src={connection.profileImageUrl || '/images/default-profile.jpg'} 
										alt={connection.username}
										class="connection-avatar"
										on:error={(e) => {
											if (e.currentTarget instanceof HTMLImageElement) {
												e.currentTarget.src = '/images/default-profile.jpg';
											}
										}}
									/>
									<div class="connection-info">
										<a href="/profile/{connection.username}" class="connection-username" on:click={closeConnectionsModal}>
											@{connection.username}
										</a>
										<span class="connection-type">
											{connection.mutual === true ? 'Buddy' : 'Connected'}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="no-connections">No connections yet.</p>
					{/if}
				</div>
				<button type="button" on:click={closeConnectionsModal} class="cancel-btn">Close</button>
			</div>
		</div>
	{/if}

	<!-- Buddies Modal -->
	{#if showBuddiesModal}
		<div class="edit-profile-modal-backdrop" role="dialog" aria-labelledby="buddies-modal-title">
			<div class="edit-profile-modal">
				<h2 id="connections-modal-title" class="modal-title">Your Connections ({profileData.connectionCount || 0})</h2>
				<div class="connections-modal-content">
					{#if profileData.connections}
						{@const connections = profileData.connections}
						{#if connections.length > 0}
							<div class="connections-grid">
								{#each connections as connection}
									<div class="connection-item">
										<img 
											src={connection.profileImageUrl || '/images/default-profile.jpg'} 
											alt={connection.username}
											class="connection-avatar"
											on:error={(e) => {
												if (e.currentTarget instanceof HTMLImageElement) {
													e.currentTarget.src = '/images/default-profile.jpg';
												}
											}}
										/>
										<div class="connection-info">
											<a href="/profile/{connection.username}" class="connection-username" on:click={closeBuddiesModal}>
												@{connection.username}
											</a>
											<span class="connection-type {connection.isBuddy ? 'buddy' : 'connected'}">
												{connection.isBuddy ? 'Buddy' : 'Connected'}
											</span>
											{#if !connection.isBuddy}
												<button 
													class="buddy-upgrade-btn"
													on:click={() => upgradeToBuddy(connection.userUID)}
												>
													Add to Buddies
												</button>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="no-connections">No connections yet.</p>
						{/if}
					{:else}
						<p class="no-connections">No connections data available.</p>
					{/if}
				</div>
				<button type="button" on:click={closeBuddiesModal} class="cancel-btn">Close</button>
			</div>
		</div>
	{/if}

<!-- CreatePostOverlay -->
{#if showCreatePostOverlay}
	<CreatePostOverlay 
		show={showCreatePostOverlay}
		onClose={handleCloseCreatePost}
		isMapMode={false}
		mapPinLocation={null}
		clickZoom={null}
		{postDraft}
	/>
{/if}

<style>
    /* Global Reset & Base Styling */
    :root {
        --primary-color: #00d9ff; /* Electric blue */
        --secondary-color: #deeeee; /* Deep purple */
        --background-color: #ffffff; /* Dark, near-black */
        --card-background: linear-gradient(200deg, #ffffff 60%, #2689cc 100%);
        --border-color: #9df7f7; /* Subtle border for definition */
        --text-color: #50f8f8; /* Light gray text */
        --link-color: var(--primary-color);
        --success-color: #4caf50;
        --error-color: #f44336;
        --warning-color: #ff9800;
        --shadow: 0 8px 24px rgba(0, 217, 255, 0.15); /* Electric blue shadow */
        --modal-bg: rgba(14, 13, 13, 0.75);
        --font-family: 'Inter';
    }

	:global(html), :global(body) {
        background: #ffffff !important;
        min-height: 100vh;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: var(--font-family);
        color: var(--text-color);
        background-color: var(--background-color);
    }

    /* Container and Layout */

    /* Modifying the .profile-card to be vertical */
    .profile-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background-color: #ffffff;
        padding: 0;
        box-shadow: var(--shadow);
        border: none;
        width: 100%;
        max-width: 1200px;
        margin-top: 0.7em;
		border-radius: 15px;
    }

    /* Remove the media query for the profile-card since we want it vertical always */
    @media (min-width: 768px) {
        .profile-card {
            flex-direction: column;
            padding: 0;
        }
    }

    /* === NEW CONTAINER 1: PROFILE SECTION === */
    .container-1-profile {
        background: transparent;
        position: relative;
        height: 400px;
        margin: 2rem;
        margin-bottom: 0.5rem;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: flex-start;
        gap: 2rem;
        padding: 20px;
		border: 1px solid var(--primary-color);
		border-bottom: none !important;
		background: var(--card-background); /* Optional: for modal-like background */
		box-shadow:
        0 -8px 24px var(--primary-color),   /* Top */
        0 0px 20px var(--primary-color),    /* Sides */
        0 0px 0px transparent;              /* No bottom glow */
		background-repeat: no-repeat;
		background-size: cover;
		background-position: center;
    }

    /* Background container */
    .background-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none; /* Allow clicks to pass through */
    }

    .background-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 12px;
    }

    .background-placeholder {
        width: 100%;
        height: 100%;
        background: #000000;
        border-radius: 12px;
    }

    /* Edit button in upper right corner */
    .edit-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        background: #000000a4;
        border: 2px solid var(--primary-color);
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        box-shadow: 0 0 10px var(--primary-color);
    }

    .edit-btn:hover {
        transform: scale(1.15) rotate(90deg);
        box-shadow: 
            0 6px 20px rgba(0, 217, 255, 0.5),
            0 0 30px rgba(0, 217, 255, 0.4),
            inset 0 1px 0 rgba(4, 242, 255, 0.3);
        border: 1px solid rgba(175, 240, 235, 0.4);
    }

    .edit-dots {
        color: var(--primary-color);
        font-size: 18px;
        font-weight: bold;
		margin-bottom: 0.5rem;
    }

    /* LEFT SECTION: Profile image and username */
    .profile-left-section {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        z-index: 10;
        position: relative;
    }

    .profile-image-container {
        z-index: 10;
		padding-top: 0.5rem;
		padding-left: 0.5rem;
    }

    .avatar, .profile-avatar {
        width: 300px;
        height: 300px;
        border-radius: 8%;
        object-fit: cover;
        border: 3px solid var(--primary-color);
		transition: transform 0.5s ease-in-out;
        /* box-shadow: 0 0 20px var(--primary-color); */
    }

	.profile-avatar:hover {
        transform: scale(1.07);
        border-color: #fff;
        box-shadow: 0 0 15px 8px #ffffff; /* blue glow */
    }

    .username-bubble {
		background: rgba(0, 0, 0, 0.521);
		color: var(--primary-color);
		padding: 2px 16px;
		border-radius: 12px;
		border: 3px solid var(--primary-color);
		box-shadow: var(--shadow);
		max-width: 260px;
		width: 100%;
		word-break: break-word;
		margin-top: -0.2rem;
		margin-left: 0.2rem;
		margin-bottom: 0.5rem;
		text-align: center;
		transition: transform 0.5s ease-in-out;
	}

    .username {
        color: #fff;
		font-family: 'Inter';
        font-size: 1.5rem;
        font-weight: bold;
        margin: 0;
        /* text-shadow:
        0 0 8px var(--primary-color),
        0 0 16px var(--primary-color),
        0 0 24px var(--primary-color); */
    }

	.username-bubble:hover {
        transform: scale(1.07);
        border-color: #fff;
        box-shadow: 0 0 15px 8px #ffffff; /* blue glow */
    }

    .admin-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        background: linear-gradient(45deg, #ffd700, #ffed4e);
        color: #000;
        padding: 0.2rem 0.8rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 800;
        margin-top: 0.3rem;
        border: 2px solid #ffd700;
        box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .admin-icon {
        font-size: 0.9rem;
    }

    .admin-text {
        font-family: 'Inter', sans-serif;
    }

    /* RIGHT SECTION: Bio and details */
    .profile-right-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        z-index: 10;
        position: relative;
		max-width: 380px;
    }

    /* Bio bubble */
    .bio-container {
        z-index: 10;
        margin-top: 0.1rem;
		transition: transform 0.5s ease-in-out;
    }

    .bio-bubble {
        background: rgba(0, 0, 0, 0.85);
        color: var(--text-color);
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
        max-width: 400px;
        text-align: left;
		transition: transform 0.5s ease-in-out;
    }

	.bio-bubble:hover {
        transform: scale(1.07);
        border-color: #fff;
        box-shadow: 0 0 15px 8px #ffffff; /* blue glow */
    }

    .bio-text {
        font-size: 1rem;
        line-height: 1.3;
        margin: 0;
		font-family:'Inter';
    }

    /* Profile details container below bio */
    .profile-details-container {
        z-index: 10;
        margin-top: -0.5rem;
    }

    .profile-details-bubble {
        background: rgba(0, 0, 0, 0.85);
        color: var(--text-color);
        padding: 8px 8px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .profile-detail-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(0, 217, 255, 0.1);
        border: 1px solid rgba(0, 217, 255, 0.3);
        transition: all 0.2s ease-in-out;
		font-family: 'Inter';
    }

    .profile-detail-item:hover {
        background: rgba(0, 217, 255, 0.2);
        border-color: var(--primary-color);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3);
    }

    /* Connection button styling */
    .connection-button {
        background: #00013d;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: inherit;
        padding: 2px 4px;
        margin: 0;
        position: relative;
        z-index: 20;
    }

    .connection-button:hover {
        color: #00013d;
    }

    /* Old profile-detail styles removed - using new layout */

    @media (max-width: 768px) {
        .container-1-profile {
            flex-direction: column;
            text-align: center;
        }
        
        .profile-left-section {
            align-items: center;
        }
        
        .profile-right-section {
            align-items: center;
        }
    }

    .connections-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 1.5rem;
    }

    .connection-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: transform 0.2s ease-in-out;
    }

    .connection-item:hover {
        transform: translateY(-5px);
    }

    .connection-avatar {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--secondary-color);
    }

    .connection-username {
        font-size: 0.9rem;
        margin-top: 0.5rem;
        color: var(--link-color);
        text-decoration: none;
        text-shadow: 0 0 5px var(--primary-color);
    }

    .connection-type {
        font-size: 0.8rem;
        color: var(--secondary-color);
        padding: 2px 6px;
        border-radius: 10px;
        display: inline-block;
        margin-top: 2px;
    }

    .connection-type.buddy {
        background: linear-gradient(135deg, #ff6b6b, #ffa500);
        color: white;
    }

    .connection-type.connected {
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
    }

    .buddy-upgrade-btn {
        background: linear-gradient(135deg, #ff6b6b, #ffa500);
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.7rem;
        cursor: pointer;
        margin-top: 10px;
        transition: all 0.2s ease;
        display: block;
        width: 100%;
    }

    .buddy-upgrade-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
    }

	.profile-social-section {
		position: absolute;
		bottom: 24px;      /* Distance from the bottom */
		right: 45px;       /* Distance from the right */
		margin-left: 0;
		min-width: 90px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: flex-end;
	}

	/* New Social Links Container */
    .social-links-profile-container {
        z-index: 10;
        margin-top: -0.6rem;
    }

    .social-links-profile-bubble {
        background: rgba(0, 0, 0, 0.85);
        color: var(--text-color);
        padding: 6px 8px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: row;
		gap: 6px;
		align-items: center;
    }

    .social-link-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 1px 5px;
        border-radius: 8px;
        background: rgba(0, 217, 255, 0.1);
        border: 1px solid rgba(0, 217, 255, 0.3);
        text-decoration: none;
        color: var(--text-color);
        transition: all 0.2s ease-in-out;
		width: 40px;   /* or 36px for a tighter fit */
		height: 32px;
		box-sizing: border-box;
		margin: 0 2px;
		/* Remove gap and set fixed size for a round bubble */
		gap: 0;
		filter: none;
		fill: #ff0000;
    }

    .social-link-item:hover {
        background: rgba(0, 217, 255, 0.2);
        border-color: var(--primary-color);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3);
    }

    .social-link-icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		border: none;
		width: 36px;
		height: 36px;
		transition: background 0.2s, box-shadow 0.2s;
	}

	.social-link-icon-link:hover {
		background: rgba(0,217,255,0.15);
		box-shadow: 0 0 8px var(--primary-color);
	}

	.social-link-icon {
		width: 28px;
		height: 28px;
		filter: brightness(0) invert(1);
		transition: filter 0.2s;
	}

    /* Posts Section (Container 3) */
    .container-3-posts {
		display: flex;                  /* Makes the container a flexbox for vertical layout */
		flex-direction: column;         /* Stacks children vertically */
		height: 100vw;                   /* Sets height relative to viewport width */
		max-height: 100vh;               /* Limits height to 90% of viewport height */
		gap: 2rem;                    /* Adds vertical space between children */
		background-color: #000000;      /* Fallback color if no background image */
		box-shadow: 0 4px 16px rgba(30, 58, 138, 0.05); /* Subtle shadow for depth */
		color: #222;                    /* Text color inside the container */
		margin-top: 0.3rem;             /* Space above the container */
        padding: 2rem;
		min-height: 600px;
		position: relative;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		border-top-left-radius: 12px;
		border-top-right-radius: 12px;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		width: 100%;           /* or a fixed value like 900px */
		max-width: 1020px;     /* set your preferred max width */
		margin-left: auto;     /* center horizontally if needed */
		margin-right: auto;    /* center horizontally if needed */
    }

	.posts-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.7rem;
		margin-bottom: -1rem;
		position: relative;
		height: 55px;
		z-index: 10;
		width: 100%
	}

	.header-spacer {
		width: 55px; /* Same width as .create-post-btn for perfect symmetry */
		flex-shrink: 0;
	}

    .create-post-btn {
        width: 55px;
        height: 55px;
        border-radius: 50%;
        background-color: #000000a4;
        color: var(--background-color);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--primary-color);
        cursor: pointer;
        box-shadow: 0 0 10px var(--primary-color);
        transition: transform 0.5s ease-in-out, box-shadow 0.2s ease-in-out;
		margin-left: 3rem;
		margin-right: 3.5rem;
		flex-shrink: 0;
    }

    .create-post-btn:hover {
        transform: scale(1.1);
        border-color: #fff;
        box-shadow: 0 0 15px 8px #ffffff; /* blue glow */
    }

    .create-post-btn .btn-icon {
        width: 30px;
        height: 30px;
        filter: invert(1);
		margin: 0;
    }
    
    .tabs {
        display: flex;
        gap: 3.5rem;
        justify-content: center;
		flex: 1 1 auto;
		align-items: center;
		margin: 0;
    }

    .tab-btn {
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        border: 2px solid transparent;
        padding: 1rem 2rem;
        border-radius: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        backdrop-filter: blur(10px);
    }

    .tab-btn:hover {
        background: rgba(0, 217, 255, 0.3);
        border-color: var(--primary-color);
        transform: translateY(-2px);
    }

    .tab-btn.active {
        background: var(--primary-color);
        color: #000;
        border-color: #fff;
        box-shadow: 0 8px 16px rgba(0, 217, 255, 0.4);
    }

    .tab-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-icon {
        width: 24px;
        height: 24px;
        filter: brightness(0) invert(1);
    }

    .tab-btn.active .btn-icon {
        filter: brightness(0);
    }

	.posts-section,
    .regular-posts-section,
	.starred-posts-section,
	.featured-posts-section {
		flex: 1 1 auto;
		overflow-y: auto;
		min-height: 0;
		max-height: 100%;
		padding-bottom: 0;
		box-sizing: border-box;
		width: 100%;
		position: relative;
		z-index: 10;
		margin-top: 0.8rem;
		scrollbar-width: none; 
		-ms-overflow-style: none;  /* IE and Edge */
		/* Optional: add background if needed */
	}

	.posts-section::-webkit-scrollbar,
	.regular-posts-section::-webkit-scrollbar,
	.starred-posts-section::-webkit-scrollbar,
	.featured-posts-section::-webkit-scrollbar {
		width: 0;
		height: 0;
		background: transparent;
	}

    .post-group {
		margin-top: 1rem;
        margin-bottom: 1rem;
		z-index: 10;
    }

	.fence-name-bubble {
		background: rgba(0, 0, 0, 0.52);
		color: #fff;
		padding: 2px 16px;
		border-radius: 18px;
		border: 3px solid var(--primary-color);
		box-shadow: var(--shadow);
		max-width: 340px;
		width: fit-content;
		word-break: break-word;
		margin-bottom: 1.25rem;
		margin-top: 0.5rem;
		text-align: center;
		font-size: 1.2rem;
		font-weight: bold;
		font-family: 'Inter';
	}

	.fence-divider {
		height: 3px;
		width: 100%;
		max-width: 1100px;
		margin-top: 0.3rem;
		margin-bottom: 1.25rem;
		background: var(--primary-color);
		border-radius: 2px;
		box-shadow: 0 0 8px #00d9ff88;
	}

    .fence-header {
        background: rgba(0, 0, 0, 0.52);
		color: #fff;
		padding: 2px 16px;
		border-radius: 18px;
		border: 3px solid var(--primary-color);
		box-shadow: var(--shadow);
		max-width: 340px;
		width: fit-content;
		word-break: break-word;
		margin-bottom: 0.7rem;
		margin-top: 0.5rem;
		text-align: center;
		font-size: 1.2rem;
		font-weight: bold;
		font-family: 'Inter';
    }

    .location-group {
        margin-bottom: 2rem;
    }

    .post-item-container {
        break-inside: avoid;
        margin-bottom: 1.5rem;
        display: inline-block;
        width: 100%;
        transition: transform 0.2s ease;
        position: relative; /* Add position relative */
    }

    .post-item-container:hover {
		transform: scale(1.02);
    }

	/* When a post modal is open, freeze hover scaling to prevent layout thrash flicker */
	:global(body.post-modal-open) .post-item-container:hover {
		transform: none !important;
	}

	/* Repost container specific styling */
	.repost-item-container {
		position: relative;
	}

	.posts-grid, .posts-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
        width: 100%;
        padding: 1rem 0;
        position: relative;
        grid-auto-rows: masonry; /* This creates masonry layout with row-first ordering */
    }

    /* Fallback for browsers that don't support masonry yet */
    @supports not (grid-auto-rows: masonry) {
        .posts-grid, .posts-list {
            column-count: 3;
            column-gap: 1.5rem;
            width: 100%;
            padding: 1rem 0;
            position: relative;
        }
    }

	/* Posts Grid and List Styles
    .posts-grid, .posts-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
        width: 100%;
        padding: 1rem;
        grid-auto-rows: masonry;
    } */

    /* Fallback for browsers that don't support masonry */
    @supports not (grid-auto-rows: masonry) {
        .posts-grid, .posts-list {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: flex-start;
            align-items: flex-start;
        }
        
        .post-item-container {
            flex: 0 1 calc(33.333% - 1rem);
            max-width: calc(33.333% - 1rem);
        }
    }

    .no-data {
		display: center;
        text-align: center;
        color: #fff;
        font-size: 1.2rem;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 25px;
        backdrop-filter: blur(2px);
		margin: 3rem 20rem;
		padding: 1rem 1rem; /* smaller padding */
    }

	.loading-indicator {
        text-align: center;
        color: var(--primary-color);
        font-size: 1.2rem;
        padding: 2rem;
    }

	.post-item.starred {
    	border: 3px solid gold;
	}

	.starred-posts {
		margin-top: 2rem; /* Adjust this value as needed */
	}

	.post-item.featured {
		border: 3px solid #ff6702;
	}

	.featured-posts-grid {
		margin-top: 2rem;
		row-gap: 2.5rem;
	}

	.author-img-modal {
		width: 2.8em;
		height: 2.8em;
		border-radius: 50%;
		border: 2.5px solid #000;
		object-fit: cover;
		margin-right: 1em;
		vertical-align: middle;
	}

	.modal-author-row {
		display: flex;
		align-items: center;
		gap: 1em;
		margin-bottom: 1em;
	}

    /* Edit Profile Modal Styles - MOVED TO EditProfileModal.svelte component 
       All styles below this comment are now handled by the component */
    .edit-profile-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--modal-bg);
		color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000 !important;
		scrollbar-width: none;         /* Firefox */
    	-ms-overflow-style: none;      /* IE and Edge */
    }

	.edit-profile-modal-backdrop::-webkit-scrollbar {
		display: none;                 /* Chrome, Safari, Opera */
	}

    .edit-profile-modal {
        background-color: #00000077;
        padding: 2.5rem;
        border-radius: 12px;
        box-shadow: 0 0 20px var(--primary-color);
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        border: 1px solid var(--primary-color);
		margin-top: 1rem;
		scrollbar-width: none;
    	-ms-overflow-style: none;
    }

	.edit-profile-modal::-webkit-scrollbar {
		display: none;
	}

    .edit-profile-modal-landscape {
        max-width: 95vw;
        max-height: 65vh;
        width: 1200px;
    }

    .modal-columns {
        display: grid;
        grid-template-columns: 0.9fr 1fr 1fr;
        gap: 1rem;
        margin-top: 0;
		margin-left: 1.2rem;
    }

    .modal-column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
		margin-right: 2rem;
    }

    /* Mobile responsive design - preserve original vertical layout */
    @media (max-width: 1024px) {
        .modal-landscape {
            max-width: 90%;
            width: auto;
        }
        
        .modal-columns {
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .checkbox-item {
        display: flex;
        align-items: center;
        margin-bottom: 0.75rem;
        gap: 0.5rem;
    }

    .form-checkbox {
        margin: 0;
    }

    .edit-profile-modal.small {
        max-width: 450px;
    }

    .edit-profile-modal-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 2.5rem;
        cursor: pointer;
        color: var(--text-color);
        transition: transform 0.2s ease-in-out, color 0.2s ease-in-out;
    }

    .close-btn:hover {
        transform: rotate(90deg);
        color: var(--error-color);
    }

    /* Connections Modal Styles */
    .connections-modal-content {
        max-height: 60vh;
        overflow-y: auto;
        padding: 1rem 0;
    }

    .no-connections {
        text-align: center;
        color: var(--text-color);
        opacity: 0.7;
        font-style: italic;
        padding: 2rem;
    }

    .modal-title {
        font-size: 1.6rem;
        font-weight: 700;
		margin-top: 0.2rem;
        margin-bottom: 1.2rem;
        color: var(--primary-color);
        text-shadow: 0 0 5px var(--primary-color);
		text-align: center;
    }

    /* Form Styles */
    form {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .form-section {
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0;
    }

    .form-section:last-of-type {
        border-bottom: none;
    }

    .form-section-title {
        font-size: 1.3rem;
		margin-top: 0.2rem;
        margin-bottom: 0.7rem;
        color: var(--secondary-color);
    }

    .form-label {
        font-weight: 600;
        margin-bottom: 0.5rem;
        display: block;
        color: var(--text-color);
    }

    .form-input,
    .form-textarea,
    .form-input-group select {
        width: 90%;
        padding: 0.3rem 0.7rem;
		max-height: 300px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 1rem;
        background-color: #2a2a2a;
        color: var(--text-color);
		margin-top: -0.5rem;
    }

    .form-input:focus,
    .form-textarea:focus {
        border-color: var(--primary-color);
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.5);
    }

    .form-input[aria-invalid="true"] {
        border-color: var(--error-color);
    }

    .char-count {
        font-size: 0.875rem;
        color: var(--secondary-color);
        text-align: right;
        margin-top: 0.25rem;
		justify-content: flex-end;
		margin-right: 1rem;
    }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1.5rem;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: normal;
        color: var(--text-color);
    }

    .image-upload {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
    }

    .preview-image {
        width: 130px;
        height: 130px;
        border-radius: 12px;
        object-fit: cover;
        border: 3px solid var(--primary-color);
        box-shadow: 0 0 10px var(--primary-color);
    }

    .background-preview {
        width: 300px;
        height: 150px;
        border-radius: 12px;
        object-fit: cover;
    }

    .background-placeholder-preview {
        width: 300px;
        height: 150px;
        border-radius: 12px;
        background: #333333;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color);
        border: 2px dashed var(--border-color);
    }

    .upload-options {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .upload-btn {
        background-color: var(--primary-color);
        color: var(--background-color);
        padding: 0.3rem 1.8rem;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s, box-shadow 0.2s;
        box-shadow: 0 0 10px var(--primary-color);
		margin-top: -0.8rem;
    }

    .upload-btn:hover {
        background-color: var(--secondary-color);
        box-shadow: 0 0 15px var(--secondary-color);
    }

    .url-input-group {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
		padding: 0;
		margin-top: 0.5rem;
    }

    .remove-btn {
        background: none;
        color: var(--error-color);
        border: none;
        cursor: pointer;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        text-decoration: underline;
    }

    /* Button Styles */
    .action-btn {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease-in-out;
        background-color: var(--primary-color);
        color: var(--background-color);
        border: 1px solid var(--primary-color);
        box-shadow: 0 0 10px var(--primary-color);
    }

    .action-btn.secondary {
        background-color: transparent;
        color: var(--secondary-color);
        border-color: var(--secondary-color);
        box-shadow: 0 0 10px var(--secondary-color);
    }

    .action-btn.danger {
        background-color: var(--error-color);
        border-color: var(--error-color);
        color: #fff;
        box-shadow: 0 0 10px var(--error-color);
    }

    .action-btn:hover {
        opacity: 0.9;
        transform: translateY(-2px);
    }

    .action-btn:disabled,
    .action-btn.disabled {
        background-color: #333333;
        border-color: #333333;
        color: #666666;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
    }
    
    .connection-button {
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 5px;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s ease;
    }

    .connection-button:hover {
        background-color: var(--secondary-color);
    }

    .refresh-button {
        background: none;
        border: none;
        font-size: 14px;
        cursor: pointer;
        margin-left: 8px;
        padding: 2px 4px;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .refresh-button:hover {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.1);
    }

    .form-actions {
        display: flex;
        justify-content: center;
		align-items: flex-start;
        gap: 1.5rem;
        margin-top: 0.7rem;
		margin-bottom: 0.8rem;
    }

    .cancel-btn {
        background-color: #ad0404;
        color: #fff;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
    }

    .save-btn {
        background-color: var(--success-color);
        color: #fff;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 0 10px var(--success-color);
    }

    .save-btn:disabled {
        background-color: #333333;
        color: #666666;
        cursor: not-allowed;
        box-shadow: none;
    }

    /* Utility */
    .hidden {
        display: none;
    }

    .error-text {
        color: var(--error-color);
        margin-top: 0.5rem;
        text-shadow: 0 0 5px var(--error-color);
    }

    .success-text {
        color: var(--success-color);
        margin-top: 0.5rem;
        text-shadow: 0 0 5px var(--success-color);
    }

    /* Prefixed Input Styling */
    .prefix-input-group {
        display: flex;
        align-items: center;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background-color: #2a2a2a;
        overflow: hidden;
		flex: 1 1 120px;
		width: 290px;
		min-width: 150px;
		max-width: 300px;
    }

    .prefix-input-group:focus-within {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.5);
    }

    .input-prefix {
        background-color: rgba(0, 217, 255, 0.1);
        padding: 0.5rem 0.5rem;
        color: var(--primary-color);
        font-size: 1rem;
        font-weight: 500;
        border-right: 1px solid var(--border-color);
        white-space: nowrap;
    }

    .prefixed-input {
        border: none;
        background: transparent;
        padding: 0.5rem 0.6rem 0rem 0.4rem;
        color: var(--text-color);
    }

    .prefixed-input:focus {
        outline: none;
        box-shadow: none;
        border: none;
    }
    
    /* Original Post Modal Styles */
    .original-post-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .original-post-modal-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
    }
    
	/* Removed previously added global overrides for .modal-backdrop / .modal.
	   They were overriding PostItem modal CSS and causing flicker / containment issues.
	   Edit profile modal uses its own scoped classes (edit-profile-modal-*) so no change needed. */
</style>