<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TaggedText from '$lib/components/TaggedText.svelte';
  
  export let post: any;
  export let displayPost: any;
  export let displayContent: string;
  export let wikipediaPreview: any = undefined;
  export let linkPreview: any = undefined;
  export let showHeadline: boolean = true;

  const dispatch = createEventDispatcher();

  // Media detection functions (matching CreatePostOverlay logic)
  function isImageUrl(url: string): boolean {
    if (!url) return false;
    return /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  }

  function isVideoUrl(url: string): boolean {
    if (!url) return false;
    const videoPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /(?:tiktok\.com\/@[^\/]+\/video\/|tiktok\.com\/v\/)(\d+)/,
      /(?:facebook\.com\/.*\/videos\/|fb\.watch\/)(\d+)/,
      /(?:vimeo\.com\/)(\d+)/,
      /(?:instagram\.com\/p\/|instagram\.com\/reel\/)([A-Za-z0-9_-]+)/
    ];
    return videoPatterns.some(pattern => pattern.test(url));
  }

  function getVideoInfo(url: string): { platform: string; id: string; embedUrl: string } | null {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (youtubeMatch) {
      return {
        platform: 'youtube',
        id: youtubeMatch[1],
        embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`
      };
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
    if (vimeoMatch) {
      return {
        platform: 'vimeo',
        id: vimeoMatch[1],
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
      };
    }

    return null;
  }

  // Extract and process URLs from content
  function extractMediaFromContent(content: string): { 
    detectedImageUrl: string | null; 
    videoEmbed: any | null; 
    processedContent: string 
  } {
    if (!content) return { detectedImageUrl: null, videoEmbed: null, processedContent: content };
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    
    let processedContent = content;
    let detectedImageUrl: string | null = null;
    let videoEmbed: any | null = null;

    if (urls && urls.length > 0) {
      for (const url of urls) {
        if (isImageUrl(url) && !detectedImageUrl) {
          detectedImageUrl = url;
          // Remove the image URL from content since we'll display it as an image
          processedContent = processedContent.replace(url, '').trim();
        } else if (isVideoUrl(url) && !videoEmbed) {
          const videoInfo = getVideoInfo(url);
          if (videoInfo) {
            videoEmbed = { ...videoInfo, originalUrl: url };
            // Replace the video URL with shortened text
            const shortenedUrl = `${videoInfo.platform.charAt(0).toUpperCase() + videoInfo.platform.slice(1)} video`;
            processedContent = processedContent.replace(url, shortenedUrl).trim();
          }
        }
      }
    }

    return { detectedImageUrl, videoEmbed, processedContent };
  }

  // Process content for media detection
  $: contentMedia = extractMediaFromContent(displayContent);
  $: finalDisplayContent = contentMedia.processedContent;
  $: detectedImageUrl = contentMedia.detectedImageUrl;
  $: detectedVideoEmbed = contentMedia.videoEmbed;

  function handleLinkClick(e: any) {
    dispatch('linkClick', { event: e });
  }

  function linkify(text: string) {
    return text.replace(
      /https?:\/\/[^\s]+/g,
      url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }
</script>

<!-- Media Section -->
{#if displayPost.mediaUrl || displayPost.imageUrl || detectedImageUrl || detectedVideoEmbed}
  <div class="media-container">
    <!-- Post-stored media (uploaded files) -->
    {#if displayPost.mediaUrl}
      {#if displayPost.mediaUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i)}
        <img src={displayPost.mediaUrl} alt="Post media" class="post-media" />
      {:else if displayPost.mediaUrl.match(/\.(mp4|webm|mov|avi)$/i)}
        <video src={displayPost.mediaUrl} class="post-media" controls muted playsinline />
      {:else}
        <!-- Fallback for other media types -->
        <img src={displayPost.mediaUrl} alt="Post media" class="post-media" />
      {/if}
    {:else if displayPost.imageUrl}
      <img src={displayPost.imageUrl} alt="Post content" class="post-media" />
    <!-- Content-detected media -->
    {:else if detectedImageUrl}
      <img src={detectedImageUrl} alt="Detected image" class="post-media" />
    {:else if detectedVideoEmbed}
      <div class="video-embed-container">
        <div class="video-embed-header">
          <span class="video-platform">{detectedVideoEmbed.platform.charAt(0).toUpperCase() + detectedVideoEmbed.platform.slice(1)} Video</span>
        </div>
        {#if detectedVideoEmbed.platform === 'youtube'}
          <iframe
            src={detectedVideoEmbed.embedUrl}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            class="video-embed"
            title="YouTube video"
          ></iframe>
        {:else if detectedVideoEmbed.platform === 'vimeo'}
          <iframe
            src={detectedVideoEmbed.embedUrl}
            frameborder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            class="video-embed"
            title="Vimeo video"
          ></iframe>
        {:else}
          <div class="video-placeholder">
            <p>{detectedVideoEmbed.platform.charAt(0).toUpperCase() + detectedVideoEmbed.platform.slice(1)} video</p>
            <a href={detectedVideoEmbed.originalUrl} target="_blank" rel="noopener noreferrer" class="video-link">View Original</a>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- Content Section -->
<div class="post-content-container">
  {#if showHeadline && post.headline}
    <h5 class="post-headline">
      <TaggedText 
        text={post.headline} 
        taggedUsersDetailed={post.taggedUsersDetailed || []}
        className="headline-tags"
      />
    </h5>
  {/if}

  {#if finalDisplayContent && finalDisplayContent.trim()}
    <div class="post-content">
      <TaggedText 
        text={finalDisplayContent} 
        taggedUsersDetailed={post.taggedUsersDetailed || []}
        className="content-tags"
      />
    </div>
  {/if}
  
  <!-- Wikipedia Preview (inside post content) -->
  {#if post.link && post.link.includes('wikipedia.org') && wikipediaPreview}
    <div class="wiki-preview">
      <h4>Wikipedia Preview</h4>
      <div class="wiki-content-box">
        {#if wikipediaPreview.thumbnail}
          <img src={wikipediaPreview.thumbnail} alt={wikipediaPreview.title} class="wiki-thumbnail" />
        {/if}
        <div>
          <strong>{wikipediaPreview.title}</strong>
          <div class="wiki-extract">{wikipediaPreview.extract}</div>
          <a href={wikipediaPreview.url} target="_blank" rel="noopener noreferrer" class="wiki-read-more">Read more</a>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Link Preview (inside post content) -->
  {#if post.link && !post.link.includes('wikipedia.org') && linkPreview}
    <div class="link-preview" on:click={handleLinkClick} on:keydown={(e) => e.key === 'Enter' && handleLinkClick(e)} role="button" tabindex="0">
      <div class="link-preview-content">
        {#if linkPreview.image}
          <img src={linkPreview.image} alt={linkPreview.title || 'Link preview'} class="link-preview-image" />
        {/if}
        <div class="link-preview-text">
          {#if linkPreview.title}
            <h4 class="link-preview-title">{linkPreview.title}</h4>
          {/if}
          {#if linkPreview.description}
            <p class="link-preview-description">{linkPreview.description}</p>
          {/if}
          <!-- Hide raw link, only show for sharing -->
          <div class="link-preview-url-hidden">
            {post.link}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-container {
    position: relative;
    width: 100%;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .post-media {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Specific styling for video elements */
  video.post-media {
    object-fit: contain;
    background: #000;
  }

  .post-content-container {
    padding: 0.5rem 0.5rem 0.5rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .post-headline {
    font-size: 1.25em;
    font-weight: 800;
    color: #1a202c;
    margin: 0.3em 0.2em 0em 0.2em;
  }

  .post-content {
    font-size: 1rem;
    color: #1e293b;
    line-height: 1.6;
    margin-left: 0.3rem;
    word-break: break-word;
  }

  .wiki-preview {
    background: #fefcbf;
    border: 1px solid #fde047;
    border-radius: 0.8em;
    padding: 1em 1.2em;
    margin-top: 1.2em;
    font-size: 0.95em;
    color: #444;
  }
  .wiki-preview h4 {
    margin: 0 0 0.8em;
    font-weight: 700;
    color: #713f12;
  }
  .wiki-content-box {
    display: flex;
    gap: 1em;
  }
  .wiki-thumbnail {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 0.4em;
  }
  .wiki-extract {
    margin-top: 0.4em;
    font-size: 0.9em;
  }
  .wiki-read-more {
    font-size: 0.9em;
    color: #1e40af;
    text-decoration: none;
  }
  .wiki-read-more:hover { text-decoration: underline; }

  /* --- LINK PREVIEW --- */
  .link-preview {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.8em;
    padding: 1em;
    margin-top: 1.2em;
    font-size: 0.95em;
    color: #444;
    transition: box-shadow 0.2s ease;
    cursor: pointer;
  }
  .link-preview:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .link-preview-content {
    display: flex;
    gap: 1em;
    align-items: flex-start;
  }
  .link-preview-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 0.6em;
    flex-shrink: 0;
  }
  .link-preview-text {
    flex: 1;
    min-width: 0;
  }
  .link-preview-title {
    margin: 0 0 0.5em;
    font-weight: 600;
    font-size: 1em;
    color: #1a202c;
    line-height: 1.3;
  }
  .link-preview-description {
    margin: 0 0 0.75em;
    font-size: 0.9em;
    color: #4a5568;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .link-preview-url-hidden {
    display: none; /* Hidden but accessible for sharing functionality */
    font-size: 0.85em;
    color: #1e40af;
    word-break: break-all;
  }

  /* Video Embed Styles */
  .video-embed-container {
    background: #f8fafc;
    border-radius: 0.8em;
    overflow: hidden;
    margin: 0.5em 0;
  }

  .video-embed-header {
    background: #e2e8f0;
    padding: 0.5em 1em;
    font-size: 0.9em;
    font-weight: 600;
    color: #334155;
  }

  .video-platform {
    color: #2563eb;
  }

  .video-embed {
    width: 100%;
    height: 200px;
    border: none;
    background: #000;
  }

  .video-placeholder {
    background: rgba(0, 0, 0, 0.05);
    padding: 2em;
    text-align: center;
    border: 2px dashed #cbd5e1;
  }

  .video-placeholder p {
    color: #64748b;
    margin: 0 0 1em 0;
    font-size: 0.9em;
  }

  .video-link {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
  }

  .video-link:hover {
    text-decoration: underline;
  }
  
</style>