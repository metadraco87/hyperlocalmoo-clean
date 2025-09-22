<script lang="ts">
  import { auth } from '$lib/stores/auth.js';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import ReportsPanel from './ReportsPanel.svelte';
  import MessagesPanel from './MessagesPanel.svelte';
  import ErrorsPanel from './ErrorsPanelFixed.svelte';
  import UsersPanel from './UsersPanel.svelte';
  import LocationsPanel from './LocationsPanel.svelte';
  import TopPostsPanel from './TopPostsPanel.svelte';

  // Admin access now checked via backend isAdmin flag
  
  // UI state
  let activeTab = 'reports';
  let isAuthenticated = false;
  let isLoading = false;
  let error = '';
  let email = '';
  let password = '';
  let errorsPanel: any; // Reference to ErrorsPanel component
  
  // Data state
  let reports = [];
  let reportsLoading = false;
  let reportsError = '';
  let reportFilter = 'all';
  
  let messages = [];
  let messagesLoading = false;
  let messagesError = '';
  let messageFilter = 'all';

  onMount(() => {
    // Check if user is already logged in as admin
    if (browser) {
      const userStore = get(auth);
      console.log('Admin component mounting, auth store:', userStore);
      
      // Check auth store for isAdmin flag
      if (userStore?.isLoggedIn && userStore?.isAdmin) {
        console.log('User is an admin, granting access');
        isAuthenticated = true;
        loadInitialData();
      } else if (userStore?.isLoggedIn && userStore?.isAdmin === false) {
        console.log('User is logged in but not an admin');
        error = 'Access denied: You are not authorized to access the admin panel';
      } else if (!userStore?.isLoggedIn) {
        console.log('User is not logged in');
        // Show login form
      }
    }
  });

  function setActiveTab(tab: string) {
    activeTab = tab;
    
    // Load data when switching to errors tab
    if (tab === 'errors' && errorsPanel) {
      errorsPanel.loadData();
    }
  }
  
  // Authentication
  async function handleLogin() {
    if (!email || !password) {
      error = 'Email and password are required';
      return;
    }
    
    // Admin check will be done by backend after login
    
    try {
      isLoading = true;
      error = '';
      
      console.log('Attempting admin login with email:', email);
      
      // Using auth store login
      const authStore = get(auth);
      if ((authStore as any).login) {
        console.log('Using auth store login function');
        await (authStore as any).login(email, password);
        
        // Check if login was successful and user is admin
        const updatedAuth = get(auth);
        console.log('Updated auth after login attempt:', updatedAuth);
        
        if (updatedAuth.isLoggedIn && updatedAuth.isAdmin) {
          console.log('Admin login successful');
          isAuthenticated = true;
          loadInitialData();
        } else if (updatedAuth.isLoggedIn && !updatedAuth.isAdmin) {
          error = 'Access denied: You are not authorized to access the admin panel';
        } else {
          error = 'Login failed - incorrect credentials';
        }
      } else {
        // Fallback if login function not available in store
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Login failed');
        }
        
        const data = await response.json();
        
        if (data.token) {
          // Manual login since auth.update isn't available
          console.log('Setting auth state manually with token');
          // Check if $auth is a store with a set method
          if ((auth as any).set) {
            (auth as any).set({
              isLoggedIn: true,
              token: data.token,
              email: email,
              isAuthLoaded: true
            });
          } else {
            console.log('Auth store does not have set or update methods');
            // Store the token in localStorage as a fallback
            if (browser) {
              localStorage.setItem('token', data.token);
              localStorage.setItem('userEmail', email);
            }
          }
          isAuthenticated = true;
          loadInitialData();
        } else {
          error = 'Login failed - no token received';
        }
      }
    } catch (err: any) {
      error = err.message || 'Login failed';
      console.error('Login error:', err);
    } finally {
      isLoading = false;
    }
  }
  
  // Data loading functions
  async function loadInitialData() {
    changeTab('reports');
  }
  
  // Tab navigation
  function changeTab(tab: string) {
    activeTab = tab;
    
    // Load data for the selected tab
    switch (tab) {
      case 'reports':
        loadReports();
        break;
      case 'messages':
        loadMessages();
        break;
      case 'users':
        // loadUsers();
        break;
      case 'locations':
        // loadLocations();
        break;
      case 'errors':
        if (errorsPanel) {
          errorsPanel.loadData();
        }
        break;
      case 'top-posts':
        // loadTopPosts();
        break;
    }
  }
  
  // API functions for reports and messages
  async function loadReports() {
    // Get token from auth store or localStorage
    let token;
    const authData = get(auth);
    if (authData && authData.token) {
      token = authData.token;
    } else if (browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
    }
    
    if (!token) {
      reportsError = 'No authentication token available';
      return;
    }
    
    try {
      reportsLoading = true;
      reportsError = '';
      
      // Filter query params
      const queryParams = new URLSearchParams();
      if (reportFilter && reportFilter !== 'all') {
        queryParams.append('status', reportFilter);
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/reports?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load reports');
      }
      
      const data = await response.json();
      reports = data.reports || [];
    } catch (err: any) {
      reportsError = err.message || 'An error occurred while loading reports';
    } finally {
      reportsLoading = false;
    }
  }
  
  async function loadMessages() {
    // Get token from auth store or localStorage
    let token;
    const authData = get(auth);
    if (authData && authData.token) {
      token = authData.token;
    } else if (browser && localStorage.getItem('token')) {
      token = localStorage.getItem('token');
    }
    
    if (!token) {
      messagesError = 'No authentication token available';
      return;
    }
    
    try {
      messagesLoading = true;
      messagesError = '';
      
      // Filter query params
      const queryParams = new URLSearchParams();
      if (messageFilter && messageFilter !== 'all') {
        queryParams.append('status', messageFilter);
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/help-messages?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load messages');
      }
      
      const data = await response.json();
      messages = data.messages || [];
    } catch (err: any) {
      messagesError = err.message || 'An error occurred while loading messages';
    } finally {
      messagesLoading = false;
    }
  }
  
  function formatDate(dateString: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
</script>

<svelte:head>
  <title>Admin Dashboard</title>
</svelte:head>

{#if isLoading}
  <div class="flex justify-center items-center min-h-screen">
    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else if !isAuthenticated}
  <div class="min-h-screen flex items-center justify-center bg-black py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div class="admin-login-header">
        <h2 class="admin-login-title">
          Admin Login
        </h2>
        <p class="admin-login-subtitle">
          For authorized administrators only
        </p>
      </div>
      
      {#if error}
        <div class="error-alert" role="alert">
          <span class="block sm:inline">{error}</span>
        </div>
      {/if}
      
      <form class="admin-login-form" on:submit|preventDefault={handleLogin}>
        <input type="hidden" name="remember" value="true">
        <div class="form-inputs">
          <div>
            <label for="email-address" class="sr-only">Email address</label>
            <input id="email-address" name="email" type="email" autocomplete="email" required 
              class="admin-input admin-input-top" 
              placeholder="Email address"
              bind:value={email}>
          </div>
          <div>
            <label for="password" class="sr-only">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required 
              class="admin-input admin-input-bottom" 
              placeholder="Password"
              bind:value={password}>
          </div>
        </div>

        <div>
          <button type="submit" class="admin-login-btn">
            {#if isLoading}
              <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              Processing...
            {:else}
              Sign in
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{:else}
  <div class="admin-dashboard">
    <header class="dashboard-header">
      <h1>Admin Dashboard</h1>
      <div class="user-info">
        <span>{$auth?.email || 'Admin'}</span>
      </div>
    </header>

    <div class="dashboard-nav">
      <button 
        class="nav-tab {activeTab === 'reports' ? 'active' : ''}" 
        on:click={() => setActiveTab('reports')}
      >
        Reports
      </button>
      <button 
        class="nav-tab {activeTab === 'messages' ? 'active' : ''}" 
        on:click={() => setActiveTab('messages')}
      >
        Help Messages
      </button>
      <button 
        class="nav-tab {activeTab === 'errors' ? 'active' : ''}" 
        on:click={() => setActiveTab('errors')}
      >
        System Errors
      </button>
      <button 
        class="nav-tab {activeTab === 'users' ? 'active' : ''}" 
        on:click={() => setActiveTab('users')}
      >
        Users
      </button>
      <button 
        class="nav-tab {activeTab === 'locations' ? 'active' : ''}" 
        on:click={() => setActiveTab('locations')}
      >
        Locations
      </button>
      <button 
        class="nav-tab {activeTab === 'top-posts' ? 'active' : ''}" 
        on:click={() => setActiveTab('top-posts')}
      >
        Top Posts
      </button>
    </div>

    <div class="dashboard-content">
      {#if activeTab === 'reports'}
        <ReportsPanel {activeTab} />
      {:else if activeTab === 'messages'}
        <MessagesPanel {activeTab} />
      {:else if activeTab === 'errors'}
        <ErrorsPanel bind:this={errorsPanel} />
      {:else if activeTab === 'users'}
        <UsersPanel {activeTab} />
      {:else if activeTab === 'locations'}
        <LocationsPanel {activeTab} />
      {:else if activeTab === 'top-posts'}
        <TopPostsPanel {activeTab} />
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Admin Login Styles */
  .admin-login-header {
    text-align: center;
    margin-bottom: 2rem;
    padding: 30px;
    border: 2px solid #00eaff;
    border-radius: 16px;
    background: #000;
    box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
  }

  .admin-login-title {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: #00eaff;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .admin-login-subtitle {
    margin: 0;
    color: #ccc;
    font-size: 1rem;
  }

  .error-alert {
    background: #ff1744;
    border: 2px solid #ff1744;
    color: #fff;
    padding: 15px;
    border-radius: 8px;
    font-weight: 600;
    text-align: center;
  }

  .admin-login-form {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-inputs {
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #333;
    background: #111;
    transition: border-color 0.3s ease;
  }

  .form-inputs:focus-within {
    border-color: #00eaff;
    box-shadow: 0 0 0 3px rgba(0, 234, 255, 0.2);
  }

  .admin-input {
    appearance: none;
    position: relative;
    display: block;
    width: 100%;
    padding: 15px;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 1rem;
    outline: none;
  }

  .admin-input::placeholder {
    color: #888;
  }

  .admin-input-top {
    border-bottom: 1px solid #333;
  }

  .admin-login-btn {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px 24px;
    border: 2px solid #00eaff;
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    font-size: 1rem;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .admin-login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
  }

  /* Dashboard Styles */
  .admin-dashboard {
    min-height: 100vh;
    background: #000;
    color: #fff;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 2px solid #00eaff;
    border-radius: 16px;
    background: #000;
    box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
  }

  .dashboard-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #00eaff;
    margin: 0;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .user-info {
    background: #222;
    padding: 12px 20px;
    border-radius: 8px;
    color: #00eaff;
    font-weight: 600;
    border: 1px solid #333;
  }

  .dashboard-nav {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    border-bottom: 2px solid #333;
    overflow-x: auto;
    padding-bottom: 2px;
    background: #111;
    padding: 15px;
    border-radius: 12px;
    border: 2px solid #333;
  }

  .nav-tab {
    background: #222;
    border: 2px solid #333;
    padding: 12px 20px;
    font-weight: 600;
    color: #ccc;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 8px;
    font-size: 1rem;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .nav-tab:hover {
    background: #333;
    color: #00eaff;
    border-color: #555;
  }

  .nav-tab.active {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border-color: #00eaff;
    font-weight: 700;
  }

  .dashboard-content {
    background: #111;
    border-radius: 16px;
    padding: 30px;
    min-height: 60vh;
    border: 2px solid #333;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: 768px) {
    .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 15px;
    }

    .dashboard-nav {
      margin-bottom: 20px;
      padding: 10px;
    }

    .nav-tab {
      padding: 10px 16px;
      font-size: 0.9rem;
    }

    .admin-login-title {
      font-size: 1.5rem;
    }

    .admin-login-header {
      padding: 20px;
    }
  }
</style>
