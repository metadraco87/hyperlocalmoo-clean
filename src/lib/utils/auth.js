// src/lib/utils/auth.js

/**
 * Checks if a JWT token is valid (not expired).
 * This is a basic client-side check and does not validate the token's signature.
 * @param {string} token - The JWT token string.
 * @returns {boolean} - True if the token is not expired, false otherwise.
 */
export function checkTokenValidity(token) {
    if (!token) {
        return false;
    }
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) {
            return false;
        }

        const jsonPayload = decodeURIComponent(atob(payloadBase64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const decodedPayload = JSON.parse(jsonPayload);

        if (decodedPayload.exp) {
            const expirationTimeInSeconds = decodedPayload.exp;
            const currentTimeInSeconds = Date.now() / 1000;
            return currentTimeInSeconds < expirationTimeInSeconds;
        }
        return false;
    } catch (error) {
        console.error("Error decoding or validating token (client-side):", error);
        return false;
    }
}