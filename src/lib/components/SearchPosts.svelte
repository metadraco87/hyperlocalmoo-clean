<script>
    import { createEventDispatcher, afterUpdate } from 'svelte';
    import PostItem from '$lib/components/PostItem.svelte';
    import { auth } from '$lib/stores/auth.js';
    import * as api from '$lib/api';

    export let preferredLocation;
    export let posts = []; // Expect posts as a prop
    export let inline = false; // New prop to control if it should be inline vs overlay

    const dispatch = createEventDispatcher();
    let searchTerm = '';
    let placeholderText = '';
    let inputElement;
    let showFavoriteButton = false;
    let isSearchFavorited = false;
    let favoriteSearchTerms = new Set();

    // --- Sorting: Featured posts first in search ---
    $: now = Date.now();
    $: sortedPosts = [...posts].sort((a, b) => {
        const aFeatured = a.featuredInSearchUntil && a.featuredInSearchUntil > now;
        const bFeatured = b.featuredInSearchUntil && b.featuredInSearchUntil > now;
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    $: {
        placeholderText = `Search Posts in ${preferredLocation?.name || 'current location'}`;
    }

    afterUpdate(() => {
        if (inputElement) {
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.position = 'absolute';
            span.style.whiteSpace = 'nowrap';
            const computedStyle = getComputedStyle(inputElement);
            span.style.fontFamily = computedStyle.fontFamily;
            span.style.fontSize = computedStyle.fontSize;
            span.style.fontWeight = computedStyle.fontWeight;
            span.style.letterSpacing = computedStyle.letterSpacing;
            span.style.textTransform = computedStyle.textTransform;
            span.textContent = placeholderText;
            document.body.appendChild(span);
            const textWidth = span.offsetWidth;
            document.body.removeChild(span);
            const inputPaddingLeft = parseFloat(computedStyle.paddingLeft);
            const inputPaddingRight = parseFloat(computedStyle.paddingRight);
            const inputBorderLeft = parseFloat(computedStyle.borderLeftWidth);
            const inputBorderRight = parseFloat(computedStyle.borderRightWidth);
            const totalChromeWidth = inputPaddingLeft + inputPaddingRight + inputBorderLeft + inputBorderRight;
            const buffer = 5;
            const calculatedWidth = textWidth + totalChromeWidth + buffer;
            const minWidth = 280;
            inputElement.style.width = `${Math.max(minWidth, calculatedWidth)}px`;
        }
    });

    function handleSearch() {
        dispatch('search', searchTerm);
        // Show favorite button if there's a search term
        showFavoriteButton = searchTerm.trim().length > 0;
        // Check if current search term is already favorited
        checkIfSearchFavorited();
    }
    
    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    }
    
    // Check if current search term is favorited
    function checkIfSearchFavorited() {
        if (searchTerm.trim() && preferredLocation?.name) {
            const searchKey = `${searchTerm.trim()}-${preferredLocation.name}`;
            isSearchFavorited = favoriteSearchTerms.has(searchKey);
        } else {
            isSearchFavorited = false;
        }
    }
    
    // Toggle favorite search term
    async function toggleSearchFavorite() {
        if (!$auth?.token || !searchTerm.trim() || !preferredLocation?.name) return;
        
        const searchKey = `${searchTerm.trim()}-${preferredLocation.name}`;
        
        try {
            if (isSearchFavorited) {
                // Remove from favorites
                await api.removeFavoriteSearch(searchTerm.trim(), preferredLocation.name, $auth.token);
                favoriteSearchTerms.delete(searchKey);
                isSearchFavorited = false;
                console.log('🔍 Removed search from favorites:', searchKey);
            } else {
                // Add to favorites
                await api.addFavoriteSearch({
                    searchTerm: searchTerm.trim(),
                    locationName: preferredLocation.name,
                    latitude: preferredLocation.lat,
                    longitude: preferredLocation.lng
                }, $auth.token);
                favoriteSearchTerms.add(searchKey);
                isSearchFavorited = true;
                console.log('🔍 Added search to favorites:', searchKey);
            }
        } catch (error) {
            console.error('Error toggling search favorite:', error);
        }
    }
    
    // Load favorited search terms
    async function loadFavoriteSearchTerms() {
        if (!$auth?.token) return;
        
        try {
            const response = await api.getFavoriteSearchTerms($auth.token);
            const favoriteKeys = response.favoriteSearches?.map((s) => `${s.searchTerm}-${s.locationName}`) || [];
            favoriteSearchTerms = new Set(favoriteKeys);
            checkIfSearchFavorited();
        } catch (error) {
            console.error('Error loading favorite search terms:', error);
        }
    }
    
    // Load favorites when component mounts and auth changes
    $: if ($auth?.token) {
        loadFavoriteSearchTerms();
    }

    // Filtered list for search
    $: searchResults = sortedPosts.filter(post =>
        !searchTerm ||
        (post.headline && post.headline.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (post.content && post.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );
</script>

<div>
    <div class="search-container" class:inline>
        <input
            type="text"
            bind:value={searchTerm}
            bind:this={inputElement}
            placeholder={placeholderText}
            on:input={handleSearch}
            on:keypress={handleKeyPress}
            class="search-input"
            class:inline
        />
        {#if showFavoriteButton}
            <button 
                class="favorite-search-btn"
                class:favorited={isSearchFavorited}
                on:click={toggleSearchFavorite}
                title={isSearchFavorited ? 'Remove from favorite searches' : 'Add to favorite searches'}
            >
                <svg width="24" height="24" viewBox="0 0 20 20" fill={isSearchFavorited ? '#f59e0b' : 'none'} stroke={isSearchFavorited ? '#f59e0b' : '#fff'} stroke-width="1.5">
                    <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"/>
                </svg>
            </button>
        {/if}
    </div>

    <div class="posts-list" class:inline>
        {#each searchResults as post (post.id)}
            <div class="post-row">
                <PostItem {post}
                    isHighlighted={post.featuredInSearchUntil && post.featuredInSearchUntil > now}
                />
                {#if post.featuredInSearchUntil && post.featuredInSearchUntil > now}
                    <span class="badge badge-featured">FEATURED</span>
                {/if}
            </div>
        {/each}

        {#if searchTerm && searchResults.length === 0}
            <div class="no-results">No posts found.</div>
        {/if}
    </div>
</div>

<style>
    .search-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: fixed;
        bottom: 20px;
        right: 15px;
        z-index: 3;
    }
    
    .search-container.inline {
        position: static;
    }

    .search-input {
        padding: 6px;
        font-size: 1em;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.95);
        transition: width 0.2s ease-out;
        box-sizing: border-box;
    }
    
    .favorite-search-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ffffff 0%, #3b82f6 100%);
        border: 2px solid #ffffff;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    
    .favorite-search-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    
    .favorite-search-btn.favorited {
        background: linear-gradient(135deg, #f59e0b 0%, #ffffff 100%);
        border-color: #f59e0b;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
    
    .favorite-search-btn.favorited:hover {
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }
    
    .search-input.inline {
        position: static;
        width: 100%;
        max-width: 600px;
        min-width: 260px;
        background: rgba(255, 255, 255, 1);
        border: 1px solid #d1d5db;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        font-family: 'Inter', sans-serif;
    }

    .search-input::placeholder {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .posts-list {
        margin: 2.5em auto 0 auto;
        max-width: 700px;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 1.5em;
    }
    
    .posts-list.inline {
        display: none; /* Hide search results when used inline in location bar */
    }
    
    .post-row {
        position: relative;
        margin-bottom: 1.1em;
    }
    .badge-featured {
        position: absolute;
        top: 8px;
        right: 10px;
        background: #facc15;
        color: #713f12;
        font-weight: bold;
        border-radius: 0.7em;
        padding: 0.18em 0.8em;
        font-size: 0.92em;
        z-index: 4;
        pointer-events: none;
        box-shadow: 0 1px 7px 0 #facc1555;
    }
    .no-results {
        text-align: center;
        color: #888;
        font-size: 1.1em;
        margin-top: 2em;
    }
</style>