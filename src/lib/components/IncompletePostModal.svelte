<script lang="ts">
    import { createEventDispatcher, getContext } from 'svelte';
    import { goto } from '$app/navigation';
    import PostHeader from './PostHeader.svelte';
    import PostStatsActions from './PostStatsActions.svelte';
    import CommentsSection from '$lib/components/CommentsSection.svelte';
    import PostMediaContent from './PostMediaContent.svelte';

    // Props
    export let show: boolean = false;
    export let auth: any;

    // Modal context
    // This is the new, cleaned-up way of getting all your context variables at once.
    const {
        post = {},
        displayPost = {},
        isStarred = false,
        canSeeOnMap = false,
        hasExactLocation = false,
        effectiveIsFeatured = false,
        reposter = null,
        wikipediaPreview = null,
        linkPreview = null,
        categoryColors = {},
        categoryTextColors = {},
        isSelf = false
    } = getContext('post-context') as any;

    // Event dispatcher
    const dispatch = createEventDispatcher();
    const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';
    let localStarredComments: Set<string> = new Set();
    let commentStarCounts: Map<string, number> = new Map();
    let showHideConfirm = false;

    // Missing variable declarations
    let showComments = false;
    let comments: any[] = [];
    let newComment = '';
    let replyingToCommentId: string | null = null;
    let replyText = '';
    let showRepliesMap = new Map<string, boolean>();
    let repliesMap = new Map<string, any[]>();

    // These variables are now reactive, so they will update when displayPost changes
    $: authorImgSrc = displayPost?.profileImageUrl || post?.profileImageUrl || DEFAULT_PROFILE_PIC;
    $: authorUsername = displayPost?.username || '';
    
    // Debug ownership in modal
    $: if (post?.id) {
        console.log(`🔍 IncompleteModal ${post.id} ownership debug:`, {
            isSelfFromContext: isSelf,
            authExists: !!auth,
            authUsername: auth?.username,
            authorUsername,
            postUsername: post?.username,
            displayPostUsername: displayPost?.username,
            canDelete: !!isSelf
        });
    }
    let starCount = 0;
    $: reposterImgSrc = reposter?.profileImageUrl || DEFAULT_PROFILE_PIC;
    $: reposterUsername = reposter?.username || '';
    let loadingStats = false;
    // Calculate hasExactLocation directly from post data like PostItem does
    $: calculatedHasExactLocation = post?.hasExactLocation === true;

    // Feature status calculation (same as PostItem)
    $: featuredInLocationUntil = post?.featuredInLocationUntil || 0;
    $: featuredInSearchUntil = post?.featuredInSearchUntil || 0;
    $: isLocationFeatured = featuredInLocationUntil > Date.now();
    $: isSearchFeatured = featuredInSearchUntil > Date.now();
    $: calculatedIsFeatured = isLocationFeatured || isSearchFeatured;
    $: finalEffectiveIsFeatured = effectiveIsFeatured !== undefined ? effectiveIsFeatured : calculatedIsFeatured;

    // Featured countdown function (same as PostHeader)
    function formatFeaturedCountdown(post: any): string {
        const now = Date.now();
        const locationUntil = post?.featuredInLocationUntil || 0;
        const searchUntil = post?.featuredInSearchUntil || 0;
        const until = Math.max(locationUntil, searchUntil);
        
        if (until <= now) return '';
        
        const diff = until - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    // Hide post functionality
    async function handleHidePost() {
        if (!auth?.token) return;
        
        try {
            await import('$lib/api').then(m => m.hidePost(post.id, auth.token));
            dispatch('close');
        } catch (err) {
            console.error('Error hiding post:', err);
        }
    }

    function confirmHide() {
        showHideConfirm = true;
    }

    function cancelHide() {
        showHideConfirm = false;
    }

    // Delete confirmation
    let showDeleteConfirm = false;
    let deleteSending = false;
    let deleteError = '';
    let deleteSuccess = false;

    function onDeleteClick() {
        showDeleteConfirm = true;
    }

    function closeDeleteConfirm() {
        showDeleteConfirm = false;
        deleteSending = false;
        deleteError = '';
        deleteSuccess = false;
    }

    async function confirmDelete() {
        if (!auth?.token) {
            deleteError = 'You must be logged in to delete a post';
            return;
        }
        try {
            deleteSending = true;
            deleteError = '';
            await import('$lib/api').then(m => m.deletePost(post.id, auth.token));
            deleteSuccess = true;
            setTimeout(() => {
                dispatch('close');
                // Refresh or redirect
                window.location.reload();
            }, 2000);
        } catch (error) {
            deleteError = (error as any).message || 'An error occurred while deleting the post';
        } finally {
            deleteSending = false;
        }
    }

    function getCommentAvatar(comment: any): string {
        return (
            comment?.profileImageUrl ||
            comment?.userProfileImageUrl ||
            comment?.avatarUrl ||
            comment?.userImageUrl ||
            DEFAULT_PROFILE_PIC
        );
    }

    function getFirstTimestamp(comment: any): any {
        return comment?.createdAt || comment?.created_at || comment?.timestamp || comment?.date || null;
    }

    function displayTimestamp(ts: any): string {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        } catch {
            return '';
        }
    }

    async function toggleCommentStar(commentId: string) {
        if (!commentId) return;
        try {
            if (localStarredComments.has(commentId)) {
                if (auth?.token) {
                    await import('$lib/api').then(m => m.unstarComment(post.id, commentId, auth.token));
                }
                localStarredComments.delete(commentId);
                const current = commentStarCounts.get(commentId) || 0;
                commentStarCounts.set(commentId, Math.max(0, current - 1));
            } else {
                if (auth?.token) {
                    await import('$lib/api').then(m => m.starComment(post.id, commentId, auth.token));
                }
                localStarredComments.add(commentId);
                const current = commentStarCounts.get(commentId) || 0;
                commentStarCounts.set(commentId, current + 1);
            }
        } catch (err) {
            console.error('Error toggling comment star', err);
        } finally {
            localStarredComments = new Set(localStarredComments);
            commentStarCounts = new Map(commentStarCounts);
        }
    }


    // Event handlers
    function closeModal() {
        dispatch('close');
    }

    function handleStarClick(event: any) {
        dispatch('starClick', event);
    }

    function handleUsernameClick(e: any) {
        dispatch('usernameClick', e);
    }

    function handleLinkClick(event: any) {
        dispatch('linkClick', event?.detail);
    }

    function sharePost(event: any) {
        dispatch('sharePost', event);
    }

    function featurePost(event: any) {
        dispatch('featureClick', event);
    }

    function formatTimestamp(timestamp: any) {
        dispatch('formatTimestamp', timestamp);
    }

    function handleCommentsClick() {
        showComments = !showComments;
        if (showComments) {
            fetchComments();
        }
    }

    function handleMapClick() {
        if (post?.lat != null && post?.lng != null) {
            goto(`/posts?lat=${post.lat}&lng=${post.lng}&zoom=20`);
        }
    }

    // Wrappers for PostStatsActions expected signatures (no-arg callbacks)
    function onStarClick() { dispatch('starClick'); }
    function onFeatureClick() { dispatch('featureClick'); }
    function onCommentsClick() { handleCommentsClick(); }
    function onMapClick() { handleMapClick(); }
    function onShareClick() { dispatch('sharePost'); }

    async function fetchComments() {
        dispatch('fetchComments');
        // After parent fetches and binds comments, load star status for each
        setTimeout(async () => {
            if (!Array.isArray(comments) || !auth?.token) return;
            try {
                const api = await import('$lib/api');
                await Promise.all(
                    comments.map(async (c) => {
                        try {
                            const { isStarred, starCount } = await api.fetchCommentStarStatus(post.id, c.commentId, auth.token);
                            if (isStarred) localStarredComments.add(c.commentId);
                            commentStarCounts.set(c.commentId, typeof starCount === 'number' ? starCount : 0);
                        } catch {}
                    })
                );
                localStarredComments = new Set(localStarredComments);
                commentStarCounts = new Map(commentStarCounts);
            } catch {}
        }, 0);
    }

    async function submitComment() {
        dispatch('submitComment', { newComment });
        newComment = '';
    }

    function startReply(commentId: string) {
        replyingToCommentId = commentId;
        replyText = '';
    }

    function cancelReply() {
        replyingToCommentId = null;
        replyText = '';
    }

    async function submitReply(parentCommentId: string) {
        dispatch('submitReply', { parentCommentId, replyText });
        replyText = '';
        replyingToCommentId = null;
    }

    async function deleteComment(commentId: string) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        dispatch('deleteComment', { commentId });
    }

    function toggleReplies(commentId: string) {
        const currentState = showRepliesMap.get(commentId) || false;
        showRepliesMap.set(commentId, !currentState);
        showRepliesMap = new Map(showRepliesMap);
        
        if (!currentState && !repliesMap.has(commentId)) {
            dispatch('loadReplies', { commentId });
        }
    }

    function getRepliesForComment(commentId: string): any[] {
        return repliesMap.get(commentId) ?? [];
    }

    function getContentWithoutLinks(content: string, link: string) {
        if (!content || !link) return content || '';
        try {
            const linkDomain = new URL(link).hostname.replace('www.', '');
            return content.replace(new RegExp(`https?://[^\\s]*${linkDomain.replace('.', '\\.')}[^\\s]*`, 'gi'), '').trim();
        } catch (error) {
            // If URL parsing fails, return original content
            return content || '';
        }
    }

    // Get clean content without links for display
    $: displayContent = displayPost?.content || '';
    $: hasContent = !!(displayContent && displayContent.trim() !== '');
    $: hasMedia = (displayPost?.mediaUrl && displayPost.mediaUrl.trim() !== '') || (displayPost?.imageUrl && displayPost.imageUrl.trim() !== '');
    $: hasHeadline = displayPost?.headline && displayPost.headline.trim() !== '';

    // Reactive statement to fetch comments when modal opens
    $: if (showComments && (!hasContent || !hasMedia || !hasHeadline)) {
        fetchComments();
    }
    
    // --- Report Modal logic ---
    let showReportModal = false;
    let reportReason = 'spam';
    let reportDetails = '';
    let reportSending = false;
    let reportError = '';
    let reportSuccess = false;

    const reportReasons = [
        { value: 'spam', label: 'Spam' },
        { value: 'inappropriate', label: 'Inappropriate Content' },
        { value: 'scam', label: 'Scam or Fraud' },
        { value: 'other', label: 'Other' }
    ];

    function openReportModal() {
        showReportModal = true;
    }
    function closeReportModal() {
        showReportModal = false;
        reportReason = 'spam';
        reportDetails = '';
        reportSending = false;
        reportError = '';
        reportSuccess = false;
    }
    async function submitReport() {
        if (!auth?.token) {
            reportError = 'You must be logged in to report a post';
            return;
        }
        try {
            reportSending = true;
            reportError = '';
            await import('$lib/api').then(m => m.reportPost(post.id, reportReason, reportDetails, auth.token));
            reportSuccess = true;
            setTimeout(() => {
                closeReportModal();
            }, 2000);
        } catch (error) {
            reportError = (error as any).message || 'An error occurred while submitting your report';
        } finally {
            reportSending = false;
        }
    }
