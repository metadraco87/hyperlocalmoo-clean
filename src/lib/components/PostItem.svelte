<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.js';
  import { onMount, setContext } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  import * as api from '$lib/api';
  import PostHeader from './PostHeader.svelte';
  import PostStatsActions from './PostStatsActions.svelte';
  import FeaturePostModal from '$lib/components/FeaturePostModal.svelte';
  import CompletePostModal from '$lib/components/CompletePostModal.svelte';
  import IncompletePostModal from '$lib/components/IncompletePostModal.svelte';
  import ShareModal from '$lib/components/ShareModal.svelte';
  import PostMediaContent from '$lib/components/PostMediaContent.svelte';
  import ReportModal from './ReportModal.svelte';
  import DeleteConfirmModal from './DeleteConfirmModal.svelte';
  import TaggedText from '$lib/components/TaggedText.svelte';

  // Props
  export let post: any;
  export let isHighlighted = false;
  export let isStarred = false;
  export let isFeatured: boolean | undefined = undefined;
  export let wikipediaPreview: any = undefined;

  const dispatch = createEventDispatcher();
  const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';

  // Category color mappings (matching map implementation)
  const categoryColors: { [key: string]: string } = {
    'ALERTS': '#eef119',
    'NEWS': '#1a1919', 
    'EVENTS': '#b80a0a',
    'JOBS': '#18038b',
    'TASKS': '#350249',
    'BUSINESSES': '#046909',
    'POINTS OF INTEREST': '#e44303',
    'COMMUNITY': '#ffffff' // Changed to white for post headers
  };
  
  const categoryTextColors: { [key: string]: string } = {
    'ALERTS': '#000000',
    'NEWS': '#ffffff',
    'EVENTS': '#ffffff', 
    'JOBS': '#ffffff',
    'TASKS': '#ffffff',
    'BUSINESSES': '#ffffff',
    'POINTS OF INTEREST': '#ffffff',
    'COMMUNITY': '#000000'
  };

  // Modal state for complete/incomplete
  let modalIsComplete = false;
  let modalOpenedAt = 0;

  // Modal states - all properly defined
  let showModal = false;
  let showFeatureModal = false;
  let showDeleteConfirm = false;
  let showUndoRepostModal = false;
  let showReportModal = false;
  let showComments = false;
  let showDropdown = false;
  let isPostFrozen = false;
  let showHideConfirm = false;

  // Provide fallback for loadingStats, authorImgSrc, authorUsername if not passed
  let loadingStats = false;

  // Link preview
  let linkPreview: any = null;
  let loadingLinkPreview = false;
  let linkPreviewError = false;

  // Determine display post for reposts
  $: displayPost = post.isRepost && post.originalPost ? post.originalPost : post;

  // Reposter and display author logic
  $: reposter = post.isRepost ? {
    ...post,
    imgSrc: post.profileImageUrl || DEFAULT_PROFILE_PIC,
    username: post.username,
    canUndo: $auth && $auth.username && $auth.username === post.username
  } : null;
  $: reposterUsername = reposter ? reposter.username : null;
  $: reposterImgSrc = reposter ? reposter.imgSrc : null;
  $: displayAuthorUsername = displayPost.username || '';
  $: displayAuthorImgSrc = displayPost.profileImageUrl || DEFAULT_PROFILE_PIC;

  // Is the current user the post author? (using userUID for reliability)
  $: isSelf = $auth && $auth.userUID && $auth.userUID === (displayPost?.userUID || post?.userUID);
  
  // Debug ownership calculation
  $: if (post?.id) {
    console.log(`👤 Post ${post.id} ownership debug:`, {
      authExists: !!$auth,
      authUserUID: $auth?.userUID,
      authUsername: $auth?.username,
      authEmail: $auth?.email,
      postUserUID: post?.userUID,
      displayPostUserUID: displayPost?.userUID,
      postUsername: post?.username,
      displayAuthorUsername,
      isSelf,
      userUIDMatch: $auth?.userUID === (displayPost?.userUID || post?.userUID)
    });
  }

  // Content and completeness checks
  $: displayContent = post.link ? getContentWithoutLinks(displayPost.content || '', post.link) : displayPost.content || '';
  $: hasContent = !!displayContent.trim();
  $: hasMedia = (displayPost.mediaUrl && displayPost.mediaUrl.trim() !== '') || (displayPost.imageUrl && displayPost.imageUrl.trim() !== '');
  $: hasHeadline = displayPost.headline && displayPost.headline.trim() !== '';
  $: isCompletePost = hasContent && hasMedia && hasHeadline;

  // Location logic - show "See on Map" ONLY for posts with hasExactLocation=true
  // This means the post was created with exact coordinates, not just location bounds
  $: hasExactLocation = post.hasExactLocation === true;
  
  // Debug logging for hasExactLocation
  $: if (post.id) {
    console.log(`🗺️ PostItem ${post.id}: hasExactLocation=${post.hasExactLocation}, showSeeOnMap=${hasExactLocation}`);
  }

  // Feature status calculation
  $: featuredInLocationUntil = post.featuredInLocationUntil || 0;
  $: featuredInSearchUntil = post.featuredInSearchUntil || 0;
  $: isLocationFeatured = featuredInLocationUntil > Date.now();
  $: isSearchFeatured = featuredInSearchUntil > Date.now();
  $: calculatedIsFeatured = isLocationFeatured || isSearchFeatured;
  $: effectiveIsFeatured = isFeatured !== undefined ? isFeatured : calculatedIsFeatured;
  
  // Debug featured status
  $: if (post.id) {
    console.log(`🏆 PostItem ${post.id} Featured Debug:`, {
      featuredInLocationUntil,
      featuredInSearchUntil,
      now: Date.now(),
      isLocationFeatured,
      isSearchFeatured,
      calculatedIsFeatured,
      isFeaturedProp: isFeatured,
      effectiveIsFeatured,
      post_isFeatured: post.isFeatured,
      post_featuredUntil: post.featuredUntil,
      post_featuredBy: post.featuredBy
    });
  }

  // Debug repost data
  $: if (post.isRepost) {
    console.log(`🔄 Repost Debug for ${post.id}:`, {
      isRepost: post.isRepost,
      reposterUsername: post.username,
      reposterImg: post.profileImageUrl,
      originalPostExists: !!post.originalPost,
      displayAuthorUsername,
      displayAuthorImgSrc,
      originalPostUsername: post.originalPost?.username
    });
  }

  // Provide modal context for child modals (reactive)
  $: contextValue = {
    post,
    displayPost: post,
    isStarred,
    canSeeOnMap: hasExactLocation, // Use canSeeOnMap to match modal expectations
    hasExactLocation,
    effectiveIsFeatured,
    reposter,
    wikipediaPreview,
    linkPreview,
    categoryColors,
    categoryTextColors,
    isSelf
  };
  
  $: setContext('post-context', contextValue);

  // Star click handler
  function handleStarClick() {
    dispatch('toggleStar', { postId: displayPost.id, isCurrentlyStarred: isStarred });
  }

  // Undo repost handler
  async function handleUndoRepost(repostId: string) {
    if (!$auth?.token) return;
    
    try {
      undoRepostSending = true;
      undoRepostError = '';
      // Call API to undo repost
      await api.deletePost(repostId, $auth.token);
      undoRepostSuccess = true;
      setTimeout(() => {
        closeUndoModal();
        // Refresh the page or update the post list
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error undoing repost:', error);
      undoRepostError = 'Failed to undo repost. Please try again.';
    } finally {
      undoRepostSending = false;
    }
  }

  // Remove links from content
  function getContentWithoutLinks(content: string, link: string) {
    if (!content || !link) return content;
    const linkVariations = [
      link,
      link.replace('https://', ''),
      link.replace('http://', ''),
      link.replace('www.', '')
    ];
    let cleanContent = content;
    linkVariations.forEach(variation => {
      cleanContent = cleanContent.replace(new RegExp(variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
    });
    return cleanContent;
  }

  function handleUsernameClick(e: any) {
    e.preventDefault();
    if (!$auth?.username || isSelf) {
      goto('/profile');
    } else {
      goto(`/profile/${encodeURIComponent(displayAuthorUsername)}`);
    }
  }

  function formatTimestamp(timestamp: any) {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid date';
    }
  }

  function openModal() {
    if (showModal) return;
    modalIsComplete = isCompletePost;
    showModal = true;
    modalOpenedAt = Date.now();
    if (typeof document !== 'undefined') {
      document.body.classList.add('post-modal-open');
    }
    if (displayPost && displayPost.id && $auth?.token) {
      api.incrementPostClick(displayPost.id, $auth.token)
        .then(() => {
          // Update local click count
          if (displayPost) {
            displayPost.clicks = (displayPost.clicks || 0) + 1;
            displayPost = { ...displayPost }; // Trigger reactivity
          }
        })
        .catch(err => console.error('Error incrementing post click:', err));
    }
  }

  function closeModal() {
    if (Date.now() - modalOpenedAt < 160) return;
    showModal = false;
    showComments = false;
    showDropdown = false;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('post-modal-open');
    }
  }

  function toggleComments() {
    showComments = !showComments;
    isPostFrozen = showComments;
    dispatch('postFreeze', { postId: post.id, isFrozen: isPostFrozen });
  }

  function getPostUrl() {
    return `${window.location.origin}/posts/${displayPost.id}`;
  }

  function openOriginalPost() {
    if (post.isRepost && post.originalPost) {
      let originalIsComplete;
      if ('isComplete' in post.originalPost) {
        originalIsComplete = post.originalPost.isComplete;
      } else {
        const originalHasContent = !!(post.originalPost.content && post.originalPost.content.trim() !== '');
        const originalHasMedia = (post.originalPost.mediaUrl && post.originalPost.mediaUrl.trim() !== '') || (post.originalPost.imageUrl && post.originalPost.imageUrl.trim() !== '');
        const originalHasHeadline = !!(post.originalPost.headline && post.originalPost.headline.trim() !== '');
        originalIsComplete = originalHasContent && originalHasMedia && originalHasHeadline;
      }
      modalIsComplete = originalIsComplete;
      showModal = true;
    } else {
      console.warn('Cannot open original post: missing original post data');
    }
  }

  function handleLinkClick(event: Event) {
    event.stopPropagation();
    if (post.link) {
      window.open(post.link, '_blank', 'noopener,noreferrer');
    }
  }

  async function loadLinkPreview() {
    if (!post.link || !$auth?.token || linkPreview || loadingLinkPreview) return;
    if (post.link.includes('wikipedia.org')) return;
    
    loadingLinkPreview = true;
    linkPreviewError = false;
    
    try {
      const preview = await api.fetchUrlPreview(post.link, $auth.token);
      if (preview && (preview.title || preview.description || preview.image)) {
        linkPreview = preview;
      }
    } catch (error) {
      console.error('Error loading link preview:', error);
      linkPreviewError = true;
    } finally {
      loadingLinkPreview = false;
    }
  }

  // Share logic
  let showShareModal = false;
  let shareConnections: any[] = [];
  let shareBuddies: any[] = [];
  let loadingConnections = false;
  let shareError = '';
  let shareSuccess = false;
  let selectedRecipients = new Set<string>();
  let shareMessage = '';
  let reposting = false;

  async function sharePost(event: any) {
    event.stopPropagation();
    showShareModal = true;
    await loadShareOptions();
  }

  async function loadShareOptions() {
    if (!$auth?.token) return;
    loadingConnections = true;
    shareError = '';
    
    try {
      const profileResponse = await api.getUser($auth.token);
      shareConnections = (profileResponse as any).connections || [];
      shareBuddies = (profileResponse as any).buddies || [];
    } catch (error) {
      console.error('Error loading share options:', error);
      shareError = 'Failed to load contacts for sharing.';
    } finally {
      loadingConnections = false;
    }
  }

  function closeShareModal() {
    showShareModal = false;
    selectedRecipients.clear();
    selectedRecipients = new Set(selectedRecipients);
    shareMessage = '';
    shareError = '';
    shareSuccess = false;
  }

  function toggleRecipient(userId: string) {
    if (selectedRecipients.has(userId)) {
      selectedRecipients.delete(userId);
    } else {
      selectedRecipients.add(userId);
    }
    selectedRecipients = new Set(selectedRecipients);
  }

  async function sendSharedPost() {
    if (selectedRecipients.size === 0) {
      shareError = 'Please select at least one recipient.';
      return;
    }
    
    try {
      shareError = '';
      const postUrl = getPostUrl();
      const message = shareMessage.trim() || `Check out this post: ${post.headline || post.content || 'Shared post'}`;
      
      // TODO: Implement messaging endpoint - /api/messages not yet available
      // For now, just skip the messaging functionality
      console.log('PostItem: Would send message to recipients:', selectedRecipients);
      console.log('PostItem: Message content:', `${message}\n\n${postUrl}`);
      
      shareSuccess = true;
      setTimeout(() => {
        closeShareModal();
      }, 2000);
    } catch (error) {
      console.error('Error sharing post:', error);
      shareError = 'Failed to share post. Please try again.';
    }
  }

  async function repostToProfile() {
    if (!$auth?.token || reposting) return;
    reposting = true;
    shareError = '';
    
    try {
      // Ensure we have valid location data - check both lat/lng and latitude/longitude
      const locationName = post.locationName || post.fenceName || 'Unknown Location';
      const lat = typeof post.lat === 'number' && !isNaN(post.lat) ? post.lat : 
                  typeof post.latitude === 'number' && !isNaN(post.latitude) ? post.latitude : 0;
      const lng = typeof post.lng === 'number' && !isNaN(post.lng) ? post.lng : 
                  typeof post.longitude === 'number' && !isNaN(post.longitude) ? post.longitude : 0;
      
      if (lat === 0 && lng === 0) {
        console.error('Post location data:', { post_lat: post.lat, post_lng: post.lng, post_latitude: post.latitude, post_longitude: post.longitude });
        throw new Error('Post location data is invalid for reposting');
      }
      
      const repostData = {
        headline: post.headline || '',
        content: post.content || '',
        imageUrl: post.imageUrl || '',
        mediaUrl: post.mediaUrl || '',
        category: post.category || 'GENERAL INFORMATION',
        latitude: lat,
        longitude: lng,
        locationName: locationName,
        fenceName: post.fenceName || locationName,
        location: {
          name: locationName,
          lat: lat,
          lng: lng,
          zoom: post.zoom || null,
          bounds: post.bounds || null,
          locationType: 'user_defined'
        },
        originalPostId: post.id,
        originalAuthor: post.username,
        isRepost: true,
        link: post.link || '',
        originalPost: {
          id: post.id,
          headline: post.headline || '',
          content: post.content || '',
          imageUrl: post.imageUrl || '',
          mediaUrl: post.mediaUrl || '',
          category: post.category || 'GENERAL INFORMATION',
          latitude: lat,
          longitude: lng,
          locationName: locationName,
          fenceName: post.fenceName || locationName,
          username: post.username,
          profileImageUrl: post.profileImageUrl || '',
          createdAt: post.createdAt,
          link: post.link || '',
          youtubeUrl: post.youtubeUrl || '',
          instagramUrl: post.instagramUrl || '',
          twitterUrl: post.twitterUrl || '',
          wikipediaUrl: post.wikipediaUrl || '',
          isComplete: isCompletePost,
          userId: post.userId
        }
      };
      
      console.log('Repost data being sent:', JSON.stringify(repostData, null, 2));
      const response = await api.createPost(repostData as any, $auth.token);
      shareSuccess = true;
      setTimeout(() => {
        closeShareModal();
        if (window.location.pathname === '/posts') {
          console.log('DEBUG: Created repost while on posts page - this should NOT appear in the posts feed');
        }
      }, 2000);
    } catch (error) {
      console.error('Error reposting:', error);
      shareError = 'Failed to repost. Please try again.';
    } finally {
      reposting = false;
    }
  }

  async function directShare(event: any) {
    event.stopPropagation();
    const url = getPostUrl();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.headline || 'Post',
          text: post.content || '',
          url
        });
      } catch (err) {
        // User cancelled or not supported
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Post link copied to clipboard!');
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        alert('Failed to copy link to clipboard');
      }
    }
  }

  // Feature modal handlers
  function openFeatureModal(e: any) {
    e.stopPropagation();
    showFeatureModal = true;
  }

  function closeFeatureModal() {
    showFeatureModal = false;
  }

  // Report modal handlers
  function openReportModal(e?: any) {
    if (e && e.stopPropagation) e.stopPropagation();
    console.log('📋 PostItem: Opening report modal for post', post.id);
    showReportModal = true;
  }

  function closeReportModal() {
    showReportModal = false;
  }

  function onFeatured(event: CustomEvent<any>) {
    const { duration, type } = event.detail;
    const durationMs = duration * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const now = Date.now();
    const featureUntil = now + durationMs;
    
    if (post) {
      post = {
        ...post,
        isFeatured: true,
        featuredInLocationUntil: type === 'location' ? featureUntil : (post.featuredInLocationUntil || 0),
        featuredInSearchUntil: type === 'search' ? featureUntil : (post.featuredInSearchUntil || 0),
        featuredBy: $auth?.email || '',
        featuredUntil: featureUntil
      };
      
      console.log(`🏆 Post ${post.id} featured for ${duration} days as ${type}:`, {
        featuredInLocationUntil: post.featuredInLocationUntil,
        featuredInSearchUntil: post.featuredInSearchUntil,
        now,
        featureUntil
      });
    }
    showFeatureModal = false;
  }

  // Delete and undo repost handlers
  function openDeleteConfirm(e: any) {
    e.stopPropagation();
    console.log('🗑️ PostItem: Opening delete confirm for post', post.id, 'isSelf:', isSelf);
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
  }

  // Hide post handler
  function openHideConfirm(e: any) {
    e.stopPropagation();
    showHideConfirm = true;
  }

  function closeHideConfirm() {
    showHideConfirm = false;
  }

  // Handle hiding post
  async function handleHidePost() {
    if (!$auth?.token) return;
    
    try {
      await api.hidePost(post.id, $auth.token);
      // Dispatch event to parent to remove post from list
      dispatch('postHidden', { postId: post.id });
    } catch (error) {
      console.error('Error hiding post:', error);
      alert('Failed to hide post. Please try again.');
    }
  }

  function openUndoModal() {
    showUndoRepostModal = true;
  }

  function closeUndoModal() {
    showUndoRepostModal = false;
    undoRepostSending = false;
    undoRepostError = '';
    undoRepostSuccess = false;
  }

  // Undo repost state
  let undoRepostSending = false;
  let undoRepostError = '';
  let undoRepostSuccess = false;

  // Comment logic
  let comments: any[] = [];
  let newComment = '';
  let submittingComment = false;
  let replyingToCommentId: string | null = null;
  let replyText = '';
  let showRepliesMap = new Map<string, boolean>();
  let repliesMap = new Map<string, any[]>();
  let loadingComments = false;
  let loadingRepliesMap = new Map<string, boolean>();

  async function fetchComments() {
    if (!displayPost?.id || loadingComments) return;
    loadingComments = true;
    
    try {
      const response = await api.fetchComments(displayPost.id);
      comments = response;
    } catch (error) {
      console.error('Error fetching comments:', error);
      comments = [];
    } finally {
      loadingComments = false;
    }
  }

  async function submitComment() {
    if (!newComment.trim() || !$auth?.email || !$auth?.token || submittingComment) return;
    submittingComment = true;
    
    try {
      await api.createComment({ postId: displayPost.id, content: newComment }, $auth.token);
      newComment = '';
      await fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      submittingComment = false;
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

  async function submitReply(parentCommentId: string) {
    if (!replyText.trim() || !$auth?.email || !$auth?.token || submittingComment) return;
    submittingComment = true;
    
    try {
      await api.createComment({
        postId: displayPost.id,
        content: replyText,
        parentCommentId: parentCommentId
      }, $auth.token);
      replyText = '';
      replyingToCommentId = null;
      await fetchComments();
    } catch (error) {
      console.error('Error submitting reply:', error);
      alert('Failed to post reply. Please try again.');
    } finally {
      submittingComment = false;
    }
  }

  async function deleteComment(commentId: string) {
    if (!$auth?.token || !confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await api.deleteComment(post.id, commentId, $auth.token);
      await fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  }

  function toggleReplies(commentId: string) {
    const currentState = showRepliesMap.get(commentId) || false;
    showRepliesMap.set(commentId, !currentState);
    showRepliesMap = new Map(showRepliesMap);
    
    if (!currentState && !repliesMap.has(commentId)) {
      loadReplies(commentId);
    }
  }

  async function loadReplies(commentId: string) {
    loadingRepliesMap.set(commentId, true);
    loadingRepliesMap = new Map(loadingRepliesMap);
    
    try {
      const replies = await api.fetchReplies(post.id, commentId);
      repliesMap.set(commentId, replies);
      repliesMap = new Map(repliesMap);
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      loadingRepliesMap.set(commentId, false);
      loadingRepliesMap = new Map(loadingRepliesMap);
    }
  }

  // Reactive statement to fetch comments when modal opens
  $: if (showComments && !isCompletePost) {
    fetchComments();
  }

  // Lifecycle
  onMount(() => {
    loadLinkPreview();
    
    const handleClickOutside = (event: Event) => {
      const target = event.target as Element | null;
      if (showDropdown && (!target || !target.closest('.dropdown-container'))) {
        showDropdown = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.body.classList.remove('post-modal-open');
    };
  });
</script>

<!-- Main post card - accessible and focusable -->
<div 
  class="post-card" 
  class:highlighted={isHighlighted} 
  on:click={openModal} 
  on:keydown={(e) => e.key === 'Enter' && openModal()} 
  role="button" 
  tabindex="0"
  aria-label="Post by {displayAuthorUsername}"
>
  <!-- Main header for all posts (shows original author for reposts) -->
  <PostHeader
    {post}
    {displayAuthorImgSrc}
    {displayAuthorUsername}
    {effectiveIsFeatured}
    {categoryColors}
    {categoryTextColors}
    {isStarred}
    {reposter}
    on:usernameClick={handleUsernameClick}
    on:starClick={handleStarClick}
    on:undoRepost={openUndoModal}
  />
  
  <!-- Media and Content Section -->
  <PostMediaContent 
    {post}
    {displayPost}
    {displayContent}
    {wikipediaPreview}
    {linkPreview}
    on:linkClick={handleLinkClick}
  />

  <!-- Actions need to be in a post-content-container wrapper -->
  <div class="post-content-container">
    <div class="post-actions">
      <div class="bottom-bar">
      </div>
      <!-- Post Footer with Action Buttons (migrated to PostStatsActions) -->
      <PostStatsActions
        {post}
        isStarred={isStarred}
        hasExactLocation={hasExactLocation}
        commentCount={post.commentsCount || 0}
        loadingStats={loadingStats}
        showMoreActions={false}
        canDelete={!!isSelf}
        on:featureClick={openFeatureModal}
        on:commentsClick={() => { openModal(); toggleComments(); }}
        on:mapClick={() => goto(`/posts?lat=${post.lat}&lng=${post.lng}&zoom=20`)}
        on:shareClick={sharePost}
        on:report={openReportModal}
        on:hideClick={openHideConfirm}
        on:deleteClick={openDeleteConfirm}
      />
    </div>
  </div>
</div>

<!-- Report Modal -->
<ReportModal 
  bind:show={showReportModal} 
  postId={post.id} 
  auth={$auth} 
  on:close={closeReportModal} 
/>

<!-- Main Post Modal -->
{#if showModal}
  {#if modalIsComplete}
    <!-- Complete Post Modal -->
    <CompletePostModal
      show={true}
      auth={$auth}
      on:close={closeModal}
      on:starClick={handleStarClick}
      on:usernameClick={handleUsernameClick}
      on:sharePost={sharePost}
      on:formatTimestamp={formatTimestamp}
    />
  {:else}
    <!-- Incomplete Post Modal -->
    <IncompletePostModal
      show={true}
      auth={$auth}
      on:close={closeModal}
      on:starClick={handleStarClick}
      on:usernameClick={handleUsernameClick}
      on:sharePost={sharePost}
      on:formatTimestamp={formatTimestamp}
      on:featureClick={openFeatureModal}
      on:fetchComments={fetchComments}
      on:submitComment={(e) => submitComment()}
      on:submitReply={(e) => submitReply(e.detail.parentCommentId)}
      on:deleteComment={(e) => deleteComment(e.detail.commentId)}
      on:loadReplies={(e) => loadReplies(e.detail.commentId)}
      on:linkClick={handleLinkClick}
    />
  {/if}
{/if}

<!-- Feature Post Modal -->
{#if showFeatureModal}
  <FeaturePostModal
    show={showFeatureModal}
    postId={post.id}
    onClose={closeFeatureModal}
    on:featured={onFeatured}
  />
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <DeleteConfirmModal
    bind:show={showDeleteConfirm}
    postId={post.id}
    auth={$auth}
    on:close={closeDeleteConfirm}
    on:deleteSuccess={(e) => { 
      dispatch('postDeleted', { postId: e.detail.postId }); 
      closeDeleteConfirm(); 
      closeModal(); 
      window.location.reload(); 
    }}
  />
{/if}

<!-- Hide Confirmation Modal -->
{#if showHideConfirm}
  <div 
    class="modal-backdrop" 
    on:click={closeHideConfirm} 
    on:keydown={(e) => e.key === 'Escape' && closeHideConfirm()} 
    role="button" 
    tabindex="0"
  >
    <div class="hide-confirm-modal" on:click|stopPropagation role="dialog">
      <div class="hide-modal-header">
        <h3>Hide Post</h3>
        <button class="modal-close" on:click={closeHideConfirm}>&times;</button>
      </div>
      <div class="hide-modal-body">
        <p class="hide-confirmation-text">Are you sure you want to hide this post? You will never see it again.</p>
        <div class="hide-actions">
          <button type="button" class="cancel-btn" on:click={closeHideConfirm}>Cancel</button>
          <button type="button" class="hide-confirm-btn" on:click={() => { handleHidePost(); closeHideConfirm(); }}>Hide Post</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Undo Repost Modal -->
{#if showUndoRepostModal}
  <div 
    class="modal-backdrop" 
    on:click={closeUndoModal} 
    on:keydown={(e) => e.key === 'Escape' && closeUndoModal()} 
    role="button" 
    tabindex="0"
  >
    <div class="undo-repost-modal" on:click|stopPropagation role="dialog">
      <div class="undo-modal-header">
        <h3>Undo Repost</h3>
        <button class="modal-close" on:click={closeUndoModal}>&times;</button>
      </div>
      <div class="undo-modal-body">
        {#if undoRepostSuccess}
          <div class="undo-success">
            <p>Your repost has been removed successfully.</p>
          </div>
        {:else}
          <p class="undo-confirmation-text">Are you sure you want to undo this repost? This will remove it from your profile.</p>
          {#if undoRepostError}
            <div class="undo-error">{undoRepostError}</div>
          {/if}
          <div class="undo-actions">
            <button type="button" class="cancel-btn" on:click={closeUndoModal}>Cancel</button>
            <button type="button" class="undo-confirm-btn" disabled={undoRepostSending} on:click={() => handleUndoRepost(post.id)}>
              {undoRepostSending ? 'Removing...' : 'Undo Repost'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Share Modal -->
{#if showShareModal}
  <ShareModal
    show={showShareModal}
    {post}
    bind:shareSuccess
    bind:shareError
    bind:shareMessage
    bind:shareBuddies
    bind:shareConnections
    bind:selectedRecipients
    bind:loadingConnections
    bind:reposting
    on:close={closeShareModal}
    on:toggleRecipient={(e) => toggleRecipient(e.detail.userId)}
    on:sendSharedPost={sendSharedPost}
    on:repostToProfile={repostToProfile}
    on:directShare={(e) => directShare(e.detail.event)}
  />
{/if}

<style>
  .post-card {
    background: #fff;
    border: none;
    border-radius: 1em;
    box-shadow: 0 4px 18px rgba(68, 68, 68, 0.06);
    display: flex;
    flex-direction: column;
    max-width: 390px;
    width: 100%;
    margin: 0 auto;
    overflow: hidden;
    transition: transform 0.5s, box-shadow 0.15s;
    cursor: pointer;
    position: relative;
  }
  
  .post-card:hover {
    transform: translateY(-3px) scale(1.04);
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
    z-index: 100;
  }

  .post-card:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .post-card.highlighted {
    border: 2px solid #2563eb;
    box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
  }

  .post-content-container {
    padding: 1rem;
  }

  .post-actions {
    margin-top: 0.5rem;
  }

  /* Modal backdrop styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  /* Undo repost modal styles */
  .undo-repost-modal {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    max-width: 400px;
    width: 90%;
    color: #fff;
  }

  .undo-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .undo-modal-header h3 {
    margin: 0;
    color: #ffffff;
  }

  .modal-close {
    background: none;
    border: none;
    color: #ccc;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #fff;
  }

  .undo-confirmation-text {
    color: #cccccc;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .undo-success {
    color: #16a34a;
    font-weight: 600;
    margin: 2rem 0;
  }

  .undo-error {
    color: #dc2626;
    margin-bottom: 1rem;
    text-align: center;
  }

  .undo-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
  }

  .cancel-btn,
  .undo-confirm-btn {
    flex: 1;
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
    border: none;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #333;
    color: #cccccc;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .undo-confirm-btn {
    background: #ff6b6b;
    color: white;
  }

  .undo-confirm-btn:hover {
    background: #ee5a24;
  }

  .undo-confirm-btn:disabled {
    background: #a5b4fc;
    cursor: not-allowed;
  }

  /* Hide confirmation modal styles */
  .hide-confirm-modal {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    max-width: 400px;
    width: 90%;
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

  .hide-confirmation-text {
    color: #cccccc;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .hide-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
  }

  .hide-confirm-btn {
    flex: 1;
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
    border: none;
    background: #ff6b6b;
    color: white;
  }

  .hide-confirm-btn:hover {
    background: #ee5a24;
  }
</style>