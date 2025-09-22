<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  // Use local API URL for development
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import FeaturePostModal from '$lib/components/FeaturePostModal.svelte';

  export let activeTab;

  let posts = [];
  let filteredPosts = [];
  let loading = false;
  let error = '';
  let token = '';
  let searchQuery = '';
  let sortField = 'views';
  let sortDirection = 'desc';
  let timeframe = 'week'; // 'day', 'week', 'month', 'all'
  let loadingAttempts = 0;
  const MAX_LOADING_ATTEMPTS = 3;
  
  // Feature modal state
  let showFeatureModal = false;
  let selectedPost = null;

  onMount(async () => {
    // Try to get token from auth store first
    const authData = get(auth);
    token = authData?.token || '';
    
    // Fallback to localStorage if no token in store
    if (!token && browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
      console.log('Using token from localStorage:', token ? 'Found' : 'Not found');
    }
    
    if (activeTab === 'top-posts' && token) {
      await loadTopPosts();
    }
  });

  $: if (activeTab === 'top-posts' && token && !posts.length && !loading && !error && loadingAttempts < MAX_LOADING_ATTEMPTS) {
    loadTopPosts();
  }

  // Reset attempts when switching to this tab
  $: if (activeTab === 'top-posts') {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      loadingAttempts = 0;
    }
  }

  function resetAndReload() {
    loadingAttempts = 0;
    error = '';
    loadTopPosts();
  }

  $: {
    // Filter and sort posts whenever these values change
    if (posts.length) {
      filteredPosts = filterPosts(posts, searchQuery);
      sortPosts(filteredPosts, sortField, sortDirection);
    }
  }

  async function loadTopPosts() {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      error = 'Maximum loading attempts reached. Please refresh the page.';
      return;
    }
    
    try {
      loading = true;
      error = '';
      loadingAttempts++;
      console.log('Fetching top posts with token:', token ? 'Token exists' : 'No token');

      const response = await fetch(`http://localhost:4000/api/posts/top?timeframe=${getBackendTimeframe(timeframe)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      // Backend returns {posts: [...], count: number}
      if (data.posts && Array.isArray(data.posts)) {
        posts = data.posts;
      } else if (Array.isArray(data)) {
        posts = data;
      } else {
        console.error('Invalid post data format:', data);
        throw new Error('Expected posts array but received invalid data format');
      }
      filteredPosts = [...posts];
      sortPosts(filteredPosts, sortField, sortDirection);
    } catch (err) {
      error = err.message || 'An error occurred while loading top posts';
      console.error('Error loading top posts:', err);
    } finally {
      loading = false;
    }
  }

  function filterPosts(posts, query) {
    if (!query.trim()) return [...posts];
    
    const lowerQuery = query.toLowerCase();
    return posts.filter(post => 
      post.headline?.toLowerCase().includes(lowerQuery) ||
      post.content?.toLowerCase().includes(lowerQuery) ||
      post.username?.toLowerCase().includes(lowerQuery)
    );
  }

  function sortPosts(posts, field, direction) {
    posts.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
      
      // Handle dates
      if (field === 'createdAt') {
        valueA = new Date(valueA || 0).getTime();
        valueB = new Date(valueB || 0).getTime();
      }
      
      // Handle null/undefined values
      if (valueA === null || valueA === undefined) return direction === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return direction === 'asc' ? 1 : -1;
      
      // String comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // Number comparison
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  function toggleSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'desc'; // Default to descending for most metrics
    }
    sortPosts(filteredPosts, sortField, sortDirection);
  }

  function changeTimeframe(newTimeframe) {
    if (timeframe !== newTimeframe) {
      timeframe = newTimeframe;
      loadingAttempts = 0; // Reset attempts when changing timeframe
      loadTopPosts();
    }
  }

  // Convert frontend timeframe to backend format
  function getBackendTimeframe(frontendTimeframe) {
    const mapping = {
      'day': '1d',
      'week': '7d', 
      'month': '30d',
      'all': 'all'
    };
    return mapping[frontendTimeframe] || '7d';
  }

  async function togglePostFeatured(postId, currentFeaturedStatus) {
    // Open the enhanced feature modal (supports both admin and payment flows)
    selectedPost = posts.find(p => p.id === postId);
    showFeatureModal = true;
  }
  
  function handleFeatureModalClose() {
    showFeatureModal = false;
    selectedPost = null;
  }
  
  function handleFeatureSuccess() {
    // Refresh the posts list after successful feature
    loadTopPosts();
  }

  async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:4000/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete post');
      }

      // Update the local state
      posts = posts.filter(p => p.id !== postId);
      filteredPosts = filterPosts(posts, searchQuery);
    } catch (err) {
      error = err.message || 'An error occurred while deleting the post';
      console.error('Error deleting post:', err);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
  }

  function isFeatured(post) {
    const now = Date.now();
    return (post.featuredInLocationUntil && post.featuredInLocationUntil > now) || 
           (post.featuredInSearchUntil && post.featuredInSearchUntil > now);
  }
</script>

{#if loading}
  <div class="loading-container">
    <LoadingSpinner />
  </div>
{:else if error}
  <div class="error-message">
    <p>{error}</p>
    <button on:click={resetAndReload}>Try Again</button>
  </div>
{:else}
  <div class="top-posts-container">
    <div class="top-posts-header">
      <h3>Top Posts</h3>
      <div class="controls">
        <div class="timeframe-selector">
          <button 
            class="timeframe-btn {timeframe === 'day' ? 'active' : ''}" 
            on:click={() => changeTimeframe('day')}
          >
            Today
          </button>
          <button 
            class="timeframe-btn {timeframe === 'week' ? 'active' : ''}" 
            on:click={() => changeTimeframe('week')}
          >
            This Week
          </button>
          <button 
            class="timeframe-btn {timeframe === 'month' ? 'active' : ''}" 
            on:click={() => changeTimeframe('month')}
          >
            This Month
          </button>
          <button 
            class="timeframe-btn {timeframe === 'all' ? 'active' : ''}" 
            on:click={() => changeTimeframe('all')}
          >
            All Time
          </button>
        </div>
        <div class="search-container">
          <input 
            type="text" 
            placeholder="Search posts..." 
            bind:value={searchQuery}
            class="search-input"
          />
        </div>
      </div>
    </div>
    
    {#if filteredPosts.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          <p>No posts found matching '{searchQuery}'</p>
        {:else}
          <p>No posts found for the selected timeframe</p>
        {/if}
      </div>
    {:else}
      <div class="posts-table-container">
        <table class="posts-table">
          <thead>
            <tr>
              <th on:click={() => toggleSort('headline')}>
                Post
                {#if sortField === 'headline'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('username')}>
                Author
                {#if sortField === 'username'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('views')}>
                Views
                {#if sortField === 'views'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('clicks')}>
                Clicks
                {#if sortField === 'clicks'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('commentsCount')}>
                Comments
                {#if sortField === 'commentsCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('starsCount')}>
                Stars
                {#if sortField === 'starsCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('shareCount')}>
                Shares
                {#if sortField === 'shareCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('repostCount')}>
                Reposts
                {#if sortField === 'repostCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('createdAt')}>
                Posted
                {#if sortField === 'createdAt'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredPosts as post (post.id)}
              <tr class={isFeatured(post) ? 'featured-row' : ''}>
                <td class="post-title-cell">
                  {#if post.mediaUrl || post.imageUrl}
                    <div class="post-thumbnail">
                      <img src={post.mediaUrl || post.imageUrl} alt="Thumbnail" />
                    </div>
                  {/if}
                  <div>
                    <div class="post-title">
                      {#if post.headline}
                        {post.headline}
                      {:else if post.content && post.content.trim()}
                        {truncateText(post.content, 50)}
                      {:else}
                        (no content)
                      {/if}
                    </div>
                    {#if isFeatured(post)}
                      <span class="featured-badge">FEATURED</span>
                    {/if}
                  </div>
                </td>
                <td>{post.username || '(Anonymous)'}</td>
                <td>{post.views || 0}</td>
                <td>{post.clicks || 0}</td>
                <td>{post.commentsCount || 0}</td>
                <td>{post.starsCount || 0}</td>
                <td>{post.shareCount || 0}</td>
                <td>{post.repostCount || 0}</td>
                <td>{formatDate(post.createdAt)}</td>
                <td class="actions-cell">
                  <button 
                    class="action-btn {isFeatured(post) ? 'unfeature-btn' : 'feature-btn'}"
                    on:click={() => togglePostFeatured(post.id, isFeatured(post))}
                  >
                    {isFeatured(post) ? 'Unfeature' : 'Feature'}
                  </button>
                  <button 
                    class="action-btn view-btn"
                    on:click={() => window.open(`/posts/${post.id}`, '_blank')}
                  >
                    View
                  </button>
                  <button class="action-btn delete-btn" on:click={() => deletePost(post.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    margin: 20px 0;
    text-align: center;
  }

  .error-message button {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    margin-top: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .error-message button:hover {
    background: rgba(16, 185, 192, 0.3);
  }

  .empty-state {
    text-align: center;
    color: #8b949e;
    padding: 40px 0;
  }

  .top-posts-container {
    padding: 10px 0;
  }

  .top-posts-header {
    margin-bottom: 20px;
  }

  .top-posts-header h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 15px 0;
    color: #c9d1d9;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    justify-content: space-between;
    align-items: center;
  }

  .timeframe-selector {
    display: flex;
    gap: 8px;
  }

  .timeframe-btn {
    background: rgba(22, 27, 34, 0.8);
    color: #8b949e;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .timeframe-btn:hover {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
  }

  .timeframe-btn.active {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border-color: rgba(16, 185, 192, 0.5);
  }

  .search-container {
    width: 300px;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    font-size: 1rem;
    background: rgba(13, 17, 23, 0.8);
    color: #c9d1d9;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(16, 185, 192, 0.5);
    box-shadow: 0 0 0 2px rgba(16, 185, 192, 0.2);
  }

  .search-input::placeholder {
    color: #8b949e;
  }

  .posts-table-container {
    overflow-x: auto;
  }

  .posts-table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .posts-table th, .posts-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
    color: #c9d1d9;
  }

  .posts-table th {
    background: rgba(16, 185, 192, 0.1);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .posts-table th:hover {
    background: rgba(16, 185, 192, 0.2);
  }

  .sort-indicator {
    margin-left: 4px;
    font-weight: bold;
    color: #10b9c0;
  }

  .featured-row {
    background: rgba(251, 191, 36, 0.1);
  }

  .post-title-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .post-thumbnail {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 192, 0.3);
    overflow: hidden;
    background: rgba(16, 185, 192, 0.1);
  }

  .post-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-title {
    font-weight: 500;
    color: #c9d1d9;
    margin-bottom: 4px;
  }

  .featured-badge {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .actions-cell {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid;
  }

  .feature-btn {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .feature-btn:hover {
    background: rgba(251, 191, 36, 0.3);
  }

  .unfeature-btn {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border-color: rgba(107, 114, 128, 0.3);
  }

  .unfeature-btn:hover {
    background: rgba(107, 114, 128, 0.3);
  }

  .view-btn {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border-color: rgba(16, 185, 192, 0.3);
  }

  .view-btn:hover {
    background: rgba(16, 185, 192, 0.3);
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  @media (max-width: 768px) {
    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .search-container {
      width: 100%;
    }

    .timeframe-selector {
      justify-content: center;
    }
  }
</style>

<!-- Enhanced Feature Modal (supports both admin and payment flows) -->
<FeaturePostModal
  show={showFeatureModal}
  postId={selectedPost?.id}
  onClose={handleFeatureModalClose}
/>
