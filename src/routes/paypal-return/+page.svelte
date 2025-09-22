<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api';

  let loading = true;
  let message = '';
  let success = false;
  let error = '';

  onMount(async () => {
    try {
      // Get URL parameters
      const urlParams = new URLSearchParams($page.url.search);
      const token = urlParams.get('token'); // PayPal order ID
      const PayerID = urlParams.get('PayerID');
      
      console.log('PayPal Return: Received parameters:', { token, PayerID });

      if (!token) {
        throw new Error('Missing PayPal order token');
      }

      if (!$auth?.token) {
        throw new Error('User not authenticated');
      }

      // Get stored post information
      const postId = localStorage.getItem('featuringPostId');
      const type = localStorage.getItem('featuringType');
      const duration = localStorage.getItem('featuringDuration');

      console.log('PayPal Return: Retrieved post data:', { postId, type, duration });

      if (!postId || !type || !duration) {
        throw new Error('Missing post featuring information');
      }

      message = 'Processing your payment...';

      // Capture the PayPal payment
      const captureResult = await api.capturePayPalOrder(token, $auth.token);
      console.log('PayPal Return: Capture result:', captureResult);

      if (captureResult.code === 'PAYMENT_CAPTURED') {
        success = true;
        message = 'Payment successful! Your post has been featured.';
        
        // Clear stored data
        localStorage.removeItem('featuringPostId');
        localStorage.removeItem('featuringType');
        localStorage.removeItem('featuringDuration');

        // Redirect to posts page after 3 seconds
        setTimeout(() => {
          goto('/posts');
        }, 3000);
      } else {
        throw new Error(captureResult.message || 'Payment capture failed');
      }

    } catch (e: any) {
      console.error('PayPal Return: Error processing return:', e);
      success = false;
      error = e.message || 'An error occurred processing your payment';
      message = 'Payment processing failed';

      // Redirect to posts page after 5 seconds
      setTimeout(() => {
        goto('/posts');
      }, 5000);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Payment Processing - HyperLocal Moo</title>
</svelte:head>

<div class="payment-return-container">
  <div class="payment-return-card">
    {#if loading}
      <div class="loading-section">
        <div class="spinner"></div>
        <h2>Processing Payment</h2>
        <p>Please wait while we confirm your payment with PayPal...</p>
      </div>
    {:else if success}
      <div class="success-section">
        <div class="success-icon">✅</div>
        <h2>Payment Successful!</h2>
        <p class="success-message">{message}</p>
        <p class="redirect-info">Redirecting you to posts page in a few seconds...</p>
        <button class="continue-btn" on:click={() => goto('/posts')}>
          Continue to Posts
        </button>
      </div>
    {:else}
      <div class="error-section">
        <div class="error-icon">❌</div>
        <h2>Payment Failed</h2>
        <p class="error-message">{error}</p>
        <p class="redirect-info">You will be redirected to the posts page shortly.</p>
        <button class="continue-btn" on:click={() => goto('/posts')}>
          Return to Posts
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .payment-return-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
    padding: 20px;
    font-family: 'Inter', sans-serif;
  }

  .payment-return-card {
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(0, 234, 255, 0.3);
    border-radius: 16px;
    padding: 40px;
    max-width: 500px;
    width: 100%;
    text-align: center;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .loading-section, .success-section, .error-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(0, 234, 255, 0.3);
    border-top: 4px solid #00eaff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .success-icon, .error-icon {
    font-size: 60px;
    margin-bottom: 10px;
  }

  h2 {
    color: #00eaff;
    font-size: 28px;
    font-weight: 600;
    margin: 0;
  }

  .success-message {
    color: #4ade80;
    font-size: 18px;
    font-weight: 500;
    margin: 0;
  }

  .error-message {
    color: #ef4444;
    font-size: 18px;
    font-weight: 500;
    margin: 0;
  }

  .redirect-info {
    color: #9ca3af;
    font-size: 14px;
    margin: 0;
  }

  .continue-btn {
    background: linear-gradient(135deg, #00eaff, #0066ff);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
  }

  .continue-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 234, 255, 0.3);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .payment-return-card {
      padding: 30px 20px;
      margin: 10px;
    }

    h2 {
      font-size: 24px;
    }

    .success-icon, .error-icon {
      font-size: 48px;
    }
  }
</style>