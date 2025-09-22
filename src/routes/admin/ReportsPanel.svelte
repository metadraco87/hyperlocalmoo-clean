<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  // Mock implementation - no reports API exists yet
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  export let activeTab;

  let reports = [];
  let filteredReports = [];
  let loading = false;
  let error = '';
  let token = '';
  let loadingAttempts = 0;
  let statusFilter = 'pending'; // 'pending', 'resolved', 'all'
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
    
    if (activeTab === 'reports' && token) {
      await loadReports();
    }
  });

  $: if (activeTab === 'reports' && token && !reports.length && !loading && !error) {
    loadReports();
  }

  // Filter reports based on status
  $: {
    if (reports.length > 0) {
      if (statusFilter === 'all') {
        filteredReports = [...reports];
      } else {
        filteredReports = reports.filter(report => report.status === statusFilter);
      }
      // Sort by creation date, newest first
      filteredReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  async function loadReports() {
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

      // Call the real reports API - GET endpoint needed in backend
      console.log('Fetching reports with token:', token ? 'Token present' : 'No token');
      
      const response = await fetch('http://localhost:4000/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const responseData = await response.json();
      console.log('Reports API response:', responseData);
      
      // Reset attempts counter on success
      loadingAttempts = 0;
      
      // Check if reports is an array 
      if (Array.isArray(responseData)) {
        reports = responseData;
      } else if (responseData && Array.isArray(responseData.reports)) {
        reports = responseData.reports;
      } else {
        console.warn('API returned unexpected data format:', responseData);
        reports = [];
      }
      
      if (reports.length > 0) {
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch (err) {
      error = err.message || 'An error occurred while loading reports';
      console.error('Error loading reports:', err);
    } finally {
      loading = false;
    }
  }

  async function handleReportAction(reportId, action) {
    try {
      // Map frontend actions to backend status
      const statusMapping = {
        'resolve': 'resolved',
        'dismiss': 'deleted'
      };
      
      const status = statusMapping[action];
      if (!status) {
        throw new Error(`Unknown action: ${action}`);
      }

      // Update report status via real API - PUT endpoint needed in backend
      const response = await fetch(`http://localhost:4000/api/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status,
          adminNotes: action === 'resolve' ? 'Report resolved by admin' : 'Report dismissed by admin'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to ${action} report`);
      }

      // Refresh the reports list
      await loadReports();
    } catch (err) {
      error = err.message || `An error occurred while performing ${action}`;
      console.error(`Error ${action} report:`, err);
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
    <button on:click={() => {
      loadingAttempts = 0;
      loadReports();
    }}>Try Again</button>
  </div>
{:else if reports.length === 0}
  <div class="empty-state">
    <p>No reports found.</p>
  </div>
{:else}
  <div class="reports-container">
    <div class="reports-header">
      <h3>User Reports</h3>
      <div class="filter-buttons">
        <button 
          class="filter-btn {statusFilter === 'pending' ? 'active' : ''}"
          on:click={() => statusFilter = 'pending'}
        >
          Pending ({reports.filter(r => r.status === 'pending').length})
        </button>
        <button 
          class="filter-btn {statusFilter === 'resolved' ? 'active' : ''}"
          on:click={() => statusFilter = 'resolved'}
        >
          Resolved ({reports.filter(r => r.status === 'resolved').length})
        </button>
        <button 
          class="filter-btn {statusFilter === 'all' ? 'active' : ''}"
          on:click={() => statusFilter = 'all'}
        >
          All Reports ({reports.length})
        </button>
      </div>
    </div>
    
    {#if filteredReports.length === 0}
      <div class="empty-state">
        <p>No {statusFilter === 'all' ? '' : statusFilter} reports found.</p>
      </div>
    {:else}
      <div class="reports-list">
        {#each filteredReports as report (report.id)}
        <div class="report-card">
          <div class="report-header">
            <span class="report-id">Report #{report.id.substring(0, 8)}</span>
            <span class="report-date">{formatDate(report.createdAt)}</span>
          </div>
          <div class="report-content">
            <div class="report-meta">
              <div><strong>Post ID:</strong> {report.postId}</div>
              <div><strong>Reported by:</strong> {report.reporterId || 'Unknown'}</div>
              <div><strong>Reason:</strong> {report.reason}</div>
              <div><strong>Status:</strong> <span class="status-badge status-{report.status.toLowerCase()}">{report.status}</span></div>
            </div>
            {#if report.details}
              <div class="report-details">
                <strong>Details:</strong>
                <p>{report.details}</p>
              </div>
            {/if}
          </div>
          {#if report.status === 'pending'}
            <div class="report-actions">
              <button class="resolve-btn" on:click={() => handleReportAction(report.id, 'resolve')}>Mark as Resolved</button>
              <button class="dismiss-btn" on:click={() => handleReportAction(report.id, 'dismiss')}>Dismiss</button>
            </div>
          {/if}
        </div>
      {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .reports-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 15px 0;
    border-bottom: 2px solid #333;
  }

  .reports-header h2 {
    color: #00eaff;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .filter-buttons {
    display: flex;
    gap: 10px;
  }

  .filter-btn {
    padding: 10px 16px;
    border: 2px solid #333;
    background: #222;
    color: #ccc;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.9rem;
  }

  .filter-btn:hover {
    border-color: #555;
    background: #333;
    color: #00eaff;
  }

  .filter-btn.active {
    border-color: #00eaff;
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    font-weight: 700;
  }

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
    font-weight: 600;
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

  .reports-container {
    padding: 10px 0;
  }

  .reports-container h3 {
    font-size: 1.5rem;
    margin-bottom: 20px;
    font-weight: 600;
    color: #c9d1d9;
  }

  .reports-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .report-card {
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .report-header {
    background: rgba(16, 185, 192, 0.1);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
  }

  .report-id {
    font-weight: 600;
    color: #c9d1d9;
  }

  .report-date {
    color: #8b949e;
    font-size: 0.9rem;
  }

  .report-content {
    padding: 20px;
    color: #c9d1d9;
  }

  .report-meta {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }

  .report-details {
    border-top: 1px solid rgba(16, 185, 192, 0.2);
    padding-top: 15px;
    margin-top: 15px;
  }

  .report-details p {
    margin-top: 8px;
    color: #8b949e;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .status-pending {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .status-resolved {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .status-dismissed {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  .status-removed {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .report-actions {
    display: flex;
    gap: 10px;
    padding: 0 20px 20px;
    flex-wrap: wrap;
  }

  .report-actions button {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
  }

  .resolve-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .resolve-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .dismiss-btn {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  .dismiss-btn:hover {
    background: rgba(107, 114, 128, 0.3);
  }

  .remove-post-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .remove-post-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .ban-user-btn {
    background: rgba(127, 29, 29, 0.3);
    color: #ff4757;
    border: 1px solid rgba(127, 29, 29, 0.5);
  }

  .ban-user-btn:hover {
    background: rgba(127, 29, 29, 0.5);
  }
</style>
