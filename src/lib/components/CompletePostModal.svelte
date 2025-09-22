<script lang="ts">
    import { createEventDispatcher, getContext } from 'svelte';
    import { goto } from '$app/navigation';
    import PostHeader from './PostHeader.svelte';
    import PostStatsActions from './PostStatsActions.svelte';
    import CommentsSection from '$lib/components/CommentsSection.svelte';
    import PostMediaContent from './PostMediaContent.svelte';
    import TaggedText from '$lib/components/TaggedText.svelte';

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
        console.log(`🔍 CompleteModal ${post.id} ownership debug:`, {
            isSelfFromContext: isSelf,
            authExists: !!auth,
            authUsername: auth?.username,
            authorUsername,
            postUsername: post?.username,
            displayPostUsername: displayPost?.username,
            canDelete: !!isSelf
        });
    }
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
  <div class="modal-backdrop" role="dialog" aria-labelledby="post-modal-title" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal modal-landscape" on:click|stopPropagation>
      
      <!-- LEFT SECTION: 65% width with media and user meta -->
      <div class="modal-left-section">
        <!-- Media fills available space -->
        <div class="modal-media-container">
          <PostMediaContent
            post={post}
            displayPost={displayPost}
            displayContent={''}
            wikipediaPreview={null}
            linkPreview={null}
            showHeadline={false}
          />
        </div>
        
        <!-- User meta is pinned to the bottom -->
        <div class="modal-meta-container">
          {#if displayPost.headline}
            <h2 id="post-modal-title" class="modal-headline">{displayPost.headline}</h2>
          {/if}
          <div class="modal-timestamp-container">
            <span class="modal-timestamp-left">{displayTimestamp(post.createdAt)}</span>
          </div>
        </div>
      </div>

      <!-- RIGHT SECTION: 35% width with content, actions, and comments -->
      <div class="modal-right-section">
        <!-- New wrapper for content and actions -->
        <div class="content-and-actions-wrapper">
          <!-- Scrollable content and previews -->
           <div class="modal-meta-author">
            <PostHeader
              post={post}
              displayAuthorImgSrc={authorImgSrc}
              displayAuthorUsername={authorUsername}
              effectiveIsFeatured={finalEffectiveIsFeatured}
              categoryColors={categoryColors}
              categoryTextColors={categoryTextColors}
              isStarred={isStarred}
              reposter={reposter}
              on:starClick={handleStarClick}
              on:usernameClick={handleUsernameClick}
            />
          </div>
          <div class="modal-content-section">
            {#if displayContent && displayContent.trim() !== ''}
              <div class="modal-content">{displayContent}</div>
            {/if}

            {#if wikipediaPreview}
              <div class="modal-wikipedia-preview">
                <div class="modal-wikipedia-header">
                  <h4>Wikipedia: {wikipediaPreview.title}</h4>
                  <a href={wikipediaPreview.url} target="_blank" class="modal-wikipedia-link">View on Wikipedia</a>
                </div>
                {#if wikipediaPreview.thumbnail}
                  <img src={wikipediaPreview.thumbnail} alt={wikipediaPreview.title} class="modal-wikipedia-thumbnail" />
                {/if}
                <p class="modal-wikipedia-extract">{wikipediaPreview.extract}</p>
              </div>
            {/if}

            {#if linkPreview && !wikipediaPreview}
              <div class="modal-link-preview">
                <div class="modal-link-header">
                  <h4>{linkPreview.title}</h4>
                  <a href={post.link} target="_blank" class="modal-link-url">View Link</a>
                </div>
                {#if linkPreview.image}
                  <img src={linkPreview.image} alt={linkPreview.title} class="modal-link-image" />
                {/if}
                <p class="modal-link-description">{linkPreview.description}</p>
              </div>
            {/if}

            {#if post.link && !linkPreview && !wikipediaPreview}
              <div class="modal-direct-link">
                <a href={post.link} target="_blank" class="modal-link-button">View Link</a>
              </div>
            {/if}
          </div>
        
          <!-- Post actions are now a child of the new wrapper -->
          <div class="modal-post-actions">
            <PostStatsActions
              post={post}
              isStarred={isStarred}
              hasExactLocation={calculatedHasExactLocation}
              commentCount={post.commentsCount ?? 0}
              loadingStats={loadingStats}
              showMoreActions={true}
              canDelete={!!isSelf}
              extraClass="modal-post-actions"

              on:starClick={onStarClick}
              on:featureClick={onFeatureClick}
              on:commentsClick={onCommentsClick}
              on:mapClick={onMapClick}
              on:shareClick={onShareClick}
              on:hideClick={confirmHide}
              on:deleteClick={onDeleteClick}
              on:report={openReportModal}
            />
          </div>
          <!-- Comments section moved inside the right section -->
          {#if showComments}
            <div class="comments-container">
              <CommentsSection
                postId={post.id}
                userEmail={auth?.email}
                token={auth?.token}
                compact={true}
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Other modals (report, hide, etc.) go here -->
  {#if showReportModal}
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
                <label for="report-reason">Reason</label>
                <select id="report-reason" bind:value={reportReason}>
                  {#each reportReasons as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label for="report-details">Details (optional)</label>
                <textarea id="report-details" bind:value={reportDetails} rows="4" placeholder="Please provide additional details..."></textarea>
              </div>
              {#if reportError}
                <div class="report-error">{reportError}</div>
              {/if}
              <div class="report-actions">
                <button type="button" class="cancel-btn" on:click={closeReportModal}>Cancel</button>
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

  {#if showHideConfirm}
    <div class="hide-confirm-backdrop" on:click={cancelHide}>
      <div class="hide-confirm-modal" on:click|stopPropagation>
        <h3>Hide Post</h3>
        <p>Are you sure you want to hide this post? You will never see it again.</p>
        <div class="hide-confirm-actions">
          <button class="cancel-btn" on:click={cancelHide}>Cancel</button>
          <button class="hide-btn" on:click={handleHidePost}>Hide Post</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
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

  <!-- Hide Confirmation Modal -->
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
            <button type="button" class="hide-confirm-btn" on:click={confirmHide}>Hide Post</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
/* Modal Layout */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 0;
  overflow: hidden;
}

.report-modal-backdrop,
.delete-modal-backdrop,
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

.delete-modal-content,
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

.delete-modal-header,
.hide-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.delete-modal-header h3,
.hide-modal-header h3 {
  margin: 0;
  color: #ffffff;
}

.delete-modal-body,
.hide-modal-body {
  text-align: left;
  color: #fff;
}

.delete-confirmation-text,
.hide-confirmation-text {
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

.delete-actions,
.hide-actions {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  margin-top: 1.5rem;
}

.delete-confirm-btn,
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

.delete-confirm-btn:hover,
.hide-confirm-btn:hover {
  background: #b91c1c;
}

.delete-confirm-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}
.modal {
  background: #f7f7f7;
  border-radius: 12px;
  max-width: 95vw;
  max-height: 95vh;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: row;
}
.modal-landscape {
  width: 90vw;
  height: 80vh;
  max-width: 900px;
  max-height: 900px;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  gap: 0; /* Ensure no gap between sections */
}

/* LEFT SECTION */
.modal-left-section {
  flex: 1 1 auto;
  flex-basis: auto;
  flex-shrink: 0;
  width: 750px;
  min-width: 400px; /* Example min-width */
  max-width: 900px; 
  display: flex;
  flex-direction: column;
  background: #000000;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border-top-left-radius: 12px; 
}
.modal-media-container {
  flex: 1 1 auto;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  overflow: hidden;
  padding: 1rem 1rem 1rem 2rem;
  margin: 0;
  border-top-left-radius: 12px; 
}
.modal-media-container img,
.modal-media-container video {
  width: 100%;
  height: auto;
  max-width: 100%;
  object-fit: contain;
  display: block;
  margin: 0;
  padding: 0;
  background: #000;
  border: none;
  border-top-left-radius: 12px; 
}
.modal-meta-container {
  width: 100%;
  background: #000000;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.modal-headline {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  width: 100%;
  text-align: center;
  line-height: 1.3;
  padding-bottom: 0.2rem; /* Reduced padding */
  margin-top: -0.5rem;
  max-width: 600px;
}

.modal-timestamp-container {
  width: 100%;
  text-align: center;
  padding-top: 0.1rem; /* Minimal padding between headline and timestamp */
}

.modal-timestamp-left {
  color: #cccccc;
  font-size: 1.4rem; /* Same size as headline */
  font-weight: 400;
}

/* RIGHT SECTION */
.modal-right-section {
  flex: 0 0 35%;
  display: flex;
  flex-direction: column;
  background: #fdfdfd;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  position: relative;
  margin: 0;
  padding: 0;
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.modal-right-section::-webkit-scrollbar {
  display: none;
}

/* PostHeader styling for modal */
.modal-meta-author {
  border-bottom: 1px solid #e2e8f0;
}

/* Content and actions wrapper */
.content-and-actions-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.modal-scrollable-content {
  flex-grow: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.modal-content-section {
  padding: 1rem 0.8rem;
  flex-shrink: 0;
  margin-bottom: 0;
}
.comments-container {
  padding: 1rem 1.5rem;
  background: #fafafa;
  border-top: 1px solid #e2e8f0;
}
.modal-post-actions {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #fdfdfd;
  z-index: 2;
  padding: 0.5rem 0.5rem;
  box-sizing: border-box;
  border-bottom: 1px solid #ece6e6;
}

/* Prevent horizontal scrollbars everywhere */
.modal,
.modal-landscape,
.modal-left-section,
.modal-right-section,
.modal-media-container,
.modal-scrollable-content {
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-landscape {
    width: 95vw;
    height: 90vh;
    flex-direction: column;
  }
  .modal-left-section,
  .modal-right-section {
    flex: 0 0 50%;
    min-width: 0;
  }
  .modal-right-section {
    border-left: none;
    border-top: 1px solid #e2e8f0;
  }
}
</style>