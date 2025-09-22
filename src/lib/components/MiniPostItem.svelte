<script lang="ts">
  import { goto } from '$app/navigation';

  // Props
  export let post: any;
  export let onEnlarge: (post: any) => void = () => {};

  const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';

  // Category colors (same as PostItem)
  const categoryColors: { [key: string]: string } = {
    'ALERTS': '#eef119',
    'NEWS': '#1a1919', 
    'EVENTS': '#b80a0a',
    'JOBS': '#18038b',
    'TASKS': '#350249',
    'BUSINESSES': '#046909',
    'POINTS OF INTEREST': '#e44303',
    'COMMUNITY': '#00eaff',
    'GENERAL INFORMATION': '#1f2124'
  };
  
  // Text colors - black for light backgrounds (ALERTS, COMMUNITY), white for others
  const categoryTextColors: { [key: string]: string } = {
    'ALERTS': '#000000',
    'NEWS': '#ffffff',
    'EVENTS': '#ffffff', 
    'JOBS': '#ffffff',
    'TASKS': '#ffffff',
    'BUSINESSES': '#ffffff',
    'POINTS OF INTEREST': '#ffffff',
    'COMMUNITY': '#000000',
    'GENERAL INFORMATION': '#ffffff'
  };

  // For reposts, use original post data for display
  $: displayPost = post.isRepost && post.originalPost ? post.originalPost : post;
  $: authorImgSrc = displayPost.profileImageUrl || DEFAULT_PROFILE_PIC;
  $: authorUsername = displayPost.username?.replace(/^@/, '') || displayPost.ownerUsername || 'unknown';

  // Truncate content for mini preview
  $: truncatedContent = displayPost.content && displayPost.content.length > 100 
    ? displayPost.content.substring(0, 100) + '...' 
    : displayPost.content;

  function handleClick() {
    if (onEnlarge && typeof onEnlarge === 'function') {
      onEnlarge(post);
    } else {
      // Fallback: navigate to posts page (you can customize this)
      goto(`/posts`);
    }
  }
</script>

<div class="mini-post-card" on:click={handleClick} on:keydown={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
  <!-- Post Header with Category Color -->
  <div class="mini-post-header" style="background-color: {categoryColors[post.category] || '#1a1a1a'};">
    <div class="mini-author-block">
      <img
        src={authorImgSrc}
        alt="Author"
        class="mini-author-img"
        on:error={(e) => e.currentTarget.src = DEFAULT_PROFILE_PIC}
      />
      <div class="mini-author-info">
        <span class="mini-author-username" style="color: {categoryTextColors[post.category] || '#ffffff'};">
          @{authorUsername}
        </span>
      </div>
    </div>
  </div>

  <!-- Media (if present) -->
  {#if displayPost.mediaUrl || displayPost.imageUrl}
    <div class="mini-media-container">
      {#if displayPost.mediaUrl}
        {#if displayPost.mediaUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i)}
          <img src={displayPost.mediaUrl} alt="Post media" class="mini-post-media" />
        {:else if displayPost.mediaUrl.match(/\.(mp4|webm|mov|avi)$/i)}
          <video src={displayPost.mediaUrl} class="mini-post-media" controls muted playsinline />
        {:else}
          <img src={displayPost.mediaUrl} alt="Post media" class="mini-post-media" />
        {/if}
      {:else if displayPost.imageUrl}
        <img src={displayPost.imageUrl} alt="Post content" class="mini-post-media" />
      {/if}
    </div>
  {/if}

  <!-- Content -->
  <div class="mini-post-content-container">
    {#if displayPost.headline}
      <h6 class="mini-post-headline">{displayPost.headline}</h6>
    {/if}
    {#if truncatedContent}
      <div class="mini-post-content">{truncatedContent}</div>
    {/if}
  </div>
</div>

<style>
  .mini-post-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    max-width: 300px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    margin: 0.5rem 0;
  }

  .mini-post-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .mini-post-header {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mini-author-block {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .mini-author-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .mini-author-info {
    display: flex;
    flex-direction: column;
  }

  .mini-author-username {
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
  }

  .mini-media-container {
    position: relative;
    width: 100%;
    max-height: 150px;
    overflow: hidden;
  }

  .mini-post-media {
    width: 100%;
    height: 100%;
    object-fit: cover;
    max-height: 150px;
  }

  .mini-post-content-container {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mini-post-headline {
    font-size: 1rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    line-height: 1.2;
  }

  .mini-post-content {
    font-size: 0.85rem;
    color: #4a5568;
    line-height: 1.3;
    margin: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .mini-post-card {
      max-width: 250px;
    }
    
    .mini-author-img {
      width: 28px;
      height: 28px;
    }
    
    .mini-author-username {
      font-size: 0.8rem;
    }
  }
</style>