</script>

{#if show}
    <div class="modal-backdrop" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0">
      <div class="alternate-modal" on:click|stopPropagation role="dialog">
        <!-- Centered Post Card Copy -->
        <div class="alternate-post-card">
            <PostHeader
              post={post}
              displayAuthorImgSrc={authorImgSrc}
              displayAuthorUsername={authorUsername}
              effectiveIsFeatured={finalEffectiveIsFeatured}
              categoryColors={categoryColors}
              categoryTextColors={categoryTextColors}
              isStarred={isStarred}

              reposter={post.isRepost ? { imgSrc: reposterImgSrc, username: reposterUsername } : null}
              on:starClick={handleStarClick}
              on:usernameClick={handleUsernameClick}
            />
            
            <PostMediaContent
              post={post}
              displayPost={displayPost}
              displayContent={displayContent}
              wikipediaPreview={wikipediaPreview}
              linkPreview={linkPreview}
              on:linkClick={handleLinkClick}
            />

            <!-- Action buttons -->
            <div class="modal-post-actions">
              <PostStatsActions
                post={post}
                isStarred={isStarred}
                hasExactLocation={calculatedHasExactLocation}
                commentCount={post.commentsCount ?? 0}
                loadingStats={loadingStats}
                showMoreActions={true}
                canDelete={!!isSelf}
                on:featureClick={onFeatureClick}
                on:commentsClick={onCommentsClick}
                on:mapClick={onMapClick}
                on:shareClick={onShareClick}
                on:report={openReportModal}
                on:hideClick={confirmHide}
                on:deleteClick={onDeleteClick}
              />
            </div>
            
            <!-- Comments section -->
            {#if showComments}
                <CommentsSection
                  postId={post.id}
                  userEmail={auth?.email}
                  token={auth?.token}
                  compact={true}
              />
            {/if}
        </div>
      </div>
    </div>
    
    <!-- Modal for reporting a post -->
    {#if showReportModal}
        <!-- Report Modal UI here -->
        <div class="report-modal-backdrop" on:click={closeReportModal} on:keydown={(e) => e.key === 'Escape' && closeReportModal()} role="button" tabindex="0">
            <div class="report-modal-content" on:click|stopPropagation>
                <div class="report-modal-header">
                    <h3>Report Post</h3>
                    <button class="modal-close" on:click={closeReportModal}>&times;</button>
                </div>
                <div class="report-modal-body">
                {#if reportSuccess}
                    <div class="report-success">Report submitted successfully!</div>
                {:else}
                    <form on:submit|preventDefault={submitReport}>
                        <div class="form-group">
                            <label for="reportReason">Reason</label>
                            <select bind:value={reportReason} id="reportReason">
                                {#each reportReasons as reason}
                                    <option value={reason.value}>{reason.label}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="reportDetails">Details (optional)</label>
                            <textarea bind:value={reportDetails} id="reportDetails" rows="4" placeholder="Please provide additional details..."></textarea>
                        </div>
                        {#if reportError}
                            <div class="report-error">{reportError}</div>
                        {/if}
                        <div class="report-actions">
                            <button on:click={closeReportModal} type="button" class="cancel-btn">Cancel</button>
                            <button type="submit" class="submit-btn" disabled={reportSending}>
                                {reportSending ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal for confirming post delete -->
    {#if showDeleteConfirm}
        <div class="delete-modal-backdrop" on:click={closeDeleteConfirm} on:keydown={(e) => e.key === 'Escape' && closeDeleteConfirm()} role="button" tabindex="0">
            <div class="delete-modal-content" on:click|stopPropagation>
                <div class="delete-modal-header">
                    <h3>Delete Post</h3>
                    <button class="modal-close" on:click={closeDeleteConfirm}>&times;</button>
                </div>
                <div class="delete-modal-body">
                    {#if deleteSuccess}
                        <div class="delete-success">Post deleted successfully!</div>
                    {:else}
                        <p class="delete-confirmation-text">Are you sure you want to delete this post? This action cannot be undone.</p>
                        {#if deleteError}
                            <div class="delete-error">{deleteError}</div>
                        {/if}
                        <div class="delete-actions">
                            <button type="button" class="cancel-btn" on:click={closeDeleteConfirm}>Cancel</button>
                            <button type="button" class="delete-confirm-btn" disabled={deleteSending} on:click={confirmDelete}>
                                {deleteSending ? 'Deleting...' : 'Delete Post'}
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal for confirming post hide -->
    {#if showHideConfirm}
        <div class="hide-modal-backdrop" on:click={cancelHide} on:keydown={(e) => e.key === 'Escape' && cancelHide()} role="button" tabindex="0">
            <div class="hide-modal-content" on:click|stopPropagation>
                <div class="hide-modal-header">
                    <h3>Hide Post</h3>
                    <button class="modal-close" on:click={cancelHide}>&times;</button>
                </div>
                <div class="hide-modal-body">
                    <p class="hide-confirmation-text">Are you sure you want to hide this post? It will no longer appear in your feed.</p>
                    <div class="hide-actions">
                        <button type="button" class="cancel-btn" on:click={cancelHide}>Cancel</button>
                        <button type="button" class="hide-confirm-btn" on:click={handleHidePost}>Hide Post</button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  .alternate-modal {
    background: #fff;
    border-radius: 12px;
    max-width: 400px;
    max-height: 90vh;
    width: 100%;
    overflow-y: auto;
    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .alternate-modal::-webkit-scrollbar { width: 0; height: 0; }
  .alternate-post-card {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
  }
  .modal-post-actions {
    width: 100%;
  }
  /* Comments Section */
  .alternate-comments-container {
    background: #fff;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    border-radius: 12px 12px 0 0;
    padding: 1rem;
  }
  .alternate-comments-title {
    color: #1a202c;
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    padding: 0 0 0.75rem;
  }
  .alternate-comments-list {
    max-height: 300px;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin-bottom: 1rem;
  }
  .alternate-comment-item {
    border-top: 1px solid #e2e8f0;
    padding: 1.25rem 0;
  }
  .alternate-comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .comment-header-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .comment-avatar {
    width: 2.1em;
    height: 2.1em;
    border-radius: 20%;
    object-fit: cover;
    background: #f3f4f6;
  }
  .comment-name-time {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .comment-star-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 6px;
  }
  .comment-star-btn:hover { background: #f3f4f6; }
  .comment-star-btn.active { background: #e6efff; }
  .comment-star-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 28px;
  }
  .comment-star-count {
    font-size: 0.72rem;
    color: #2563eb;
    line-height: 1;
  }
  .alternate-comment-author {
    color: #2c5282;
    font-size: 1rem;
    font-weight: 600;
  }
  .alternate-comment-time {
    color: #a0aec0;
    font-size: 0.85rem;
  }
  .alternate-comment-content {
    color: #2d3748;
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }
  .alternate-comment-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .alternate-reply-btn,
  .alternate-delete-btn,
  .alternate-toggle-replies-btn {
    background: none;
    border: none;
    color: #2c5282;
    cursor: pointer;
    font-weight: 500;
    transition: color 0.2s;
  }
  .alternate-reply-btn:hover,
  .alternate-delete-btn:hover,
  .alternate-toggle-replies-btn:hover {
    text-decoration: underline;
  }
  .alternate-delete-btn { color: #c53030; }
  .alternate-reply-form {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: #f7fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .alternate-reply-textarea {
    width: 100%;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    color: #1a202c;
    font-size: 0.95rem;
    resize: vertical;
    margin-bottom: 1rem;
  }
  .alternate-reply-buttons {
    display: flex;
    gap: 0.3rem;
    justify-content: flex-end;
  }
  .alternate-reply-submit,
  .alternate-reply-cancel {
    padding: 0.65rem 1.25rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .alternate-reply-submit {
    background: #2c5282;
    color: white;
  }
  .alternate-reply-submit:hover { background: #1d4ed8; }
  .alternate-reply-submit:disabled { background: #cbd5e1; cursor: not-allowed; }
  .alternate-reply-cancel {
    background: #e2e8f0;
    color: #4a5568;
  }
  .alternate-reply-cancel:hover {
    background: #cbd5e1;
    color: #2d3748;
  }
  .alternate-replies-container {
    margin-top: 1.25rem;
    padding-left: 2rem;
    border-left: 2px solid #e2e8f0;
  }
  .alternate-reply-item {
    padding: 0.75rem 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .alternate-reply-item:last-child { border-bottom: none; }
  .alternate-reply-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .alternate-reply-author {
    color: #2c5282;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .alternate-reply-time {
    color: #a0aec0;
    font-size: 0.8rem;
  }
  .alternate-reply-content {
    color: #2d3748;
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }
  .alternate-reply-delete-btn {
    background: none;
    border: none;
    color: #c53030;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  .alternate-reply-delete-btn:hover { text-decoration: underline; }
  .alternate-comment-form {
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #fff;
  }
  .alternate-comment-textarea {
    width: 100%;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    color: #1a202c;
    font-size: 0.95rem;
    resize: vertical;
    margin-bottom: 1rem;
  }
  .alternate-comment-submit {
    background: #2c5282;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .alternate-comment-submit:hover { background: #1d4ed8; }
  .alternate-comment-submit:disabled { background: #cbd5e1; cursor: not-allowed; }
  .alternate-login-prompt {
    padding: 1.25rem;
    text-align: center;
    border-top: 1px solid #333;
  }
  .alternate-login-prompt a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
  }
  .alternate-login-prompt a:hover { text-decoration: underline; }
  .alternate-loading,
  .alternate-no-comments,
  .alternate-loading-replies {
    color: #64748b;
    font-style: italic;
    text-align: center;
    padding: 2rem 1rem;
  }
  .alternate-comment-star-count {
    font-size: 0.8rem;
    color: #2563eb;
    margin-top: 0.2rem;
  }
  /* Report Modal Styles */
  .report-modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }

  .report-modal-content {
    background: #1a1a1a;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    color: #fff;
  }

  .report-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .report-modal-header h3 {
    margin: 0;
    color: #ffffff;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #fff;
  }

  .report-modal-body {
    text-align: left;
    color: #fff;
  }

  .form-group {
    margin-bottom: 1.2rem;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.4rem;
    color: #cccccc;
  }

  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.8rem;
    border-radius: 8px;
    border: 1px solid #404040;
    background: #2a2a2a;
    color: #ffffff;
    font-size: 1rem;
    margin-top: 0.2rem;
  }

  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .report-success {
    color: #16a34a;
    font-weight: 600;
    text-align: center;
    margin: 2rem 0;
  }

  .report-error {
    color: #dc2626;
    margin-bottom: 1rem;
    text-align: center;
  }

  .report-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .cancel-btn,
  .submit-btn {
    flex: 1;
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #cccccc;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .submit-btn {
    background: #dc2626;
    color: white;
  }

  .submit-btn:hover {
    background: #b91c1c;
  }

  .submit-btn:disabled {
    background: #a5b4fc;
    cursor: not-allowed;
  }

  /* Delete Modal Styles */
  .delete-modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }

  .delete-modal-content {
    background: #1a1a1a;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    color: #fff;
  }

  .delete-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .delete-modal-header h3 {
    margin: 0;
    color: #ffffff;
  }

  .delete-modal-body {
    text-align: left;
    color: #fff;
  }

  .delete-confirmation-text {
    color: #cccccc;
    margin-bottom: 1.5rem;
    line-height: 1.6;
    text-align: center;
  }

  .delete-success {
    color: #16a34a;
    font-weight: 600;
    margin: 2rem 0;
    text-align: center;
  }

  .delete-error {
    color: #dc2626;
    margin-bottom: 1rem;
    text-align: center;
  }

  .delete-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .delete-confirm-btn {
    flex: 1;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .delete-confirm-btn:hover {
    background: #b91c1c;
  }

  .delete-confirm-btn:disabled {
    background: #a5b4fc;
    cursor: not-allowed;
  }

  /* Hide Modal Styles */
  .hide-modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }

  .hide-modal-content {
    background: #1a1a1a;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    color: #fff;
  }

  .hide-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .hide-modal-header h3 {
    margin: 0;
    color: #ffffff;
  }

  .hide-modal-body {
    text-align: left;
    color: #fff;
  }

  .hide-confirmation-text {
    color: #cccccc;
    margin-bottom: 1.5rem;
    line-height: 1.6;
    text-align: center;
  }

  .hide-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .hide-confirm-btn {
    flex: 1;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .hide-confirm-btn:hover {
    background: #b91c1c;
  }

  @media (max-width: 768px) {
    .alternate-modal { max-width: 95vw; margin: 10px; }
    .alternate-comments-list { padding: 0 1rem; }
    .alternate-comments-title { padding: 1rem 1rem 0.5rem; }
  }
</style>