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
  let hasLoaded = false;

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
    console.log('ErrorsPanel.loadData() called - hasLoaded:', hasLoaded);
    if (!hasLoaded && token && !loading) {
      loadErrors();
    } else if (hasLoaded) {
      console.log('Data already loaded, skipping');
    } else if (!token) {
      console.log('No token available for loading errors');
    } else {
      console.log('Already loading errors, skipping');
    }
  }

  async function loadErrors() {
    if (loading || hasLoaded) {
      console.log('Already loading or loaded, skipping loadErrors');
      return; // Prevent duplicate calls
    }
    
    try {
      loading = true;
      hasLoaded = true; // Mark as loaded immediately to prevent duplicates
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
      hasLoaded = false; // Reset on error to allow retry
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

      // Remove from local array instead of reloading
      errors = errors.filter(error => error.errorId !== errorId);
    } catch (err) {
      errorMsg = err.message || 'An error occurred while clearing the error';
      console.error('Error clearing system error:', err);
    }
  }

  async function clearAllErrors() {
    try {
      // Just clear them locally for now
      errors = [];
    } catch (err) {
      errorMsg = err.message || 'An error occurred while clearing all errors';
      console.error('Error clearing all system errors:', err);
    }
  }

  function resetAndReload() {
    hasLoaded = false;
    errorMsg = '';
    loadErrors();
  }

  function getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function formatTimestamp(timestamp) {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  }
</script>

<div class="errors-panel-wrapper">
  <div class="errors-header">
    <h2>System Errors</h2>
    <div class="header-actions">
      <button on:click={resetAndReload} class="btn refresh" disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
      {#if errors.length > 0}
        <button on:click={clearAllErrors} class="btn danger">Clear All</button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center py-8">
      <LoadingSpinner />
    </div>
  {:else if errorMsg}
    <div class="error-banner">
      <p class="title">Error loading system errors</p>
      <p class="msg">{errorMsg}</p>
    </div>
  {:else if errors.length === 0}
    <div class="empty-state">
      <p>No system errors found</p>
    </div>
  {:else}
    <div class="errors-table-container">
      <table class="errors-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Message</th>
            <th>User</th>
            <th>Timestamp</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each errors as error (error.errorId)}
            <tr>
              <td>
                <span class="px-2 py-1 text-xs font-medium rounded border {getSeverityColor(error.severity)}">
                  {error.severity || 'unknown'}
                </span>
              </td>
              <td class="font-medium">{error.errorType || 'Unknown Type'}</td>
              <td class="error-message-cell">
                <div class="error-message">{error.message || 'No message available'}</div>
                {#if error.metadata && Object.keys(error.metadata).length > 0}
                  <details class="mt-1">
                    <summary class="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      View metadata
                    </summary>
                    <pre class="mt-1 text-xs bg-gray-100 p-2 rounded border overflow-x-auto">{JSON.stringify(error.metadata, null, 2)}</pre>
                  </details>
                {/if}
              </td>
              <td>{error.userId || 'N/A'}</td>
              <td>{formatTimestamp(error.timestamp)}</td>
              <td class="action-cell">
                <button
                  on:click={() => clearError(error.errorId)}
                  class="action-btn delete-btn"
                  title="Clear this error"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
 </div>

<style>
  .errors-panel-wrapper { padding:16px; border:1px solid rgba(16,185,192,0.25); border-radius:16px; background:rgba(22,27,34,0.85); backdrop-filter:blur(10px); }
  .errors-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .errors-header h2 { margin:0; font-size:1.4rem; font-weight:600; color:#c9d1d9; }
  .header-actions { display:flex; gap:8px; }
  .btn { padding:6px 14px; border-radius:8px; font-size:.85rem; font-weight:500; cursor:pointer; border:1px solid rgba(16,185,192,0.35); background:rgba(16,185,192,0.15); color:#10b9c0; transition:.25s; }
  .btn:hover:not(:disabled) { background:rgba(16,185,192,0.25); }
  .btn:disabled { opacity:.5; cursor:default; }
  .btn.danger { background:rgba(239,68,68,0.18); border-color:rgba(239,68,68,0.35); color:#ff6b6b; }
  .btn.danger:hover { background:rgba(239,68,68,0.30); }
  .error-banner { background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.35); border-radius:12px; padding:14px 18px; margin-bottom:16px; }
  .error-banner .title { margin:0 0 4px 0; font-weight:600; color:#ff6b6b; font-size:.95rem; }
  .error-banner .msg { margin:0; font-size:.8rem; color:#ff9090; }
  .errors-table-container { max-height:500px; overflow-y:auto; border:1px solid rgba(16,185,192,0.2); border-radius:12px; background:rgba(13,17,23,0.65); }
  .errors-table { width:100%; border-collapse:collapse; font-size:.85rem; }
  .errors-table th, .errors-table td { padding:10px 12px; text-align:left; border-bottom:1px solid rgba(16,185,192,0.18); color:#c9d1d9; }
  .errors-table th { position:sticky; top:0; background:rgba(16,185,192,0.15); font-weight:600; font-size:.75rem; letter-spacing:.5px; text-transform:uppercase; }
  .errors-table tbody tr:hover { background:rgba(16,185,192,0.12); }
  .error-message-cell { max-width:320px; }
  .error-message { word-break:break-word; line-height:1.35; font-size:.8rem; }
  details summary { outline:none; }
  details summary { color:#8b949e; }
  details[open] summary { color:#10b9c0; }
  pre { background:rgba(22,27,34,0.9); border:1px solid rgba(16,185,192,0.25); color:#c9d1d9; }
  .action-cell { text-align:center; width:72px; }
  .action-btn { padding:6px; border:1px solid rgba(239,68,68,0.35); background:rgba(239,68,68,0.15); color:#ff6b6b; border-radius:8px; cursor:pointer; transition:.25s; }
  .action-btn:hover { background:rgba(239,68,68,0.28); }
  .empty-state { text-align:center; padding:40px 20px; color:#8b949e; font-size:.9rem; }
</style>
