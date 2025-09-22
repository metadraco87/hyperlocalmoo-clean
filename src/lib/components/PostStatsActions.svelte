<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getPostStarCount } from '$lib/api';
  import { auth } from '$lib/stores/auth';

  export let post: any;
  export let isStarred: boolean = false;
  export let hasExactLocation: boolean = false; // Fixed prop name
  export let commentCount: number = 0;
  export let loadingStats: boolean = false;
  export let extraClass: string = '';

  export let canDelete: boolean = false;
  export let showMoreActions: boolean = true;

  // Local state for stats dropup
  let showStats = false;
  let showMoreMenu = false;
  let starCount = 0;
  let loadingStarCount = false;

  const dispatch = createEventDispatcher();

  // Fetch star count when stats are shown
  async function fetchStarCount() {
    if (!post?.id || !$auth?.token || loadingStarCount) return;
    
    loadingStarCount = true;
    try {
      const result = await getPostStarCount(post.id, $auth.token);
      starCount = typeof result.starCount === 'number' ? result.starCount : 0;
    } catch (error) {
      console.error('Error fetching star count:', error);
      starCount = 0;
    } finally {
      loadingStarCount = false;
    }
  }

  // Initialize star count from post data if available
  $: if (post?.starCount !== undefined) {
    starCount = post.starCount;
  }
  
  // Debug post stats fields
  $: if (post?.id) {
    console.log(`📊 Post ${post.id} stats debug:`, {
      frontend_views: post.views,
      backend_viewCount: post.viewCount,
      frontend_clicks: post.clicks,
      backend_clickCount: post.clickCount,
      frontend_starCount: post.starCount,
      backend_starsCount: post.starsCount,
      backend_stars: post.stars,
      commentsCount: post.commentsCount,
      statsFields: Object.keys(post).filter(k => k.includes('view') || k.includes('click') || k.includes('star') || k.includes('count') || k.includes('Comment'))
    });
  }
  
  // Fetch star count when stats dropdown is opened and we don't have data
  $: if (showStats && !loadingStarCount && starCount === 0 && !post?.starCount) {
    fetchStarCount();
  }

  // Public method to refresh star count (called from parent after starring)
  export function refreshStarCount() {
    fetchStarCount();
  }
  
  function handleReportClick(e: Event) {
    e?.stopPropagation?.();
    showMoreMenu = false;
    console.log('🚨 Report button clicked, dispatching report event');
    dispatch('report');
  }

  function handleFeatureClick(e: Event) {
    e?.stopPropagation?.();
    dispatch('featureClick');
  }
  
  function handleCommentsClick(e: Event) {
    e?.stopPropagation?.();
    dispatch('commentsClick');
  }
  
  function handleMapClick(e: Event) {
    e?.stopPropagation?.();
    dispatch('mapClick');
  }
  
  function handleShareClick(e: Event) {
    e?.stopPropagation?.();
    dispatch('shareClick');
  }
  
  function handleHideClick(e: Event) {
    e?.stopPropagation?.();
    dispatch('hideClick');
  }
  
  function handleDeleteClick(e: Event) {
    e?.stopPropagation?.();
    console.log('🗑️ Delete button clicked, dispatching deleteClick event');
    dispatch('deleteClick');
  }

  function toggleStats(e: MouseEvent) {
    e.stopPropagation();
    showStats = !showStats;
  }

  function toggleMoreMenu(e: MouseEvent) {
    e.stopPropagation();
    showMoreMenu = !showMoreMenu;
  }
</script>

