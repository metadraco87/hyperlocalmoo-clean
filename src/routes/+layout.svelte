<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { auth, userLocation, preferredLocation } from '$lib/stores';
  import { fade } from 'svelte/transition';
  import HelpButton from '$lib/components/HelpButton.svelte';
  import AdBanners from '$lib/components/AdBanners.svelte';

  let isLoggedIn: boolean = false;
  let userLocationStatus: boolean | null = null;
  let isAuthReady: boolean = false;
  let isLocationStoreReady: boolean = false;
  let unsubscribeAuth: () => void;
  let unsubscribeLocation: () => void;
  let unsubscribePage: () => void;
  let userProfilePicture: string | null = null;
  let username: string = '';

  // Default profile picture path
  const defaultProfilePicture = '/images/default-profile.jpg';

  // Pages that should show ads
  $: showAds = isLoggedIn && $page?.url?.pathname && ['/posts', '/profile', '/concierge'].some(path => 
    $page.url.pathname === path || $page.url.pathname.startsWith(path + '/')
  );

  async function checkRedirects() {
    if (!browser || !isAuthReady || !isLocationStoreReady || !$page?.url) {
      console.log('Layout: Redirect Check - Waiting for browser, auth, location store, or page readiness.');
      return;
    }

    const currentPathname = $page.url.pathname;
    const currentSearchParams = $page.url.searchParams;
    const publicPaths = ['/', '/login', '/register'];
    const protectedPathsRequiringLogin = ['/posts', '/profile', '/create', '/posts/list'];

    console.log('Layout: Redirect Check - Active. isLoggedIn:', isLoggedIn, 'userLocationStatus:', userLocationStatus, 'currentPath:', currentPathname);

    if (!isLoggedIn) {
      if (protectedPathsRequiringLogin.includes(currentPathname) || currentPathname === '/') {
        console.log('Layout: Not logged in. Redirecting to /login.');
        await goto('/login', { replaceState: true });
      }
    } else { // Logged in
      if (!userLocationStatus) {
        const isPostsWithLocationSetup = currentPathname === '/posts' && currentSearchParams.get('showLocationSetup') === 'true';
        if (currentPathname !== '/location-setup' && !isPostsWithLocationSetup) {
          console.log('Layout: Logged in but no valid location. Redirecting to /location-setup.');
          await goto('/location-setup', { replaceState: true });
        } else {
          console.log('Layout: Logged in, no location, but current path is /location-setup or /posts with overlay param. Skipping redirect.');
        }
      } else { // Logged in and location is set
        if (publicPaths.includes(currentPathname) || currentPathname === '/location-setup') {
          console.log('Layout: Logged in and location set. Redirecting to /posts.');
          await goto('/posts', { replaceState: true });
        }
      }
    }
  }

  onMount(() => {
    console.log('Layout: Mounted.');

    unsubscribeAuth = auth.subscribe(value => {
      isLoggedIn = value.isLoggedIn;
      userProfilePicture = value.profileImageUrl || null;
      username = value.username || '';
      isAuthReady = true;
      checkRedirects();
    });

    unsubscribeLocation = userLocation.subscribe(value => {
      userLocationStatus = value.userLocationStatus;
      isLocationStoreReady = true;
      checkRedirects();
    });

    unsubscribePage = page.subscribe(value => {
      checkRedirects();
    });

    if (browser) {
      preferredLocation.loadLocation();
      console.log('Layout: Triggered preferredLocation.loadLocation().');
    }
  });

  async function handleLogout() {
    console.log('Layout: Logging out user.');
    try {
      await auth.logout();
      console.log('Layout: Logout successful, redirecting to /login.');
      await goto('/login', { replaceState: true });
    } catch (error: any) {
      console.error('Layout: Logout failed:', error.message);
    }
  }

  onDestroy(() => {
    console.log('Layout: Unmounting, cleaning up subscriptions.');
    unsubscribeAuth?.();
    unsubscribeLocation?.();
    unsubscribePage?.();
  });
</script>

