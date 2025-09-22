<script lang="ts">
  import type { Post } from '$lib/api';
  import PostItem from '$lib/components/PostItem.svelte';
  import PostPlaceholder from './PostPlaceholder.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { fetchStarredPosts, starPost, unstarPost, incrementPostView } from '$lib/api';
  import { get } from 'svelte/store';

  const dispatch = createEventDispatcher();

  export let posts: Post[] = [];
  export let wikipediaPreviews: Record<string, any> = {};
  export let highlightedPostId: string | null = null;
  export let preferredLocationName: string = '';
  export let loading: boolean = false;

  // Starred state for all posts
  let starredPostIds = new Set<string>();
  let token: string | null = null;

  // For post impressions
  let postObserver: IntersectionObserver | null = null;
  let viewedPostIds = new Set<string>();

  // Ensure posts is always an array
  $: safePostsArray = Array.isArray(posts) ? posts : [];
  $: console.log('Number of posts:', safePostsArray.length);

  onMount(async () => {
    token = get(auth).token;
    if (token) {
      try {
        const starredResponse = await fetchStarredPosts(token);
        if (starredResponse && starredResponse.posts) {
          // The updated API returns { posts: Post[] } instead of { starred: { postId: string }[] }
          starredPostIds = new Set(starredResponse.posts.map((post: Post) => post.id));
          console.log('Loaded starred posts:', Array.from(starredPostIds));
        } else {
          console.log('No starred posts found in response:', starredResponse);
        }
      } catch (e) {
        console.error('Error fetching starred posts:', e);
        // Don't crash the component - just proceed without starred status
        starredPostIds = new Set();
      }
    }
    
    setupPostViewTracking();
  });

  onDestroy(() => {
    if (postObserver) {
      postObserver.disconnect();
    }
  });

  // Set up post view tracking with Intersection Observer
  function setupPostViewTracking() {
    // Reset the observer if it exists
    if (postObserver) {
      postObserver.disconnect();
    }
    
    // Create a new observer
    postObserver = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const postId = entry.target.getAttribute('data-post-id');
          if (postId && !viewedPostIds.has(postId)) {
            viewedPostIds.add(postId);
            if (token) {
              try {
                await incrementPostView(postId, token);
                // Update local view count
                const postIndex = posts.findIndex(p => p.id === postId);
                if (postIndex !== -1) {
                  posts[postIndex].views = (posts[postIndex].views || 0) + 1;
                  posts = [...posts]; // Trigger reactivity
                }
              } catch (e) {
                console.error('Error incrementing post view:', e);
              }
            }
          }
        }
      });
    }, { threshold: 0.5 });
    
    // Observe all post items
    setTimeout(() => {
      document.querySelectorAll('.post-item').forEach((el) => {
        postObserver?.observe(el);
      });
    }, 500);
  }

  async function loadStarred() {
    token = get(auth).token;
    if (token) {
      try {
        const starredResponse = await fetchStarredPosts(token);
        if (starredResponse && starredResponse.posts) {
          // The updated API returns { posts: Post[] } instead of { starred: { postId: string }[] }
          starredPostIds = new Set(starredResponse.posts.map((post: Post) => post.id));
          console.log('Reloaded starred posts:', Array.from(starredPostIds));
        } else {
          console.log('No starred posts found in response:', starredResponse);
          starredPostIds = new Set();
        }
      } catch (e) {
        console.error('Error fetching starred posts:', e);
      }
    }
  }

  // Handling starring/unstarring posts
  async function handleStarToggle(event: CustomEvent) {
    const { postId, isCurrentlyStarred } = event.detail;
    console.log('PostList - handleStarToggle:', postId, isCurrentlyStarred);
    
    if (!token) {
      token = get(auth).token;
      if (!token) {
        console.error('No authentication token available');
        return;
      }
    }

    try {
      if (isCurrentlyStarred) {
        console.log('Unstarring post:', postId);
        await unstarPost(postId, token);
        starredPostIds.delete(postId);
        
        // Note: PostStatsActions will refresh its own star count when opened
      } else {
        console.log('Starring post:', postId);
        await starPost(postId, token);
        starredPostIds.add(postId);
        
        // Note: PostStatsActions will refresh its own star count when opened
      }
      starredPostIds = new Set(starredPostIds); // Force Svelte reactivity
      console.log('Updated starred posts:', Array.from(starredPostIds));
    } catch (e) {
      console.error('Error toggling star:', e);
    }
  }

  // Forward events from PostItem to parent
  function forwardEvent(name: string, detail: any) {
    dispatch(name, detail);
  }
