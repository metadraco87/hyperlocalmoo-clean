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

<div class="minimal-test">
    <h1>Apexmoo - Domain Routing Test</h1>
    <p>This is a minimal homepage to test domain routing without redirects.</p>
    
    <div class="info-box">
        <h2>Current URL Information:</h2>
        <p><strong>Full URL:</strong> {currentUrl}</p>
        <p><strong>Hostname:</strong> {hostname}</p>
        <p><strong>Protocol:</strong> {protocol}</p>
        <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
    </div>
    
    <div class="success-box">
        <h3>✅ Domain Routing Working!</h3>
        <p>If you can see this page, the redirect loop issue has been resolved.</p>
    </div>
    
    <div class="links">
        <h3>Test Links:</h3>
        <a href="/test">Visit Test Page</a>
        <a href="/login">Visit Login Page</a>
    </div>
</div>

<style>
    .minimal-test {
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
    
    .links {
        background: #e7f3ff;
        border: 1px solid #b8daff;
        border-radius: 8px;
        padding: 1.5rem;
        margin: 2rem 0;
    }
    
    .links a {
        display: inline-block;
        margin: 0.5rem 1rem 0.5rem 0;
        padding: 0.5rem 1rem;
        background: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 4px;
    }
    
    .links a:hover {
        background: #0056b3;
    }
</style>