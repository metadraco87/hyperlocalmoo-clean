// src/lib/notifications.js
import { cachedFetch } from './cache';
import { auth } from './stores/auth';

/**
 * Fetches notifications for the authenticated user.
 * @param {string} [authToken] - JWT token for authenticated requests.
 * @returns {Promise<Array>} - Array of notifications.
 */
export async function fetchNotifications(authToken = null) {
    if (!authToken) {
        const authState = await new Promise(resolve => auth.subscribe(state => resolve(state))());
        authToken = authState.token;
        if (!authToken) throw new Error('Authentication required');
    }

    const response = await cachedFetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${authToken}` }
    }, authToken);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch notifications' }));
        throw new Error(errorData.message || 'Failed to fetch notifications');
    }

    return response.json();
}

/**
 * Marks a notification as read.
 * @param {string} notificationId - The ID of the notification to mark as read.
 * @param {number} timestamp - The timestamp of the notification.
 * @param {string} [authToken] - JWT token for authenticated requests.
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId, timestamp, authToken = null) {
    if (!authToken) {
        const authState = await new Promise(resolve => auth.subscribe(state => resolve(state))());
        authToken = authState.token;
        if (!authToken) throw new Error('Authentication required');
    }

    const response = await cachedFetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ readStatus: true, timestamp })
    }, authToken);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to mark notification as read' }));
        throw new Error(errorData.message || 'Failed to mark notification as read');
    }
}