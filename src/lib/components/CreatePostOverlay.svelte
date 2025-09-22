<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { createPost, fetchUrlPreview } from '$lib/api';
    import { auth, preferredLocation } from '$lib/stores';
    import { get } from 'svelte/store';
    import axios from 'axios';
    import { PUBLIC_API_BASE_URL } from '$env/static/public';
    import FeaturePostModal from '$lib/components/FeaturePostModal.svelte';
    import TagAutocomplete from '$lib/components/TagAutocomplete.svelte';

    export let show: boolean;
    export let onClose: () => void;
    export let isMapMode: boolean;
    export let mapPinLocation: { lat: number; lng: number } | null = null;
    export let clickZoom: number | null = null;
    export let postDraft: { content: string; headline: string; imageUrl: string; mediaUrl: string; category: string; link: string };

    const dispatch = createEventDispatcher();

    let isLoading = false;
    let errorMessage = '';
    let successMessage = '';
    let showConfirmation = false;
    let newPostId: string | null = null;
    let authToken: string | null = null;
    let username: string | null = null;
    let locationName: string = 'Loading location...';
    let urlPreview: { title: string; description: string; image: string; url: string } | null = null;
    let urlPreviewLoading = false;
    let urlPreviewError = '';
    let file: FileList | null = null;
    let videoEmbed: { platform: string; id: string; embedUrl: string; originalUrl: string } | null = null;
    let uploadProgress = 0;
    
    // Character limits and validation
    let showHeadlineTooltip = false;
    let showContentTooltip = false;
    let headlineTooltipTimer: ReturnType<typeof setTimeout>;
    let contentTooltipTimer: ReturnType<typeof setTimeout>;
    const MAX_HEADLINE_LENGTH = 100; // Match backend validation
    const MAX_CONTENT_LENGTH = 1000;

    // Feature modal state
    let showFeatureModal = false;

    // Tag system state
    let showTagAutocomplete = false;
    let tagQuery = '';
    let tagPosition = { x: 0, y: 0 };
    let currentTagStart = -1;
    let detectedTags: Array<{ username: string; start: number; end: number }> = [];
    const TAG_REGEX = /@([a-zA-Z0-9_]+)/g;
    const MAX_TAGS = 8;

    const fallbackLocation = {
        name: 'Las Vegas, Nevada, USA',
        lat: 36.1699,
        lng: -115.1398,
        zoom: 11
    };

    const categories = ['COMMUNITY', 'ALERTS', 'NEWS', 'EVENTS', 'JOBS', 'TASKS', 'BUSINESSES', 'POINTS OF INTEREST'];
    
    // Category colors from posts page style section
    const categoryColors: { [key: string]: string } = {
        'ALERTS': '#eef119',
        'NEWS': '#1a1919', 
        'EVENTS': '#b80a0a',
        'JOBS': '#18038b',
        'TASKS': '#350249',
        'BUSINESSES': '#046909',
        'POINTS OF INTEREST': '#e44303',
        'COMMUNITY': '#00eaff'
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
        'COMMUNITY': '#000000'
    };
    
    // State for content box modes
    let showHeadlineInput = false;
    let showMediaUpload = false;

    $: auth.subscribe(value => {
        authToken = value.token;
        username = value.username;
    });

    $: if (show && isMapMode && mapPinLocation) {
        reverseGeocode(mapPinLocation.lat, mapPinLocation.lng);
    } else if (show && !isMapMode) {
        const currentLoc: any = get(preferredLocation);
        locationName = currentLoc?.name || fallbackLocation.name;
    }

    // Reset states when modal opens (use onMount instead of reactive statement to avoid loops)
    $: if (show) {
        console.log('CreatePostOverlay: show prop changed to true');
        resetModalState();
    }

    function resetModalState() {
        console.log('CreatePostOverlay: resetting states');
        showConfirmation = false;
        successMessage = '';
        errorMessage = '';
        newPostId = null;
        showHeadlineTooltip = false;
        showContentTooltip = false;
        
        // Only set default to COMMUNITY if category is empty or undefined
        if (!postDraft.category) {
            postDraft.category = 'COMMUNITY';
        }
    }

    let urlDebounceTimeout: ReturnType<typeof setTimeout>;
    
    // Tag detection and autocomplete functions
    function detectTags(text: string): Array<{ username: string; start: number; end: number }> {
        const tags = [];
        let match;
        const regex = new RegExp(TAG_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            tags.push({
                username: match[1],
                start: match.index,
                end: match.index + match[0].length
            });
            
            // Stop at max tags limit
            if (tags.length >= MAX_TAGS) break;
        }
        
        return tags;
    }

    function findCurrentTag(text: string, cursorPos: number): { query: string; start: number } | null {
        // Look backwards from cursor to find @ symbol
        let start = cursorPos - 1;
        while (start >= 0 && text[start] !== '@' && text[start] !== ' ' && text[start] !== '\n') {
            start--;
        }
        
        if (start >= 0 && text[start] === '@') {
            const query = text.substring(start + 1, cursorPos);
            // Only show autocomplete if we have at least 1 character after @
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
        // Create a temporary span to measure text
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre-wrap';
        tempSpan.style.font = getComputedStyle(element).font;
        tempSpan.style.padding = getComputedStyle(element).padding;
        
        // Get text up to the tag position
        const textUpToTag = element.value.substring(0, tagStart);
        tempSpan.textContent = textUpToTag;
        
        document.body.appendChild(tempSpan);
        const rect = element.getBoundingClientRect();
        const spanRect = tempSpan.getBoundingClientRect();
        document.body.removeChild(tempSpan);
        
        return {
            x: rect.left + (spanRect.width % rect.width),
            y: rect.top + spanRect.height + 25 // Position below the text
        };
    }

    function handleContentInputWithTags(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        const text = target.value;
        const cursorPos = getCaretPosition(target);
        
        // Update detected tags
        detectedTags = detectTags(text);
        
        // Check for current tag being typed
        const currentTag = findCurrentTag(text, cursorPos);
        
        if (currentTag) {
            tagQuery = currentTag.query;
            currentTagStart = currentTag.start;
            tagPosition = calculateTagPosition(target, currentTag.start);
            showTagAutocomplete = true;
        } else {
            showTagAutocomplete = false;
            tagQuery = '';
            currentTagStart = -1;
        }
        
        // Handle character limit
        if (text.length >= MAX_CONTENT_LENGTH) {
            target.value = text.substring(0, MAX_CONTENT_LENGTH);
            showContentTooltip = true;
            if (contentTooltipTimer) clearTimeout(contentTooltipTimer);
            contentTooltipTimer = setTimeout(() => {
                showContentTooltip = false;
            }, 3000);
        }
    }

    function handleTagSelect(event: CustomEvent) {
        const { user } = event.detail;
        const textarea = document.querySelector('.post-content-textarea') as HTMLTextAreaElement;
        
        if (textarea && currentTagStart >= 0) {
            const currentText = textarea.value;
            const cursorPos = getCaretPosition(textarea);
            
            // Replace the partial tag with the complete username
            const beforeTag = currentText.substring(0, currentTagStart);
            const afterCursor = currentText.substring(cursorPos);
            const newText = beforeTag + `@${user.username} ` + afterCursor;
            
            postDraft.content = newText;
            
            // Set cursor position after the inserted tag
            setTimeout(() => {
                const newCursorPos = currentTagStart + user.username.length + 2; // +2 for @ and space
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                textarea.focus();
            }, 0);
        }
        
        showTagAutocomplete = false;
        tagQuery = '';
        currentTagStart = -1;
    }

    function handleTagClose() {
        showTagAutocomplete = false;
        tagQuery = '';
        currentTagStart = -1;
    }

    function handleUrlChangeDebounced() {
        clearTimeout(urlDebounceTimeout);
        urlDebounceTimeout = setTimeout(() => {
            if (postDraft.link) {
                fetchUrlPreviewAndSet();
            } else {
                urlPreview = null;
                urlPreviewError = '';
                urlPreviewLoading = false;
            }
        }, 500);
    }

    function handleUrlInputChange() {
        urlPreview = null;
        urlPreviewError = '';
        urlPreviewLoading = false;
        handleUrlChangeDebounced();
    }

    async function fetchUrlPreviewAndSet() {
        if (!postDraft.link) return;
        urlPreviewLoading = true;
        urlPreviewError = '';
        try {
            const preview = await fetchUrlPreview(postDraft.link, authToken || '');
            urlPreview = preview;
        } catch (error) {
            console.error('CreatePostOverlay: Error fetching URL preview:', error);
            urlPreviewError = 'Failed to load URL preview.';
            urlPreview = null;
        } finally {
            urlPreviewLoading = false;
        }
    }

    $: console.log('Upload progress updated:', uploadProgress);

    onMount(() => {
        console.log('CreatePostOverlay: Mounted, show:', show, 'isMapMode:', isMapMode, 'mapPinLocation:', mapPinLocation, 'clickZoom:', clickZoom);
    });

    onDestroy(() => {
        console.log('CreatePostOverlay: Unmounted');
    });

    async function reverseGeocode(lat: number, lng: number) {
        try {
            const geocodedResult = await preferredLocation.geocodeLocation(lat, lng);
            locationName = geocodedResult?.name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        } catch (error: any) {
            locationName = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            errorMessage = `Failed to get location name: ${error.message}`;
        }
    }

    function clearPostFields() {
        postDraft.headline = '';
        postDraft.content = '';
        postDraft.imageUrl = '';
        postDraft.mediaUrl = '';
        postDraft.category = 'COMMUNITY';
        postDraft.link = '';
        file = null;
        uploadProgress = 0;
        urlPreview = null;
        urlPreviewError = '';
        urlPreviewLoading = false;
        videoEmbed = null;
        showHeadlineInput = false;
        showMediaUpload = false;
    }

    // Debug logging for showConfirmation changes
    $: if (typeof showConfirmation !== 'undefined') {
        console.log('CreatePostOverlay: showConfirmation changed to:', showConfirmation);
    }

    async function handleSubmit() {
        isLoading = true;
        errorMessage = '';
        successMessage = '';

        try {
            // Handle file upload if a file is selected
            let mediaUrl = '';
            if (file && file[0]) {
                if (!authToken) {
                    throw new Error('Please log in to upload a file.');
                }
                const formData = new FormData();
                formData.append('file', file[0]);
                uploadProgress = 0;

                const response = await axios.post(`${PUBLIC_API_BASE_URL}/api/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${authToken}`
                    },
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                            console.log('Progress event:', uploadProgress, '%', progressEvent);
                        }
                    }
                });
                console.log('File upload response:', response.data);

                if (response.data.type === 'error') {
                    throw new Error(response.data.message || 'File upload failed');
                }
                if (response.data.data) {
                    mediaUrl = response.data.data; // Use S3 URL
                    uploadProgress = 100;
                } else {
                    throw new Error('Invalid upload response');
                }
            }

            // Validate post data
            const hasHeadline = postDraft.headline?.trim();
            const hasContent = postDraft.content?.trim();
            const hasImageUrl = postDraft.imageUrl?.trim();
            const hasMediaUrl = mediaUrl?.trim() || postDraft.mediaUrl?.trim();
            const hasLink = postDraft.link?.trim();
            const hasVideoEmbed = videoEmbed;
            if (!hasHeadline && !hasContent && !hasImageUrl && !hasMediaUrl && !hasLink && !hasVideoEmbed) {
                throw new Error('At least one of Headline, Content, Image URL, Media Upload, Video, or External Link is required.');
            }
            
            // Character length validation
            if (hasContent && hasContent.length > MAX_CONTENT_LENGTH) {
                throw new Error(`Content cannot exceed ${MAX_CONTENT_LENGTH} characters. Current: ${hasContent.length}`);
            }
            
            if (hasHeadline && hasHeadline.length > MAX_HEADLINE_LENGTH) {
                throw new Error(`Headline cannot exceed ${MAX_HEADLINE_LENGTH} characters. Current: ${hasHeadline.length}`);
            }

            if (!authToken) throw new Error('Please log in to create a post.');
            if (!username) throw new Error('Username is missing. Please set a username.');

            const currentPreferredLoc: any = get(preferredLocation) || fallbackLocation;
            if (!currentPreferredLoc.name || !currentPreferredLoc.lat || !currentPreferredLoc.lng) {
                throw new Error('Preferred location data is invalid.');
            }

            let postLatitude: number;
            let postLongitude: number;
            let postLocationName: string;
            let hasExactLocation: boolean;

            console.log('🔍 CreatePostOverlay: Exact location check:', {
                isMapMode,
                mapPinLocation,
                clickZoom,
                zoomValid: clickZoom >= 15 && clickZoom <= 21
            });
            
            if (isMapMode && mapPinLocation && clickZoom && clickZoom >= 15 && clickZoom <= 21) {
                postLatitude = mapPinLocation.lat;
                postLongitude = mapPinLocation.lng;
                postLocationName = currentPreferredLoc.name;
                hasExactLocation = true;
                console.log('✅ CreatePostOverlay: Setting hasExactLocation=true for map mode post');
            } else {
                postLatitude = currentPreferredLoc.lat;
                postLongitude = currentPreferredLoc.lng;
                postLocationName = currentPreferredLoc.name;
                hasExactLocation = false;
                console.log('❌ CreatePostOverlay: Setting hasExactLocation=false for regular post');
            }

            const transformedPost = {
                headline: postDraft.headline?.trim() || undefined,
                content: postDraft.content?.trim() || '',
                imageUrl: postDraft.imageUrl?.trim() || '',
                mediaUrl: mediaUrl || postDraft.mediaUrl?.trim() || '',
                category: postDraft.category,
                link: postDraft.link?.trim() || '',
                urlPreview: urlPreview || null,
                videoEmbed: videoEmbed || null,
                latitude: postLatitude,
                longitude: postLongitude,
                hasExactLocation,
                fenceName: currentPreferredLoc.name,
                locationName: postLocationName,
                location: {
                    name: currentPreferredLoc.name,
                    lat: postLatitude,
                    lng: postLongitude,
                    zoom: currentPreferredLoc.zoom || 11,
                    bounds: currentPreferredLoc.bounds || null,
                    locationType: 'user_defined'
                }
            };

            console.log('CreatePostOverlay: Sending transformed post to API:', JSON.stringify(transformedPost, null, 2));

            const response = await createPost(transformedPost, authToken);
            console.log('CreatePostOverlay: API response for hasExactLocation post:', response);
            successMessage = 'Post created successfully!';
            newPostId = (response as any).id || response.post?.id || (response.post as any)?._id;
            console.log('CreatePostOverlay: Post creation successful, newPostId:', newPostId, 'successMessage:', successMessage);

            // Immediately clear the fields after successful post, regardless of mode
            clearPostFields();

            showConfirmation = true;
            console.log('CreatePostOverlay: showConfirmation set to true for hasExactLocation post');
        } catch (error: any) {
            errorMessage = error.message || 'Failed to create post. Please try again.';
            console.error('CreatePostOverlay: Error during submission:', error);
        } finally {
            isLoading = false;
        }
    }

    function handleSeeNewPost() {
        clearPostFields();
        dispatch('postcreated', { id: newPostId });
        onClose();
    }

    function handleOutsideClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
            onClose();
        }
    }

    function handleFeaturePost() {
        showFeatureModal = true;
    }
    function handleCloseFeatureModal() {
        showFeatureModal = false;
    }

    // Function to detect if a URL is an image
    function isImageUrl(url: string): boolean {
        if (!url) return false;
        return /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
    }

    // Function to detect video URLs (YouTube, TikTok, etc.)
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

    // Function to extract video ID and platform
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

        // TikTok
        const tiktokMatch = url.match(/(?:tiktok\.com\/@[^\/]+\/video\/|tiktok\.com\/v\/)(\d+)/);
        if (tiktokMatch) {
            return {
                platform: 'tiktok',
                id: tiktokMatch[1],
                embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`
            };
        }

        // Facebook Video
        const facebookMatch = url.match(/(?:facebook\.com\/.*\/videos\/|fb\.watch\/)(\d+)/);
        if (facebookMatch) {
            return {
                platform: 'facebook',
                id: facebookMatch[1],
                embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`
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

    // Function to detect URLs in content and handle them
    function detectAndProcessUrls(content: string): { processedContent: string; detectedImageUrl: string | null; detectedLink: string | null } {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex);
        
        let processedContent = content;
        let detectedImageUrl: string | null = null;
        let detectedLink: string | null = null;

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
                        // Remove the video URL from content and show a shortened version
                        const shortenedUrl = `${videoInfo.platform.charAt(0).toUpperCase() + videoInfo.platform.slice(1)} video`;
                        processedContent = processedContent.replace(url, shortenedUrl).trim();
                    }
                } else if (!detectedLink) {
                    detectedLink = url;
                }
            }
        }

        return { processedContent, detectedImageUrl, detectedLink };
    }

    // Handle content changes to detect URLs
    function handleContentChange() {
        const result = detectAndProcessUrls(postDraft.content);
        
        // Update the content without URLs that became images
        postDraft.content = result.processedContent;
        
        // Set detected image URL
        if (result.detectedImageUrl) {
            postDraft.imageUrl = result.detectedImageUrl;
        }
        
        // Set detected link for preview
        if (result.detectedLink && result.detectedLink !== postDraft.link) {
            postDraft.link = result.detectedLink;
            handleUrlChangeDebounced();
        }
    }

    function toggleHeadline() {
        showHeadlineInput = !showHeadlineInput;
        if (!showHeadlineInput) {
            postDraft.headline = '';
            showHeadlineTooltip = false;
        }
    }
    
    // Handle content input with character limit
    function handleContentInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        let value = target.value;
        
        if (value.length > MAX_CONTENT_LENGTH) {
            value = value.substring(0, MAX_CONTENT_LENGTH);
            target.value = value;
            postDraft.content = value;
            
            // Show tooltip
            showContentTooltip = true;
            clearTimeout(contentTooltipTimer);
            contentTooltipTimer = setTimeout(() => {
                showContentTooltip = false;
            }, 3000);
        } else {
            postDraft.content = value;
            showContentTooltip = false;
        }
        
        // Still call the original content change handler for URL detection
        handleContentChange();
    }
    
    // Handle headline input with character limit
    function handleHeadlineInput(event: Event) {
        const target = event.target as HTMLInputElement;
        let value = target.value;
        
        if (value.length > MAX_HEADLINE_LENGTH) {
            value = value.substring(0, MAX_HEADLINE_LENGTH);
            target.value = value;
            postDraft.headline = value;
            
            // Show tooltip
            showHeadlineTooltip = true;
            clearTimeout(headlineTooltipTimer);
            headlineTooltipTimer = setTimeout(() => {
                showHeadlineTooltip = false;
            }, 3000);
        } else {
            postDraft.headline = value;
            showHeadlineTooltip = false;
        }
    }

    function toggleMediaUpload() {
        showMediaUpload = !showMediaUpload;
        if (!showMediaUpload) {
            file = null;
            uploadProgress = 0;
        }
    }
