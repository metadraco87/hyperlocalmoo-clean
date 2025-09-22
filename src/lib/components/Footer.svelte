<footer>
    <div class="footer-content">
        <p>&copy; {new Date().getFullYear()} Locallore. All rights reserved.</p>
        <nav>
            <a href="/about">About</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
        </nav>
    </div>
</footer>

<style>
    footer {
        background-color: #333;
        color: white;
        padding: 20px;
        text-align: center;
        margin-top: auto; /* Pushes footer to the bottom of the page */
        box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);
    }

    .footer-content {
        max-width: 1200px;
        margin: 0 auto;
    }

    footer p {
        margin-bottom: 10px;
        font-size: 0.9em;
    }

    footer nav a {
        color: #bbb;
        text-decoration: none;
        margin: 0 10px;
        font-size: 0.9em;
        transition: color 0.3s ease;
    }

    footer nav a:hover {
        color: #fff;
        text-decoration: underline;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        footer nav {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        footer nav a {
            margin: 5px 0;
        }
    }
</style>