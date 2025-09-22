<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let show = false;
  
  $: if (show) {
    console.log('🗑️ DeleteConfirmModal: Now visible for post', postId);
  }
  export let postId: string;
  export let auth: any;

  const dispatch = createEventDispatcher();

  let deletingSending = false;
  let deleteError = '';
  let deleteSuccess = false;

  function closeModal() {
    show = false;
    deletingSending = false;
    deleteError = '';
    deleteSuccess = false;
    dispatch('close');
  }

  async function handleDeletePost() {
    if (!auth?.token || !postId) {
      deleteError = 'You must be logged in to delete a post';
      return;
    }
    try {
      deletingSending = true;
      deleteError = '';
      await import('$lib/api').then(m => m.deletePost(postId, auth.token));
      deleteSuccess = true;
      setTimeout(() => {
        dispatch('deleteSuccess', { postId });
        closeModal();
      }, 1000);
    } catch (error) {
      deleteError = (error as any).message || 'An error occurred while deleting your post';
    } finally {
      deletingSending = false;
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0" style="z-index: 2000;">
    <div class="delete-modal" on:click|stopPropagation role="dialog" style="z-index: 2001;">
      <div class="delete-modal-header">
        <h3>Delete Post</h3>
        <button class="modal-close" on:click={closeModal}>&times;</button>
      </div>
      <div class="delete-modal-body">
        {#if deleteSuccess}
          <div class="delete-success">
            <p>Your post has been deleted successfully.</p>
          </div>
        {:else}
          <p class="delete-confirmation-text">Are you sure you want to delete this post? This action cannot be undone.</p>
          {#if deleteError}
            <div class="delete-error">{deleteError}</div>
          {/if}
          <div class="delete-actions">
            <button type="button" class="cancel-btn" on:click={closeModal}>Cancel</button>
            <button type="button" class="delete-confirm-btn" disabled={deletingSending} on:click={handleDeletePost}>
              {deletingSending ? 'Deleting...' : 'Delete Post'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .delete-modal {
    background: #fff;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    padding: 2rem 1.5rem 1.5rem 1.5rem;
    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    position: relative;
    z-index: 1100;
  }
  .delete-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #888;
  }
  .delete-success {
    color: #16a34a;
    font-weight: 600;
    text-align: center;
    margin: 2rem 0;
  }
  .delete-confirmation-text {
    color: #1f2937;
    font-size: 1rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  .delete-error {
    color: #dc2626;
    margin-bottom: 1rem;
    text-align: center;
  }
  .delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .cancel-btn {
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  }
  .cancel-btn:hover {
    background: #e5e7eb;
  }
  .delete-confirm-btn {
    background: #dc2626;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  }
  .delete-confirm-btn:disabled {
    background: #fca5a5;
    cursor: not-allowed;
  }
</style>
