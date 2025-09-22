<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  export let show = false;
  export let postId: string | null = null;
  export let onClose: () => void = () => {};

  const dispatch = createEventDispatcher();

  let type: 'location' | 'search' = 'location';
  let duration = '1'; // Default: 1 day
  let isLoading = false;
  let errorMessage = '';
  let successMessage = '';
  let authToken: string | null = null;

  let showPaymentForm = false;
  let paymentProcessing = false;

  // Admin bypass
  let adminPassword = '';
  let adminError = '';
  let adminSubmitting = false;

  // Mock payment form fields
  let cardNumber = '';
  let expiryDate = '';
  let cvv = '';
  let cardholderName = '';

  // Detect admin status - use backend-provided isAdmin flag
  let isAdmin = false;
  $: auth.subscribe(value => {
    authToken = value.token;
    // Backend sets isAdmin based on ADMIN_EMAILS environment variable
    isAdmin = value?.isAdmin || false;
  });

  const priceTable: Record<string, Record<string, number>> = {
    location: {
      "1": 1,   // $1 for 1 day
      "3": 3,   // $3 for 3 days
      "7": 5,   // $5 for 1 week
      "14": 8,  // $8 for 2 weeks
      "30": 12  // $12 for 1 month
    },
    search: {
      "1": 0.5,   // $0.50 for 1 day
      "3": 1,     // $1 for 3 days
      "7": 2,     // $2 for 1 week
      "14": 3,    // $3 for 2 weeks
      "30": 5     // $5 for 1 month
    }
  };

  $: auth.subscribe(value => {
    authToken = value.token;
  });


  async function initiatePayment() {
    errorMessage = '';
    successMessage = '';
    if (!postId) {
      errorMessage = 'No post selected to feature';
      return;
    }
    if (isAdmin) {
      // Show admin bypass UI instead of payment
      showPaymentForm = false;
    } else {
      // Redirect directly to PayPal (no payment form)
      await processPayment();
    }
    console.log("Initiating payment for post:", { postId, type, duration, price, isAdmin });
  }

  async function handleAdminFeature() {
    if (!adminPassword.trim()) {
      adminError = 'Admin password is required';
      return;
    }
    try {
      adminSubmitting = true;
      adminError = '';
      const payload = {
        featured: true,
        location: type,
        duration: duration,
        adminPassword: adminPassword.trim()
      };
      console.log('FeatureModal: Sending payload:', payload);
      
      const response = await fetch(`/api/posts/${postId}/feature`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = {}; }
        throw new Error(errorData?.message || 'Failed to feature post');
      }
      const result = await response.json();
      successMessage = 'Post featured successfully!';
      
      // Dispatch featured event to update parent component
      dispatch('featured', {
        postId: postId,
        duration: parseInt(duration),
        type: type,
        result: result
      });
      
      setTimeout(() => { handleClose(); }, 1500);
    } catch (err: any) {
      adminError = err?.message || 'An error occurred while featuring the post';
    } finally {
      adminSubmitting = false;
    }
  }

  async function processPayment() {
    errorMessage = '';
    paymentProcessing = true;
    
    try {
      // Create PayPal order directly
      console.log("Creating PayPal order for post:", { postId, type, duration, price });
      
      const paypalOrder = await import('$lib/api').then(api => {
        return api.createPayPalOrder(postId!, type, duration, authToken!);
      });
      
      console.log("PayPal order created:", paypalOrder);
      
      // Redirect to PayPal for approval
      if (paypalOrder && typeof paypalOrder === 'object' && 'approvalUrl' in paypalOrder) {
        // Store post information for PayPal return handler
        localStorage.setItem('featuringPostId', postId!);
        localStorage.setItem('featuringType', type);
        localStorage.setItem('featuringDuration', duration);
        
        console.log("Redirecting to PayPal approval URL:", paypalOrder.approvalUrl);
        window.location.href = paypalOrder.approvalUrl as string;
        return; // Exit here as we're redirecting
      } else {
        throw new Error('PayPal approval URL not received');
      }
      
    } catch (e: any) {
      console.error("Error processing payment or featuring post:", e);
      errorMessage = e.message || "Payment failed. Please try again.";
    } finally {
      paymentProcessing = false;
    }
  }

  function handleClose() {
    errorMessage = '';
    successMessage = '';
    showPaymentForm = false;
    paymentProcessing = false;
    // Reset form
    cardNumber = '';
    expiryDate = '';
    cvv = '';
    cardholderName = '';
    onClose();
  }

  $: price = priceTable[type][duration];

  function handleBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('feature-modal-backdrop')) {
      handleClose();
    }
  }

  // Format card number input
  function formatCardNumber(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    value = value.substring(0, 16); // Limit to 16 digits
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    cardNumber = value;
    input.value = value; // Ensure the input reflects the formatted value
  }

  // Format expiry date input
  function formatExpiryDate(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 4 digits max
    value = value.substring(0, 4);
    
    if (value.length >= 2) {
      // Validate month as we type
      const month = value.substring(0, 2);
      if (parseInt(month) > 12) {
        value = '12' + value.substring(2);
      }
      if (parseInt(month) === 0) {
        value = '01' + value.substring(2);
      }
      
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
      
      // Validate year as we type
      if (value.length === 5) {
        const year = value.substring(3, 5);
        if (parseInt(year) < 25) {
          value = value.substring(0, 3) + '25';
        }
        if (parseInt(year) > 80) {
          value = value.substring(0, 3) + '80';
        }
      }
    }
    
    expiryDate = value;
    input.value = value;
  }

  // Format CVV input
  function formatCVV(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '').substring(0, 3);
    cvv = value;
    input.value = value;
  }
