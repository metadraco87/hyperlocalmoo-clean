<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { PUBLIC_API_BASE_URL } from '$env/static/public';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  let errors = [];
  let loading = false;
  let errorMsg = '';
  let token = '';

  onMount(async () => {
    // Try to get token from auth store first
    const authData = get(auth);
    token = authData?.token || '';
    
    // Fallback to localStorage if no token in store
    if (!token && browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
      console.log('Using token from localStorage:', token ? 'Found' : 'Not found');
    }
  });

  // Export a function to be called by the parent when switching to this tab
  export function loadData() {
    console.log('ErrorsPanel.loadData() called');
    if (token && !loading) {
      loadErrors();
    } else if (!token) {
      console.log('No token available for loading errors');
    } else {
      console.log('Already loading errors, skipping');
    }
  }

  function resetAndReload() {
    errorMsg = '';
    loadErrors();
  }

  async function loadErrors() {
    if (loading) {
      return; // Prevent duplicate calls
    }
    
    try {
      loading = true;
      errorMsg = '';
      
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

      console.log('Fetching system errors with token:', token ? 'Token present' : 'No token');
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/system-errors`, {
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
      console.log('System errors API response:', responseData);
      
      // Check if the response is an array
      if (Array.isArray(responseData)) {
        errors = responseData;
        if (errors.length > 0) {
          errors.sort((a, b) => b.timestamp - a.timestamp);
        }
      } else {
        console.warn('API returned unexpected data format:', responseData);
        errors = [];
      }
    } catch (err) {
      errorMsg = err.message || 'An error occurred while loading system errors';
      console.error('Error loading system errors:', err);
    } finally {
      loading = false;
    }
  }

  async function clearError(errorId) {
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/system-errors/${errorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to clear error');
      }

      // Refresh the errors list
      await loadErrors();
    } catch (err) {
      errorMsg = err.message || 'An error occurred while clearing the error';
      console.error('Error clearing system error:', err);
    }
  }

  async function clearAllErrors() {
    try {
      // Since we're using mock data, just clear them locally
      // In a real implementation, this would call the backend to clear all errors
      errors = [];
      
      // You could uncomment this when you have a real backend endpoint:
      /*
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/system-errors`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to clear all errors');
      }

      // Refresh the errors list
      await loadErrors();
      */
    } catch (err) {
      errorMsg = err.message || 'An error occurred while clearing all errors';
      console.error('Error clearing all system errors:', err);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function getSeverityClass(severity) {
    if (!severity) return 'severity-error';
    
    switch (severity.toLowerCase()) {
      case 'critical': return 'severity-critical';
      case 'error': return 'severity-error';
      case 'warning': return 'severity-warning';
      case 'info': return 'severity-info';
      default: return 'severity-error';
    }
  }
</script>

{#if loading}
  <div class="loading-container">
    <LoadingSpinner />
  </div>
{:else if errorMsg}
  <div class="error-message">
    <p>{errorMsg}</p>
    <button on:click={() => {
      loadingAttempts = 0;
      loadErrors();
    }}>Try Again</button>
  </div>
{:else if errors.length === 0}
  <div class="empty-state">
    <p>No system errors found. Everything is running smoothly!</p>
  </div>
{:else}
  <div class="errors-container">
    <div class="errors-header">
      <h3>System Errors</h3>
      <button class="clear-all-btn" on:click={clearAllErrors}>Clear All</button>
    </div>
    
    <div class="errors-list">
      {#each errors as error (error.id)}
        <div class="error-card">
          <div class="error-header">
            <div class="error-title">
              <span class="severity-badge {getSeverityClass(error.level)}">{error.level || 'ERROR'}</span>
              <span class="error-source">{error.source}</span>
            </div>
            <span class="error-timestamp">{formatDate(error.timestamp)}</span>
          </div>
          <div class="error-content">
            <div class="error-message">
              <strong>Message:</strong>
              <p>{error.message}</p>
            </div>
            {#if error.stack}
              <div class="error-stack">
                <strong>Stack Trace:</strong>
                <pre>{error.stack}</pre>
              </div>
            {/if}
            {#if error.details}
              <div class="error-details">
                <strong>Additional Details:</strong>
                <pre>{typeof error.details === 'object' ? JSON.stringify(error.details, null, 2) : error.details}</pre>
              </div>
            {/if}
          </div>
          <div class="error-actions">
            <button class="clear-btn" on:click={() => clearError(error.id)}>Mark as Resolved</button>
          </div>
        </div>
      {/each}
    </div>
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

  .errors-container {
    padding: 10px 0;
  }

  .errors-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .errors-header h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: #c9d1d9;
  }

  .clear-all-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .clear-all-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .errors-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .error-card {
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .error-header {
    background: rgba(16, 185, 192, 0.1);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
  }

  .error-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .error-source {
    font-weight: 600;
    color: #c9d1d9;
  }

  .error-timestamp {
    color: #8b949e;
    font-size: 0.9rem;
  }

  .severity-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid;
  }

  .severity-critical {
    background: rgba(185, 28, 28, 0.3);
    color: #ff4757;
    border-color: rgba(185, 28, 28, 0.5);
  }

  .severity-error {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .severity-warning {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .severity-info {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border-color: rgba(16, 185, 192, 0.3);
  }

  .error-content {
    padding: 20px;
    color: #c9d1d9;
  }

  .error-message {
    margin-bottom: 15px;
  }

  .error-message p {
    margin-top: 8px;
    color: #8b949e;
  }

  .error-stack, .error-details {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(16, 185, 192, 0.2);
  }

  .error-stack pre, .error-details pre {
    margin-top: 8px;
    background: rgba(13, 17, 23, 0.6);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 192, 0.2);
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.9rem;
    color: #8b949e;
  }

  .error-actions {
    padding: 0 20px 20px;
    display: flex;
    justify-content: flex-end;
  }

  .clear-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .clear-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }
</style>