<div class={`post-footer ${extraClass || ''}`}>
  <!-- More Actions (three-dot) Button - moved left of stats button -->
  {#if showMoreActions}
    <div class="more-actions">
      <button class="post-footer-btn more-btn" on:click={toggleMoreMenu} title="More actions">
        <svg width="20" height="20" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24" class:rotated={showMoreMenu}><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
      </button>
      {#if showMoreMenu}
        <div class="more-menu">
          <button class="menu-item" on:click={handleReportClick}>Report</button>
          <button class="menu-item" on:click={handleHideClick}>Hide</button>
          {#if canDelete}
            <button class="menu-item danger" on:click={handleDeleteClick}>Delete</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Stats Dropup Button -->
  <button class="post-footer-btn stats-btn" on:click={toggleStats} title="Show stats">
    <svg width="20" height="20" fill="none" stroke="#2563eb" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12h1v4H8zM11 8h1v8h-1zM14 10h1v6h-1z"/>
    </svg>
  </button>

  <!-- Stats Dropup -->
  {#if showStats}
    <div class="stats-dropup">
      {#if loadingStats}
        <div class="stat-item">Loading...</div>
      {:else}
        <div class="stat-item" title="Views">
          <svg width="16" height="16" fill="none" stroke="#2563eb" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span class="stat-num">{post.viewCount ?? post.views ?? 0}</span>
        </div>
        <div class="stat-item" title="Clicks">
          <!-- Target icon -->
          <svg width="16" height="16" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="5"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <span class="stat-num">{post.clickCount ?? post.clicks ?? 0}</span>
        </div>
        <div class="stat-item" title="Stars">
          <svg width="16" height="16" fill="#2563eb" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"/></svg>
          <span class="stat-num">{post.starsCount ?? post.stars ?? (loadingStarCount ? '...' : starCount)}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Comments Button -->
  <button class="post-footer-btn comments-footer-btn" on:click={handleCommentsClick} title="Comments">
    <svg width="20" height="20" fill="none" stroke="#2563eb" stroke-width="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="comment-count">{commentCount}</span>
  </button>

  <!-- See on Map Button - Fixed prop name -->
  {#if hasExactLocation}
    <button class="post-footer-btn see-on-map-btn-icon" on:click={handleMapClick} title="See on map">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    </button>
  {/if}

  <!-- Feature Button -->
  <button class="post-footer-btn feature-footer-btn" on:click={handleFeatureClick} title="Feature post">
    <svg width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  </button>

  <!-- Share Button -->
  <button class="post-footer-btn share-btn post-footer-share" on:click={handleShareClick} title="Share post">
    <svg width="20" height="20" fill="none" stroke="#2563eb" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
  </button>
</div>

<style>
  .post-footer {
    display: flex;
    align-items: center;
    gap: 0.5em;
    background: #fff;
    padding: 0.5em 2em 0.5em 2em;
    border-top: 1px solid #e5e7eb;
    position: relative;
    justify-content: space-between;
  }
  
  .post-footer-btn {
    background: none;
    border: none;
    color: #2563eb;
    border-radius: 50%;
    padding: 0.4em;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    position: relative;
    min-width: 40px;
    min-height: 40px;
    justify-content: center;
  }
  
  .post-footer-btn:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
  }
  
  .post-footer-btn:active {
    transform: translateY(0);
  }
  
  .comment-count {
    font-size: 0.8rem;
    margin-left: 0.2rem;
    color: #2563eb;
    font-weight: 500;
  }
  
  .stats-dropup {
    position: absolute;
    left: 0;
    bottom: 2.5em;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 0.7em;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    padding: 0.6em 0.8em;
    z-index: 10;
    min-width: auto;
    display: flex;
    flex-direction: row;
    gap: 0.75em;
    animation: dropup 0.2s;
  }
  
  @keyframes dropup {
    from { opacity: 0; transform: translateY(20px);}
    to { opacity: 1; transform: translateY(0);}
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.35em;
    font-size: 0.95em;
    color: #0b1220;
  }
  
  .stat-num { 
    color: #2563eb; 
    font-weight: 600; 
  }

  /* Allow parent to style this footer via extraClass without affecting other usages */
  .post-footer.modal-post-actions {
    justify-content: space-evenly;
    padding: 0.5em 2em 0.5em 2em;
    gap: 0.5em;
  }

  /* More menu */
  .more-actions { 
    position: relative; 
  }
  
  .more-btn { 
    color: #6b7280; 
  }
  
  .more-btn svg { 
    transition: transform 0.2s ease; 
  }
  
  .more-btn svg.rotated { 
    transform: rotate(90deg); 
  }
  
  .more-menu { 
    display: block; 
    position: absolute; 
    left: 0; 
    bottom: 2.5em; 
    background: #fff; 
    border: 1px solid #e5e7eb; 
    border-radius: 8px; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
    padding: 0.35rem; 
    min-width: 120px; 
    z-index: 20;
  }
  
  .menu-item { 
    background: none; 
    border: none; 
    width: 100%; 
    text-align: left; 
    padding: 0.45rem 0.6rem; 
    cursor: pointer; 
    color: #0b1220; 
    border-radius: 6px; 
    transition: background 0.2s ease;
  }
  
  .menu-item:hover { 
    background: #f3f4f6; 
  }
  
  .menu-item.danger { 
    color: #dc2626; 
  }
  
  .menu-item.danger:hover { 
    background: #fef2f2; 
  }
</style>