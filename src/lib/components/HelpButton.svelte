<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { submitHelpMessage } from '$lib/api';

  export let position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';

  const dispatch = createEventDispatcher();

  let showModal = false;
  let message = '';
  let screenshotUrl = '';
  let submitting = false;
  let error = '';
  let success = false;
  let token = '';
  let username = '';
  let hasTyped = false;

  onMount(() => {
    const authStore = get(auth);
    token = authStore.token;
    username = authStore.username || 'Guest';
    
    // Add event listener for opening the help modal from navbar
    const openHelpModalHandler = () => openModal();
    document.addEventListener('openHelpModal', openHelpModalHandler);
    
    return () => {
      // Clean up the event listener
      document.removeEventListener('openHelpModal', openHelpModalHandler);
    };
  });

  function openModal() {
    showModal = true;
    message = '';
    screenshotUrl = '';
    error = '';
    success = false;
    hasTyped = false;
  }

  function closeModal() {
    showModal = false;
  }

  function handleMessageInput() {
    if (!hasTyped) {
      hasTyped = true;
    }
  }

  async function handleSubmit() {
    if (!message.trim()) {
      error = 'Please provide a message';
      return;
    }

    if (!token) {
      error = 'You must be logged in to submit feedback';
      return;
    }

    try {
      submitting = true;
      error = '';

      await submitHelpMessage(message, screenshotUrl, token);
      success = true;
      setTimeout(() => {
        closeModal();
      }, 3000);
    } catch (err) {
      error = err.message || 'An error occurred while submitting your feedback';
    } finally {
      submitting = false;
    }
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      error = 'Please select an image file';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      screenshotUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getPositionClass() {
    switch (position) {
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  }
</script>

<button 
  class="help-button {getPositionClass()} help-button-hidden"
  on:click={openModal}
  aria-label="Get help"
  tabindex="-1"
  style="pointer-events: none;"
></button>

{#if showModal}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    on:click={closeModal}
    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeModal()}
  >
    <div class="help-modal" on:click|stopPropagation>
      <div class="modal-header">
        <div class="welcome-section">
          <h1 class="welcome-title">Welcome to</h1>
          <div class="logo-in-modal">
            <h1>APEXMOO</h1>
          </div>
        </div>
      </div>
      
      <div class="modal-body">
        {#if success}
          <div class="success-message">
            <p>Thank you for your feedback! We'll review it shortly.</p>
          </div>
        {:else}
          <form on:submit|preventDefault={handleSubmit}>
            <div class="form-group">
              <h3 class="section-heading">Message</h3>
              <textarea 
                id="message" 
                bind:value={message} 
                on:input={handleMessageInput}
                rows="6" 
                placeholder={hasTyped ? "Type your message here..." : `Hello, ${username}! Are you enjoying APEXMOO? Good or bad we love your feedback! If you are having a problem please describe it here in the message box. Provide screenshots if you can.`}
                required
              ></textarea>
            </div>
            
            <div class="form-group screenshot-group">
              <label for="screenshot" class="screenshot-label">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                  <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093L6.5 10.5l-2.35-2.35a.5.5 0 0 0-.706 0L1 10.5V3a1 1 0 0 1 1-1h12z"/>
                </svg>
              </label>
              <input 
                type="file" 
                id="screenshot" 
                accept="image/*" 
                on:change={handleScreenshotUpload}
                hidden
              />
              
              {#if screenshotUrl}
                <div class="screenshot-preview">
                  <img src={screenshotUrl} alt="Screenshot preview" />
                </div>
              {/if}
            </div>
            
            {#if error}
              <div class="error-message">{error}</div>
            {/if}
            
            <div class="form-actions">
              <button type="submit" class="submit-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .help-button {
    position: fixed;
    z-index: 50;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 9999px;
    width: 60px;
    height: 60px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: background-color 0.2s, transform 0.2s;
  }
  
  .help-button:hover {
    background-color: #2563eb;
    transform: scale(1.05);
  }
  
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
  
  .help-modal {
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
  
  .modal-header {
    padding: 30px 30px 10px 30px;
    border-bottom: 2px solid #333;
  }

  .welcome-section {
    text-align: center;
  }

  .welcome-title {
    color: #fff;
    font-size: 1.8rem;
    margin: 0 0 1px 0;
    font-weight: 600;
  }

  .logo-in-modal h1 {
    font-size: 2.5em;
    font-weight: 900;
    margin: 0;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-family: 'Arial Black', Gadget, Cambria;
    background: linear-gradient(90deg, #fff 0%, #00eaff 50%, #fff 100%);
    background-size: 200% 100%;
    background-position: 100% 0;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    transition: background-position 0.6s cubic-bezier(.4,0,.2,1);
  }

  .logo-in-modal:hover h1 {
    background-position: 0 0;
  }
  
  .modal-body {
    padding: 30px;
  }

  .section-heading {
    font-family:'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    color: #00eaff;
    font-size: 1.2rem;
    margin: 0 0 12px 0;
    font-weight: 700;
  }
  
  .form-group {
    margin-bottom: 5px;
  }
  
  .form-group textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 15px;
    border: 2px solid #333;
    border-radius: 8px;
    font-size: 1rem;
    background-color: #111;
    color: #fff;
    resize: vertical;
    min-height: 140px;
    transition: border-color 0.3s ease;
    max-width: 100%;
  }
  
  .form-group textarea:focus {
    outline: none;
    border-color: #00eaff;
    box-shadow: 0 0 0 3px rgba(0, 234, 255, 0.2);
  }

  .form-group textarea::placeholder {
    color: #888;
    line-height: 1.5;
  }

  .screenshot-group {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .screenshot-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: #333;
    border: 2px solid #555;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    color: #00eaff;
    margin-left: 2px;
  }

  .screenshot-label:hover {
    background-color: #00eaff;
    color: #000;
    border-color: #00eaff;
    transform: scale(1.05);
  }
  
  .screenshot-preview {
    margin-top: 15px;
    border: 2px solid #333;
    border-radius: 8px;
    overflow: hidden;
    max-width: 300px;
  }
  
  .screenshot-preview img {
    max-width: 100%;
    display: block;
  }
  
  .form-actions {
    display: flex;
    justify-content: center;
    margin-top: 30px;
  }
  
  .submit-button {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 15px 40px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .submit-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
  }
  
  .submit-button:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
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
  
  .success-message {
    background-color: #00ff88;
    color: #000;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .help-button-hidden {
    opacity: 0 !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    border: none !important;
    background: none !important;
    box-shadow: none !important;
    position: fixed !important;
    right: 0 !important;
    bottom: 0 !important;
    pointer-events: none !important;
  }
</style>
