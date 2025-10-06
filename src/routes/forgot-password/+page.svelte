<script>
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';
    const PUBLIC_API_BASE_URL = env.PUBLIC_API_BASE_URL || 'https://api.apexmoo.com';

    let email = '';
    let message = '';
    let isError = false;
    let isLoading = false;

    async function handleForgotPassword() {
        if (!browser) return;

        message = '';
        isError = false;
        isLoading = true;

        if (!email) {
            message = 'Email is required.';
            isError = true;
            isLoading = false;
            return;
        }

        try {
            const response = await fetch(`${PUBLIC_API_BASE_URL}/api/auth/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                message = data.message;
                isError = false;
                // Show reset token in development (remove this in production)
                if (data.resetToken) {
                    console.log('Reset token (for testing):', data.resetToken);
                    message += ` Reset token: ${data.resetToken}`;
                }
            } else {
                message = data.message || 'Failed to send reset email.';
                isError = true;
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            message = 'Network error. Please try again.';
            isError = true;
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="page-container">
    <div class="forgot-password-container">
        <div class="logo-section">
            <h1 class="apex-logo">APEXMOO</h1>
            <h2>Forgot Password</h2>
        </div>
        
        <form on:submit|preventDefault={handleForgotPassword}>
            {#if message}
                <div class="message" class:success={!isError} class:error={isError}>{message}</div>
            {/if}
            
            <div class="form-group">
                <input 
                    type="email" 
                    bind:value={email} 
                    placeholder="Enter your email address" 
                    required 
                />
            </div>
            
            <button type="submit" class="submit-button" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            
            <div class="footer-links">
                <p>
                    Remember your password? <a href="/login">Back to Login</a>
                </p>
                <p>
                    Don't have an account? <a href="/register">Register here</a>
                </p>
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family: 'Arial', sans-serif;
    }

    .forgot-password-container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 400px;
        text-align: center;
    }

    .logo-section {
        margin-bottom: 2rem;
    }

    .apex-logo {
        font-size: 2.5rem;
        font-weight: bold;
        background: linear-gradient(45deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 0.5rem 0;
    }

    .logo-section h2 {
        color: #333;
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    input {
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        transition: border-color 0.3s ease;
        box-sizing: border-box;
    }

    input:focus {
        outline: none;
        border-color: #667eea;
    }

    .submit-button {
        width: 100%;
        padding: 12px;
        background: linear-gradient(45deg, #667eea, #764ba2);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.3s ease;
        margin-bottom: 1rem;
    }

    .submit-button:hover:not(:disabled) {
        opacity: 0.9;
    }

    .submit-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .message {
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-weight: 500;
    }

    .message.success {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }

    .message.error {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }

    .footer-links {
        text-align: center;
        margin-top: 1rem;
    }

    .footer-links p {
        margin: 0.5rem 0;
        color: #666;
    }

    .footer-links a {
        color: #667eea;
        text-decoration: none;
        font-weight: 600;
    }

    .footer-links a:hover {
        text-decoration: underline;
    }
</style>