{#if !isAuthReady && $page?.url?.pathname !== '/login' && $page?.url?.pathname !== '/register' && !$page?.url?.pathname?.startsWith('/profile/')}
  <div class="auth-loading-overlay">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{/if}

{#if isLoggedIn}
    <header transition:fade={{ duration: 200 }}>
        <div class="header-container">
      <button class="logo" on:click={() => document.dispatchEvent(new CustomEvent('openHelpModal'))}>
        <h1>apexmoo</h1>
      </button>
            <nav class="nav-links">
                <!-- Globe/Map Icon -->
                <a href="/posts" class="nav-icon globe-icon" class:active={$page?.url?.pathname === '/posts'} title="Map">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M2 12h20" stroke="currentColor" stroke-width="1"/>
                    <path d="M12 2a15.3 15.3 0 0 1 0 20" stroke="currentColor" stroke-width="1" fill="none"/>
                    <path d="M12 2a15.3 15.3 0 0 0 0 20" stroke="currentColor" stroke-width="1" fill="none"/>
                  </svg>
                </a>

                <!-- Concierge Icon (Combined Messages & Notifications) -->
                <a href="/concierge" class="nav-icon bell-icon" class:active={$page?.url?.pathname === '/concierge'} title="Concierge">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    <circle cx="16" cy="8" r="3" fill="#ff4444" stroke="white" stroke-width="1"/>
                  </svg>
                </a>

                <!-- Profile Icon -->
                <a href="/profile" class="nav-icon profile-icon" class:active={$page?.url?.pathname === '/profile'} title="Profile">
                  <img 
                    src={userProfilePicture || defaultProfilePicture} 
                    alt="{username}'s profile"
                    class="profile-picture"
                    on:error={(e) => { 
                      if (e.target && 'src' in e.target) {
                        e.target.src = defaultProfilePicture; 
                      }
                    }}
                  />
                </a>

                <!-- Logout Button (Clear Exit Door Icon) -->
                <button class="nav-icon logout-btn" on:click={handleLogout} title="Logout">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="currentColor"/>
                  </svg>
                </button>
            </nav>
        </div>
    </header>
{/if}

{#if showAds}
  <div class="page-with-ads">
    <!-- LEFT AD COLUMN -->
    <AdBanners side="left" />
    
    <!-- MAIN CONTENT -->
    <main class="main-content-with-ads">
      <slot />
      
  <HelpButton position="bottom-right" />
    </main>
    
    <!-- RIGHT AD COLUMN -->
    <AdBanners side="right" />
  </div>
{:else}
  <main class="main-content-full">
    <slot />
    
  <HelpButton position="bottom-right" />
  </main>
{/if}

<style>
  header {
    background-color: #000;
    padding: 5px 25px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
  }

  .header-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    text-decoration: none;
    margin-left: 33px;
    border-radius: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .logo h1 {
    font-size: 2.5em;
    font-weight: 900;
    margin: 0;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-family: 'Arial Black', Gadget, Cambria;
    /* Gradient for animated text color */
    background: linear-gradient(90deg, #fff 0%, #00eaff 50%, #fff 100%);
    background-size: 200% 100%;
    background-position: 100% 0;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    transition: background-position 0.6s cubic-bezier(.4,0,.2,1);
  }

  .logo:hover h1 {
    background-position: 0 0;
  }

  .nav-links a,
  .nav-links button {
    font-family: 'Inter', sans-serif;
    font-size: 1.15em;
    font-weight: 900;
  }

  .nav-links {
    display: flex;
    gap: 25px;
    align-items: center;
    margin-right: 50px;
  }

  .nav-icon {
    color: #fff;
    text-decoration: none;
    padding: 10px;
    border-radius: 8px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    position: relative;
  }

  .nav-icon:hover {
    color: #80d4ff; /* Color between electric blue and white */
    transform: translateY(-2px);
  }

  .nav-icon.active {
    color: #00eaff; /* Electric blue for active state */
  }

  .nav-icon svg {
    width: 30px;
    height: 30px;
    transition: all 0.3s ease;
  }

  .globe-icon svg {
    width: 32px;   /* or your preferred size */
    height: 32px;
  }

  .profile-icon {
    padding: 3px;
  }

  .profile-picture {
    width: 35px;
    height: 35px;
    border-radius: 20%;
    object-fit: cover;
    border: 2px solid #ffffff;
    transition: all 0.3s ease;
  }

  .profile-icon:hover .profile-picture {
    border-color: #80d4ff;
    transform: scale(1.1);
  }

  .profile-icon.active .profile-picture {
    border-color: #00eaff;
    box-shadow: 0 0 10px rgba(0, 234, 255, 0.5);
  }

  .logout-btn {
    margin-left: 10px;
  }

  .logout-btn:hover {
    color: #ff6b6b; /* Red color for logout hover */
  }

  /* Bell icon shake animation with bright yellow */
  .bell-icon:hover {
    color: #ffd700; /* Bright yellow on hover */
  }

.auth-loading-overlay {
  position: fixed;
  z-index: 99999;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.spinner {
  border: 6px solid #eee;
  border-top: 6px solid #333;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1em;
}
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}
  main {
    margin-top: 0;
    min-height: calc(100vh - 80px);
  }

  /* Layout for pages with ads */
  .page-with-ads {
    width: 1500px;
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    background: #f9fafb;
    padding-top: 60px; /* Account for fixed header */
  }

  .main-content-with-ads {
    flex: 1 1 auto;
    max-width: 1200px;
    background: #fff;
    min-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    margin-left: 15px;
    margin-right: 15px;
    position: relative;
  }

  .main-content-full {
    margin-top: 0;
    min-height: calc(100vh - 80px);
    position: relative;
  }

  @media (max-width: 768px) {
    header {
      padding: 10px 15px;
    }

    .header-container {
      flex-direction: column;
      gap: 10px;
    }

    .logo h1 {
      font-size: 1.8em;
    }

    .nav-links {
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .nav-links a, .nav-links button {
      font-size: 1em;
      padding: 6px 12px;
    }

    main {
      margin-top: 0;
    }
  }
</style>