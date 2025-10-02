<script>
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { auth } from '$lib/stores/auth'; // Import the auth store
    
    // Correct way to import public environment variables in SvelteKit
    import { env } from '$env/dynamic/public';
    const PUBLIC_API_BASE_URL = env.PUBLIC_API_BASE_URL || 'http://localhost:4000';

    let email = '';
    let password = '';
    let confirmPassword = '';
    let message = ''; // For success or error messages
    let isError = false; // To style messages differently
    let registering = false; // State for loading indicator

    async function handleRegister() {
        if (!browser) return; // Only run in the browser

        message = ''; // Clear previous messages
        isError = false;
        registering = true; // Start loading

        if (!email || !password || !confirmPassword) {
            message = 'All fields are required.';
            isError = true;
            registering = false; // Stop loading
            return;
        }

        if (password !== confirmPassword) {
            message = 'Passwords do not match.';
            isError = true;
            registering = false; // Stop loading
            return;
        }

        try {
            const response = await fetch(`${PUBLIC_API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    password, 
                    confirmPassword,
                    username: '' // Let backend auto-generate username per user preference
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Registration failed');
            }

            message = 'Registration successful! Logging you in...';
            isError = false;

            // Automatically log in the user after successful registration
            await auth.login(email, password);

            // Clear form fields
            email = '';
            password = '';
            confirmPassword = '';

            // Redirect to home page after a short delay
            setTimeout(() => {
                goto('/posts?showLocationSetup=true');
            }, 2000);
        } catch (error) {
            message = error.message || 'Network error or server unavailable.';
            isError = true;
            console.error('An unexpected error occurred during registration:', error);
        } finally {
            registering = false; // Stop loading regardless of success or failure
        }
    }

    // OAuth login handlers
    function handleOAuthLogin(provider) {
        if (!browser) return;
        
        const oauthUrl = `${PUBLIC_API_BASE_URL}/auth/google`;
        
        // Log OAuth redirect for debugging
        console.log('🔍 FRONTEND OAUTH AUDIT:', {
            provider: provider,
            apiBaseUrl: PUBLIC_API_BASE_URL,
            oauthUrl: oauthUrl,
            expectedCallbackUrl: 'https://apexmoo.com/auth/google/callback',
            timestamp: new Date().toISOString()
        });
        
        if (provider === 'google') {
            window.location.href = oauthUrl;
        } else {
            window.location.href = `${PUBLIC_API_BASE_URL}/auth/${provider}`;
        }
    }
</script>

<div class="page-container">
    <div class="register-container">
        <!-- Big ApexMoo Logo -->
        <div class="logo-section">
            <h1 class="apex-logo">APEXMOO</h1>
        </div>
        
        <form on:submit|preventDefault={handleRegister}>
            {#if message}
                <div class="message" class:success={!isError} class:error={isError}>
                    {message}
                </div>
            {/if}
            
            <div class="form-group">
                <input type="email" id="email" bind:value={email} placeholder="Email" required />
            </div>
            
            <div class="form-group">
                <input type="password" id="password" bind:value={password} placeholder="Password" required />
            </div>
            
            <div class="form-group">
                <input type="password" id="confirmPassword" bind:value={confirmPassword} placeholder="Confirm Password" required />
            </div>
            
            <button type="submit" class="register-button" disabled={registering}>
                {registering ? 'Registering...' : 'Register'}
            </button>
            
            <div class="register-footer">
                <p>
                    Already have an account? <a href="/login">Login here</a>.
                </p>
                
                <div class="divider">
                    <span>or</span>
                </div>
                
                <button type="button" class="oauth-button" on:click={() => handleOAuthLogin('google')}>
                    <img src="/images/google-icon.png" alt="Google" onerror="this.src='/images/default-profile.jpg'; this.onerror=null;">
                    Sign up with Google
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
        background-image: url('/images/backgrounds/register.jpg');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        /* Fallback gradient background: black to electric blue */
        background: linear-gradient(135deg, #000 0%, #00eaff 100%);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .register-container {
        width: 100%;
        max-width: 500px;
        padding: 40px 40px;
        /* Slightly transparent black for glass effect */
        background: rgba(0,0,0,0.85);
        border-radius: 16px;
        box-shadow: 0 4px 30px rgba(0, 234, 255, 0.3);
        border: 2px solid #00eaff;
        backdrop-filter: blur(4px);
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

    .register-button {
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

    .register-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 234, 255, 0.4);
    }

    .register-button:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    .register-footer {
        text-align: center;
    }

    .register-footer p {
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