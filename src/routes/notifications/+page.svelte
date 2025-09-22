<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '$lib/api';
    import { clearCache } from '$lib/cache';
    import { auth } from '$lib/stores/auth';
    import { get } from 'svelte/store';

    let notifications = [];
    let consolidatedNotifications = [];
    let loading = true;
    let errorMessage = '';
    let markingAllAsRead = false;

    async function getNotifications() {
        loading = true;
        errorMessage = '';
        try {
            // Get token from auth store
            const authData = get(auth);
            const token = authData?.token;
            
            if (!token) {
                throw new Error('Authentication required');
            }
            
            const data = await fetchNotifications(undefined, token);
            notifications = Array.isArray(data) ? data.sort((a, b) => b.timestamp - a.timestamp) : [];
            
            if (notifications.length === 0) {
                consolidatedNotifications = [];
                console.log('No notifications found for user');
                return;
            }
            
            const communityNotifs = notifications.filter(n => n.type === 'community_posts').reduce((acc, n) => {
                const key = `${n.fenceName}_${n.category}`;
                acc[key] = acc[key] || { count: 0, fenceName: n.fenceName, category: n.category, message: `New community posts in ${n.fenceName}`, type: 'community_posts', timestamp: n.timestamp, readStatus: n.readStatus, relatedEntityId: n.fenceName };
                acc[key].count++;
                acc[key].timestamp = Math.max(acc[key].timestamp, n.timestamp);
                acc[key].readStatus = acc[key].readStatus && n.readStatus;
                return acc;
            }, {});
            consolidatedNotifications = [
                ...Object.values(communityNotifs).map(n => ({ ...n, message: `${n.count} new ${n.category.toLowerCase()} posts in ${n.fenceName}` })),
                ...notifications.filter(n => n.type !== 'community_posts')
            ].sort((a, b) => b.timestamp - a.timestamp);
            console.log('Fetched and sorted notifications:', consolidatedNotifications);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            errorMessage = error.message || 'Failed to load notifications.';
        } finally {
            loading = false;
        }
    }

    async function handleMarkAsRead(notification) {
        if (notification.readStatus) return;

        try {
            await markNotificationAsRead(notification.notificationId, notification.timestamp);
            console.log(`Notification ${notification.notificationId} marked as read.`);
            notifications = notifications.map(n => 
                n.notificationId === notification.notificationId ? { ...n, readStatus: true } : n
            );
            consolidatedNotifications = consolidatedNotifications.map(n => 
                n.type === 'community_posts' && n.fenceName === notification.fenceName && n.category === notification.category ? { ...n, readStatus: true } : n
            );
            clearCache('/api/notifications');
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            errorMessage = error.message || 'Failed to mark notification as read.';
            getNotifications();
        }
    }

    function handleNotificationClick(notification) {
        handleMarkAsRead(notification);
        if (notification.type === 'message' && notification.relatedEntityId) {
            goto(`/messages/${notification.relatedEntityId}`);
        } else if (notification.type === 'new_post' && notification.relatedEntityId) {
            goto(`/posts/${notification.relatedEntityId}`);
        } else if (notification.type === 'community_posts') {
            goto(`/posts?fenceName=${encodeURIComponent(notification.fenceName)}&category=${encodeURIComponent(notification.category)}`);
        }
    }

    async function handleMarkAllAsRead() {
        markingAllAsRead = true;
        errorMessage = '';
        
        try {
            const authData = get(auth);
            const token = authData?.token;
            
            if (!token) {
                throw new Error('Authentication required');
            }
            
            await markAllNotificationsAsRead(token);
            console.log('All notifications marked as read');
            
            // Update local state
            notifications = notifications.map(n => ({ ...n, readStatus: true }));
            consolidatedNotifications = consolidatedNotifications.map(n => ({ ...n, readStatus: true }));
            
            // Clear cache
            clearCache('/api/notifications');
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
            errorMessage = error.message || 'Failed to mark all notifications as read.';
        } finally {
            markingAllAsRead = false;
        }
    }

    onMount(() => {
        if (browser) {
            getNotifications();
        }
    });
</script>

<style>
    .notifications-container {
        padding: 20px;
        max-width: 800px;
        margin: 20px auto;
        background-color: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
        color: #333;
        margin-bottom: 25px;
        text-align: center;
    }
    .notification-list {
        list-style: none;
        padding: 0;
    }
    .notification-item {
        background-color: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        cursor: pointer;
    }
    .notification-item.unread {
        background-color: #e6f7ff;
        border-color: #91d5ff;
        font-weight: bold;
    }
    .notification-item:hover {
        background-color: #f0f8ff;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .notification-content {
        flex-grow: 1;
        padding-right: 15px;
    }
    .notification-message {
        color: #333;
        font-size: 1em;
        margin-bottom: 5px;
    }
    .notification-timestamp {
        font-size: 0.8em;
        color: #888;
        flex-shrink: 0;
    }
    .mark-read-button {
        background-color: #007bff;
        color: white;
        padding: 8px 12px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.8em;
        margin-left: 15px;
        transition: background-color 0.2s ease;
        flex-shrink: 0;
    }
    .mark-read-button:hover {
        background-color: #0056b3;
    }
    .mark-read-button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
    .empty-state {
        text-align: center;
        color: #666;
        padding: 50px 0;
        font-size: 1.1em;
    }
    .error-message {
        color: #d9534f;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 20px;
        font-size: 0.95em;
        text-align: center;
    }
    .header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
    }
    .mark-all-button {
        background-color: #28a745;
        color: white;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color 0.2s ease;
    }
    .mark-all-button:hover:not(:disabled) {
        background-color: #218838;
    }
    .mark-all-button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
</style>

<div class="notifications-container">
    <div class="header-actions">
        <h1>Your Notifications</h1>
        {#if !loading && consolidatedNotifications.length > 0}
            <button 
                class="mark-all-button" 
                on:click={handleMarkAllAsRead}
                disabled={markingAllAsRead || consolidatedNotifications.every(n => n.readStatus)}
            >
                {markingAllAsRead ? 'Marking...' : 'Mark All Read'}
            </button>
        {/if}
    </div>

    {#if loading}
        <p>Loading notifications...</p>
    {:else if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {:else if consolidatedNotifications.length === 0}
        <div class="empty-state">
            <p>You have no notifications at the moment. Check back later! 🔔</p>
        </div>
    {:else}
        <ul class="notification-list">
            {#each consolidatedNotifications as notification (notification.type === 'community_posts' ? `${notification.fenceName}_${notification.category}` : notification.notificationId)}
                <li 
                    class="notification-item" 
                    class:unread={!notification.readStatus}
                    on:click={() => handleNotificationClick(notification)}
                    on:keydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            handleNotificationClick(notification);
                        }
                    }}
                    tabindex="0"
                    role="listitem"
                    aria-label="Notification: {notification.message}"
                >
                    <div class="notification-content">
                        <div class="notification-message">{notification.message}</div>
                    </div>
                    <div class="notification-timestamp">
                        {new Date(notification.timestamp).toLocaleString()}
                    </div>
                    {#if !notification.readStatus}
                        <button 
                            class="mark-read-button" 
                            on:click|stopPropagation={() => handleMarkAsRead(notification)}
                        >
                            Mark Read
                        </button>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</div>