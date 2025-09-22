<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  import { cachedFetch, clearCache } from '$lib/cache';
  import { auth } from '$lib/stores/auth';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { fetchPostById } from '$lib/api';
  import MiniPostItem from '$lib/components/MiniPostItem.svelte';

  // Props
  export let conversation: any = null;
  export let onClose: () => void = () => {};

  // Derived values from conversation prop
  $: show = !!conversation;
  $: conversationId = conversation?.conversationId || null;
  $: otherParticipantUsername = conversation?.otherParticipantUsername || '';
  $: otherParticipantEmail = conversation?.otherParticipantEmail || '';
  $: otherParticipantProfileImage = conversation?.otherParticipantProfileImage || '/images/default-profile.jpg';

  // State
  let messages = [];
  let newMessage = '';
  let loading = true;
  let error = '';
  let sending = false;
  let currentUserEmail = '';
  let authToken = '';
  let currentProfileImage = '';
  let otherParticipantShowEmail = true; // Default to true, will be updated from profile

  // Update profile image when conversation changes
  $: if (conversation) {
    currentProfileImage = conversation.otherParticipantProfileImage;
    fetchCurrentProfileImage();
    fetchOtherParticipantProfile();
  }

  const dispatch = createEventDispatcher();

  // Initialize auth data
  onMount(async () => {
    const authState = get(auth);
    authToken = authState.token;
    currentUserEmail = authState.email;
    console.log('MessagesOverlay: Auth initialized - currentUserEmail:', currentUserEmail);
  });

  // Reactive statement to load messages when conversation changes AND auth is ready
  $: if (show && conversationId && currentUserEmail && authToken) {
    console.log('MessagesOverlay: Conversation changed, loading messages for:', conversationId);
    loadMessages();
    markMessagesAsRead();
  }

  async function fetchCurrentProfileImage() {
    if (!otherParticipantUsername || !authToken) return;
    
    try {
      // Use username endpoint instead of email for security
      const profileResponse = await cachedFetch(`/api/users/${encodeURIComponent(otherParticipantUsername)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }, authToken);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        currentProfileImage = profileData.profileImageUrl || '/images/default-profile.jpg';
      }
    } catch (err) {
      console.log('MessagesOverlay: Could not fetch updated profile image:', err);
      // Keep using the existing profile image
    }
  }

  async function fetchOtherParticipantProfile() {
    if (!otherParticipantEmail || !authToken) return;
    
    try {
      const profileResponse = await cachedFetch(`/api/profile/${encodeURIComponent(otherParticipantEmail)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }, authToken);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        otherParticipantShowEmail = profileData.showEmail !== false; // Default to true if not specified
        console.log('MessagesOverlay: Other participant showEmail setting:', otherParticipantShowEmail);
      }
    } catch (err) {
      console.log('MessagesOverlay: Could not fetch other participant profile:', err);
      // Keep default value of true
    }
  }

  async function markMessagesAsRead() {
    if (!conversationId || !authToken) return;
    
    try {
      await fetch(`/api/messages/read/${encodeURIComponent(conversationId)}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('MessagesOverlay: Marked messages as read for conversation:', conversationId);
    } catch (err) {
      console.error('MessagesOverlay: Error marking messages as read:', err);
    }
  }

  async function loadMessages() {
    if (!conversationId || !authToken) return;
    
    loading = true;
    error = '';
    
    console.log('MessagesOverlay: Starting to load messages for conversation:', conversationId);
    
    try {
      // Clear cache to ensure fresh data
      clearCache(authToken + '/api/messages');
      
      const response = await fetch('/api/messages', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const allMessages = await response.json();
        console.log('MessagesOverlay: All messages received:', allMessages.length);
        console.log('MessagesOverlay: Looking for conversationId:', conversationId);
        console.log('MessagesOverlay: Other participant email:', otherParticipantEmail);
        console.log('MessagesOverlay: Current user email:', currentUserEmail);
        
        // Filter messages for this conversation using multiple matching strategies
        messages = allMessages.filter(msg => {
          // Strategy 1: Direct conversationId match
          if (msg.conversationId === conversationId) {
            console.log('MessagesOverlay: Found message with direct conversationId match:', msg);
            return true;
          }
          
          // Strategy 2: Match based on participant emails
          const isFromConversation = (
            (msg.senderEmail === currentUserEmail && msg.receiverEmail === otherParticipantEmail) ||
            (msg.senderEmail === otherParticipantEmail && msg.receiverEmail === currentUserEmail)
          );
          
          if (isFromConversation) {
            console.log('MessagesOverlay: Found message with participant email match:', msg);
            return true;
          }
          
          // Strategy 3: Generated conversationId match (fallback)
          const msgConversationId = [msg.senderEmail, msg.receiverEmail].sort().join('_');
          const expectedConversationId = [currentUserEmail, otherParticipantEmail].sort().join('_');
          
          if (msgConversationId === conversationId || msgConversationId === expectedConversationId) {
            console.log('MessagesOverlay: Found message with generated conversationId match:', msg);
            return true;
          }
          
          return false;
        }).sort((a, b) => a.timestamp - b.timestamp);
        
        console.log('MessagesOverlay: Filtered messages:', messages.length);
        console.log('MessagesOverlay: Filtered messages:', messages);
        
      } else {
        error = 'Failed to load messages';
        console.error('MessagesOverlay: Failed to load messages, status:', response.status);
      }
    } catch (err) {
      console.error('MessagesOverlay: Error loading messages:', err);
      error = 'Network error loading messages';
    } finally {
      loading = false;
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || sending || !authToken) return;
    
    sending = true;
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          receiverEmail: otherParticipantEmail,
          messageContent: newMessage.trim()
        })
      });
      
      if (response.ok) {
        newMessage = '';
        // Clear cache to ensure fresh data
        clearCache(authToken + '/api/messages');
        await loadMessages(); // Refresh messages
        // Dispatch event to refresh conversations in parent component
        dispatch('messagesSent', { conversationId });
      } else {
        error = 'Failed to send message';
      }
    } catch (err) {
      console.error('Error sending message:', err);
      error = 'Network error sending message';
    } finally {
      sending = false;
    }
  }

  // Function to get post data for mini preview
  async function getPostData(postId) {
    if (!postId || !authToken) {
      return null;
    }
    
    try {
      const data = await fetchPostById(postId, authToken);
      return data;
    } catch (error) {
      console.error('Error fetching post data for preview:', error);
      return null;
    }
  }

  // Handle post preview click
  function handlePostPreviewClick(post) {
    // Navigate to the specific post page
    goto(`/posts?postId=${post.id}`);
  }

  function closeOverlay() {
    onClose();
    // Dispatch event to refresh conversations count
    dispatch('messagesRead', { conversationId });
  }

  function handleUsernameClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (otherParticipantUsername && otherParticipantUsername.length > 0) {
      goto(`/profile/${encodeURIComponent(otherParticipantUsername)}`);
    } else {
      goto('/profile');
    }
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function handleKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

{#if show}
  <div class="overlay-backdrop" on:click={closeOverlay} transition:fade={{ duration: 300 }}>
    <div class="messages-overlay" on:click|stopPropagation transition:fly={{ y: 50, duration: 400 }}>
      <!-- Header -->
      <div class="overlay-header">
        <div class="participant-info">
          <img src={currentProfileImage || otherParticipantProfileImage} alt={otherParticipantUsername} class="participant-avatar" on:click={handleUsernameClick} style="cursor: pointer;" />
          <div class="participant-details">
            <a href={`/profile/${encodeURIComponent(otherParticipantUsername)}`} on:click|preventDefault={handleUsernameClick} class="participant-name clickable-username">{otherParticipantUsername}</a>
            {#if otherParticipantShowEmail}
              <span class="participant-email">{otherParticipantEmail}</span>
            {/if}
          </div>
        </div>
        <button class="close-btn" on:click={closeOverlay}>
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Messages Area -->
      <div class="messages-area">
        {#if loading}
          <div class="loading-state">
            <p>Loading messages...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <p>{error}</p>
            <button on:click={loadMessages} class="retry-btn">Retry</button>
          </div>
        {:else if messages.length === 0}
          <div class="empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        {:else}
          <div class="messages-list">
            {#each messages as message}
              <div class="message-item" class:own-message={message.senderEmail === currentUserEmail}>
                <div class="message-content">{message.messageContent}</div>
                
                <!-- Mini Post Preview (if message contains a post) -->
                {#if message.postId}
                  {#await getPostData(message.postId)}
                    <div class="post-preview-loading">Loading post preview...</div>
                  {:then postData}
                    {#if postData}
                      <MiniPostItem post={postData} onEnlarge={handlePostPreviewClick} />
                    {:else}
                      <div class="post-preview-error">Post not found (ID: {message.postId})</div>
                    {/if}
                  {:catch error}
                    <div class="post-preview-error">Failed to load post preview: {error}</div>
                  {/await}
                {/if}
                
                <div class="message-time">{formatTimestamp(message.timestamp)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-container">
          <textarea
            bind:value={newMessage}
            on:keypress={handleKeypress}
            placeholder="Type your message..."
            class="message-input"
            rows="3"
            disabled={sending}
          ></textarea>
          <button 
            on:click={sendMessage} 
            class="send-btn"
            disabled={!newMessage.trim() || sending}
          >
            {#if sending}
              Sending...
            {:else}
              Send
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .messages-overlay {
    background-color: #00000077;
    border-radius: 12px;
    box-shadow: 0 0 20px #00eaff;
    border: 1px solid #00eaff;
    width: 90%;
    max-width: 800px;
    height: 80vh;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #fff;
  }

  .overlay-header {
    padding: 20px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #111;
  }

  .participant-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    object-fit: cover;
    border: 2px solid #00eaff;
  }

  .participant-details {
    display: flex;
    flex-direction: column;
  }

  .participant-name {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #00eaff;
  }

  .clickable-username {
    text-decoration: none;
    color: #00eaff;
    cursor: pointer;
    transition: color 0.3s ease;
  }

  .clickable-username:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  .participant-email {
    font-size: 0.8rem;
    color: #aaa;
  }

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: #333;
  }

  .messages-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-state,
  .error-state,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #aaa;
    text-align: center;
    padding: 40px;
  }

  .retry-btn {
    margin-top: 12px;
    padding: 8px 16px;
    background: #00eaff;
    color: #000;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }

  .retry-btn:hover {
    background: #00ccdd;
  }

  .messages-list {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message-item {
    display: flex;
    flex-direction: column;
    max-width: 70%;
    align-self: flex-start;
  }

  .message-item.own-message {
    align-self: flex-end;
  }

  .message-content {
    background-color: #333;
    padding: 12px 16px;
    border-radius: 12px;
    word-wrap: break-word;
    line-height: 1.4;
  }

  .message-item.own-message .message-content {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
  }

  .message-time {
    font-size: 0.7rem;
    color: #888;
    margin-top: 4px;
    align-self: flex-end;
  }

  .message-item.own-message .message-time {
    align-self: flex-start;
  }

  .input-area {
    border-top: 1px solid #333;
    padding: 20px;
    background-color: #111;
  }

  .input-container {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .message-input {
    flex: 1;
    background-color: #222;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 12px;
    color: #fff;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
  }

  .message-input:focus {
    outline: none;
    border-color: #00eaff;
    box-shadow: 0 0 0 1px #00eaff;
  }

  .message-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .send-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 234, 255, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Scrollbar styling */
  .messages-list::-webkit-scrollbar {
    width: 6px;
  }

  .messages-list::-webkit-scrollbar-track {
    background: #222;
  }

  .messages-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .messages-list::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .messages-overlay {
      width: 95%;
      height: 90vh;
    }

    .overlay-header {
      padding: 15px;
    }

    .participant-name {
      font-size: 1rem;
    }

    .input-area {
      padding: 15px;
    }

    .message-item {
      max-width: 85%;
    }
  }

  /* Post preview styles */
  .post-preview-loading,
  .post-preview-error {
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-radius: 6px;
    font-size: 0.85rem;
    text-align: center;
  }

  .post-preview-loading {
    background: #333;
    color: #ccc;
  }

  .post-preview-error {
    background: #552;
    color: #fcc;
  }
</style>
