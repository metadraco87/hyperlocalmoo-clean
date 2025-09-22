<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  
  const dispatch = createEventDispatcher();
  
  export let query: string = '';
  export let visible: boolean = false;
  export let position: { x: number; y: number } = { x: 0, y: 0 };
  
  interface User {
    id: string;
    username: string;
    profileImageUrl?: string;
    relationshipType?: 'buddy' | 'connected' | 'none';
  }
  
  let users: User[] = [];
  let selectedIndex = 0;
  let loading = false;
  let searchTimeout: ReturnType<typeof setTimeout>;
  
  const DEFAULT_PROFILE_PIC = '/images/default-profile.jpg';
  
  // Debounced search function
  function searchUsers(searchQuery: string) {
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
      if (!searchQuery || searchQuery.length < 1) {
        users = [];
        return;
      }
      
      loading = true;
      try {
        if (!$auth?.token) return;
        
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${$auth.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Sort by relationship: buddies first, then connected, then others
          users = data.users.sort((a: User, b: User) => {
            const priority = { buddy: 0, connected: 1, none: 2 };
            return priority[a.relationshipType || 'none'] - priority[b.relationshipType || 'none'];
          });
          selectedIndex = 0;
        }
      } catch (error) {
        console.error('Error searching users:', error);
        users = [];
      } finally {
        loading = false;
      }
    }, 150);
  }
  
  function selectUser(user: User) {
    dispatch('select', { user });
    users = [];
    selectedIndex = 0;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (!visible || users.length === 0) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, users.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (users[selectedIndex]) {
          selectUser(users[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        dispatch('close');
        break;
    }
  }
  
  // Watch for query changes
  $: if (query && visible) {
    searchUsers(query);
  } else {
    users = [];
  }
  
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
  
  function getRelationshipIcon(type: string) {
    switch (type) {
      case 'buddy': return '👥';
      case 'connected': return '🔗';
      default: return '';
    }
  }
</script>

{#if visible && (users.length > 0 || loading)}
  <div 
    class="autocomplete-dropdown" 
    style="left: {position.x}px; top: {position.y}px;"
  >
    {#if loading}
      <div class="autocomplete-item loading">
        <span>Searching...</span>
      </div>
    {:else}
      {#each users as user, index (user.id)}
        <button
          class="autocomplete-item"
          class:selected={index === selectedIndex}
          on:click={() => selectUser(user)}
          on:mouseenter={() => selectedIndex = index}
        >
          <img 
            src={user.profileImageUrl || DEFAULT_PROFILE_PIC} 
            alt="{user.username} profile" 
            class="user-avatar"
          />
          <div class="user-info">
            <span class="username">@{user.username}</span>
            {#if user.relationshipType && user.relationshipType !== 'none'}
              <span class="relationship">
                {getRelationshipIcon(user.relationshipType)}
                {user.relationshipType}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .autocomplete-dropdown {
    position: absolute;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    min-width: 200px;
  }
  
  .autocomplete-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s;
    gap: 0.75rem;
  }
  
  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background-color: #f8fafc;
  }
  
  .autocomplete-item.loading {
    justify-content: center;
    color: #64748b;
    cursor: default;
  }
  
  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #e2e8f0;
  }
  
  .user-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .username {
    font-weight: 600;
    color: #2563eb;
    font-size: 0.875rem;
  }
  
  .relationship {
    font-size: 0.75rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
