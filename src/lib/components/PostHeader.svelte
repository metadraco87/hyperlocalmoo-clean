<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let post: any = {};
  export let displayAuthorImgSrc: string = '';
  export let displayAuthorUsername: string = '';
  export let effectiveIsFeatured: boolean = false;
  export let categoryColors: Record<string, string> = {};
  export let categoryTextColors: Record<string, string> = {};
  export let isStarred: boolean = false;

  // For star button
  export let loadingStarCount: boolean = false;

  // For reposter header
  export let reposter: any = null;

  const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';

  // Fallbacks for author image and username
  $: authorImgSrc = displayAuthorImgSrc || post.profileImageUrl || DEFAULT_PROFILE_PIC;
  $: authorUsername = displayAuthorUsername || post.username || 'Unknown';

  const dispatch = createEventDispatcher();

  function handleUsernameClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('usernameClick', { username: authorUsername });
  }

  function handleStarClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('starClick');
  }

  function handleUndoClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('undoRepost');
  }

  function formatFeaturedCountdown(post: any): string {
    const now = Date.now();
    const locationUntil = post.featuredInLocationUntil || 0;
    const searchUntil = post.featuredInSearchUntil || 0;
    const until = Math.max(locationUntil, searchUntil);
    
    if (until <= now) return '';
    
    const diff = until - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m`;
    }
  }
</script>

<div class="post-header-container">
  <div
    class="author-header"
    style="background-color: {categoryColors[post.category] || '#f5f5f5'}; color: {categoryTextColors[post.category] || '#222'}"
  >
    <div class="header-row">
      <div class="author-block">
        <img
          class="author-img"
          src={authorImgSrc}
          alt="Author profile"
          on:click|stopPropagation={handleUsernameClick}
          tabindex="0"
          role="button"
          aria-label="View profile"
        />
        <span
          class="author-username"
          on:click|stopPropagation={handleUsernameClick}
          tabindex="0"
          role="button"
          aria-label="View profile"
        >
          {authorUsername}
        </span>
        {#if effectiveIsFeatured}
          <span class="badge-featured">FEATURED</span>
          {#if post.featuredInLocationUntil || post.featuredInSearchUntil}
            <span class="featured-countdown">{formatFeaturedCountdown(post)}</span>
          {/if}
        {/if}
        {#if post.countdown}
          <span class="countdown-badge">{post.countdown}</span>
        {/if}
      </div>
      <button
        class="star-btn"
        aria-label="Star post"
        on:click|stopPropagation={handleStarClick}
        disabled={loadingStarCount}
      >
        {#if isStarred}
          <svg width="32" height="32" fill="#FFD700" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"/></svg>
        {:else}
          <svg width="32" height="32" fill="#bbb" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"/></svg>
        {/if}
      </button>
    </div>
  </div>

  {#if reposter}
    <div class="reposter-header">
      <div class="reposter-block">
        <img class="reposter-img" src={reposter.imgSrc} alt="Reposter profile" />
        <div class="reposter-info">
          <span class="reposter-text">{reposter.username} reposted</span>
        </div>
      </div>
      {#if reposter.canUndo}
        <button class="undo-repost-btn" on:click={handleUndoClick} title="Undo repost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
          <span>Undo</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>


.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.5rem;
}

.author-block {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.author-img {
    width: 2.1em;
    height: 2.1em;
    border-radius: 20%;
    border: 1px #000000;
    object-fit: cover;
    background: #f3f4f6;
}

.author-username {
    font-weight: 700;
    text-decoration: none;
    font-size: 1.03em;
    letter-spacing: 0.01em;
    transition: color 0.2s;
    font-family:'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    padding-left: -0.5em;
    margin-left: -0.25em;
  }

.badge-featured {
  background: linear-gradient(135deg, #ffff00 0%, #ffd700 50%, #ffaa00 100%);
  color: #1a1a1a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.15rem 0.8rem;
  border-radius: 0.8rem;
  margin-left: 0.3rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4), 0 0 0 1px rgba(255, 170, 0, 0.6);
  user-select: none;
  animation: featuredGlow 2s ease-in-out infinite alternate;
}

@keyframes featuredGlow {
  0% {
    box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4), 0 0 0 1px rgba(255, 170, 0, 0.6);
  }
  100% {
    box-shadow: 0 2px 12px rgba(255, 215, 0, 0.7), 0 0 0 2px rgba(255, 170, 0, 0.8);
  }
}

.featured-countdown {
  font-size: 0.65rem;
  font-weight: 600;
  margin-left: 0.3rem;
  opacity: 0.8;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.1rem 0.3rem;
  border-radius: 0.3rem;
}

.countdown-badge {
  background: #e74c3c;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.13rem 0.7rem;
  border-radius: 0.7rem;
  margin-left: 0.3rem;
  letter-spacing: 0.04em;
  user-select: none;
}

.star-btn {
    background: none;
    border: none;
    padding: 0.1em;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    transition: background 0.15s;
    justify-content: space-between;
    position: relative;
    margin-right: 0.8rem;
}
.star-btn:hover {
    background: none;
}

.star-btn:hover svg {
    fill: #ffe057 !important; /* Yellow fill */
    stroke: #ffe057 !important; /* For outlined star */
}

.reposter-header { width: 100%; }

.reposter-header {
  width: 100%;
  background: #000000 !important;
  padding: 0.3rem 0.7rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reposter-block {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.reposter-img {
    width: 1.2em;
    height: 1.2em;
    border-radius: 20%;
    border: 1px #000000;
    object-fit: cover;
    background: #f3f4f6;
}
.reposter-info {
  display: flex;
  flex-direction: column;
}
.reposter-text {
  font-size: 0.93rem;
  color: #d2ebe8;
  opacity: 0.85;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.undo-repost-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.undo-repost-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #dc2626;
}

.undo-repost-btn svg {
  width: 12px;
  height: 12px;
}
</style>