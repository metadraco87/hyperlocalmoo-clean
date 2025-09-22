<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  // Use local API URL for development
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  export let activeTab;

  let users = [];
  let filteredUsers = [];
  let loading = false;
  let error = '';
  let token = '';
  let searchQuery = '';
  let sortField = 'createdAt';
  let sortDirection = 'desc';
  let loadingAttempts = 0;
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
    
    if (activeTab === 'users' && token) {
      await loadUsers();
    }
  });

  $: if (activeTab === 'users' && token && !users.length && !loading && !error && loadingAttempts < MAX_LOADING_ATTEMPTS) {
    loadUsers();
  }

  // Reset attempts when switching to this tab
  $: if (activeTab === 'users') {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      loadingAttempts = 0;
    }
  }

  function resetAndReload() {
    loadingAttempts = 0;
    error = '';
    loadUsers();
  }

  $: {
    // Filter and sort users whenever these values change
    if (users.length) {
      filteredUsers = filterUsers(users, searchQuery);
      sortUsers(filteredUsers, sortField, sortDirection);
    }
  }

  async function loadUsers() {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      error = 'Maximum loading attempts reached. Please refresh the page.';
      return;
    }
    
    try {
      loading = true;
      error = '';
      loadingAttempts++;
      console.log('Fetching users with token:', token ? 'Token exists' : 'No token');

      const response = await fetch('http://localhost:4000/api/users', {
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

      const data = await response.json();
      
      // Check if data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid user data format:', data);
        throw new Error('Expected an array of users but received invalid data format');
      }
      
      users = data;
      filteredUsers = [...users];
      sortUsers(filteredUsers, sortField, sortDirection);
    } catch (err) {
      error = err.message || 'An error occurred while loading users';
      console.error('Error loading users:', err);
    } finally {
      loading = false;
    }
  }

  function filterUsers(users, query) {
    if (!query.trim()) return [...users];
    
    const lowerQuery = query.toLowerCase();
    return users.filter(user => 
      user.username?.toLowerCase().includes(lowerQuery) ||
      user.email?.toLowerCase().includes(lowerQuery) ||
      user.name?.toLowerCase().includes(lowerQuery)
    );
  }

  function sortUsers(users, field, direction) {
    users.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
      
      // Handle dates
      if (field === 'createdAt' || field === 'lastLogin') {
        valueA = new Date(valueA || 0).getTime();
        valueB = new Date(valueB || 0).getTime();
      }
      
      // Handle null/undefined values
      if (valueA === null || valueA === undefined) return direction === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return direction === 'asc' ? 1 : -1;
      
      // String comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // Number comparison
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  function toggleSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'desc';
    }
    sortUsers(filteredUsers, sortField, sortDirection);
  }

  async function toggleUserStatus(userEmail, currentStatus) {
    try {
      // User status toggle not implemented in backend yet
      throw new Error('User status toggle not yet implemented');
    } catch (err) {
      error = err.message || `An error occurred while updating user status`;
      console.error(`Error updating user status:`, err);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function getUserStatusClass(status) {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'SUSPENDED': return 'status-suspended';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
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
  <div class="users-container">
    <div class="users-header">
      <h3>User Management</h3>
      <div class="search-container">
        <input 
          type="text" 
          placeholder="Search users..." 
          bind:value={searchQuery}
          class="search-input"
        />
      </div>
    </div>
    
    {#if filteredUsers.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          <p>No users found matching '{searchQuery}'</p>
        {:else}
          <p>No users found</p>
        {/if}
      </div>
    {:else}
      <div class="users-table-container">
        <div class="table-scroll-wrapper">
          <table class="users-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th on:click={() => toggleSort('username')}>
                Username
                {#if sortField === 'username'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('email')}>
                Email
                {#if sortField === 'email'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('preferredLocationName')}>
                Location
                {#if sortField === 'preferredLocationName'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('postsCount')}>
                Posts
                {#if sortField === 'postsCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('buddyCount')}>
                Buddies
                {#if sortField === 'buddyCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('connectionCount')}>
                Connections
                {#if sortField === 'connectionCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('createdAt')}>
                Joined
                {#if sortField === 'createdAt'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('lastLogin')}>
                Last Login
                {#if sortField === 'lastLogin'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as user (user.email)}
              <tr>
                <td class="profile-cell">
                  <div class="user-avatar-container">
                    {#if user.profileImageUrl}
                      <img src={user.profileImageUrl} alt={user.username} class="user-avatar" />
                    {:else}
                      <div class="user-avatar-placeholder">
                        <span class="avatar-initials">{(user.username || user.email || '?')[0].toUpperCase()}</span>
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="username-cell">
                  <span class="username-text">{user.username || '(no username)'}</span>
                </td>
                <td>{user.email}</td>
                <td>{user.preferredLocationName || '(no location set)'}</td>
                <td>{user.postsCount || 0}</td>
                <td>{user.buddyCount || 0}</td>
                <td>{user.connectionCount || 0}</td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(user.lastLogin || user.lastLoggedIn)}</td>
                <td class="actions-cell">
                  <button 
                    class="action-btn {(user.status || 'ACTIVE') === 'ACTIVE' ? 'suspend-btn' : 'activate-btn'}"
                    on:click={() => toggleUserStatus(user.email, user.status || 'ACTIVE')}
                  >
                    {(user.status || 'ACTIVE') === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
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

  .users-container {
    padding: 10px 0;
  }

  .users-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .users-header h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: #c9d1d9;
  }

  .search-container {
    width: 300px;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    font-size: 1rem;
    background: rgba(13, 17, 23, 0.8);
    color: #c9d1d9;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(16, 185, 192, 0.5);
    box-shadow: 0 0 0 2px rgba(16, 185, 192, 0.2);
  }

  .search-input::placeholder {
    color: #8b949e;
  }

  .users-table-container {
    position: relative;
  }

  .table-scroll-wrapper {
    overflow-x: auto;
    border-radius: 16px;
    border: 1px solid rgba(16, 185, 192, 0.2);
    background: rgba(22, 27, 34, 0.8);
    backdrop-filter: blur(10px);
  }

  .users-table {
    width: 100%;
    min-width: 1000px; /* Ensure table doesn't shrink too much */
    border-collapse: collapse;
    background: transparent;
    border: none;
  }

  .users-table th, .users-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
    color: #c9d1d9;
  }

  .users-table th {
    background: rgba(16, 185, 192, 0.1);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .users-table th:hover {
    background: rgba(16, 185, 192, 0.2);
  }

  .sort-indicator {
    margin-left: 4px;
    font-weight: bold;
    color: #10b9c0;
  }

  .profile-cell {
    min-width: 60px;
    text-align: center;
  }

  .user-avatar-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .username-cell {
    min-width: 150px;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    object-fit: cover;
    border: 2px solid rgba(16, 185, 192, 0.3);
    flex-shrink: 0;
  }

  .user-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(16, 185, 192, 0.3), rgba(16, 185, 192, 0.5));
    border: 2px solid rgba(16, 185, 192, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-initials {
    font-size: 14px;
    font-weight: 600;
    color: #10b9c0;
  }

  .username-text {
    font-weight: 500;
    color: #c9d1d9;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid;
  }

  .status-active {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .status-suspended {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .status-pending {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .actions-cell {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid;
  }

  .suspend-btn {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .suspend-btn:hover {
    background: rgba(251, 191, 36, 0.3);
  }

  .activate-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .activate-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #ff4757;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }
</style>
