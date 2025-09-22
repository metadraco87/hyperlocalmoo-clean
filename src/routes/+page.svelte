<script>
    import { auth } from '$lib/stores/auth';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    let isLoggedIn = false;

    auth.subscribe(state => {
        isLoggedIn = state.isLoggedIn;
    });

    onMount(async () => {
        if (!browser) return;

        console.log('Root Page: Checking auth state for redirect');
        // REMOVED: await auth.loadUserData(); // This function no longer exists and is handled by store initialization
        if (isLoggedIn) {
            console.log('Root Page: User is logged in, redirecting to /posts');
            goto('/posts', { replaceState: true });
        } else {
            console.log('Root Page: User is not logged in, redirecting to /login');
            goto('/login', { replaceState: true });
        }
    });
</script>

<div>Redirecting...</div>

<style>
    div {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-size: 1.5em;
        color: #333;
    }
</style>