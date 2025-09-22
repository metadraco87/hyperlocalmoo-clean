<script>
    import { page } from '$app/stores';

export const params = {}; // Use const for unused export
    $: error = $page.error;
</script>

<svelte:head>
    <title>Error - Hyperlocal Moo</title>
</svelte:head>

<div class="error-page">
    <h1>Oops! Something went wrong</h1>
    {#if error?.message}
        <p>{error.message}</p>
    {:else}
        <p>An unexpected error occurred.</p>
    {/if}
    <a href="/">Back to Home</a>
</div>

<style>
    .error-page {
        max-width: 600px;
        margin: 50px auto;
        text-align: center;
        padding: 20px;
    }

    h1 {
        color: #dc3545;
        margin-bottom: 20px;
    }

    p {
        color: #333;
        font-size: 1.1em;
        margin-bottom: 20px;
    }

    a {
        display: inline-block;
        padding: 10px 20px;
        background: linear-gradient(45deg, #007bff, #00c4ff);
        color: white;
        text-decoration: none;
        border-radius: 5px;
        transition: background 0.3s;
    }

    a:hover {
        background: linear-gradient(45deg, #0056b3, #0097cc);
    }
</style>