<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { auth } from '$lib/stores';
    
    let isLoggedIn = false;
    let isLoading = true;
    
    onMount(async () => {
        if (browser) {
            // Subscribe to auth state
            const unsubscribe = auth.subscribe(value => {
                isLoggedIn = value.isLoggedIn;
                isLoading = false;
                
                // Redirect based on auth state
                if (!isLoading) {
                    if (isLoggedIn) {
                        // User is logged in, redirect to posts
                        goto('/posts', { replaceState: true });
                    } else {
                        // User is not logged in, redirect to login
                        goto('/login', { replaceState: true });
                    }
                }
            });
            
            // Cleanup subscription on component destroy
            return unsubscribe;
        }
    });
</script>

{#if isLoading}
    <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading...</p>
    </div>
{:else if !isLoggedIn}
    <div class="redirect-notice">
        <h1>Welcome to Apexmoo</h1>
        <p>Redirecting to login...</p>
    </div>
{:else}
    <div class="redirect-notice">
        <h1>Welcome back!</h1>
        <p>Redirecting to your dashboard...</p>
    </div>
{/if}

<style>
    .loading-container,
    .redirect-notice {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: Arial, sans-serif;
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
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    h1 {
        color: #333;
        margin-bottom: 1rem;
    }
    
    p {
        color: #666;
        font-size: 1.1em;
    }
</style>