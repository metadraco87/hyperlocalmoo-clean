<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show: boolean = false;
  export let post: any;
  export let shareSuccess: boolean = false;
  export let shareError: string = '';
  export let shareMessage: string = '';
  export let shareBuddies: any[] = [];
  export let shareConnections: any[] = [];
  export let selectedRecipients: Set<string> = new Set();
  export let loadingConnections: boolean = false;
  export let reposting: boolean = false;

  const dispatch = createEventDispatcher();

  function closeShareModal() {
    dispatch('close');
  }

  function toggleRecipient(userId: string) {
    dispatch('toggleRecipient', { userId });
  }

  function sendSharedPost() {
    dispatch('sendSharedPost');
  }

  function repostToProfile() {
    dispatch('repostToProfile');
  }

  function directShare(event: Event) {
    dispatch('directShare', { event });
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeShareModal} on:keydown={(e) => e.key === 'Escape' && closeShareModal()} role="button" tabindex="0">
    <div class="share-modal" on:click|stopPropagation role="dialog">
      <div class="share-modal-header">
        <h3>Share Post</h3>
        <button class="modal-close" on:click={closeShareModal}>&times;</button>
      </div>
      <div class="share-modal-body">
        {#if shareSuccess}
          <div class="success-message">
            <p>✅ Post shared successfully!</p>
          </div>
        {:else}
          {#if shareError}
            <div class="error-message">
              <p>{shareError}</p>
            </div>
          {/if}

          <!-- Repost to Profile Section -->
          <div class="share-section">
            <h4>Repost to Your Profile</h4>
            <p class="share-description">Share this post on your profile with dual authorship.</p>
            <button 
              class="repost-btn" 
              on:click={repostToProfile}
              disabled={reposting}
            >
              {reposting ? 'Reposting...' : 'Repost to My Profile'}
            </button>
          </div>

          <div class="share-divider"></div>

          <!-- Send to Contacts Section -->
          <div class="share-section">
            <h4>Send to Contacts</h4>
            <p class="share-description">Send this post directly to your buddies and connections.</p>
            
            <div class="share-message-section">
              <label for="shareMessage">Message (optional):</label>
              <textarea 
                id="shareMessage"
                bind:value={shareMessage} 
                placeholder="Add a personal message..."
                class="share-message-input"
                rows="2"
              ></textarea>
            </div>

            {#if loadingConnections}
              <div class="loading-contacts">Loading contacts...</div>
            {:else}
              <div class="contacts-section">
                {#if shareBuddies.length > 0}
                  <div class="contacts-group">
                    <h5>Buddies</h5>
                    <div class="contacts-list">
                      {#each shareBuddies as buddy}
                        <label class="contact-item">
                          <input 
                            type="checkbox" 
                            checked={selectedRecipients.has(buddy.email)}
                            on:change={() => toggleRecipient(buddy.email)}
                          />
                          <img src={buddy.profileImageUrl || '/images/default-profile.jpg'} alt={buddy.username} class="contact-avatar" />
                          <span class="contact-name">{buddy.username}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if shareConnections.length > 0}
                  <div class="contacts-group">
                    <h5>Connections</h5>
                    <div class="contacts-list">
                      {#each shareConnections as connection}
                        <label class="contact-item">
                          <input 
                            type="checkbox" 
                            checked={selectedRecipients.has(connection.email)}
                            on:change={() => toggleRecipient(connection.email)}
                          />
                          <img src={connection.profileImageUrl || '/images/default-profile.jpg'} alt={connection.username} class="contact-avatar" />
                          <span class="contact-name">{connection.username}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if shareBuddies.length === 0 && shareConnections.length === 0}
                  <div class="no-contacts">
                    <p>You don't have any buddies or connections to share with yet.</p>
                  </div>
                {/if}
              </div>

              {#if shareBuddies.length > 0 || shareConnections.length > 0}
                <div class="share-actions">
                  <button 
                    type="button" 
                    class="cancel-btn" 
                    on:click={closeShareModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    class="send-btn" 
                    on:click={sendSharedPost}
                    disabled={selectedRecipients.size === 0}
                  >
                    Send to {selectedRecipients.size} {selectedRecipients.size === 1 ? 'contact' : 'contacts'}
                  </button>
                </div>
              {/if}
            {/if}
          </div>

          <div class="share-divider"></div>

          <!-- Legacy Share Section -->
          <div class="share-section">
            <h4>External Share</h4>
            <p class="share-description">Copy link or use system share.</p>
            <button class="external-share-btn" on:click={directShare}>
              📋 Copy Link / Share
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  
  .share-modal {
    background-color: #000;
    border-radius: 16px;
    max-width: 600px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
    border: 2px solid #00eaff;
    margin-top: 60px;
  }
  
  .share-modal-header {
    padding: 30px 30px 10px 30px;
    border-bottom: 2px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .share-modal-header h3 {
    color: #fff;
    font-size: 1.8rem;
    margin: 0;
    font-weight: 600;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .modal-close {
    background: none;
    border: none;
    color: #00eaff;
    font-size: 1.8rem;
    cursor: pointer;
    padding: 5px;
    transition: all 0.3s ease;
  }

  .modal-close:hover {
    color: #fff;
    transform: scale(1.1);
  }

  .share-modal-body {
    padding: 30px;
  }

  .success-message {
    background-color: #00ff88;
    color: #000;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 20px;
  }

  .error-message {
    background-color: #ff1744;
    color: #fff;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 600;
    text-align: center;
  }

  .share-section {
    margin-bottom: 25px;
  }

  .share-section h4 {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #00eaff;
    font-size: 1.2rem;
    margin: 0 0 12px 0;
    font-weight: 700;
  }

  .share-description {
    color: #ccc;
    margin-bottom: 15px;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .repost-btn {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 15px 20px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    width: 100%;
  }

  .repost-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
  }

  .repost-btn:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .share-divider {
    height: 2px;
    background: #333;
    margin: 25px 0;
    border-radius: 1px;
  }

  .share-message-section {
    margin-bottom: 20px;
  }

  .share-message-section label {
    display: block;
    margin-bottom: 12px;
    color: #00eaff;
    font-weight: 700;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 1.1rem;
  }

  .share-message-input {
    width: 100%;
    box-sizing: border-box;
    padding: 15px;
    border: 2px solid #333;
    border-radius: 8px;
    font-size: 1rem;
    background-color: #111;
    color: #fff;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.3s ease;
  }

  .share-message-input:focus {
    outline: none;
    border-color: #00eaff;
    box-shadow: 0 0 0 3px rgba(0, 234, 255, 0.2);
  }

  .share-message-input::placeholder {
    color: #888;
  }

  .loading-contacts {
    text-align: center;
    color: #00eaff;
    padding: 20px;
    font-weight: 600;
  }

  .contacts-section {
    margin-bottom: 20px;
  }

  .contacts-group {
    margin-bottom: 20px;
  }

  .contacts-group h5 {
    margin: 0 0 15px 0;
    color: #00eaff;
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 2px solid #333;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #111;
  }

  .contact-item:hover {
    border-color: #00eaff;
    background-color: rgba(0, 234, 255, 0.1);
  }

  .contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #333;
  }

  .contact-name {
    font-weight: 600;
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .no-contacts {
    text-align: center;
    color: #888;
    padding: 20px;
    font-style: italic;
    background-color: #111;
    border-radius: 8px;
    border: 2px solid #333;
  }

  .share-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin-top: 25px;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid #333;
    color: #ccc;
    padding: 12px 25px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #666;
    color: #fff;
  }

  .send-btn {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border: none;
    padding: 12px 25px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .send-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
  }

  .send-btn:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .external-share-btn {
    background: linear-gradient(135deg, #666 0%, #999 100%);
    color: #fff;
    border: none;
    padding: 15px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
    width: 100%;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .external-share-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(153, 153, 153, 0.4);
  }
</style>
