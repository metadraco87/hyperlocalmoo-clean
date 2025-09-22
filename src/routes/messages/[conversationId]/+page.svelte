<script>
    import { onMount, afterUpdate } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import * as api from '$lib/api';
    import { auth } from '$lib/stores/auth';
    import MiniPostItem from '$lib/components/MiniPostItem.svelte';

    let conversationId = '';
    let recipientEmail = '';
    let recipientUsername = '';
    let recipientProfileImage = '';
    let messages = [];
    let newMessageText = '';
    let loading = true;
    let errorMessage = '';
    let currentUserEmail = null;
    let isMutualConnection = false;
    let messagesContainer;
    let sending = false;
    let postsCache = new Map(); // Cache for fetched posts

    // Auto-scroll to bottom when new messages arrive
    afterUpdate(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    onMount(async () => {
        if (!browser) return;

        conversationId = $page.params.conversationId;
        
        // Get current user info
        const authState = $auth;
        if (!authState.token || !authState.email) {
            errorMessage = 'Please log in to view messages.';
            goto('/login', { replaceState: true });
            return;
        }
        
        currentUserEmail = authState.email;

        try {
            // Parse conversation ID to get recipient email
            const participants = conversationId.split('_').map(decodeURIComponent);
            recipientEmail = participants.find(email => email !== currentUserEmail);
            
            if (!recipientEmail) {
                errorMessage = 'Invalid conversation ID or recipient could not be determined.';
                loading = false;
                return;
            }

            // Get recipient profile info
            try {
                const profileResponse = await api.getUserProfileByEmail(recipientEmail, authState.token);
                recipientUsername = profileResponse.username || recipientEmail.split('@')[0];
                recipientProfileImage = profileResponse.profileImageUrl;
            } catch (e) {
                console.warn('Could not fetch recipient profile:', e);
                recipientUsername = recipientEmail.split('@')[0];
            }

            // Check connection status
            try {
                const connectionStatus = await api.getConnectionStatus(recipientEmail, authState.token);
                isMutualConnection = connectionStatus.status === 'buddies' || connectionStatus.mutual;
                
                if (!isMutualConnection && connectionStatus.status !== 'connected') {
                    errorMessage = 'You need to be connected to message this user.';
                    loading = false;
                    return;
                }
            } catch (e) {
                console.warn('Could not check connection status:', e);
            }

            // Fetch existing messages
            await fetchMessages();
            
        } catch (err) {
            console.error('Error initializing conversation:', err);
            errorMessage = 'Error loading conversation.';
        } finally {
            loading = false;
        }
    });

    async function fetchMessages() {
        try {
            const response = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, {
                headers: { 'Authorization': `Bearer ${$auth.token}` }
            });

            if (response.ok) {
                const fetchedMessages = await response.json();
                messages = fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);
            } else {
                console.error('Error fetching messages:', response.status);
            }
        } catch (err) {
            console.error('Network error fetching messages:', err);
        }
    }

    async function handleSendMessage() {
        if (!newMessageText.trim() || sending) return;
        
        const messageToSend = newMessageText.trim();
        newMessageText = '';
        sending = true;

        console.log('Frontend: Sending message data:', {
            recipientEmail,
            messageContent: messageToSend,
            conversationId: conversationId,
            authToken: $auth.token ? 'present' : 'missing'
        });

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${$auth.token}`
                },
                body: JSON.stringify({
                    receiverEmail: recipientEmail,
                    messageContent: messageToSend,
                    conversationId: conversationId
                })
            });

            console.log('Frontend: Response status:', response.status);

            if (response.ok) {
                const sentMessage = await response.json();
                console.log('Frontend: Message sent successfully:', sentMessage);
                messages = [...messages, sentMessage.messageData];
                errorMessage = '';
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Failed to send message' }));
                console.error('Frontend: Error response:', errorData);
                errorMessage = errorData.message;
                newMessageText = messageToSend; // Restore message on error
            }
        } catch (err) {
            console.error('Frontend: Network error sending message:', err);
            errorMessage = 'Network error. Message not sent.';
            newMessageText = messageToSend; // Restore message on error
        } finally {
            sending = false;
        }
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        if (messageDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }

    // Fetch post data for mini preview
    async function getPostData(postId) {
        if (postsCache.has(postId)) {
            return postsCache.get(postId);
        }

        try {
            const response = await fetch(`/api/posts/${postId}`, {
                headers: {
                    'Authorization': `Bearer ${$auth.token}`
                }
            });

            if (response.ok) {
                const postData = await response.json();
                postsCache.set(postId, postData);
                return postData;
            }
        } catch (error) {
            console.error('Error fetching post data for preview:', error);
        }
        return null;
    }

    // Handle post preview click
    function handlePostPreviewClick(post) {
        // Navigate to the specific post page
        goto(`/posts?postId=${post.id}`);
    }
</script>

<style>
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-width: 800px;
        margin: 0 auto;
        background: white;
        border-radius: 0;
    }

    .chat-header {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 0.5rem;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
    }

    .back-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .recipient-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .recipient-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .recipient-details h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
    }

    .recipient-details .status {
        font-size: 0.85rem;
        opacity: 0.9;
    }

    .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .message {
        max-width: 70%;
        padding: 0.75rem 1rem;
        border-radius: 18px;
        position: relative;
        animation: fadeInUp 0.3s ease-out;
    }

    .message.sent {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 6px;
    }

    .message.received {
        background: white;
        color: #1f2937;
        align-self: flex-start;
        border-bottom-left-radius: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .message-content {
        margin: 0;
        line-height: 1.4;
        word-wrap: break-word;
    }

    .message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.25rem;
        text-align: right;
    }

    .message.sent .message-time {
        color: rgba(255, 255, 255, 0.8);
    }

    .message.received .message-time {
        color: #6b7280;
    }

    .input-container {
        padding: 1rem 1.5rem;
        background: white;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 0.75rem;
        align-items: flex-end;
    }

    .message-input {
        flex: 1;
        border: 2px solid #e5e7eb;
        border-radius: 24px;
        padding: 0.75rem 1rem;
        font-size: 1rem;
        resize: none;
        max-height: 120px;
        min-height: 48px;
        outline: none;
        transition: border-color 0.2s;
        font-family: inherit;
    }

    .message-input:focus {
        border-color: #4f46e5;
    }

    .send-btn {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        border: none;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
        flex-shrink: 0;
    }

    .send-btn:hover:not(:disabled) {
        transform: scale(1.05);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error-banner {
        background: #fef2f2;
        color: #dc2626;
        padding: 1rem 1.5rem;
        border-left: 4px solid #dc2626;
        margin: 1rem;
        border-radius: 0.5rem;
    }

    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        gap: 1rem;
        color: #6b7280;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        color: #6b7280;
        text-align: center;
        padding: 2rem;
    }

    .empty-state h3 {
        margin: 0 0 0.5rem 0;
        color: #374151;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Post Preview Styles */
    .post-preview-loading, .post-preview-error {
        font-size: 0.8rem;
        opacity: 0.7;
        font-style: italic;
        margin: 0.5rem 0;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
        text-align: center;
    }

    .post-preview-error {
        color: #dc2626;
    }

    @media (max-width: 768px) {
        .chat-container {
            height: 100vh;
            border-radius: 0;
        }
        
        .message {
            max-width: 85%;
        }
    }
</style>

{#if loading}
    <div class="loading-state">
        <div>💬</div>
        <p>Loading conversation...</p>
    </div>
{:else}
    <div class="chat-container">
        <!-- Chat Header -->
        <div class="chat-header">
            <button class="back-btn" on:click={() => goto('/messages')} title="Back to Messages">
                ←
            </button>
            
            <div class="recipient-info">
                <img 
                    src={recipientProfileImage || '/images/default-profile.jpg'} 
                    alt={recipientUsername}
                    class="recipient-avatar"
                    on:error={(e) => e.currentTarget.src = '/images/default-profile.jpg'}
                />
                <div class="recipient-details">
                    <h2>@{recipientUsername}</h2>
                    <div class="status">
                        {isMutualConnection ? 'Buddies' : 'Connected'}
                    </div>
                </div>
            </div>
        </div>

        <!-- Error Banner -->
        {#if errorMessage}
            <div class="error-banner">
                {errorMessage}
            </div>
        {/if}

        <!-- Messages Container -->
        <div class="messages-container" bind:this={messagesContainer}>
            {#if messages.length === 0}
                <div class="empty-state">
                    <h3>Start a conversation</h3>
                    <p>Send a message to @{recipientUsername} to get started!</p>
                </div>
            {:else}
                {#each messages as message (message.timestamp)}
                    <div class="message {message.senderEmail === currentUserEmail ? 'sent' : 'received'}">
                        <p class="message-content">{message.messageContent}</p>
                        
                        <!-- Mini Post Preview (if message contains a post) -->
                        {#if message.postId}
                            {#await getPostData(message.postId)}
                                <div class="post-preview-loading">Loading post preview...</div>
                            {:then postData}
                                {#if postData}
                                    <MiniPostItem post={postData} onEnlarge={handlePostPreviewClick} />
                                {/if}
                            {:catch error}
                                <div class="post-preview-error">Failed to load post preview</div>
                            {/await}
                        {/if}
                        
                        <div class="message-time">{formatTime(message.timestamp)}</div>
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Message Input -->
        <div class="input-container">
            <textarea
                bind:value={newMessageText}
                placeholder="Type a message..."
                class="message-input"
                on:keydown={handleKeyPress}
                disabled={sending}
                rows="1"
            ></textarea>
            <button 
                class="send-btn" 
                on:click={handleSendMessage}
                disabled={!newMessageText.trim() || sending}
                title="Send message"
            >
                {#if sending}
                    ⏳
                {:else}
                    →
                {/if}
            </button>
        </div>
    </div>
{/if}