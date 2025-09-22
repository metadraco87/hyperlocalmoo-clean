// src/routes/posts/+page.js
export const csr = true;  // Enable client-side rendering
export const ssr = false; // Disable server-side rendering

export async function load({ url }) {
    return {
        featureSuccess: url.searchParams.get('featureSuccess') === '1',
        sessionId: url.searchParams.get('session_id') || null,
    };
}