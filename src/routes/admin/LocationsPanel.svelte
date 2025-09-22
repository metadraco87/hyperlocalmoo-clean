<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  // Use local API URL for development
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  export let activeTab;

  let locations = [];
  let filteredLocations = [];
  let loading = false;
  let error = '';
  let token = '';
  let searchQuery = '';
  let sortField = 'name';
  let sortDirection = 'asc';
  let loadingAttempts = 0;
  const MAX_LOADING_ATTEMPTS = 3;
  let showLocationDetails = false;
  let selectedLocation = null;
  let locationPosts = [];
  let locationUsers = [];
  let loadingLocationDetails = false;
  let showUsersModal = false;
  let modalUsers = [];
  let loadingModalUsers = false;

  onMount(async () => {
    // Try to get token from auth store first
    const authData = get(auth);
    token = authData?.token || '';
    
    // Fallback to localStorage if no token in store
    if (!token && browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
      console.log('Using token from localStorage:', token ? 'Found' : 'Not found');
    }
    
    if (activeTab === 'locations' && token) {
      await loadLocations();
    }
  });

  $: if (activeTab === 'locations' && token && !locations.length && !loading && !error && loadingAttempts < MAX_LOADING_ATTEMPTS) {
    loadLocations();
  }

  // Reset attempts when switching to this tab
  $: if (activeTab === 'locations') {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      loadingAttempts = 0;
    }
  }

  function resetAndReload() {
    loadingAttempts = 0;
    error = '';
    loadLocations();
  }

  $: {
    // Filter and sort locations whenever these values change
    if (locations.length) {
      filteredLocations = filterLocations(locations, searchQuery);
      sortLocations(filteredLocations, sortField, sortDirection);
    }
  }

  async function loadLocations() {
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      error = 'Maximum loading attempts reached. Please refresh the page.';
      return;
    }
    
    try {
      loading = true;
      error = '';
      loadingAttempts++;
      console.log('Generating location data from posts and users...');

      // Fetch posts to get location data
      const postsResponse = await fetch('http://localhost:4000/api/posts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Fetch users to get user location data
      const usersResponse = await fetch('http://localhost:4000/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let posts = [];
      let users = [];

      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        posts = Array.isArray(postsData) ? postsData : (postsData.posts || []);
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        users = Array.isArray(usersData) ? usersData : [];
      }

      // Generate location statistics from posts and users
      const locationStats = {};
      
      // Count posts per location
      posts.forEach(post => {
        const location = post.locationName || post.location || 'Unknown Location';
        if (!locationStats[location]) {
          locationStats[location] = { name: location, postsCount: 0, userCount: 0, users: new Set() };
        }
        locationStats[location].postsCount++;
        if (post.userEmail) {
          locationStats[location].users.add(post.userEmail);
        }
      });

      // Count users per location
      users.forEach(user => {
        const location = user.preferredLocationName || user.locationName || 'Unknown Location';
        if (!locationStats[location]) {
          locationStats[location] = { name: location, postsCount: 0, userCount: 0, users: new Set() };
        }
        locationStats[location].users.add(user.email);
      });

      // Convert to array and calculate user counts
      locations = Object.values(locationStats).map(stat => ({
        name: stat.name,
        postsCount: stat.postsCount,
        userCount: stat.users.size
      })).filter(location => location.name !== 'Unknown Location');

      filteredLocations = [...locations];
      sortLocations(filteredLocations, sortField, sortDirection);
    } catch (err) {
      error = err.message || 'An error occurred while loading locations';
      console.error('Error loading locations:', err);
    } finally {
      loading = false;
    }
  }

  function filterLocations(locations, query) {
    if (!query.trim()) return [...locations];
    
    const lowerQuery = query.toLowerCase();
    return locations.filter(location => 
      location.name?.toLowerCase().includes(lowerQuery) ||
      location.description?.toLowerCase().includes(lowerQuery) ||
      location.city?.toLowerCase().includes(lowerQuery) ||
      location.country?.toLowerCase().includes(lowerQuery)
    );
  }

  function sortLocations(locations, field, direction) {
    locations.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
      
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
      sortDirection = 'asc';
    }
    sortLocations(filteredLocations, sortField, sortDirection);
  }

  async function toggleLocationVisibility(locationName, currentVisibility) {
    try {
      const newVisibility = !currentVisibility;
      
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/locations/${encodeURIComponent(locationName)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ visible: newVisibility })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to update location visibility`);
      }

      // Update the local state
      const locationIndex = locations.findIndex(l => l.name === locationName);
      if (locationIndex !== -1) {
        locations[locationIndex].visible = newVisibility;
        filteredLocations = filterLocations(locations, searchQuery);
      }
    } catch (err) {
      error = err.message || `An error occurred while updating location visibility`;
      console.error(`Error updating location visibility:`, err);
    }
  }

  async function showLocationDetailsModal(location) {
    selectedLocation = location;
    showLocationDetails = true;
    loadingLocationDetails = true;
    
    try {
      // Fetch posts for this location
      const postsResponse = await fetch(`http://localhost:4000/api/posts?location=${encodeURIComponent(location.name)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        locationPosts = postsData.posts || postsData || [];
      } else {
        locationPosts = [];
      }
      
      // Fetch users for this location  
      const usersResponse = await fetch(`http://localhost:4000/api/users?location=${encodeURIComponent(location.name)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        locationUsers = usersData || [];
      } else {
        locationUsers = [];
      }
    } catch (err) {
      console.error('Error loading location details:', err);
      locationPosts = [];
      locationUsers = [];
    } finally {
      loadingLocationDetails = false;
    }
  }

  function closeLocationDetails() {
    showLocationDetails = false;
    selectedLocation = null;
    locationPosts = [];
    locationUsers = [];
  }

  async function showLocationUsers(location) {
    try {
      loadingModalUsers = true;
      selectedLocation = location;
      
      const response = await fetch(`http://localhost:4000/api/users?location=${encodeURIComponent(location.name)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        modalUsers = usersData || [];
        showUsersModal = true;
      } else {
        error = 'Failed to load users for this location';
        modalUsers = [];
      }
    } catch (err) {
      console.error('Error loading location users:', err);
      error = err.message || 'Failed to load users';
      modalUsers = [];
    } finally {
      loadingModalUsers = false;
    }
  }

  function closeUsersModal() {
    showUsersModal = false;
    modalUsers = [];
    selectedLocation = null;
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
  <div class="locations-container">
    <div class="locations-header">
      <h3>Locations Management</h3>
      <div class="search-container">
        <input 
          type="text" 
          placeholder="Search locations..." 
          bind:value={searchQuery}
          class="search-input"
        />
      </div>
    </div>
    
    {#if filteredLocations.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          <p>No locations found matching '{searchQuery}'</p>
        {:else}
          <p>No locations found</p>
        {/if}
      </div>
    {:else}
      <div class="locations-table-container">
        <table class="locations-table">
          <thead>
            <tr>
              <th on:click={() => toggleSort('name')}>
                Name
                {#if sortField === 'name'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('userCount')}>
                Users
                {#if sortField === 'userCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th on:click={() => toggleSort('postsCount')}>
                Posts
                {#if sortField === 'postsCount'}
                  <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredLocations as location (location.name)}
              <tr>
                <td>{location.name}</td>
                <td class="users-count-cell">
                  <button 
                    class="users-count-btn"
                    on:click={() => showLocationUsers(location)}
                    disabled={!location.userCount || location.userCount === 0}
                  >
                    {location.userCount || 0}
                  </button>
                </td>
                <td>{location.postsCount || 0}</td>
                <td class="actions-cell">
                  <button 
                    class="action-btn view-btn"
                    on:click={() => window.open(`/posts?location=${encodeURIComponent(location.name)}`, '_blank')}
                  >
                    Go to Location
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}

<!-- Location Details Modal -->
{#if showLocationDetails}
  <div class="modal-overlay" on:click={closeLocationDetails}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Location Details: {selectedLocation?.name}</h2>
        <button class="close-btn" on:click={closeLocationDetails}>×</button>
      </div>
      
      <div class="modal-body">
        {#if loadingLocationDetails}
          <div class="modal-loading">
            <LoadingSpinner />
          </div>
        {:else}
          <div class="location-stats">
            <div class="stat-card">
              <h3>Posts</h3>
              <div class="stat-number">{locationPosts.length}</div>
            </div>
            <div class="stat-card">
              <h3>Users</h3>
              <div class="stat-number">{selectedLocation?.userCount || 0}</div>
            </div>
          </div>
          
          <div class="location-section">
            <h3>Recent Posts</h3>
            {#if locationPosts.length > 0}
              <div class="posts-list">
                {#each locationPosts.slice(0, 5) as post}
                  <div class="post-item">
                    <div class="post-header">
                      <span class="post-author">{post.username}</span>
                      <span class="post-date">{new Date(post.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div class="post-content">{post.content?.substring(0, 100)}...</div>
                  </div>
                {/each}
              </div>
              {#if locationPosts.length > 5}
                <p class="more-posts">And {locationPosts.length - 5} more posts...</p>
              {/if}
            {:else}
              <p class="no-data">No posts found for this location.</p>
            {/if}
          </div>
          
          <div class="modal-actions">
            <button class="action-btn view-posts-btn" on:click={() => window.open(`/posts?location=${encodeURIComponent(selectedLocation.name)}`, '_blank')}>
              View All Posts
            </button>
            <button class="action-btn close-modal-btn" on:click={closeLocationDetails}>
              Close
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Users Modal -->
{#if showUsersModal}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={closeUsersModal} on:keydown={(e) => e.key === 'Escape' && closeUsersModal()}>
    <div class="modal-content users-modal" role="document" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeUsersModal()}>
      <div class="modal-header">
        <h2>Users in {selectedLocation?.name}</h2>
        <button class="close-btn" on:click={closeUsersModal}>×</button>
      </div>
      <div class="modal-body">
        {#if loadingModalUsers}
          <div class="modal-loading">
            <LoadingSpinner />
          </div>
        {:else if modalUsers.length === 0}
          <div class="no-data">
            <p>No users found in this location.</p>
          </div>
        {:else}
          <div class="users-grid">
            {#each modalUsers as user}
              <div class="user-card">
                <div class="user-avatar-section">
                  {#if user.profileImageUrl}
                    <img src={user.profileImageUrl} alt={user.username} class="modal-user-avatar" />
                  {:else}
                    <div class="modal-user-avatar-placeholder">
                      <span class="modal-avatar-initials">{(user.username || user.email || '?')[0].toUpperCase()}</span>
                    </div>
                  {/if}
                </div>
                <div class="user-info">
                  <h4 class="user-username">{user.username || '(no username)'}</h4>
                  <p class="user-email">{user.email}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
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

  .locations-container {
    padding: 10px 0;
  }

  .locations-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .locations-header h3 {
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

  .locations-table-container {
    overflow-x: auto;
  }

  .locations-table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .locations-table th, .locations-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
    color: #c9d1d9;
  }

  .locations-table th {
    background: rgba(16, 185, 192, 0.1);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .locations-table th:hover {
    background: rgba(16, 185, 192, 0.2);
  }

  .sort-indicator {
    margin-left: 4px;
    font-weight: bold;
    color: #10b9c0;
  }

  .visibility-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid;
  }

  .visible {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .hidden {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border-color: rgba(107, 114, 128, 0.3);
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

  .hide-btn {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border-color: rgba(107, 114, 128, 0.3);
  }

  .hide-btn:hover {
    background: rgba(107, 114, 128, 0.3);
  }

  .show-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .show-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .view-btn {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border-color: rgba(16, 185, 192, 0.3);
  }

  .view-btn:hover {
    background: rgba(16, 185, 192, 0.3);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .modal-content {
    background: rgba(22, 27, 34, 0.95);
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 16px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    backdrop-filter: blur(10px);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid rgba(16, 185, 192, 0.2);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #c9d1d9;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #8b949e;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.3s ease;
  }

  .close-btn:hover {
    color: #c9d1d9;
  }

  .modal-body {
    padding: 20px;
    color: #c9d1d9;
  }

  .modal-loading {
    display: flex;
    justify-content: center;
    padding: 40px;
  }

  .location-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    flex: 1;
    background: rgba(16, 185, 192, 0.1);
    border: 1px solid rgba(16, 185, 192, 0.2);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
  }

  .stat-card h3 {
    margin: 0 0 10px 0;
    font-size: 1rem;
    color: #8b949e;
    font-weight: 500;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: #10b9c0;
  }

  .location-section {
    margin-bottom: 30px;
  }

  .location-section h3 {
    margin: 0 0 15px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #c9d1d9;
  }

  .posts-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .post-item {
    background: rgba(16, 185, 192, 0.1);
    border: 1px solid rgba(16, 185, 192, 0.2);
    padding: 15px;
    border-radius: 12px;
    border-left: 3px solid #10b9c0;
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .post-author {
    font-weight: 600;
    color: #c9d1d9;
  }

  .post-date {
    font-size: 0.9rem;
    color: #8b949e;
  }

  .post-content {
    color: #8b949e;
    line-height: 1.5;
  }

  .more-posts {
    text-align: center;
    color: #8b949e;
    font-style: italic;
    margin-top: 15px;
  }

  .no-data {
    text-align: center;
    color: #8b949e;
    padding: 30px;
    font-style: italic;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding-top: 20px;
    border-top: 1px solid rgba(16, 185, 192, 0.2);
  }

  .view-posts-btn {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .view-posts-btn:hover {
    background: rgba(16, 185, 192, 0.3);
  }

  .close-modal-btn {
    background: rgba(107, 114, 128, 0.2);
    color: #8b949e;
    border: 1px solid rgba(107, 114, 128, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .close-modal-btn:hover {
    background: rgba(107, 114, 128, 0.3);
  }

  /* Users count button styles */
  .users-count-cell {
    padding: 8px 16px;
  }

  .users-count-btn {
    background: rgba(16, 185, 192, 0.2);
    color: #10b9c0;
    border: 1px solid rgba(16, 185, 192, 0.3);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
    min-width: 40px;
  }

  .users-count-btn:hover:not(:disabled) {
    background: rgba(16, 185, 192, 0.3);
    transform: translateY(-1px);
  }

  .users-count-btn:disabled {
    background: rgba(107, 114, 128, 0.2);
    color: #6b7280;
    border-color: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
  }

  /* Users modal styles */
  .users-modal {
    max-width: 800px;
    width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
  }

  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    padding: 16px 0;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(16, 185, 192, 0.2);
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .user-card:hover {
    background: rgba(22, 27, 34, 0.9);
    border-color: rgba(16, 185, 192, 0.4);
    transform: translateY(-2px);
  }

  .user-avatar-section {
    flex-shrink: 0;
  }

  .modal-user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(16, 185, 192, 0.3);
  }

  .modal-user-avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(16, 185, 192, 0.3), rgba(16, 185, 192, 0.5));
    border: 2px solid rgba(16, 185, 192, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-avatar-initials {
    font-size: 18px;
    font-weight: 600;
    color: #10b9c0;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-username {
    font-size: 1rem;
    font-weight: 600;
    color: #c9d1d9;
    margin: 0 0 4px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-email {
    font-size: 0.875rem;
    color: #8b949e;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
