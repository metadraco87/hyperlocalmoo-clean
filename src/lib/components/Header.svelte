<!-- src/lib/components/Header.svelte -->
<script>
    import { goto } from '$app/navigation';
    import { auth } from '$lib/stores/auth';
    import { onDestroy } from 'svelte';

    export let isLoggedIn = false;
    // MODIFIED: Changed prop name from userLocation to preferredLocation
    export let preferredLocation; // This will receive the preferredLocation object from layout via bind:

    let currentUserName = '';
    let currentUserEmail = '';
    let currentPreferredLocationName = 'Loading...';

    // Reactive declaration: Updates currentPreferredLocationName whenever the preferredLocation prop changes
    // MODIFIED: Use preferredLocation here
    $: if (preferredLocation && preferredLocation.name) {
        currentPreferredLocationName = preferredLocation.name;
    } else {
        currentPreferredLocationName = 'Not Set';
    }

    // Subscribe to the auth store for user details
    const unsubscribeAuth = auth.subscribe(($auth) => {
        if ($auth.isLoggedIn) {
            currentUserName = $auth.username || 'User'; // Use username if available
            currentUserEmail = $auth.email || '';
        } else {
            currentUserName = '';
            currentUserEmail = '';
        }
    });

    async function handleLogout() {
        console.log("Header: Attempting logout.");
        await auth.logout();
        console.log("Header: Logout process complete, redirecting to login.");
        goto('/login'); // Redirect to login page after logout
    }

    onDestroy(() => {
        unsubscribeAuth();
    });
</script>

<header class="header">
    <div class="header-left">
        <a href="/" class="logo">Locallore</a>
        {#if isLoggedIn}
            <div class="user-section">
                <div class="user-avatar">
                    <img 
                        src={$auth.profileImageUrl || '/images/default-profile.jpg'} 
                        alt="Profile" 
                        class="avatar-image"
                        on:error={(e) => e.currentTarget.src = '/images/default-profile.jpg'}
                    />
                </div>
                <span class="user-greeting">Hello, {currentUserName}!</span>
            </div>
        {/if}
    </div>
    <div class="header-center">
        {#if isLoggedIn && currentPreferredLocationName}
            <!-- MODIFIED: Use currentPreferredLocationName here -->
            <span class="location-display">Location: {currentPreferredLocationName}</span>
        {/if}
    </div>
    <nav class="header-right">
        {#if isLoggedIn}
            <a href="/posts" class="nav-link">Posts</a>
            <a href="/create-post" class="nav-link">Create Post</a>
            <a href="/concierge" class="nav-link">Concierge</a>
            <a href="/location-setup" class="nav-link">Change Location</a>
            <button on:click={handleLogout} class="logout-button">Logout</button>
        {:else}
            <a href="/login" class="nav-link">Login</a>
            <a href="/register" class="nav-link">Register</a>
        {/if}
    </nav>
</header>

<style>
    /* ... (your existing styles for Header.svelte) ... */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background-color: #2c3e50; /* Dark blue-grey */
        color: white;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        flex-wrap: wrap; /* Allow wrapping on smaller screens */
    }

    .header-left, .header-center, .header-right {
        display: flex;
        align-items: center;
        margin-bottom: 5px; /* Add some spacing for wrapping */
    }

    .logo {
        font-size: 1.8em;
        font-weight: bold;
        color: #ecf0f1; /* Light grey */
        text-decoration: none;
        margin-right: 20px;
    }

    .user-greeting {
        font-size: 1.1em;
        margin-right: 15px;
        color: #bdc3c7; /* Muted grey */
    }

    .user-section {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #ecf0f1;
        transition: border-color 0.3s ease;
    }

    .user-avatar:hover {
        border-color: #3498db;
    }

    .avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .location-display {
        font-size: 1em;
        color: #95a5a6; /* Even more muted grey */
        margin-left: 10px;
    }

    nav .nav-link {
        color: #ecf0f1;
        text-decoration: none;
        margin-left: 20px;
        font-size: 1.1em;
        transition: color 0.3s ease;
    }

    nav .nav-link:hover {
        color: #3498db; /* Bright blue on hover */
    }

    .logout-button {
        background-color: #e74c3c; /* Red */
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1em;
        margin-left: 20px;
        transition: background-color 0.3s ease;
    }

    .logout-button:hover {
        background-color: #c0392b; /* Darker red on hover */
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .header {
            flex-direction: column;
            text-align: center;
        }
        .header-left, .header-center, .header-right {
            flex-direction: column;
            width: 100%;
            margin-bottom: 10px;
        }
        .logo, .user-greeting, .location-display, nav .nav-link, .logout-button {
            margin: 5px 0; /* Adjust margins for vertical stacking */
        }
        .user-section {
            flex-direction: row;
            justify-content: center;
            gap: 8px;
        }
        .user-avatar {
            width: 28px;
            height: 28px;
        }
    }
</style>