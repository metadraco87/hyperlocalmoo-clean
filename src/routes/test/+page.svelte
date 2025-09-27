<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let currentUrl = '';
  let hostname = '';
  let protocol = '';
  
  onMount(() => {
    if (browser) {
      currentUrl = window.location.href;
      hostname = window.location.hostname;
      protocol = window.location.protocol;
    }
  });
</script>

<div class="test-page">
  <h1>Domain Routing Test</h1>
  <p>This is a minimal test page to verify domain routing works correctly.</p>
  
  <div class="info-box">
    <h2>Current URL Information:</h2>
    <p><strong>Full URL:</strong> {currentUrl}</p>
    <p><strong>Hostname:</strong> {hostname}</p>
    <p><strong>Protocol:</strong> {protocol}</p>
    <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
  </div>
  
  <div class="success-box">
    <h3>✅ Test Successful!</h3>
    <p>If you can see this page without redirect loops, the domain routing is working correctly.</p>
  </div>
  
  <div class="instructions">
    <h3>Testing Instructions:</h3>
    <ul>
      <li>Visit <code>https://apexmoo.com/test</code></li>
      <li>Visit <code>https://www.apexmoo.com/test</code></li>
      <li>Both should load this page without redirects</li>
      <li>Check that the hostname shows correctly in the info above</li>
    </ul>
  </div>
</div>

<style>
  .test-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }
  
  h1 {
    color: #333;
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .info-box {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 2rem 0;
  }
  
  .success-box {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 2rem 0;
  }
  
  .success-box h3 {
    color: #155724;
    margin-top: 0;
  }
  
  .instructions {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 2rem 0;
  }
  
  .instructions h3 {
    color: #856404;
    margin-top: 0;
  }
  
  code {
    background: #e9ecef;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }
  
  ul {
    margin: 1rem 0;
  }
  
  li {
    margin: 0.5rem 0;
  }
</style>