</script>

<div class="post-list-container {safePostsArray.length <= 3 ? 'row-layout' : 'column-layout'}">
  {#if loading}
    <div class="loading-message">Loading posts...</div>
  {:else if safePostsArray && safePostsArray.length > 0}
    {#each safePostsArray as post (post.id)}
      <div class="post-item" data-post-id={post.id}>
        <PostItem
          {post}
          wikipediaPreview={wikipediaPreviews[post.link?.split('/').pop() || '']}
          isHighlighted={post.id === highlightedPostId}
          isStarred={starredPostIds.has(post.id)}
          on:toggleStar={handleStarToggle}
          on:zoomToPost={(e) => forwardEvent('zoomToPost', e.detail)}
          on:usernameClick={(e) => forwardEvent('usernameClick', e.detail)}
          on:viewComments={(e) => forwardEvent('viewComments', e.detail)}
          on:showOriginalPost={(e) => forwardEvent('showOriginalPost', e.detail)}
        />
      </div>
    {/each}
  {:else}
    {#if safePostsArray.length === 0 && !loading}
      <div class="empty-state">
        <p class="empty-message">
          No posts yet in {preferredLocationName || 'this location'}. 
          Be the first to create one!
        </p>
        <button 
          class="create-post-btn"
          on:click={() => dispatch('showCreatePost')}
        >
          Create a Post
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Base container styles */
  .post-list-container {
    width: 100%;
  }

  /* Row layout for 3 or fewer posts */
  .post-list-container.row-layout {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .post-list-container.row-layout .post-item {
    flex: 1;
    min-width: 280px;
    max-width: calc(33.333% - 1rem);
    margin-bottom: 0;
    display: block;
  }

  /* Column layout for more than 3 posts (Pinterest-style masonry) */
  .post-list-container.column-layout {
    column-count: 3;
    column-gap: 1.5rem;
  }

  .post-list-container.column-layout .post-item {
    break-inside: avoid; /* Critical: prevents posts from breaking across columns */
    margin-bottom: 1.5rem;
    display: inline-block; /* Required for proper masonry layout */
    width: 100%;
  }
  
  .loading-message {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
    column-span: all; /* Span all columns */
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    border: 1px dashed #ccc;
    border-radius: 8px;
    margin: 1rem 0;
    background-color: #f9f9f9;
    column-span: all; /* Span all columns */
  }
  
  .empty-message {
    font-size: 1.1rem;
    color: #555;
    margin-bottom: 1.5rem;
  }
  
  .create-post-btn {
    background-color: #4a86e8;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .create-post-btn:hover {
    background-color: #3a76d8;
  }
  
  /* Make it responsive */
  @media (max-width: 1024px) {
    .post-list-container.column-layout {
      column-count: 2;
    }
    
    .post-list-container.row-layout .post-item {
      max-width: calc(50% - 0.75rem);
    }
  }
  
  @media (max-width: 640px) {
    .post-list-container.column-layout {
      column-count: 1;
    }
    
    .post-list-container.row-layout {
      flex-direction: column;
    }
    
    .post-list-container.row-layout .post-item {
      max-width: 100%;
      min-width: 100%;
    }
  }
</style>