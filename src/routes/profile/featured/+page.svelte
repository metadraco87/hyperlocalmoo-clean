<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api';
  import PostItem from '$lib/components/PostItem.svelte';

  let isLoading = true;
  let errorMessage: string | null = null;
  let featuredPosts: any[] = [];

  // Helper to format duration until featured expires
  function formatCountdown(until: number) {
    if (!until || until < Date.now()) return 'Expired';
    const diff = Math.floor((until - Date.now()) / 1000);
    if (diff <= 0) return 'Expired';
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  async function fetchFeaturedPosts() {
    if (isLoading) return; // Prevent multiple simultaneous calls
    isLoading = true;
    errorMessage = null;
    try {
      if (!$auth.token) {
        errorMessage = 'You must be logged in to view your featured posts.';
        goto('/login');
        isLoading = false;
        return;
      }
      // Fetch from your backend
      const response = await api.getFeaturedPosts($auth.token);
      // Defensive: always set featuredPosts to an array
      let posts = [];
      if (response && Array.isArray(response.featuredPosts)) {
        posts = response.featuredPosts;
      }
      // Order: most recently featured first
      featuredPosts = posts.sort((a, b) => {
        const aMax = Math.max(a.featuredInLocationUntil || 0, a.featuredInSearchUntil || 0);
        const bMax = Math.max(b.featuredInLocationUntil || 0, b.featuredInSearchUntil || 0);
        return bMax - aMax;
      });
      // Always clear loading state
      isLoading = false;
    } catch (err: any) {
      console.error('Error fetching featured posts:', err);
      if (err.message && err.message.includes('CORS')) {
        errorMessage = 'Network error loading featured posts. Please try again later.';
      } else {
        errorMessage = err.message || 'Failed to load featured posts.';
      }
      featuredPosts = [];
      isLoading = false;
    }
  }

  // On mount, fetch
  onMount(() => {
    let loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Featured posts loading timed out after 5 seconds. Forcing no-featured state.');
        isLoading = false;
        if (!errorMessage && (!featuredPosts || featuredPosts.length === 0)) {
          featuredPosts = [];
        }
      }
    }, 5000);
    fetchFeaturedPosts().finally(() => clearTimeout(loadingTimeout));
  });

  // For renew
  async function handleFeatured(postId: string) {
    await fetchFeaturedPosts();
  }
</script>

<div class="featured-container">
  <h1 class="title">My Featured Posts</h1>
  <button class="back-btn" on:click={() => goto('/profile')}>← Back to Profile</button>

  {#if isLoading}
    <div class="loading">Loading your featured posts...</div>
  {:else if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {:else if featuredPosts.length === 0}
    <div class="no-featured">You have no featured posts yet.</div>
  {:else}
    <div class="posts-list">
      {#each featuredPosts as post (post.id)}
        <div class="post-row">
          <PostItem {post}
            isHighlighted={
              (post.featuredInLocationUntil && post.featuredInLocationUntil > Date.now()) ||
              (post.featuredInSearchUntil && post.featuredInSearchUntil > Date.now())
            }
            on:featured={() => handleFeatured(post.id)}
          />
          <div class="feature-status">
            {#if post.featuredInLocationUntil && post.featuredInLocationUntil > Date.now()}
              <span class="badge badge-location">Location</span>
              <span class="countdown">{formatCountdown(post.featuredInLocationUntil)} left</span>
            {/if}
            {#if post.featuredInSearchUntil && post.featuredInSearchUntil > Date.now()}
              <span class="badge badge-search">Search</span>
              <span class="countdown">{formatCountdown(post.featuredInSearchUntil)} left</span>
            {/if}
            {#if (!post.featuredInLocationUntil || post.featuredInLocationUntil < Date.now()) && (!post.featuredInSearchUntil || post.featuredInSearchUntil < Date.now())}
              <span class="badge expired">EXPIRED</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .featured-container {
    max-width: 900px;
    margin: 2.8em auto 0 auto;
    background: #fff;
    border-radius: 1.4em;
    box-shadow: 0 6px 24px #0001;
    padding: 2.8em 2.3em;
    min-height: 70vh;
    position: relative;
  }
  .title {
    font-size: 2.2em;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #1e293b;
    margin-bottom: 0.7em;
    text-align: center;
  }
  .back-btn {
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 0.6em;
    padding: 0.6em 1.3em;
    margin-bottom: 1.6em;
    cursor: pointer;
    font-weight: 600;
    font-size: 1em;
    box-shadow: 0 2px 8px #00000012;
    transition: background 0.15s;
  }
  .back-btn:hover { background: #e5e7eb; }
  .loading, .error-message, .no-featured {
    text-align: center;
    color: #71717a;
    font-size: 1.1em;
    margin-top: 2.2em;
  }
  .error-message { color: #dc2626; }
  .no-featured { color: #888; }
  .posts-list {
    margin-top: 1.7em;
    display: flex;
    flex-direction: column;
    gap: 2.2em;
  }
  .post-row {
    background: #f9fafb;
    border-radius: 1em;
    box-shadow: 0 2px 10px #00000010;
    padding: 1.2em;
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5em;
    align-items: flex-start;
  }
  .feature-status {
    margin-left: auto;
    align-self: flex-start;
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    min-width: 120px;
    max-width: 180px;
    font-size: 1em;
  }
  .badge {
    display: inline-block;
    font-weight: 700;
    border-radius: 0.7em;
    padding: 0.15em 0.85em;
    margin-right: 0.7em;
    margin-bottom: 0.14em;
    font-size: 0.98em;
    letter-spacing: 0.01em;
  }
  .badge-location {
    background: #facc15;
    color: #713f12;
  }
  .badge-search {
    background: #6366f1;
    color: #fff;
  }
  .badge.expired {
    background: #f3f4f6;
    color: #64748b;
    border: 1px solid #d1d5db;
  }
  .countdown {
    color: #64748b;
    font-size: 0.96em;
    margin-top: -0.1em;
    margin-bottom: 0.2em;
    margin-left: 0.4em;
  }
</style>