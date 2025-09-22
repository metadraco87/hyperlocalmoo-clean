<div class="spinner"></div>

<style>
    .spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-left-color: var(--color-primary, #333); /* Using a CSS variable for color, fallback to #333 */
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
        margin: 20px auto; /* Center the spinner */
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>