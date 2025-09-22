<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  // Mock implementation - no help-messages API exists yet
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  export let activeTab;

  let messages = [];
  let filteredMessages = [];
  let loading = false;
  let error = '';
  let token = '';
  let loadingAttempts = 0;
  let currentFilter = 'unread'; // For the filter buttons - default to show unread
  const MAX_LOADING_ATTEMPTS = 3;

  onMount(async () => {
    // Try to get token from auth store first
    const authData = get(auth);
    token = authData?.token || '';
    
    // Fallback to localStorage if no token in store
    if (!token && browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
      console.log('Using token from localStorage:', token ? 'Found' : 'Not found');
    }
    
    if (activeTab === 'messages' && token) {
      await loadMessages();
    }
  });

  $: if (activeTab === 'messages' && token && !messages.length && !loading && !error && loadingAttempts < MAX_LOADING_ATTEMPTS) {
    loadMessages();
  }

  // Reset attempts when switching to this tab
  $: if (activeTab === 'messages') {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      loadingAttempts = 0;
    }
  }

  function resetAndReload() {
    loadingAttempts = 0;
    error = '';
    loadMessages();
  }

  async function loadMessages() {
    // Check max attempts to prevent infinite loops
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      console.error('Maximum loading attempts reached, stopping to prevent infinite loop');
      error = 'Too many failed attempts. Please refresh the page and try again.';
      return;
    }
    
    loadingAttempts++;
    
    try {
      loading = true;
      error = '';
      
      if (!token) {
        // Try to get token again in case it was set after component mounted
        const authData = get(auth);
        token = authData?.token || '';
        
        // Fallback to localStorage
        if (!token && browser && localStorage.getItem('token')) {
          token = localStorage.getItem('token');
        }
        
        if (!token) {
          throw new Error('No authentication token available');
        }
      }

      // Call the real help messages API - GET endpoint needed in backend
      console.log('Fetching help messages with token:', token ? 'Token present' : 'No token');
      
      const response = await fetch('http://localhost:4000/api/help-messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Try to get error message from response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const responseData = await response.json();
      console.log('Help messages API response:', responseData);
      
      // Reset attempts counter on success
      loadingAttempts = 0;
      
      // Check if the response is an array
      if (Array.isArray(responseData)) {
        messages = responseData;
      } else if (responseData && Array.isArray(responseData.messages)) {
        messages = responseData.messages;
      } else {
        console.warn('API returned unexpected data format:', responseData);
        messages = [];
      }
      
      if (messages.length > 0) {
        messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch (err) {
      error = err.message || 'An error occurred while loading help messages';
      console.error('Error loading help messages:', err);
    } finally {
      loading = false;
    }
  }

  async function handleMessageAction(messageId, action) {
    try {
      // Map frontend actions to backend status
      const statusMapping = {
        'resolve': 'read',
        'read': 'read',
        'contact': 'responded',
        'markRead': 'read',
        'markUnread': 'unread'
      };
      
      const status = statusMapping[action];
      if (!status) {
        throw new Error(`Unknown action: ${action}`);
      }

      // Update message status via real API - PUT endpoint needed in backend
      const response = await fetch(`http://localhost:4000/api/help-messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status,
          response: action === 'resolve' || action === 'read' || action === 'markRead' ? 'Message marked as resolved by admin' : undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to ${action} message`);
      }

      // Refresh the messages list
      await loadMessages();
    } catch (err) {
      error = err.message || `An error occurred while performing ${action}`;
      console.error(`Error ${action} message:`, err);
    }
  }

  function setFilter(filter) {
    currentFilter = filter;
  }

  // Update the filteredMessages based on the current filter
  $: {
    if (messages.length > 0) {
      filteredMessages = messages.filter(message => message.status === currentFilter);
      // Sort by creation date, newest first
      filteredMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }
</script>

{#if loading}
  <div class="loading-container">
    <LoadingSpinner />
  </div>
{:else if error}
  <div class="error-message">
    <p>{error}</p>
    <button on:click={resetAndReload}>Try Again</button>
  </div>
{:else}
  <div class="messages-container">
    <div class="messages-header">
      <h3>Help & Feedback Messages</h3>
      <div class="status-filters">
        <button 
          class="filter-btn {currentFilter === 'unread' ? 'active' : ''}" 
          on:click={() => setFilter('unread')}
        >
          Unread ({messages.filter(m => m.status === 'unread').length})
        </button>
        <button 
          class="filter-btn {currentFilter === 'read' ? 'active' : ''}" 
          on:click={() => setFilter('read')}
        >
          Resolved ({messages.filter(m => m.status === 'read').length})
        </button>
      </div>
    </div>
    
    {#if messages.length === 0}
      <div class="empty-state">
        <p>No help messages found.</p>
      </div>
    {:else if filteredMessages.length === 0}
      <div class="empty-state">
        <p>No {currentFilter.toLowerCase()} messages found.</p>
      </div>
    {:else}
      <div class="messages-list">
      {#each filteredMessages as message (message.id)}
        <div class="message-card">
          <div class="message-header">
            <span class="message-id">Message #{message.id.substring(0, 8)}</span>
            <span class="message-date">{formatDate(message.createdAt)}</span>
          </div>
          <div class="message-content">
            <div class="message-meta">
              <div><strong>From:</strong> {message.userId}</div>
              <div><strong>Status:</strong> <span class="status-badge status-{message.status.toLowerCase()}">{message.status}</span></div>
            </div>
            <div class="message-details">
              <strong>Message:</strong>
              <p>{message.message}</p>
            </div>
            {#if message.screenshotUrl}
              <div class="message-screenshot">
                <strong>Screenshot:</strong>
                <div class="screenshot-container">
                  <img src={message.screenshotUrl} alt="Screenshot" />
                </div>
              </div>
            {/if}
          </div>
          {#if message.status === 'unread'}
            <div class="message-actions">
              <button class="mark-resolved-btn" on:click={() => handleMessageAction(message.id, 'resolve')}>Mark as Resolved</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {/if}
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    margin: 20px 0;
    text-align: center;
  }

  .error-message button {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    margin-top: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .error-message button:hover {
    background: rgba(16, 185, 192, 0.3);
  }

  .empty-state {
    text-align: center;
    color: #8b949e;
    padding: 40px 0;
  }

  .messages-container {
    padding: 10px 0;
  }

  .messages-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 15px;
  }

  .messages-container h3 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 600;
    color: #c9d1d9;
  }

  .status-filters {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 8px 16px;
    border: 1px solid rgba(16, 185, 192, 0.3);
    background: rgba(22, 27, 34, 0.8);
    color: #8b949e;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s ease;
    font-size: 0.9rem;
  }

  .filter-btn:hover {
    border-color: rgba(16, 185, 192, 0.5);
    color: #10b9c0;
  }

  .filter-btn.active {
    background: rgba(16, 185, 192, 0.2);
    border-color: rgba(16, 185, 192, 0.5);
    color: #10b9c0;
  }

  .mark-all-read-btn {
    padding: 8px 16px;
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
  }

  .mark-all-read-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .message-card {
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .message-header {
    background: rgba(16, 185, 192, 0.1);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
  }

  .message-id {
    font-weight: 600;
    color: #c9d1d9;
  }

  .message-date {
    color: #8b949e;
    font-size: 0.9rem;
  }

  .message-content {
    padding: 20px;
    color: #c9d1d9;
  }

  .message-meta {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }

  .message-details {
    margin-top: 15px;
  }

  .message-details p {
    margin-top: 8px;
    color: #8b949e;
    white-space: pre-line;
  }

  .message-screenshot {
    margin-top: 20px;
  }

  .screenshot-container {
    margin-top: 10px;
    max-width: 100%;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 192, 0.2);
  }

  .screenshot-container img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid;
  }

  .status-pending {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .status-resolved {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .status-contacted {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border-color: rgba(16, 185, 192, 0.3);
  }

  .message-actions {
    display: flex;
    gap: 10px;
    padding: 0 20px 20px;
  }

  .message-actions button {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
  }

  .mark-read-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .mark-read-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .mark-resolved-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .mark-resolved-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .resolve-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .resolve-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .contact-btn {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border: 1px solid rgba(16, 185, 192, 0.3);
  }

  .contact-btn:hover {
    background: rgba(16, 185, 192, 0.3);
  }
</style>
