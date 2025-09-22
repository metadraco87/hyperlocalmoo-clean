<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { auth } from '$lib/stores/auth.js';
    import { userLocation, preferredLocation } from '$lib/stores/preferredLocationStore.js';
    import { fetchPosts, fetchComments, fetchWikipediaPreview } from '$lib/api.js';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { PUBLIC_API_BASE_URL } from '$env/static/public';
    import { writable, get, derived } from 'svelte/store';
    import { page } from '$app/stores';
    import { fetchPostsCount } from '$lib/api.js';
    import { featurePost } from '$lib/api'; 

    // Components
    import LocationMap from '$lib/components/LocationMap.svelte';
    import LocationSetupOverlay from '$lib/components/LocationSetupOverlay.svelte';
    import CreatePostOverlay from '$lib/components/CreatePostOverlay.svelte';
    import SearchPosts from '$lib/components/SearchPosts.svelte';
    import MapOptions from '$lib/components/MapOptions.svelte';
    import PostList from '$lib/components/PostList.svelte';
    import PostItem from '$lib/components/PostItem.svelte';
    import CommentsSection from '$lib/components/CommentsSection.svelte';
    import type { Post } from '$lib/api';
    import { onNavigate } from '$app/navigation';

    // Cache for original posts to avoid duplicate fetches
    const originalPostsCache = new Map<string, Post>();

    // Function to convert API post format to local Post interface
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

    // Function to fetch original post data for reposts
    async function fetchOriginalPost(originalPostId: string): Promise<Post | null> {
        if (originalPostsCache.has(originalPostId)) {
            return originalPostsCache.get(originalPostId)!;
        }

        try {
            const response = await fetch(`/api/posts/${originalPostId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken || ''}`
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

    // Function to enhance posts with original post data for reposts (for backwards compatibility)
    async function enhancePostsWithOriginals(posts: any[]): Promise<any[]> {
        console.log('posts/+page.svelte: Enhancing posts with originals, count:', posts.length);
        const enhanced = await Promise.all(
            posts.map(async (post) => {
                if (post.isRepost && post.originalPostId && !post.originalPost) {
                    // Only fetch if originalPost is not already embedded
                    console.log('posts/+page.svelte: Found repost without embedded originalPost:', post.id, 'original ID:', post.originalPostId);
                    try {
                        const originalPost = await fetchOriginalPost(post.originalPostId);
                        if (originalPost) {
                            console.log('posts/+page.svelte: Successfully fetched original post:', originalPost.id);
                            return {
                                ...post,
                                originalPost: convertApiPostToLocalPost(originalPost)
                            };
                        } else {
                            console.warn('posts/+page.svelte: Could not fetch original post for repost:', post.id);
                        }
                    } catch (error) {
                        console.error('posts/+page.svelte: Error fetching original post for repost:', post.id, error);
                    }
                } else if (post.isRepost && post.originalPost) {
                    console.log('posts/+page.svelte: Repost already has embedded originalPost:', post.id);
                }
                return post;
            })
        );
        return enhanced;
    }

    // --- Svelte Store States ---
    let userEmail: string | null = null;
    let isLoggedIn = false;
    let authToken: string | null = null;
    let isAuthLoaded = false;
    let hasInitialPostsFetched = false;

    let currentPreferredLocation: {
        name: string;
        lat: number;
        lng: number;
        zoom: number;
        bounds?: any;
        locationType?: string;
    } | null = null;
    let userLocationStatus: boolean = false;
    const _currentMapDisplayState = writable({ lat: 0, lng: 0, zoom: 8, initialized: false });
    const mapDisplayLocation = derived(
        _currentMapDisplayState,
        ($state) => {
            if ($state.lat === 0 && $state.lng === 0 && !$state.initialized) {
                return null;
            }
            return {
                lat: $state.lat,
                lng: $state.lng,
                zoom: $state.zoom,
                locationType: currentPreferredLocation?.locationType
            };
        }
    );

    // --- User Count State ---
    let userCount: number | null = null;
    let loadingUserCount: boolean = false;
    let userCountError: string | null = null;
    let showUserCountTooltip = false;
    let userCountTooltipRef: HTMLDivElement | null = null;

    function handleUserCountClick(event: MouseEvent) {
        showUserCountTooltip = !showUserCountTooltip;
        event.stopPropagation();
    }
    function handleClickOutside(event: MouseEvent) {
        if (showUserCountTooltip && userCountTooltipRef && !userCountTooltipRef.contains(event.target as Node)) {
            showUserCountTooltip = false;
        }
        if (showPostsCountTooltip && postsCountTooltipRef && !postsCountTooltipRef.contains(event.target as Node)) {
            showPostsCountTooltip = false;
        }
    }

    // --- Debugging Feature Post
    let paymentMessage = '';
    let paymentError = '';

    // --- Posts Count State (NEW) ---
    let postsCount: number | null = null;
    let showPostsCountTooltip = false;
    let postsCountTooltipRef: HTMLDivElement | null = null;

    function handlePostsCountClick(event: MouseEvent) {
        showPostsCountTooltip = !showPostsCountTooltip;
        event.stopPropagation();
    }
    function handlePostsCountMouseEnter() { showPostsCountTooltip = true; }
    function handlePostsCountMouseLeave() { showPostsCountTooltip = false; }
    
    // --- Comments Overlay State ---
    let showCommentsOverlay = false;
    let selectedPostForComments: any | null = null;

    // --- Component Data / UI State ---
    let posts = [];
    let postFetchError = '';
    let loadingPosts = true;
    let showLocationSetup = false;

    let showCreatePostOverlay = false;
    let isMapPinningMode = false;
    let mapPinLocation: { lat: number; lng: number } | null = null;
    let mapPinZoom: number | null = null;
    let mapType = 'roadmap';
    let currentSearchTerm: string = '';
    let wikipediaPreviews: { [key: string]: { title: string; extract: string; thumbnail?: string; pageid: number; url: string } } = {};
    const postDraft = writable({ content: '', headline: '', imageUrl: '', mediaUrl: '', category: 'COMMUNITY', link: '' });
    let highlightedPostId: string | null = null;
    
    // Track the current location name to prevent duplicate fetches
    let lastFetchedLocationName = '';

    // --- Category Filter State ---
    const categories = [
        'ALERTS',
        'NEWS',
        'EVENTS',
        'JOBS',
        'TASKS',
        'BUSINESSES',
        'POINTS OF INTEREST',
        'COMMUNITY',
        'GENERAL INFORMATION'
    ];
    const categoryColors = {
        'ALERTS': '#eef119',
        'NEWS': '#1a1919',
        'EVENTS': '#b80a0',
        'JOBS': '#18038b',
        'TASKS': '#350249',
        'BUSINESSES': '#046909',
        'POINTS OF INTEREST': '#e44303',
        'COMMUNITY': '#00eaff',
        'GENERAL INFORMATION': '#1f2124'
    };
    const activeCategories = writable(new Set(categories));
    
    // Initialize filteredPosts as empty array
    let filteredPosts = [];
    
    // Filter posts when posts array or active categories change
    $: {
        // Ensure posts is always treated as an array
        const postsArray = Array.isArray(posts) ? posts : [];
        
        if (postsArray.length > 0) {
            // Create a new array to ensure reactivity - filter out reposts (they only show in profile reposts tab)
            console.log('POSTS PAGE FILTERING DEBUG (categories):', {
                totalPosts: postsArray.length,
                repostsInArray: postsArray.filter(p => p.isRepost).length,
                activeCategoriesSize: $activeCategories.size
            });
            filteredPosts = [...postsArray].filter(post => $activeCategories.has(post.category));
            console.log('POSTS PAGE AFTER FILTERING (categories):', {
                filteredPostsCount: filteredPosts.length,
                repostsInFilteredArray: filteredPosts.filter(p => p.isRepost).length
            });
        } else {
            filteredPosts = [];
        }
        // console.log(`Filtered posts updated: ${filteredPosts.length} posts after filtering from ${Array.isArray(posts) ? posts.length : 0} total posts`);
    }

    // --- Category Display Names for Tooltip ---
    const categoryDisplayNames = {
        'ALERTS': 'Alerts',
        'NEWS': 'News',
        'EVENTS': 'Events',
        'JOBS': 'Jobs',
        'TASKS': 'Tasks',
        'BUSINESSES': 'Businesses',
        'POINTS OF INTEREST': 'Points of Interest',
        'COMMUNITY': 'Community',
        'GENERAL INFORMATION': 'General Information'
    };

    // --- HOVER STATE for category icons ---
    import { tick } from 'svelte';
    let hoveredCategory: string | null = null;
    let categoryTooltipPos = { top: 0, left: 0 };
    let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleCategoryMouseEnter(event: MouseEvent, category: string) {
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
        hoveredCategory = category;
        // Position tooltip next to the icon (right side)
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        categoryTooltipPos = {
            top: rect.top + rect.height / 2,
            left: rect.right + 12
        };
    }
    function handleCategoryMouseLeave() {
        tooltipTimeout = setTimeout(() => {
            hoveredCategory = null;
        }, 120);
    }

// Utility for lightening a color (hex) for gradients
export function lighten(hex: string, percent: number) {
    // Clamp percent
    percent = Math.min(100, Math.max(0, percent));
    // Remove hash
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    let num = parseInt(hex, 16);
    let r = (num >> 16) + Math.round(2.55 * percent);
    let g = ((num >> 8) & 0x00FF) + Math.round(2.55 * percent);
    let b = (num & 0x0000FF) + Math.round(2.55 * percent);
    r = Math.min(255, r);
    g = Math.min(255, g);
    b = Math.min(255, b);
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

    // --- General Information Modal State ---
    let showWikiModal = false;
    let wikiPreview: { title: string; extract: string; thumbnail?: string; pageid: number; url: string } | null = null;
    let wikiLoading = false;
    let wikiError = '';

  // --- Debounce Timers ---
  let mapMoveEndDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const MAP_DEBOUNCE_TIME_MS = 500;
  let searchTermDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const SEARCH_DEBOUNCE_TIME_MS = 300;

  // --- Svelte Store Subscriptions ---
  let authSubscription: (() => void) | null = null;
  let locationSubscription: (() => void) | null = null;

  // --- Stripe Success Feature Handler ---
  async function handleStripeSuccess() {
    if (browser) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('featureSuccess') === '1' && params.get('session_id')) {
        const paymentId = params.get('session_id');
        let postId = localStorage.getItem('featurePostId');
        const type = localStorage.getItem('featureType');
        const duration = localStorage.getItem('featureDuration');
        
        // Wait for auth to be initialized and have a token
        if (!get(auth).isLoggedIn || !get(auth).token) {
          // console.log("[Stripe Feature] Waiting for auth to be ready...");
          await new Promise(resolve => {
            const unsubscribe = auth.subscribe(value => {
              if (value.isLoggedIn && value.token) {
                unsubscribe();
                resolve(true);
              }
            });
          });
        }
        
        const token = get(auth).token;

        // console.log("[Stripe Feature] Retrieved data:", { 
        //   postId, 
        //   type, 
        //   duration, 
        //   paymentId: paymentId ? paymentId.substring(0, 10) + '...' : null,
        //   hasToken: !!token 
        // });

        // Only proceed if all values exist
        if (postId && type && duration && paymentId && token) {
          try {
            // console.log("Processing feature payment:", { postId, type, duration, paymentId: paymentId.substring(0, 10) + '...' });
            const result = await featurePost(postId, type as 'location' | 'search', Number(duration), paymentId, token);
            // console.log("Post featured successfully:", result);
            paymentMessage = "Post featured successfully!";
            
            // Reload posts after feature
            if (isAuthLoaded && currentPreferredLocation) {
              // Force delay to ensure database is updated
              setTimeout(async () => {
                await fetchPostsForLocation(
                  currentPreferredLocation.lat, 
                  currentPreferredLocation.lng, 
                  currentSearchTerm
                );
                // console.log("Posts reloaded after feature update");
              }, 1000);
            }
          } catch (e) {
          // console.error("Failed to feature post after Stripe payment", e);
            paymentError = "Failed to feature post: " + (e.message || "Unknown error");
          }
        } else {
          // console.error("[Stripe Feature] Missing data:", { postId, type, duration, paymentId, hasToken: !!token });
          paymentError = "Missing data for featuring post";
          
          // Try to recover by manually setting data for testing
          if (!postId && params.has('postId')) {
            postId = params.get('postId');
            // console.log("[Stripe Feature] Recovered postId from URL:", postId);
          }
        }

        // Clean up localStorage and remove query params
        localStorage.removeItem('featurePostId');
        localStorage.removeItem('featureType');
        localStorage.removeItem('featureDuration');
        
        // Use SvelteKit navigation API instead of direct history manipulation
        goto('/posts', { replaceState: true });
      }
    }
  }

  onMount(async () => {
    if (!browser) return;
    window.addEventListener('click', handleClickOutside);

    // Call the handleStripeSuccess function to process Stripe redirects
    await handleStripeSuccess();

    if ($page.url.searchParams.get('showLocationSetup') === 'true') {
        showLocationSetup = true;
        const url = new URL($page.url);
        url.searchParams.delete('showLocationSetup');
        history.replaceState({}, '', url.toString());
    }

    // Check if we should show the create post overlay
    if ($page.url.searchParams.get('showCreatePost') === 'true') {
        showCreatePostOverlay = true;
        const url = new URL($page.url);
        url.searchParams.delete('showCreatePost');
        history.replaceState({}, '', url.toString());
    }

    // Check if we already have location data and auth loaded
    const currentAuth = get(auth);
    const currentUserLocation = get(userLocation);
    
    if (currentAuth.isLoggedIn && 
        currentAuth.token && 
        currentUserLocation.userLocationStatus && 
        currentUserLocation.preferredLocation) {
        // console.log('Posts page mounted with existing location and auth, triggering immediate fetch');
        // We have auth and location data ready, fetch posts immediately
        currentPreferredLocation = currentUserLocation.preferredLocation;
        isLoggedIn = currentAuth.isLoggedIn;
        userEmail = currentAuth.email;
        authToken = currentAuth.token;
        isAuthLoaded = true;
        
        // Trigger an immediate fetch for the current location
        fetchPostsForLocation(
            currentUserLocation.preferredLocation.lat,
            currentUserLocation.preferredLocation.lng,
            currentSearchTerm
        );
        
        if (currentPreferredLocation.name) {
            fetchUserCountFlexible(currentPreferredLocation.name);
            fetchCurrentLocationPostsCount();
        }
    }

    authSubscription = auth.subscribe(value => {
        isLoggedIn = value.isLoggedIn;
        userEmail = value.email;
        authToken = value.token;
        isAuthLoaded = value.isAuthLoaded;
        if (browser && !isLoggedIn && isAuthLoaded && window.location.pathname !== '/login') {
            goto('/login', { replaceState: true });
        }
    });
    locationSubscription = userLocation.subscribe(storeValue => {
        const prevPreferredLocation = currentPreferredLocation;
        currentPreferredLocation = storeValue.preferredLocation;
        userLocationStatus = storeValue.userLocationStatus;

        if (!userLocationStatus || !currentPreferredLocation?.lat || !currentPreferredLocation?.lng) {
            showLocationSetup = true;
            _currentMapDisplayState.set({ lat: 0, lng: 0, zoom: 8, initialized: false });
            posts = [];
            loadingPosts = false;
        } else {
            showLocationSetup = false;

            const hasLocationChanged = (
                !prevPreferredLocation ||
                prevPreferredLocation.lat !== currentPreferredLocation.lat ||
                prevPreferredLocation.lng !== currentPreferredLocation.lng ||
                prevPreferredLocation.zoom !== currentPreferredLocation.zoom
            );

            if (hasLocationChanged) {
                // Reset posts array and set loading state when location changes
                posts = [];
                filteredPosts = []; // Explicitly reset filteredPosts too
                loadingPosts = true;
                
                // Update the last fetched location name
                if (currentPreferredLocation?.name) {
                    lastFetchedLocationName = currentPreferredLocation.name;
                    // console.log(`Location changed to: ${currentPreferredLocation.name} - resetting posts arrays`);
                }
                
                // Directly trigger posts fetch for the new location
                if (isAuthLoaded && isLoggedIn && authToken) {
                    // console.log('Location changed, fetching posts for new location:', currentPreferredLocation.name);
                    
                    // Immediate call to ensure UI shows loading state
                    fetchPostsForLocation(
                        currentPreferredLocation.lat,
                        currentPreferredLocation.lng,
                        currentSearchTerm
                    );
                    
                    if (currentPreferredLocation.name) {
                        fetchUserCountFlexible(currentPreferredLocation.name);
                        fetchCurrentLocationPostsCount();
                    }
                }
            }

            let zoomLevel = 7;
            if (currentPreferredLocation.locationType === 'street') zoomLevel = 14;
            else if (currentPreferredLocation.locationType === 'county') zoomLevel = 9;
            else if (currentPreferredLocation.locationType === 'city') zoomLevel = 8;
            else if (currentPreferredLocation.locationType === 'country') zoomLevel = 6;
            if (currentPreferredLocation.zoom && currentPreferredLocation.zoom >= 3 && currentPreferredLocation.zoom <= 21) {
                zoomLevel = currentPreferredLocation.zoom;
            } else if (currentPreferredLocation.zoom && currentPreferredLocation.zoom > 21) {
                zoomLevel = 21;
            }

            if (hasLocationChanged || (!get(_currentMapDisplayState).initialized && currentPreferredLocation.lat !== 0 && currentPreferredLocation.lng !== 0)) {
                _currentMapDisplayState.set({
                    lat: currentPreferredLocation.lat,
                    lng: currentPreferredLocation.lng,
                    zoom: zoomLevel,
                    initialized: true
                });
            }
        }
    });
    if (browser) {
        preferredLocation.loadLocation();
    }
});

    // --- Fix: Only fetch for preferred location, not map viewport ---
    $: {
        if (
            isAuthLoaded &&
            isLoggedIn &&
            typeof currentPreferredLocation?.lat === "number" &&
            typeof currentPreferredLocation?.lng === "number" &&
            !isNaN(currentPreferredLocation.lat) &&
            !isNaN(currentPreferredLocation.lng) &&
            !hasInitialPostsFetched &&
            !isMapPinningMode
        ) {
            hasInitialPostsFetched = true;
            // Always use preferred location for posts list, not map viewport
            fetchPostsForLocation(currentPreferredLocation.lat, currentPreferredLocation.lng, currentSearchTerm);
            if (currentPreferredLocation.name) {
                fetchUserCountFlexible(currentPreferredLocation.name);
            }
        }
    }

    // --- Posts Count Fetching (NEW) ---
    $: if (
        isAuthLoaded &&
        isLoggedIn &&
        currentPreferredLocation?.bounds &&
        typeof currentPreferredLocation.bounds.north === "number" &&
        typeof currentPreferredLocation.bounds.south === "number" &&
        typeof currentPreferredLocation.bounds.east === "number" &&
        typeof currentPreferredLocation.bounds.west === "number"
    ) {
        fetchCurrentLocationPostsCount();
    }

    async function fetchCurrentLocationPostsCount() {
        try {
            const tokenToUse = get(auth).token;
            postsCount = await fetchPostsCount({
                minLat: currentPreferredLocation.bounds.south,
                maxLat: currentPreferredLocation.bounds.north,
                minLng: currentPreferredLocation.bounds.west,
                maxLng: currentPreferredLocation.bounds.east
            }, tokenToUse);
        } catch {
            postsCount = null;
        }
    }

    async function fetchPostsForLocation(lat: number, lng: number, searchTerm: string = '') {
        // console.log(`Fetching posts for location (lat=${lat}, lng=${lng}, searchTerm=${searchTerm})`);
        
        // Debug current location details
        if (currentPreferredLocation) {
            // console.log('Current location details:', {
            //     name: currentPreferredLocation.name, 
            //     locationType: currentPreferredLocation.locationType,
            //     bounds: currentPreferredLocation.bounds ? 'Present' : 'Missing'
            // });
        }
        
        const tokenToUse = get(auth).token;
        
        // Clear previous error and ensure loading state is set
        postFetchError = '';
        loadingPosts = true;
        
        // Reset posts to empty array to trigger loading UI
        posts = [];
        filteredPosts = [];
        // console.log('Resetting posts and filteredPosts arrays before fetch');
        
        // Skip if we don't have the required data
        if (
            !isAuthLoaded ||
            !isLoggedIn ||
            !tokenToUse ||
            typeof lat !== "number" || isNaN(lat) ||
            typeof lng !== "number" || isNaN(lng) ||
            !currentPreferredLocation?.locationType
        ) {
            // console.error('Cannot fetch posts due to missing required data:', {
            //     isAuthLoaded,
            //     isLoggedIn,
            //     hasToken: !!tokenToUse,
            //     lat,
            //     lng,
            //     hasLocationType: !!currentPreferredLocation?.locationType
            // });
            postFetchError = 'Location not set. Please set your preferred location.';
            posts = [];
            filteredPosts = []; // Explicitly reset filteredPosts too
            loadingPosts = false;
            return;
        }
        
        try {
            // --- NEW: Use bounds for box search if present ---
            let fetchParams: any;
            if (
                currentPreferredLocation.bounds &&
                typeof currentPreferredLocation.bounds.north === "number" &&
                typeof currentPreferredLocation.bounds.south === "number" &&
                typeof currentPreferredLocation.bounds.east === "number" &&
                typeof currentPreferredLocation.bounds.west === "number"
            ) {
                fetchParams = {
                    minLat: currentPreferredLocation.bounds.south,
                    maxLat: currentPreferredLocation.bounds.north,
                    minLng: currentPreferredLocation.bounds.west,
                    maxLng: currentPreferredLocation.bounds.east,
                    locationType: currentPreferredLocation.locationType, // for optional UI filtering
                    fenceName: currentPreferredLocation.name, // Add location name for better debugging
                    search: searchTerm
                };
                // console.log('Using bounding box search with params:', fetchParams);
            } else {
                // fallback to old behavior if no bounds
                let precision = 3;
                if (currentPreferredLocation.locationType === 'street') precision = 6;
                else if (currentPreferredLocation.locationType === 'state' || currentPreferredLocation.locationType === 'country') precision = 2;
                fetchParams = {
                    lat,
                    lng,
                    precision,
                    locationType: currentPreferredLocation.locationType,
                    search: searchTerm
                };
            }
            
            const fetchedData = await fetchPosts(fetchParams, tokenToUse);
            
            // IMPORTANT: Make sure we always have an array to work with
            let basePosts = Array.isArray(fetchedData) ? fetchedData : (fetchedData?.posts || []);
            
            // Extra safety check - if we somehow got a non-array, make it an empty array
            if (!Array.isArray(basePosts)) {
                // console.warn('fetchPosts returned non-array data:', typeof basePosts);
                basePosts = [];
            }

            // CRITICAL: Filter out reposts from posts page IMMEDIATELY after fetching
            basePosts = basePosts.filter(post => !post.isRepost);
            console.log('Posts page: Filtered out reposts, remaining posts count:', basePosts.length);

            // Process posts with comments count
            const postsWithCounts = await Promise.all(basePosts.map(async post => {
                try {
                    const comments = await fetchComments(post.id);
                    // Debug: Log repost data for each post
                    if (post.isRepost) {
                        console.log('Posts page: Repost data found:', {
                            postId: post.id,
                            isRepost: post.isRepost,
                            hasOriginalPost: !!post.originalPost,
                            originalPostId: post.originalPostId || post.originalPost?.id
                        });
                    }
                    return { ...post, commentsCount: Array.isArray(comments) ? comments.length : 0 };
                } catch (e) {
                    return { ...post, commentsCount: 0 };
                }
            }));

            // Enhance posts with original post data for reposts
            const enhancedPosts = await enhancePostsWithOriginals(postsWithCounts);

            // Sort so currently featured posts come first
            const now = Date.now();
            const sortedPosts = [...enhancedPosts].sort((a, b) => {
                const aFeatured =
                    (a.featuredInLocationUntil && a.featuredInLocationUntil > now) ||
                    (a.featuredInSearchUntil && a.featuredInSearchUntil > now);
                const bFeatured =
                    (b.featuredInLocationUntil && b.featuredInLocationUntil > now) ||
                    (b.featuredInSearchUntil && b.featuredInSearchUntil > now);

                if (aFeatured && !bFeatured) return -1;
                if (aFeatured && bFeatured) {
                    // If both are featured, sort by creation date (newest first)
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                if (!aFeatured && bFeatured) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            
            // Update the main posts array and ensure it's reactive
            posts = [...sortedPosts];
            
            // Force update filtered posts based on the new posts array and active categories
            const activeCats = get(activeCategories);
            console.log('POSTS PAGE FILTERING DEBUG:', {
                totalPosts: posts.length,
                repostsInMainArray: posts.filter(p => p.isRepost).length,
                activeCategoriesSize: activeCats.size
            });
            filteredPosts = [...posts].filter(post => activeCats.has(post.category));
            console.log('POSTS PAGE AFTER FILTERING:', {
                filteredPostsCount: filteredPosts.length,
                repostsInFilteredArray: filteredPosts.filter(p => p.isRepost).length
            });
            
            // console.log(`Posts fetch completed for ${currentPreferredLocation.name}: Received ${basePosts.length} posts, processed to ${posts.length} posts, filtered to ${filteredPosts.length} posts`);

            const newWikipediaPreviews: { [key: string]: { title: string; extract: string; thumbnail?: string; pageid: number; url: string } } = {};
            await Promise.all(posts.map(async post => {
                if (post.link && post.link.includes('wikipedia.org')) {
                    const title = post.link.split('/').pop();
                    if (title && !wikipediaPreviews[title]) {
                        try {
                            const preview = await fetchWikipediaPreview(title);
                            if (preview) {
                                newWikipediaPreviews[title] = {
                                    title: preview.title,
                                    extract: preview.extract,
                                    thumbnail: preview.thumbnail,
                                    pageid: preview.pageid,
                                    url: `https://en.wikipedia.org/?curid=${preview.pageid}`
                                };
                            }
                        } catch (e) {}
                    }
                }
            }));
            wikipediaPreviews = { ...wikipediaPreviews, ...newWikipediaPreviews };
        } catch (error: any) {
            // console.error('Error fetching posts:', error);
            postFetchError = error.message || 'Failed to load posts for this location. Try adjusting your location.';
            posts = []; // Ensure posts is an empty array
            filteredPosts = []; // Also reset filtered posts
        } finally {
            loadingPosts = false;
        }
    }
// Flexible user count: try several name variants for fuzzy matching
    async function fetchUserCountFlexible(locationName: string) {
        const tokenToUse = get(auth).token;
        if (!tokenToUse || !locationName) {
            userCount = null;
            return;
        }
        loadingUserCount = true;
        userCountError = null;
        let triedNames: string[] = [];
        let countResult = 0;
        const variants = [
            locationName,
            locationName.replace(/Florida/i, 'FL'),
            locationName.replace(/FL/i, 'Florida'),
            locationName.replace(/\./g, ''),
            locationName.replace(/,?\s*USA$/i, '').trim()
        ].filter((v, i, arr) => v && arr.indexOf(v) === i);

        for (const variant of variants) {
            triedNames.push(variant);
            try {
                const response = await fetch(`${PUBLIC_API_BASE_URL}/api/users/locations/count?locationName=${encodeURIComponent(variant)}`, {
                    headers: { 'Authorization': `Bearer ${tokenToUse}` }
                });
                if (!response.ok) continue;
                const data = await response.json();
                if (typeof data.count === 'number' && data.count > 0) {
                    // Use the FIRST valid result, don't add them up!
                    countResult = data.count;
                    break; // Stop trying other variants once we get a valid count
                }
            } catch { }
        }
        userCount = countResult;
        loadingUserCount = false;
    }

    async function handleMapClick(event: CustomEvent<{ latLng: { lat: number; lng: number }; zoom: number }>) {
        const { latLng, zoom } = event.detail;
        if (!isMapPinningMode) {
            return;
        }
        if (zoom < 15 || zoom > 21) {
            return;
        }
        mapPinLocation = latLng;
        mapPinZoom = zoom;
        highlightedPostId = null;
    }

    function handleCreatePostFromMapPin(event: CustomEvent<{ latLng: { lat: number; lng: number }; zoom: number }>) {
        mapPinLocation = event.detail.latLng;
        mapPinZoom = event.detail.zoom;
        isMapPinningMode = true;
        showCreatePostOverlay = true;
        highlightedPostId = null;
    }
    
    function handleMapMoveEnd(event: CustomEvent<{ center: { lat: number; lng: number }; zoom: number }>) {
        const { center, zoom } = event.detail;

        _currentMapDisplayState.set({ lat: center.lat, lng: center.lng, zoom, initialized: true });
        
        // Auto-activate map mode when zoom is 15-21, deactivate when zoom is 4-14
        if (zoom >= 15 && zoom <= 21) {
            if (!isMapPinningMode) {
                isMapPinningMode = true;
                mapPinLocation = null;
                mapPinZoom = null;
                showCreatePostOverlay = false;
                highlightedPostId = null;
            }
        } else if (zoom >= 4 && zoom <= 14) {
            if (isMapPinningMode) {
                resetMapPinningState();
            }
        }

        if (!isMapPinningMode && zoom <= 16) {
            highlightedPostId = null;
        }

        if (mapMoveEndDebounceTimer) {
            clearTimeout(mapMoveEndDebounceTimer);
        }
        mapMoveEndDebounceTimer = setTimeout(() => {
            const currentMapState = get(_currentMapDisplayState);
            if (isAuthLoaded && isLoggedIn && authToken) {
                // REMOVED: Don't fetch posts on map pan - only on explicit location change
                // Posts list should always show preferred location posts, not map viewport posts
                
                // ✅ FIXED: Only update preferred location for major navigation, not zoom/pan
                // This prevents accidental posts reload during normal map interaction
                if (currentPreferredLocation) {
                    const latDiff = Math.abs(currentMapState.lat - currentPreferredLocation.lat);
                    const lngDiff = Math.abs(currentMapState.lng - currentPreferredLocation.lng);
                    // Only save if user moved more than ~5km (0.05 degrees ≈ 5.5km)
                    // This prevents accidental location changes from normal map use
                    if (latDiff > 0.05 || lngDiff > 0.05) {
                        console.log('📍 Significant navigation detected - User moved far from preferred location:', {
                            from: { lat: currentPreferredLocation.lat, lng: currentPreferredLocation.lng },
                            to: { lat: currentMapState.lat, lng: currentMapState.lng },
                            distance: { latDiff, lngDiff },
                            note: 'Posts will remain from preferred location. User can manually update location if desired.'
                        });
                        
                        // Don't auto-update - let user explicitly change location if they want
                        // posts from this new area by using the location selector
                    }
                }
            }
            mapMoveEndDebounceTimer = null;
        }, MAP_DEBOUNCE_TIME_MS);
    }
    
    function handleCreatePostGeneralButton() {
        const userLoc = get(userLocation).preferredLocation;
        if (userLoc && userLoc.lat !== undefined && userLoc.lng !== undefined) {
            mapPinLocation = { lat: userLoc.lat, lng: userLoc.lng };
            mapPinZoom = userLoc.zoom || 8;
            isMapPinningMode = false;
            showCreatePostOverlay = true;
            highlightedPostId = null;
        } else {
            showLocationSetup = true;
        }
    }

    async function handlePostCreated(event: CustomEvent<{ id?: string }>) {
        try {
            const currentMapState = get(_currentMapDisplayState);
            if (isAuthLoaded && isLoggedIn && authToken) {
                await fetchPostsForLocation(currentMapState.lat, currentMapState.lng, currentSearchTerm);
            }
            handleCreatePostOverlayClose();
            if (event.detail.id && mapPinLocation && mapPinZoom !== null) {
                _currentMapDisplayState.set({
                    lat: mapPinLocation.lat,
                    lng: mapPinLocation.lng,
                    zoom: 21,
                    initialized: true
                });
                highlightedPostId = event.detail.id;
            } else if (event.detail.id) {
                highlightedPostId = event.detail.id;
                if (browser) {
                    const postsContainer = document.querySelector('.posts-section');
                    if (postsContainer) {
                        postsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        } catch (error: any) {
            postFetchError = error.message || 'Failed to update posts after creation.';
        } finally {
            if (currentPreferredLocation?.name) {
                fetchUserCountFlexible(currentPreferredLocation.name);
            }
        }
    }

    function handleViewComments(event: CustomEvent<{ post: Post }>) {
        const post = event.detail.post;
        selectedPostForComments = post;
        showCommentsOverlay = true;
    }

    function handleShowOriginalPost(event: CustomEvent<Post>) {
        console.log('posts/+page.svelte: handleShowOriginalPost called - using PostItem internal modal');
        // PostItem now handles the modal internally, no action needed here
    }

    function handleCommentsOverlayClose() {
        showCommentsOverlay = false;
        selectedPostForComments = null;
    }

    function handlePostClickFromMap(event: CustomEvent<{ post: any }>) {
        const post = event.detail.post;
        // Only set the highlighted post ID to show the bubble, don't reload posts
        highlightedPostId = post.id || post._id;
        resetMapPinningState();
        showCreatePostOverlay = false;
        
        // Don't trigger any post filtering or reloading
        console.log('🔴 Map post clicked - showing bubble for post:', post.id);
    }

    function handleCreatePostOverlayClose() {
        showCreatePostOverlay = false;
        resetMapPinningState();
        postDraft.set({ content: '', headline: '', imageUrl: '', mediaUrl: '', category: 'COMMUNITY', link: '' });
    }

    function handleSearch(event: CustomEvent<string>) {
        const newSearchTerm = event.detail;
        if (newSearchTerm !== currentSearchTerm) {
            currentSearchTerm = newSearchTerm;
            if (searchTermDebounceTimer) {
                clearTimeout(searchTermDebounceTimer);
            }
            searchTermDebounceTimer = setTimeout(() => {
                const currentMapState = get(_currentMapDisplayState);
                if (isAuthLoaded && isLoggedIn && authToken) {
                    fetchPostsForLocation(currentMapState.lat, currentMapState.lng, currentSearchTerm);
                }
                searchTermDebounceTimer = null;
            }, SEARCH_DEBOUNCE_TIME_MS);
        }
        highlightedPostId = null;
    }

    function resetMapToUserLocation() {
        const userLoc = get(userLocation).preferredLocation;
        if (userLoc && userLoc.lat !== undefined && userLoc.lng !== undefined) {
            let zoomLevel = 7;
            if (userLoc.locationType === 'street') zoomLevel = 14;
            else if (userLoc.locationType === 'county') zoomLevel = 9;
            else if (userLoc.locationType === 'city') zoomLevel = 8;
            else if (userLoc.locationType === 'country') zoomLevel = 6;
            if (userLoc.zoom && userLoc.zoom >= 3 && userLoc.zoom <= 21) {
                zoomLevel = userLoc.zoom;
            } else if (userLoc.zoom && userLoc.zoom > 21) {
                zoomLevel = 21;
            }

            _currentMapDisplayState.set({
                lat: userLoc.lat,
                lng: userLoc.lng,
                zoom: zoomLevel,
                initialized: true
            });
            if (isAuthLoaded && isLoggedIn && authToken) {
                fetchPostsForLocation(userLoc.lat, userLoc.lng, currentSearchTerm);
            }
        } else {
            showLocationSetup = true;
        }
        resetMapPinningState();
        showCreatePostOverlay = false;
        highlightedPostId = null;
    }

    function toggleMapPinningMode() {
        const currentZoom = get(_currentMapDisplayState).zoom;
        if (!isMapPinningMode) {
            if (currentZoom < 15 || currentZoom > 21) {
                resetMapToUserLocation();
                return;
            }
            isMapPinningMode = true;
            mapPinLocation = null;
            mapPinZoom = null;
            showCreatePostOverlay = false;
            highlightedPostId = null;
        } else {
            resetMapPinningState();
        }
    }

    function resetMapPinningState() {
        isMapPinningMode = false;
        mapPinLocation = null;
        mapPinZoom = null;
    }

    function zoomToPost(event: CustomEvent<any>) {
        const post = event.detail;
        const lat = post.latitude || post.lat;
        const lng = post.longitude || post.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
            const postId = post.id || post._id;
            const bounds = currentPreferredLocation?.bounds;

            if (bounds && (lat > bounds.north || lat < bounds.south || lng > bounds.east || lng < bounds.west)) {
                // skip if out of bounds
            }

            _currentMapDisplayState.set({
                lat,
                lng,
                zoom: 21,
                initialized: true
            });
            highlightedPostId = postId;

            resetMapPinningState();
            showCreatePostOverlay = false;

            if (browser) {
                const mapContainer = document.getElementById('map-container');
                if (mapContainer) {
                    mapContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    }

    function handleUsernameClick(event: CustomEvent<{ username: string }>) {
        const username = event.detail.username;
        if (browser) {
            goto(`/profile/${username}`);
        }
    }

    async function handleCategoryToggle(event: MouseEvent, category: string) {
        event.preventDefault();
        event.stopPropagation();

        if (category === 'GENERAL INFORMATION') {
            const location = get(userLocation).preferredLocation;
            const locationName = location?.name || 'Las Vegas, Nevada, USA';
            const wikiQuery = locationName.split(',')[0].trim().replace(/\s+/g, '_');

            wikiLoading = true;
            wikiError = '';
            showWikiModal = true;

            try {
                const preview = await fetchWikipediaPreview(wikiQuery);
                if (preview) {
                    wikiPreview = {
                        title: preview.title,
                        extract: preview.extract,
                        thumbnail: preview.thumbnail,
                        pageid: preview.pageid,
                        url: `https://en.wikipedia.org/?curid=${preview.pageid}`
                    };
                } else {
                    wikiError = 'No Wikipedia preview available for this location.';
                }
            } catch (error: any) {
                wikiError = error.message || 'Failed to load Wikipedia preview.';
            } finally {
                wikiLoading = false;
            }
        } else {
            activeCategories.update(set => {
                if (set.has(category)) {
                    set.delete(category);
                } else {
                    set.add(category);
                }
                return new Set(set);
            });
            highlightedPostId = null;
        }
    }

    function handleWikiModalClose() {
        showWikiModal = false;
        wikiPreview = null;
        wikiError = '';
    }

    function handleWikiModalOutsideClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('wiki-modal-backdrop')) {
            handleWikiModalClose();
        }
    }

    onDestroy(() => {
        if (authSubscription) {
            authSubscription();
        }
        if (locationSubscription) {
            locationSubscription();
        }
        if (mapMoveEndDebounceTimer) {
            clearTimeout(mapMoveEndDebounceTimer);
        }
        if (searchTermDebounceTimer) {
            clearTimeout(searchTermDebounceTimer);
        }
        window.removeEventListener('click', handleClickOutside);
    });
</script>

<CreatePostOverlay
    show={showCreatePostOverlay}
    onClose={handleCreatePostOverlayClose}
    isMapMode={isMapPinningMode}
    mapPinLocation={mapPinLocation}
    clickZoom={mapPinZoom}
    postDraft={postDraft}
    on:postcreated={handlePostCreated}
/>
{#if showCommentsOverlay && selectedPostForComments}
    <div class="modal-backdrop" on:click={handleCommentsOverlayClose}>
        <div class="comments-modal-content" on:click|stopPropagation>
            <div class="comments-modal-header">
                <h3>Comments for: {selectedPostForComments.headline || selectedPostForComments.content || 'Post'}</h3>
                <button class="close-btn" on:click={handleCommentsOverlayClose} aria-label="Close comments">&times;</button>
            </div>
            <CommentsSection
                postId={selectedPostForComments.id}
                userEmail={userEmail}
                token={$auth.token}
                compact={false}
            />
        </div>
    </div>
{/if}

<div class="posts-page">
    <div class="map-section" id="map-container">
        {#if $mapDisplayLocation}
            <div class="location-map-container">
                <LocationMap
                    location={$mapDisplayLocation}
                    posts={filteredPosts}
                    mapMode={isMapPinningMode}
                    mapPinLocation={mapPinLocation}
                    mapType={mapType}
                    highlightedPostId={highlightedPostId}
                    on:moveend={handleMapMoveEnd}
                    on:mapClick={handleMapClick}
                    on:postClick={handlePostClickFromMap}
                    on:createPostButton={handleCreatePostFromMapPin}
                />
            </div>
            <!-- All overlays inside the map area -->
            <div class="map-floating-elements">
                <!-- Category Filter -->
                <div class="small-category-filter">
                    {#each categories as category}
                        <button
                            type="button"
                            class="category-icon small-category-icon"
                            class:active={$activeCategories.has(category)}
                            data-category={category}
                            on:mouseenter={(e)=>handleCategoryMouseEnter(e, category)}
                            on:mouseleave={handleCategoryMouseLeave}
                            on:click|stopPropagation={event => handleCategoryToggle(event, category)}
                            aria-label={categoryDisplayNames[category]}
                        >
                            {#if category === 'ALERTS'}
                                <i class="fas fa-exclamation-triangle"></i>
                            {:else if category === 'NEWS'}
                                <i class="fas fa-newspaper"></i>
                            {:else if category === 'EVENTS'}
                                <i class="fas fa-calendar"></i>
                            {:else if category === 'JOBS'}
                                <i class="fas fa-briefcase"></i>
                            {:else if category === 'TASKS'}
                                <i class="fas fa-running"></i>
                            {:else if category === 'BUSINESSES'}
                                <i class="fas fa-building"></i>
                            {:else if category === 'POINTS OF INTEREST'}
                                <i class="fas fa-map-marker-alt"></i>
                            {:else if category === 'COMMUNITY'}
                                <i class="fas fa-users"></i>
                            {:else if category === 'GENERAL INFORMATION'}
                                <i class="fas fa-info-circle"></i>
                            {:else}
                                {category[0]}
                            {/if}
                        </button>
                    {/each}
                    {#if hoveredCategory}
                        <div
                            class="category-tooltip"
                            style="top: {categoryTooltipPos.top}px; left: {categoryTooltipPos.left}px"
                        >
                            {categoryDisplayNames[hoveredCategory]}
                        </div>
                    {/if}
                </div>
                <!-- Map Type Dropdown (top right) -->
                <div class="map-top-right">
                    <div class="map-type-dropdown">
                        <select bind:value={mapType} class="map-type-select">
                            <option value="roadmap">Map</option>
                            <option value="satellite">Satellite</option>
                            <option value="dark">Dark Mode</option>
                        </select>
                    </div>
                </div>
                <!-- User Count (lower right, covering camera controls) -->
                <div class="map-user-count-overlay-lower-right">
                    {#if currentPreferredLocation?.name}
                        <div class="user-count-card" style="position: relative;">
                            {#if loadingUserCount}
                                <span class="user-count-value">...</span>
                            {:else if userCount !== null}
                                <button class="user-count-value" style="cursor:pointer; background:none; border:none; padding:0; font:inherit;" on:click={handleUserCountClick} aria-label="Show user count info">{userCount}</button>
                                {#if showUserCountTooltip}
                                    <div class="user-count-tooltip" bind:this={userCountTooltipRef}>
                                        Number of users in {currentPreferredLocation.name}
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        {:else}
            <div class="map-placeholder">
                <p>Please set a location to view the map.</p>
            </div>
        {/if}
    </div>
    <!-- Permanent Location Bar below the map -->
    <div class="location-bar-container">
        <div class="location-bar-content">
            <button class="create-post-button-location-bar" on:click={handleCreatePostGeneralButton}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="4" width="14" height="16" rx="2" />
                    <line x1="8" y1="8" x2="14" y2="8" />
                    <line x1="8" y1="12" x2="14" y2="12" />
                    <line x1="8" y1="16" x2="12" y2="16" />
                    <line x1="15.5" y1="19.5" x2="21" y2="19.5"/>
                    <line x1="18.25" y1="17" x2="18.25" y2="22"/>
                </svg>
            </button>
            <div class="location-card">
                {#if currentPreferredLocation && currentPreferredLocation.name}
                    <p class="current-location">{currentPreferredLocation.name}</p>
                {:else}
                    <p class="current-location">No preferred location set.</p>
                {/if}
            </div>
            <button class="set-location-button bare-globe-btn" on:click={() => showLocationSetup = true} aria-label="Set Location">
                <svg class="globe-icon" width="32" height="32" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <ellipse cx="12" cy="12" rx="4" ry="10"/>
                    <path d="M2 12h20"/>
                </svg>
            </button>
            <div class="location-bar-search">
                <SearchPosts
                    preferredLocation={currentPreferredLocation}
                    on:search={handleSearch}
                    inline={true}
                />
            </div>
            <div class="location-bar-posts-count">
                <button
                    type="button"
                    class="posts-count-number-location-bar"
                    aria-label="Number of Posts in Location"
                    on:mouseenter={handlePostsCountMouseEnter}
                    on:mouseleave={handlePostsCountMouseLeave}
                    on:click={handlePostsCountClick}
                    style="cursor:pointer; user-select:none; background:none; border:none; padding:0; font:inherit;"
                >
                    {#if postsCount !== null}
                        {postsCount}
                    {:else}
                        <span style="color: var(--gray-400);">...</span>
                    {/if}
                </button>
                {#if showPostsCountTooltip}
                    <div bind:this={postsCountTooltipRef} class="posts-count-tooltip-location-bar">
                        Number of Posts in Location
                    </div>
                {/if}
            </div>
        </div>
    </div>
    {#if showLocationSetup}
        <LocationSetupOverlay bind:show={showLocationSetup} on:close={(event) => {
            showLocationSetup = false;
            console.log('Posts page: LocationSetupOverlay closed, refreshing data...');
            
            const newLocation = event.detail?.newLocation;
            
            // Use new location if provided, otherwise get from store
            const locationToUse = newLocation || get(preferredLocation);
            console.log('Posts page: Using location for refresh:', locationToUse);
            
            if (isAuthLoaded && isLoggedIn && locationToUse && locationToUse.lat && locationToUse.lng) {
                // Update the map display state to the new location
                _currentMapDisplayState.set({
                    lat: locationToUse.lat,
                    lng: locationToUse.lng,
                    zoom: locationToUse.zoom || 11,
                    initialized: true
                });
                
                // Fetch posts for the new location
                fetchPostsForLocation(locationToUse.lat, locationToUse.lng, currentSearchTerm);
                
                // Reset posts count cache
                postsCount = null;
                
                // Reset user count to force refresh
                userCount = null;
                loadingUserCount = true;
                
                // Force refresh user count with the new location name
                if (locationToUse.name) {
                    fetchUserCountFlexible(locationToUse.name);
                }
                
                // Also refresh posts count
                fetchPostsCount(locationToUse.lat, locationToUse.lng).then(count => {
                    postsCount = count;
                });
                
                console.log('Posts page: Refreshed posts, user count, and posts count for new location:', locationToUse.name);
            } else {
                console.warn('Posts page: No valid location data for refresh');
            }
        }} />
    {/if}
    <div class="posts-section wide-posts-section">
        {#if loadingPosts}
            <div class="loading-state">
                <p>Loading posts...</p>
            </div>
        {:else if postFetchError}
            <p class="error-message">{postFetchError}</p>
        {:else if !Array.isArray(filteredPosts) || filteredPosts.length === 0}
            <div class="no-posts-message">
                <p>No posts yet in this location. Be the first to create one!</p>
                <button class="create-post-empty-btn" on:click={handleCreatePostGeneralButton}>
                    Create Post
                </button>
            </div>
        {:else}
            <PostList
                posts={filteredPosts}
                wikipediaPreviews={wikipediaPreviews}
                highlightedPostId={highlightedPostId}
                preferredLocationName={currentPreferredLocation?.name || ''}
                loading={loadingPosts}
                on:zoomToPost={zoomToPost}
                on:usernameClick={handleUsernameClick}
                on:viewComments={handleViewComments}
                on:showOriginalPost={handleShowOriginalPost}
                on:showCreatePost={() => showCreatePostOverlay = true}
            />
        {/if}
    </div>
</div>

{#if showWikiModal}
<div class="wiki-modal-backdrop" role="dialog" aria-modal="true" on:click={handleWikiModalOutsideClick}>
    <div class="wiki-modal-content">
        <button class="wiki-close-button" on:click={handleWikiModalClose} aria-label="Close Wikipedia Preview">&times;</button>
        {#if wikiLoading}
            <p>Loading Wikipedia preview…</p>
        {:else if wikiError}
            <p class="error-message">{wikiError}</p>
        {:else if wikiPreview}
            <h2>{wikiPreview.title}</h2>
            {#if wikiPreview.thumbnail}
                <img class="wiki-thumbnail" src={wikiPreview.thumbnail} alt="Wikipedia thumbnail" />
            {/if}
            <p>{wikiPreview.extract}</p>
            <a class="wiki-link-button" href={wikiPreview.url} target="_blank" rel="noopener noreferrer">
                Read more on Wikipedia
            </a>
        {/if}
    </div>
</div>
{/if}

{#if paymentMessage}
  <div class="success-message">{paymentMessage}</div>
{/if}
{#if paymentError}
  <div class="error-message">{paymentError}</div>
{/if}

<style>

/* --- POSTS PAGE --- */
.posts-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 6px;
    min-height: 100vh;
    width: 100%;
}

.map-section {
    height: 65vh;
    width: 100%;
    position: relative;
    min-height: 400px;
    background-color: #e0e0e0;
    display: flex;
    justify-content: center;
    align-items: center;
}
.location-map-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}
.map-placeholder {
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 1.2em;
}

/* --- MAP OVERLAYS (ALL INSIDE MAP) --- */
.map-floating-elements {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 6;
    pointer-events: none;
}
.small-category-filter {
    position: absolute;
    left: 10px;
    top: 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    z-index: 7;
    pointer-events: auto;
}

.small-category-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000000;
    font-weight: 700;
    font-size: 1.07em;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.20);
    user-select: none;
    border: none;
    transition: 
        box-shadow 0.2s, 
        transform 0.18s, 
        background 0.35s;
    font-family: 'Inter', sans-serif;
    font-size: 1.5em; /* or your preferred size */
    font-weight: 600;  /* or your preferred weight */
    background: #e5e7eb; /* Default inactive background */
}
.small-category-icon.active {
    box-shadow: 0 6px 20px rgba(0,0,0,0.38);
}
.small-category-icon:hover {
    transform: scale(1.13);
    z-index: 5;
}

/* Per-category active background and icon color */
.small-category-icon.active[data-category="ALERTS"] {
    background: #eef119;
    color: #000000;
}
.small-category-icon.active[data-category="NEWS"] {
    background: #1a1919;
    color: #fff;
}
.small-category-icon.active[data-category="EVENTS"] {
    background: #b80a0a;
    color: #fff;
}
.small-category-icon.active[data-category="JOBS"] {
    background: #18038b;
    color: #ffffff;
}
.small-category-icon.active[data-category="TASKS"] {
    background: #350249;
    color: #fff;
}
.small-category-icon.active[data-category="BUSINESSES"] {
    background: #046909;
    color: #fff;
}
.small-category-icon.active[data-category="POINTS OF INTEREST"] {
    background: #e44303;
    color: #fff;
}
.small-category-icon.active[data-category="COMMUNITY"] {
    background: #00eaff;
    color: #000000;
}
.small-category-icon.active[data-category="GENERAL INFORMATION"] {
    background: #fff;
    color: #1f2124;
}

.category-tooltip {
    position: fixed;
    background: rgba(28,30,38,0.97);
    color: #ffffff;
    font-size: 1.07em;
    padding: 0.4em 0.4em;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.22);
    white-space: nowrap;
    pointer-events: none;
    transform: translateY(-50%);
    left: 84px;
    z-index: 9999;
    font-weight: 600;
    letter-spacing: 0.01em;
    font-family: 'Inter', sans-serif;
}
.map-lower-left-overlay {
    /* Removed: now handled by permanent location bar below map */
    display: none;
}
.location-card {
    background-color: rgba(255, 255, 255, 0.96);
    padding: 6px 10px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(61, 59, 59, 0.17);
    border: 1px solid #e5e7eb;
    min-width: 180px;
    font-family: 'Inter', sans-serif;
}
.current-location {
    margin: 0;
    font-size: 1.09em;
    color: #1f2937;
    font-weight: 700;
}

.bare-globe-btn {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 0 !important;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: unset;
    min-height: unset;
}

.bare-globe-btn .globe-icon {
    color: #00eaff;      /* Controls stroke and fill if set to currentColor */
    width: 32px;
    height: 32px;
    display: block;
    /* Optional: */
    stroke-width: 2;     /* Controls stroke thickness */
    fill: none;          /* Or set to a color if you want a filled globe */
    transition: color 0.25s, transform 0.25s;
}
.bare-globe-btn:hover .globe-icon {
    color: #60fafa;
    transform: scale(1.08);
}

/* --- LOCATION BAR BELOW MAP --- */
.location-bar-container {
    width: 100%;
    max-width: 1300px;
    margin: -1px auto 10px auto;
    background: #000000;
    border-radius: 3px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.07);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border: 1.5px solid #e5e7eb;
    overflow: hidden;
    height: 60px; /* Set your preferred height */
    min-height: 60px; /* Optional: ensures it never shrinks below this */
}
.location-bar-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    padding: 6px 10px 10px 10px;
    gap: 8px;
}
.create-post-button-location-bar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: #2563eb;
    color: #ffffff;
    border: none;
    font-size: 1.4em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: background-color 0.2s, transform 0.2s;
    flex-shrink: 0;
}
.create-post-button-location-bar:hover {
    background-color: #1e40af;
    transform: scale(1.05);
}
.location-bar-search {
    margin-left: 3px;
    /* flex: 1 1 0; */
    width: 340px;
    min-width: 280px;
    max-width: 480px;
    display: flex;
    align-items: center;
}
.location-bar-posts-count {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    position: relative;
}
.posts-count-number-location-bar {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--gray-700, #ffffff);
    background: rgba(230, 62, 62, 0.85);
    border-radius: 8px;
    padding: 1em 1em;
    transition: box-shadow 0.15s;
    box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    margin-bottom: 0.2em;
    margin-right: 0.4em;
}
.posts-count-tooltip-location-bar {
    background: #222;
    color: #fff;
    padding: 0.2em 0.4em;
    border-radius: 8px;
    font-size: 0.95rem;
    margin-top: 0.2em;
    margin-right: 0.4em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.14);
    white-space: nowrap;
    position: absolute;
    top: 50%;
    right: 100%;
    transform: translateY(-50%);
    z-index: 10;
}

.map-lower-right-overlay {
    position: absolute;
    right: 8px;
    bottom: 15px;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    z-index: 8;
    pointer-events: auto;
}
.map-post-button {
    background-color: #2563eb;
    color: #ffffff;
    border: none;
    padding: 4px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.12em;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    transition: background-color 0.2s, transform 0.2s;
    min-width: 120px;
    min-height: 48px;
    margin-left: 2px;
}
.map-post-button:hover {
    background-color: #1e40af;
    transform: translateY(-2px);
}
.map-post-button:disabled {
    background-color: #d1d5db;
    cursor: not-allowed;
    transform: none;
}
.map-user-count-overlay {
    position: absolute;
    right: 8px;
    top: 10px;
    z-index: 8;
    pointer-events: auto;
}

.map-user-count-overlay-lower-right {
    position: absolute;
    right: 8px;
    bottom: 15px;
    z-index: 10;
    pointer-events: auto;
}

.map-top-right {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 8;
    pointer-events: auto;
}

.map-type-dropdown {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(4px);
    padding: 4px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
}

.map-type-select {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    font-size: 0.95em;
    cursor: pointer;
    outline: none;
    color: #1f2937;
    font-weight: 500;
}

.map-type-select:hover {
    background: rgba(0, 0, 0, 0.05);
}
.user-count-card {
    background-color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
    display: inline-flex;      /* Wraps tightly around content */
    flex-direction: column;
    align-items: center;
    border-radius: 50px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    margin-bottom: 8px;
    margin-left: 50px;
    padding: 12px 18px;         /* Adjust for your preferred size */
    min-width: unset;          /* Remove forced width */
    min-height: unset;         /* Remove forced height */
    width: auto;               /* Let it size to content */
    height: auto;
}

.user-count-value {
    font-size: 1.6em;          /* Adjust for your preferred text size */
    color: #000000;
    font-weight: 800;
    margin-top: 0;
    letter-spacing: 1px;
}

/* --- POSTS SECTION --- */
.posts-section {
    padding: 20px;
    background-color: #fffdfd;
    border-top: 1px solid #e5e7eb;
    width: 100%;
    max-width: 1110px;
    margin: 0 auto;
    position: relative;
}
.posts-count-container {
    position: absolute;
    top: 0.5rem;
    right: 0.1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}
.posts-count-number {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--gray-700, #222);
    background: rgba(255,255,255,0.85);
    border-radius: 8px;
    padding: 0.10em 0.95em 0.10em 0.95em;
    transition: box-shadow 0.15s;
    box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    margin-bottom: 0.2em;
}
.posts-count-tooltip {
    background: #222;
    color: #fff;
    padding: 0.4em 1em;
    border-radius: 8px;
    font-size: 0.95rem;
    margin-top: 0.15em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.14);
    white-space: nowrap;
}

.no-posts-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
}

.no-posts-message p {
    margin-bottom: 20px;
    font-size: 1.1rem;
    color: #4b5563;
}

.create-post-empty-btn {
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.create-post-empty-btn:hover {
    background-color: #1d4ed8;
    transform: translateY(-2px);
}

/* --- Misc (existing styles) --- */
.error-message {
    color: #dc2626;
    font-weight: 600;
    text-align: center;
    padding: 15px;
    background-color: #fef2f2;
    border-radius: 6px;
    margin-bottom: 15px;
}
.wiki-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    z-index: 9999998;
}
.wiki-modal-content {
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    position: absolute;
    left: 60px;
    top: 70px;
    margin: 10px;
}
.wiki-close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    color: #4b5563;
}
.wiki-close-button:hover {
    color: #1f2937;
}
.wiki-modal-content h2 {
    margin: 0 0 15px;
    font-size: 1.5em;
    color: #1f2937;
}
.wiki-thumbnail {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin-bottom: 15px;
}
.wiki-modal-content p {
    margin: 0 0 15px;
    font-size: 1em;
    color: #4b5563;
    line-height: 1.5;
}
.wiki-link-button {
    display: inline-block;
    background-color: #2563eb;
    color: #ffffff;
    padding: 8px 16px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: background-color 0.2s ease;
    float: right;
}
.wiki-link-button:hover {
    background-color: #1e40af;
}
.create-post-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    font-size: 1.6em;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
    position: fixed;
    right: 24px;
    top: calc(100% - 110px);
    background-color: #0681fc;
    color: #fff;
    z-index: 1000; /* Added this to bring it to the front */
}

.loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    width: 100%;
    background-color: #f9fafb;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state p {
    color: #4b5563;
    font-size: 1.1rem;
    font-weight: 500;
}

.no-posts-message {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    width: 100%;
    background-color: #f9fafb;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.no-posts-message p {
    color: #6b7280;
    font-size: 1.1rem;
}

.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999998 !important;
}

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
    padding: 5px;
    line-height: 1;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.close-btn:hover {
    background-color: #f3f4f6;
    color: #374151;
}
</style>