<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Comment } from '$lib/api';
    import { fetchReplies } from '$lib/api';

    export let comment: Comment;
    export let userEmail: string | null = null;
    export let token: string | null = null;

    let showReplies = false;
    let replies: Comment[] = [];
    let isLoadingReplies = false;
    let error: string | null = null;

    const dispatch = createEventDispatcher();

    function toggleReplies() {
        showReplies = !showReplies;
        if (showReplies && replies.length === 0 && comment.repliesCount > 0) {
            loadReplies();
        }
    }

    async function loadReplies() {
        isLoadingReplies = true;
        error = null;
        try {
            replies = await fetchReplies(comment.postId, comment.commentId);
        } catch (e: any) {
            console.error('Failed to fetch replies:', e);
            error = e.message || 'Failed to load replies.';
        } finally {
            isLoadingReplies = false;
        }
    }

    function handleReply() {
        dispatch('reply', comment.commentId);
    }

    function handleDelete() {
        dispatch('delete', comment.commentId);
    }
</script>

<li class="comment-item">
    <div class="comment-header">
        <span class="comment-username">{comment.username}</span>
        <span class="comment-timestamp">
            {new Date(comment.createdAt).toLocaleDateString()}
        </span>
    </div>
    <div class="comment-content">
        <p>{comment.content}</p>
    </div>
    <div class="comment-actions">
        {#if userEmail && token && (comment.parentCommentId === null || comment.parentCommentId === undefined)}
            <button on:click={handleReply} class="action-btn">Reply</button>
        {/if}
        {#if comment.userId === userEmail}
            <button on:click={handleDelete} class="action-btn delete-btn">Delete</button>
        {/if}
        {#if comment.repliesCount > 0}
            <button on:click={toggleReplies} class="replies-btn">
                {showReplies ? 'Hide' : 'Show'} {comment.repliesCount} replies
            </button>
        {/if}
    </div>

    {#if showReplies}
        <div class="replies-container">
            {#if isLoadingReplies}
                <div class="loading-replies">Loading replies...</div>
            {:else if error}
                <div class="error-message">{error}</div>
            {:else if replies.length > 0}
                <ul class="replies-list">
                    {#each replies as reply (reply.commentId)}
                        <li class="reply-item">
                            <div class="reply-header">
                                <span class="reply-username">{reply.username}</span>
                                <span class="reply-timestamp">{new Date(reply.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="reply-content">
                                <p>{reply.content}</p>
                            </div>
                            <div class="reply-actions">
                                {#if reply.userId === userEmail}
                                    <button on:click={() => dispatch('delete', reply.commentId)} class="action-btn delete-btn">Delete</button>
                                {/if}
                            </div>
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="no-replies">No replies found.</div>
            {/if}
        </div>
    {/if}
</li>

<style>
    .comment-item {
        background-color: rgba(0, 0, 0, 0.6);
        border-radius: 8px;
        padding: 12px;
        border: 1px solid rgba(0, 217, 255, 0.3);
    }

    .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .comment-username {
        font-weight: 600;
        color: #00d9ff;
    }

    .comment-timestamp {
        font-size: 0.875rem;
        color: #ffffff;
    }

    .comment-content p {
        margin: 0;
        color: #ffffff;
        line-height: 1.5;
    }

    .comment-actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
        font-size: 0.875rem;
    }

    .action-btn, .replies-btn {
        background: none;
        border: none;
        color: #00d9ff;
        cursor: pointer;
        padding: 0;
        font-weight: 500;
        transition: color 0.2s;
    }

    .action-btn:hover, .replies-btn:hover {
        color: #ffffff;
    }
    
    .delete-btn {
        color: #ef4444;
    }

    .delete-btn:hover {
        color: #ffffff;
    }

    .replies-container {
        margin-top: 12px;
        padding-left: 16px;
        border-left: 2px solid rgba(0, 217, 255, 0.5);
    }

    .replies-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .reply-item {
        background-color: rgba(0, 0, 0, 0.4);
        border-radius: 6px;
        padding: 8px;
        border: 1px solid rgba(0, 217, 255, 0.2);
    }
    .reply-header {
        display: flex;
        gap: 1em;
        font-size: 0.9em;
        color: #00d9ff;
        margin-bottom: 2px;
    }
    .reply-username {
        font-weight: 600;
        color: #00d9ff;
    }
    .reply-timestamp {
        font-size: 0.8em;
        color: #ffffff;
    }
    .reply-content p {
        margin: 0;
        color: #ffffff;
        line-height: 1.4;
        font-size: 0.98em;
    }
    .reply-actions {
        margin-top: 4px;
        display: flex;
        gap: 8px;
    }
    .loading-replies, .no-replies {
        font-size: 0.875rem;
        color: #ffffff;
    }
    .error-message {
        color: #ef4444;
        font-size: 0.875rem;
    }
</style>