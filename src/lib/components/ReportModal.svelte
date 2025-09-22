<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let show = false;
  
  $: if (show) {
    console.log('📋 ReportModal: Now visible for post', postId);
  }
  export let postId: string;
  export let auth: any;

  const dispatch = createEventDispatcher();

  let reportReason = 'spam';
  let reportDetails = '';
  let reportSending = false;
  let reportError = '';
  let reportSuccess = false;

  const reportReasons = [
    { value: 'spam', label: 'Spam' },
    { value: 'inappropriate', label: 'Inappropriate Content' },
    { value: 'scam', label: 'Scam or Fraud' },
    { value: 'other', label: 'Other' }
  ];

  function closeModal() {
    show = false;
    dispatch('close');
    reportReason = 'spam';
    reportDetails = '';
    reportSending = false;
    reportError = '';
    reportSuccess = false;
  }

  async function submitReport() {
    if (!auth?.token) {
      reportError = 'You must be logged in to report a post';
      return;
    }
    try {
      reportSending = true;
      reportError = '';
      await import('$lib/api').then(m => m.reportPost(postId, reportReason, reportDetails, auth.token));
      reportSuccess = true;
      setTimeout(() => {
        closeModal();
      }, 2000);
    } catch (error) {
      reportError = (error as any).message || 'An error occurred while submitting your report';
    } finally {
      reportSending = false;
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1" style="z-index: 2000;" aria-modal="true" aria-labelledby="report-modal-title">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="report-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()} role="document" style="z-index: 2001;">
      <div class="modal-header">
        <h3 id="report-modal-title">Report Post</h3>
        <button class="modal-close" on:click={closeModal}>&times;</button>
      </div>
      <div class="modal-body">
        {#if reportSuccess}
        <div class="report-success">Thank you for your report!</div>
      {:else}
        <form on:submit|preventDefault={submitReport}>
          <div class="form-group">
            <label for="report-reason">Reason</label>
            <select id="report-reason" bind:value={reportReason}>
              {#each reportReasons as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="report-details">Details (optional)</label>
            <textarea id="report-details" bind:value={reportDetails} rows="4" placeholder="Please provide additional details..."></textarea>
          </div>
          {#if reportError}
            <div class="report-error">{reportError}</div>
          {/if}
          <div class="report-actions">
            <button type="button" class="cancel-btn" on:click={closeModal}>Cancel</button>
            <button type="submit" class="submit-btn" disabled={reportSending}>
              {reportSending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .report-modal {
    background: #1a1a1a;
    border-radius: 12px;
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    position: relative;
    z-index: 1100;
    color: #fff;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .modal-header h3 {
    margin: 0;
    color: #ffffff;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #fff;
  }

  .modal-body {
    text-align: left;
    color: #fff;
  }
  .report-success {
    color: #16a34a;
    font-weight: 600;
    text-align: center;
    margin: 2rem 0;
  }
  .form-group {
    margin-bottom: 1.2rem;
  }
  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.4rem;
    color: #cccccc;
  }
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.8rem;
    border-radius: 8px;
    border: 1px solid #404040;
    background: #2a2a2a;
    color: #ffffff;
    font-size: 1rem;
    margin-top: 0.2rem;
  }
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
  .report-error {
    color: #dc2626;
    margin-bottom: 1rem;
    text-align: center;
  }
  .report-actions {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .cancel-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    color: #cccccc;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
  }
  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .submit-btn {
    flex: 1;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
  }
  .submit-btn:hover {
    background: #b91c1c;
  }
  .submit-btn:disabled {
    background: #a5b4fc;
    cursor: not-allowed;
  }
</style>
