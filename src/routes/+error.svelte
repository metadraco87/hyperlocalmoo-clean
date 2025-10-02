<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { auth } from '$lib/stores';
    
    let isLoggedIn = false;
    let isLoading = true;
    
    onMount(async () => {
        if (browser) {
            // Subscribe to auth state
            const unsubscribe = auth.subscribe(value => {
                isLoggedIn = value.isLoggedIn;
                isLoading = false;
            });
            
            // Redirect based on auth state after a short delay
            setTimeout(() => {
                if (isLoggedIn) {
                    goto('/posts', { replaceState: true });
                } else {
                    goto('/login', { replaceState: true });
                }
            }, 3000); // Redirect after 3 seconds
            
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
{:else}
    <div class="error-container">
        <h1>{$page.status}: {$page.error?.message || 'Page Not Found'}</h1>
        <p>The page you are looking for does not exist.</p>
        <p>Redirecting you to the {isLoggedIn ? 'dashboard' : 'login page'} shortly...</p>
    </div>
{/if}

<style>
    .loading-container,
    .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: Arial, sans-serif;
        background-color: #f8f9fa;
        color: #343a40;
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
        color: #dc3545;
        margin-bottom: 1rem;
        font-size: 3em;
    }
    
    p {
        color: #666;
        font-size: 1.2em;
        margin-bottom: 1em;
    }
</style>