</script>

{#if show}
  <div class="feature-modal-backdrop" on:click={handleBackdropClick}>
    <div class="feature-modal-content" role="dialog" aria-modal="true" aria-labelledby="featureTitle">
      <h2 id="featureTitle">Feature Post</h2>
      
      {#if isAdmin}
        <!-- Enhanced Admin Bypass UI -->
        <div class="admin-section">
          <div class="admin-badge">
            <span class="admin-icon">👑</span>
            <span>Admin Feature Access</span>
          </div>
          
          <!-- Feature Configuration for Admin -->
          <div class="admin-config">
            <div class="form-group">
              <label>Feature Where?</label>
              <select bind:value={type}>
                <option value="location">Location Page</option>
                <option value="search">Search Results</option>
              </select>
            </div>
            <div class="form-group">
              <label>Duration:</label>
              <select bind:value={duration}>
                {#each Object.keys(priceTable[type]) as d}
                  <option value={d}>{d} {d === '1' ? 'day' : (d === '3' ? 'days' : (d === '7' ? 'week' : (d === '14' ? '2 weeks' : 'month')))} - ${priceTable[type][d]} (Free for Admin)</option>
                {/each}
              </select>
            </div>
          </div>

          <form on:submit|preventDefault={handleAdminFeature} class="admin-form">
            <div class="form-group">
              <label>Admin Password</label>
              <input 
                type="password" 
                bind:value={adminPassword} 
                placeholder="Enter your admin password" 
                required 
                class="admin-password-input"
                disabled={adminSubmitting}
              />
            </div>
            
            {#if adminError}
              <div class="error-message">{adminError}</div>
            {/if}
            {#if successMessage}
              <div class="success-message">{successMessage}</div>
            {/if}
            
            <div class="button-row">
              <button type="button" class="cancel-btn" on:click={handleClose} disabled={adminSubmitting}>Cancel</button>
              <button type="submit" class="admin-feature-btn" disabled={adminSubmitting}>
                {#if adminSubmitting}
                  <span class="loading-spinner"></span>
                  Featuring Post...
                {:else}
                  <span class="admin-icon">⚡</span>
                  Feature Post Now
                {/if}
              </button>
            </div>
          </form>
        </div>
      {:else if !showPaymentForm}
        <!-- Feature Configuration Form -->
        <form on:submit|preventDefault={initiatePayment}>
          <div class="form-group">
            <label>Feature Where?</label>
            <select bind:value={type}>
              <option value="location">Location Page</option>
              <option value="search">Search Results</option>
            </select>
          </div>
          <div class="form-group">
            <label>Duration:</label>
            <select bind:value={duration}>
              {#each Object.keys(priceTable[type]) as d}
                <option value={d}>{d} {d === '1' ? 'day' : (d === '3' ? 'days' : (d === '7' ? 'week' : (d === '14' ? '2 weeks' : 'month')))} - ${priceTable[type][d]}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>Price:</label>
            <span class="price">${price}</span>
          </div>
          {#if errorMessage}
            <div class="error-message">{errorMessage}</div>
          {/if}
          <div class="button-row">
            <button type="button" class="cancel-btn" on:click={handleClose}>Cancel</button>
            <button type="submit" class="pay-btn">
              Continue to Payment
            </button>
          </div>
        </form>
      {:else}
        <!-- Mock Payment Form -->
        <div class="payment-section">
          <h3>Payment Details</h3>
          <div class="order-summary">
            <p><strong>Feature:</strong> {type === 'location' ? 'Location Page' : 'Search Results'}</p>
            <p><strong>Duration:</strong> {duration} {duration === '1' ? 'day' : (duration === '3' ? 'days' : (duration === '7' ? 'week' : (duration === '14' ? '2 weeks' : 'month')))}</p>
            <p><strong>Amount:</strong> ${price}</p>
          </div>
          
          <form on:submit|preventDefault={processPayment}>
            <div class="form-group">
              <label>Cardholder Name</label>
              <input 
                type="text" 
                bind:value={cardholderName} 
                placeholder="John Doe"
                disabled={paymentProcessing}
              />
            </div>
            <div class="form-group">
              <label>Card Number</label>
              <input 
                type="text" 
                value={cardNumber}
                on:input={formatCardNumber}
                placeholder="1234 5678 9012 3456"
                maxlength="19"
                disabled={paymentProcessing}
              />
              <small class="help-text">Enter your real card number for payment processing.</small>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Expiry Date</label>
                <input 
                  type="text" 
                  value={expiryDate}
                  on:input={formatExpiryDate}
                  placeholder="MM/YY"
                  maxlength="5"
                  disabled={paymentProcessing}
                />
              </div>
              <div class="form-group">
                <label>CVV</label>
                <input 
                  type="text" 
                  value={cvv}
                  on:input={formatCVV}
                  placeholder="123"
                  maxlength="3"
                  disabled={paymentProcessing}
                />
              </div>
            </div>
            
            {#if errorMessage}
              <div class="error-message">{errorMessage}</div>
            {/if}
            {#if successMessage}
              <div class="success-message">{successMessage}</div>
            {/if}
            
            <div class="button-row">
              <button type="button" class="cancel-btn" on:click={handleClose} disabled={paymentProcessing}>Cancel</button>
              <button type="submit" class="pay-btn" disabled={paymentProcessing}>
                {#if paymentProcessing}
                  Processing Payment...
                {:else}
                  Pay ${price}
                {/if}
              </button>
            </div>
          </form>
        </div>
      {/if}
      
      <div class="info-row">
        <small>
          Secure Payment via PayPal - You will be redirected to PayPal to complete your payment
        </small>
      </div>
    </div>
  </div>
{/if}

<style>
  .feature-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    z-index: 9500; /* Higher z-index than post-modal-backdrop */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .feature-modal-content {
    background: #000;
    border-radius: 16px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
    border: 2px solid #00eaff;
    display: flex;
    flex-direction: column;
    gap: 1.2em;
    position: relative;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    margin-top: 60px;
  }
  h2 {
    margin: 0 0 1em 0;
    font-size: 1.8em;
    text-align: center;
    color: #00eaff;
    font-weight: 700;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  }
  .form-group {
    margin-bottom: 1.25em;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
  label {
    font-weight: 600;
    color: #00eaff;
    margin-bottom: 0.3em;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  }
  select, input {
    padding: 12px;
    font-size: 1em;
    border-radius: 8px;
    border: 2px solid #333;
    background: #111;
    color: #fff;
    transition: border-color 0.3s ease;
  }
  input:focus, select:focus {
    outline: none;
    border-color: #00eaff;
    box-shadow: 0 0 0 3px rgba(0, 234, 255, 0.2);
  }
  input:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
  }
  .form-row {
    display: flex;
    gap: 1em;
  }
  .form-row .form-group {
    flex: 1;
  }
  .help-text {
    font-size: 0.8em;
    color: #888;
    margin-top: 0.25em;
  }
  .payment-section h3 {
    margin: 0 0 1em 0;
    font-size: 1.2em;
    color: #00eaff;
    text-align: center;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  }
  .order-summary {
    background: #111;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 1em;
    margin-bottom: 1.5em;
    transition: border-color 0.3s ease;
  }
  .order-summary:hover {
    border-color: #00eaff;
  }
  .order-summary p {
    margin: 0.5em 0;
    color: #ccc;
  }
  .price {
    font-size: 1.1em;
    font-weight: 700;
    color: #00ff88;
  }
  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.8em;
    margin-top: 1em;
  }
  .pay-btn, .cancel-btn {
    padding: 12px 24px;
    border-radius: 8px;
    border: 2px solid;
    font-weight: 700;
    font-size: 1em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .pay-btn {
    background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
    color: #000;
    border-color: #00eaff;
  }
  .pay-btn:disabled {
    background: #333;
    color: #666;
    border-color: #333;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .cancel-btn {
    background: #333;
    color: #00eaff;
    border-color: #555;
  }
  .cancel-btn:hover { 
    background: #00eaff; 
    color: #000;
    border-color: #00eaff;
  }
  .pay-btn:hover:not(:disabled) { 
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
  }
  .error-message {
    color: #fff;
    background: #ff1744;
    border: 2px solid #ff1744;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 0.6em;
    text-align: center;
    font-weight: 600;
  }
  .success-message {
    color: #000;
    background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
    border: 2px solid #00ff88;
    padding: 1em;
    border-radius: 8px;
    margin-bottom: 0.6em;
    text-align: center;
    font-weight: 700;
    font-size: 1.1em;
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
    animation: successPulse 0.5s ease-in-out;
  }
  
  @keyframes successPulse {
    0% { transform: scale(0.95); opacity: 0; }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); opacity: 1; }
  }
  .info-row {
    text-align: center;
    margin-top: 0.4em;
    color: #888;
    font-size: 0.91em;
  }

  /* Enhanced Admin Styles */
  .admin-section {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #ffd700;
    border-radius: 12px;
    padding: 1.5em;
    margin-bottom: 1em;
  }

  .admin-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
    color: #000;
    padding: 0.75em 1.5em;
    border-radius: 8px;
    font-weight: 700;
    font-size: 1.1em;
    margin-bottom: 1.5em;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
  }

  .admin-icon {
    font-size: 1.2em;
  }

  .admin-config {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 1em;
    margin-bottom: 1.5em;
    border: 1px solid #333;
  }

  .admin-form {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .admin-password-input {
    border: 2px solid #ffd700 !important;
    background: #0f0f23 !important;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
  }

  .admin-password-input:focus {
    border-color: #ffed4e !important;
    box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.3) !important;
  }

  .admin-feature-btn {
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%) !important;
    color: #000 !important;
    border-color: #ffd700 !important;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    min-height: 48px;
  }

  .admin-feature-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4) !important;
  }

  .admin-feature-btn:disabled {
    background: #333 !important;
    color: #666 !important;
    border-color: #333 !important;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid #000;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>