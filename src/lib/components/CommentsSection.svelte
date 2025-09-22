<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { Comment } from '$lib/api';
  import { 
    fetchComments,
    fetchReplies,
    createComment,
    deleteComment,
    starComment,
    unstarComment,
    fetchCommentStarStatus
  } from '$lib/api';
  import TagAutocomplete from '$lib/components/TagAutocomplete.svelte';
  import TaggedText from '$lib/components/TaggedText.svelte';

  export let postId: string;
  export let userEmail: string | null = null;
  export let token: string | null = null;
  // Optional: compact layout flag for light theme contexts
  export let compact: boolean = false;

  const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';

  let comments: Comment[] = [];
  let loadingComments = false;
  let error: string | null = null;

  let newComment = '';
  let submitting = false;

  // Replies state
  let replyingToCommentId: string | null = null;
  let replyText = '';
  let showRepliesMap: Map<string, boolean> = new Map();
  let repliesMap: Map<string, Comment[]> = new Map();
  let loadingRepliesMap: Map<string, boolean> = new Map();

  // Stars state per comment
  let localStarredComments: Set<string> = new Set();
  let commentStarCounts: Map<string, number> = new Map();

  // More menu state per comment
  let showMoreMenuMap: Map<string, boolean> = new Map();
  
  // More menu state per reply
  let showMoreMenuMapReplies: Map<string, boolean> = new Map();

  // Tag system state
  let showTagAutocomplete = false;
  let tagQuery = '';
  let tagPosition = { x: 0, y: 0 };
  let currentTagStart = -1;
  let activeTextarea: 'comment' | 'reply' | null = null;
  const TAG_REGEX = /@([a-zA-Z0-9_]+)/g;
  const MAX_TAGS = 8;

  onMount(() => {
    loadComments();
    
    // Close more menus when clicking outside
    function handleClickOutside(event: Event) {
      if (!event.target) return;
      const target = event.target as Element;
      // Close menu if clicking outside the more-actions container
      if (!target.closest('.more-actions')) {
        const hasOpenMenus = Array.from(showMoreMenuMap.values()).some(Boolean);
        const hasOpenReplyMenus = Array.from(showMoreMenuMapReplies.values()).some(Boolean);
        if (hasOpenMenus) {
          showMoreMenuMap.clear();
          showMoreMenuMap = new Map(showMoreMenuMap);
        }
        if (hasOpenReplyMenus) {
          showMoreMenuMapReplies.clear();
          showMoreMenuMapReplies = new Map(showMoreMenuMapReplies);
        }
      }
    }
    
    document.addEventListener('click', handleClickOutside, true); // Use capture phase
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  function getCommentAvatar(c: any): string {
    // Debug logging to see what fields are available
    console.log('💬 Comment avatar debug:', {
      commentId: c?.commentId,
      userUID: c?.userUID,
      userEmail: c?.userEmail,
      username: c?.username,
      profileImageUrl: c?.profileImageUrl,
      userProfileImageUrl: c?.userProfileImageUrl,
      avatarUrl: c?.avatarUrl,
      userImageUrl: c?.userImageUrl,
      imageUrl: c?.imageUrl,
      allFields: Object.keys(c || {}),
      needsProfileImageFix: 'BACKEND COMMENT MODEL MISSING profileImageUrl FIELD'
    });
    
    // Match PostHeader pattern: displayAuthorImgSrc || post.profileImageUrl || DEFAULT_PROFILE_PIC
    return (
      c?.profileImageUrl ||
      c?.userProfileImageUrl ||
      c?.avatarUrl ||
      c?.userImageUrl ||
      c?.imageUrl ||
      DEFAULT_PROFILE_PIC
    );
  }

  function getCommentUsername(c: any): string {
    return c?.username || c?.userEmail || 'Unknown';
  }

  function handleAvatarError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.src = DEFAULT_PROFILE_PIC;
  }

  function handleUsernameClick(username: string, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (username && username !== 'Unknown') {
      goto(`/profile/${encodeURIComponent(username)}`);
    }
  }

  function displayTimestamp(ts: any): string {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch { return ''; }
  }

  async function loadComments() {
    if (!postId) return;
    loadingComments = true;
    error = null;
    try {
      comments = await fetchComments(postId);
      if (token) {
        // Load star status/counts for visible comments
        await Promise.all(
          comments.map(async (c) => {
            try {
              const { isStarred, starCount } = await fetchCommentStarStatus(postId, c.commentId, token as string);
              if (isStarred) localStarredComments.add(c.commentId);
              // Handle starCount: 0 as valid (not falsy)
              commentStarCounts.set(c.commentId, typeof starCount === 'number' ? starCount : 0);
            } catch {}
          })
        );
        localStarredComments = new Set(localStarredComments);
        commentStarCounts = new Map(commentStarCounts);
      }
    } catch (e: any) {
      error = e?.message || 'Failed to load comments.';
    } finally {
      loadingComments = false;
    }
  }

  async function toggleCommentStar(commentId: string) {
    if (!commentId || !token) return;
    
    const wasStarred = localStarredComments.has(commentId);
    const currentCount = commentStarCounts.get(commentId) || 0;
    
    console.log(`⭐ Comment star toggle for ${commentId}:`, {
      wasStarred,
      currentCount,
      action: wasStarred ? 'UNSTAR' : 'STAR',
      persistenceIssue: 'Check if backend comment star API saves to database properly'
    });
    
    try {
      if (wasStarred) {
        const result = await unstarComment(postId, commentId, token);
        console.log('⭐ Unstar result:', result);
        localStarredComments.delete(commentId);
        commentStarCounts.set(commentId, Math.max(0, currentCount - 1));
      } else {
        const result = await starComment(postId, commentId, token);
        console.log('⭐ Star result:', result);
        localStarredComments.add(commentId);
        commentStarCounts.set(commentId, currentCount + 1);
        
        // 🔧 HOTFIX: Refresh actual count from backend after DynamoDB consistency
        setTimeout(async () => {
          try {
            const response = await fetchCommentStarStatus(postId, commentId, token);
            console.log(`🔄 Raw API response for ${commentId}:`, response);
            const { starCount } = response;
            // Handle starCount: 0 as valid (not falsy)
            const validCount = typeof starCount === 'number' ? starCount : 0;
            commentStarCounts.set(commentId, validCount);
            commentStarCounts = new Map(commentStarCounts); // Trigger reactivity
            console.log(`🔄 Refreshed star count for ${commentId}: ${starCount} -> validCount: ${validCount}`);
          } catch (error) {
            console.error('Error refreshing star count:', error);
          }
        }, 1500);
      }
    } catch (e) {
      // swallow, UI remains consistent on next refresh
    } finally {
      localStarredComments = new Set(localStarredComments);
      commentStarCounts = new Map(commentStarCounts);
    }
  }

  function startReply(commentId: string) {
    replyingToCommentId = commentId;
    replyText = '';
  }

  function cancelReply() {
    replyingToCommentId = null;
    replyText = '';
  }

  async function submitNewComment() {
    if (!newComment.trim() || !token) return;
    submitting = true;
    try {
      await createComment({ postId, content: newComment }, token);
      newComment = '';
      await loadComments();
    } catch (e) {} finally { submitting = false; }
  }

  async function submitReply() {
    if (!replyText.trim() || !token || !replyingToCommentId) return;
    submitting = true;
    try {
      await createComment({ postId, content: replyText, parentCommentId: replyingToCommentId }, token);
      replyText = '';
      replyingToCommentId = null;
      await loadComments();
    } catch (e) {} finally { submitting = false; }
  }

  async function handleDelete(commentId: string) {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteComment(postId, commentId, token);
      await loadComments();
    } catch (e) {}
  }

  function toggleReplies(commentId: string) {
    const current = showRepliesMap.get(commentId) || false;
    showRepliesMap.set(commentId, !current);
    showRepliesMap = new Map(showRepliesMap);
    if (!current && !repliesMap.has(commentId)) {
      loadRepliesFor(commentId);
    }
  }

  async function loadRepliesFor(parentCommentId: string) {
    loadingRepliesMap.set(parentCommentId, true);
    loadingRepliesMap = new Map(loadingRepliesMap);
    try {
      const replies = await fetchReplies(postId, parentCommentId);
      repliesMap.set(parentCommentId, replies);
      repliesMap = new Map(repliesMap);
    } catch (e) {} finally {
      loadingRepliesMap.set(parentCommentId, false);
      loadingRepliesMap = new Map(loadingRepliesMap);
    }
  }

  function toggleMoreMenu(commentId: string, e: MouseEvent) {
    e.stopPropagation();
    const current = showMoreMenuMap.get(commentId) || false;
    // Close all other menus
    showMoreMenuMap.clear();
    // Toggle this menu
    showMoreMenuMap.set(commentId, !current);
    showMoreMenuMap = new Map(showMoreMenuMap);
  }

  function handleCommentReport(commentId: string, e: Event) {
    e?.stopPropagation?.();
    showMoreMenuMap.set(commentId, false);
    showMoreMenuMap = new Map(showMoreMenuMap);
    // TODO: Implement comment reporting
    console.log('Report comment:', commentId);
  }

  function handleCommentHide(commentId: string, e: Event) {
    e?.stopPropagation?.();
    showMoreMenuMap.set(commentId, false);
    showMoreMenuMap = new Map(showMoreMenuMap);
    // TODO: Implement comment hiding
    console.log('Hide comment:', commentId);
  }

  function toggleMoreMenuReply(commentId: string, e: MouseEvent) {
    e.stopPropagation();
    const current = showMoreMenuMapReplies.get(commentId) || false;
    // Close all other menus
    showMoreMenuMapReplies.clear();
    showMoreMenuMap.clear();
    // Toggle this menu
    showMoreMenuMapReplies.set(commentId, !current);
    showMoreMenuMapReplies = new Map(showMoreMenuMapReplies);
  }

  function handleReplyReport(commentId: string, e: Event) {
    e?.stopPropagation?.();
    showMoreMenuMapReplies.set(commentId, false);
    showMoreMenuMapReplies = new Map(showMoreMenuMapReplies);
    // TODO: Implement reply reporting
    console.log('Report reply:', commentId);
  }

  function handleReplyHide(commentId: string, e: Event) {
    e?.stopPropagation?.();
    showMoreMenuMapReplies.set(commentId, false);
    showMoreMenuMapReplies = new Map(showMoreMenuMapReplies);
    // TODO: Implement reply hiding
    console.log('Hide reply:', commentId);
  }

  // Tag detection functions (similar to CreatePostOverlay)
  function findCurrentTag(text: string, cursorPos: number): { query: string; start: number } | null {
    let start = cursorPos - 1;
    while (start >= 0 && text[start] !== '@' && text[start] !== ' ' && text[start] !== '\n') {
      start--;
    }
    
    if (start >= 0 && text[start] === '@') {
      const query = text.substring(start + 1, cursorPos);
      if (query.length >= 1) {
        return { query, start };
      }
    }
    
    return null;
  }

  function getCaretPosition(element: HTMLTextAreaElement): number {
    return element.selectionStart || 0;
  }

  function calculateTagPosition(element: HTMLTextAreaElement, tagStart: number): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + 10,
      y: rect.bottom + 5
    };
  }

  function handleCommentInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const text = target.value;
    const cursorPos = getCaretPosition(target);
    
    newComment = text; // Update the bound value
    
    const currentTag = findCurrentTag(text, cursorPos);
    
    if (currentTag) {
      tagQuery = currentTag.query;
      currentTagStart = currentTag.start;
      tagPosition = calculateTagPosition(target, currentTag.start);
      activeTextarea = 'comment';
      showTagAutocomplete = true;
    } else {
      showTagAutocomplete = false;
      tagQuery = '';
      currentTagStart = -1;
      activeTextarea = null;
    }
  }

  function handleReplyInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const text = target.value;
    const cursorPos = getCaretPosition(target);
    
    replyText = text; // Update the bound value
    
    const currentTag = findCurrentTag(text, cursorPos);
    
    if (currentTag) {
      tagQuery = currentTag.query;
      currentTagStart = currentTag.start;
      tagPosition = calculateTagPosition(target, currentTag.start);
      activeTextarea = 'reply';
      showTagAutocomplete = true;
    } else {
      showTagAutocomplete = false;
      tagQuery = '';
      currentTagStart = -1;
      activeTextarea = null;
    }
  }

  function handleTagSelect(event: CustomEvent) {
    const { user } = event.detail;
    
    if (activeTextarea === 'comment') {
      const textarea = document.querySelector('.comment-textarea') as HTMLTextAreaElement;
      if (textarea && currentTagStart >= 0) {
        const beforeTag = newComment.substring(0, currentTagStart);
        const cursorPos = getCaretPosition(textarea);
        const afterCursor = newComment.substring(cursorPos);
        newComment = beforeTag + `@${user.username} ` + afterCursor;
        
        setTimeout(() => {
          const newCursorPos = currentTagStart + user.username.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }
    } else if (activeTextarea === 'reply') {
      const textarea = document.querySelector('.reply-textarea') as HTMLTextAreaElement;
      if (textarea && currentTagStart >= 0) {
        const beforeTag = replyText.substring(0, currentTagStart);
        const cursorPos = getCaretPosition(textarea);
        const afterCursor = replyText.substring(cursorPos);
        replyText = beforeTag + `@${user.username} ` + afterCursor;
        
        setTimeout(() => {
          const newCursorPos = currentTagStart + user.username.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }
    }
    
    showTagAutocomplete = false;
    tagQuery = '';
    currentTagStart = -1;
    activeTextarea = null;
  }

  function handleTagClose() {
    showTagAutocomplete = false;
    tagQuery = '';
    currentTagStart = -1;
    activeTextarea = null;
  }
</script>

<div class="comments-root" class:compact>
  <div class="comments-header-row">
    <h3 class="comments-title">Comments ({comments.length})</h3>
  </div>

  {#if loadingComments}
    <div class="comments-loading">Loading comments…</div>
  {:else if error}
    <div class="comments-error">{error}</div>
  {:else if comments.length === 0}
    <div class="comments-empty">No comments yet. Be the first to comment!</div>
  {:else}
    <ul class="comments-list">
      {#each comments as c (c.commentId)}
        <li class="comment-item">
          <!-- Three-dot menu positioned outside top-left -->
          <div class="more-actions-outside">
            <button class="more-btn" on:click={(e) => toggleMoreMenu(c.commentId, e)} title="More actions">
              <svg width="16" height="16" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.6"/>
                <circle cx="12" cy="12" r="1.6"/>
                <circle cx="12" cy="19" r="1.6"/>
              </svg>
            </button>
            {#if showMoreMenuMap.get(c.commentId)}
              <div class="more-menu">
                <button class="menu-item" on:click={(e) => handleCommentReport(c.commentId, e)}>Report</button>
                <button class="menu-item" on:click={(e) => handleCommentHide(c.commentId, e)}>Hide</button>
                {#if userEmail && (c.userEmail === userEmail)}
                  <button class="menu-item danger" on:click={() => handleDelete(c.commentId)}>Delete</button>
                {/if}
              </div>
            {/if}
          </div>

          <div class="comment-main">
            <div class="comment-header">
              <div class="header-left">
                <img 
                  class="avatar" 
                  src={getCommentAvatar(c)} 
                  alt="User" 
                  on:error={handleAvatarError} 
                  on:click={(e) => handleUsernameClick(getCommentUsername(c), e)}
                  tabindex="0"
                  role="button"
                  aria-label="View profile"
                />
                <span 
                  class="username"
                  on:click={(e) => handleUsernameClick(getCommentUsername(c), e)}
                  tabindex="0"
                  role="button"
                  aria-label="View profile"
                >{getCommentUsername(c)}</span>
              </div>
              <div class="up-wrap">
                <span class="up-count">{commentStarCounts.get(c.commentId) || 0}</span>
                <button class="up-btn" class:active={localStarredComments.has(c.commentId)} on:click={() => toggleCommentStar(c.commentId)} title="Up this comment">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={localStarredComments.has(c.commentId) ? '#22c55e' : 'none'} stroke={localStarredComments.has(c.commentId) ? '#22c55e' : '#6b7280'} stroke-width="2">
                    <path d="M7 14l5-5 5 5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="bubble">
              <div class="bubble-content">
                <TaggedText 
                  text={c.content} 
                  taggedUsersDetailed={c.taggedUsersDetailed || []}
                  className="comment-tags"
                />
              </div>
            </div>

            <div class="meta-row">
              <div class="meta-left">
                {#if (userEmail && (c.parentCommentId === null || c.parentCommentId === undefined))}
                  <button class="reply-btn" on:click={() => startReply(c.commentId)}>Reply</button>
                {/if}
                {#if c.repliesCount > 0}
                  <button class="toggle-replies" on:click={() => toggleReplies(c.commentId)}>{showRepliesMap.get(c.commentId) ? 'Hide' : 'Show'} {c.repliesCount} replies</button>
                {/if}
                <span class="timestamp">{displayTimestamp(c.createdAt)}</span>
              </div>
            </div>
          </div>

          {#if replyingToCommentId === c.commentId}
            <div class="reply-form">
              <textarea rows="2" bind:value={replyText} placeholder="Write a reply…" class="reply-textarea" on:input={handleReplyInput}></textarea>
              <div class="reply-actions">
                <button class="reply-submit" on:click={submitReply} disabled={!replyText.trim() || submitting}>{submitting ? 'Posting…' : 'Reply'}</button>
                <button class="reply-cancel" on:click={cancelReply}>Cancel</button>
              </div>
            </div>
          {/if}

          {#if showRepliesMap.get(c.commentId)}
            <div class="replies">
              {#if loadingRepliesMap.get(c.commentId)}
                <div class="replies-loading">Loading replies…</div>
              {:else if repliesMap.has(c.commentId)}
                <ul class="replies-list">
                  {#each (repliesMap.get(c.commentId) || []) as r (r.commentId)}
                    <li class="reply-item">
                      <!-- Three-dot menu positioned outside top-left -->
                      <div class="more-actions-outside">
                        <button class="more-btn" on:click={(e) => toggleMoreMenuReply(r.commentId, e)} title="More actions">
                          <svg width="16" height="16" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.6"/>
                            <circle cx="12" cy="12" r="1.6"/>
                            <circle cx="12" cy="19" r="1.6"/>
                          </svg>
                        </button>
                        {#if showMoreMenuMapReplies.get(r.commentId)}
                          <div class="more-menu">
                            <button class="menu-item" on:click={(e) => handleReplyReport(r.commentId, e)}>Report</button>
                            <button class="menu-item" on:click={(e) => handleReplyHide(r.commentId, e)}>Hide</button>
                            {#if userEmail && (r.userEmail === userEmail)}
                              <button class="menu-item danger" on:click={() => handleDelete(r.commentId)}>Delete</button>
                            {/if}
                          </div>
                        {/if}
                      </div>

                      <div class="reply-main">
                        <div class="reply-header">
                          <div class="header-left">
                            <img 
                              class="avatar" 
                              src={getCommentAvatar(r)} 
                              alt="User" 
                              on:error={handleAvatarError} 
                              on:click={(e) => handleUsernameClick(getCommentUsername(r), e)}
                              tabindex="0"
                              role="button"
                              aria-label="View profile"
                            />
                            <span 
                              class="username"
                              on:click={(e) => handleUsernameClick(getCommentUsername(r), e)}
                              tabindex="0"
                              role="button"
                              aria-label="View profile"
                            >{getCommentUsername(r)}</span>
                          </div>
                          <div class="up-wrap">
                            <span class="up-count">{commentStarCounts.get(r.commentId) || 0}</span>
                            <button class="up-btn" class:active={localStarredComments.has(r.commentId)} on:click={() => toggleCommentStar(r.commentId)} title="Up this reply">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={localStarredComments.has(r.commentId) ? '#22c55e' : 'none'} stroke={localStarredComments.has(r.commentId) ? '#22c55e' : '#6b7280'} stroke-width="2">
                                <path d="M7 14l5-5 5 5"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div class="bubble">
                          <div class="bubble-content">
                            <TaggedText 
                              text={r.content} 
                              taggedUsersDetailed={r.taggedUsersDetailed || []}
                              className="reply-tags"
                            />
                          </div>
                        </div>

                        <div class="meta-row">
                          <div class="meta-left">
                            {#if userEmail}
                              <button class="reply-btn" on:click={() => startReply(c.commentId)}>Reply</button>
                            {/if}
                            <span class="timestamp">{displayTimestamp(r.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="new-comment">
    {#if userEmail}
      <textarea rows="3" bind:value={newComment} placeholder="Write a comment…" disabled={submitting} class="comment-textarea" on:input={handleCommentInput}></textarea>
      <button class="post-btn" on:click={submitNewComment} disabled={!newComment.trim() || submitting}>{submitting ? 'Posting…' : 'Post'}</button>
    {:else}
      <div class="login-hint">Login to comment</div>
    {/if}
  </div>
</div>

<!-- Tag Autocomplete -->
<TagAutocomplete
  bind:visible={showTagAutocomplete}
  bind:query={tagQuery}
  bind:position={tagPosition}
  on:select={handleTagSelect}
  on:close={handleTagClose}
/>

<style>
  .comments-root { display: flex; flex-direction: column; gap: 0.75rem; }
  .comments-title { margin: 0; font-size: 1rem; font-weight: 600; }
  .comments-loading, .comments-error, .comments-empty { color: #64748b; font-style: italic; padding: 0.5rem 0; }
  .comments-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9rem; }

  .comment-item { 
    border-top: 1px solid #e2e8f0; 
    padding-top: 0.9rem; 
    position: relative; 
    padding-left: 2rem; /* Space for outside three-dot menu */
  }
  
  .comment-main, .reply-main {
    padding-left: 0;
  }
  
  .more-actions-outside {
    position: absolute;
    left: 0;
    top: 0.9rem;
  }
  
  .comment-header, .reply-header { 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    gap: 0.75rem; 
  }
  
  .header-left { 
    display: flex; 
    align-items: center; 
    gap: 0.6rem; 
  }
  
  .avatar { 
    width: 2.1em; 
    height: 2.1em; 
    border-radius: 20%; 
    border: 1px #000000; 
    object-fit: cover; 
    background: #f3f4f6; 
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .avatar:hover {
    opacity: 0.8;
  }
  
  .username { 
    font-weight: 600; 
    color: #2c5282; 
    cursor: pointer;
    transition: color 0.2s;
  }
  
  .username:hover {
    color: #1e40af;
    text-decoration: underline;
  }
  
  .up-wrap { 
    display: flex; 
    align-items: center; 
    gap: 0.5rem; 
    min-width: 60px; 
  }
  
  .up-count { 
    font-size: 0.875rem; 
    color: #22c55e; 
    font-weight: 600;
    line-height: 1; 
  }
  
  .up-btn { 
    background: transparent; 
    border: none; 
    cursor: pointer; 
    padding: 0.1rem; 
    border-radius: 50%; 
    transition: background 0.2s, transform 0.1s;
  }
  
  .up-btn:hover { 
    background: #f0fdf4; 
    transform: scale(1.05);
  }
  
  .up-btn.active { 
    background: #dcfce7; 
  }

  .bubble { 
    background: #f7fafc; 
    color: #2d3748; 
    border: 1px solid #e2e8f0; 
    border-radius: 10px; 
    padding: 0.75rem; 
    margin-top: 0.4rem; 
  }
  
  .bubble-content {
    line-height: 1.4; /* Just add some basic styling instead of empty rule */
  }
  
  .more-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 4px;
    opacity: 0.7;
    transition: opacity 0.2s, background 0.2s;
  }
  
  .more-btn:hover {
    opacity: 1;
    background: #e2e8f0;
  }
  
  .more-menu {
    display: block;
    position: absolute;
    left: 0; /* Position from the three-dot button */
    top: 2rem; /* Below the three-dot button */
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
  
  .meta-row { 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    margin-top: 0.35rem; 
    font-size: 0.85rem; 
  }
  
  .meta-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }


  
  .timestamp { 
    color: #94a3b8; 
  }
  
  .reply-btn, .toggle-replies { 
    background: none; 
    border: none; 
    color: #2c5282; 
    cursor: pointer; 
    padding: 0; 
    font-weight: 500; 
  }

  .reply-form { margin-top: 0.6rem; padding: 0.75rem; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
  .reply-form textarea { width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem; margin-bottom: 0.6rem; }
  .reply-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .reply-submit, .reply-cancel { padding: 0.45rem 1rem; border: none; border-radius: 8px; cursor: pointer; }
  .reply-submit { background: #2c5282; color: white; }
  .reply-cancel { background: #e2e8f0; color: #4a5568; }

  .replies { margin-top: 0.5rem; padding-left: 1.25rem; border-left: 2px solid #e2e8f0; }
  .replies-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.9rem; }
  .reply-item { 
    border-top: 1px solid #e5e7eb; 
    padding-top: 0.9rem; 
    position: relative; 
    padding-left: 2rem; /* Space for outside three-dot menu */
  }


  .new-comment { padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .new-comment textarea { width: 100%; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem; }
  .post-btn { align-self: flex-end; background: #2c5282; color: white; border: none; border-radius: 8px; padding: 0.6rem 1rem; cursor: pointer; }
  .login-hint { color: #64748b; font-style: italic; }

  /* Compact overrides (minimal layout, colors handled by parent modal) */
  .compact .bubble { background: #ffffff; }
</style>



