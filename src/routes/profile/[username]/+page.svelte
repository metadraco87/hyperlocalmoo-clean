<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import * as api from '$lib/api';
	import { clearCache } from '$lib/cache';
	import { auth } from '$lib/stores/auth';
	import CommentsSection from '$lib/components/CommentsSection.svelte';
	import MessagesOverlay from '$lib/components/MessagesOverlay.svelte';
	import PostItem from '$lib/components/PostItem.svelte';
	import updateConnectionUserInfo from '$lib/utils/connectionUpdater';

	// Default image constants
	const defaultAvatarSvg = '/images/default-profile.jpg';
	const defaultBackgroundSvg1 = '/images/default-profile-bg1.jpg';
	const defaultBackgroundSvg2 = '/images/default-profile-bg2.jpg';

	export let data: {
		profile: any;
		posts: any[];
		profileViews: number;
		connectionStatus: { status: string; mutual: boolean };
		error?: { status: number; body: { message: string } };
	};

	interface Profile {
		email: string;
		userUID: string;
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
		relationship?: string;
	}

	interface Post {
		id: string;
		headline: string;
		content: string;
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
		originalPost?: Post;
	}

	let profileData: Profile = data.profile || {
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
		connections: [],
		connectionCount: 0,
		buddyCount: 0,
		showConnectionsTo: 'everyone',
		showBuddiesTo: 'buddies',
		allowTaggingFrom: 'everyone',
		isAdmin: false,
		isActive: true,
		registrationDate: 0,
		emailVerified: false,
		website: '',
		phoneNumber: '',
		location: '',
		showLocationTo: 'everyone',
		isFeatured: false,
		relationship: 'none'
	};

	let userPosts: Post[] = [];
	let isLoading = true;
	let userPostsLoading = true;
	let errorMessage: string | null = null;
	let successMessage: string | null = null;
	
	// Messages overlay state
	let selectedConversation: any = null;
	let locationCount = 0;
	let authSubscription: () => void;
	let enlargedPost: Post | null = null;
	let showCommentsInModal = false;
	let showConnectionsModal = false;
	let showBuddiesModal = false;
	
	// Favorite profile system
	let isProfileFavorited = false;
	let favoritedProfiles = new Set<string>();

	// Process initial data to enhance with original posts
	$: if (data.posts && data.posts.length > 0 && userPosts.length === 0) {
		console.log('Profile [username]: Processing initial posts data:', data.posts.length, 'posts');
		enhancePostsWithOriginals(data.posts).then(enhanced => {
			console.log('Profile [username]: Enhanced posts:', enhanced.length);
			userPosts = enhanced;
			// Split posts into regular posts and reposts
			const allPosts = enhanced;
			userPosts = allPosts.filter(post => !post.isRepost);
			repostsPosts = allPosts.filter(post => post.isRepost);
			console.log('Profile [username]: Final userPosts:', userPosts.length, 'reposts:', repostsPosts.length);
		});
	} else {
		console.log('Profile [username]: No initial posts data or already loaded. data.posts:', data.posts?.length, 'userPosts:', userPosts.length);
	}
	let showConfirmModal = false;
	let confirmMessage = '';
	let confirmResolve: ((value: boolean) => void) | null = null;

	let showStarredPosts = false;
	let starredPostIds = new Set<string>();
	let starredPosts: Post[] = [];
	let loadingStarred = false;

	// Repost-related variables
	let showRepostsPosts = false;
	let repostsPosts: Post[] = [];
	let loadingReposts = false;

	// Connection-specific variables
	let connectionStatus: string = data.connectionStatus?.status || 'none';
	let isMutualConnection: boolean = data.connectionStatus?.mutual || false;
	let isOwnProfile: boolean = false;
	let targetUsername: string | null = null;
	let isInitialLoad: boolean = true;
	let showConnectDropdown = false;

	// Connection and buddy display states
	let showConnectionsList = false;
	let showBuddiesList = false;

	// Enhanced posts with original post data for reposts
	let originalPostsCache = new Map<string, Post>();

	// Function to fetch original post data for reposts
	async function fetchOriginalPost(originalPostId: string): Promise<Post | null> {
		if (originalPostsCache.has(originalPostId)) {
			return originalPostsCache.get(originalPostId)!;
		}

		try {
			const response = await fetch(`/api/posts/${originalPostId}`, {
				headers: {
					'Authorization': `Bearer ${$auth.token}`
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

	// Function to enhance posts with original post data
	async function enhancePostsWithOriginals(posts: Post[]): Promise<Post[]> {
		const enhanced = await Promise.all(
			posts.map(async (post) => {
				if (post.isRepost && post.originalPostId) {
					const originalPost = await fetchOriginalPost(post.originalPostId);
					return {
						...post,
						originalPost
					} as Post & { originalPost?: Post };
				}
				return post;
			})
		);
		return enhanced;
	}
	
	// Track fetch attempts to prevent infinite loops
	let starredFetchAttempts = 0;
	const MAX_FETCH_ATTEMPTS = 2;

	// Featured posts functionality
	let showFeaturedPosts = false;
	let featuredPosts: Post[] = [];
	let featuredPostsLoaded = false;
	let loadingFeatured = false;

	// Tab state management
	let showFeaturedTab = false;

	// Profile views
	profileData.profileViews = data.profileViews || 0;

	// Connection management functions
	async function handleConnect() {
		if (!$auth || !$auth.token || !(profileData.userUID || profileData.email)) {
			errorMessage = 'Authentication required to connect.';
			return;
		}
		try {
			// Prefer userUID over email for connections
			const identifier = profileData.userUID || profileData.email;
			await api.createConnection(identifier, $auth.token);
			successMessage = `Successfully connected to ${profileData.username || profileData.email}.`;
			connectionStatus = 'connected';
			isMutualConnection = false;
			
			// Ensure connections is an array
			let connections = [...(profileData.connections || [])];
			
			// Add current user to connections if not already there
			const currentUserInConnections = connections.some(conn => 
				conn.email === $auth.email);
				
			if (!currentUserInConnections && $auth.email) {
				connections.push({
					email: $auth.email,
					username: $auth.username,
					profileImageUrl: $auth.profileImageUrl || '',
					mutual: false
				});
				
				// Update profileData with the new connections array and counts
				const newConnectionCount = connections.length;
				const newBuddyCount = connections.filter(conn => conn.mutual === true).length;
				
				console.log(`Updating connection count to ${newConnectionCount} and buddy count to ${newBuddyCount}`);
				
				// Create a new object to trigger reactivity
				profileData = {
					...profileData,
					connections,
					connectionCount: newConnectionCount,
					buddyCount: newBuddyCount
				};
			}
			
			clearCache();
			
			// Update connection status reactively instead of force reload
			setTimeout(async () => {
				// Refresh connection status
				try {
					const identifier = profileData.userUID || profileData.email;
					const statusResult = await api.getConnectionStatus(identifier, $auth.token || '', true);
					if (statusResult) {
						connectionStatus = statusResult.status;
						isMutualConnection = statusResult.mutual;
					}
				} catch (error) {
					console.error('Error refreshing connection status:', error);
				}
			}, 500);
			
			setTimeout(() => { successMessage = null; }, 3000);
		} catch (error: any) {
			console.error('Connection error:', error);
			errorMessage = error.message || 'Failed to connect user.';
		}
	}

	async function handleDisconnect() {
		if (!$auth || !$auth.token || !(profileData.userUID || profileData.email)) {
			errorMessage = 'Authentication required to disconnect.';
			return;
		}
		try {
			// Prefer userUID over email for connections
			const identifier = profileData.userUID || profileData.email;
			await api.deleteConnection(identifier, $auth.token);
			successMessage = `Disconnected from ${profileData.username || profileData.email}.`;
			connectionStatus = 'none';
			isMutualConnection = false;
			
			// Update connection counts in the UI
			if (profileData.connections && Array.isArray(profileData.connections) && $auth.email) {
				// Remove current user from connections
				const updatedConnections = profileData.connections.filter((conn: any) => 
					conn.email !== $auth.email);
				
				// Calculate new counts
				const newConnectionCount = updatedConnections.length;
				const newBuddyCount = updatedConnections.filter((conn: any) => conn.mutual === true).length;
				
				console.log(`Updating connection count to ${newConnectionCount} and buddy count to ${newBuddyCount}`);
				
				// Create a new object to trigger reactivity
				profileData = {
					...profileData,
					connections: updatedConnections,
					connectionCount: newConnectionCount,
					buddyCount: newBuddyCount
				};
			}
			
			clearCache();
			
			// Update connection status reactively instead of force reload
			setTimeout(async () => {
				// Refresh connection status
				try {
					const identifier = profileData.userUID || profileData.email;
					const statusResult = await api.getConnectionStatus(identifier, $auth.token || '', true);
					if (statusResult) {
						connectionStatus = statusResult.status;
						isMutualConnection = statusResult.mutual;
					}
				} catch (error) {
					console.error('Error refreshing connection status:', error);
				}
			}, 500);
			
		} catch (error: any) {
			errorMessage = error.message || 'Failed to disconnect user.';
		} finally {
			showConnectDropdown = false;
		}
	}

	async function handleDetach() {
		if (!$auth || !$auth.token || !profileData.email) {
			errorMessage = 'Authentication required to detach from buddy.';
			return;
		}
		try {
			// Instead of full disconnect, just revert the mutual status to 'connected'
			await api.createConnection(profileData.email, $auth.token);
			successMessage = `Connection with ${profileData.username || profileData.email} reverted to connected status. You can still send messages.`;
			connectionStatus = 'connected';
			isMutualConnection = false;
			
			// Update connection in the UI - keep the connection but change mutual status
			if (profileData.connections && Array.isArray(profileData.connections) && $auth.email) {
				// Find and update the current user's connection
				const updatedConnections = profileData.connections.map((conn: any) => {
					if (conn.email === $auth.email) {
						return { ...conn, mutual: false };
					}
					return conn;
				});
				
				// Calculate new buddy count (connections with mutual: true)
				const newBuddyCount = updatedConnections.filter((conn: any) => conn.mutual === true).length;
				
				console.log(`Updating buddy count to ${newBuddyCount} after detach`);
				
				// Create a new object to trigger reactivity
				profileData = {
					...profileData,
					connections: updatedConnections,
					buddyCount: newBuddyCount
					// Keep connectionCount the same since we're still connected
				};
			}
			
			clearCache();
			
		} catch (error: any) {
			errorMessage = error.message || 'Failed to detach from buddy.';
		} finally {
			showConnectDropdown = false;
		}
	}

	function handleBlock() {
		errorMessage = 'Block feature is not implemented yet.';
		showConnectDropdown = false;
	}

	async function handleUpgradeToBuddy() {
		if (!$auth || !$auth.token || !profileData.userUID) {
			errorMessage = 'Authentication required to send buddy request.';
			return;
		}
		try {
			// Send buddy request (requires approval)
			await api.sendBuddyRequest(profileData.userUID, $auth.token);
			
			successMessage = `Buddy request sent to ${profileData.username}! They will receive a notification to accept or reject.`;
			
			// Clear any existing error messages
			errorMessage = '';
			
			// Clear success message after 5 seconds
			setTimeout(() => { successMessage = null; }, 5000);
			
		} catch (error: any) {
			console.error('Buddy request error:', error);
			errorMessage = error.message || 'Failed to send buddy request.';
		}
	}

	async function handleMessage() {
		try {
			// Get fresh connection status to check canMessage flag
			const identifier = profileData.userUID || profileData.email;
			const statusResult = await api.getConnectionStatus(identifier, $auth.token || '', true);
			
			if (!statusResult.canMessage) {
				errorMessage = 'You cannot message this user. You must be connected or they must have connected to you first.';
				return;
			}
		} catch (error) {
			console.error('Error checking message permissions:', error);
			errorMessage = 'Error checking message permissions. Please try again.';
			return;
		}
		
		if (!profileData.email || !$auth.email) {
			errorMessage = 'Unable to create conversation. Missing user information.';
			return;
		}
		
		// Create conversation ID by sorting emails alphabetically for consistency
		const conversationId = [profileData.email, $auth.email].sort().join('_');
		console.log('Opening messages overlay for conversation:', conversationId);
		
		// Open MessagesOverlay with the specific conversation
		selectedConversation = {
			conversationId: conversationId,
			otherParticipantUsername: profileData.username,
			otherParticipantEmail: profileData.email,
			otherParticipantProfileImage: profileData.profileImageUrl || '/images/default-profile.jpg'
		};
	}

	function handleEnlarge(post: Post) {
		enlargedPost = post;
		showCommentsInModal = false;
	}
	function handleOpenComments() {
		showCommentsInModal = true;
	}
	function closeEnlargedPost() {
		enlargedPost = null;
		showCommentsInModal = false;
	}
	function handleSeeOnMap(post: Post) {
		goto(`/posts?lat=${post.lat}&lng=${post.lng}&zoom=15`);
	}

	async function handleDeletePost(postId: string) {
		if (!confirm('Are you sure you want to delete this post?')) return;
		
		try {
			if (!$auth.token) return;
			await api.deletePost(postId, $auth.token);
			userPosts = userPosts.filter((post) => post.id !== postId);
			clearCache($auth.token + '_userPosts');
			const loc = profileData.preferredLocation || null;
			if (loc && 'lat' in loc && 'lng' in loc && loc.lat && loc.lng) {
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

	async function handleToggleStar(post: Post) {
		if (!$auth.token) {
			errorMessage = 'Please log in to star posts.';
			return;
		}

		try {
			const isCurrentlyStarred = starredPostIds.has(post.id);
			if (isCurrentlyStarred) {
				await api.unstarPost(post.id, $auth.token);
				starredPostIds.delete(post.id);
			} else {
				await api.starPost(post.id, $auth.token);
				starredPostIds.add(post.id);
			}
			starredPostIds = new Set(starredPostIds); // Trigger reactivity
		} catch (error: any) {
			console.error('Error toggling star:', error);
			errorMessage = error.message || 'Failed to update star status.';
		}
	}

	async function loadStarredPostIds() {
		if (!$auth.token) return;
		try {
			const response = await api.fetchStarredPosts($auth.token);
			if (response && typeof response === 'object') {
				// Handle different potential response structures
				if (Array.isArray(response)) {
					starredPostIds = new Set(response.map((s: any) => s.postId));
				} else if (response.posts && Array.isArray(response.posts)) {
					starredPostIds = new Set(response.posts.map((s: any) => s.id || s.postId));
				} else {
					// Try to extract properties that might contain starred posts
					const starredArray = Object.values(response).find((val: any) => 
						Array.isArray(val) && val.length > 0 && (val[0].postId || val[0].id)
					);
					
					if (starredArray) {
						starredPostIds = new Set(starredArray.map((s: any) => s.postId || s.id));
					} else {
						starredPostIds = new Set();
					}
				}
			} else {
				starredPostIds = new Set();
			}
		} catch (error) {
			console.error('Error loading starred posts:', error);
			starredPostIds = new Set(); // Reset to empty set on error
		}
	}

	// Featured posts logic
	async function maybeLoadFeaturedPosts() {
		// Skip if we've already loaded featured posts or are currently loading
		if (featuredPostsLoaded || loadingFeatured) return;
		
		showFeaturedTab = false;
		featuredPosts = [];
		
		if (profileData.showFeaturedTo === 'never') return;
		
		// Only allow if you are allowed by privacy:
		// - own profile
		// - "everyone" can see (default)
		// - "buddies" and buddies connection  
		// - "connected" and (buddies or connected or connect_back connection)
		if (isOwnProfile ||
			profileData.showFeaturedTo === 'everyone' ||
			(profileData.showFeaturedTo === 'buddies' && connectionStatus === 'buddies') ||
			(profileData.showFeaturedTo === 'connected' && (connectionStatus === 'buddies' || connectionStatus === 'connected' || connectionStatus === 'connect_back'))
		) {
			loadingFeatured = true;
			try {
				if (profileData.username) {
					const res = await api.fetchFeaturedPostsOfUser(profileData.username, $auth.token || '');
					featuredPosts = res.featuredPosts || [];
					console.log('Featured posts loaded:', featuredPosts);
					showFeaturedTab = true; // Always show featured tab when allowed
					featuredPostsLoaded = true; // Mark as loaded
				} else {
					showFeaturedTab = false;
				}
			} catch (e) {
				showFeaturedTab = false;
				console.error('Error loading featured posts:', e);
			} finally {
				loadingFeatured = false;
			}
		}
	}

	function formatTimestamp(timestamp: number): string {
		if (!timestamp) return 'Never';
		const date = new Date(timestamp);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	function groupPostsByFence(posts: Post[]): Map<string, Post[]> {
		const grouped = new Map<string, Post[]>();
		const defaultFence = 'Unknown Location';
		posts.forEach(post => {
			const fence = post.fenceName || defaultFence;
			if (!grouped.has(fence)) {
				grouped.set(fence, []);
			}
			grouped.get(fence)!.push(post);
		});
		return grouped;
	}

	function openConnectionsModal() {
		console.log('🔗 Opening connections modal for [username]. Profile data:', {
			username: profileData.username,
			connectionCount: profileData.connectionCount,
			connectionsArray: profileData.connections,
			connectionsLength: profileData.connections?.length,
			sampleConnection: profileData.connections?.[0],
			fullProfileData: profileData
		});
		showConnectionsModal = true;
	}

	function closeConnectionsModal() {
		showConnectionsModal = false;
	}

	function openBuddiesModal() {
		console.log('👥 Opening buddies modal for [username]. Profile data:', {
			username: profileData.username,
			buddyCount: profileData.buddyCount,
			connectionsArray: profileData.connections,
			buddies: profileData.connections?.filter(conn => conn.mutual === true),
			buddiesLength: profileData.connections?.filter(conn => conn.mutual === true)?.length
		});
		showBuddiesModal = true;
	}

	function closeBuddiesModal() {
		showBuddiesModal = false;
	}
	
	// Favorite profile functions
	async function toggleProfileFavorite() {
		if (!$auth?.token || !profileData?.email) return;
		
		try {
			if (isProfileFavorited) {
				// Remove from favorites
				await api.removeFavoriteProfile(profileData.email, $auth.token);
				favoritedProfiles.delete(profileData.email);
				isProfileFavorited = false;
				console.log('🌟 Removed profile from favorites:', profileData.username);
			} else {
				// Add to favorites
				await api.addFavoriteProfile({
					email: profileData.email,
					username: profileData.username,
					profileImageUrl: profileData.profileImageUrl || '/images/default-profile.jpg'
				}, $auth.token);
				favoritedProfiles.add(profileData.email);
				isProfileFavorited = true;
				console.log('🌟 Added profile to favorites:', profileData.username);
			}
		} catch (error) {
			console.error('Error toggling profile favorite:', error);
		}
	}
	
	// Load favorited profiles on component mount
	async function loadFavoritedProfiles() {
		if (!$auth?.token) return;
		
		try {
			const response = await api.getFavoritedProfiles($auth.token);
			const favoritedEmails = response.favoritedProfiles?.map((p: any) => p.email) || [];
			favoritedProfiles = new Set(favoritedEmails);
			isProfileFavorited = profileData?.email ? favoritedProfiles.has(profileData.email) : false;
		} catch (error) {
			console.error('Error loading favorited profiles:', error);
		}
	}

	onMount(async () => {
		if (!browser) return;
		
		console.log('Profile [username] component mounted. Initial profile data:', JSON.stringify({
			username: profileData.username,
			email: profileData.email,
			connectionCount: profileData.connectionCount,
			buddyCount: profileData.buddyCount,
			connections: profileData.connections ? profileData.connections.length : 'no connections array',
			connectionStatus
		}, null, 2));
		
		// Only show auth-related errors after initial load
		setTimeout(() => {
			if (data.error?.body?.message && data.error.status !== 401) {
				errorMessage = data.error.body.message;
			}
			isInitialLoad = false;
		}, 100);
		
		// Create a new copy of profile data to force reactivity
		profileData = { ...profileData };
		
		// Make sure we have the profile data
		if (profileData) {
			// Ensure connections is an array
			if (!profileData.connections) {
				console.log('No connections array found, creating empty array');
				profileData.connections = [];
			}
			
			// Backend should provide accurate counts, but ensure they match the array if present
			const connections = profileData.connections;
			const buddies = connections.filter((conn: any) => conn.type === 'buddies');
			
			console.log(`Current connection state:
				- connections array length: ${connections.length}
				- buddies in array: ${buddies.length}
				- profileData.connectionCount: ${profileData.connectionCount}
				- profileData.buddyCount: ${profileData.buddyCount}
			`);
			
			// Use backend counts if available, otherwise calculate from array
			if (profileData.connectionCount === undefined) {
				profileData.connectionCount = connections.length;
				console.log(`Using calculated connectionCount: ${profileData.connectionCount}`);
			}
			if (profileData.buddyCount === undefined) {
				profileData.buddyCount = buddies.length;
				console.log(`Using calculated buddyCount: ${profileData.buddyCount}`);
			}
			
			// Create a new copy to force reactivity
			profileData = { ...profileData };
		}
		
		// Set up auth subscription to handle login state and load data
		authSubscription = auth.subscribe(async (value) => {
			if (value.isAuthLoaded) {
				if (!value.token) {
					if (!isInitialLoad) {
						localStorage.removeItem('auth');
						clearCache();
						goto('/login', { replaceState: true });
					}
				} else {
					targetUsername = $page.params.username ? $page.params.username.replace(/^@/, '') : null;
					
					// Check if the user has changed - if so, reset featuredPostsLoaded
					const newIsOwnProfile = !!(value.username && value.username === targetUsername);
					if (isOwnProfile !== newIsOwnProfile) {
						featuredPostsLoaded = false;
					}
					
					isOwnProfile = newIsOwnProfile;
					// DO NOT REDIRECT if isOwnProfile. Always allow viewing this page.
					await loadStarredPostIds();
					await loadFavoritedProfiles();
					
					// Only load featured posts if not already loaded
					if (!featuredPostsLoaded) {
						await maybeLoadFeaturedPosts();
					}
					
					// Mark loading as complete after all data is loaded
					isLoading = false;
					userPostsLoading = false;
				}
			}
		});
	});

	$: groupedPosts = groupPostsByFence(userPosts);

	// Use grouped posts directly without single/multi location separation
	$: displayGroups = Array.from(groupedPosts.entries());

	onDestroy(() => {
		if (authSubscription) authSubscription();
	});

	$: showConnectionButtons = $auth.isLoggedIn && !isOwnProfile && profileData.email && $auth.email !== profileData.email;

	async function handleStarToggle(event: any) {
		const { postId, isCurrentlyStarred } = event.detail;
		console.log('Profile [username] - handleStarToggle:', postId, isCurrentlyStarred);
		
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
		} catch (e) {
			console.error('Error toggling star:', e);
		}
	}
</script>

<div class="container">
	<!-- Success/Error Messages -->
	{#if successMessage}
		<div class="success-banner">
			<strong>Success!</strong> {successMessage}
		</div>
	{/if}
	{#if errorMessage && !isLoading}
		<div class="error-banner">
			<strong>Error:</strong> {errorMessage}
		</div>
	{/if}

	{#if data.error && $auth.isLoggedIn}
		<div class="container profile-error">
			<h1>User Not Found</h1>
			<p>{data.error.body.message}</p>
			<button class="primary-btn" on:click={() => goto('/')}>
				Back to Home
			</button>
		</div>
	{:else if data.error && !$auth.isLoggedIn}
		<div class="loading">
			Loading profile...
		</div>
	{:else if $auth && $auth.isLoggedIn}
		<div class="profile-card">
			<div class="container-1-profile"
				style="background-image: url('{profileData.backgroundImageUrl || defaultBackgroundSvg1}');"
			>
				<div class="profile-left-section">
					<div class="profile-avatar-container">
						<img
							src={profileData.profileImageUrl || defaultAvatarSvg}
							alt="Profile picture"
							class="profile-avatar"
							on:error={(e) => {
								// @ts-ignore
								e.currentTarget.src = defaultAvatarSvg;
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
					<!-- Social Links Section -->
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

				<!-- Add to Favorites Button - Repositioned to upper right of container 1 -->
				{#if !isOwnProfile}
					<div class="favorite-button-container-upper-right">
						<button 
							class="favorite-btn-upper-right" 
							class:favorited={isProfileFavorited}
							on:click={toggleProfileFavorite}
							title={isProfileFavorited ? 'Remove from favorites' : 'Add to favorites'}
						>
							<svg width="18" height="18" viewBox="0 0 20 20" fill={isProfileFavorited ? '#f59e0b' : 'none'} stroke={isProfileFavorited ? '#f59e0b' : '#fff'} stroke-width="1.5">
								<path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"/>
							</svg>
						</button>
					</div>
				{/if}

				<div class="profile-right-section">
					<!-- Bio section right below avatar -->
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
							{#if profileData.showProfileViews !== false}
								<div class="profile-detail-item"><strong>Profile Views:</strong> {profileData.profileViews}</div>
							{/if}
							<div class="profile-detail-item">
								<strong>Connections:</strong>
								{#if (profileData.showConnectionsTo === 'everyone' || profileData.showConnectionsTo === 'buddies' || profileData.showConnectionsTo === 'connected' || profileData.showConnectionsTo === undefined)}
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
					

					
					<!-- Connection buttons for non-own profiles -->
					{#if showConnectionButtons}
						<div class="connection-actions">
							{#if connectionStatus === 'none'}
								<div class="action-buttons-row">
									<button class="connection-btn primary" on:click={handleConnect}>
										Connect with {profileData.username}
									</button>
									<!-- No message button when not connected -->
								</div>
							{:else if connectionStatus === 'connected' || connectionStatus === 'buddies'}
								<div class="action-buttons-row">
									<div class="connection-status-wrapper">
										<button class="connection-btn status-btn" on:click={() => showConnectDropdown = !showConnectDropdown}>
											{connectionStatus === 'buddies' ? 'Buddies' : 'Connected'}
										</button>
										{#if showConnectDropdown}
											<div class="dropdown-menu">
												{#if connectionStatus === 'buddies'}
													<button class="dropdown-item" on:click={handleDetach}>
														Detach
													</button>
												{:else}
													<button class="dropdown-item" on:click={handleDisconnect}>
														Disconnect
													</button>
												{/if}
												<button class="dropdown-item" on:click={handleBlock}>
													Block
												</button>
											</div>
										{/if}
									</div>
									
									<!-- Message button - side by side with Connected button -->
									<button class="connection-btn secondary" on:click={handleMessage}>
										Message
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<!-- Add to Buddies button - positioned in lower right of container 1 -->
				{#if connectionStatus === 'connected'}
					<div class="buddy-upgrade-container">
						<button class="buddy-upgrade-btn" on:click={handleUpgradeToBuddy}>
							Add to Buddies
						</button>
					</div>
				{/if}
			</div>

			<!-- Posts Section (Container 3) -->
			<div class="container-3-posts"
				style="background-image: url('{profileData.backgroundImageUrl2 || defaultBackgroundSvg2}');
				background-size: cover;
				background-repeat: no-repeat;
				background-position: center;
				background-attachment: fixed;"
			>
					<div class="posts-header">
						<div class="tabs">
							<button class="tab-btn" class:active={!showStarredPosts && !showFeaturedPosts && !showRepostsPosts} on:click={() => { showStarredPosts = false; showFeaturedPosts = false; showRepostsPosts = false; }}>
								<i class="fas fa-newspaper"></i>
								Posts
							</button>
							<button class="tab-btn" class:active={showFeaturedPosts} on:click={() => {
								if (!showFeaturedTab) {
									maybeLoadFeaturedPosts();
								}
								showStarredPosts = false;
								showFeaturedPosts = true;
								showRepostsPosts = false;
							}} disabled={!showFeaturedTab}>
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
							<button class="tab-btn" class:active={showRepostsPosts} on:click={() => { showStarredPosts = false; showFeaturedPosts = false; showRepostsPosts = true; }}>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
									<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7z"/>
									<path d="M17 17H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
								</svg>
								Reposts
							</button>
							<button class="tab-btn" class:active={showStarredPosts} on:click={() => { showStarredPosts = true; showFeaturedPosts = false; showRepostsPosts = false; }}>
								<img src="/images/icons/star-featured.svg" alt="Starred" class="btn-icon" />
								Starred
							</button>
						</div>
					</div>

					{#if showFeaturedPosts && showFeaturedTab}
						<div class="featured-posts-section">
							<h3>Featured Posts</h3>
							{#if loadingFeatured}
								<div class="loading-indicator">Loading featured posts...</div>
							{:else if featuredPosts.length === 0}
								<p class="no-data">No featured posts available.</p>
							{:else}
								<div class="posts-grid featured-posts-grid">
									{#each featuredPosts as post (post.id)}
										<PostItem {post} isFeatured={true} isStarred={starredPostIds.has(post.id)} on:toggleStar={handleStarToggle} />
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
								<div class="posts-list">
									{#each userPosts.filter(post => starredPostIds.has(post.id)) as post (post.id)}
										<PostItem {post} isStarred={true} on:toggleStar={handleStarToggle} />
									{/each}
								</div>
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
								<div class="posts-grid">
									{#each repostsPosts as post (post.id)}
										<div class="post-item-container">
											<PostItem {post} isStarred={starredPostIds.has(post.id)} on:toggleStar={handleStarToggle} />
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if !showStarredPosts && !showFeaturedPosts && !showRepostsPosts}
						<div class="regular-posts-section">
							{#if userPosts.length === 0}
								<p class="no-data">No posts yet.</p>
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
													<PostItem {post} isStarred={starredPostIds.has(post.id)} on:toggleStar={handleStarToggle} />
												</div>
											{/each}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="loading">Loading...</div>
		{/if}

	<!-- Enlarged Post Modal -->
	{#if enlargedPost}
		<div class="modal-backdrop">
			<div class="modal enlarged-post-modal">
				<div class="modal-header">
					<h3>Post Details</h3>
					<button class="close-btn" on:click={closeEnlargedPost}>✕</button>
				</div>
				<div class="modal-content">
					<div class="post-header">
						<img
							src={enlargedPost.profileImageUrl || '/images/default-profile.jpg'}
							alt="Profile"
							class="post-author-avatar"
							on:error={(e) => {
								// @ts-ignore
								e.currentTarget.src = '/images/default-profile.jpg';
							}}
						/>
						<div class="post-author-info">
							<h4>@{enlargedPost.ownerUsername || 'Unknown'}</h4>
							<p class="post-timestamp">{new Date(enlargedPost.createdAt).toLocaleDateString()}</p>
						</div>
					</div>
					
					<div class="post-actions-bar">
						<button class="action-btn" on:click={handleOpenComments}>Comments</button>
						{#if enlargedPost}
							{#if enlargedPost.hasExactLocation === true}
								<button class="action-btn" on:click={() => enlargedPost && handleSeeOnMap(enlargedPost)}>See on Map</button>
							{/if}
							{#if enlargedPost && enlargedPost.ownerEmail === $auth.email}
								<button class="action-btn danger" on:click={() => enlargedPost && handleDeletePost(enlargedPost.id)}>Delete Post</button>
							{/if}
						{/if}
					</div>
					{#if showCommentsInModal && enlargedPost}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div class="modal-backdrop" on:click={() => (showCommentsInModal = false)} role="dialog" aria-modal="true">
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="comments-modal-content" on:click|stopPropagation>
								<div class="comments-modal-header">
									<h3>Comments for: {enlargedPost.headline || enlargedPost.content || 'Post'}</h3>
									<button class="close-btn" on:click={() => (showCommentsInModal = false)} aria-label="Close comments">&times;</button>
								</div>
								<CommentsSection
									postId={enlargedPost.id}
									userEmail={$auth.email}
									token={$auth.token}
								/>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Connections Modal -->
	{#if showConnectionsModal}
		<div class="modal-backdrop">
			<div class="modal connections-modal">
				<div class="modal-header">
					<h3>Connections ({profileData.connectionCount || 0})</h3>
					<button class="close-btn" on:click={closeConnectionsModal}>✕</button>
				</div>
				<div class="modal-content">
					{#if profileData.connections && profileData.connections.length > 0}
						<div class="connections-grid">
							{#each profileData.connections as connection}
								<div class="connection-item">
									<img
										src={connection.profileImageUrl || '/images/default-profile.jpg'}
										alt="Profile"
										class="connection-avatar"
										on:error={(e) => {
								// @ts-ignore
								e.currentTarget.src = '/images/default-profile.jpg';
							}}
									/>
									<div class="connection-info">
										<div class="connection-username">@{connection.username || 'Unknown'}</div>
										<div class="connection-type">
											{connection.mutual ? 'Buddy' : 'Connected'}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p>No connections yet.</p>
					{/if}
				</div>
				<button type="button" on:click={closeConnectionsModal} class="cancel-btn">Close</button>
			</div>
		</div>
	{/if}

	<!-- Buddies Modal -->
	{#if showBuddiesModal}
		<div class="modal-backdrop">
			<div class="modal buddies-modal">
				<div class="modal-header">
					<h3>Buddies ({profileData.buddyCount || 0})</h3>
					<button class="close-btn" on:click={closeBuddiesModal}>✕</button>
				</div>
				<div class="modal-content">
					{#if profileData.connections && profileData.connections.filter(conn => conn.mutual === true).length > 0}
						<div class="connections-grid">
							{#each profileData.connections.filter(conn => conn.mutual === true) as buddy}
								<div class="connection-item">
									<img
										src={buddy.profileImageUrl || '/images/default-profile.jpg'}
										alt="Profile"
										class="connection-avatar"
										on:error={(e) => {
								// @ts-ignore
								e.currentTarget.src = '/images/default-profile.jpg';
							}}
									/>
									<div class="connection-info">
										<div class="connection-username">@{buddy.username || 'Unknown'}</div>
										<div class="connection-type">Buddy</div> <!-- Using mutual=true property -->
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p>No buddies yet.</p>
					{/if}
				</div>
				<button type="button" on:click={closeBuddiesModal} class="cancel-btn">Close</button>
			</div>
		</div>
	{/if}
</div>

<style>
    /* Global Reset & Base Styling */
    :root {
        --primary-color: #00d9ff; /* Electric blue */
        --secondary-color: #deeeee; /* Deep purple */
        --background-color: #ffffff; /* Dark, near-black */
        --card-background: linear-gradient(200deg, #ffffff 60%, #2689cc 100%);
        --text-color: #50f8f8; /* Light gray text */
        --border-color: #9df7f7; /* Subtle border for definition */
        --shadow: 0 8px 24px rgba(0, 217, 255, 0.15); /* Electric blue shadow */
        --gradient-1: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        --gradient-2: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    :global(html), :global(body) {
        background: #ffffff !important;
        min-height: 100vh;
        margin: 0;
        padding: 0;
    }

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

    .container-1-profile {
        background: transparent;
        position: relative;
        height: 400px;
        margin: 2rem;
        margin-bottom: 1rem;
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

    .profile-left-section, .profile-right-section {
        position: relative;
        z-index: 2;
    }

    @media (max-width: 768px) {
        .container-1-profile {
            flex-direction: column;
            align-items: center;
        }
    }

    .profile-left-section {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        z-index: 10;
        position: relative;
    }

    .profile-avatar-container {
        z-index: 10;
		padding-top: 0.5rem;
		padding-left: 0.5rem;
    }

    .profile-avatar {
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

    .bio-container {
        z-index: 10;
        margin-top: 0.1rem;
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
		margin-top: 0.5rem;
    }

    .bio-text {
        font-size: 1rem;
        line-height: 1.3;
        margin: 0;
		font-family:'Inter';
    }

	.bio-bubble:hover {
        transform: scale(1.07);
        border-color: #fff;
        box-shadow: 0 0 15px 8px #ffffff; /* blue glow */
	}

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

    .connection-button {
        background: none;
        border: none;
        color: var(--primary-color);
        cursor: pointer;
        font-weight: 600;
        text-decoration: underline;
        transition: color 0.2s ease;
    }

    .connection-button:hover {
        color: #fff;
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


    .profile-right-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        z-index: 10;
        position: relative;
		max-width: 380px;
    }

    .container-3-posts {
		display: flex;                  /* Makes the container a flexbox for vertical layout */
		flex-direction: column;         /* Stacks children vertically */
		height: 1vw;                   /* Sets height relative to viewport width */
		max-height: 100vh;               /* Limits height to 90% of viewport height */
		gap: 2rem;                    /* Adds vertical space between children */
		background-color: #ffffff;      /* Fallback color if no background image */
		box-shadow: 0 4px 16px rgba(30, 58, 138, 0.05); /* Subtle shadow for depth */
		color: #222;                    /* Text color inside the container */
		margin-top: 0.3rem;             /* Space above the container */
		z-index: 20;                     /* Stacking order for layering */
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

    .posts-header {
        position: relative;
        z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.8rem;
		margin-bottom: -1rem;
		height: 20px;
    }

    .tabs {
        display: flex;
        gap: 6rem;
        justify-content: center;
		flex: 1 1 auto;
		margin-bottom: 1rem;
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
		z-index: 100;
		margin-top: 0.8rem;
		scrollbar-width: none; 
		-ms-overflow-style: none;  /* IE and Edge */
		/* Optional: add background if needed */
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

    .posts-grid, .posts-list {
        column-count: 3;
        column-gap: 1.5rem;
        width: 100%;
        padding: 1rem 0;
    }

    .post-item-container {
        break-inside: avoid;
        margin-bottom: 1.5rem;
        display: inline-block;
        width: 100%;
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

    .success-banner {
        background: linear-gradient(90deg, #10b981, #34d399);
        color: white;
        padding: 1rem 2rem;
        border-radius: 15px;
        margin-bottom: 1rem;
        text-align: center;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    }

    .error-banner {
        background: linear-gradient(90deg, #ef4444, #f87171);
        color: white;
        padding: 1rem 2rem;
        border-radius: 15px;
        margin-bottom: 1rem;
        text-align: center;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    }

    .profile-error {
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 3rem;
        border-radius: 20px;
        text-align: center;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    .profile-error h1 {
        margin-bottom: 1rem;
        font-size: 2rem;
    }

    .primary-btn {
        background: var(--primary-color);
        color: #000;
        border: none;
        padding: 1rem 2rem;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 1rem;
    }

    .primary-btn:hover {
        background: #00c4e6;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 217, 255, 0.4);
    }

    .loading {
        text-align: center;
        color: var(--primary-color);
        font-size: 2rem;
        padding: 5rem;
    }

    /* Connection Actions */
    .connection-actions {
        width: 100%;
        max-width: 400px;
        margin-top: 1rem;
    }

    .connection-btn {
        padding: 1rem 1rem;
        border-radius: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        backdrop-filter: blur(10px);
        justify-content: center;
		min-width: fit-content;
    	white-space: nowrap;
		font-family: 'Inter', sans-serif;
    }

    .connection-btn.primary {
        background: #00000096;
        color: var(--primary-color);
        border-color: #fff;
        box-shadow: 0 8px 16px rgba(0, 217, 255, 0.4);
    }

	.connection-btn.primary:hover {
		background: #83f3e0;
		color: #000;
		border-color: var(--primary-color);
	}

    .connection-btn.secondary {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .connection-btn.secondary:hover {
        background: rgba(0, 217, 255, 0.3);
        border-color: var(--primary-color);
    }

	.connection-btn.status-btn:hover {
		background: #00c4e685;
		color: #000; /* Make text black on blue */
	}

    .connected-status {
        text-align: center;
        background: rgba(0, 0, 0, 0.5);
        padding: 1rem;
        border-radius: 10px;
        backdrop-filter: blur(10px);
    }

    .status-text {
        color: #fff;
        font-weight: 600;
        margin-bottom: 0.5rem;
        display: block;
    }

    .connection-actions-dropdown {
        position: relative;
    }

    .dropdown-menu {
        position: absolute;
        top: 0;
        left: 105%;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 10px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 100;
        margin-left: 0.5rem;
		min-width: 150px;
    }

    .dropdown-item {
        background: none;
        border: none;
        color: #fff;
        padding: 0.75rem 1rem;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background 0.2s ease;
    }

    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }

	.connect-back-notice {
        text-align: center;
        background: rgba(0, 0, 0, 0.5);
        padding: 1rem;
        border-radius: 10px;
        backdrop-filter: blur(10px);
    }

    .connect-back-notice p {
        color: #fff;
        margin-bottom: 1rem;
    }

    .connect-back-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
    }

    .connect-back-actions .connection-btn {
        width: auto;
        margin-bottom: 0;
    }

    /* Modal Styles */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .modal {
        background: rgba(8, 0, 46, 0.95);
        border-radius: 20px;
        padding: 2rem;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .comments-modal-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 9999999;
    }

    .comments-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 20px 10px 20px;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        background: white;
        z-index: 1;
    }

    .comments-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #1f2937;
        max-width: 80%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        margin: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    }

    .close-btn:hover {
        background-color: #f3f4f6;
        color: #374151;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-header h3 {
        color: #fff;
        margin: 0;
        font-size: 1.5rem;
    }

    .close-btn {
        background: none;
        border: none;
        color: #fff;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        transition: background 0.2s ease;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .modal-content {
        color: #fff;
    }

    .connections-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .connection-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        transition: background 0.2s ease;
    }

    .connection-item:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .connection-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--primary-color);
    }

    .connection-info {
        flex: 1;
    }

    .connection-username {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .connection-type {
        font-size: 0.875rem;
        color: var(--primary-color);
    }

    .cancel-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.75rem 1.5rem;
        border-radius: 10px;
        cursor: pointer;
        margin-top: 1rem;
        transition: all 0.2s ease;
        width: 100%;
    }

    .cancel-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .enlarged-post-modal {
        max-width: 800px;
    }

    .post-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .post-author-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--primary-color);
    }

    .post-author-info h4 {
        margin: 0;
        color: #fff;
    }

    .post-timestamp {
        margin: 0;
        color: #ccc;
        font-size: 0.875rem;
    }

    .post-actions-bar {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .action-btn {
        background: var(--primary-color);
        color: #000;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease;
    }

    .action-btn:hover {
        background: #00c4e6;
        transform: translateY(-1px);
    }

    .action-btn.danger {
        background: #ef4444;
        color: #fff;
    }

    .action-btn.danger:hover {
        background: #dc2626;
    }

    /* Connection Action Styles */
    .connection-actions {
        margin-top: 1rem;
    }

    .action-buttons-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
		justify-content: center;
		margin-left: 0;
    }

    .connection-status-wrapper {
        position: relative;
		display: inline-block;
    }

    .connection-btn {
        background: #000000a4;
        color: var(--background-color);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 14px;
        cursor: pointer;
        font-weight: 700;
        font-size: 1.25rem;
        transition: all 0.2s ease;
        min-width: fit-content;
        white-space: nowrap;
		margin-top: -1rem;
		font-family: 'Inter', sans-serif;
    }

    .connection-btn:hover {
        background: #00c4e6;
        transform: translateY(-1px);
    }

    .connection-btn.primary {
        background: var(--primary-color);
        color: #000;
    }

    .connection-btn.secondary {
        background: rgba(0, 217, 255, 0.2);
        color: var(--primary-color);
        border: 1px solid var(--primary-color);
    }

    .connection-btn.secondary:hover {
        background: rgba(0, 217, 255, 0.3);
    }

    .connection-btn.status-btn {
        background: #000000a4;
        color: var(--primary-color);
		border: 1px solid var(--primary-color);
    }

    .connection-btn.status-btn:hover {
        background: var(--primary-color);
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        padding: 0;
        z-index: 1000;
        min-width: 120px;
        margin-top: 0.4rem;
        box-shadow: 0 4px 15px rgba(0, 217, 255, 0.3);
    }

    .dropdown-item {
        display: block;
        width: 100%;
        padding: 0.6rem 1rem;
        background: none;
        border: none;
        color: #fff;
        text-align: left;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s ease;
    }

    .dropdown-item:hover {
        background: rgba(0, 217, 255, 0.2);
        color: var(--primary-color);
    }

    .connect-back-notice {
        background: rgba(0, 217, 255, 0.1);
        border: 1px solid var(--primary-color);
        border-radius: 12px;
        padding: 1rem;
        margin-top: 1rem;
    }

    .connect-back-notice p {
        margin: 0 0 1rem 0;
        color: #fff;
        font-size: 0.95rem;
    }

    @media (max-width: 768px) {
        .container {
            padding: 1rem;
        }
        
        .container-1-profile, .container-3-posts {
            padding: 1.5rem;
        }
        
        .profile-avatar {
            width: 200px;
            height: 200px;
        }
        
        .username {
            font-size: 2.5rem;
        }
        
        .posts-grid {
            grid-template-columns: 1fr;
        }
        
        .tabs {
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .tab-btn {
            font-size: 1rem;
            padding: 0.75rem 1rem;
        }
    }
    
    /* New Favorite button styles - upper right of container 1 */
    .favorite-button-container-upper-right {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10;
    }

    .favorite-btn-upper-right {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        border: none;
        padding: 8px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .favorite-btn-upper-right:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    .favorite-btn-upper-right.favorited {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }

    /* Buddy upgrade button - positioned in lower right of container 1 */
    .buddy-upgrade-container {
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 10;
    }

    .buddy-upgrade-btn {
        background: linear-gradient(135deg, #54abfc48, #19e4f3a4);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .buddy-upgrade-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(255, 107, 107, 0.3);
    }

    .favorite-btn-repositioned:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
        background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    }

    .favorite-btn-repositioned.favorited {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .favorite-btn-repositioned.favorited:hover {
        background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
        box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
    }
    
    .favorite-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: linear-gradient(135deg, #ffffff 0%, #3b82f6 100%);
        color: #1f2937;
        border: 2px solid #ffffff;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    
    .favorite-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        border-color: #3b82f6;
    }
    
    .favorite-btn.favorited {
        background: linear-gradient(135deg, #f59e0b 0%, #ffffff 100%);
        border-color: #f59e0b;
        color: #1f2937;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
    
    .favorite-btn.favorited:hover {
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }
</style>

<!-- Messages Overlay -->
<MessagesOverlay
    conversation={selectedConversation}
    onClose={() => selectedConversation = null}
/>