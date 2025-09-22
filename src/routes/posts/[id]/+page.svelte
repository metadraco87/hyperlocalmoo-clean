<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { cachedFetch, clearCache } from '$lib/cache';

    let post = null;
    let loading = true;
    let error = null;
    let currentUserId = null;

    const POST_PLACEHOLDER_IMAGE = '/images/default-profile.jpg';

    function handleImageError(e) {
        e.currentTarget.src = POST_PLACEHOLDER_IMAGE;
    }

    onMount(async () => {
        if (!browser) return;

        const postId = $page.params.id;

        try {
            const userResponse = await cachedFetch('/api/users/me');
            if (userResponse.ok) {
                const userData = await userResponse.json();
                currentUserId = userData.email;
            } else {
                console.error('Failed to verify user session on post detail page:', userResponse.status, userResponse.statusText);
            }
        } catch (err) {
            console.error('Error fetching user info for post detail:', err);
        }

        try {
            const response = await cachedFetch(`/api/posts/${postId}`);

            if (response.ok) {
                post = await response.json();
            } else {
                const errorData = await response.json().catch(() => ({}));
                error = errorData.error || `Failed to fetch post: ${response.statusText || response.status}`;
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    clearCache();
                    goto('/login');
                }
            }
        } catch (err) {
            console.error('Error fetching post:', err);
            error = 'Network error or unable to fetch post.';
            if (err instanceof TypeError || (err.message && err.message.includes('Failed to fetch'))) {
                localStorage.removeItem('token');
                clearCache();
                goto('/login');
            }
        } finally {
            loading = false;
        }
    });

    async function handleDelete() {
        if (!post) return;

        if (confirm('Are you sure you want to delete this post?')) {
            try {
                const response = await cachedFetch(`/api/posts/${post.id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alert('Post deleted successfully!');
                    clearCache('/api/posts');
                    clearCache(`/api/posts/${post.id}`);
                    goto('/posts');
                } else if (response.status === 403) {
                    const errorData = await response.json().catch(() => ({ message: 'Forbidden' }));
                    alert(`Deletion failed: ${errorData.message}`);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Failed to delete post: ${errorData.message || response.statusText}`);
                }
            } catch (err) {
                console.error('Error deleting post:', err);
                alert('Error deleting post: ' + err.message);
            }
        }
    }

    // Function to navigate to another user's profile
    function viewUserProfile(email) {
        if (email) {
            goto(`/profile/${encodeURIComponent(email)}`);
        }
    }
</script>

<style>
    .container {
        max-width: 700px;
        margin: 40px auto;
        padding: 25px;
        border: 1px solid #ddd;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        background-color: #fff;
    }
    h1 {
        text-align: center;
        color: #333;
        margin-bottom: 30px;
        font-size: 2.2em;
    }
    .post-details p {
        margin-bottom: 10px;
        font-size: 1.1em;
        color: #555;
    }
    .post-details strong {
        color: #333;
    }
    .post-image {
        width: 100%;
        max-height: 400px;
        object-fit: contain;
        border-radius: 8px;
        margin-bottom: 20px;
        background-color: #f0f0f0;
    }
    .action-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 30px;
        gap: 15px;
    }
    .action-buttons button,
    .action-buttons a {
        flex: 1;
        padding: 12px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1.1em;
        text-align: center;
        text-decoration: none;
        transition: background-color 0.2s;
        color: white;
    }
    .back-button {
        background-color: #6c757d;
    }
    .back-button:hover {
        background-color: #5a6268;
    }
    .delete-button {
        background-color: #dc3545;
    }
    .delete-button:hover {
        background-color: #c82333;
    }
    .post-creator-email {
        font-size: 1em;
        color: #777;
        margin-top: 15px;
        font-style: italic;
    }
    .post-creator-link {
        color: #007bff; /* Make it look like a link */
        cursor: pointer;
        text-decoration: underline;
    }
    .post-creator-link:hover {
        color: #0056b3;
    }
</style>

<div class="container">
    <h1>Post Details</h1>

    {#if loading}
        <p>Loading post...</p>
    {:else if error}
        <p style="color: red;">Error: {error}</p>
        <div class="action-buttons">
            <button class="back-button" on:click={() => goto('/posts')}>Back to Posts</button>
        </div>
    {:else if post}
        <div class="post-details">
            <img
                src={post.imageUrl || POST_PLACEHOLDER_IMAGE}
                alt={post.title}
                class="post-image"
                on:error={handleImageError}
            />

            <p><strong>Title:</strong> {post.headline ||post.title}</p>
            <p><strong>Description:</strong> {post.content ||post.desc}</p>
            <p><strong>Location:</strong> {post.location}</p>
            {#if post.category}
                <p><strong>Category:</strong> {post.category}</p>
            {/if}
            {#if post.email}
                <p class="post-creator-email">
                    Created by: 
                    {#if currentUserId === post.email}
                        {post.email} (You)
                    {:else}
                        <span class="post-creator-link" on:click={() => viewUserProfile(post.email)}>
                            {post.email}
                        </span>
                    {/if}
                </p>
            {/if}
        </div>

        <div class="action-buttons">
            <button class="back-button" on:click={() => goto('/posts')}>Back to Posts</button>
            {#if currentUserId && post.email && currentUserId === post.email}
                <button class="delete-button" on:click={handleDelete}>Delete Post</button>
            {/if}
        </div>
    {/if}
</div>