</script>

{#if show}
    <div class="overlay-backdrop" role="button" tabindex="0" on:click={handleOutsideClick} on:keydown={(e) => e.key === 'Escape' && onClose()}>
        {#if showConfirmation}
            <div class="modal-content confirmation-box" role="dialog" aria-modal="true" aria-labelledby="confirmationTitle">
                <h2 id="confirmationTitle">POST SUCCESSFUL!</h2>
                <p>Check your post in the community posts</p>
                <div class="button-group">
                    <button class="see-post-button" on:click={handleSeeNewPost}>See New Post</button>
                    {#if newPostId}
                        <button class="feature-post-btn" on:click={handleFeaturePost}>Feature Post</button>
                    {/if}
                </div>
            </div>
        {:else}
            <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="createPostTitle">
                <h2 id="createPostTitle">Create Post</h2>
                
                <form on:submit|preventDefault={handleSubmit}>
                    <!-- Location Display -->
                    <div class="location-display">
                        <span class="location-label">Location:</span>
                        <span class="location-value">{locationName}</span>
                    </div>

                    <!-- Category Badge -->
                    <div class="category-section">
                        <select 
                            class="category-badge" 
                            bind:value={postDraft.category}
                            style="background-color: {categoryColors[postDraft.category] || '#000000'}; color: {categoryTextColors[postDraft.category] || '#ffffff'};"
                        >
                            {#each categories as category}
                                <option value={category}>{category}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- Content Box -->
                    <div class="content-section">
                        <!-- Headline Input (conditional) -->
                        {#if showHeadlineInput}
                            <div class="headline-input">
                                <div class="headline-wrapper">
                                    <input 
                                        type="text" 
                                        bind:value={postDraft.headline} 
                                        on:input={handleHeadlineInput}
                                        placeholder="Enter your headline..."
                                        class="headline-field"
                                        maxlength="{MAX_HEADLINE_LENGTH}"
                                    />
                                    {#if showHeadlineTooltip}
                                        <div class="headline-tooltip">
                                            Headline has a {MAX_HEADLINE_LENGTH} character limit
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}

                        <!-- Main Content Area -->
                        <div class="content-area">
                            <div class="content-wrapper">
                                <textarea 
                                    bind:value={postDraft.content} 
                                    on:input={handleContentInputWithTags}
                                    placeholder="What's happening in your community?"
                                    class="content-textarea post-content-textarea"
                                    maxlength="{MAX_CONTENT_LENGTH}"
                                ></textarea>
                                {#if showContentTooltip}
                                    <div class="content-tooltip">
                                        Content has a {MAX_CONTENT_LENGTH} character limit
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Media Upload (conditional) -->
                        {#if showMediaUpload}
                            <div class="media-upload-section">
                                <input type="file" accept="image/jpeg,image/png,image/gif,video/mp4,video/webm" bind:files={file} class="file-input" />
                                {#if uploadProgress > 0}
                                    <progress value={uploadProgress} max="100" class="upload-progress">{uploadProgress}%</progress>
                                {/if}
                            </div>
                        {/if}

                        <!-- Preview Area -->
                        <div class="preview-area">
                            <!-- Image Preview -->
                            {#if postDraft.imageUrl}
                                <div class="image-preview">
                                    <img src={postDraft.imageUrl} alt="Preview" class="preview-image" />
                                </div>
                            {/if}

                            <!-- Media Preview -->
                            {#if postDraft.mediaUrl}
                                <div class="media-preview">
                                    {#if postDraft.mediaUrl.match(/\.(jpeg|jpg|png|gif)$/i)}
                                        <img src={postDraft.mediaUrl} alt="Uploaded media" class="preview-image" />
                                    {:else if postDraft.mediaUrl.match(/\.(mp4|webm)$/i)}
                                        <video src={postDraft.mediaUrl} controls class="preview-video">
                                            <track kind="captions" label="No captions available" />
                                            Your browser does not support the video tag.
                                        </video>
                                    {/if}
                                </div>
                            {/if}

                            <!-- Video Embed Preview -->
                            {#if videoEmbed}
                                <div class="video-embed-preview">
                                    <div class="video-embed-header">
                                        <span class="video-platform">{videoEmbed.platform.charAt(0).toUpperCase() + videoEmbed.platform.slice(1)} Video</span>
                                        <button type="button" class="remove-video-btn" on:click={() => videoEmbed = null} title="Remove video">×</button>
                                    </div>
                                    {#if videoEmbed.platform === 'youtube'}
                                        <iframe
                                            src={videoEmbed.embedUrl}
                                            frameborder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowfullscreen
                                            class="video-embed"
                                            title="YouTube video"
                                        ></iframe>
                                    {:else if videoEmbed.platform === 'vimeo'}
                                        <iframe
                                            src={videoEmbed.embedUrl}
                                            frameborder="0"
                                            allow="autoplay; fullscreen; picture-in-picture"
                                            allowfullscreen
                                            class="video-embed"
                                            title="Vimeo video"
                                        ></iframe>
                                    {:else}
                                        <div class="video-placeholder">
                                            <p>{videoEmbed.platform.charAt(0).toUpperCase() + videoEmbed.platform.slice(1)} video detected</p>
                                            <a href={videoEmbed.originalUrl} target="_blank" rel="noopener noreferrer" class="preview-link">View Original</a>
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                            <!-- URL Preview -->
                            {#if urlPreviewLoading}
                                <div class="url-preview-loading">Loading preview...</div>
                            {:else if urlPreview}
                                <div class="url-preview">
                                    {#if urlPreview.image}
                                        <img src={urlPreview.image} alt="URL preview" class="preview-image" />
                                    {/if}
                                    <div class="url-preview-content">
                                        <h4>{urlPreview.title || 'No title'}</h4>
                                        <p>{urlPreview.description || 'No description'}</p>
                                        <a href={urlPreview.url} target="_blank" rel="noopener noreferrer" class="preview-link">Visit Link</a>
                                    </div>
                                </div>
                            {/if}
                        </div>

                        <!-- Content Footer with Action Buttons -->
                        <div class="content-footer">
                            <button type="button" class="action-btn headline-btn" on:click={toggleHeadline} class:active={showHeadlineInput}>
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M14 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12zM2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2z"/>
                                    <path d="M7.5 5.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
                                </svg>
                            </button>

                            <button type="button" class="action-btn media-btn" on:click={toggleMediaUpload} class:active={showMediaUpload}>
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                    <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093L6.5 10.5l-2.35-2.35a.5.5 0 0 0-.706 0L1 10.5V3a1 1 0 0 1 1-1h12z"/>
                                </svg>
                            </button>

                            <button type="submit" class="action-btn create-btn" disabled={isLoading || (uploadProgress > 0 && uploadProgress < 100)}>
                                {#if isLoading}
                                    Creating...
                                {:else}
                                    Create
                                {/if}
                            </button>
                        </div>
                    </div>

                    {#if errorMessage}
                        <div class="error-message">{errorMessage}</div>
                    {/if}
                    {#if successMessage}
                        <div class="success-message">{successMessage}</div>
                    {/if}
                </form>
            </div>
        {/if}

        <!-- Feature Post Modal -->
        {#if showFeatureModal && newPostId}
            <FeaturePostModal show={showFeatureModal} postId={newPostId} onClose={handleCloseFeatureModal} />
        {/if}
    </div>
{/if}

<!-- Tag Autocomplete -->
<TagAutocomplete
    bind:visible={showTagAutocomplete}
    bind:query={tagQuery}
    bind:position={tagPosition}
    on:select={handleTagSelect}
    on:close={handleTagClose}
/>

<style>
    .overlay-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        overflow-y: auto;
    }

    .modal-content {
        background: #000;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
        border: 2px solid #00eaff;
        max-width: 600px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        margin-top: 60px;
        /* Hide scrollbar */
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    
    .modal-content::-webkit-scrollbar {
        display: none;
    }

    .confirmation-box {
        text-align: center;
    }

    h2 {
        text-align: center;
        color: #00eaff;
        margin-bottom: 1.5em;
        font-size: 1.8em;
        font-weight: 700;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    }

    /* Location Display */
    .location-display {
        background: #111;
        padding: 1em;
        border-radius: 8px;
        margin-bottom: 1.5em;
        border: 2px solid #333;
        transition: border-color 0.3s ease;
    }

    .location-display:hover {
        border-color: #00eaff;
    }

    .location-label {
        font-size: 0.9em;
        color: #00eaff;
        font-weight: 500;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    }

    .location-value {
        font-size: 1em;
        color: #fff;
        font-weight: 600;
        margin-left: 0.5em;
    }

    /* Category Section */
    .category-section {
        margin-bottom: 1.5em;
    }

    .category-badge {
        background: #333;
        color: #00eaff;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        font-weight: 500;
        font-size: 0.8em;
        border-radius: 0.8em;
        padding: 0.4em 1em;
        border: 2px solid #555;
        cursor: pointer;
        letter-spacing: 0.02em;
        transition: all 0.3s ease;
    }

    .category-badge:hover {
        background: #00eaff;
        color: #000;
        border-color: #00eaff;
    }

    /* Content Section */
    .content-section {
        background: #111;
        border: 2px solid #333;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 1em;
        transition: border-color 0.3s ease;
    }

    .content-section:focus-within {
        border-color: #00eaff;
    }

    .headline-input {
        border-bottom: 2px solid #333;
        padding: 0;
        position: relative;
        /* Prevent container expansion */
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
    }

    .headline-wrapper {
        position: relative;
        width: 100%;
        box-sizing: border-box;
    }

    .headline-field {
        width: 100%;
        padding: 1em 1.2em;
        border: none;
        font-size: 1.1em;
        font-weight: 600;
        color: #fff;
        background: transparent;
        outline: none;
        resize: none;
        box-sizing: border-box;
        /* Prevent expanding beyond container */
        max-width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .headline-field::placeholder {
        color: #888;
        font-weight: 500;
    }



    .headline-tooltip {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: #00eaff;
        color: #000;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.8em;
        font-weight: 600;
        white-space: nowrap;
        z-index: 1000;
        margin-top: 5px;
        animation: tooltipFadeIn 0.3s ease;
    }

    .headline-tooltip::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #00eaff;
    }

    @keyframes tooltipFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .content-area {
        padding: 0;
    }

    .content-wrapper {
        position: relative;
    }

    .content-textarea {
        width: 100%;
        min-height: 120px;
        padding: 1.2em;
        border: none;
        font-size: 1em;
        line-height: 1.5;
        color: #fff;
        background: transparent;
        outline: none;
        resize: vertical;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .content-textarea::placeholder {
        color: #888;
    }

    .content-tooltip {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #00eaff;
        color: #000;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.8em;
        font-weight: 600;
        white-space: nowrap;
        z-index: 1000;
        animation: tooltipFadeIn 0.3s ease;
        pointer-events: none;
    }

    .content-tooltip::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #00eaff;
    }



    /* Media Upload Section */
    .media-upload-section {
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        background: #222;
    }

    .file-input {
        width: 100%;
        padding: 0.5em;
        border: 1px dashed #555;
        border-radius: 0.5em;
        background: #111;
        color: #fff;
        cursor: pointer;
        font-size: 0.9em;
        transition: border-color 0.3s ease;
    }

    .file-input:hover {
        border-color: #00eaff;
    }

    .upload-progress {
        width: 100%;
        height: 4px;
        margin-top: 0.5em;
        border-radius: 2px;
    }

    /* Preview Area */
    .preview-area {
        padding: 0;
    }

    .image-preview,
    .media-preview {
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        background: #222;
    }

    .preview-image {
        width: 100%;
        max-height: 300px;
        object-fit: contain;
        border-radius: 0.8em;
        background: #333;
    }

    .preview-video {
        width: 100%;
        max-height: 300px;
        border-radius: 0.8em;
    }

    .url-preview {
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        background: #222;
    }

    .url-preview-content h4 {
        font-size: 1em;
        color: #00eaff;
        margin: 0.5em 0;
        font-weight: 600;
    }

    .url-preview-content p {
        font-size: 0.9em;
        color: #ccc;
        margin: 0.5em 0;
        line-height: 1.4;
    }

    .preview-link {
        color: #00eaff;
        text-decoration: none;
        font-size: 0.9em;
        font-weight: 500;
        transition: color 0.3s ease;
    }

    .preview-link:hover {
        color: #0099cc;
        text-decoration: underline;
    }

    .url-preview-loading {
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        color: #888;
        font-size: 0.9em;
        text-align: center;
        background: #222;
    }

    /* Video Embed Preview */
    .video-embed-preview {
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        background: #222;
    }

    .video-embed-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75em;
    }

    .video-platform {
        color: #00eaff;
        font-weight: 600;
        font-size: 0.9em;
    }

    .remove-video-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #ff6b6b;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        transition: background 0.2s ease;
    }

    .remove-video-btn:hover {
        background: rgba(255, 107, 107, 0.2);
    }

    .video-embed {
        width: 100%;
        height: 200px;
        border-radius: 0.5em;
        background: #000;
    }

    .video-placeholder {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 0.5em;
        padding: 2em;
        text-align: center;
        border: 2px dashed #555;
    }

    .video-placeholder p {
        color: #ccc;
        margin: 0 0 1em 0;
        font-size: 0.9em;
    }

    /* Content Footer */
    .content-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1em 1.2em;
        border-top: 2px solid #333;
        background: #222;
    }

    .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: 2px solid #555;
        border-radius: 50%;
        background: #333;
        color: #00eaff;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.9em;
        font-weight: 600;
    }

    .action-btn:hover {
        background: #00eaff;
        color: #000;
        border-color: #00eaff;
        transform: scale(1.05);
    }

    .action-btn.active {
        background: #00eaff;
        color: #000;
        border-color: #00eaff;
    }

    .create-btn {
        width: auto;
        padding: 0 1.5em;
        border-radius: 8px;
        background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
        color: #000;
        font-weight: 700;
        font-size: 0.95em;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.3s ease;
    }

    .create-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
    }

    .create-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    /* Button Group for Confirmation */
    .button-group {
        display: flex;
        justify-content: center;
        gap: 1em;
        margin-top: 1.5em;
    }

    .see-post-button,
    .feature-post-btn {
        padding: 0.8em 1.5em;
        border: 2px solid #00eaff;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1em;
        font-weight: 600;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .see-post-button {
        background: linear-gradient(135deg, #00eaff 0%, #0099cc 100%);
        color: #000;
    }

    .see-post-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
    }

    .feature-post-btn {
        background: #333;
        color: #00eaff;
    }

    .feature-post-btn:hover {
        background: #00eaff;
        color: #000;
    }

    /* Error and Success Messages */
    .error-message {
        color: #fff;
        background-color: #ff1744;
        border: 2px solid #ff1744;
        padding: 1em;
        border-radius: 8px;
        margin-top: 1em;
        text-align: center;
        font-size: 0.9em;
        font-weight: 600;
    }

    .success-message {
        color: #000;
        background-color: #00ff88;
        border: 2px solid #00ff88;
        padding: 1em;
        border-radius: 8px;
        margin-top: 1em;
        text-align: center;
        font-size: 0.9em;
        font-weight: 700;
    }
</style>
