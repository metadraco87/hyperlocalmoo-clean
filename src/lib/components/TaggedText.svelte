<script lang="ts">
  import { goto } from '$app/navigation';
  
  export let text: string = '';
  export let taggedUsersDetailed: Array<{ userId: string; username: string; start: number; end: number }> = [];
  export let className: string = '';
  
  interface TextSegment {
    content: string;
    isTag: boolean;
    username?: string;
    userId?: string;
  }
  
  // Parse text into segments with tag information
  function parseTextWithTags(inputText: string, tagDetails: Array<{ userId: string; username: string; start: number; end: number }>): TextSegment[] {
    if (!inputText || tagDetails.length === 0) {
      return [{ content: inputText || '', isTag: false }];
    }
    
    // Sort tag details by start position
    const sortedTags = [...tagDetails].sort((a, b) => a.start - b.start);
    
    const segments: TextSegment[] = [];
    let currentPosition = 0;
    
    for (const tag of sortedTags) {
      // Add text before the tag
      if (tag.start > currentPosition) {
        const beforeText = inputText.substring(currentPosition, tag.start);
        if (beforeText) {
          segments.push({ content: beforeText, isTag: false });
        }
      }
      
      // Add the tag segment
      const tagText = inputText.substring(tag.start, tag.end);
      segments.push({
        content: tagText,
        isTag: true,
        username: tag.username,
        userId: tag.userId
      });
      
      currentPosition = tag.end;
    }
    
    // Add remaining text after the last tag
    if (currentPosition < inputText.length) {
      const remainingText = inputText.substring(currentPosition);
      if (remainingText) {
        segments.push({ content: remainingText, isTag: false });
      }
    }
    
    return segments;
  }
  
  function handleTagClick(username: string | undefined, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    if (username) {
      goto(`/profile/${encodeURIComponent(username)}`);
    }
  }
  
  function handleTagKeydown(username: string | undefined, event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      
      if (username) {
        goto(`/profile/${encodeURIComponent(username)}`);
      }
    }
  }
  
  $: segments = parseTextWithTags(text, taggedUsersDetailed);
</script>

<span class="tagged-text {className}">
  {#each segments as segment}
    {#if segment.isTag && segment.username}
      <button
        class="tag-link"
        on:click={(e) => handleTagClick(segment.username, e)}
        on:keydown={(e) => handleTagKeydown(segment.username, e)}
        title="View @{segment.username}'s profile"
        tabindex="0"
        aria-label="View profile of {segment.username}"
      >
        {segment.content}
      </button>
    {:else}
      <span class="text-segment">{segment.content}</span>
    {/if}
  {/each}
</span>

<style>
  .tagged-text {
    display: inline;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  
  .text-segment {
    display: inline;
  }
  
  .tag-link {
    display: inline;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: #2563eb;
    text-decoration: none;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s ease;
    position: relative;
  }
  
  .tag-link:hover {
    background-color: rgba(37, 99, 235, 0.1);
    text-decoration: underline;
    color: #1d4ed8;
  }
  
  .tag-link:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
    background-color: rgba(37, 99, 235, 0.1);
  }
  
  .tag-link:active {
    background-color: rgba(37, 99, 235, 0.2);
    transform: translateY(1px);
  }
  
  /* Subtle visual indicator for tags */
  .tag-link::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: currentColor;
    opacity: 0.3;
    transition: opacity 0.2s ease;
  }
  
  .tag-link:hover::before {
    opacity: 0.6;
  }
</style>
