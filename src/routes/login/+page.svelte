<script>
    import { auth } from '$lib/stores/auth';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';
    const PUBLIC_API_BASE_URL = env.PUBLIC_API_BASE_URL || 'https://api.apexmoo.com';
    
    // Ensure consistent domain usage
    let apiBaseUrl = PUBLIC_API_BASE_URL;
    if (browser) {
        const currentOrigin = window.location.origin;
        if (currentOrigin === 'https://www.apexmoo.com') {
            apiBaseUrl = 'https://api.apexmoo.com'; // API Gateway is on api.apexmoo.com
        }
    }

    export let params;
    
    let email = '';
    let password = '';
    let message = '';
    let isError = false;
    let loggingIn = false;

    // Handle OAuth callback on page load
    if (browser) {
        auth.handleOAuthCallback().then(newState => {
            if (newState?.isLoggedIn) {
                message = 'Login successful via OAuth!';
                isError = false;
                setTimeout(() => goto('/posts', { replaceState: true }), 2000);
            }
        });
    }

    async function handleLogin() {
        if (!browser) return;
        message = '';
        isError = false;
        loggingIn = true;
        try {
            await auth.login(email, password);
            console.log('Login Page: Login successful. Redirecting to /posts.');
            message = 'Login successful!';
            isError = false;
            email = '';
            password = '';
            setTimeout(() => goto('/posts', { replaceState: true }), 2000);
        } catch (error) {
            console.error('Login Page: Login failed:', error.message);
            message = error.message || 'Invalid email or password';
            isError = true;
        } finally {
            loggingIn = false;
        }
    }

    function handleOAuthLogin(provider) {
        if (!browser) return;
        
        const oauthUrl = `${apiBaseUrl}/auth/google`;
        
        // Log OAuth redirect for debugging
        console.log('🔍 FRONTEND OAUTH AUDIT:', {
            provider: provider,
            apiBaseUrl: apiBaseUrl,
            publicApiBaseUrl: PUBLIC_API_BASE_URL,
            oauthUrl: oauthUrl,
            currentDomain: window.location.origin,
            expectedCallbackUrl: 'https://api.apexmoo.com/auth/google/callback',
            timestamp: new Date().toISOString()
        });
        
        if (provider === 'google') {
            window.location.href = oauthUrl;
        } else {
            window.location.href = `${apiBaseUrl}/auth/${provider}`;
        }
    }
</script>

<div class="page-container">
    <div class="login-container">
        <!-- Big ApexMoo Logo -->
        <div class="logo-section">
            <h1 class="apex-logo">APEXMOO</h1>
        </div>
        
        <form on:submit|preventDefault={handleLogin}>
            {#if message}
                <div class="message" class:success={!isError} class:error={isError}>{message}</div>
            {/if}
            <div class="form-group">
                <input type="email" bind:value={email} placeholder="Email" required />
            </div>
            <div class="form-group">
                <input type="password" bind:value={password} placeholder="Password" required />
            </div>
            <button type="submit" class="login-button" disabled={loggingIn}>
                {loggingIn ? 'Logging in...' : 'Login'}
            </button>
            
            <div class="login-footer">
                <p>
                    Don't have an account? <a href="/register">Register here</a>.
                </p>
                <p>
                    <a href="/forgot-password">Forgot your password?</a>
                </p>
                
                <div class="divider">
                    <span>or</span>
                </div>
                
                <button type="button" class="oauth-button" on:click={() => handleOAuthLogin('google')}>
                    <img src="/images/google-icon.png" alt="Google" onerror="this.src='/images/default-profile.jpg'; this.onerror=null;">
                    Log in with Google
                </button>
            </div>
        </form>
    </div>
</div>

<style>
    .page-container {
        height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-image: url('/images/backgrounds/login.jpg');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .login-container {
        width: 100%;
        max-width: 300px;
        padding: 40px 40px;
        background-color: #000;
        border-radius: 16px;
        box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
        border: 2px solid #00eaff;
    }

    .logo-section {
        text-align: center;
        margin-bottom: 40px;
    }

    .apex-logo {
        font-size: 3rem;
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

    .apex-logo:hover {
        background-position: 0 0;
    }

    .form-group {
        margin-bottom: 25px;
    }

    input {
        width: 100%;
        box-sizing: border-box;
        padding: 15px;
        font-size: 16px;
        border: 2px solid #333;
        border-radius: 8px;
        background-color: #111;
        color: #fff;
        transition: border-color 0.3s ease;
    }

    input:focus {
        outline: none;
        border-color: #00eaff;
        box-shadow: 0 0 0 3px rgba(0, 234, 255, 0.2);
    }

    input::placeholder {
        color: #888;
    }

    .login-button {
        width: 100%;
        padding: 15px;
        font-size: 16px;
        font-weight: 700;
        background: linear-gradient(135deg, #00eaff 0%, #0066ff 100%);
        color: #000;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 25px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .login-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
    }

    .login-button:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    .login-footer {
        text-align: center;
    }

    .login-footer p {
        color: #fff;
        margin-bottom: 20px;
    }

    .message {
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 25px;
        text-align: center;
        font-weight: 600;
    }

    .message.success {
        background-color: #00ff88;
        color: #000;
    }

    .message.error {
        background-color: #ff1744;
        color: #fff;
    }

    a {
        color: #00eaff;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.3s ease;
    }

    a:hover {
        color: #fff;
        text-decoration: underline;
    }

    .divider {
        display: flex;
        align-items: center;
        margin: 25px 0;
        color: #888;
    }

    .divider::before,
    .divider::after {
        content: "";
        flex: 1;
        border-bottom: 1px solid #333;
    }

    .divider span {
        padding: 0 15px;
        font-size: 14px;
        color: #888;
    }

    .oauth-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 15px;
        font-size: 16px;
        background-color: #333;
        color: #fff;
        border: 2px solid #555;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 600;
    }

    .oauth-button img {
        width: 20px;
        height: 20px;
    }

    .oauth-button:hover {
        background-color: #00eaff;
        color: #000;
        border-color: #00eaff;
        transform: translateY(-1px);
    }
</style>